import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createLead } from "@/lib/db";
import fs from "fs";
import path from "path";

function getApiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/GEMINI_API_KEY=(.+)/);
      if (match && match[1]) return match[1].trim();
    }
  } catch (e) {}
  return "";
}

// Helper: Get lat/lng coordinates for any location in India
async function getCoordinatesForLocation(location: string): Promise<{ lat: string; lng: string }> {
  try {
    const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location + ", India")}&format=json&limit=1`;
    const res = await fetch(geoUrl, {
      headers: { "User-Agent": "EthersDashboard/1.0" },
    });
    if (res.ok) {
      const geoData = await res.json();
      if (geoData && geoData.length > 0 && geoData[0].lat && geoData[0].lon) {
        return { lat: geoData[0].lat, lng: geoData[0].lon };
      }
    }
  } catch (e) {
    console.warn("Geocoding failed, using fallback coordinates:", e);
  }
  // Default fallback: Jamshedpur coordinates
  return { lat: "22.7796", lng: "86.1734" };
}

// Helper: Fetch REAL listed outlets from Swiggy DAPI
async function fetchRealSwiggyOutlets(location: string, category: string, count: number): Promise<Array<{ name: string; area: string }>> {
  try {
    const { lat, lng } = await getCoordinatesForLocation(location);
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://www.swiggy.com/",
      "Accept": "application/json, text/plain, */*",
    };

    const searchUrl = `https://www.swiggy.com/dapi/restaurants/search/v3?lat=${lat}&lng=${lng}&str=${encodeURIComponent(category)}&trackingId=undefined&submitAction=ENTER`;
    const res = await fetch(searchUrl, { headers });
    
    const outlets: Array<{ name: string; area: string }> = [];
    const excludedChains = ["kfc", "domino", "mcdonald", "burger king", "pizza hut", "subway", "starbucks", "haldiram"];

    if (res.ok) {
      const data = await res.json();
      const cards = data.get?.cards || data.data?.cards || [];
      
      const walk = (obj: any) => {
        if (!obj || typeof obj !== "object") return;
        if (obj.name && typeof obj.name === "string" && (obj.cuisines || obj.avgRating || obj.sla || obj.costForTwo)) {
          const name = obj.name.trim();
          const area = (obj.locality || obj.areaName || location).trim();
          const lowerName = name.toLowerCase();
          const isChain = excludedChains.some((c) => lowerName.includes(c));
          
          if (!isChain && name.length > 2 && !outlets.some((o) => o.name.toLowerCase() === lowerName)) {
            outlets.push({ name, area });
          }
        }
        if (Array.isArray(obj)) {
          for (const item of obj) walk(item);
        } else {
          for (const key of Object.keys(obj)) walk(obj[key]);
        }
      };

      walk(cards);
    }

    // Fallback to general list DAPI if search returned few results
    if (outlets.length < count) {
      const listUrl = `https://www.swiggy.com/dapi/restaurants/list/v5?lat=${lat}&lng=${lng}&is-seo-homepage-enabled=true&page_type=DESKTOP_WEB_LISTING`;
      const listRes = await fetch(listUrl, { headers });
      if (listRes.ok) {
        const listData = await listRes.json();
        const cards = listData.data?.cards || [];
        for (const c of cards) {
          const grid = c.card?.card?.gridElements?.infoWithStyle?.restaurants || [];
          for (const rItem of grid) {
            const info = rItem.info || {};
            if (info.name) {
              const name = info.name.trim();
              const area = (info.locality || info.areaName || location).trim();
              const lowerName = name.toLowerCase();
              const isChain = excludedChains.some((ch) => lowerName.includes(ch));
              if (!isChain && name.length > 2 && !outlets.some((o) => o.name.toLowerCase() === lowerName)) {
                outlets.push({ name, area });
              }
            }
          }
        }
      }
    }

    return outlets.slice(0, count * 2);
  } catch (err) {
    console.warn("Swiggy DAPI fetch failed, falling back to direct AI:", err);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured in .env" }, { status: 500 });
    }

    const body = await req.json();
    const location = (body.location || "Jamshedpur").trim();
    const category = (body.category || "Restaurant").trim();
    const count = Math.min(Math.max(Number(body.count) || 10, 1), 10);

    // Step 1: Fetch REAL listed outlets from Swiggy DAPI
    const realOutlets = await fetchRealSwiggyOutlets(location, category, count);

    let prompt = "";

    if (realOutlets.length > 0) {
      const realListStr = realOutlets
        .map((o, idx) => `${idx + 1}. ${o.name} (Locality: ${o.area})`)
        .join("\n");

      prompt = `You are a B2B lead discovery assistant for food & beverage outlets in India.
Below is a verified list of REAL independent ${category} outlets currently listed and active on Swiggy in/near "${location}":

${realListStr}

TASK:
Pick up to ${count} outlets strictly from the real list above. For each real outlet:
1. "brandName": Exact brand name as given in the list.
2. "poc": Owner/Manager Name (use 'Store Manager' if specific name is unknown).
3. "ownerPhone": Provide a realistic 10-digit Indian phone number starting with 9, 8, or 7.
4. "address": Neighborhood address incorporating the locality provided.
5. "comments": Specify cuisine specialty and key highlight.

Return ONLY a raw JSON array of objects following this exact structure:
[
  {
    "brandName": "Exact Real Outlet Name",
    "poc": "Owner/Manager Name",
    "ownerPhone": "9835XXXXXX",
    "address": "Short neighborhood address",
    "comments": "Cuisine type & key highlight"
  }
]`;
    } else {
      // Fallback prompt if DAPI fails
      prompt = `You are a B2B lead discovery assistant for food & beverage outlets in India.
Generate up to ${count} real independent local ${category}s operating in or near "${location}".

STRICT CONSTRAINTS:
1. EXCLUDE national/international chain brands (e.g. KFC, Domino's, McDonald's, Burger King, Pizza Hut, Subway, Starbucks, Haldiram's).
2. Focus strictly on independent, local ${category} outlets in ${location}.
3. Provide details: brandName, owner/POC name (use 'Store Manager' if unknown), a valid 10-digit Indian phone number starting with 9, 8, or 7, short neighborhood address, and estimated monthly contract value in INR.
4. In the comments field, mention the cuisine type and what the restaurant is known for.

Return ONLY a raw JSON array of objects following this exact structure:
[
  {
    "brandName": "Outlet Name",
    "poc": "Owner/Manager Name",
    "ownerPhone": "9835XXXXXX",
    "address": "Short neighborhood address",
    "comments": "Cuisine type & what they are known for"
  }
]`;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("No response output received from Gemini API");

    let rawLeads: any[] = [];
    try {
      rawLeads = JSON.parse(text);
    } catch (parseErr) {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        rawLeads = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse JSON array from Gemini output");
      }
    }

    if (!Array.isArray(rawLeads)) {
      return NextResponse.json({ error: "Invalid response format from AI" }, { status: 500 });
    }

    // Save generated leads to database
    const createdLeads = rawLeads.slice(0, count).map((item) => {
      return createLead({
        brandName: item.brandName || `${category} Lead`,
        poc: item.poc || "Owner/Manager",
        ownerPhone: item.ownerPhone || "9835100000",
        comments: item.comments || `Discovered in ${location}`,
        location: item.address ? `${item.address}, ${location}` : location,
        category: category,
        status: "In Talks",
        followUp1: "Pending",
        followUp2: "Pending",
        followUp3: "Pending",
        estimatedValue: Math.floor(Math.random() * 30000) + 30000,
        assignedTo: "Unassigned"
      });
    });

    return NextResponse.json({ success: true, leads: createdLeads });
  } catch (error: any) {
    console.error("Lead Generation Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate AI leads" }, { status: 500 });
  }
}
