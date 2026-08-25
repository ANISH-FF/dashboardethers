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

    const prompt = `You are a B2B lead discovery assistant for food & beverage outlets in India.
Generate up to ${count} real or realistic independent local ${category}s operating in or near "${location}".

STRICT CONSTRAINTS:
1. EXCLUDE national/international chain brands (e.g. KFC, Domino's, McDonald's, Burger King, Pizza Hut, Subway, Starbucks, Haldiram's).
2. Focus strictly on independent, local ${category} outlets in ${location}.
3. Provide details: brandName, owner/POC name (use 'Store Manager' if unknown), a valid 10-digit Indian phone number starting with 9, 8, or 7, short neighborhood address, and estimated monthly contract value in INR.
4. IMPORTANT: Only include restaurants that have any active presence on Swiggy or Zomato — either online delivery OR Swiggy Dine-In / Zomato Dining (dineout). Exclude restaurants with zero presence on any food aggregator platform.

Return ONLY a raw JSON array of objects following this exact structure:
[
  {
    "brandName": "Outlet Name",
    "poc": "Owner/Manager Name",
    "ownerPhone": "9835XXXXXX",
    "address": "Short neighborhood address",
    "comments": "Specialty or key highlight"
  }
]`;

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
