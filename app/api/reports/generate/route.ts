import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { saveLastReport } from "@/lib/db";

function getFallbackInsights(rows: Record<string, any>[]) {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const nameCol = columns.find((c) => /item|name|dish|product/i.test(c)) || columns[0];
  const qtyCol = columns.find((c) => /qty|quantity|sold|count/i.test(c));
  const revCol = columns.find((c) => /revenue|amount|total|sale|price/i.test(c));

  let bestSeller = "N/A";
  let worstSeller = "N/A";
  let totalRevenue = 0;

  if (nameCol && qtyCol) {
    const totals: Record<string, number> = {};
    rows.forEach((r) => {
      const name = r[nameCol] || "Unknown";
      const qty = parseInt(r[qtyCol]) || 0;
      totals[name] = (totals[name] || 0) + qty;
    });
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) bestSeller = sorted[0][0];
    if (sorted.length > 1) worstSeller = sorted[sorted.length - 1][0];
  }

  if (revCol) {
    rows.forEach((r) => {
      totalRevenue += parseFloat(r[revCol]?.replace(/[₹,]/g, "")) || 0;
    });
  }

  return {
    bestSeller,
    worstSeller,
    revenueByPlatform: [
      { platform: "Dine-in (estimated)", revenue: Math.round(totalRevenue * 0.6) || 0 },
      { platform: "Online delivery", revenue: Math.round(totalRevenue * 0.4) || 0 },
    ],
    marginTrend: "Unable to determine without AI analysis",
    dayOverDayChange: "Upload daily data to track changes",
    insights: [
      `Total revenue across ${rows.length} rows: ₹${totalRevenue.toLocaleString("en-IN")}.`,
      `Best seller: ${bestSeller}. Worst seller: ${worstSeller}.`,
      "Add a valid GEMINI_API_KEY to .env for detailed AI-powered insights.",
    ],
  };
}

function hasValidGeminiKey() {
  const key = process.env.GEMINI_API_KEY;
  return key && key.startsWith("AIza");
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Please upload a CSV file." }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json({ error: "Could not read that file. Is it a valid CSV?" }, { status: 400 });
    }

    const rows = (parsed.data as Record<string, any>[]).slice(0, 500);

    if (hasValidGeminiKey()) {
      try {
        const { callGeminiJSON } = await import("@/lib/ai/gemini");
        const prompt = `You are a restaurant data analyst. Analyze this daily sales export
(array of row objects, column names may vary) and return structured JSON with this
exact shape:
{
  "bestSeller": string,
  "worstSeller": string,
  "revenueByPlatform": [{"platform": string, "revenue": number}],
  "marginTrend": string,
  "dayOverDayChange": string,
  "insights": [string, string, string]
}
"insights" should be 2-3 short, plain-language sentences a busy restaurant owner
can act on immediately. If a field truly cannot be determined from the data,
use a sensible placeholder like "Not enough data" rather than omitting the key.

Data:
${JSON.stringify(rows)}`;

        const insights = await callGeminiJSON(prompt);
        saveLastReport(insights);
        return NextResponse.json({ insights, rowCount: rows.length });
      } catch {
        // Fall through to fallback
      }
    }

    const insights = getFallbackInsights(rows);
    saveLastReport(insights);
    return NextResponse.json({ insights, rowCount: rows.length, source: "fallback" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Report generation failed." }, { status: 500 });
  }
}
