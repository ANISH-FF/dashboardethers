import { NextRequest, NextResponse } from "next/server";
import { getApiControlStatus, setApiControlStatus } from "@/lib/api-control";

export async function GET() {
  const status = getApiControlStatus();
  return NextResponse.json(status);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { error: "Field 'enabled' (boolean) is required." },
        { status: 400 }
      );
    }
    setApiControlStatus(body.enabled, body.message);
    return NextResponse.json({
      success: true,
      status: getApiControlStatus(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update API control status." },
      { status: 500 }
    );
  }
}
