import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No output from Gemini");

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found in response");

    const groupedItems = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ items: groupedItems });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
