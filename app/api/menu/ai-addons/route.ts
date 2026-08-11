import { NextResponse } from "next/server";
import { getMenuItems, saveMenuItems } from "@/lib/db";
import { callGeminiJSON } from "@/lib/ai/gemini";

export async function POST() {
  try {
    const items = getMenuItems();
    if (items.length === 0) {
      return NextResponse.json({ error: "Add some menu items first." }, { status: 400 });
    }

    const catalog = items.map((i) => ({
      name: i.name,
      price: i.basePrice || 0,
      category: i.category || "",
    })).filter((i) => i.name && i.name.trim());

    const prompt = `CRITICAL STRICT RULE: You are ONLY allowed to select add-ons from the provided "Available Menu Items Catalog".
DO NOT invent or fabricate any add-on name or price that is not present in the catalog!

Available Menu Items Catalog:
${JSON.stringify(catalog, null, 2)}

For each dish, select 2 to 4 relevant complementary items from the catalog that pair best with it (e.g. beverages, sides, breads, desserts, dips).
Format the 'addOns' as an array of strings containing item name and exact price from catalog:
e.g., ["Coke (₹80)", "French Fries (₹100)"]

Respond ONLY with a JSON array like:
[{"id": "item_id_here", "addOns": ["Coke (₹80)", "French Fries (₹100)"]}]

Items:
${JSON.stringify(items.map((i) => ({ id: i.id, name: i.name, category: i.category })))}`;

    const result = await callGeminiJSON<{ id: string; addOns: string[] }[]>(prompt);

    const map = new Map(result.map((r) => [r.id, r.addOns]));
    const updated = items.map((item) => {
      const addonsList = map.get(item.id);
      return addonsList
        ? {
            ...item,
            addons: Array.isArray(addonsList) ? addonsList.join(", ") : String(addonsList),
            aiFields: Array.from(new Set([...(item.aiFields ?? []), "addOns"])),
            updatedAt: new Date().toISOString(),
          }
        : item;
    });
    saveMenuItems(updated);

    return NextResponse.json({ items: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "AI add-on suggestion failed." }, { status: 500 });
  }
}
