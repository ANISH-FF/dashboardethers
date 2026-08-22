import { NextRequest, NextResponse } from "next/server";
import { getMenuItems, saveMenuItems } from "@/lib/db";
import { callGeminiJSON } from "@/lib/ai/gemini";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const startIndex: number = body.startIndex ?? 0;
    const batchSize: number = body.batchSize ?? 25;

    const items = getMenuItems();
    if (items.length === 0) {
      return NextResponse.json({ error: "Add some menu items first." }, { status: 400 });
    }

    // Only process items missing a subCategory
    const missing = items.filter((i) => !i.subCategory || i.subCategory.trim() === "");

    if (missing.length === 0) {
      return NextResponse.json({ items, done: true, message: "Every item already has a sub-category." });
    }

    const batch = missing.slice(startIndex, startIndex + batchSize);
    const done = startIndex + batchSize >= missing.length;

    if (batch.length === 0) {
      return NextResponse.json({ items, done: true, processedCount: 0, totalMissing: missing.length });
    }

    const prompt = `You are helping organize a restaurant menu. Given this list of items
(id, name, category), assign a short, sensible sub-category to each one
(e.g. "Tandoori Starters", "Creamy Curries", "Dry Sides"). Keep sub-categories
consistent across similar items. Respond ONLY with a JSON array like:
[{"id": "...", "subCategory": "..."}]

Items:
${JSON.stringify(batch.map((i) => ({ id: i.id, name: i.name, category: i.category })))}`;

    const result = await callGeminiJSON<{ id: string; subCategory: string }[]>(prompt);

    const map = new Map(result.map((r) => [r.id, r.subCategory]));
    const updated = items.map((item) =>
      map.has(item.id)
        ? {
            ...item,
            subCategory: map.get(item.id),
            aiFields: Array.from(new Set([...(item.aiFields ?? []), "subCategory"])),
            updatedAt: new Date().toISOString(),
          }
        : item
    );
    saveMenuItems(updated);

    return NextResponse.json({
      items: updated,
      done,
      processedCount: batch.length,
      totalMissing: missing.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "AI sub-categorization failed." }, { status: 500 });
  }
}
