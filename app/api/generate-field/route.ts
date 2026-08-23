import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const maxDuration = 300; // 5 Minutes Max Duration for AI Operations

function getGeminiApiKey(): string {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/GEMINI_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/);
      if (match && match[1] && match[1].trim()) {
        return match[1].trim();
      }
    }
  } catch (e) {}
  return process.env.GEMINI_API_KEY || "";
}

async function callGeminiForBatch(systemInstruction: string, userContent: string, apiKey: string) {
  const models = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
  let lastErr = "";
  for (const modelName of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ parts: [{ text: userContent }] }],
            generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } else {
        lastErr = await response.text();
      }
    } catch (err: any) {
      lastErr = err?.message || String(err);
    }
  }
  throw new Error(`Gemini API error: ${lastErr}`);
}

export async function POST(req: NextRequest) {
  try {
    const { items, field, count } = await req.json();

    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY in .env file");

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Handle AI Master Variant Title Derivation for selected items
    if (field === "master_title") {
      const names = items.map((i: any) => i.name || i).join(", ");
      const systemInstruction = `You are an expert restaurant menu editor AI.
Your task is to generate the single best, clean, professional Master Dish Category / Variant Title (1-3 words) for these items that are being grouped together:
"${names}"

EXAMPLES:
- "Chicken Noodles", "Egg Noodles", "Beef Noodles" -> "Non-Veg Noodles"
- "Oreo Shake", "Badam Shake", "Seman Shake" -> "Milkshakes"
- "Paneer Tikka", "Paneer Malai Tikka" -> "Paneer Tikka Options"
- "Small Pizza", "Large Pizza" -> "Pizza"

Return ONLY a valid JSON object with key "title": {"title": "Generated Master Name"}. No markdown, no code fences, no extra text.`;

      const text = await callGeminiForBatch(systemInstruction, `Item names: ${names}`, apiKey);
      const parsed = JSON.parse(text);
      return NextResponse.json({ title: parsed.title || parsed.name || "Variant Group" });
    }

    let instruction = "";
    if (field === "subcategory") {
      instruction = `Generate a concise sub-category for each menu item based on its name and main category. 
Examples: "Paneer Starters", "Rice Dishes", "Breads", "Chinese Gravy", "Cold Beverages". 
Keep it 1-3 words. Update only the 'subcategory' field.`;
    } else if (field === "addons") {
      const n = count || 3;
      const catalog = items
        .map((i: any) => ({
          name: i.name,
          price: parseFloat(i.base_price || "0") || 0,
          category: i.category || "",
        }))
        .filter((i: any) => i.name && i.name.trim());

      instruction = `CRITICAL STRICT RULE: You are ONLY allowed to select add-ons from the provided "Available Menu Items Catalog".
DO NOT invent, fabricate, or hallucinate any add-on name or price that is not present in the catalog!

Available Menu Items Catalog:
${JSON.stringify(catalog, null, 2)}

For each dish, select 1 to ${n} relevant complementary items from the catalog that pair best with it (e.g. beverages, sides, breads, desserts, dips).
Format the 'addons' field as a comma-separated string listing each selected catalog item name with its exact price from catalog:
Example format: "Coke (₹80), French Fries (₹100)"
If no relevant pairing exists in the catalog for a dish, leave 'addons' blank. Update ONLY the 'addons' field.`;
    } else if (field === "description") {
      instruction = `Write a short, appetizing description (max 12 words) for each menu item. 
Make it enticing and accurate to the dish name. Update only the 'description' field.`;
    } else {
      instruction = `Generate appropriate values for the '${field}' field for each menu item.`;
    }

    const systemInstruction = `You are an expert restaurant menu consultant AI.
Task: ${instruction}
IMPORTANT: Return ONLY the complete modified JSON array of items. No markdown, no extra text, no code fences.
Do NOT modify any other field (id, name, base_price, is_veg, etc.).`;

    // Process in batches of 25 items for maximum stability and speed
    const BATCH_SIZE = 25;
    const updatedItemsMap = new Map<string, any>();

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const userContent = `Menu Items Batch:\n${JSON.stringify(batch, null, 2)}`;
      
      try {
        const text = await callGeminiForBatch(systemInstruction, userContent, apiKey);
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsedBatch: any[] = JSON.parse(jsonMatch[0]);
          for (const item of parsedBatch) {
            if (item && item.id) {
              updatedItemsMap.set(item.id, item);
            }
          }
        }
      } catch (err) {
        console.warn(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err);
      }
    }

    // Merge updated items back while preserving order
    const resultItems = items.map((orig: any) => {
      const updated = updatedItemsMap.get(orig.id);
      return updated ? { ...orig, ...updated } : orig;
    });

    return NextResponse.json({ items: resultItems });
  } catch (err: any) {
    console.error("Generate Field API Error:", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
