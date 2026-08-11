import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { DEFAULT_PROJECTION_DATA, ProjectionBrandState, calculateMonthMetrics } from "@/lib/projections";

const PROJECTIONS_JSON_FILE = path.join(process.cwd(), "data", "projections", "projections_state.json");

function getProjectionsStoreServer(): Record<string, ProjectionBrandState> {
  try {
    if (fs.existsSync(PROJECTIONS_JSON_FILE)) {
      const content = fs.readFileSync(PROJECTIONS_JSON_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed.historicalMonths && Array.isArray(parsed.historicalMonths)) {
        return { default: parsed };
      }
      return parsed;
    }
  } catch (e) {
    console.error("Error reading projections_state.json:", e);
  }
  return {};
}

function saveProjectionsStoreServer(store: Record<string, ProjectionBrandState>) {
  const dir = path.dirname(PROJECTIONS_JSON_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROJECTIONS_JSON_FILE, JSON.stringify(store, null, 2));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get("brandId") || "default";

    const store = getProjectionsStoreServer();
    const data = store[brandId] || {
      ...DEFAULT_PROJECTION_DATA,
      brandId,
    };
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to load projections data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const brandId = body.brandId || "default";

    if (body.action === "recalculate") {
      const recalculatedHistorical = (body.historicalMonths || []).map((m: any) => calculateMonthMetrics(m));
      const recalculatedProjected = (body.projectedMonths || []).map((m: any) => calculateMonthMetrics(m));
      return NextResponse.json({
        brandName: body.brandName || "The Qwality Kitchen",
        historicalMonths: recalculatedHistorical,
        projectedMonths: recalculatedProjected,
        notes: body.notes
      });
    }

    if (body.brandName && body.historicalMonths && body.projectedMonths) {
      const store = getProjectionsStoreServer();
      store[brandId] = { ...body, brandId };
      saveProjectionsStoreServer(store);
      return NextResponse.json({ ok: true, data: body });
    }

    return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to process projections" }, { status: 500 });
  }
}
