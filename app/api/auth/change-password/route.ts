import { NextRequest, NextResponse } from "next/server";
import { getSession, resetEmployeePassword, verifyCredentials } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Only Co-Founders can change system passwords." }, { status: 403 });
    }

    const { currentPassword, newPassword, confirmPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current password and new password are required." }, { status: 400 });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return NextResponse.json({ error: "New password and confirm password do not match." }, { status: 400 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ error: "New password must be at least 4 characters long." }, { status: 400 });
    }

    const user = verifyCredentials(session.email, currentPassword);
    if (!user) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    resetEmployeePassword(session.email, newPassword);

    return NextResponse.json({ ok: true, message: "Password updated successfully!" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update password." }, { status: 500 });
  }
}
