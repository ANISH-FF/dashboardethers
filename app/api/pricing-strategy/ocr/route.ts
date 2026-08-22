import { NextRequest, NextResponse } from "next/server";

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Please upload at least 1 menu image." }, { status: 400 });
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    const b64List: string[] = [];
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      b64List.push(Buffer.from(bytes).toString("base64"));
    }

    const parts: any[] = [
      {
        text: `Extract all dish names and their base menu prices from these menu image(s)/document(s).
Respond ONLY in JSON format with an "items" array:
{
  "items": [
    { "itemName": "String", "basePrice": number }
  ]
}
Rules:
- "itemName": exact dish/menu item name.
- "basePrice": menu price as a number.
- Do NOT output any extra commentary or markdown codeblocks outside the raw JSON.`
      }
    ];

    for (const b64 of b64List) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: b64,
        },
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) throw new Error("Could not parse menu items from image.");
    const parsed = JSON.parse(jsonMatch[0]);

    const items = (parsed.items || []).map((i: any) => ({
      itemName: String(i.itemName || "Item"),
      basePrice: Number(i.basePrice || 100),
    }));

    return NextResponse.json({ success: true, items });
  } catch (err: any) {
    console.error("[Menu OCR Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to scan menu image." }, { status: 500 });
  }
}
