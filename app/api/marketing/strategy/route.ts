import { NextResponse } from "next/server";
import { BrandMarketingStrategyData } from "@/lib/marketingStrategy";
import {
  getBrandMarketingStrategyStore,
  saveBrandMarketingStrategy,
} from "@/lib/marketingStrategyServer";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId") || "1";

    const store = getBrandMarketingStrategyStore();
    const strategyData = store[brandId] || null;

    return NextResponse.json({
      success: true,
      brandId,
      strategy: strategyData,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch marketing strategy." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: BrandMarketingStrategyData = await request.json();

    if (!body.brandId) {
      return NextResponse.json(
        { error: "brandId is required." },
        { status: 400 }
      );
    }

    const saved = saveBrandMarketingStrategy(body);

    return NextResponse.json({
      success: true,
      strategy: saved,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save marketing strategy." },
      { status: 500 }
    );
  }
}
