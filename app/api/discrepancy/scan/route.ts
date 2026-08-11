import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getMenuItems, getSettings, saveDiscrepancies, type DiscrepancyRecord } from "@/lib/db";
import { callGeminiJSON } from "@/lib/ai/gemini";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const items = getMenuItems();
    const settings = getSettings();
    const records: DiscrepancyRecord[] = [];
    const now = new Date().toISOString();

    // --- Internal check: no AI needed, just scan our own data -------------
    for (const item of items) {
      if (!item.imageUrl) {
        records.push({ id: uuid(), itemName: item.name, issueType: "Missing image", source: "Internal", detail: "No photo set for this item.", createdAt: now });
      }
      if (!item.description) {
        records.push({ id: uuid(), itemName: item.name, issueType: "Missing description", source: "Internal", detail: "No description set for this item.", createdAt: now });
      }
      if (!item.category || item.category === "Uncategorized") {
        records.push({ id: uuid(), itemName: item.name, issueType: "Missing category", source: "Internal", detail: "Item has no proper category.", createdAt: now });
      }
    }

    // --- External check: only if a public listing URL is set --------------
    const listingUrl = settings.zomatoUrl || settings.swiggyUrl;
    const source: "Zomato" | "Swiggy" = settings.zomatoUrl ? "Zomato" : "Swiggy";

    if (listingUrl) {
      try {
        const prompt = `Using web search, look at this public restaurant listing page: ${listingUrl}
Read what's visible: menu items (name, whether it has a photo, whether it has a
description) and the store's current rating out of 5. Compare against our internal
menu item names: ${JSON.stringify(items.map((i) => i.name))}

Respond ONLY with JSON:
{
  "rating": number | null,
  "mismatches": [{"itemName": string, "issue": string}]
}
"mismatches" should flag items that are missing a photo/description on the live
listing, or that exist on the listing but not internally (or vice versa). If you
cannot access the page, return an empty mismatches array and rating: null.`;

        const result = await callGeminiJSON<{ rating: number | null; mismatches: { itemName: string; issue: string }[] }>(
          prompt,
          { useSearchGrounding: true }
        );

        for (const m of result.mismatches || []) {
          records.push({
            id: uuid(),
            itemName: m.itemName,
            issueType: m.issue,
            source,
            detail: "AI-read from public listing",
            createdAt: now
          });
        }

        if (result.rating != null && settings.lastKnownRating != null && result.rating < settings.lastKnownRating) {
          records.push({
            id: uuid(),
            itemName: settings.restaurantName,
            issueType: `Rating dropped from ${settings.lastKnownRating} to ${result.rating}`,
            source,
            detail: "AI-read from public listing",
            createdAt: now
          });
        }
      } catch {
        records.push({
          id: uuid(),
          itemName: settings.restaurantName,
          issueType: "Could not read the public listing (blocked or unreachable)",
          source,
          detail: "Try again later, or check the URL in Settings.",
          createdAt: now
        });
      }
    }

    saveDiscrepancies(records);
    return NextResponse.json({ records, hasExternalSource: Boolean(listingUrl) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Scan failed." }, { status: 500 });
  }
}
