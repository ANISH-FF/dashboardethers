import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ settings: getSettings() });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const current = getSettings();
    const updated = { ...current, ...body };
    saveSettings(updated);
    return NextResponse.json({ settings: updated });
  } catch {
    return NextResponse.json({ error: "Could not save settings." }, { status: 500 });
  }
}
