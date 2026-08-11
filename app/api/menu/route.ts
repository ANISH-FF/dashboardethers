import { NextRequest, NextResponse } from "next/server";
import { getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem } from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json({ items: getMenuItems() });
  } catch {
    return NextResponse.json({ error: "Could not load the menu." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const item = createMenuItem(body);
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "Could not add the item." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "Missing item id." }, { status: 400 });
    const item = updateMenuItem(body.id, body);
    if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "Could not update the item." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing item id." }, { status: 400 });
    deleteMenuItem(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete the item." }, { status: 500 });
  }
}
