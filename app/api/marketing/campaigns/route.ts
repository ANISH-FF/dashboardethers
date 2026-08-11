import { NextRequest, NextResponse } from "next/server";
import { getCampaigns, addCampaign, updateCampaignStatus } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ campaigns: getCampaigns() });
}

export async function POST(req: NextRequest) {
  try {
    const { title, date } = await req.json();
    if (!title || !date) {
      return NextResponse.json({ error: "Title and date are required." }, { status: 400 });
    }
    const campaign = addCampaign(title, date);
    return NextResponse.json({ campaign });
  } catch {
    return NextResponse.json({ error: "Could not save campaign." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    const campaign = updateCampaignStatus(id, status);
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    return NextResponse.json({ campaign });
  } catch {
    return NextResponse.json({ error: "Could not update campaign." }, { status: 500 });
  }
}
