import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/db";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const PRICING_SERVER_URL = "http://127.0.0.1:8002";

async function isPortAlive(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`${url}/api/pricing/discover`, {
      method: "OPTIONS",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.status < 500;
  } catch {
    return false;
  }
}

async function ensurePricingServerRunning() {
  if (await isPortAlive(PRICING_SERVER_URL)) return;
  try {
    const cwd = path.join(process.cwd(), "data", "pricing strategy");
    const child = spawn("python", ["pricing_server.py"], {
      cwd,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    console.log("[PricingStrategy] Auto-spawned pricing_server.py on port 8002");
    // Wait briefly for server startup
    await new Promise((r) => setTimeout(r, 1500));
  } catch (e) {
    console.error("[PricingStrategy] Failed to spawn pricing_server.py:", e);
  }
}

// ─── Price Ending Helper ─────────────────────────────────────────────────────
function applyPriceEnding(price: number, strategy: "9_7_5" | "round" | "none"): number {
  if (strategy !== "9_7_5" || price <= 10) return Math.round(price);
  const r = Math.round(price);
  const last = r % 10;
  if ([9, 7, 5].includes(last)) return r;
  if (last === 8) return r + 1;
  if (last === 6) return r + 1;
  if (last === 4) return r + 1;
  if (last === 3) return r + 2;
  if (last === 2) return r + 3;
  if (last === 1) return r - 2;
  return r - 1; // 0 → 9
}

// ─── Gemini Key ──────────────────────────────────────────────────────────────
function getGeminiKey(): string {
  let key = process.env.GEMINI_API_KEY || "";
  if (!key) {
    try {
      const envPath = path.join(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const m = fs.readFileSync(envPath, "utf-8").match(/GEMINI_API_KEY=(.+)/);
        if (m) key = m[1].trim();
      }
    } catch {}
  }
  return key;
}

// ─── Step 1: Discover competitors from Swiggy (auto mode) ────────────────────
async function discoverCompetitorsFromSwiggy(
  area: string,
  city: string,
  count: number
): Promise<{ name: string; url: string }[]> {
  try {
    const res = await fetch(`${PRICING_SERVER_URL}/api/pricing/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: area, city, count }),
      signal: AbortSignal.timeout(120_000) // 2 min for Playwright
    });
    if (res.ok) {
      const data = await res.json();
      if (data.restaurants && data.restaurants.length > 0) {
        return data.restaurants;
      }
    }
  } catch (e) {
    console.warn("[Discover] Python server error:", e);
  }
  return [];
}

// ─── Step 2: Scrape real prices from Swiggy for each competitor ───────────────
async function scrapeCompetitorPrices(
  competitors: { name: string; isManual: boolean }[],
  area: string,
  city: string,
  itemNames: string[],
  jobId: string = "default"
): Promise<{ results: any[]; summary: any } | null> {
  try {
    const res = await fetch(`${PRICING_SERVER_URL}/api/pricing/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitors,
        location: area,
        city,
        items: itemNames,
        jobId
      }),
      signal: AbortSignal.timeout(10_000)
    });
    if (res.ok) {
      const initData = await res.json();
      const targetJobId = initData.jobId || jobId;

      // Poll python progress endpoint until completed
      const startTime = Date.now();
      while (Date.now() - startTime < 600_000) {
        await new Promise((r) => setTimeout(r, 500));
        try {
          const pollRes = await fetch(`${PRICING_SERVER_URL}/api/pricing/progress?jobId=${encodeURIComponent(targetJobId)}`, {
            cache: "no-store"
          });
          if (pollRes.ok) {
            const pollData = await pollRes.json();
            if (pollData.status === "COMPLETED") {
              return {
                results: pollData.results || [],
                summary: pollData.summary || null
              };
            } else if (pollData.status === "FAILED") {
              console.error("[Scrape] Python background job failed:", pollData.error);
              return null;
            }
          }
        } catch (e) {
          // Retry poll
        }
      }
    }
  } catch (e) {
    console.warn("[Scrape] Python server error:", e);
  }
  return null;
}

