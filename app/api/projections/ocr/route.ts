import { NextRequest, NextResponse } from "next/server";

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY;
}

async function singleOcrPass(prompt: string, parts: any[], apiKey: string, model: string): Promise<Record<string, any> | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) return null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

function ocrValuesMatch(a: Record<string, any>, b: Record<string, any>): boolean {
  for (const key of Object.keys(a)) {
    const va = Number(a[key] ?? 0);
    const vb = Number(b[key] ?? 0);
    if (Math.abs(va - vb) > 1) return false;
  }
  return true;
}

function ocrTiebreaker(a: Record<string, any>, b: Record<string, any>, c: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(a)) {
    const va = Number(a[key] ?? 0);
    const vb = Number(b[key] ?? 0);
    const vc = Number(c[key] ?? 0);
    if (Math.abs(va - vb) <= 1) result[key] = a[key];
    else if (Math.abs(va - vc) <= 1) result[key] = a[key];
    else if (Math.abs(vb - vc) <= 1) result[key] = b[key];
    else {
      // All 3 differ — screenshot could not be read accurately, reject entirely
      throw new Error("Screenshot could not be read accurately. Please try uploading again.");
    }
  }
  return result;
}

// Math validation: Zomato — A + B - C - D - E - F = Est. Payout
function validateZomatoMath(ocr: Record<string, any>): boolean {
  const A = Math.abs(Number(ocr.commissionable_value || 0));
  const B = Math.abs(Number(ocr.cancelled_order_refund || 0));
  const C = Math.abs(Number(ocr.order_level_deduction || 0));
  const D = Math.abs(Number(ocr.tax_deduction || ocr.gst_on_service_fees || 0));
  const E = Math.abs(Number(ocr.ads || 0));
  const F = Math.abs(Number(ocr.hyperpure || 0));
  let netPayout = Number(ocr.net_payout || 0);
  if (A === 0 && netPayout === 0) return true;
  const calculated = A + B - C - D - E - F;
  const tolerance = 2.5; // Strict <= ₹2.5
  
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
  if (A === 0 && netPayout === 0) return true;
  const calculated = A - B - C - D - E;
  const tolerance = 2.5; // Strict <= ₹2.5

  if (Math.abs(calculated - netPayout) <= tolerance) {
    return true;
  }
  // Auto-correct if AI dropped the minus sign
  if (Math.abs(calculated + netPayout) <= tolerance) {
    ocr.net_payout = calculated;
    return true;
  }
  return false;
}

