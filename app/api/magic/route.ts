import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { items, prompt } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    const rawItems = Array.isArray(items) ? items : [];
    if (rawItems.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Lean payload compression: Strip nulls, empty strings, internal metadata & pretty-print whitespace
    const compactItems = rawItems.map((i: any) => {
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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("No output from Gemini");

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found in response");

    const updatedCompactItems: any[] = JSON.parse(jsonMatch[0]);
    const updatedMap = new Map(updatedCompactItems.map((u) => [u.id, u]));

    // Re-merge AI modifications into full original items to preserve all properties (imageUrl, createdAt, etc.)
    const finalItems = rawItems
      .filter((orig) => updatedMap.has(orig.id)) // Handles item deletions
      .map((orig) => {
        const mod = updatedMap.get(orig.id);
        return {
          ...orig,
          ...mod,
        };
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
