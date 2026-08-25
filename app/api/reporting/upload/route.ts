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
import {
  ZOMATO_DELIVERY_GEMINI_PROMPT,
  computeZomatoDeliveryMetrics,
} from "@/delivery_reports_logic/zomato_delivery_ocr_engine";
import {
  SWIGGY_DELIVERY_GEMINI_PROMPT,
  computeSwiggyDeliveryMetrics,
} from "@/delivery_reports_logic/swiggy_delivery_ocr_engine";

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY;
}

const GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
];

async function singlePass(prompt: string, parts: any[], geminiKey: string): Promise<Record<string, any> | null> {
  for (const model of GEMINI_FALLBACK_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0,
              responseMimeType: "application/json",
            },
          }),
        }
      );
      if (!response.ok) continue;
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      return JSON.parse(jsonMatch[0]);
    } catch {
      continue;
    }
  }
  return null;
}

function jsonValuesMatch(a: Record<string, any>, b: Record<string, any>): boolean {
  for (const key of Object.keys(a)) {
    const va = Number(a[key] ?? 0);
    const vb = Number(b[key] ?? 0);
    // Allow < 1 rupee difference (decimal formatting tolerance)
    if (Math.abs(va - vb) > 1) return false;
  }
  return true;
}

function pickTiebreaker(a: Record<string, any>, b: Record<string, any>, c: Record<string, any>): Record<string, any> {
  // For each key, pick the value that appears in at least 2 of 3 passes
  const result: Record<string, any> = {};
  for (const key of Object.keys(a)) {
    const va = Number(a[key] ?? 0);
    const vb = Number(b[key] ?? 0);
    const vc = Number(c[key] ?? 0);
    if (Math.abs(va - vb) <= 1) result[key] = a[key]; // Pass 1 & 2 agree
    else if (Math.abs(va - vc) <= 1) result[key] = a[key]; // Pass 1 & 3 agree
    else if (Math.abs(vb - vc) <= 1) result[key] = b[key]; // Pass 2 & 3 agree
    else {
      // All 3 differ — screenshot could not be read accurately, reject entirely
      throw new Error("Screenshot could not be read accurately. Please try uploading again.");
    }
  }
  return result;
}

async function extractJsonWithGemini(prompt: string, imageBase64List: string[]) {
  const geminiKey = getGeminiApiKey();
  if (!geminiKey) {
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

  // Pass 1
  const pass1 = await singlePass(prompt, parts, geminiKey);
  if (!pass1) throw new Error("All Gemini models failed on Pass 1.");

  // Pass 2
  const pass2 = await singlePass(prompt, parts, geminiKey);
  if (!pass2) throw new Error("All Gemini models failed on Pass 2.");

  // Compare Pass 1 & 2
  if (jsonValuesMatch(pass1, pass2)) {
    return pass1; // ✅ Both match — done
  }

  // Mismatch → Pass 3 (Tiebreaker)
  const pass3 = await singlePass(prompt, parts, geminiKey);
  if (!pass3) return pass1; // Fallback to Pass 1 if Pass 3 fails

  return pickTiebreaker(pass1, pass2, pass3); // ✅ Majority wins
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
          { error: "Please upload at least 1 Zomato Partner App payout screenshot." },
          { status: 400 }
        );
      }

      const b64List: string[] = [];
      for (const file of files) {
        const bytes = await file.arrayBuffer();
        b64List.push(Buffer.from(bytes).toString("base64"));
      }

      const rawJson = await extractJsonWithGemini(ZOMATO_DELIVERY_GEMINI_PROMPT, b64List);

      const computed = computeZomatoDeliveryMetrics(rawJson as any, {
        periodLabel,
        brandId,
        startDate,
        endDate,
        manualAdsOverride: manualAds > 0 ? manualAds : undefined,
      });

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
          { error: "Please upload at least 1 Swiggy Partner App payout screenshot." },
          { status: 400 }
        );
      }

      const b64List: string[] = [];
      for (const file of files) {
        const bytes = await file.arrayBuffer();
        b64List.push(Buffer.from(bytes).toString("base64"));
      }

      const rawJson = await extractJsonWithGemini(SWIGGY_DELIVERY_GEMINI_PROMPT, b64List);

      const computed = computeSwiggyDeliveryMetrics(rawJson as any, {
        periodLabel,
        brandId,
        startDate,
        endDate,
        manualAdsOverride: manualAds > 0 ? manualAds : undefined,
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

      let finalAds = manualAds;
      if (manualAds > 0 && startDate && endDate) {
        const s = new Date(startDate);
        const e = new Date(endDate);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
          const year = s.getFullYear();
          const month = s.getMonth() + 1;
          const totalDaysInMonth = new Date(year, month, 0).getDate();

          const diffMs = e.getTime() - s.getTime();
          const selectedDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

          if (selectedDays > 0 && selectedDays < totalDaysInMonth) {
            finalAds = Number(((manualAds / totalDaysInMonth) * selectedDays).toFixed(2));
          }
        }
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
        ads: finalAds,
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