async function extractJsonWithGemini(
  prompt: string, 
  imageBase64List: string[], 
  validateFn?: (data: Record<string, any>) => boolean
) {
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
    parts.push({ inlineData: { mimeType, data: cleanB64 } });
  }

  // Pass 1 — Primary High-Precision Gemini 2.5 Flash
  const pass1 = await singleOcrPass(prompt, parts, apiKey, "gemini-2.5-flash");
  if (pass1) {
    if (!validateFn || validateFn(pass1)) {
      return pass1; // ✅ Math verified on Pass 1
    }
    console.warn("[Projections OCR Math] Pass 1 math validation failed. Retrying...");
  }

  // Pass 2 — Automatic Retry Pass with Gemini 2.5 Flash
  const pass2 = await singleOcrPass(prompt, parts, apiKey, "gemini-2.5-flash");
  if (pass2) {
    if (!validateFn || validateFn(pass2)) {
      return pass2; // ✅ Math verified on retry
    }
  }

  throw new Error("Screenshot calculations could not be verified accurately. Please try uploading a clearer screenshot.");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const platform = (formData.get("platform") as string) || "zomato";
    const monthName = (formData.get("monthName") as string) || "Historical Month";
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Please upload at least 1 payout screenshot." }, { status: 400 });
    }

    if (platform === "zomato") {
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
  "promo_discount": number,
  "other_discount": number,
  "discount": number,
  "delivery_charge_discount": number,
  "commissionable_value": number,
  "order_level_deduction": number,
  "tax_deduction": number,
  "ads": number,
  "hyperpure": number,
  "net_payout": number
}
Rules:
- Read numbers strictly as shown on the screen. Do NOT apply any percentage calculations yourself.
- Extract monetary amounts as positive numbers, EXCEPT "net_payout" which must include a minus sign if negative.
- "total_orders": total orders count delivered in the period.
- "sub_total": Sum of base item prices.
- "packaging_charges": Total container/packaging fee collected.
- "sub_total_with_pkg": Subtotal + Packaging charges.
- "cancelled_order_refund": Read strictly from "Cancelled order refunds" under Additions (B) (e.g. 3113.73), else 0.
- "promo_discount": Read strictly from "Restaurant discount (Promos)" line (e.g. 23712.06), else 0.
- "other_discount": Read strictly from "Restaurant discount (Flat offs, Freebies, Gold, relisted orders and others)" line (e.g. 12480.00), else 0.
- "discount": Sum of promo discounts and flat offs/other discounts borne by merchant.
- "delivery_charge_discount": Read strictly from "Delivery charge discount" line if present (e.g. 200.25), else 0.
- "commissionable_value": Read strictly from "Net order value (A)" on Zomato screenshot (e.g. 63905.53), else sub_total + packaging_charges - discount.
- "order_level_deduction": Read strictly from "Order level deductions (C)" header on Zomato screenshot (e.g. 79412.33), else sum of base service fee, payment mechanism fee, long distance enablement fee.
- "tax_deduction": Read strictly from "Tax deductions (D)" header on Zomato screenshot (e.g. 31040.89), else sum of GST on service fees, TCS (Sec 52), TDS (Sec 194O), and GST u/s 9(5).
- "ads": Read from Growth / Ad spend section (e.g. 90844.54).
- "hyperpure": Read B2B raw material procurement deduction if present (e.g. 53241.55).
- "net_payout": Read strictly from "FINAL PAYOUT" or "Est. payout (A + B + C + D + E + F)". Include negative sign if red/minus (e.g. -15548.59).`;

      const raw = await extractJsonWithGemini(prompt, b64List, validateZomatoMath);

      const orders = Number(raw.total_orders || 0);
      const subTotal = Number(raw.sub_total || 0);
      const packagingCharges = Number(raw.packaging_charges || 0);
      
      const promoDisc = Math.abs(Number(raw.promo_discount || 0));
      const otherDisc = Math.abs(Number(raw.other_discount || 0));
      const baseDiscount = (promoDisc > 0 || otherDisc > 0)
        ? (promoDisc + otherDisc)
        : Math.abs(Number(raw.discount || 0));
      const deliveryChargeDiscount = Number(raw.delivery_charge_discount || 0);
      const discount = baseDiscount + deliveryChargeDiscount;
      const hyperpure = Math.abs(Number(raw.hyperpure || 0));

      const commissionableValue = Number(
        raw.commissionable_value ||
        raw.net_order_value ||
        (subTotal + packagingCharges - discount) ||
        0
      );
      const ads = Number(raw.ads || 0);
      const orderLevelDeduction = Number(raw.order_level_deduction || raw.commission_and_fees || 0);
      const taxDeduction = Number(raw.tax_deduction || raw.gst_on_service_fees || 0);
      const commissionPgGst = Math.round(orderLevelDeduction + taxDeduction);
      const rawNetPayout = Number(raw.net_payout || (commissionableValue - ads - commissionPgGst));
      const netPayout = rawNetPayout + hyperpure;

      const effectiveDiscountPct = subTotal > 0 ? Number((discount / subTotal).toFixed(4)) : 0.05;
      const advertisementPct = commissionableValue > 0 ? Number((ads / commissionableValue).toFixed(4)) : 0.15;
      const commissionPct = commissionableValue > 0 ? Number((commissionPgGst / commissionableValue).toFixed(4)) : 0.28;
      const aov = orders > 0 ? Math.round(subTotal / orders) : 300;

      return NextResponse.json({
        success: true,
        monthName,
        platform: "zomato",
        data: {
          name: monthName,
          orders,
          subTotal,
          aov,
          packagingCharges,
          merchantDiscountBurn: discount,
          effectiveDiscountPct,
          commissionableValue,
          advertisement: ads,
          advertisementPct,
          commissionPgGst,
          commissionPct,
          netPayout,
        },
      });
    }

    if (platform === "swiggy") {
      // Swiggy weekly aggregation across all uploaded screenshots
      let agg = {
        orders: 0,
        subTotal: 0,
        packagingCharges: 0,
        discount: 0,
        commissionableValue: 0,
        ads: 0,
        commissionPgGst: 0,
        netPayout: 0,
      };

      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const b64 = Buffer.from(bytes).toString("base64");

        const prompt = `Extract numerical metrics from this Swiggy weekly payout screenshot.
