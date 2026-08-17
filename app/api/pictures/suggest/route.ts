import { NextRequest, NextResponse } from "next/server";

function getFallbackImages(itemName: string) {
  const slug = itemName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return {
    images: [
      `https://source.unsplash.com/400x300/?${encodeURIComponent(itemName)}-food`,
      `https://source.unsplash.com/400x300/?${encodeURIComponent(itemName)}-dish`,
      `https://source.unsplash.com/400x300/?indian-restaurant-food`,
      `https://source.unsplash.com/400x300/?${slug}-cuisine`,
    ],
    source: "fallback",
    disclaimer: "Stock photo suggestions — add valid GEMINI_API_KEY for real dish photos",
  };
}

function hasValidGeminiKey() {
  const key = process.env.GEMINI_API_KEY;
  return key && key.startsWith("AIza");
}

export async function POST(req: NextRequest) {
  try {
    const { itemName } = await req.json();
    if (!itemName) {
      return NextResponse.json({ error: "Item name is required." }, { status: 400 });
    }

    if (hasValidGeminiKey()) {
      try {
        const { callGeminiJSON } = await import("@/lib/ai/gemini");
        const prompt = `Find 4 publicly accessible, direct image URLs (ending in .jpg, .jpeg, .png,
or .webp) that show the Indian restaurant dish "${itemName}", suitable for a menu photo.
Prefer clean, appetizing, well-lit food photography. Respond ONLY with JSON:
{"images": ["url1", "url2", "url3", "url4"]}
Only include URLs you are reasonably confident actually resolve to an image.`;

        const result = await callGeminiJSON<{ images: string[] }>(prompt);
        return NextResponse.json({ images: result.images || [] });
      } catch {
        // Fall through to fallback
      }
    }

    const fallback = getFallbackImages(itemName);
    return NextResponse.json(fallback);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not fetch image suggestions." }, { status: 500 });
  }
}
