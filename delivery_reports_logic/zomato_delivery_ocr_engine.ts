import { ZomatoDeliveryRawOCR, ZomatoDeliveryMetrics } from "./delivery_reporting_types";

/**
 * ZOMATO DELIVERY PAYOUT IMAGE EXTRACTION & TELEMETRY ENGINE
 * 
 * Flow:
 * 1. Takes 1 or 2 Zomato Partner App scrolled Payout screenshots (Base64).
 * 2. Sends images to Gemini Vision model with an exact extraction prompt.
 * 3. Applies deterministic financial formulas to compute burn rate, net payout %, discount %, and ads %.
 */

export const ZOMATO_DELIVERY_GEMINI_PROMPT = `
Extract raw numerical values from these Zomato Payout details screenshot(s).
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

Extraction Rules:
- Read numbers strictly as shown on the screen. Do NOT apply any percentage calculations yourself.
- Extract all monetary amounts as positive numbers (without minus signs).
- "total_orders": total orders count delivered in the period.
- "sub_total": Sum of base item prices.
- "packaging_charges": Total container/packaging fee collected.
- "sub_total_with_pkg": Subtotal + Packaging charges.
- "cancelled_order_refund": Amount credited/refunded for cancelled orders.
- "discount": Sum of promo discounts, flat offs, Zomato Gold discounts, relisted discounts borne by merchant.
- "commissionable_value": Read strictly from "Net order value (A)" on Zomato screenshot (e.g. 63905.53), else sub_total + packaging_charges - discount.
- "order_level_deduction": Read strictly from "Order level deductions (C)" header on Zomato screenshot (e.g. 16580.86), else sum of base service fee, payment mechanism fee, long distance enablement fee.
- "tax_deduction": Read strictly from "Tax deductions (D)" header on Zomato screenshot (e.g. 10280.45), else sum of GST on service fees, TCS (Sec 52), TDS (Sec 194O), and GST u/s 9(5).
- "ads": Read from Growth / Ad spend section (e.g. 5900).
- "hyperpure": Read B2B raw material procurement deduction if present (e.g. 12000).
- "net_payout": Read strictly from "FINAL PAYOUT" or "Net Receivable" credited to bank account.
`.trim();

/**
 * Calculates deterministic Zomato Delivery telemetry metrics from raw extracted OCR JSON
 */
export function computeZomatoDeliveryMetrics(
  rawInput: ZomatoDeliveryRawOCR,
  options: {
    periodLabel: string;
    brandId?: string;
    startDate?: string;
    endDate?: string;
    manualAdsOverride?: number;
  }
): ZomatoDeliveryMetrics {
  const orders = Math.abs(Number(rawInput.total_orders || 0));
  const subTotal = Math.abs(Number(rawInput.sub_total || 0));
  const packagingCharges = Math.abs(Number(rawInput.packaging_charges || 0));
  
  const subTotalWithPkg =
    rawInput.sub_total_with_pkg && rawInput.sub_total_with_pkg > 0
      ? Math.abs(Number(rawInput.sub_total_with_pkg))
      : subTotal + packagingCharges;

  const cancelledOrderRefund = Math.abs(Number(rawInput.cancelled_order_refund || 0));
  const discount = Math.abs(Number(rawInput.discount || 0));
  
  const discountPct =
    subTotalWithPkg > 0 ? Number(((discount / subTotalWithPkg) * 100).toFixed(2)) : 0;

  const commissionableValue = Math.abs(
    Number(rawInput.commissionable_value || (subTotal + packagingCharges - discount))
  );
  
  const orderLevelDeduction = Math.abs(Number(rawInput.order_level_deduction || 0));
  const taxDeduction = Math.abs(Number(rawInput.tax_deduction || 0));
  
  const ads = options.manualAdsOverride !== undefined && options.manualAdsOverride > 0
    ? options.manualAdsOverride
    : Math.abs(Number(rawInput.ads || 0));

  const adsPct =
    subTotalWithPkg > 0 ? Number(((ads / subTotalWithPkg) * 100).toFixed(2)) : 0;

  const hyperpure = Math.abs(Number(rawInput.hyperpure || 0));
  const netPayout = Number(rawInput.net_payout || 0);
  const netPayoutWithHyperpure = netPayout + hyperpure;
  
  const netPayoutPct =
    subTotalWithPkg > 0
      ? Number(((netPayout / subTotalWithPkg) * 100).toFixed(2))
      : 0;
      
  const overallBurnPct = Number((100 - netPayoutPct).toFixed(2));

  return {
    id: `zd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    brandId: options.brandId,
    section: "zomato_delivery",
    platform: "zomato",
    type: "delivery",
    periodLabel: options.periodLabel,
    startDate: options.startDate,
    endDate: options.endDate,
    updatedAt: new Date().toISOString(),
    orders,
    subTotal,
    packagingCharges,
    subTotalWithPkg,
    cancelledOrderRefund,
    discount,
    discountPct,
    commissionableValue,
    orderLevelDeduction,
    taxDeduction,
    ads,
    adsPct,
    hyperpure,
    netPayout,
    netPayoutWithHyperpure,
    netPayoutPct,
    overallBurnPct,
    rawInput,
  };
}

/**
 * Execute Gemini Vision OCR API request for Zomato Delivery Screenshots
 */
export async function processZomatoDeliveryImagesWithGemini(
  geminiApiKey: string,
  imageBase64List: string[]
): Promise<ZomatoDeliveryRawOCR> {
  if (!geminiApiKey) {
    throw new Error("Missing Gemini API Key");
  }

  const parts: any[] = [{ text: ZOMATO_DELIVERY_GEMINI_PROMPT }];

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
      inlineData: { mimeType, data: cleanB64 }
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
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
  if (!jsonMatch) throw new Error("No valid JSON found in Gemini OCR output");

  return JSON.parse(jsonMatch[0]) as ZomatoDeliveryRawOCR;
}
