import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType, customPrompt } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    let prompt = `You are a world-class AI menu extraction engine. Extract ALL menu items from this image with 100% precision. Return ONLY valid JSON (no markdown, no explanation):
{
  "items": [
    {
      "name": "ITEM NAME",
      "category": "Category",
      "subcategory": "Sub-Category",
      "description": "Short description if present",
      "quantity": "Portion size if specified e.g. 250ML",
      "base_price": 50,
      "is_veg": true,
      "variants": "120ML (₹50), 500ML (₹250)",
      "addons": "Honey (₹30), Lemon (₹30)",
      "spice_level": ""
    }
  ]
}

CRITICAL EXTRACTION RULES:
1. NAME: UPPERCASE, clean item name exactly as printed (e.g. "MASALA CHAI", "BLACK TEA"). Do not include price or variant sizes inside the item name string.
2. BASE_PRICE: Set to the starting / lowest variant price as a plain number (e.g. 50).
3. MULTI-PRICE VARIANT RULE (EXTREMELY IMPORTANT):
   - When a dish has multiple sizes/portions (e.g. from section headings like "(120/500ML)" or column headers like "Half / Full") AND slash-separated prices (e.g. "50/250" or "80/350"):
     - You MUST map each size option to its corresponding price in the "variants" field using format: "Size (₹Price)".
     - Example for DESI CHAI "50/250" under header "(120/500ML)": "base_price": 50, "variants": "120ML (₹50), 500ML (₹250)".
     - Example for SPL KESAR CHAI "80/350" under header "(120/500ML)": "base_price": 80, "variants": "120ML (₹80), 500ML (₹350)".
     - Example for Half/Full pizza "150/280": "base_price": 150, "variants": "Half (₹150), Full (₹280)".
   - If only 1 size exists, set "variants" to "" and put quantity in "quantity" field (e.g., "quantity": "250ML").
4. ADD-ON SUB-SECTION RULE (EXTREMELY IMPORTANT):
   - DO NOT create separate item entries in "items" for add-ons, extras, or toppings listed under sub-headings like "ADD ON:", "ADDONS:", "EXTRAS:", "TOPPINGS:".
   - Options like "HONEY 30", "LEMON 30", "GINGER 30" under "ADD ON:" are NOT standalone menu dishes.
   - Instead, attach them directly into the "addons" field for ALL parent menu items inside that section/category!
   - Example: For "BLACK TEA", "GREEN TEA", "SULEMANI CHAI", set "addons": "Honey (₹30), Lemon (₹30), Ginger (₹30)".
5. CATEGORY & SUBCATEGORY:
   - Infer clear, standard categories (e.g., "Beverages", "Main Course", "Starters", "Lassi", "Chai Ke Saath", "Desserts").
   - Subcategory should specify dish type (e.g. "Hot Milk Tea", "Paani Wali Chai", "Kulhad Lassi", "Snacks").
6. IS_VEG: true if dish is vegetarian (tea, coffee, lassi, cheese, veg items, green dot), false for non-veg.`;

    if (customPrompt) {
      prompt += `\n\nAdditional Instructions from User:\n${customPrompt}`;
    }

    const MODELS = ["gemini-2.5-flash"];
    let lastError: Error | null = null;
    let data: any = null;

    for (const modelName of MODELS) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
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
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
          }
        );

        if (response.ok) {
          data = await response.json();
          break;
        }

        const errText = await response.text();
        console.warn(`Model ${modelName} failed (${response.status}). Retrying next model...`);
        lastError = new Error(`Gemini API (${modelName}) error: ${response.status}`);
      } catch (err: any) {
        console.warn(`Model ${modelName} exception:`, err);
        lastError = err;
      }
    }

    if (!data) {
      throw lastError || new Error("All Gemini vision models failed");
    }
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