// ─── Step 3: Gemini calculates suggestivePrice ONLY ──────────────────────────
async function calcSuggestivePrice(
  apiKey: string, // Kept for signature compatibility, though unused now
  itemName: string,
  myPrice: number,
  compPrices: number[],
  priceEnding: "9_7_5" | "round" | "none",
  discountPct: number,
  commissionPct: number,
  adsPct: number,
  foodCostPct: number,
  customPrompt: string
): Promise<number> {
  const totalDeductionsPct = (commissionPct + adsPct + discountPct) / 100;

  if (compPrices.length === 0) {
    // No competitor data — pure cost-based markup
    // Ensure price covers deductions based on myPrice
    const raw = myPrice * (1 + totalDeductionsPct);
    return applyPriceEnding(raw, priceEnding);
  }

  const avg = compPrices.reduce((a, b) => a + b, 0) / compPrices.length;
  const min = Math.min(...compPrices);
  const max = Math.max(...compPrices);

  // Pure Math Formula for Suggestive Price:
  
  // 1. Cost-based target: markup the base price to cover platform deductions
  const costBasedPrice = myPrice * (1 + totalDeductionsPct);
  
  // 2. Market-based target: be slightly aggressive (5% cheaper than average)
  const marketBasedPrice = avg * 0.95; 

  // 3. Blend them: 50% weight to our costs, 50% weight to market average
  let suggestiveRaw = (costBasedPrice + marketBasedPrice) / 2;
  
  // 4. Profitability Guardrails:
  // Never go below our base price + a minimal 10% platform padding
  const minAcceptablePrice = myPrice * 1.1; 
  if (suggestiveRaw < minAcceptablePrice) {
    suggestiveRaw = minAcceptablePrice;
  }
  
  // Never price absurdly higher than the market max (cap at 20% above max)
  if (suggestiveRaw > max * 1.2) {
    suggestiveRaw = max * 1.2;
  }

  return applyPriceEnding(suggestiveRaw, priceEnding);
}

