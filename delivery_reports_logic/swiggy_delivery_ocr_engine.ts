import { SwiggyDeliveryRawOCR, SwiggyDeliveryMetrics } from "./delivery_reporting_types";

/**
 * SWIGGY DELIVERY PAYOUT IMAGE EXTRACTION & TELEMETRY ENGINE
 * 
 * Flow:
 * 1. Takes 1 or more Swiggy Partner App weekly payout screenshots (Base64).
 * 2. Sends images to Gemini Vision model with an exact extraction prompt.
 * 3. Applies deterministic financial formulas to compute burn rate, net payout %, discount %, and ads %.
 */

export const SWIGGY_DELIVERY_GEMINI_PROMPT = `
Extract numerical metrics from these Swiggy payout details screenshot(s).
Respond ONLY in JSON with these exact keys (use 0 if a field is not found):
{
  "orders": number,
  "sub_total": number,
  "packaging_charges": number,
  "sub_total_with_pkg": number,
  "trade_discount": number,
  "coupon_discount": number,
  "discount": number,
  "commissionable_value": number,
  "total_fees": number,
  "gst_on_fees": number,
  "complaints_cancellation": number,
  "total_taxes": number,
  "ads": number,
  "net_payout": number
}

Extraction Rules:
- Read numbers strictly as shown on the screen. Do NOT apply any percentage calculations yourself.
- Extract all monetary amounts as positive numbers (without minus signs).
- "orders": Total orders count delivered in the period (e.g. 26).
- "sub_total": Item Total (e.g. 16195).
- "packaging_charges": Packaging Charges (e.g. 296).
- "sub_total_with_pkg": Subtotal + Packaging charges (e.g. 16491).
- "trade_discount": Read strictly the amount from the line "Restaurant Discounts (Trade Discounts, Freebies and others)" (e.g. 727.95), else 0.
- "coupon_discount": Read strictly the amount from the line "Restaurant Discounts (Coupon based)" (e.g. 1650.29), else 0.
- "discount": Sum of trade_discount + coupon_discount (e.g. 727.95 + 1650.29 = 2378.24).
- "commissionable_value": Read strictly from "(A) Total Customer Paid" on Swiggy screenshot (e.g. 14818.5), else sub_total + packaging_charges - discount.
- "total_fees": Read strictly from "(B) Total Fees" on Swiggy screenshot (e.g. 2766.04).
- "gst_on_fees": Read strictly from "GST @ 18%" under Total Taxes on Swiggy screenshot (e.g. 497.88), else 0.
- "complaints_cancellation": Read strictly from complaints/cancellation deduction if present (e.g. 405.09).
- "total_taxes": Read strictly from TCS + TDS + GST u/s 9(5) taxes total (e.g. 1197.7).
- "ads": Read strictly from "(E) Growth Investments in Ads" or sum of all ad spend, CPC campaigns, and Ad GST rows under Growth Services (e.g. 132.75).
- "net_payout": Read strictly from "FINAL PAYOUT" / "Net Payout" at top/bottom of screen (e.g. 10316.79).
`.trim();

/**
 * Calculates deterministic Swiggy Delivery telemetry metrics from raw extracted OCR JSON
 */
export function computeSwiggyDeliveryMetrics(
  rawInput: SwiggyDeliveryRawOCR,
  options: {
    periodLabel: string;
    brandId?: string;
    startDate?: string;
    endDate?: string;
    manualAdsOverride?: number;
  }
): SwiggyDeliveryMetrics {
  const orders = Math.abs(Number(rawInput.orders || 0));
  const subTotal = Math.abs(Number(rawInput.sub_total || 0));
  const packagingCharges = Math.abs(Number(rawInput.packaging_charges || 0));

  const subTotalWithPkg =
    rawInput.sub_total_with_pkg && rawInput.sub_total_with_pkg > 0
      ? Math.abs(Number(rawInput.sub_total_with_pkg))
      : subTotal + packagingCharges;

  const tradeDiscount = Math.abs(Number(rawInput.trade_discount || 0));
  const couponDiscount = Math.abs(Number(rawInput.coupon_discount || 0));
  const directDiscount = Math.abs(Number(rawInput.discount || 0));
  
  const discount =
    tradeDiscount > 0 || couponDiscount > 0
      ? Number((tradeDiscount + couponDiscount).toFixed(2))
      : directDiscount;
  
  const discountPct =
    subTotalWithPkg > 0 ? Number(((discount / subTotalWithPkg) * 100).toFixed(2)) : 0;

  const commissionableValue = Math.abs(
    Number(rawInput.commissionable_value || (subTotal + packagingCharges - discount))
  );

  const totalFees = Math.abs(Number(rawInput.total_fees || 0));
  const gstOnFees = Math.abs(Number(rawInput.gst_on_fees || 0));
  // On Swiggy Partner App screens, "(B) Total Fees" ALREADY includes Commission + PG + GST @ 18%
  const comPgGst = totalFees > 0 ? Number(totalFees.toFixed(2)) : Number(gstOnFees.toFixed(2));

  const complaintsCancellation = Math.abs(Number(rawInput.complaints_cancellation || 0));
  const tax = Math.abs(Number(rawInput.total_taxes || 0));

  const ads = options.manualAdsOverride !== undefined && options.manualAdsOverride > 0
    ? options.manualAdsOverride
    : Math.abs(Number(rawInput.ads || 0));

  const baseForAds = subTotal > 0 ? subTotal : subTotalWithPkg;
  const adsPct =
    baseForAds > 0 ? Number(((ads / baseForAds) * 100).toFixed(2)) : 0;

  const netPayout = Number(rawInput.net_payout || 0);
  
  const netPayoutPct =
    subTotalWithPkg > 0
      ? Number(((netPayout / subTotalWithPkg) * 100).toFixed(2))
      : 0;

  const overallBurnPct = Number((100 - netPayoutPct).toFixed(2));

  return {
    id: `sd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    brandId: options.brandId,
    section: "swiggy_delivery",
    platform: "swiggy",
    type: "delivery",
    periodLabel: options.periodLabel,
    startDate: options.startDate,
    endDate: options.endDate,
    updatedAt: new Date().toISOString(),
    orders,
    subTotal,
    packagingCharges,
    subTotalWithPkg,
    discount,
    discountPct,
    commissionableValue,
    comPgGst,
    complaintsCancellation,
    tax,
    ads,
    adsPct,
    netPayout,
    netPayoutPct,
    overallBurnPct,
    rawInput,
  };
}

/**
 * Execute Gemini Vision OCR API request for Swiggy Delivery Screenshots
 */
export async function processSwiggyDeliveryImagesWithGemini(
  geminiApiKey: string,
  imageBase64List: string[]
): Promise<SwiggyDeliveryRawOCR> {
  if (!geminiApiKey) {
    throw new Error("Missing Gemini API Key");
  }

  const parts: any[] = [{ text: SWIGGY_DELIVERY_GEMINI_PROMPT }];

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

  return JSON.parse(jsonMatch[0]) as SwiggyDeliveryRawOCR;
}
