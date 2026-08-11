import { NextResponse } from "next/server";
import { getMenuItems, saveMenuItems } from "@/lib/db";
import { callGeminiJSON } from "@/lib/ai/gemini";

export async function POST() {
  try {
    const items = getMenuItems();
    if (items.length === 0) {
      return NextResponse.json({ error: "Add some menu items first." }, { status: 400 });
    }

    const prompt = `You are helping organize a restaurant menu. Given this list of items
(id, name, category), assign a short, sensible sub-category to each one
(e.g. "Tandoori Starters", "Creamy Curries", "Dry Sides"). Keep sub-categories
consistent across similar items. Respond ONLY with a JSON array like:
[{"id": "...", "subCategory": "..."}]

Items:
${JSON.stringify(items.map((i) => ({ id: i.id, name: i.name, category: i.category })))}`;

    const result = await callGeminiJSON<{ id: string; subCategory: string }[]>(prompt);

    const map = new Map(result.map((r) => [r.id, r.subCategory]));
    const updated = items.map((item) =>
      map.has(item.id)
        ? {
            ...item,
            subCategory: map.get(item.id),
            aiFields: Array.from(new Set([...(item.aiFields ?? []), "subCategory"])),
            updatedAt: new Date().toISOString()
          }
        : item
    );
    saveMenuItems(updated);

    return NextResponse.json({ items: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "AI sub-categorization failed." }, { status: 500 });
  }
}
