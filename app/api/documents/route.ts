import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDocuments, getDocumentsForEmployee, createDocument } from "@/lib/documents";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admins get all docs; staff get their own docs
    if (session.role === "admin") {
      const { searchParams } = new URL(req.url);
      const email = searchParams.get("email");
      if (email) {
        return NextResponse.json({ documents: getDocumentsForEmployee(email) });
      }
      return NextResponse.json({ documents: getDocuments() });
    } else {
      return NextResponse.json({ documents: getDocumentsForEmployee(session.email) });
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    if (!body.employeeEmail || !body.title) {
      return NextResponse.json({ error: "Employee Email and Title are required" }, { status: 400 });
    }

    const doc = createDocument(body);
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }
}
