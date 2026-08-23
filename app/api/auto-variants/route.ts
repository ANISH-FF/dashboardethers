import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

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

export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json();

    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY in .env file");

    const systemInstruction = `You are an expert restaurant menu taxonomy AI.
Your task is to analyze a list of menu items and auto-group dishes that are variants of each other (e.g. "Chicken Noodles", "Egg Noodles", "Veg Noodles" -> Master Item: "Noodles", Variants: "Veg (₹180), Egg (₹200), Chicken (₹220)").

RULES:
1. Whenever 2 or more dishes share the same core base name but differ only in protein/flavor/size/type (e.g., "Paneer Butter Masala" / "Chicken Butter Masala", or "Small Pizza" / "Large Pizza", or "Vanilla Shake" / "Chocolate Shake"), group them under 1 Master Dish.
2. For the Master Dish:
   - 'name': Set a clear, natural master name (e.g. "Milkshakes", "Noodles", "Biryanis", "Paneer Butter Masala"). NEVER prepend 'Veg ' to beverages, shakes, desserts, or category titles.
   - 'base_price': Set to the lowest variant price.
   - 'variants': Format as a comma-separated string listing options with prices, e.g., "Veg (₹180), Egg (₹200), Chicken (₹250)".
3. Remove the duplicate variant items so only the Master Dish remains in the final list.
4. Keep all non-variant items intact without modification.
5. Return ONLY a valid JSON array of the final menu items. No markdown code blocks.`;

    const userContent = `Menu Items:\n${JSON.stringify(items, null, 2)}`;

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
              generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
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

    const groupedItems = extractJsonArray(text);
    return NextResponse.json({ items: groupedItems });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
