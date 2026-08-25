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
    parts.push({ inlineData: { mimeType, data: cleanB64 } });
  }

  // Pass 1 — gemini-2.5-flash-lite
  const pass1 = await singleOcrPass(prompt, parts, apiKey, "gemini-2.5-flash-lite");
  if (!pass1) throw new Error("No output from Gemini OCR on Pass 1.");

  // Pass 2 — gemini-2.5-flash (different model to catch systematic errors)
  const pass2 = await singleOcrPass(prompt, parts, apiKey, "gemini-2.5-flash");
  if (!pass2) return pass1;

  // Both match → done
  if (ocrValuesMatch(pass1, pass2)) return pass1;

  // Mismatch → Pass 3 tiebreaker (flash-lite)
  const pass3 = await singleOcrPass(prompt, parts, apiKey, "gemini-2.5-flash-lite");
  if (!pass3) return pass1;

  return ocrTiebreaker(pass1, pass2, pass3);
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

      const prompt = `Extract numerical metrics from these Zomato payout detail screenshot(s).
Respond ONLY with a JSON object containing these exact keys (use 0 if a field is not found):
{
  "total_orders": number,
  "sub_total": number,
  "packaging_charges": number,
  "discount": number,
  "delivery_charge_discount": number,
  "commissionable_value": number,
  "ads": number,
  "hyperpure": number,
  "order_level_deduction": number,
  "gst_on_service_fees": number,
  "net_payout": number
}
Rules:
- Read numbers strictly as shown on the screen.
- "commissionable_value": read strictly from "Net order value (A)" on Zomato screenshot (e.g. 63905.53), else item subtotal + packaging charges - discount.
- "discount": sum of promo discounts, flat offs, Gold discounts, freebies, relisted order discounts, and merchant discounts.
- "delivery_charge_discount": read strictly from "Delivery charge discount" line if present (e.g. 200.25), else 0.
- "hyperpure": read B2B raw material procurement deduction / Hyperpure deduction if present, else 0.
- "order_level_deduction": read strictly from "Order level deductions (C)" header on Zomato screenshot (e.g. 61777.20).
- "gst_on_service_fees": read strictly from "GST on service & platform fees" / "GST on Order level deductions (18%)" (e.g. 11119.83). If not explicitly listed, calculate as 18% of order_level_deduction.
- "ads": advertisement / ad spend amount if shown, else 0.
- "net_payout": read strictly from "Est. payout (A + B + C + D + E + F)". Include negative sign if payout is negative/red (e.g. -15548.59).`;

      const raw = await extractJsonWithGemini(prompt, b64List);

      const orders = Number(raw.total_orders || 0);
      const subTotal = Number(raw.sub_total || 0);
      const packagingCharges = Number(raw.packaging_charges || 0);
      const baseDiscount = Number(raw.discount || 0);
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
      const gstOnServiceFees = Number(
        raw.gst_on_service_fees || (orderLevelDeduction > 0 ? orderLevelDeduction * 0.18 : 0)
      );
      const commissionPgGst = Math.round(orderLevelDeduction + gstOnServiceFees);
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
  "discount": number,
  "commissionable_value": number,
  "total_fees": number,
  "ads": number,
  "net_payout": number
}
Rules:
- "commissionable_value": read strictly from "(A) Total Customer Paid" on Swiggy screenshot (e.g. 37779.28), else item subtotal + packaging charges - discount.
- "total_fees": read strictly from "(B) Total Fees" on Swiggy screenshot (e.g. 8431.35).`;

        const raw = await extractJsonWithGemini(prompt, [b64]);

        const commVal = Number(
          raw.commissionable_value ||
          raw.total_customer_paid ||
          (Number(raw.sub_total || 0) + Number(raw.packaging_charges || 0) - Number(raw.discount || 0)) ||
          0
        );

        agg.orders += Number(raw.orders || 0);
        agg.subTotal += Number(raw.sub_total || 0);
        agg.packagingCharges += Number(raw.packaging_charges || 0);
        agg.discount += Number(raw.discount || 0);
        agg.commissionableValue += commVal;
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
