import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";

const HYGIENE_SERVER_URL = "http://127.0.0.1:8000";

function extractRestaurantNameFromUrl(swiggyUrl?: string, zomatoUrl?: string): string {
  const targetUrl = swiggyUrl || zomatoUrl || "";
  if (!targetUrl) return "Restaurant Outlet";

  try {
    const cleanUrl = targetUrl.split("?")[0].replace(/\/order|\/menu|\/info/gi, "");
    const parts = cleanUrl.split("/").filter(Boolean);
    const slug = parts[parts.length - 1] || parts[parts.length - 2] || "Restaurant";
    
    // Remove rest ID suffix if Swiggy URL (e.g., -rest256769)
    const sansRest = slug.replace(/-rest\d+$/i, "");
    
    // Format slug into clean Title Case
    const formatted = sansRest
      .split("-")
      .map(w => {
        if (w.toLowerCase() === "e") return "E";
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(" ");

    if (formatted && formatted.length > 2) {
      return formatted;
    }
  } catch (e) {}

  return "Restaurant Outlet";
}

async function isHygieneServerAlive(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`${HYGIENE_SERVER_URL}/api/audit`, {
      method: "OPTIONS",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.status < 500;
  } catch {
    return false;
  }
}

async function ensureHygieneServerRunning() {
  if (await isHygieneServerAlive()) return;
  try {
    const cwd = path.join(process.cwd(), "data", "hygeine check");
    const child = spawn("python", ["server.py"], {
      cwd,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    console.log("[HygieneAudit] Auto-spawned server.py on port 8000");
    await new Promise((r) => setTimeout(r, 1500));
  } catch (e) {
    console.error("[HygieneAudit] Failed to spawn server.py on port 8000:", e);
  }
}

// Smart dish title sanitization & phonetic normalization
function sanitizeDishName(name: string): string {
  if (!name) return "";
  let clean = name.toLowerCase();
  clean = clean.replace(/\[.*?\]|\(.*?\)/g, "");
  clean = clean.replace(/^\d+\s*/g, ""); // strip leading quantity e.g., '1 '
  clean = clean.replace(/\b(serves?\s*\d+|\d+\s*pcs?|\d+\s*pieces?|\d+\s*ml|\d+\s*gms?|half|full)\b/gi, "");
  
  // Phonetic & spelling equivalence replacements
  clean = clean.replace(/\blachha\b|\blacha\b/g, "laccha");
  clean = clean.replace(/\bchilly\b|\bchili\b/g, "chilli");
  clean = clean.replace(/\bbiriyani\b|\bbiryani\b/g, "biryani");
  clean = clean.replace(/\btanduri\b|\btandoori\b/g, "tandoori");
  clean = clean.replace(/\bomlelette\b|\bomlette\b|\bomelet\b/g, "omelette");
  clean = clean.replace(/\bparautha\b|\bparatha\b/g, "paratha");
  clean = clean.replace(/\bpicece\b|\bpiece\b|\bpieces\b/g, "pc");

  return clean.replace(/[^a-z0-9]+/g, "");
}

// Levenshtein edit distance for close fuzzy matches
function editDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function isSimilarDishKey(k1: string, k2: string): boolean {
  if (k1 === k2) return true;
  if (k1.length >= 5 && k2.length >= 5) {
    if (k1.includes(k2) || k2.includes(k1)) return true;
    const maxLen = Math.max(k1.length, k2.length);
    const dist = editDistance(k1, k2);
    if (dist <= 2 && maxLen >= 8) return true;
  }
  return false;
}

export interface DishItem {
  dish: string;
  category: string;
  hasPhoto: boolean;
  hasDesc: boolean;
  price?: number;
}

function extractDishesFromAudit(auditData: any): DishItem[] {
  const map = new Map<string, DishItem>();
  if (!auditData) return [];

  const missingPhotosSet = new Set<string>();
  const missingDescsSet = new Set<string>();

  (auditData.missing_photos_all || []).forEach((item: any) => {
    const dName = typeof item === "string" ? item : item?.dish;
    if (dName) missingPhotosSet.add(dName.trim().toLowerCase());
  });

  (auditData.missing_descs_all || []).forEach((item: any) => {
    const dName = typeof item === "string" ? item : item?.dish;
    if (dName) missingDescsSet.add(dName.trim().toLowerCase());
  });

  // 1. Process structured categories with all_dishes
  (auditData.categories || auditData.categories_summary || []).forEach((cat: any) => {
    const catName = (cat.category_name || cat.menu_group || cat.category || "General").trim();
    
    (cat.all_dishes || []).forEach((d: any) => {
      const dName = typeof d === "string" ? d : (d?.dish || d?.name);
      if (dName && dName.trim()) {
        const trimmed = dName.trim();
        const key = trimmed.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            dish: trimmed,
            category: catName,
            hasPhoto: typeof d === "object" && d.has_photo !== undefined ? !!d.has_photo : !missingPhotosSet.has(key),
            hasDesc: typeof d === "object" && d.has_desc !== undefined ? !!d.has_desc : !missingDescsSet.has(key),
            price: typeof d === "object" ? d.price : 0
          });
        }
      }
    });

    (cat.photos_missing_items || []).forEach((dName: string) => {
      if (dName && dName.trim()) {
        const trimmed = dName.trim();
        const key = trimmed.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            dish: trimmed,
            category: catName,
            hasPhoto: false,
            hasDesc: !missingDescsSet.has(key),
          });
        }
      }
    });

    (cat.descs_missing_items || []).forEach((dName: string) => {
      if (dName && dName.trim()) {
        const trimmed = dName.trim();
        const key = trimmed.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            dish: trimmed,
            category: catName,
            hasPhoto: !missingPhotosSet.has(key),
            hasDesc: false,
          });
        }
      }
    });
  });

  // 2. Process missing_photos_all / missing_descs_all
  (auditData.missing_photos_all || []).forEach((item: any) => {
    const dName = typeof item === "string" ? item : item?.dish;
    const catName = typeof item === "string" ? "General" : (item?.category || "General").trim();
    if (dName && dName.trim()) {
      const trimmed = dName.trim();
      const key = trimmed.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          dish: trimmed,
          category: catName,
          hasPhoto: false,
          hasDesc: !missingDescsSet.has(key),
        });
      }
    }
  });

  (auditData.missing_descs_all || []).forEach((item: any) => {
    const dName = typeof item === "string" ? item : item?.dish;
    const catName = typeof item === "string" ? "General" : (item?.category || "General").trim();
    if (dName && dName.trim()) {
      const trimmed = dName.trim();
      const key = trimmed.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          dish: trimmed,
          category: catName,
          hasPhoto: !missingPhotosSet.has(key),
          hasDesc: false,
        });
      }
    }
  });

  // 3. Fallback: all_items_with_photos
  (auditData.all_items_with_photos || []).forEach((item: any) => {
    const dName = typeof item === "string" ? item : item?.dish;
    const catName = typeof item === "string" ? "General" : (item?.category || "General").trim();
    if (dName && dName.trim()) {
      const trimmed = dName.trim();
      const key = trimmed.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          dish: trimmed,
          category: catName,
          hasPhoto: true,
          hasDesc: !missingDescsSet.has(key),
        });
      }
    }
  });

  return Array.from(map.values());
}

