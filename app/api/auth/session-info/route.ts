import { NextRequest, NextResponse } from "next/server";
import { getSession, getEmployees } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    const employees = getEmployees().map(({ password, ...emp }) => emp);
    return NextResponse.json({ session, employees });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch session info" }, { status: 500 });
  }
}
