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

async function singlePass(prompt: string, parts: any[], geminiKey: string, model: string): Promise<Record<string, any> | null> {
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
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

// Math validation: Zomato — A + B - C - D - E - F - G = Est. Payout
function validateZomatoMath(ocr: Record<string, any>): boolean {
  const A = Math.abs(Number(ocr.commissionable_value || 0));
  const B = Math.abs(Number(ocr.cancelled_order_refund || 0));
  const C = Math.abs(Number(ocr.order_level_deduction || 0));
  const D = Math.abs(Number(ocr.tax_deduction || 0));
  const E = Math.abs(Number(ocr.ads || 0));
  const F = Math.abs(Number(ocr.hyperpure || 0));
  const G = Math.abs(Number(ocr.miscellaneous_deductions || 0));
  let netPayout = Number(ocr.net_payout || 0);
  if (A === 0 && netPayout === 0) return true; // nothing extracted, skip
  const calculated = A + B - C - D - E - F - G;
  const tolerance = 2.5; // Strict zero-tolerance (<= ₹2.5 for decimal rounding only)
  
  if (Math.abs(calculated - netPayout) <= tolerance) {
    return true;
  }
  // Auto-correct if AI dropped the minus sign from red negative payout text
  if (Math.abs(calculated + netPayout) <= tolerance) {
    ocr.net_payout = calculated;
    return true;
  }
  return false;
}

// Math validation: Swiggy — A - B - C - D - E = Net Payout
function validateSwiggyMath(ocr: Record<string, any>): boolean {
  const A = Math.abs(Number(ocr.commissionable_value || 0));
  const B = Math.abs(Number(ocr.total_fees || 0));
  const C = Math.abs(Number(ocr.complaints_cancellation || 0));
  const D = Math.abs(Number(ocr.total_taxes || 0));
  const E = Math.abs(Number(ocr.ads || 0));
  let netPayout = Number(ocr.net_payout || 0);
  if (A === 0 && netPayout === 0) return true; // nothing extracted, skip
  const calculated = A - B - C - D - E;
  // Dynamic tolerance for Swiggy: Accounts for unlisted ~1% TCS / GST u/s 52 deduction
  const tolerance = Math.max(75, A * 0.015);

  if (Math.abs(calculated - netPayout) <= tolerance) {
    return true;
  }
  // Auto-correct if AI dropped the minus sign
  if (Math.abs(calculated + netPayout) <= tolerance) {
    ocr.net_payout = calculated;
    return true;
  }
  console.log(`[Swiggy Validation Math Diff] Expected: ${calculated}, Got: ${netPayout}, Allowed: ${tolerance}`);
  return false;
}

async function extractJsonWithGemini(
  prompt: string, 
  imageBase64List: string[], 
  validateFn?: (data: Record<string, any>) => boolean
) {
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
    } else {
      if (cleanB64.startsWith("iVBORw0KGgo")) mimeType = "image/png";
      else if (cleanB64.startsWith("/9j/")) mimeType = "image/jpeg";
      else if (cleanB64.startsWith("UklGR")) mimeType = "image/webp";
    }
    parts.push({
      inlineData: {
        mimeType,
        data: cleanB64,
      },
    });
  }

  // Pass 1: Primary High-Precision Gemini 2.5 Flash
  const pass1 = await singlePass(prompt, parts, geminiKey, "gemini-2.5-flash");
  if (pass1) {
    console.log("[OCR Pass 1 Output]:", JSON.stringify(pass1));
    if (!validateFn || validateFn(pass1)) {
      return pass1; // ✅ Math verified on Pass 1
    }
    console.warn("[OCR Math Verification] Pass 1 math validation failed. Triggering automatic high-grade retry...");
  }

  // Pass 2: High-Grade Retry Pass with Gemini 2.5 Flash
  const pass2 = await singlePass(prompt, parts, geminiKey, "gemini-2.5-flash");
  if (pass2) {
    console.log("[OCR Pass 2 Output]:", JSON.stringify(pass2));
    if (!validateFn || validateFn(pass2)) {
      return pass2; // ✅ Math verified on retry
    }
  }

  throw new Error("Screenshot calculations could not be verified accurately. Please try uploading a clearer, uncropped screenshot.");
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

      const rawJson = await extractJsonWithGemini(ZOMATO_DELIVERY_GEMINI_PROMPT, b64List, validateZomatoMath);

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

      const rawJson = await extractJsonWithGemini(SWIGGY_DELIVERY_GEMINI_PROMPT, b64List, validateSwiggyMath);

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
