import { NextResponse } from "next/server";
import { getMenuItems, getSettings, getLastReport } from "@/lib/db";

async function getWeather(city: string) {
  try {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
    ).then((r) => r.json());
    const loc = geo?.results?.[0];
    if (!loc) return null;
    const weather = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true`
    ).then((r) => r.json());
    return weather?.current_weather ?? null;
  } catch {
    return null;
  }
}

function getFallbackRecommendations(settings: any, dayOfWeek: string, weather: any) {
  const recs = [
    {
      title: `${dayOfWeek} Special Offer`,
      detail: `Create a limited-time combo deal for your top-selling items. Promote on WhatsApp and Instagram stories to drive foot traffic.`,
    },
    {
      title: "Social Media Push",
      detail: "Post behind-the-scenes kitchen videos or customer testimonials. Visual content gets 3x more engagement than text posts.",
    },
    {
      title: "Delivery Platform Optimization",
      detail: "Update your Zomato/Swiggy banners with seasonal themes. Bright, appetizing photos increase click-through by 25%.",
    },
  ];

  if (weather) {
    const temp = weather.temperature;
    if (temp > 35) {
      recs.push({ title: "Beat the Heat", detail: `It's ${temp}°C — promote cold beverages, lassi, and ice cream. Consider a "cool down" discount on drinks.` });
    } else if (temp < 20) {
      recs.push({ title: "Weather Special", detail: `It's ${temp}°C — push hot soups, chai, and comfort food. Warm dishes sell better in cool weather.` });
    }
  }

  return recs;
}

function hasValidGeminiKey() {
  const key = process.env.GEMINI_API_KEY;
  return key && key.startsWith("AIza");
}

export async function POST() {
  try {
    const settings = getSettings();
    const menu = getMenuItems();
    const lastReport = getLastReport();
    const weather = await getWeather(settings.city);
    const dayOfWeek = new Date().toLocaleDateString("en-IN", { weekday: "long" });

    if (hasValidGeminiKey()) {
      try {
        const { callGeminiJSON } = await import("@/lib/ai/gemini");
        const prompt = `You are a marketing strategist for an Indian restaurant.
Context:
- Restaurant: ${settings.restaurantName}, ${settings.city}
- Day of week: ${dayOfWeek}
- Current weather: ${weather ? JSON.stringify(weather) : "unavailable"}
- Menu highlights: ${JSON.stringify(menu.slice(0, 30).map((m) => m.name))}
- Latest sales insights (if any): ${JSON.stringify(lastReport)}

Give 2-4 concrete, actionable marketing recommendations for today/this week.
Style example: "Sunday evening — push Biryani ads, expect ~20% higher conversion."
Respond ONLY with JSON: {"recommendations": [{"title": string, "detail": string}]}`;

        const result = await callGeminiJSON<{ recommendations: { title: string; detail: string }[] }>(prompt);
        return NextResponse.json({ recommendations: result.recommendations, weather, dayOfWeek });
      } catch {
        // Fall through to fallback
      }
    }

    const recommendations = getFallbackRecommendations(settings, dayOfWeek, weather);
    return NextResponse.json({ recommendations, weather, dayOfWeek, source: "fallback" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not generate recommendations." }, { status: 500 });
  }
}
