import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

function getGeminiApiKey(): string {
  let key = process.env.GEMINI_API_KEY || "";
  if (!key) {
    try {
      const envPath = path.join(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const m = fs.readFileSync(envPath, "utf-8").match(/GEMINI_API_KEY=(.+)/);
        if (m) key = m[1].trim();
      }
    } catch {}
  }
  return key;
}

export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json();

    if (!items || !Array.isArray(items) || items.length < 2) {
      return NextResponse.json({ error: "At least 2 items required to group into a variant." }, { status: 400 });
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const systemInstruction = `You are an expert restaurant menu taxonomy AI.
The user has selected a specific set of menu items to combine into 1 single Master Variant Group.

YOUR TASK:
1. Determine 'masterName': The clean, natural, and accurate Master Dish Name (e.g. "Steak" for ["Beef Steak", "Chicken Steak", "Fish Steak"]; "Noodles" for ["Veg Noodles", "Chicken Noodles"]; "Momos" for ["Veg Fried Momos", "Chicken Fried Momos"]).
2. Determine 'variants': A comma-separated string listing each option cleanly with price, e.g. "Beef (₹450), Chicken (₹350), Fish (₹400)". Remove the redundant master word from individual option names when natural (e.g. "Beef" instead of "Beef Steak" when master name is "Steak").
3. Determine 'lowestPrice': Number (the minimum price among all selected items).

Return ONLY a valid JSON object in this exact format:
{
  "masterName": "string",
  "variants": "string",
  "lowestPrice": number
}`;

    const userContent = `Selected Menu Items:\n${JSON.stringify(items, null, 2)}`;

    // Try Gemini 1.5 / 2.0 / 2.5 Flash models
    let text = "";
    const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash"];

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemInstruction }] },
              contents: [{ parts: [{ text: userContent }] }],
              generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (text) break;
        }
      } catch (e) {
        console.warn(`Model ${model} failed, trying next...`, e);
      }
    }

    if (!text) {
      throw new Error("Gemini AI API call failed or returned empty response.");
    }

    const resultObj = JSON.parse(text);
    return NextResponse.json(resultObj);
  } catch (err: any) {
    console.error("[GroupSelectedVariant] Error:", err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