// ─── Ethers AI Competitor Name & Price Generator ────────────────────────────
async function generateEthersAiCompetitors(
  apiKey: string,
  searchLocation: string,
  items: { itemName: string; basePrice: number }[],
  competitorCount: number
): Promise<Record<string, { name: string; price: number }[]>> {
  if (!apiKey) return {};
  try {
    const prompt = `You are an expert food market pricing analyst for food delivery platforms in India.
Location: ${searchLocation}
Target Items: ${JSON.stringify(items)}
Number of competitor restaurants per item: ${competitorCount}

Task: For each item in Target Items, identify ${competitorCount} real or highly realistic top popular competitor restaurants / food outlets in or near ${searchLocation} that serve this dish or category, with realistic estimated menu prices on Swiggy/Zomato.

Respond ONLY in valid JSON format with a top-level key "results":
{
  "results": [
    {
      "itemName": "Dal Makhani",
      "competitors": [
        { "name": "Dubeys Hotel & Restaurant", "price": 135 },
        { "name": "Novelty Restaurant", "price": 155 }
      ]
    }
  ]
}`;

    const bynaraKey = process.env.BYNARA_API_KEY || "sk-nry-lbhVNWZjFpsa3qktj6MS6SH1kq6hp5rRDdGRP5SgB8c";
    let responseText = "";

    try {
      const res = await fetch("https://router.bynara.id/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${bynaraKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "agnes-2.0-flash",
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (res.ok) {
        const data = await res.json();
        responseText = data.choices?.[0]?.message?.content || "";
      }
    } catch (e) {
      console.warn("[Nara Router Ethers AI error]:", e);
    }

    if (responseText) {
      const parsed = JSON.parse(responseText);
      const map: Record<string, { name: string; price: number }[]> = {};
      if (parsed.results && Array.isArray(parsed.results)) {
        for (const item of parsed.results) {
          if (item.itemName && Array.isArray(item.competitors)) {
            map[item.itemName] = item.competitors.map((c: any) => ({
              name: String(c.name || "Competitor AI"),
              price: Math.round(Number(c.price || 100))
            }));
          }
        }
      }
      return map;
    }
  } catch (err) {
    console.warn("[Ethers AI Generation Error]:", err);
  }
  return {};
}

// ─── Main Route ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    await ensurePricingServerRunning();
    const body = await req.json();
    const {
      items,
      location,
      researchMode = "names", // "ethers" (50%), "names" (80%), "links" (100%)
      manualCompetitors = "",
      manualCompetitorLinks = "",
      competitorCount: rawCompetitorCount = 4,
      priceEnding = "9_7_5",
      customPrompt = "",
      discountPct = 10,
      commissionPct = 30,
      adsPct = 5,
      foodCostPct = 30,
      jobId = "default"
    } = body;

    const competitorCount = Math.min(Math.max(Number(rawCompetitorCount) || 4, 1), 5);

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Please provide at least one item." }, { status: 400 });
    }

    const apiKey = getGeminiKey();
    const settings = getSettings();
    const searchLocation = location || settings.city || "Jamshedpur, Jharkhand";

    // Parse "Area, City" → separate area and city
    const parts = searchLocation.split(",").map((s: string) => s.trim());
    const area = parts[0] || "Golmuri";
    const city = parts[1] || "Jamshedpur";

    const itemNames: string[] = items.map((i: any) => i.itemName);

    // ── Mode 2 & Mode 3 & All Modes: Swiggy Scraper + ByNara AI Engine ───
    let competitors: { name: string; isManual: boolean; url?: string }[] = [];

    if (researchMode === "links" && manualCompetitorLinks.trim().length > 0) {
      // Option 3: User gave direct store links → 100% Accuracy
      const links = manualCompetitorLinks
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean)
        .slice(0, competitorCount);

      competitors = links.map((linkUrl: string, i: number) => {
        let name = `Store ${i + 1}`;
        try {
          const urlObj = new URL(linkUrl);
          const parts = urlObj.pathname.split("/").filter(Boolean);
          if (parts.length > 0) {
            const lastSegment = parts[parts.length - 1].replace(/-?rest\d+/i, "");
            if (lastSegment) {
              const words = lastSegment.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1));
              // Extract clean short brand name (max 3 words, removing city/area fluff)
              const cleanWords = words.filter(w => !["North", "South", "East", "West", "Twenty", "Four", "Parganas", "Salt", "Lake", "Kolkata", "Jamshedpur", "Inside", "Ac", "Market", "Salkia", "Bhawanipur"].includes(w));
              name = (cleanWords.length > 0 ? cleanWords : words).slice(0, 3).join(" ");
            }
          }
        } catch {}
        return { name, isManual: true, url: linkUrl };
      });
    } else if (manualCompetitors.trim().length > 0) {
      // Option 2: User gave brand names → 80% Accuracy
      competitors = manualCompetitors
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean)
        .slice(0, competitorCount)
        .map((name: string) => ({ name, isManual: true }));
    } else {
      // Auto discover mode
      const discovered = await discoverCompetitorsFromSwiggy(area, city, competitorCount);
      competitors = discovered.map(r => ({ name: r.name, isManual: false, url: r.url }));
    }

    if (competitors.length === 0) {
      return NextResponse.json({
        error: "Could not find any competitors. Please enter competitor names or links manually."
      }, { status: 422 });
    }

    // ── Step 2: Scrape real prices from Swiggy ────────────────────────────
    const scraperData = await scrapeCompetitorPrices(
      competitors.map(c => ({ name: c.name, isManual: c.isManual, url: c.url })),
      area,
      city,
      itemNames,
      jobId
    );
    const scraperResults = scraperData?.results || [];

    // Build lookup: itemName → [{compIndex, name, matchedDishName, price, url}]
    const priceMatrix: Record<string, { compIndex: number; name: string; matchedDishName: string; price: number | null; url?: string }[]> = {};
    for (const name of itemNames) priceMatrix[name] = [];

    if (scraperResults && Array.isArray(scraperResults)) {
      scraperResults.forEach((comp: any, compIdx: number) => {
        (comp.items || []).forEach((matched: any) => {
          if (matched.userItem) {
            if (!priceMatrix[matched.userItem]) {
              priceMatrix[matched.userItem] = [];
            }
            priceMatrix[matched.userItem].push({
              compIndex: compIdx,
              name: comp.competitorName,
              matchedDishName: matched.matchedName || matched.userItem,
              price: matched.price,
              url: comp.swiggyUrl
            });
          }
        });
      });
    }

    // ── Step 3: Build results + ask Gemini ONLY for suggestivePrice ────────
    const results = await Promise.all(
      items.map(async (item: any) => {
        const itemName: string = item.itemName;
        const myPrice: number = Number(item.basePrice || 100);

        const compEntries = priceMatrix[itemName] || [];

        // Build final competitors array — matched by exact competitor index order
        const compList = competitors.map((comp, idx) => {
          // 1. Try matching by exact competitor index
          let found = compEntries.find(e => e.compIndex === idx);

          // 2. Try URL match fallback
          if (!found) {
            found = compEntries.find(e => comp.url && e.url && e.url.toLowerCase().trim().replace(/\/$/, '') === (e.url || "").toLowerCase().trim().replace(/\/$/, ''));
          }

          // 3. Try Name match fallback
          if (!found) {
            found = compEntries.find(e => {
              const eName = (e.name || "").toLowerCase();
              const cName = (comp.name || "").toLowerCase();
              return eName.includes(cName) || cName.includes(eName);
            });
          }

          const cellDishName = found?.matchedDishName || comp.name || `Competitor ${idx + 1}`;
          const displayUrl = comp.url || found?.url;

          if (found && found.price !== null && Number(found.price) > 0) {
            return {
              name: cellDishName,
              price: Math.round(Number(found.price)),
              url: displayUrl,
              realData: true
            };
          }
          return {
            name: cellDishName,
            price: 0,
            url: displayUrl,
            realData: false
          };
        });

        // Only pass real prices to Gemini
        const realPrices = compList
          .filter(c => c.realData && c.price !== null)
          .map(c => c.price as number);

        const suggestivePrice = await calcSuggestivePrice(
          apiKey,
          itemName,
          myPrice,
          realPrices,
          priceEnding,
          discountPct,
          commissionPct,
          adsPct,
          foodCostPct,
          customPrompt
        );

        return {
          itemName,
          myBrandPrice: myPrice,
          competitors: compList.map(c => ({
            name: c.name,
            price: c.price, // real price or null if not available
            url: c.url,
            realData: c.realData
          })),
          suggestivePrice,
          accuracyMode: researchMode === "links" ? "100%" : researchMode === "names" ? "80%" : "50%",
          source: scraperResults ? "scraper" : "fallback"
        };
      })
    );

    const fetchedLinks = (scraperResults || []).map((comp: any, idx: number) => {
      const fallbackName = competitors[idx]?.name || `Store ${idx + 1}`;
      const name = (comp.competitorName && comp.competitorName !== "Unknown Restaurant") ? comp.competitorName : fallbackName;
      return {
        competitorName: name,
        swiggyUrl: comp.swiggyUrl || null,
        found: comp.found || false
      };
    });

    const matchingSummary = scraperData?.summary || {
      totalItems: items.length,
      localMatches: 0,
      aiMatches: 0,
      notAvailable: 0
    };

    return NextResponse.json({
      success: true,
      location: searchLocation,
      competitorCount,
      fetchedLinks,
      matchingSummary,
      results
    });

  } catch (error: any) {
    console.error("[PricingStrategy] Fatal:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process pricing strategy" },
      { status: 500 }
    );
  }
}
