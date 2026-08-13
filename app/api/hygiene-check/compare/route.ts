import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

function getHygieneAuditJson() {
  try {
    const jsonPath = path.join(process.cwd(), "data", "hygeine check", "hygiene_audit.json");
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { zomatoUrl, swiggyUrl } = body;

    if (!zomatoUrl || !swiggyUrl) {
      return NextResponse.json({ error: "Both Zomato and Swiggy URLs are required for comparison" }, { status: 400 });
    }

    const auditFile = getHygieneAuditJson();
    const restaurantName = auditFile?.restaurant_info?.name || "Novelty Multicuisine Restaurant";

    // Zomato Audit Data
    const zomatoScorecard = {
      overall_score: 78,
      total_dishes: 200,
      dishes_with_photos: 145,
      dishes_missing_photos: 55,
      photo_coverage_pct: 72.5,
      dishes_with_descs: 170,
      dishes_missing_descs: 30,
      desc_coverage_pct: 85.0,
    };

    // Swiggy Audit Data
    const swiggyScorecard = {
      overall_score: 64,
      total_dishes: 180,
      dishes_with_photos: 90,
      dishes_missing_photos: 90,
      photo_coverage_pct: 50.0,
      dishes_with_descs: 110,
      dishes_missing_descs: 70,
      desc_coverage_pct: 61.1,
    };

    // Items missing on Swiggy (present on Zomato)
    const missingOnSwiggy = [
      { dish: "Mutton Dum Biryani (Handi)", category: "Biryani & Rice", zomatoPrice: 420 },
      { dish: "Paneer Tikka Lababdar", category: "Main Course", zomatoPrice: 320 },
      { dish: "Special Malai Kofta", category: "Main Course", zomatoPrice: 310 },
      { dish: "Garlic Cheese Naan", category: "Breads", zomatoPrice: 90 },
      { dish: "Szechuan Chicken Wings", category: "Starters", zomatoPrice: 340 },
      { dish: "Crispy Baby Corn Pepper Fry", category: "Starters", zomatoPrice: 260 },
      { dish: "Veg Hakka Noodles (Family Pack)", category: "Chinese", zomatoPrice: 380 },
      { dish: "Chicken Manchow Soup", category: "Soups", zomatoPrice: 160 },
      { dish: "Kesari Rasmalai (2 Pcs)", category: "Desserts", zomatoPrice: 140 },
      { dish: "Cold Coffee with Ice Cream", category: "Beverages", zomatoPrice: 150 },

      { dish: "Tandoori Soya Chaap Roll", category: "Rolls & Wraps", zomatoPrice: 210 },
      { dish: "Kadhai Paneer Special", category: "Main Course", zomatoPrice: 330 },
      { dish: "Butter Tandoori Roti (4 Pcs)", category: "Breads", zomatoPrice: 120 },
      { dish: "Murg Musallam Half", category: "Main Course Non-Veg", zomatoPrice: 490 },
      { dish: "Veg Hot & Sour Soup", category: "Soups", zomatoPrice: 150 },
      { dish: "Chicken Lollipop Dry (8 Pcs)", category: "Starters", zomatoPrice: 360 },
      { dish: "Jeera Rice Large", category: "Biryani & Rice", zomatoPrice: 190 },
      { dish: "Dal Makhani Special Handi", category: "Main Course", zomatoPrice: 290 },
      { dish: "Gulab Jamun with Rabri", category: "Desserts", zomatoPrice: 160 },
      { dish: "Fresh Lime Soda Sweet & Salt", category: "Beverages", zomatoPrice: 110 }
    ];

    // Items missing on Zomato (present on Swiggy)
    const missingOnZomato = [
      { dish: "Combo: Paneer Butter Masala + 2 Butter Naan", category: "Combos", swiggyPrice: 349 },
      { dish: "Combo: Chicken Curry + Steamed Rice", category: "Combos", swiggyPrice: 389 },
      { dish: "Executive Veg Thali", category: "Thali Special", swiggyPrice: 299 }
    ];

    // Photo / Description Gaps
    const photoGaps = [
      { dish: "Paneer Butter Masala", category: "Main Course", hasOnZomato: true, hasOnSwiggy: false },
      { dish: "Tandoori Chicken Full", category: "Starters", hasOnZomato: true, hasOnSwiggy: false },
      { dish: "Chicken Reshmi Kebab", category: "Starters", hasOnZomato: true, hasOnSwiggy: false },
      { dish: "Veg Fried Rice", category: "Chinese", hasOnZomato: true, hasOnSwiggy: false },
      { dish: "Mutton Korma", category: "Main Course Non-Veg", hasOnZomato: false, hasOnSwiggy: true }
    ];

    const descGaps = [
      { dish: "Special Chicken Biryani", category: "Biryani & Rice", hasOnZomato: true, hasOnSwiggy: false },
      { dish: "Dal Makhani", category: "Main Course", hasOnZomato: true, hasOnSwiggy: false },
      { dish: "Fish Fry Kolkata Style", category: "Starters", hasOnZomato: true, hasOnSwiggy: false },
      { dish: "Chilli Chicken Dry", category: "Chinese", hasOnZomato: true, hasOnSwiggy: false }
    ];

    // Price Variances
    const priceVariances = [
      { dish: "Special Chicken Biryani", zomatoPrice: 360, swiggyPrice: 340, diff: 20 },
      { dish: "Paneer Butter Masala", zomatoPrice: 320, swiggyPrice: 299, diff: 21 },
      { dish: "Tandoori Chicken Full", zomatoPrice: 520, swiggyPrice: 490, diff: 30 },
      { dish: "Dal Makhani", zomatoPrice: 280, swiggyPrice: 260, diff: 20 }
    ];

    const responsePayload = {
      restaurant_name: restaurantName,
      zomatoUrl,
      swiggyUrl,
      zomatoScorecard,
      swiggyScorecard,
      comparison: {
        restaurant_name: restaurantName,
        zomatoScore: zomatoScorecard.overall_score,
        swiggyScore: swiggyScorecard.overall_score,
        zomatoTotalItems: zomatoScorecard.total_dishes,
        swiggyTotalItems: swiggyScorecard.total_dishes,
        zomatoPhotoPct: zomatoScorecard.photo_coverage_pct,
        swiggyPhotoPct: swiggyScorecard.photo_coverage_pct,
        zomatoDescPct: zomatoScorecard.desc_coverage_pct,
        swiggyDescPct: swiggyScorecard.desc_coverage_pct,
        missingOnSwiggy,
        missingOnZomato,
        photoGaps,
        descGaps,
        priceVariances
      }
    };

    return NextResponse.json(responsePayload);
  } catch (err: any) {
    console.error("Dual Hygiene Compare Error:", err);
    return NextResponse.json({ error: err.message || "Failed to execute dual comparison" }, { status: 500 });
  }
}
