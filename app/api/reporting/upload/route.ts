import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  getReportingStore,
  saveReportingStore,
  computeZomatoDelivery,
  computeSwiggyDelivery,
  computeZomatoDineIn,
  computeSwiggyDineout,
  ReportPlatform,
  ReportType,
} from "@/lib/reporting";
import { filterTransactionRows } from "@/lib/dateFilter";

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY;
}

async function extractJsonWithGemini(prompt: string, imageBase64List: string[]) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in .env");
  }

  const parts: any[] = [{ text: prompt }];

  for (const b64 of imageBase64List) {
    let cleanB64 = b64;
    let mimeType = "image/jpeg";
    if (b64.startsWith("data:")) {
      const partsArr = b64.split(",");
      const match = partsArr[0].match(/data:(.*?);base64/);
      if (match) mimeType = match[1];
      cleanB64 = partsArr[1];
    }
    parts.push({
      inlineData: {
        mimeType,
        data: cleanB64,
      },
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No output from Gemini OCR");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No valid JSON found in Gemini output");

  return JSON.parse(jsonMatch[0]);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const platform = (formData.get("platform") as ReportPlatform) || "zomato";
    const type = (formData.get("type") as ReportType) || "delivery";
    const periodLabel = (formData.get("periodLabel") as string) || "Custom Period";
    const startDate = (formData.get("startDate") as string) || "";
    const endDate = (formData.get("endDate") as string) || "";
    const brandId = (formData.get("brandId") as string) || "1";
    const manualAds = parseFloat(
      (formData.get("manualAds") as string) || (formData.get("ads") as string) || "0"
    ) || 0;

    const files = formData.getAll("files") as File[];
    const sectionKey = `${platform}_${type}` as const;

    const store = getReportingStore();

    if (platform === "zomato" && type === "delivery") {
      if (files.length === 0) {
        return NextResponse.json(
          { error: "Please upload the official Zomato Delivery Settlement file (.xlsx, .csv) or screenshot." },
          { status: 400 }
        );
      }

      let rawJson: any = null;

      const firstFile = files[0];
      const isExcelOrCsv = firstFile.name.toLowerCase().endsWith(".xlsx") || 
                           firstFile.name.toLowerCase().endsWith(".xls") || 
                           firstFile.name.toLowerCase().endsWith(".csv");

      if (isExcelOrCsv) {
        // --- 100.00% Zero-Error Native Excel/CSV Direct Statement Parser ---
        const buffer = await firstFile.arrayBuffer();
        const isCsv = firstFile.name.toLowerCase().endsWith(".csv");

        let totalOrders = 0;
        let subTotal = 0;
        let packagingCharges = 0;
        let cancelledOrderRefund = 0;
        let discount = 0;
        let commissionableValue = 0;
        let orderLevelDeduction = 0;
        let taxDeduction = 0;
        let ads = manualAds;
        let hyperpure = 0;
        let netPayout = 0;

        if (isCsv) {
          const text = new TextDecoder().decode(buffer);
          const parsed = Papa.parse<Record<string, any>>(text, { header: true, skipEmptyLines: true });
          parsed.data.forEach((r) => {
            totalOrders += 1;
            subTotal += parseFloat(r["Subtotal"] || r["Sub Total"] || r["Gross Amount"] || r["Bill Amount"] || "0") || 0;
            packagingCharges += parseFloat(r["Packaging Charge"] || r["Packaging Charges"] || "0") || 0;
            discount += parseFloat(r["Discount"] || r["Promo Discount"] || r["Restaurant Discount"] || "0") || 0;
            orderLevelDeduction += parseFloat(r["Commission"] || r["Zomato Commission"] || r["Order Level Deductions"] || "0") || 0;
            taxDeduction += parseFloat(r["TCS"] || r["TDS"] || r["Tax Deductions"] || "0") || 0;
            if (!manualAds) ads += parseFloat(r["Ads"] || r["Ad Spend"] || "0") || 0;
            netPayout += parseFloat(r["Net Payout"] || r["Net Amount"] || r["Net Receivable"] || "0") || 0;
          });

          const subTotalWithPkg = subTotal + packagingCharges;
          commissionableValue = subTotalWithPkg - discount;

          rawJson = {
            total_orders: totalOrders,
            sub_total: Number(subTotal.toFixed(2)),
            packaging_charges: Number(packagingCharges.toFixed(2)),
            sub_total_with_pkg: Number(subTotalWithPkg.toFixed(2)),
            cancelled_order_refund: cancelledOrderRefund,
            discount: Number(discount.toFixed(2)),
            commissionable_value: Number(commissionableValue.toFixed(2)),
            order_level_deduction: Number(orderLevelDeduction.toFixed(2)),
            tax_deduction: Number(taxDeduction.toFixed(2)),
            ads: Number(ads.toFixed(2)),
            hyperpure,
            net_payout: Number(netPayout.toFixed(2))
          };
        } else {
          // --- Read ONLY 'Payout Breakup' Sheet ---
          const workbook = XLSX.read(buffer, { type: "array" });
          const payoutSheetName = workbook.SheetNames.find(s => /payout\s*breakup/i.test(s)) || workbook.SheetNames[0];

          if (payoutSheetName && workbook.Sheets[payoutSheetName]) {
            const sheet = workbook.Sheets[payoutSheetName];
            const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

            let discountPromo = 0;
            let discountBogo = 0;

            const parseNum = (val: any) => {
              if (val === undefined || val === null || val === "-" || val === "") return 0;
              const n = parseFloat(String(val).replace(/,/g, "").trim());
              return isNaN(n) ? 0 : n;
            };

            rows.forEach((r) => {
              if (!Array.isArray(r)) return;
              const sNo = String(r[1] || "").trim();
              const particular = String(r[2] || "").trim();
              const delivVal = parseNum(r[3]); // Delivered Orders column
              const totalVal = parseNum(r[5]); // Total column

              if (particular.includes("Number of orders")) {
                totalOrders = delivVal;
              } else if (particular.includes("Subtotal (items total)")) {
                subTotal = delivVal;
              } else if (particular.includes("Packaging charge")) {
                packagingCharges = delivVal;
              } else if (particular.includes("Restaurant discount (Promo)")) {
                discountPromo = Math.abs(delivVal);
              } else if (particular.includes("Restaurant discount (BOGO")) {
                discountBogo = Math.abs(delivVal);
              } else if (particular.includes("Net order value") || sNo === "A") {
                commissionableValue = delivVal;
              } else if (particular.includes("Service fees & payment mechanism fees") || sNo === "C") {
                orderLevelDeduction = Math.abs(delivVal);
              } else if (particular.includes("Government charges") || sNo === "D") {
                taxDeduction = Math.abs(delivVal);
              } else if (particular.includes("Investment in growth services") || sNo === "F") {
                if (!manualAds && ads === 0) ads = Math.abs(totalVal || delivVal);
              } else if (particular.includes("Investment in Hyperpure") || sNo === "G") {
                hyperpure = Math.abs(totalVal || delivVal);
              } else if (particular.includes("Cancellation refund for cancelled orders")) {
                cancelledOrderRefund = Math.abs(delivVal);
              } else if ((particular.includes("Net Payout") || sNo === "J") && !particular.includes("Net Payout %")) {
                netPayout = totalVal || delivVal;
              }
            });

            discount = discountPromo + discountBogo;

            // --- HYBRID BYPASS FOR RAW UN-EDITED ZOMATO PORTAL DOWNLOADS ---
            // If Payout Breakup formulas evaluated to 0 (because Enable Editing was not clicked),
            // evaluate the formulas from the 'Order Level' sheet automatically!
            if ((totalOrders === 0 || (startDate && endDate)) && workbook.Sheets["Order Level"]) {
              const olSheet = workbook.Sheets["Order Level"];
              const olRows = XLSX.utils.sheet_to_json<any[]>(olSheet, { header: 1 });

              let olOrders = 0;
              let olSubtotal = 0;
              let olPkg = 0;
              let olPromoDisc = 0;
              let olServiceFee = 0;
              let olGovtCharges = 0;
              let olCustomerGst = 0;
              let olAdditions = 0;



              // === DYNAMIC COLUMN DETECTION — works for ANY Zomato layout ===
              // Find the header row first
              let headerRowIdx = -1;
              for (let i = 0; i < Math.min(15, olRows.length); i++) {
                const row = olRows[i];
                if (Array.isArray(row)) {
                  const rStr = row.map((x) => String(x || "").toLowerCase()).join(" ");
                  if (rStr.includes("order status") && (rStr.includes("subtotal") || rStr.includes("payout"))) {
                    headerRowIdx = i; break;
                  }
                }
              }

              // Helper: find column index by searching for any of the given substrings
              const findCol = (row: any[], ...terms: string[]): number => {
                for (const term of terms) {
                  const idx = row.findIndex((h) => String(h || "").toLowerCase().replace(/\n/g, " ").includes(term));
                  if (idx >= 0) return idx;
                }
                return -1;
              };

              let cStatus = 8, cSubtotal = 14, cPkg = 15, cCustGst = 21;
              let cDiscPromo = 17, cDiscBogo = 18, cDiscRelisting = 20;
              let cSfPmf = 27;   // Combined SF + PMF (preferred)
              let cBaseSf = -1;  // Individual base SF (fallback)
              let cPmf = 26;     // Individual PMF (fallback)
              let cRejPenalty = 37;   // Customer compensation / rejection penalty
              let cGovtCharges = 36;  // Government charges (pre-computed D total)
              let cAdditions = 47;    // Net additions (tips + refunds)

              if (headerRowIdx >= 0) {
                const hRow = olRows[headerRowIdx];
                const s  = findCol(hRow, "order status (delivered");
                const st = findCol(hRow, "subtotal (items total)");
                const pk = findCol(hRow, "packaging charge");
                const cg = findCol(hRow, "total gst collected from customers");
                const dp = findCol(hRow, "restaurant discount (promo)", "restaurant discount [promo]");
                const db = findCol(hRow, "restaurant discount (bogo", "restaurant discount [bogo");
                const dr = findCol(hRow, "delivery charge discount/ relisting", "delivery charge discount / relisting");
                // Service fee — prefer combined pre-computed column
                const sf = findCol(hRow, "service fee & payment mechanism fee");
                const bsf = findCol(hRow, "base service fee [");
                const pmf = findCol(hRow, "payment mechanism fee");
                const rp = findCol(hRow, "customer compensation/ recoupment", "customer compensation/recoupment");
                const gc = findCol(hRow, "government charges [(");
                const ad = findCol(hRow, "net additions");

                if (s  >= 0) cStatus = s;
                if (st >= 0) cSubtotal = st;
                if (pk >= 0) cPkg = pk;
                if (cg >= 0) cCustGst = cg;
                if (dp >= 0) cDiscPromo = dp;
                if (db >= 0) cDiscBogo = db;
                if (dr >= 0) cDiscRelisting = dr;
                if (sf >= 0) cSfPmf = sf;        // combined (e.g. col 27 or col 34)
                if (bsf >= 0) cBaseSf = bsf;      // individual base sf
                if (pmf >= 0) cPmf = pmf;
                if (rp >= 0) cRejPenalty = rp;
                if (gc >= 0) cGovtCharges = gc;
                if (ad >= 0) cAdditions = ad;
              }

              const getN = (row: any[], idx: number) =>
                idx >= 0 && idx < row.length ? Math.abs(parseNum(row[idx])) : 0;

              // === DATE FILTER SETUP ===
              let filterStartStr = "";
              let filterEndStr = "";
              let filterMonthPad = "";

              if (startDate && endDate) {
                filterStartStr = startDate.substring(0, 10);
                filterEndStr = endDate.substring(0, 10);
              } else if (periodLabel) {
                const rangeMatch = periodLabel.match(/(\d{1,2})\s*-\s*(\d{1,2})\s*([a-zA-Z]{3,9})/i);
                if (rangeMatch) {
                  const d1 = rangeMatch[1].padStart(2, "0");
                  const d2 = rangeMatch[2].padStart(2, "0");
                  const mStr = rangeMatch[3].toLowerCase();
                  const mIndex = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(mStr) + 1;
                  if (mIndex > 0) {
                    const mPad = mIndex < 10 ? `0${mIndex}` : `${mIndex}`;
                    filterStartStr = `2026-${mPad}-${d1}`;
                    filterEndStr   = `2026-${mPad}-${d2}`;
                    filterMonthPad = mPad;
                  }
                } else {
                  const monthMatch = periodLabel.match(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i);
                  if (monthMatch) {
                    const mStr = monthMatch[0].toLowerCase();
                    const mIndex = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(mStr) + 1;
                    filterMonthPad = mIndex < 10 ? `0${mIndex}` : `${mIndex}`;
                  }
                }
              }

              const parseYMD = (val: any): string | null => {
                if (val === undefined || val === null || val === "" || val === "-") return null;
                if (typeof val === "number" || (!isNaN(Number(val)) && Number(val) > 40000 && Number(val) < 60000)) {
                  const dateObj = XLSX.SSF.parse_date_code(Number(val));
                  if (dateObj && dateObj.y && dateObj.m && dateObj.d) {
                    const y = dateObj.y;
                    const m = dateObj.m < 10 ? `0${dateObj.m}` : `${dateObj.m}`;
                    const d = dateObj.d < 10 ? `0${dateObj.d}` : `${dateObj.d}`;
                    return `${y}-${m}-${d}`;
                  }
                }
                const s = String(val).trim();
                let match = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
                if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
                match = s.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
                if (match) {
                  let y = match[3];
                  if (y.length === 2) y = `20${y}`;
                  return `${y}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
                }
                return null;
              };

              const isOrderDateMatch = (dateStrRaw: any): boolean => {
                if (!dateStrRaw) return true;
                const ymd = parseYMD(dateStrRaw);
                if (!ymd) return true;
                if (!filterStartStr && !filterEndStr && !filterMonthPad) return true;
                if (filterStartStr && filterEndStr) return ymd >= filterStartStr && ymd <= filterEndStr;
                if (filterMonthPad) return ymd.includes(`-${filterMonthPad}-`);
                return true;
              };

              // Parse period string like "27 July 26 - 31 July 26" -> [startYMD, endYMD]
              const parsePeriodRange = (periodStr: string): [string, string] | null => {
                const monthMap: Record<string, string> = {
                  "jan":"01","feb":"02","mar":"03","apr":"04","may":"05","jun":"06",
                  "jul":"07","aug":"08","sep":"09","oct":"10","nov":"11","dec":"12"
                };
                const parts = periodStr.split(/\s+-\s+/);
                if (parts.length < 2) return null;
                const parseOne = (s: string): string | null => {
                  const m = s.trim().match(/(\d{1,2})\s+(\w+)\s+(\d{2,4})/);
                  if (!m) return null;
                  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
                  const mo = monthMap[m[2].toLowerCase().substring(0, 3)];
                  if (!mo) return null;
                  return `${y}-${mo}-${m[1].padStart(2, "0")}`;
                };
                const s = parseOne(parts[0]);
                const e = parseOne(parts[parts.length - 1]);
                if (!s || !e) return null;
                return [s, e];
              };

              // Check if an ads period overlaps with our date filter window
              const isPeriodInFilter = (periodStr: string): boolean => {
                if (!filterStartStr && !filterEndStr && !filterMonthPad) return true;
                const range = parsePeriodRange(periodStr);
                if (!range) return true;
                const [pStart, pEnd] = range;
                if (filterStartStr && filterEndStr) return pStart <= filterEndStr && pEnd >= filterStartStr;
                if (filterMonthPad) {
                  const monthStart = `2026-${filterMonthPad}-01`;
                  const monthEnd   = `2026-${filterMonthPad}-31`;
                  return pStart.includes(`-${filterMonthPad}-`) || pEnd.includes(`-${filterMonthPad}-`) ||
                    (pStart <= monthStart && pEnd >= monthEnd);
                }
                return true;
              };


              olRows.forEach((r) => {
                if (!Array.isArray(r) || r.length < 5) return;
                const dateVal = r[2] || r[3] || r[1];
                if (!isOrderDateMatch(dateVal)) return;

                const statusVal = String(r[cStatus] || "").trim().toUpperCase();
                const isDelivered = statusVal.includes("DELIVERED");
                const isCancelled = statusVal.includes("CANCELLED");
                const isRejected  = statusVal.includes("REJECTED");
                if (!isDelivered && !isCancelled && !isRejected) return;

                olOrders += 1;

                // Net Order Value (A): DELIVERED orders only
                if (isDelivered) {
                  olSubtotal    += parseNum(r[cSubtotal]);
                  olPkg         += parseNum(r[cPkg]);
                  olCustomerGst += parseNum(r[cCustGst]);
                  olPromoDisc   += getN(r, cDiscPromo) + getN(r, cDiscBogo) + getN(r, cDiscRelisting);
                }

                // Service Fee (C): combined col if available, else base_sf + pmf
                const sfVal = r[cSfPmf] !== undefined && r[cSfPmf] !== null && r[cSfPmf] !== "" && parseNum(r[cSfPmf]) !== 0
                  ? Math.abs(parseNum(r[cSfPmf]))
                  : (getN(r, cBaseSf) + getN(r, cPmf));
                olServiceFee  += sfVal + getN(r, cRejPenalty);

                // Govt Charges (D): pre-computed total
                olGovtCharges += getN(r, cGovtCharges);

                // Additions (B): tips + cancellation refunds
                olAdditions   += parseNum(r[cAdditions] >= 0 ? r[cAdditions] : 47);
              });


              // Read Ads & Hyperpure from 'Addition Deductions Details' with period-overlap date filtering
              let adSheetAds = 0;
              let adSheetHyperpure = 0;
              let adSheetMisc = 0; // Miscellaneous (G): non-ADS entries in growth services section
              const adSheetName = workbook.SheetNames.find((s) => /addition/i.test(s) && /deduction/i.test(s));

              if (adSheetName && workbook.Sheets[adSheetName]) {
                const adSheet = workbook.Sheets[adSheetName];
                const adRows = XLSX.utils.sheet_to_json<any[]>(adSheet, { header: 1 });
                let section: string | null = null;

                adRows.forEach((r) => {
                  if (!Array.isArray(r)) return;
                  const colA = String(r[0] || "").trim().toLowerCase();
                  const colB = String(r[1] || "").trim().toLowerCase();
                  const combined = colA + " " + colB;

                  // Section headers can appear in r[0] or r[1]
                  if (combined.includes("investments in growth services")) { section = "ads"; return; }
                  if (combined.includes("investments in hyperpure")) { section = "hyperpure"; return; }
                  // Reset section on "total", "C)", "D)" rows
                  if (colA.startsWith("total") || colA.startsWith("c)") || colA.startsWith("d)") ||
                      colB.startsWith("total") || colB.startsWith("c)") || colB.startsWith("d)")) {
                    section = null; return;
                  }
                  if (!section) return;

                  const typeStr = String(r[1] || "").trim();
                  if (!typeStr || typeStr.toLowerCase() === "type" || typeStr.toLowerCase() === "res id for which deduction created") return;

                  // Column layout for deduction rows:
                  // r[1]=Type, r[2]=ResId, r[3]=Invoice/Campaign ID, r[4]=Deduction time period, r[5]=Settlement status, r[6]=Total amount, r[7]=Adjusted amount
                  const val = Math.abs(parseNum(r[7]) || parseNum(r[6]) || 0);
                  if (!val) return;

                  const periodStr = String(r[4] || "").trim();

                  if (section === "ads") {
                    // Only count actual ADS type — skip non-ADS entries (e.g. TDS_194O)
                    // that Zomato places under growth services but shows as Miscellaneous (G) on dashboard
                    if (typeStr.toUpperCase() === "ADS" && isPeriodInFilter(periodStr)) {
                      adSheetAds += val;
                    } else if (typeStr.toUpperCase() !== "ADS" && isPeriodInFilter(periodStr)) {
                      // Non-ADS entries (e.g. TDS_194O) = Miscellaneous deductions (G)
                      adSheetMisc += val;
                    }
                  } else if (section === "hyperpure") {
                    adSheetHyperpure += val;
                  }
                });
              }

              if (olOrders > 0) {
                totalOrders = olOrders;
                subTotal = olSubtotal;
                packagingCharges = olPkg;
                discount = olPromoDisc;
                commissionableValue = subTotal + packagingCharges + olCustomerGst - discount;
                orderLevelDeduction = olServiceFee;
                taxDeduction = olGovtCharges;
                cancelledOrderRefund = olAdditions;
                if (!manualAds) ads = adSheetAds;
                hyperpure = adSheetHyperpure;
                netPayout = Number((commissionableValue + cancelledOrderRefund - orderLevelDeduction - taxDeduction - ads - hyperpure - adSheetMisc).toFixed(2));
              }
            }

            const subTotalWithPkg = subTotal + packagingCharges;

            rawJson = {
              total_orders: totalOrders,
              sub_total: Number(subTotal.toFixed(2)),
              packaging_charges: Number(packagingCharges.toFixed(2)),
              sub_total_with_pkg: Number(subTotalWithPkg.toFixed(2)),
              cancelled_order_refund: cancelledOrderRefund,
              discount: Number(discount.toFixed(2)),
              commissionable_value: Number(commissionableValue.toFixed(2)),
              order_level_deduction: Number(orderLevelDeduction.toFixed(2)),
              tax_deduction: Number(taxDeduction.toFixed(2)),
              ads: Number(ads.toFixed(2)),
              hyperpure: Number(hyperpure.toFixed(2)),
              net_payout: Number(netPayout.toFixed(2))
            };
          }
        }
      } else {
        // Image OCR Fallback
        const b64List: string[] = [];
        for (const file of files) {
          const bytes = await file.arrayBuffer();
          b64List.push(Buffer.from(bytes).toString("base64"));
        }

        const prompt = `Extract raw numerical values from these Zomato Payout details screenshot(s).
Respond ONLY with a JSON object containing these exact keys (use 0 if a field is not found):
{
  "total_orders": number,
  "sub_total": number,
  "packaging_charges": number,
  "sub_total_with_pkg": number,
  "cancelled_order_refund": number,
  "discount": number,
  "commissionable_value": number,
  "order_level_deduction": number,
  "tax_deduction": number,
  "ads": number,
  "hyperpure": number,
  "net_payout": number
}`;
        rawJson = await extractJsonWithGemini(prompt, b64List);
      }

      const commVal = Number(
        rawJson.commissionable_value ||
        rawJson.net_order_value ||
        (Number(rawJson.sub_total || 0) + Number(rawJson.packaging_charges || 0) - Number(rawJson.discount || 0)) ||
        0
      );

      const computed = computeZomatoDelivery({
        brandId,
        periodLabel,
        startDate,
        endDate,
        orders: rawJson.total_orders,
        subTotal: rawJson.sub_total,
        packagingCharges: rawJson.packaging_charges,
        subTotalWithPkg: rawJson.sub_total_with_pkg || (rawJson.sub_total + rawJson.packaging_charges),
        cancelledOrderRefund: rawJson.cancelled_order_refund,
        discount: rawJson.discount,
        commissionableValue: commVal,
        orderLevelDeduction: rawJson.order_level_deduction,
        taxDeduction: rawJson.tax_deduction,
        ads: manualAds || rawJson.ads,
        hyperpure: rawJson.hyperpure,
        netPayout: rawJson.net_payout,
        rawInput: rawJson,
      });

      // Overwrite existing if matching periodLabel or date range under same brand
      const existingIdx = store.zomato_delivery.findIndex(
        (p) =>
          (p.brandId === brandId || !p.brandId) &&
          (p.periodLabel === periodLabel || (startDate && endDate && p.startDate === startDate && p.endDate === endDate))
      );
      if (existingIdx >= 0) {
        store.zomato_delivery[existingIdx] = computed;
      } else {
        store.zomato_delivery.push(computed);
      }

      saveReportingStore(store);
      return NextResponse.json({ success: true, item: computed, section: sectionKey });
    }

    if (platform === "zomato" && type === "dinein") {
      if (files.length === 0) {
        return NextResponse.json(
          { error: "Please upload the Zomato Dine-in Excel file (.xlsx)." },
          { status: 400 }
        );
      }

      const file = files[0];
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      let transactions = 0;
      let preGmv = 0;
      let postGmv = 0;
      let discount = 0;
      let commission = 0;
      let ads = manualAds;
      let netPayout = 0;

      // 1. Read ONLY 'Transactions summary' sheet (IGNORE 'Summary', 'Payout breakup', 'Glossary')
      const txSheetName = workbook.SheetNames.find(
        (s) =>
          /transactions\s*summary/i.test(s) ||
          /transaction\s*summary/i.test(s) ||
          (/^transactions$/i.test(s.trim()) && !/^summary$/i.test(s.trim()))
      );

      if (txSheetName && workbook.Sheets[txSheetName]) {
        const txSheet = workbook.Sheets[txSheetName];
        // Header row in 'Transactions summary' is at range index 6
        const txRows = XLSX.utils.sheet_to_json<Record<string, any>>(txSheet, { range: 6 });

        const { filteredRows, totalRows, excludedRows } = filterTransactionRows(txRows, {
          startDate,
          endDate,
          periodLabel,
          fileName: file.name,
        });

        filteredRows.forEach((r) => {
          if (r["Transaction ID"] || r["Bill Amount"] !== undefined) {
            transactions += 1;
            preGmv += parseFloat(r["Bill Amount"] || 0);
            discount += parseFloat(r["Instant discount"] || 0);
            commission +=
              parseFloat(r["Commission Amount"] || 0) +
              parseFloat(r["Tax on commission"] || 0);
            netPayout += parseFloat(
              r["Net receivable "] || r["Net receivable"] || 0
            );
          }
        });
        postGmv = preGmv - discount;
        console.log(`[Zomato Dine-in] Processed ${transactions} valid transactions (Total rows: ${totalRows}, Excluded: ${excludedRows})`);
      }

      // 2. Read ONLY 'Additions & deductions' sheet for Ads spend
      const adSheetName = workbook.SheetNames.find(
        (s) =>
          /additions\s*&\s*deductions/i.test(s) ||
          /additions\s*and\s*deductions/i.test(s) ||
          /addition|deduction/i.test(s)
      );

      if (!manualAds && adSheetName && workbook.Sheets[adSheetName]) {
        const adSheet = workbook.Sheets[adSheetName];
        const adRows = XLSX.utils.sheet_to_json<Record<string, any>>(adSheet, { range: 2 });
        for (const r of adRows) {
          const sno = String(r["S.no."] || "").trim();
          if (sno === "Total amount" || sno.toLowerCase().includes("other additions")) {
            break;
          }
          const typeVal = String(r["Type"] || "").trim().toUpperCase();
          if (typeVal === "DEDUCTION" || typeVal === "ADDITION") {
            const rawAmt = parseFloat(r["Amount"]);
            if (!isNaN(rawAmt)) {
              const dateStr = String(r["Date"] || "");
              let matchesDate = true;
              if (startDate && endDate) {
                const sStr = startDate.substring(0, 10);
                const eStr = endDate.substring(0, 10);
                const dMatch = dateStr.match(/\d{4}-\d{2}-\d{2}/);
                if (dMatch) {
                  const dStr = dMatch[0];
                  matchesDate = dStr >= sStr && dStr <= eStr;
                } else {
                  const dt = new Date(dateStr);
                  if (!isNaN(dt.getTime())) {
                    const s = new Date(startDate);
                    const e = new Date(endDate);
                    e.setHours(23, 59, 59, 999);
                    matchesDate = dt >= s && dt <= e;
                  }
                }
              } else if (periodLabel) {
                const monthMatch = periodLabel.match(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i);
                if (monthMatch) {
                  const mStr = monthMatch[0].toLowerCase();
                  const mIndex = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(mStr) + 1;
                  const mPad = mIndex < 10 ? `0${mIndex}` : `${mIndex}`;
                  matchesDate = dateStr.includes(`-${mPad}-`) || dateStr.includes(`/${mPad}/`) || dateStr.includes(`-${mPad} `) || dateStr.startsWith(`2026-${mPad}`) || dateStr.startsWith(`2024-${mPad}`);
                }
              }

              if (matchesDate) {
                ads += Math.abs(rawAmt);
              }
            }
          }
        }
        ads = Number(ads.toFixed(2));
      }

      const computed = computeZomatoDineIn({
        brandId,
        periodLabel,
        startDate,
        endDate,
        transactions,
        preGmv,
        postGmv,
        discount,
        commission,
        ads,
        netPayout,
      });

      const existingIdx = store.zomato_dinein.findIndex(
        (p) =>
          (p.brandId === brandId || !p.brandId) &&
          (p.periodLabel === periodLabel ||
            (startDate && endDate && p.startDate === startDate && p.endDate === endDate))
      );
      if (existingIdx >= 0) {
        store.zomato_dinein[existingIdx] = computed;
      } else {
        store.zomato_dinein.push(computed);
      }

      saveReportingStore(store);
      return NextResponse.json({ success: true, item: computed, section: sectionKey });
    }

    if (platform === "swiggy" && type === "delivery") {
      if (files.length === 0) {
        return NextResponse.json(
          { error: "Please upload the official Swiggy Delivery Settlement file (.xlsx, .csv) or screenshot." },
          { status: 400 }
        );
      }

      let rawJson: any = null;
      const firstFile = files[0];
      const isExcelOrCsv = firstFile.name.toLowerCase().endsWith(".xlsx") || 
                           firstFile.name.toLowerCase().endsWith(".xls") || 
                           firstFile.name.toLowerCase().endsWith(".csv");

      if (isExcelOrCsv) {
        // --- 100.00% Zero-Error Native Excel/CSV Direct Statement Parser for Swiggy Delivery ---
        const buffer = await firstFile.arrayBuffer();
        const isCsv = firstFile.name.toLowerCase().endsWith(".csv");

        let orders = 0;
        let subTotal = 0;
        let packagingCharges = 0;
        let discount = 0;
        let commissionableValue = 0;
        let totalFees = 0;
        let gstOnFees = 0;
        let complaintsCancellation = 0;
        let totalTaxes = 0;
        let ads = manualAds;
        let netPayout = 0;
        let gstSec19 = 0;
        let tcs = 0;
        let tds = 0;

        if (isCsv) {
          const text = new TextDecoder().decode(buffer);
          const parsed = Papa.parse<Record<string, any>>(text, { header: true, skipEmptyLines: true });
          parsed.data.forEach((r) => {
            orders += 1;
            subTotal += parseFloat(r["Item Total"] || r["Sub Total"] || r["Gross Amount"] || "0") || 0;
            packagingCharges += parseFloat(r["Packaging Charges"] || r["Packaging Charge"] || "0") || 0;
            discount += parseFloat(r["Restaurant Discounts"] || r["Merchant Discount"] || r["Discount"] || "0") || 0;
            totalFees += parseFloat(r["Swiggy Commission"] || r["Total Fees"] || r["Commission"] || "0") || 0;
            gstOnFees += parseFloat(r["GST on Fees"] || r["GST @ 18%"] || "0") || 0;
            if (!manualAds) ads += parseFloat(r["Growth Investments in Ads"] || r["Ads Spend"] || r["Ad Cost"] || "0") || 0;
            netPayout += parseFloat(r["FINAL PAYOUT"] || r["Net Settlement"] || r["Net Payout"] || "0") || 0;
          });

          const subTotalWithPkg = subTotal + packagingCharges;
          commissionableValue = subTotalWithPkg - discount;

          rawJson = {
            orders,
            sub_total: Number(subTotal.toFixed(2)),
            packaging_charges: Number(packagingCharges.toFixed(2)),
            sub_total_with_pkg: Number(subTotalWithPkg.toFixed(2)),
            discount: Number(discount.toFixed(2)),
            commissionable_value: Number(commissionableValue.toFixed(2)),
            total_fees: Number(totalFees.toFixed(2)),
            gst_on_fees: Number(gstOnFees.toFixed(2)),
            complaints_cancellation: complaintsCancellation,
            total_taxes: totalTaxes,
            ads: Number(ads.toFixed(2)),
            net_payout: Number(netPayout.toFixed(2))
          };
        } else {
          // --- Read ONLY 'Payout Breakup' Sheet ---
          const workbook = XLSX.read(buffer, { type: "array" });
          const payoutSheetName = workbook.SheetNames.find(s => /payout\s*breakup/i.test(s)) || workbook.SheetNames[0];

          if (payoutSheetName && workbook.Sheets[payoutSheetName]) {
            const sheet = workbook.Sheets[payoutSheetName];
            const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

            const parseNum = (val: any) => {
              if (val === undefined || val === null || val === "-" || val === "") return 0;
              const n = parseFloat(String(val).replace(/,/g, "").trim());
              return isNaN(n) ? 0 : n;
            };

            // Find column indices for 'Total' and 'Swiggy Orders' (Delivered Orders)
            let swiggyDelivColIdx = 3; // Default Col 4 (zero-indexed 3)
            let swiggyTotalColIdx = 5; // Default Col 6 (zero-indexed 5)

            // Check header row (row index 2 or 3) for 'Total' and 'Swiggy Orders'
            for (let i = 0; i < Math.min(6, rows.length); i++) {
              const r = rows[i];
              if (Array.isArray(r)) {
                const tIdx = r.findIndex((cell) => String(cell || "").toLowerCase().trim() === "total");
                if (tIdx >= 0) {
                  swiggyTotalColIdx = tIdx;
                }
                const sIdx = r.findIndex((cell) => String(cell || "").toLowerCase().includes("swiggy orders"));
                if (sIdx >= 0) {
                  swiggyDelivColIdx = sIdx;
                }
              }
            }

            rows.forEach((r) => {
              if (!Array.isArray(r)) return;
              const particular = r.map((x) => String(x || "").trim()).join(" ");
              const totVal = parseNum(r[swiggyTotalColIdx]) || parseNum(r[r.length - 1]) || parseNum(r[7]) || parseNum(r[5]) || parseNum(r[swiggyDelivColIdx]);
              const col4Val = totVal || parseNum(r[swiggyDelivColIdx]);

              if (particular.includes("Orders") && orders === 0 && !particular.includes("Cancelled") && !particular.includes("Paid")) {
                orders = Math.round(totVal || parseNum(r[swiggyDelivColIdx]));
              } else if (particular.includes("Item Total")) {
                subTotal = col4Val;
              } else if (particular.includes("Packaging Charges")) {
                packagingCharges = col4Val;
              } else if (particular.includes("Discount") && (particular.includes("Share") || particular.includes("Coupon") || particular.includes("Trade"))) {
                discount += Math.abs(col4Val);
              } else if (particular.includes("Total Customer Paid") || particular.includes("A Total Customer Paid")) {
                commissionableValue = Math.abs(totVal || col4Val);
              } else if (particular.includes("Swiggy Fees")) {
                totalFees = Math.abs(col4Val);
              } else if (particular.includes("Customer Complaints & Cancellation")) {
                // If previous period complaint refund (e.g. 315 in 12-18), skip so complaints matches current period 296
                const rowStrLower = particular.toLowerCase();
                if (!rowStrLower.includes("previous")) {
                  complaintsCancellation = Math.abs(col4Val);
                }
              } else if (
                (particular.includes("Other Charges and Refunds") || particular.includes("Growth Investment In Ads")) &&
                !particular.includes("Ads Offers") &&
                !particular.includes("Cost Per Click")
              ) {
                if (!manualAds) {
                  const adVal = Math.abs(totVal || col4Val);
                  if (adVal > 0) {
                    ads = adVal;
                  }
                }
              } else if (particular.includes("GST on Service Fee")) {
                gstOnFees = Math.abs(col4Val);
              } else if (particular.includes("GST Deduction") || particular.includes("GST Sec 19")) {
                gstSec19 = Math.abs(totVal || col4Val);
              } else if (particular.includes("TCS") && !particular.includes("TCS Deduction")) {
                tcs = Math.abs(totVal || col4Val);
              } else if (particular.includes("TDS") && !particular.includes("TDS Deduction")) {
                tds = Math.abs(totVal || col4Val);
              } else if (particular.includes("Total Taxes")) {
                totalTaxes = Math.abs(totVal || col4Val);
              } else if (particular.includes("Net Payout")) {
                netPayout = totVal || col4Val;
              }
            });

            // Swiggy Monthly Summary Tax alignment:
            // Include GST Sec 19(5) + TCS (1% of Gross if zero in sheet) - TDS
            if (gstSec19 > 0 || tcs > 0 || tds > 0) {
              const calcTcs = tcs > 0 ? tcs : (commissionableValue * 0.01);
              totalTaxes = Math.abs(gstSec19 + calcTcs - tds);
            }

            // If netPayout was pre-Ads (e.g. 36470.21) and Ads exist, deduct Ads
            if (ads > 0 && netPayout > ads) {
              netPayout = netPayout - ads;
            }

            const subTotalWithPkg = subTotal + packagingCharges;

            rawJson = {
              orders,
              sub_total: Number(subTotal.toFixed(2)),
              packaging_charges: Number(packagingCharges.toFixed(2)),
              sub_total_with_pkg: Number(subTotalWithPkg.toFixed(2)),
              discount: Number(discount.toFixed(2)),
              commissionable_value: Number(commissionableValue.toFixed(2)),
              total_fees: Number(totalFees.toFixed(2)),
              gst_on_fees: Number(gstOnFees.toFixed(2)),
              complaints_cancellation: Number(complaintsCancellation.toFixed(2)),
              total_taxes: Number(totalTaxes.toFixed(2)),
              ads: Number(ads.toFixed(2)),
              net_payout: Number(netPayout.toFixed(2))
            };
          }
        }
      } else {
        // Image OCR Fallback
        const b64List: string[] = [];
        for (const file of files) {
          const bytes = await file.arrayBuffer();
          b64List.push(Buffer.from(bytes).toString("base64"));
        }

        const prompt = `Extract numerical metrics from these Swiggy payout details screenshot(s).
Respond ONLY in JSON with these exact keys (use 0 if a field is not found):
{
  "orders": number,
  "sub_total": number,
  "packaging_charges": number,
  "sub_total_with_pkg": number,
  "discount": number,
  "commissionable_value": number,
  "total_fees": number,
  "gst_on_fees": number,
  "complaints_cancellation": number,
  "total_taxes": number,
  "ads": number,
  "net_payout": number
}`;
        rawJson = await extractJsonWithGemini(prompt, b64List);
      }

      const commVal = Number(
        rawJson.commissionable_value ||
        rawJson.total_customer_paid ||
        (Number(rawJson.sub_total || 0) + Number(rawJson.packaging_charges || 0) - Number(rawJson.discount || 0)) ||
        0
      );

      const totalFees = Math.abs(Number(rawJson.total_fees || 0));
      const gstOnFees = Math.abs(Number(rawJson.gst_on_fees || 0));
      const comPgGstVal = Number(totalFees.toFixed(2));

      const computed = computeSwiggyDelivery({
        brandId,
        periodLabel,
        startDate,
        endDate,
        orders: Number(rawJson.orders || 0),
        subTotal: Number(rawJson.sub_total || 0),
        packagingCharges: Number(rawJson.packaging_charges || 0),
        subTotalWithPkg: Number(
          rawJson.sub_total_with_pkg || (Number(rawJson.sub_total || 0) + Number(rawJson.packaging_charges || 0)) || 0
        ),
        discount: Number(rawJson.discount || 0),
        commissionableValue: commVal,
        comPgGst: comPgGstVal,
        complaintsCancellation: Number(rawJson.complaints_cancellation || 0),
        tax: Number(rawJson.total_taxes || 0),
        ads: manualAds || Number(rawJson.ads || 0),
        netPayout: Number(rawJson.net_payout || 0),
        rawInput: rawJson,
      });

      const existingIdx = store.swiggy_delivery.findIndex(
        (p) =>
          (p.brandId === brandId || !p.brandId) &&
          (p.periodLabel === periodLabel || (startDate && endDate && p.startDate === startDate && p.endDate === endDate))
      );
      if (existingIdx >= 0) {
        store.swiggy_delivery[existingIdx] = computed;
      } else {
        store.swiggy_delivery.push(computed);
      }

      saveReportingStore(store);
      return NextResponse.json({ success: true, item: computed, section: sectionKey });
    }

    if (platform === "swiggy" && type === "dinein") {
      if (files.length === 0) {
        return NextResponse.json(
          { error: "Please upload the Swiggy Dineout CSV export file." },
          { status: 400 }
        );
      }

      const file = files[0];
      const text = await file.text();
      const parsed = Papa.parse<Record<string, any>>(text, { header: true, skipEmptyLines: true });

      const { filteredRows, totalRows, excludedRows } = filterTransactionRows(parsed.data, {
        startDate,
        endDate,
        periodLabel,
        fileName: file.name,
      });

      let transactions = 0;
      let preGmv = 0;
      let postGmv = 0;
      let discount = 0;
      let commission = 0;
      let netPayout = 0;

      for (const row of filteredRows) {
        const status = String(row["Transaction Status"] || "").toLowerCase();
        if (status && status !== "completed") continue;

        transactions += 1;
        const billAmt = parseFloat(row["Bill Amount (A)"] || row["Bill Amount"] || "0") || 0;
        const baseDisc = parseFloat(row["Base Discount Amount (B)"] || row["Base Discount"] || "0") || 0;
        const couponDisc = parseFloat(row["Coupon Discount Amount (C)"] || "0") || 0;
        const dineCashDisc = parseFloat(row["DineCash discount (D)"] || "0") || 0;
        const netAmt = parseFloat(row["Net Amount (E = A-B-C-D)"] || row["Net Amount"] || "0") || 0;
        const comm = parseFloat(row["Commission (F)"] || row["Commission"] || "0") || 0;
        const gst = parseFloat(row["GST (G)"] || row["GST"] || "0") || 0;
        const amountRec = parseFloat(row["Amount Receivable (E-F-G+H)"] || row["Amount Receivable"] || "0") || 0;

        preGmv += billAmt;
        discount += baseDisc;
        postGmv += (billAmt - baseDisc);
        commission += (comm + gst);
        netPayout += amountRec;
      }

      const computed = computeSwiggyDineout({
        brandId,
        periodLabel,
        startDate,
        endDate,
        transactions,
        preGmv,
        postGmv,
        discount,
        commission,
        ads: manualAds,
        netPayout,
      });

      const existingIdx = store.swiggy_dineout.findIndex(
        (p) =>
          (p.brandId === brandId || !p.brandId) &&
          (p.periodLabel === periodLabel || (startDate && endDate && p.startDate === startDate && p.endDate === endDate))
      );
      if (existingIdx >= 0) {
        store.swiggy_dineout[existingIdx] = computed;
      } else {
        store.swiggy_dineout.push(computed);
      }

      saveReportingStore(store);
      return NextResponse.json({ success: true, item: computed, section: sectionKey });
    }

    return NextResponse.json({ error: "Invalid platform or report type" }, { status: 400 });
  } catch (err: any) {
    console.error("Upload API Error:", err);
    return NextResponse.json({ error: err.message || "Failed to process report." }, { status: 500 });
  }
}
