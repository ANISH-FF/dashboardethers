import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { items, prompt } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    const systemInstruction = `You are a menu data manipulation AI. You will be provided with a JSON array of menu items and a user instruction. 
Your task is to apply the instruction to the items array. 
Return ONLY the modified JSON array. No markdown, no explanations, no wrappers.
If the instruction requires adding a new custom field, you can add it to the 'custom_columns' object for each item.
If the instruction is to delete items, remove them from the array.

Example item structure:
{
  "id": "123",
  "name": "Pizza",
  "category": "Main Course",
  "subcategory": "",
  "description": "",
  "quantity": "1",
  "unit": "Unit",
  "spice_level": "Medium",
  "base_price": 100,
  "online_price": 125,
  "half_price": 75,
  "is_veg": true,
  "variants": false,
  "addons": "",
  "custom_columns": {}
}`;

    const userContent = `Instruction: ${prompt}\n\nItems JSON:\n${JSON.stringify(items, null, 2)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: [{ text: userContent }] }],
          generationConfig: {
            temperature: 0.2,
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

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found in response");

    const updatedItems = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ items: updatedItems });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
