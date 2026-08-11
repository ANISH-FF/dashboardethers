import { NextResponse } from "next/server";
import { getMenuItems, saveMenuItems } from "@/lib/db";
import { callGeminiJSON } from "@/lib/ai/gemini";

export async function POST() {
  try {
    const items = getMenuItems();
    const missing = items.filter((i) => !i.description || i.description.trim() === "");
    if (missing.length === 0) {
      return NextResponse.json({ items, message: "Every item already has a description." });
    }

    const prompt = `Write short, appetizing menu descriptions (max 18 words each) for
these restaurant dishes. Respond ONLY with a JSON array like:
[{"id": "...", "description": "..."}]

Items:
${JSON.stringify(missing.map((i) => ({ id: i.id, name: i.name, category: i.category, diet: i.diet })))}`;

    const result = await callGeminiJSON<{ id: string; description: string }[]>(prompt);

    const map = new Map(result.map((r) => [r.id, r.description]));
    const updated = items.map((item) =>
      map.has(item.id)
        ? {
            ...item,
            description: map.get(item.id),
            aiFields: Array.from(new Set([...(item.aiFields ?? []), "description"])),
            updatedAt: new Date().toISOString()
          }
        : item
    );
    saveMenuItems(updated);

    return NextResponse.json({ items: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "AI description generation failed." }, { status: 500 });
  }
}
