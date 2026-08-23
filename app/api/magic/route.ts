import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const maxDuration = 300;

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

function extractJsonArray(text: string): any[] {
  let cleaned = text.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}

  const start = cleaned.indexOf("[");
  if (start === -1) throw new Error("No JSON array found in AI response");

  let depth = 0;
  let end = -1;
  let inString = false;
  let escape = false;

  for (let i = start; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === "[") {
        depth++;
      } else if (char === "]") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
  }

  if (end === -1) {
    const jsonMatch = cleaned.match(/\[[\s\S]*?\](?=\s*$|\s*[^\]]*$)/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error("Invalid JSON structure in AI response");
  }

  return JSON.parse(cleaned.substring(start, end + 1));
}

function filterSmartItems(rawItems: any[], prompt: string): any[] {
  if (!rawItems || rawItems.length === 0) return [];
  const pLower = prompt.toLowerCase().trim();

  // If prompt explicitly mentions global scope, send all items
  const isGlobal = /\b(all|entire|every|whole|menu|overall|everything|menu-wide)\b/i.test(pLower);
  if (isGlobal) return rawItems;

  // 1. Check if user prompt targets a specific Category
  const categories = Array.from(
    new Set(rawItems.map((i) => String(i.category || i.categoryName || "").toLowerCase()))
  ).filter((c) => c && c.length > 2);

  const matchedCat = categories.find((cat) => pLower.includes(cat));
  if (matchedCat) {
    const categoryMatches = rawItems.filter(
      (i) => String(i.category || i.categoryName || "").toLowerCase() === matchedCat
    );
    if (categoryMatches.length > 0) return categoryMatches;
  }

  // 2. Check if user prompt targets specific Dish Name(s) or Keywords
  const matchedDishes = rawItems.filter((i) => {
    const dishName = String(i.name || i.itemName || "").toLowerCase();
    if (!dishName) return false;

    if (pLower.includes(dishName)) return true;
    const words = dishName.split(/[\s,/-]+/).filter((w) => w.length >= 3);
    return words.some((word) => pLower.includes(word));
  });

  if (matchedDishes.length > 0 && matchedDishes.length < rawItems.length) {
    return matchedDishes;
  }

  // 3. Fallback to full list if prompt is broad
  return rawItems;
}

export async function POST(req: NextRequest) {
  try {
    const { items, prompt } = await req.json();

    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY in .env file");

    const rawItems = Array.isArray(items) ? items : [];
    if (rawItems.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Smartly filter items based on prompt intent (Category, Item name, or Global)
    const targetItems = filterSmartItems(rawItems, prompt);

    // Lean payload compression: Strip nulls, empty strings, internal metadata
    const compactItems = targetItems.map((i: any) => {
      const obj: any = {
        id: i.id || i._id,
        name: i.name || i.itemName || "",
        category: i.category || i.categoryName || "General",
      };
      if (i.subCategory || i.subcategory) obj.subCategory = i.subCategory || i.subcategory;
      if (i.diet || i.is_veg !== undefined) obj.diet = i.diet || (i.is_veg ? "veg" : "non-veg");
      if (i.basePrice !== undefined || i.base_price !== undefined) obj.basePrice = Number(i.basePrice ?? i.base_price ?? 0);
      if (i.onlinePrice !== undefined || i.online_price !== undefined) obj.onlinePrice = Number(i.onlinePrice ?? i.online_price ?? 0);
      if (i.halfPortionPrice !== undefined || i.half_price !== undefined) obj.halfPortionPrice = Number(i.halfPortionPrice ?? i.half_price ?? 0);
      if (i.description && i.description.trim()) obj.description = i.description.trim();
      if (i.addOns || i.addons) obj.addOns = i.addOns || i.addons;
      if (i.custom_columns && Object.keys(i.custom_columns).length > 0) obj.custom_columns = i.custom_columns;
      return obj;
    });

    const systemInstruction = `You are an expert Menu Manipulation AI. Apply the user instruction to the menu items array.
Return ONLY a valid JSON array of items. No markdown codeblocks, no explanations, no wrappers.
Preserve exact item 'id' values. Do not alter unrequested fields.`;

    const userContent = `Instruction: ${prompt}\nItems JSON:${JSON.stringify(compactItems)}`;

    const models = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
    let lastErr = "";
    let data: any = null;

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
              generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json",
              },
            }),
          }
        );

        if (response.ok) {
          data = await response.json();
          break;
        } else {
          lastErr = await response.text();
        }
      } catch (err: any) {
        lastErr = err?.message || String(err);
      }
    }

    if (!data) {
      throw new Error(`Gemini API error: ${lastErr}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No output from Gemini");

    const updatedCompactItems: any[] = extractJsonArray(text);
    const updatedMap = new Map(updatedCompactItems.map((u) => [u.id, u]));

    // Re-merge AI modifications into full original items while preserving non-modified dishes
    const finalItems = rawItems.map((orig) => {
      const mod = updatedMap.get(orig.id);
      return mod ? { ...orig, ...mod } : orig;
    });

    // Also include any newly created items by AI
    updatedCompactItems.forEach((mod) => {
      if (!rawItems.some((orig) => orig.id === mod.id)) {
        finalItems.push(mod);
      }
    });

    return NextResponse.json({ items: finalItems });
  } catch (err: any) {
    console.error("[Ask AI Error]:", err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
