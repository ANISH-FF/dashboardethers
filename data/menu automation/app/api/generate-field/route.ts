import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { items, field, count } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    let instruction = "";
    if (field === "subcategory") {
      instruction = `Generate a concise sub-category for each menu item based on its name and main category. 
Examples: "Paneer Starters", "Rice Dishes", "Breads", "Chinese Gravy", "Cold Beverages". 
Keep it 1-3 words. Update only the 'subcategory' field.`;
    } else if (field === "addons") {
      const n = count || 3;
      instruction = `Suggest exactly ${n} relevant food add-ons/extras for each menu item (comma-separated string). 
Examples for a curry: "Extra Gravy, Butter Naan, Raita". 
For a beverage: "Extra Sugar, Ice Cubes, Lemon Slice". 
Only include things that make culinary sense with that specific dish. Update only the 'addons' field.`;
    } else if (field === "description") {
      instruction = `Write a short, appetizing description (max 12 words) for each menu item. 
Make it enticing and accurate to the dish name. Update only the 'description' field.`;
    } else {
      instruction = `Generate appropriate values for the '${field}' field for each menu item.`;
    }

    const systemInstruction = `You are an expert restaurant menu consultant AI.
Task: ${instruction}
IMPORTANT: Return ONLY the complete modified JSON array. No markdown, no extra text, no code fences.
Do NOT modify any other field (id, name, base_price, is_veg, etc.).`;

    const userContent = `Menu Items:\n${JSON.stringify(items, null, 2)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: [{ text: userContent }] }],
          generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
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

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found in response");

    const updatedItems = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ items: updatedItems });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
