import { NextRequest, NextResponse } from "next/server";
import {
  getMonthlyRollupsForBrand,
  saveMonthlyRollupRecord,
  deleteMonthlyRollupRecord,
  MonthlyRollupRecord,
} from "@/lib/reporting";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brandId") || "";

  if (!brandId) {
    return NextResponse.json({ error: "Missing brandId" }, { status: 400 });
  }

  const rollups = getMonthlyRollupsForBrand(brandId);
  return NextResponse.json({ success: true, rollups });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      brandId,
      brandName,
      section,
      monthName,
      orders,
      transactions,
      subTotal,
      packagingCharges,
      subTotalWithPkg,
      discount,
      discountPct,
      commission,
      ads,
      adsPct,
      netPayout,
      netPayoutPct,
      overallBurnPct,
    } = body;

    if (!brandId || !monthName || !section) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const record: MonthlyRollupRecord = {
      id: `mrollup_${brandId}_${Date.now()}`,
      brandId,
      brandName: brandName || "Brand",
      section,
      monthName,
      savedAt: new Date().toISOString(),
      orders: Number(orders || 0),
      transactions: Number(transactions || 0),
      subTotal: Number(subTotal || 0),
      packagingCharges: Number(packagingCharges || 0),
      subTotalWithPkg: Number(subTotalWithPkg || 0),
      discount: Number(discount || 0),
      discountPct: Number(discountPct || 0),
      commission: Number(commission || 0),
      ads: Number(ads || 0),
      adsPct: Number(adsPct || 0),
      netPayout: Number(netPayout || 0),
      netPayoutPct: Number(netPayoutPct || 0),
      overallBurnPct: Number(overallBurnPct || 0),
    };

    saveMonthlyRollupRecord(record);
    return NextResponse.json({ success: true, record });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save monthly rollup" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  deleteMonthlyRollupRecord(id);
  return NextResponse.json({ success: true });
}
