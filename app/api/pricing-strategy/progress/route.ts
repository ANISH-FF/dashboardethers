import { NextRequest, NextResponse } from "next/server";

const PRICING_SERVER_URL = "http://127.0.0.1:8002";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId") || "default";

  try {
    const res = await fetch(`${PRICING_SERVER_URL}/api/pricing/progress?jobId=${encodeURIComponent(jobId)}`, {
      cache: "no-store"
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (e) {
    // Silent fallback
  }

  return NextResponse.json({ logs: [], stage: "IDLE" });
}
