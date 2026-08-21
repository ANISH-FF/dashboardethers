import { NextRequest, NextResponse } from "next/server";
import {
  processZomatoDeliveryImagesWithGemini,
  computeZomatoDeliveryMetrics,
} from "./zomato_delivery_ocr_engine";
import {
  processSwiggyDeliveryImagesWithGemini,
  computeSwiggyDeliveryMetrics,
} from "./swiggy_delivery_ocr_engine";

/**
 * Next.js App Router API Route Example
 * Location: app/api/delivery-report/upload/route.ts
 */

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const platform = (formData.get("platform") as "zomato" | "swiggy") || "zomato";
    const periodLabel = (formData.get("periodLabel") as string) || "Custom Period";
    const startDate = (formData.get("startDate") as string) || "";
    const endDate = (formData.get("endDate") as string) || "";
    const manualAds = parseFloat((formData.get("manualAds") as string) || "0") || 0;

    const files = formData.getAll("files") as File[];
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "Please upload at least 1 payout screenshot." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY environment variable." },
        { status: 500 }
      );
    }

    // Convert uploaded files to base64 strings
    const b64List: string[] = [];
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      b64List.push(Buffer.from(bytes).toString("base64"));
    }

    if (platform === "zomato") {
      // 1. Extract raw values using Gemini Vision
      const rawJson = await processZomatoDeliveryImagesWithGemini(apiKey, b64List);
      
      // 2. Compute final metrics & percentages
      const result = computeZomatoDeliveryMetrics(rawJson, {
        periodLabel,
        startDate,
        endDate,
        manualAdsOverride: manualAds,
      });

      return NextResponse.json({ success: true, data: result });
    } else {
      // 1. Extract raw values using Gemini Vision
      const rawJson = await processSwiggyDeliveryImagesWithGemini(apiKey, b64List);
      
      // 2. Compute final metrics & percentages
      const result = computeSwiggyDeliveryMetrics(rawJson, {
        periodLabel,
        startDate,
        endDate,
        manualAdsOverride: manualAds,
      });

      return NextResponse.json({ success: true, data: result });
    }
  } catch (err: any) {
    console.error("Delivery Report API Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process delivery payout screenshot." },
      { status: 500 }
    );
  }
}
