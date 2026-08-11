import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ADS_FILE_PATH = path.join(process.cwd(), "data", "custom_dineout_ads.json");

function getCustomDineoutAds(): any[] {
  try {
    if (fs.existsSync(ADS_FILE_PATH)) {
      const fileData = fs.readFileSync(ADS_FILE_PATH, "utf-8");
      return JSON.parse(fileData);
    }
  } catch (err) {
    console.error("Failed to read custom_dineout_ads.json:", err);
  }
  return [];
}

function saveCustomDineoutAds(ads: any[]): any[] {
  const dataDir = path.dirname(ADS_FILE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(ADS_FILE_PATH, JSON.stringify(ads, null, 2), "utf-8");
  return ads;
}

export async function GET() {
  const ads = getCustomDineoutAds();
  return NextResponse.json({ success: true, customAds: ads });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name || !body.platform) {
      return NextResponse.json({ error: "Name and platform are required." }, { status: 400 });
    }

    const current = getCustomDineoutAds();
    const newAd = {
      id: "custom_" + Date.now(),
      platform: body.platform,
      name: body.name,
      pricingModel: body.pricingModel || "Custom Model",
      zoneScope: body.zoneScope || "Standard",
      organicRatio: body.organicRatio || "",
      description: body.description || "",
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    const updated = [newAd, ...current];
    saveCustomDineoutAds(updated);

    return NextResponse.json({ success: true, customAd: newAd, customAds: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save ad product." }, { status: 500 });
  }
}
