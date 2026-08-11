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
          { error: "Please upload at least 1 or 2 Zomato Delivery screenshots." },
          { status: 400 }
        );
      }

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
}
Rules:
- Read numbers strictly as shown. Do NOT apply any percentage calculations.
- "commissionable_value": read strictly from "Net order value (A)" on Zomato screenshot (e.g. 63905.53), else sub_total + packaging_charges - discount.
- "discount": sum of promo discounts, flat offs, Gold, relisted discounts.
- "order_level_deduction": read strictly from "Order level deductions (C)" header on Zomato screenshot (e.g. 16580.86), else sum of base service fee, payment mechanism fee, long distance enablement fee.
- "tax_deduction": read strictly from "Tax deductions (D)" header on Zomato screenshot (e.g. 10280.45), else sum of GST on service fees, TCS, TDS 194O, and GST u/s 9(5).`;

      const rawJson = await extractJsonWithGemini(prompt, b64List);

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
          { error: "Please upload at least 1 Swiggy Delivery screenshot." },
          { status: 400 }
        );
      }

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
}
Rules:
- Read numbers strictly as shown on the screen.
- "orders": total orders count (e.g. 26).
- "sub_total": Item Total (e.g. 21539).
- "packaging_charges": Packaging Charges (e.g. 630).
- "discount": Restaurant Discounts (e.g. 1639.88).
- "commissionable_value": read strictly from "(A) Total Customer Paid" on Swiggy screenshot (e.g. 21555.7), else sub_total + packaging_charges - discount.
- "total_fees": read strictly from "(B) Total Fees" on Swiggy screenshot (e.g. 5383.41).
- "gst_on_fees": read strictly from "GST @ 18%" under Total Taxes on Swiggy screenshot (e.g. 969.02), else 0.
- "ads": read strictly from "(E) Growth Investments in Ads" on Swiggy screenshot (e.g. 2525.2), else 0.
- "net_payout": read strictly from "FINAL PAYOUT" at top of screen (e.g. 11631).`;

      const rawJson = await extractJsonWithGemini(prompt, b64List);

      const commVal = Number(
        rawJson.commissionable_value ||
        rawJson.total_customer_paid ||
        (Number(rawJson.sub_total || 0) + Number(rawJson.packaging_charges || 0) - Number(rawJson.discount || 0)) ||
        0
      );

      const totalFees = Math.abs(Number(rawJson.total_fees || 0));
      const gstOnFees = Math.abs(Number(rawJson.gst_on_fees || 0));
      const comPgGstVal = Number((totalFees + gstOnFees).toFixed(2));

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
