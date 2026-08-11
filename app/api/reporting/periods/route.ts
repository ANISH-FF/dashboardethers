import { NextRequest, NextResponse } from "next/server";
import {
  getReportingStore,
  saveReportingStore,
  SectionKey,
  computeZomatoDelivery,
  computeSwiggyDelivery,
  computeZomatoDineIn,
  computeSwiggyDineout,
} from "@/lib/reporting";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brandId");

  const store = getReportingStore();
  if (!brandId) return NextResponse.json(store);

  const filterByBrand = (list: any[]) =>
    (list || []).filter((item) => item.brandId === brandId || (!item.brandId && brandId === "1"));

  return NextResponse.json({
    zomato_delivery: filterByBrand(store.zomato_delivery),
    swiggy_delivery: filterByBrand(store.swiggy_delivery),
    zomato_dinein: filterByBrand(store.zomato_dinein),
    swiggy_dineout: filterByBrand(store.swiggy_dineout),
  });
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get("section") as SectionKey;
    const id = searchParams.get("id");

    if (!section || !id) {
      return NextResponse.json({ error: "Missing section or id" }, { status: 400 });
    }

    const store = getReportingStore() as any;
    if (store[section]) {
      store[section] = (store[section] as any[]).filter((p: any) => p.id !== id);
      saveReportingStore(store);
    }

    return NextResponse.json({ success: true, store });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete period." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { section, item } = body;

    if (!section || !item || !item.id) {
      return NextResponse.json({ error: "Missing section or item payload" }, { status: 400 });
    }

    const store = getReportingStore() as any;
    const list = (store[section] || []) as any[];
    const idx = list.findIndex((p: any) => p.id === item.id);

    if (idx === -1) {
      return NextResponse.json({ error: "Period item not found" }, { status: 404 });
    }

    let recomputed: any;
    if (section === "zomato_delivery") recomputed = computeZomatoDelivery(item);
    else if (section === "swiggy_delivery") recomputed = computeSwiggyDelivery(item);
    else if (section === "zomato_dinein") recomputed = computeZomatoDineIn(item);
    else if (section === "swiggy_dineout") recomputed = computeSwiggyDineout(item);

    list[idx] = recomputed;
    saveReportingStore(store);

    return NextResponse.json({ success: true, item: recomputed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update period." }, { status: 500 });
  }
}
