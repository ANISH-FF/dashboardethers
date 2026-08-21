import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.NODE_ENV === "development"
  ? path.join(process.cwd(), ".next", "cache")
  : path.join(process.cwd(), "data");

const PRICING_STORE_FILE = path.join(DATA_DIR, "pricing_strategy_store.json");
const FALLBACK_STORE_FILE = path.join(process.cwd(), "data", "pricing_strategy_store.json");

declare global {
  var _pricingStoreCache: Record<string, any> | undefined;
}

function getStore(): Record<string, any> {
  if (globalThis._pricingStoreCache) {
    return globalThis._pricingStoreCache;
  }
  try {
    if (fs.existsSync(PRICING_STORE_FILE)) {
      const raw = fs.readFileSync(PRICING_STORE_FILE, "utf-8");
      globalThis._pricingStoreCache = JSON.parse(raw);
      return globalThis._pricingStoreCache!;
    }
    if (fs.existsSync(FALLBACK_STORE_FILE)) {
      const raw = fs.readFileSync(FALLBACK_STORE_FILE, "utf-8");
      globalThis._pricingStoreCache = JSON.parse(raw);
      return globalThis._pricingStoreCache!;
    }
  } catch (e) {
    console.error("Error reading pricing_strategy_store.json:", e);
  }
  globalThis._pricingStoreCache = {};
  return globalThis._pricingStoreCache;
}

function saveStore(store: Record<string, any>) {
  globalThis._pricingStoreCache = store;
  try {
    const dir = path.dirname(PRICING_STORE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PRICING_STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving pricing_strategy_store.json:", e);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brandId") || "default";

  const store = getStore();
  const data = store[brandId] || null;

  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const brandId = body.brandId || "default";

    const store = getStore();
    store[brandId] = {
      ...body,
      updatedAt: new Date().toISOString(),
    };
    saveStore(store);

    return NextResponse.json({ success: true, data: store[brandId] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save pricing strategy store" }, { status: 500 });
  }
}
