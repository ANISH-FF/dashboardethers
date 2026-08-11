import { NextRequest, NextResponse } from "next/server";
import { getLeads, createLead, updateLead, deleteLead } from "@/lib/db";

export async function GET() {
  try {
    const leads = getLeads();
    return NextResponse.json({ leads });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.brandName) {
      return NextResponse.json({ error: "Brand Name is required" }, { status: 400 });
    }
    const newLead = createLead(body);
    return NextResponse.json({ lead: newLead }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...patch } = body;
    if (!id) {
      return NextResponse.json({ error: "Lead ID is required" }, { status: 400 });
    }
    const updated = updateLead(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    return NextResponse.json({ lead: updated });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
      ids.forEach((i) => deleteLead(i));
      return NextResponse.json({ success: true, count: ids.length });
    }
    if (!id) {
      return NextResponse.json({ error: "Lead ID is required" }, { status: 400 });
    }
    deleteLead(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }
}
