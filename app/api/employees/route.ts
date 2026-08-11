import { NextRequest, NextResponse } from "next/server";
import { 
  getSession, 
  getPublicEmployees, 
  createEmployee, 
  resetEmployeePassword, 
  deleteEmployeeAccount 
} from "@/lib/auth";

// GET /api/employees - Get employee list for authenticated sessions
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    return NextResponse.json({ employees: getPublicEmployees() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch employees" }, { status: 500 });
  }
}

// POST /api/employees - Create a new employee (Co-founder only)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Only Co-Founders can create new employee accounts." }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, password, role, designation, department, phone, salary } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }

    const result = createEmployee({
      name,
      email,
      password: password && password.trim() ? password.trim() : undefined,
      role: role === "admin" ? "admin" : "staff",
      designation,
      department,
      phone,
      salary: salary ? Number(salary) : undefined
    });

    return NextResponse.json({ 
      ok: true, 
      employee: result.employee, 
      generatedPassword: result.generatedPassword 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Could not create employee" }, { status: 400 });
  }
}

// PUT /api/employees - Reset employee password (Co-founder only)
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Only Co-Founders can reset employee passwords." }, { status: 403 });
    }

    const { email, customPassword } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Employee email is required." }, { status: 400 });
    }

    const { getEmployees } = await import("@/lib/auth");
    const targetEmp = getEmployees().find((e) => e.email.toLowerCase() === email.toLowerCase());
    if (targetEmp && targetEmp.role === "admin" && targetEmp.email.toLowerCase() !== session.email.toLowerCase()) {
      return NextResponse.json({ error: "Security Policy: Co-Founders cannot reset another Co-Founder's password." }, { status: 403 });
    }

    const newPassword = resetEmployeePassword(email, customPassword && customPassword.trim() ? customPassword.trim() : undefined);

    return NextResponse.json({ ok: true, email, newPassword });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to reset password" }, { status: 400 });
  }
}

// DELETE /api/employees - Remove an employee (Co-founder only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Only Co-Founders can delete employee accounts." }, { status: 403 });
    }

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Employee email is required." }, { status: 400 });
    }

    if (email.toLowerCase() === session.email.toLowerCase()) {
      return NextResponse.json({ error: "You cannot delete your own Co-Founder account while logged in." }, { status: 400 });
    }

    deleteEmployeeAccount(email);
    return NextResponse.json({ ok: true, message: `Account for ${email} has been removed.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete employee" }, { status: 400 });
  }
}