async function fetchSingleAudit(targetUrl: string): Promise<any> {
  await ensureHygieneServerRunning();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const pyRes = await fetch("http://127.0.0.1:8000/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: targetUrl }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!pyRes.ok) {
      throw new Error(`Python audit server failed with status ${pyRes.status}`);
    }

    return await pyRes.json();
  } catch (err: any) {
    console.warn(`[HygieneCompare] Python audit engine failed for ${targetUrl}:`, err?.message || err);
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { zomatoUrl, swiggyUrl } = body;

    if (!zomatoUrl || !swiggyUrl) {
      return NextResponse.json(
        { error: "Both zomatoUrl and swiggyUrl are required." },
        { status: 400 }
      );
    }

    console.log(`[HygieneCompare] Starting Dual Audit: Zomato=${zomatoUrl}, Swiggy=${swiggyUrl}`);

    // Fetch both audits concurrently
    const [zomatoAuditRes, swiggyAuditRes] = await Promise.allSettled([
      fetchSingleAudit(zomatoUrl),
      fetchSingleAudit(swiggyUrl),
    ]);

    const zomatoAudit = zomatoAuditRes.status === "fulfilled" ? zomatoAuditRes.value : null;
    const swiggyAudit = swiggyAuditRes.status === "fulfilled" ? swiggyAuditRes.value : null;

    if (!zomatoAudit || !swiggyAudit) {
      const errorDetail = [];
      if (!zomatoAudit) errorDetail.push("Zomato URL audit failed");
      if (!swiggyAudit) errorDetail.push("Swiggy URL audit failed");
      return NextResponse.json(
        { error: `Could not complete dual audit: ${errorDetail.join(", ")}` },
        { status: 502 }
      );
    }

    const restaurantName =
      zomatoAudit.restaurant_name && zomatoAudit.restaurant_name !== "Restaurant"
        ? zomatoAudit.restaurant_name
        : swiggyAudit.restaurant_name && swiggyAudit.restaurant_name !== "Restaurant"
        ? swiggyAudit.restaurant_name
        : extractRestaurantNameFromUrl(swiggyUrl, zomatoUrl);

    // Extract detailed dish items
    const zDishes = extractDishesFromAudit(zomatoAudit);
    const sDishes = extractDishesFromAudit(swiggyAudit);

    // Create lookup maps with normalized dish titles
    const zDishesBySanitized = new Map<string, DishItem>();
    zDishes.forEach(d => {
      const key = sanitizeDishName(d.dish);
      if (key && !zDishesBySanitized.has(key)) zDishesBySanitized.set(key, d);
    });

    const sDishesBySanitized = new Map<string, DishItem>();
    sDishes.forEach(d => {
      const key = sanitizeDishName(d.dish);
      if (key && !sDishesBySanitized.has(key)) sDishesBySanitized.set(key, d);
    });

    // Compute cross-platform missing dishes
    const missingOnSwiggy: Array<{ dish: string; category: string; price?: number }> = [];
    zDishes.forEach(zDish => {
      const zKey = sanitizeDishName(zDish.dish);
      let foundOnSwiggy = false;
      for (const sKey of sDishesBySanitized.keys()) {
        if (isSimilarDishKey(zKey, sKey)) {
          foundOnSwiggy = true;
          break;
        }
      }
      if (!foundOnSwiggy) {
        missingOnSwiggy.push({
          dish: zDish.dish,
          category: zDish.category,
          price: zDish.price,
        });
      }
    });

    const missingOnZomato: Array<{ dish: string; category: string; price?: number }> = [];
    sDishes.forEach(sDish => {
      const sKey = sanitizeDishName(sDish.dish);
      let foundOnZomato = false;
      for (const zKey of zDishesBySanitized.keys()) {
        if (isSimilarDishKey(sKey, zKey)) {
          foundOnZomato = true;
          break;
        }
      }
      if (!foundOnZomato) {
        missingOnZomato.push({
          dish: sDish.dish,
          category: sDish.category,
          price: sDish.price,
        });
      }
    });

    // Cross-Platform Photo & Description Gaps
    const photoGaps: Array<{ dish: string; category: string; hasOnZomato: boolean; hasOnSwiggy: boolean }> = [];
    const descGaps: Array<{ dish: string; category: string; hasOnZomato: boolean; hasOnSwiggy: boolean }> = [];

    zDishes.forEach(zDish => {
      const zKey = sanitizeDishName(zDish.dish);
      let matchedSDish: DishItem | undefined;
      for (const [sKey, sDish] of sDishesBySanitized.entries()) {
        if (isSimilarDishKey(zKey, sKey)) {
          matchedSDish = sDish;
          break;
        }
      }

      if (matchedSDish) {
        if (zDish.hasPhoto !== matchedSDish.hasPhoto) {
          photoGaps.push({
            dish: zDish.dish,
            category: zDish.category,
            hasOnZomato: zDish.hasPhoto,
            hasOnSwiggy: matchedSDish.hasPhoto,
          });
        }

        if (zDish.hasDesc !== matchedSDish.hasDesc) {
          descGaps.push({
            dish: zDish.dish,
            category: zDish.category,
            hasOnZomato: zDish.hasDesc,
            hasOnSwiggy: matchedSDish.hasDesc,
          });
        }
      }
    });

    // Clean category name helper
    const cleanCategoryName = (name: string) => {
      if (!name) return "General";
      return name
        .replace(/&amp;/g, "&")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    };

    // Group actual dishes under their respective categories
    const zCatDishes = new Map<string, DishItem[]>();
    zDishes.forEach((d) => {
      const cat = cleanCategoryName(d.category);
      if (!zCatDishes.has(cat)) zCatDishes.set(cat, []);
      zCatDishes.get(cat)!.push(d);
    });

    const sCatDishes = new Map<string, DishItem[]>();
    sDishes.forEach((d) => {
      const cat = cleanCategoryName(d.category);
      if (!sCatDishes.has(cat)) sCatDishes.set(cat, []);
      sCatDishes.get(cat)!.push(d);
    });

    const findSwiggyCategoryMatch = (zCat: string, sCatList: string[]) => {
      const normZ = zCat.toLowerCase().trim();
      for (const sCat of sCatList) {
        if (sCat.toLowerCase().trim() === normZ) return sCat;
      }
      const keyZ = normZ.replace(/&/g, "and").replace(/s$/, "");
      for (const sCat of sCatList) {
        const keyS = sCat.toLowerCase().trim().replace(/&/g, "and").replace(/s$/, "");
        if (keyZ === keyS || (keyZ.length >= 4 && keyS.length >= 4 && (normZ.includes(sCat.toLowerCase()) || sCat.toLowerCase().includes(normZ)))) {
          return sCat;
        }
      }
      return null;
    };

    const matchedSwiggyKeys = new Set<string>();
    const sCatKeys = Array.from(sCatDishes.keys());

    const isPromoCategory = (name: string) => {
      if (!name) return false;
      return /\b(items? at \d+|deals?|offers?|specials?|bestsellers?|bogo|recommended|combos?|pocket friendly|flat \d+%?|discount|at \d+|saver)\b/i.test(name);
    };

    const categoryComparison: Array<{
      category: string;
      zomatoCategoryName: string;
      swiggyCategoryName: string;
      zomatoCount: number;
      swiggyCount: number;
      difference: number;
      status: string;
      isPromotional: boolean;
      zomatoDishes: Array<{ name: string; hasPhoto: boolean; hasDesc: boolean }>;
      swiggyDishes: Array<{ name: string; hasPhoto: boolean; hasDesc: boolean }>;
      missingOnZomatoItems: string[];
      missingOnSwiggyItems: string[];
      missingOnZomatoDetailed: Array<{ dish: string; foundInOtherCategory?: string }>;
      missingOnSwiggyDetailed: Array<{ dish: string; foundInOtherCategory?: string }>;
    }> = [];

    Array.from(zCatDishes.keys()).forEach((zCat) => {
      const zDishList = zCatDishes.get(zCat) || [];
      const zCount = zDishList.length;

      const matchedSKey = findSwiggyCategoryMatch(zCat, sCatKeys);
      const sDishList = matchedSKey ? (sCatDishes.get(matchedSKey) || []) : [];
      const sCount = sDishList.length;

      if (matchedSKey) matchedSwiggyKeys.add(matchedSKey);

      let status = "match";
      if (zCount > 0 && sCount === 0) status = "missing_on_swiggy";
      else if (zCount !== sCount) status = "mismatch";

      // Match dishes inside this category
      const zSanitizedMap = new Map(zDishList.map((d) => [sanitizeDishName(d.dish), d]));
      const sSanitizedMap = new Map(sDishList.map((d) => [sanitizeDishName(d.dish), d]));

      const missingOnSwiggyDetailed: Array<{ dish: string; foundInOtherCategory?: string }> = [];
      const missingOnSwiggyInCat: string[] = [];

      zDishList.forEach((zd) => {
        const zKey = sanitizeDishName(zd.dish);
        let foundInCat = false;
        for (const sKey of sSanitizedMap.keys()) {
          if (isSimilarDishKey(zKey, sKey)) {
            foundInCat = true;
            break;
          }
        }

        if (!foundInCat) {
          missingOnSwiggyInCat.push(zd.dish);
          // Check if it exists in another category on Swiggy
          let otherCat: string | undefined;
          for (const [sKey, sItem] of sDishesBySanitized.entries()) {
            if (isSimilarDishKey(zKey, sKey)) {
              otherCat = sItem.category;
              break;
            }
          }
          missingOnSwiggyDetailed.push({
            dish: zd.dish,
            foundInOtherCategory: otherCat,
          });
        }
      });

      const missingOnZomatoDetailed: Array<{ dish: string; foundInOtherCategory?: string }> = [];
      const missingOnZomatoInCat: string[] = [];

      sDishList.forEach((sd) => {
        const sKey = sanitizeDishName(sd.dish);
        let foundInCat = false;
        for (const zKey of zSanitizedMap.keys()) {
          if (isSimilarDishKey(sKey, zKey)) {
            foundInCat = true;
            break;
          }
        }

        if (!foundInCat) {
          missingOnZomatoInCat.push(sd.dish);
          // Check if it exists in another category on Zomato
          let otherCat: string | undefined;
          for (const [zKey, zItem] of zDishesBySanitized.entries()) {
            if (isSimilarDishKey(sKey, zKey)) {
              otherCat = zItem.category;
              break;
            }
          }
          missingOnZomatoDetailed.push({
            dish: sd.dish,
            foundInOtherCategory: otherCat,
          });
        }
      });

      categoryComparison.push({
        category: zCat,
        zomatoCategoryName: zCat,
        swiggyCategoryName: matchedSKey || "",
        zomatoCount: zCount,
        swiggyCount: sCount,
        difference: sCount - zCount,
        status,
        isPromotional: isPromoCategory(zCat) || (matchedSKey ? isPromoCategory(matchedSKey) : false),
        zomatoDishes: zDishList.map((d) => ({ name: d.dish, hasPhoto: d.hasPhoto, hasDesc: d.hasDesc })),
        swiggyDishes: sDishList.map((d) => ({ name: d.dish, hasPhoto: d.hasPhoto, hasDesc: d.hasDesc })),
        missingOnZomatoItems: missingOnZomatoInCat,
        missingOnSwiggyItems: missingOnSwiggyInCat,
        missingOnZomatoDetailed,
        missingOnSwiggyDetailed,
      });
    });

    // Swiggy categories not present in Zomato
    sCatKeys.forEach((sCat) => {
      if (!matchedSwiggyKeys.has(sCat)) {
        const sDishList = sCatDishes.get(sCat) || [];
        const missingOnZomatoDetailed = sDishList.map((d) => {
          const sKey = sanitizeDishName(d.dish);
          let otherCat: string | undefined;
          for (const [zKey, zItem] of zDishesBySanitized.entries()) {
            if (isSimilarDishKey(sKey, zKey)) {
              otherCat = zItem.category;
              break;
            }
          }
          return {
            dish: d.dish,
            foundInOtherCategory: otherCat,
          };
        });

        categoryComparison.push({
          category: sCat,
          zomatoCategoryName: "",
          swiggyCategoryName: sCat,
          zomatoCount: 0,
          swiggyCount: sDishList.length,
          difference: sDishList.length,
          status: "missing_on_zomato",
          isPromotional: isPromoCategory(sCat),
          zomatoDishes: [],
          swiggyDishes: sDishList.map((d) => ({ name: d.dish, hasPhoto: d.hasPhoto, hasDesc: d.hasDesc })),
          missingOnZomatoItems: sDishList.map((d) => d.dish),
          missingOnSwiggyItems: [],
          missingOnZomatoDetailed,
          missingOnSwiggyDetailed: [],
        });
      }
    });

    categoryComparison.sort((a, b) => a.category.localeCompare(b.category));

    // Construct Scorecards
    const zTotal = zDishes.length;
    const zPhotosMissing = zDishes.filter(d => !d.hasPhoto).length;
    const zDescsMissing = zDishes.filter(d => !d.hasDesc).length;
    const zPhotoPct = zTotal ? Math.round(((zTotal - zPhotosMissing) / zTotal) * 100) : 0;
    const zDescPct = zTotal ? Math.round(((zTotal - zDescsMissing) / zTotal) * 100) : 0;
    const zRating = parseFloat(zomatoAudit.ratings?.delivery || "4.0") || 4.0;
    const zOverall = Math.round(zPhotoPct * 0.5 + zDescPct * 0.3 + (zRating / 5.0) * 100 * 0.2);

    const sTotal = sDishes.length;
    const sPhotosMissing = sDishes.filter(d => !d.hasPhoto).length;
    const sDescsMissing = sDishes.filter(d => !d.hasDesc).length;
    const sPhotoPct = sTotal ? Math.round(((sTotal - sPhotosMissing) / sTotal) * 100) : 0;
    const sDescPct = sTotal ? Math.round(((sTotal - sDescsMissing) / sTotal) * 100) : 0;
    const sRating = parseFloat(swiggyAudit.ratings?.delivery || "4.0") || 4.0;
    const sOverall = Math.round(sPhotoPct * 0.5 + sDescPct * 0.3 + (sRating / 5.0) * 100 * 0.2);

    const zomatoScorecard = {
      overall_score: zOverall,
      total_dishes: zTotal,
      dishes_missing_photos: zPhotosMissing,
      photo_coverage_pct: zPhotoPct,
      dishes_missing_descs: zDescsMissing,
      desc_coverage_pct: zDescPct,
    };

    const swiggyScorecard = {
      overall_score: sOverall,
      total_dishes: sTotal,
      dishes_missing_photos: sPhotosMissing,
      photo_coverage_pct: sPhotoPct,
      dishes_missing_descs: sDescsMissing,
      desc_coverage_pct: sDescPct,
    };

    const overallSyncScore = Math.max(
      0,
      100 -
        missingOnSwiggy.length * 2 -
        missingOnZomato.length * 2 -
        photoGaps.length -
        descGaps.length
    );

    const responsePayload = {
      restaurant_name: restaurantName,
      zomatoUrl,
      swiggyUrl,
      zomatoScorecard,
      swiggyScorecard,
      zomatoMissingPhotos: zomatoAudit.missing_photos_all || [],
      zomatoMissingDescs: zomatoAudit.missing_descs_all || [],
      swiggyMissingPhotos: swiggyAudit.missing_photos_all || [],
      swiggyMissingDescs: swiggyAudit.missing_descs_all || [],
      comparison: {
        categoryComparison,
        missingOnSwiggy,
        missingOnZomato,
        photoGaps,
        descGaps,
      },
      overall_sync_score: overallSyncScore,
    };

    return NextResponse.json(responsePayload);
  } catch (err: any) {
    console.error("[HygieneCompare] API Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process dual comparison." },
      { status: 500 }
    );
  }
}