Respond ONLY in JSON with these exact keys (use 0 if a field is not found):
{
  "orders": number,
  "sub_total": number,
  "packaging_charges": number,
  "trade_discount": number,
  "coupon_discount": number,
  "discount": number,
  "commissionable_value": number,
  "total_fees": number,
  "complaints_cancellation": number,
  "total_taxes": number,
  "ads": number,
  "net_payout": number
}
Rules:
- "trade_discount": read strictly from "Restaurant Discounts (Trade Discounts, Freebies and others)" line.
- "coupon_discount": read strictly from "Restaurant Discounts (Coupon based)" line.
- "discount": total restaurant discounts.
- "commissionable_value": read strictly from "(A) Total Customer Paid" on Swiggy screenshot (e.g. 37779.28), else item subtotal + packaging charges - discount.
- "total_fees": read strictly from "(B) Total Fees" on Swiggy screenshot (e.g. 8431.35).`;

        const raw = await extractJsonWithGemini(prompt, [b64], validateSwiggyMath);

        const tradeDisc = Math.abs(Number(raw.trade_discount || 0));
        const couponDisc = Math.abs(Number(raw.coupon_discount || 0));
        const disc = (tradeDisc > 0 || couponDisc > 0)
          ? (tradeDisc + couponDisc)
          : Math.abs(Number(raw.discount || 0));

        const commVal = Number(
          raw.commissionable_value ||
          raw.total_customer_paid ||
          (Number(raw.sub_total || 0) + Number(raw.packaging_charges || 0) - disc) ||
          0
        );

        agg.orders += Number(raw.orders || 0);
        agg.subTotal += Number(raw.sub_total || 0);
        agg.packagingCharges += Number(raw.packaging_charges || 0);
        agg.discount += disc;
        agg.commissionPgGst += Number(raw.total_fees || 0);
        agg.ads += Number(raw.ads || 0);
        agg.netPayout += Number(raw.net_payout || 0);
      }

      if (!agg.commissionableValue) {
        agg.commissionableValue = agg.subTotal + agg.packagingCharges - agg.discount;
      }
      if (!agg.netPayout) {
        agg.netPayout = agg.commissionableValue - agg.ads - agg.commissionPgGst;
      }

      const effectiveDiscountPct = agg.subTotal > 0 ? Number((agg.discount / agg.subTotal).toFixed(4)) : 0.05;
      const advertisementPct = agg.commissionableValue > 0 ? Number((agg.ads / agg.commissionableValue).toFixed(4)) : 0.15;
      const commissionPct = agg.commissionableValue > 0 ? Number((agg.commissionPgGst / agg.commissionableValue).toFixed(4)) : 0.28;
      const aov = agg.orders > 0 ? Math.round(agg.subTotal / agg.orders) : 300;

      return NextResponse.json({
        success: true,
        monthName,
        platform: "swiggy",
        weeklyFilesCount: files.length,
        data: {
          name: monthName,
          orders: agg.orders,
          subTotal: agg.subTotal,
          aov,
          packagingCharges: agg.packagingCharges,
          merchantDiscountBurn: agg.discount,
          effectiveDiscountPct,
          commissionableValue: agg.commissionableValue,
          advertisement: agg.ads,
          advertisementPct,
          commissionPgGst: agg.commissionPgGst,
          commissionPct,
          netPayout: agg.netPayout,
        },
      });
    }

    if (platform === "combined_3month") {
      const b64List: string[] = [];
      for (const file of files) {
        const bytes = await file.arrayBuffer();
        b64List.push(Buffer.from(bytes).toString("base64"));
      }

      const prompt = `Extract numerical metrics for 3 consecutive historical months from this 3-month summary report / Excel screenshot.
Respond ONLY with a JSON object containing a "months" array of up to 3 objects in chronological order:
{
  "months": [
    {
      "month_name": "April",
      "total_orders": number,
      "sub_total": number,
      "aov": number,
      "packaging_charges": number,
      "discount": number,
      "commissionable_value": number,
      "ads": number,
      "commission_and_fees": number,
      "net_payout": number
    }
  ]
}
Rules:
- Read numbers strictly as shown on screen/table for each month column.
- "discount": Merchant Discount Burn / promo discount.
- "commissionable_value": Sales - Discount or Sub Total + Packaging - Discount.
- "commission_and_fees": Platform Comm. + PG + GST.
- "net_payout": Net Merchant Payout.`;

      const raw = await extractJsonWithGemini(prompt, b64List);
      const monthsList = raw.months || [];

      const parsedMonths = monthsList.map((m: any) => {
        const orders = Number(m.total_orders || m.orders || 0);
        const subTotal = Number(m.sub_total || 0);
        const packagingCharges = Number(m.packaging_charges || 0);
        const discount = Number(m.discount || 0);
        const commissionableValue = Number(m.commissionable_value || (subTotal + packagingCharges - discount) || 0);
        const ads = Number(m.ads || 0);
        const commissionPgGst = Number(m.commission_and_fees || 0);
        const netPayout = Number(m.net_payout || (commissionableValue - ads - commissionPgGst));

        const effectiveDiscountPct = subTotal > 0 ? Number((discount / subTotal).toFixed(4)) : 0.05;
        const advertisementPct = commissionableValue > 0 ? Number((ads / commissionableValue).toFixed(4)) : 0.15;
        const commissionPct = commissionableValue > 0 ? Number((commissionPgGst / commissionableValue).toFixed(4)) : 0.28;
        const aov = Number(m.aov) || (orders > 0 ? Math.round(subTotal / orders) : 300);

        return {
          name: m.month_name || "",
          orders,
          subTotal,
          aov,
          packagingCharges,
          merchantDiscountBurn: discount,
          effectiveDiscountPct,
          commissionableValue,
          advertisement: ads,
          advertisementPct,
          commissionPgGst,
          commissionPct,
          netPayout,
        };
      });

      return NextResponse.json({
        success: true,
        platform: "combined_3month",
        months: parsedMonths
      });
    }

    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  } catch (err: any) {
    console.error("[Projections OCR Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to process payout screenshot." }, { status: 500 });
  }
}
