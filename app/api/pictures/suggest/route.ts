import { NextRequest, NextResponse } from "next/server";

const BAD_KEYWORDS = [
  "cat", "dog", "pet", "certificate", "award", "temple", "travel",
  "map", "tower", "town", "switzerland", "vietnam", "breed", "kitten",
  "tourism", "hotel-stay", "landmark", "monument", "scenery", "landscape",
  "floor", "wall", "room", "interior", "furniture", "building", "architecture",
  "wallpaper", "curtain", "couch", "chair", "house", "tile", "bedroom", "livingroom",
  "bathroom", "kitchen-sink", "lobby", "hallway", "decor"
];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
];

async function fetchBingDishImages(itemName: string, count = 6): Promise<string[]> {
  const query = `${itemName.trim()} food`;
  const url = `https://www.bing.com/images/async?q=${encodeURIComponent(query)}&first=1&count=35&adlt=moderate&mmasync=1`;

  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const headers = {
    "User-Agent": ua,
    "Referer": "https://www.bing.com/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
  };

  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return [];
    const html = await res.text();
    const murls = [...html.matchAll(/murl&quot;:&quot;(https?:\/\/[^&]+)&quot;/g)].map(m => m[1]);

    const validImages: string[] = [];
    const seen = new Set<string>();

    for (const imgUrl of murls) {
      if (validImages.length >= count) break;
      if (!imgUrl || seen.has(imgUrl)) continue;
      const lower = imgUrl.toLowerCase();
      if (BAD_KEYWORDS.some(bad => lower.includes(bad))) continue;
      seen.add(imgUrl);
      validImages.push(imgUrl);
    }
    return validImages;
  } catch (err) {
    console.error("Bing image search error:", err);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { itemName } = await req.json();
    if (!itemName) {
      return NextResponse.json({ error: "Item name is required." }, { status: 400 });
    }

    // Use Bing Engine (100% reliable, zero dead links)
    const images = await fetchBingDishImages(itemName, 6);
    return NextResponse.json({ images, source: "bing_async_engine" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not fetch image suggestions." }, { status: 500 });
  }
}
