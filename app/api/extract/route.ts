import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType, customPrompt } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    let prompt = `Extract ALL menu items from this image. Return ONLY valid JSON (no markdown, no explanation):
{
  "items": [
    {
      "name": "ITEM NAME",
      "category": "Category",
      "subcategory": "",
      "description": "",
      "quantity": "",
      "base_price": 0,
      "is_veg": true,
      "variants": "",
      "addons": "",
      "spice_level": ""
    }
  ]
}
Rules:
- name: uppercase, exactly as written
- category: infer main category (e.g. "Main Course", "Starters", "Beverages", "Desserts", "Soups", "Breads")
- subcategory: infer specific sub-category distinguishing Veg vs Non-Veg and dish type (e.g. "Veg Soups", "Non-Veg Soups", "Paneer Starters", "Chicken Starters", "Milkshakes", "Mocktails", "Biryani & Rice")
- quantity: quantity in grams, pcs, kg, lbs, slice, ml, litres etc, else empty string
- base_price: number only, 0 if not found
- is_veg: true if veg symbol or veg dish, false otherwise
- variants: comma-separated if multiple sizes/variants exist, else empty string
- addons: comma-separated list of any add-ons or extras mentioned, else empty string
- spice_level: "Low", "Medium", "High", or "" if not mentioned`;

    if (customPrompt) {
      prompt += `\n\nAdditional Instructions from User:\n${customPrompt}`;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mediaType || "image/jpeg",
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("No output from Gemini");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const parsedData = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsedData);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
