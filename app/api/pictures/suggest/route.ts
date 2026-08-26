import { NextRequest, NextResponse } from "next/server";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
];

async function fetchSwiggyDishImages(itemName: string, count = 6): Promise<string[]> {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const headers = {
    "User-Agent": ua,
    "Referer": "https://www.swiggy.com/",
    "Accept": "application/json, text/plain, */*",
  };

  const lat = "22.804566";
  const lng = "86.202875";
  const url = `https://www.swiggy.com/dapi/restaurants/search/v3?lat=${lat}&lng=${lng}&str=${encodeURIComponent(itemName.trim())}&trackingId=undefined&submitAction=ENTER`;

  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return [];
    const jsonText = await res.text();

    const imageIds = [...jsonText.matchAll(/"(?:imageId|cloudinaryImageId)":"([^"]+)"/g)].map(m => m[1]);
    const validImages: string[] = [];
    const seen = new Set<string>();

    for (const imgId of imageIds) {
      if (validImages.length >= count) break;
      const lower = imgId.toLowerCase();
      if (seen.has(imgId) || ["logo", "rating", "icon", "v15744", "v1574", "badge", "banner"].some(bad => lower.includes(bad))) {
        continue;
      }
      seen.add(imgId);
      const cdnUrl = `https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_660/${imgId}`;
      validImages.push(cdnUrl);
    }
    return validImages;
  } catch (err) {
    console.error("Swiggy image search error:", err);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { itemName } = await req.json();
    if (!itemName) {
      return NextResponse.json({ error: "Item name is required." }, { status: 400 });
    }

    // Pure Swiggy Food CDN Engine Only
    const images = await fetchSwiggyDishImages(itemName, 6);
    return NextResponse.json({ images, source: "swiggy_cdn_engine" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not fetch image suggestions." }, { status: 500 });
  }
}
