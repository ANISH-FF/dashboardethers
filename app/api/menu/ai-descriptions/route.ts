import { NextRequest, NextResponse } from "next/server";
import { getMenuItems, saveMenuItems } from "@/lib/db";
import { callGeminiJSON } from "@/lib/ai/gemini";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const startIndex: number = body.startIndex ?? 0;
    const batchSize: number = body.batchSize ?? 25;

    const items = getMenuItems();
    const missing = items.filter((i) => !i.description || i.description.trim() === "");

    if (missing.length === 0) {
      return NextResponse.json({ items, done: true, message: "Every item already has a description." });
    }

    const batch = missing.slice(startIndex, startIndex + batchSize);
    const done = startIndex + batchSize >= missing.length;

    if (batch.length === 0) {
      return NextResponse.json({ items, done: true, processedCount: 0, totalMissing: missing.length });
    }

    const prompt = `Write appetizing Swiggy-style menu descriptions (25-30 words each) focusing on dish texture, rich spices, and flavor. No side-dish pairings. Respond ONLY with a JSON array like:
[{"id": "...", "description": "..."}]

Items:
${JSON.stringify(batch.map((i) => ({ id: i.id, name: i.name, category: i.category, diet: i.diet })))}`;

    const result = await callGeminiJSON<{ id: string; description: string }[]>(prompt);

    const map = new Map(result.map((r) => [r.id, r.description]));
    const updated = items.map((item) =>
      map.has(item.id)
        ? {
            ...item,
            description: map.get(item.id),
            aiFields: Array.from(new Set([...(item.aiFields ?? []), "description"])),
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
    return NextResponse.json({ error: err.message || "AI description generation failed." }, { status: 500 });
  }
}
