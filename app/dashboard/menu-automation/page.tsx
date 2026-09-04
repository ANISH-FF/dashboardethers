"use client";

import { useState, useRef, useCallback, FormEvent, useEffect } from "react";
import { useAutomationStore } from "@/components/AutomationStoreContext";
import * as XLSX from "xlsx";
import Image from "next/image";
import { Sparkles } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
interface MenuItem {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  quantity_num: string;   
  quantity_unit: string;  
  spice_level: 0 | 1 | 2 | 3;
  variants: string;
  base_price: string;     
  online_price: number;
  half_price: number;
  is_veg: boolean;
  has_half: boolean;
  addons: string;
  custom_columns: Record<string, string>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcOnline(base: number, hike: number) {
  return Math.round(base * (1 + hike / 100));
}
function calcHalf(online: number, pct: number) {
  return Math.round(online * (pct / 100));
}

function parseVariantPrices(variantsStr: string): { name: string; price: number }[] {
  if (!variantsStr || !variantsStr.trim()) return [];
  const parts = variantsStr.split(",").map((s) => s.trim()).filter(Boolean);
  const result: { name: string; price: number }[] = [];
  for (const part of parts) {
    const match = part.match(/^(.*?)\s*(?:[\(\:\-\/]\s*₹?\s*(\d+(?:\.\d+)?)\)?|\(₹?\s*(\d+(?:\.\d+)?)\))?$/);
    if (match) {
      const name = match[1].trim();
      const priceStr = match[2] || match[3];
      const price = priceStr ? parseFloat(priceStr) : 0;
      result.push({ name, price });
    }
  }
  return result;
}

function detectSpice(name: string): 0 | 1 | 2 | 3 {
  const n = name.toLowerCase();
  if (/extra\s*hot|ghost\s*pepper|schezwan|szechuan|dynamite|blazing|inferno/.test(n)) return 3;
  if (/chilli|chilly|chili|spicy|pepper|masala|tikka|tandoor|curry|jalap|sriracha|vindaloo|laal/.test(n)) return 2;
  return 0; // Default non-spicy
}

function resolveSpice(apiSpice: string, name: string): 0 | 1 | 2 | 3 {
  const lower = (apiSpice || "").toLowerCase();
  if (lower === "high" || lower === "hot") return 3;
  if (lower === "medium") return 2;
  if (lower === "low" || lower === "mild") return 1;
  const detected = detectSpice(name);
  if (detected > 0) return detected;
  return 0; 
}

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve({ data: result.split(",")[1], mediaType: file.type || "application/octet-stream" });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      const MAX_DIM = 1600;
      let width = img.width;
      let height = img.height;

      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve({ data: result.split(",")[1], mediaType: file.type });
        };
        reader.readAsDataURL(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      resolve({ data: dataUrl.split(",")[1], mediaType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve({ data: result.split(",")[1], mediaType: file.type });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };
    img.src = objectUrl;
  });
}

// ─── Components ────────────────────────────────────────────────────────────
function SpiceSelector({ level, onChange }: { level: 0 | 1 | 2 | 3; onChange: (v: 0 | 1 | 2 | 3) => void }) {
  const labels = ["Mild", "Medium", "Hot"];
  const colors = ["#fbbf24", "#f97316", "#ef4444"]; 

  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
      {[1, 2, 3].map((i) => {
        const active = level >= i;
        const color = colors[i - 1];
        return (
          <button
            key={i}
            title={labels[i - 1]}
            onClick={() => onChange(level === i ? 0 : i as 0 | 1 | 2 | 3)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              border: `1px solid ${active ? color : "rgba(255,255,255,0.08)"}`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: active ? `${color}18` : "rgba(255,255,255,0.03)",
              padding: 0,
              transition: "all 0.15s ease",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={active ? color : "none"} stroke={active ? color : "rgba(255,255,255,0.2)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "all 0.15s" }}>
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function DietDot({ isVeg, onClick }: { isVeg: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={isVeg ? "Veg – click to toggle" : "Non-Veg – click to toggle"}
      style={{
        width: 24,
        height: 24,
        borderRadius: 5,
        border: `1.5px solid ${isVeg ? "#4ade80" : "#f87171"}`,
        background: isVeg ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
        transition: "all 0.12s",
      }}
    >
      <div style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: isVeg ? "#4ade80" : "#f87171",
      }} />
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function Home() {
  const {
    currentMenuItems: items,
    menuHistory,
    menuHistoryIndex,
    onlineHike,
    halfPct,
    commitMenuItems: commitItems,
    undoMenu: undo,
    redoMenu: redo,
    resetMenuAutomation,
    applyMenuPricingHike,
  } = useAutomationStore();

  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [funFact, setFunFact] = useState("Preparing the kitchen...");

  // Variant Selection & Editing State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customVariantTitle, setCustomVariantTitle] = useState<string>("");
  const [editingVariantItem, setEditingVariantItem] = useState<MenuItem | null>(null);

  // Custom In-App Modal & Notice States (Replacing native browser popups)
  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const [addonsCountInput, setAddonsCountInput] = useState("3");
  const [showConfirmStartOver, setShowConfirmStartOver] = useState(false);
  const [menuNotice, setMenuNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) return;
    const facts = [
      "Chopping the vegetables...",
      "Stirring the pot...",
      "Heating the oven...",
      "Plating the dish...",
      "Serving the food..."
    ];
    let i = 0;
    const int = setInterval(() => {
      i = (i + 1) % facts.length;
      setFunFact(facts[i]);
    }, 2000);
    return () => clearInterval(int);
  }, [loading]);

  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState(false);
  const [magicPrompt, setMagicPrompt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateItem = useCallback((id: string, patch: Partial<MenuItem>) => {
    const next = items.map((item) => {
      if (item.id !== id) return item;
      const merged = { ...item, ...patch };
      if ("base_price" in patch) {
        const base = parseFloat(String(patch.base_price ?? "0")) || 0;
        merged.online_price = calcOnline(base, onlineHike);
        merged.half_price = calcHalf(merged.online_price, halfPct);
      }
      return merged;
    });
    commitItems(next);
  }, [items, onlineHike, halfPct, commitItems]);

  const deleteItem = (id: string) => commitItems(items.filter((i) => i.id !== id));

  const addRow = () => {
    commitItems([...items, {
      id: crypto.randomUUID(),
      name: "",
      category: "Main Course",
      subcategory: "",
      description: "",
      quantity_num: "",
      quantity_unit: "Unit",
      spice_level: 0,
      variants: "",
      base_price: "",
      online_price: 0,
      half_price: 0,
      is_veg: true,
      has_half: false,
      addons: "",
      custom_columns: {},
    }]);
  };

function determineSmartVariantTitle(selectedItems: MenuItem[]): string {
  if (!selectedItems || selectedItems.length === 0) return "Item Variants";

  const cleanNames = selectedItems.map((i) =>
    i.name
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/\s*\[[^\]]*\]/g, "")
      .replace(/\s+(Half|Full|Small|Medium|Large|Regular|King|Single|Double|Quarter|250ml|500ml|750ml|1pc|2pc|6pc|12pc)$/i, "")
      .trim()
  );

  // 1. Common prefix (e.g. "Paneer Butter Masala Half" & "Paneer Butter Masala Full" -> "Paneer Butter Masala")
  let first = cleanNames[0];
  let prefix = "";
  for (let len = 1; len <= first.length; len++) {
    const p = first.slice(0, len);
    if (cleanNames.every((n) => n.toLowerCase().startsWith(p.toLowerCase()))) {
      prefix = p;
    } else {
      break;
    }
  }
  prefix = prefix.trim().replace(/[-–—:]$/, "").trim();
  if (prefix.length >= 3) {
    return prefix;
  }

  // 2. Common word (e.g. "Steak" in "Beef Steak", "Chicken Steak", "Fish Steak" -> "Steaks")
  const wordArrays = cleanNames.map((n) => n.split(/\s+/).map((w) => w.replace(/[^a-zA-Z0-9]/g, "")));
  const commonWords = wordArrays[0].filter((w) =>
    w.length > 2 && wordArrays.every((arr) => arr.some((itemWord) => itemWord.toLowerCase() === w.toLowerCase()))
  );

  if (commonWords.length > 0) {
    const mainWord = commonWords[commonWords.length - 1];
    if (/shake/i.test(mainWord)) return "Milkshakes";
    if (/steak/i.test(mainWord)) return "Steaks";
    if (/coffee/i.test(mainWord)) return "Coffees";
    if (/tea/i.test(mainWord)) return "Teas & Beverages";
    if (/pizza/i.test(mainWord)) return "Pizzas";
    if (/burger/i.test(mainWord)) return "Burgers";
    if (/biryani/i.test(mainWord)) return "Biryanis";
    if (/noodle|chowmein/i.test(mainWord)) return "Noodles";
    if (/rice/i.test(mainWord)) return "Rice Dishes";
    if (/ice\s*cream|sundae|dessert/i.test(mainWord)) return "Desserts";
    if (!mainWord.toLowerCase().endsWith("s") && mainWord.length >= 4) {
      return `${mainWord}s`;
    }
    return mainWord;
  }

  // 3. Fallback: First item's name or clean category
  return cleanNames[0] || "Item Variants";
}

  // ── Variant Selection Functions ──────────────────────────────────────────
  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (filteredItems: MenuItem[]) => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map((i) => i.id));
    }
  };

  // Make Variant from selected items with AI Smart Naming & Fallback
  const makeVariantFromSelection = async () => {
    if (selectedIds.length < 2) return;
    const selectedItems = items.filter((i) => selectedIds.includes(i.id));
    if (selectedItems.length < 2) return;

    let masterName = "";
    let variantsString = "";
    let minBasePrice = 0;

    // Call AI Endpoint for 100% semantic accuracy
    try {
      setLoadingMsg("AI is analyzing selected items for 100% accurate variant naming...");
      setLoading(true);

      const res = await fetch("/api/menu/group-selected-variant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selectedItems.map((i) => ({
            id: i.id,
            name: i.name,
            base_price: i.base_price,
            category: i.category,
            subcategory: i.subcategory,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.masterName && data.variants) {
          masterName = data.masterName;
          variantsString = data.variants;
          minBasePrice = Number(data.lowestPrice) || 0;
        }
      }
    } catch (err) {
      console.warn("[MakeVariant AI Error, using local fallback]:", err);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }

    // Local Fallback if AI call failed or returned empty
    if (!masterName) {
      masterName = determineSmartVariantTitle(selectedItems);
      const variantOptions = selectedItems.map((item) => {
        const p = parseFloat(item.base_price || "0") || 0;
        // Clean option name by removing masterName if present
        let optName = item.name;
        if (masterName.length > 3) {
          const masterRegex = new RegExp(masterName.replace(/s$/i, ""), "gi");
          optName = optName.replace(masterRegex, "").trim() || item.name;
        }
        return `${optName}${p > 0 ? ` (₹${p})` : ""}`;
      });
      variantsString = variantOptions.join(", ");
    }

    const firstItem = selectedItems[0];

    if (!minBasePrice) {
      const prices = selectedItems
        .map((item) => parseFloat(item.base_price || "0") || 0)
        .filter((p) => p > 0);
      minBasePrice = prices.length > 0 ? Math.min(...prices) : (parseFloat(firstItem.base_price || "0") || 0);
    }

    const basePriceStr = minBasePrice > 0 ? String(minBasePrice) : firstItem.base_price;
    const onlinePriceVal = minBasePrice > 0 ? calcOnline(minBasePrice, onlineHike) : firstItem.online_price;
    const halfPriceVal = calcHalf(onlinePriceVal, halfPct);

    const updatedMasterItem: MenuItem = {
      ...firstItem,
      name: masterName,
      variants: variantsString,
      base_price: basePriceStr,
      online_price: onlinePriceVal,
      half_price: halfPriceVal,
    };

    const selectedIdSet = new Set(selectedIds);
    const nextItems = items
      .filter((i) => !selectedIdSet.has(i.id) || i.id === firstItem.id)
      .map((i) => (i.id === firstItem.id ? updatedMasterItem : i));

    commitItems(nextItems);
    setSelectedIds([]);
  };

  // AI Auto-Group Variants
  const runAiAutoVariants = async () => {
    if (items.length === 0) return;
    setLoading(true);
    setLoadingMsg("AI is analyzing menu items and auto-grouping variants...");
    try {
      const res = await fetch("/api/auto-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      if (json.items) {
        commitItems(json.items);
      }
    } catch (err) {
      setMenuNotice("Error grouping variants: " + String(err));
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // Ungroup / Dissolve a variant family back into individual items
  const dissolveVariantFamily = (item: MenuItem) => {
    if (!item.variants.trim()) return;

    const variantParts = item.variants.split(",").map((s) => s.trim()).filter(Boolean);
    const createdItems: MenuItem[] = variantParts.map((part, idx) => {
      const priceMatch = part.match(/\(₹?\s*(\d+(?:\.\d+)?)\)/);
      const name = part.replace(/\(₹?\s*\d+(?:\.\d+)?\)/, "").trim() || `${item.name} ${idx + 1}`;
      const priceVal = priceMatch ? priceMatch[1] : item.base_price;
      const base = parseFloat(priceVal || "0") || 0;
      const online = calcOnline(base, onlineHike);

      return {
        ...item,
        id: crypto.randomUUID(),
        name,
        variants: "",
        base_price: base > 0 ? String(base) : "",
        online_price: online,
        half_price: calcHalf(online, halfPct),
      };
    });

    const nextItems = items.flatMap((i) => (i.id === item.id ? createdItems : [i]));
    commitItems(nextItems);
    setEditingVariantItem(null);
  };

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    const allItems: MenuItem[] = [];

    try {
      for (const file of Array.from(files)) {
        setLoadingMsg("AI Extracting: " + file.name);
        let extractPayload: any = {};

        if (/\.(xlsx?|csv)$/i.test(file.name)) {
          const buffer = await file.arrayBuffer();
          const wb = XLSX.read(buffer, { type: "array" });
          let combinedCsv = "";
          wb.SheetNames.forEach((sheetName) => {
            const rawCsv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName], { blankrows: false });
            if (rawCsv.trim()) {
              const cleanCsv = rawCsv
                .split("\n")
                .filter((line) => line.split(",").some((cell) => cell.trim().length > 0))
                .join("\n");
              if (cleanCsv.trim()) {
                combinedCsv += `\n--- SHEET: ${sheetName} ---\n${cleanCsv}\n`;
              }
            }
          });
          extractPayload = { rawText: combinedCsv };
        } else {
          const { data, mediaType } = await fileToBase64(file);
          extractPayload = { imageBase64: data, mediaType };
        }

        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(extractPayload),
        });

        const json = await res.json();
        if (json.error) throw new Error(json.error);

        (json.items || []).forEach((item: any, idx: number) => {
          const name = String(item.name || "");
          const base = parseFloat(String(item.base_price || "0")) || 0;
          const online = calcOnline(base, onlineHike);
          allItems.push({
            id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2)}`,
            name,
            category: String(item.category || "Main Course"),
            subcategory: String(item.subcategory || ""),
            description: String(item.description || ""),
            quantity_num: String(item.quantity || ""),
            quantity_unit: "Unit",
            spice_level: resolveSpice(String(item.spice_level || ""), name),
            variants: String(item.variants || ""),
            base_price: base > 0 ? String(base) : "",
            online_price: online,
            half_price: calcHalf(online, halfPct),
            is_veg: item.is_veg !== false,
            has_half: false,
            addons: String(item.addons || ""),
            custom_columns: {},
          });
        });
      }
      commitItems([...items, ...allItems]);
    } catch (err) {
      setMenuNotice("Error processing files: " + String(err));
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const executeAddonsGeneration = async (countVal: number) => {
    setShowAddonsModal(false);
    setLoading(true);
    setLoadingMsg(`Generating add-ons (${countVal} per item)...`);
    try {
      const res = await fetch("/api/generate-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, field: "addons", count: countVal }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      if (json.items) commitItems(json.items);
    } catch (err) {
      setMenuNotice("Error generating add-ons: " + String(err));
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const generateField = async (field: string) => {
    if (items.length === 0) return;
    if (field === "addons") {
      setShowAddonsModal(true);
      return;
    }
    setLoading(true);
    setLoadingMsg(`Generating ${field}...`);
    try {
      const res = await fetch("/api/generate-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, field }),
      });
      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Server error (${res.status}): unexpected response.`);
      }
      if (!res.ok || json.error) throw new Error(json.error || `Server error (${res.status})`);
      if (json.items) commitItems(json.items);
    } catch (err) {
      setMenuNotice("Error: " + String(err));
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const runMagic = async (e: FormEvent) => {
    e.preventDefault();
    if (!magicPrompt.trim() || items.length === 0) return;
    setLoading(true);
    setLoadingMsg("Running AI magic...");
    try {
      const res = await fetch("/api/magic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, prompt: magicPrompt }),
      });
      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Server error (${res.status}): unexpected response.`);
      }
      if (!res.ok || json.error) throw new Error(json.error || `Server error (${res.status})`);
      if (json.items) { commitItems(json.items); setMagicPrompt(""); }
    } catch (err) {
      setMenuNotice("Error: " + String(err));
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const exportToExcel = () => {
    const rows = items.map((item, idx) => {
      const base = parseFloat(item.base_price || "0") || 0;
      const spiceLabels: Record<number, string> = { 0: "", 1: "Mild", 2: "Medium", 3: "Hot" };
      return {
        "#": idx + 1,
        Diet: item.is_veg ? "Veg" : "Non-Veg",
        Category: item.category,
        "Sub-Category": item.subcategory,
        "Item Name": item.name,
        Description: item.description,
        Quantity: item.quantity_num,
        Unit: item.quantity_unit,
        "Spice Level": spiceLabels[item.spice_level] || "",
        "Variants (sizes/options)": item.variants,
        "Add-ons": item.addons,
        "Base Price": base,
        [`Online Price (+${onlineHike}%)`]: item.online_price,
        "Half Portion": item.has_half ? item.half_price : "",
        ...item.custom_columns,
      };
    });
    const wsMenu = XLSX.utils.json_to_sheet(rows);

    const totalItems = items.length;
    const vegCount = items.filter(i => i.is_veg).length;
    const nonVegCount = totalItems - vegCount;
    const vegPct = totalItems > 0 ? Math.round((vegCount / totalItems) * 100) : 0;
    const nonVegPct = totalItems > 0 ? Math.round((nonVegCount / totalItems) * 100) : 0;
    const halfPortionCount = items.filter(i => i.has_half).length;
    
    let totalBase = 0;
    items.forEach(i => totalBase += (parseFloat(i.base_price || "0") || 0));
    const avgBase = totalItems > 0 ? Math.round(totalBase / totalItems) : 0;

    const mildCount = items.filter(i => i.spice_level === 1).length;
    const mediumCount = items.filter(i => i.spice_level === 2).length;
    const spicyCount = items.filter(i => i.spice_level === 3).length;
    
    const addonsCount = items.filter(i => i.addons.trim().length > 0).length;
    const variantsCount = items.filter(i => i.variants.trim().length > 0).length;
    const categoriesCount = new Set(items.map(i => i.category)).size;

    const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const dateString = new Date().toLocaleDateString('en-US', dateOptions);

    const summaryData = [
      ["Summary Reference:"],
      [],
      ["🍽️ ETHERS MENU DIGITIZER - EXPORT SUMMARY"],
      [],
      ["📅 Export Information"],
      ["Generated On:", dateString],
      [],
      ["📊 Menu Statistics"],
      ["Total Items:", totalItems],
      ["Vegetarian Items:", `${vegCount} (${vegPct}%)`],
      ["Non-Vegetarian Items:", `${nonVegCount} (${nonVegPct}%)`],
      ["Items with Half Portion:", halfPortionCount],
      ["Average Base Price:", `₹${avgBase}`],
      ["Total Categories:", categoriesCount],
      ["Items with Add-ons:", addonsCount],
      ["Items with Variants:", variantsCount],
      [],
      ["💰 Pricing Configuration"],
      ["Online Price Markup:", `+${onlineHike}%`],
      ["Half Portion Rate:", `${halfPct}% of Online Price`],
      [],
      ["Spice Meter:"],
      [],
      ["🌶️ Spice Level Distribution"],
      ["Mild:", mildCount],
      ["Medium:", mediumCount],
      ["Spicy:", spicyCount],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 35 }, { wch: 40 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
    XLSX.utils.book_append_sheet(wb, wsMenu, "Menu Items");
    
    XLSX.writeFile(wb, "menu_digitized.xlsx");
  };

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase())
  );

  const dynamicCols = [...new Set(items.flatMap((i) => Object.keys(i.custom_columns)))];

  // ════════════════════════════════════════════════════════════════
  // UPLOAD SCREEN
  // ════════════════════════════════════════════════════════════════
  if (items.length === 0 && !loading) {
    return (
      <div className="digitizer-vars w-full">
        <div style={{ minHeight: "calc(100vh - 9rem)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", background: "var(--bg-primary)", borderRadius: 12, border: "1px solid var(--border)" }}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
              <Image src="/uploads/logo.png" alt="Ethers Logo" width={64} height={64} style={{ objectFit: "contain" }} className="brightness-0 dark:invert" />
            </div>
            <h1 style={{ fontSize: "2.4rem", fontWeight: 800, letterSpacing: "-0.04em", color: "#fff" }}>
              Menu Automation
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem", fontSize: "1rem", maxWidth: 500, lineHeight: 1.4 }}>
              AI-powered extraction, automated aggregator pricing, smart descriptions, and instant Excel export.
            </p>
          </div>

          <div
            onDrop={(e) => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files); }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: "100%",
              maxWidth: 520,
              border: `2px dashed ${dragging ? "#fff" : "var(--border)"}`,
              borderRadius: 20,
              padding: "2rem 1.5rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
              cursor: "pointer",
              background: dragging ? "rgba(255,255,255,0.03)" : "var(--bg-secondary)",
              transition: "all 0.2s",
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "0.25rem"
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            
            <h2 style={{ fontWeight: 700, color: "#fff", fontSize: "1.2rem", margin: 0 }}>Upload your Menu</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: 0 }}>Select multiple photos, a PDF, or an Excel file</p>
            
            <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.75rem", color: "var(--text-muted)", fontSize: "0.8rem" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Multi-Page Support
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                Photos
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                PDF
              </span>
            </div>
            
            <button style={{
              marginTop: "1rem", padding: "0.75rem 2rem",
              background: "#fff", color: "#000", border: "none", borderRadius: 10,
              fontWeight: 700, fontSize: "0.95rem", cursor: "pointer",
              boxShadow: "0 4px 14px rgba(255,255,255,0.1)",
              transition: "all 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.03)"}
            onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              Browse Files
            </button>
          </div>

          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,image/*,application/pdf" multiple style={{ display: "none" }} onChange={(e) => processFiles(e.target.files)} />
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // LOADING SCREEN 
  // ════════════════════════════════════════════════════════════════
  if (items.length === 0 && loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5rem", background: "#111" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ position: "relative", width: 90, height: 90 }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid var(--border)" }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#fff", animation: "spin 0.9s linear infinite" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Image src="/uploads/logo.png" alt="Loading" width={48} height={48} style={{ objectFit: "contain", borderRadius: 8 }} className="brightness-0 dark:invert" />
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontWeight: 700, fontSize: "1.25rem" }}>Analyzing your menu...</p>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem", fontSize: "0.9rem" }}>{loadingMsg}</p>
          <p style={{ color: "var(--text-muted)", marginTop: "1.5rem", fontSize: "0.85rem", transition: "opacity 0.3s" }}>{funFact}</p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // MAIN DASHBOARD
  // ════════════════════════════════════════════════════════════════
  const btnBase: React.CSSProperties = {
    padding: "0.55rem 1.2rem",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: "0.85rem",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    border: "1px solid var(--border)",
    transition: "all 0.12s",
    flexShrink: 0,
    fontFamily: "inherit",
  };

  return (
    <div className="digitizer-vars w-full h-[calc(100vh-5.5rem)] flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl">
      <style>{`
          .digitizer-vars {
            --bg-primary:    #0a0a0a;
            --bg-secondary:  #111111;
            --bg-card:       #161616;
            --bg-hover:      #1c1c1c;
            --bg-input:      #0f0f0f;
            --border:        #272727;
            --border-subtle: #1a1a1a;
            --text-primary:  #f5f5f5;
            --text-secondary:#a3a3a3;
            --text-muted:    #555555;
          }
          @keyframes spin  { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
          .tr-hover:hover  { background: var(--bg-hover) !important; }
          .tr-hover:hover .del-btn { opacity: 1 !important; }
          .del-btn { opacity: 0; transition: opacity 0.12s; }
          .ci:focus { background: rgba(255,255,255,0.05) !important; border-radius: 6px; }
          button:disabled { opacity: 0.35; cursor: not-allowed; }
          
          /* Legacy Form Resets */
          .digitizer-vars input, .digitizer-vars select, .digitizer-vars textarea {
            color: var(--text-primary);
            background: transparent;
            border: none;
            outline: none;
            font-family: inherit;
          }
          .digitizer-vars input::placeholder, .digitizer-vars textarea::placeholder { color: var(--text-muted); }
          .digitizer-vars select option { background: var(--bg-card); color: var(--text-primary); }
        `}</style>

      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", padding: "0.85rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.85rem", flexShrink: 0 }}>
        
        {/* Left: Logo & Item count */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
          <span style={{ fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-0.02em", color: "#fff", whiteSpace: "nowrap" }}>
            Menu Automation
          </span>
          <div style={{ padding: "0.45rem 0.85rem", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, fontWeight: 600, fontSize: "0.8rem", color: "#ccc", whiteSpace: "nowrap" }}>
            {items.length} items
          </div>
        </div>

        {/* Center: AI Buttons & Pricing Setup */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <button onClick={runAiAutoVariants} disabled={loading} style={{ ...btnBase, background: "rgba(168,85,247,0.12)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.3)", padding: "0.45rem 0.8rem", fontSize: "0.8rem" }}>
            ✦ AI Auto-Group Variants
          </button>
          <button onClick={() => generateField("subcategory")} disabled={loading} style={{ ...btnBase, background: "rgba(255,255,255,0.05)", color: "#e0e0e0", padding: "0.45rem 0.8rem", fontSize: "0.8rem" }}>
            ✦ AI Sub-Categories
          </button>
          <button onClick={() => generateField("description")} disabled={loading} style={{ ...btnBase, background: "rgba(255,255,255,0.05)", color: "#e0e0e0", padding: "0.45rem 0.8rem", fontSize: "0.8rem" }}>
            ✦ AI Descriptions
          </button>
          <button onClick={() => generateField("addons")} disabled={loading} style={{ ...btnBase, background: "rgba(251,146,60,0.08)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.2)", padding: "0.45rem 0.8rem", fontSize: "0.8rem" }}>
            + AI Add-ons
          </button>

          <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 0.2rem" }} />

          <div style={{ display: "flex", alignItems: "center", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            {[
              { label: "ONLINE HIKE", val: onlineHike, color: "#fff", setter: (v: number) => applyMenuPricingHike(v, halfPct) },
              { label: "HALF PORTION", val: halfPct, color: "#4ade80", setter: (v: number) => applyMenuPricingHike(onlineHike, v) },
            ].map((ctrl, i) => (
              <div key={i} style={{ padding: "0.4rem 0.85rem", borderRight: i === 0 ? "1px solid var(--border)" : "none", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", lineHeight: "1.2", marginBottom: 2 }}>{ctrl.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                  <input
                    type="number"
                    value={ctrl.val}
                    onChange={(e) => ctrl.setter(Number(e.target.value))}
                    style={{ width: 48, fontWeight: 800, fontSize: "1rem", color: ctrl.color, textAlign: "center", background: "transparent", border: "none", outline: "none" }}
                  />
                  <span style={{ fontWeight: 700, fontSize: "0.78rem", color: ctrl.color }}>%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: History, Start Over & Export (Automatically wraps to line 2 on right side when sidebar is open) */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginLeft: "auto", flexShrink: 0 }}>
          {[
            { icon: "↩", fn: undo, disabled: menuHistoryIndex === 0, title: "Undo" },
            { icon: "↪", fn: redo, disabled: menuHistoryIndex >= menuHistory.length - 1, title: "Redo" },
          ].map((b) => (
            <button key={b.icon} onClick={b.fn} disabled={b.disabled} title={b.title}
              style={{ ...btnBase, width: 34, height: 34, padding: 0, justifyContent: "center", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: "1rem" }}>
              {b.icon}
            </button>
          ))}
          <button onClick={() => setShowConfirmStartOver(true)}
            style={{ ...btnBase, background: "var(--bg-card)", color: "var(--text-secondary)", padding: "0.45rem 0.85rem", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
            ⌂ Start Over
          </button>
          <button onClick={exportToExcel}
            style={{ ...btnBase, background: "#fff", color: "#000", border: "none", fontWeight: 800, boxShadow: "0 0 16px rgba(255,255,255,0.1)", fontSize: "0.85rem", padding: "0.45rem 1rem", whiteSpace: "nowrap" }}>
            ↓ Export
          </button>
        </div>
      </div>

      {/* ── ACTION ROW & SELECTION FLOATING BAR (Min 2 items required) ───────────────────────────── */}
      {selectedIds.length >= 2 ? (
        <div style={{ background: "rgba(168,85,247,0.12)", borderBottom: "1px solid rgba(168,85,247,0.3)", padding: "0.75rem 1.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: "1rem" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#e9d5ff", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#c084fc" }} />
            {selectedIds.length} Items Selected for Variant Grouping
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              onClick={makeVariantFromSelection}
              style={{ ...btnBase, background: "#a855f7", color: "#fff", border: "none", fontWeight: 800, padding: "0.55rem 1.4rem" }}
            >
              ✨ Make Variant ({selectedIds.length} items)
            </button>

            <button
              onClick={() => setSelectedIds([])}
              style={{ ...btnBase, background: "transparent", color: "#d8b4fe", border: "1px solid rgba(168,85,247,0.3)" }}
            >
              Cancel Selection
            </button>
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-subtle)", padding: "0.65rem 1.75rem", display: "flex", alignItems: "center", gap: "0.8rem", flexShrink: 0 }}>
          <input
            type="text"
            placeholder="Search items or categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "0.55rem 1rem", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: "0.9rem", width: 300, fontFamily: "inherit" }}
          />

          <div style={{ flex: 1 }} />

          <button onClick={addRow} style={{ ...btnBase, background: "rgba(255,255,255,0.06)", color: "#d0d0d0" }}>
            + Add Row
          </button>
          <button onClick={() => fileInputRef.current?.click()} style={{ ...btnBase, background: "var(--bg-card)", color: "var(--text-secondary)" }}>
            + Add Files
          </button>

          <form onSubmit={runMagic} style={{ display: "flex", alignItems: "center", position: "relative" }}>
            <input
              type="text"
              placeholder='✦  Ask AI...  e.g. "group noodles into variants"'
              value={magicPrompt}
              onChange={(e) => setMagicPrompt(e.target.value)}
              style={{
                padding: "0.55rem 3rem 0.55rem 1rem",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                borderRadius: 9,
                color: "var(--text-primary)",
                fontSize: "0.9rem",
                width: 380,
                fontFamily: "inherit",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#666")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
            <button type="submit" disabled={!magicPrompt.trim() || loading}
              style={{ position: "absolute", right: 6, width: 32, height: 32, borderRadius: 6, background: magicPrompt.trim() && !loading ? "#fff" : "rgba(255,255,255,0.08)", border: "none", color: magicPrompt.trim() && !loading ? "#000" : "var(--text-muted)", cursor: magicPrompt.trim() && !loading ? "pointer" : "not-allowed", fontSize: "0.95rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}>
              ➤
            </button>
          </form>
        </div>
      )}

      {/* Loading bar */}
      {loading && (
        <div style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid var(--border-subtle)", padding: "0.55rem 1.75rem", display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0, animation: "pulse 2s ease-in-out infinite" }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
          <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{loadingMsg}</span>
        </div>
      )}

      {/* ── TABLE ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1550, fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)", position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid var(--border)" }}>
              {([
                { label: "#",      w: 56,   align: "center" },
                { label: "Diet",   w: 90,   align: "center" },
                { label: "Category", w: 125 },
                { label: "Sub-Category", w: 125 },
                { label: "Item Name  ·  Description", w: "auto" },
                { label: "Variants (Family / Options)", w: 220 },
                { label: "Qty",    w: 125,  align: "center" },
                { label: "Base ₹", w: 96,   align: "right" },
                { label: `Online ₹ (+${onlineHike}%)`, w: 140, align: "right" },
                { label: "Half",   w: 80,   align: "center", isHalfCol: true },
                { label: "Add-ons", w: 180 },
                ...dynamicCols.map((c) => ({ label: c, w: 130 })),
                { label: "",       w: 40 },
              ] as { label: string | React.ReactNode; w: number | string; align?: string; isHalfCol?: boolean }[]).map((col, i) => (
                <th key={i} style={{
                  padding: "0.85rem 1.25rem",
                  textAlign: (col.align as any) || "left",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  width: col.w,
                  whiteSpace: "nowrap",
                }}>
                  {col.isHalfCol ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span>Half</span>
                      <button 
                        onClick={() => {
                          const allHaveHalf = items.length > 0 && items.every(item => item.has_half);
                          commitItems(items.map(item => ({ ...item, has_half: !allHaveHalf })));
                        }}
                        title={items.length > 0 && items.every(item => item.has_half) ? "Disable Half for all" : "Enable Half for all"}
                        style={{ padding: "2px 6px", fontSize: "0.6rem", background: "rgba(255,255,255,0.1)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "#fff", transition: "background 0.2s" }}
                      >
                        ALL
                      </button>
                    </div>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filtered.map((item, idx) => {
              const isSelected = selectedIds.includes(item.id);
              const hasVariants = item.variants.trim().length > 0;
              const parsedVariants = parseVariantPrices(item.variants);
              const variantPricesList = parsedVariants.filter((v) => v.price > 0).map((v) => v.price);
              const hasMultipleVariantPrices = variantPricesList.length > 1;

              const basePriceDisplay = hasMultipleVariantPrices
                ? variantPricesList.map((p) => `₹${p}`).join(" / ")
                : item.base_price
                ? `₹${item.base_price}`
                : "—";

              const onlinePriceDisplay = hasMultipleVariantPrices
                ? variantPricesList.map((p) => `₹${calcOnline(p, onlineHike)}`).join(" / ")
                : `₹${item.online_price}`;

              return (
                <tr key={item.id} className="tr-hover" style={{ borderBottom: "1px solid var(--border-subtle)", background: isSelected ? "rgba(168,85,247,0.08)" : "transparent" }}>
                  {/* # */}
                  <td style={{ padding: "0.85rem 0.85rem", textAlign: "center", color: "var(--text-muted)", fontWeight: 600, width: 56 }}>
                    {idx + 1}
                  </td>

                  {/* Diet + Spice */}
                  <td style={{ padding: "0.75rem 1.25rem", textAlign: "center", width: 90 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <DietDot isVeg={item.is_veg} onClick={() => updateItem(item.id, { is_veg: !item.is_veg })} />
                      <SpiceSelector
                        level={item.spice_level}
                        onChange={(v) => updateItem(item.id, { spice_level: v })}
                      />
                    </div>
                  </td>

                  {/* Category */}
                  <td style={{ padding: "0.5rem 0.75rem", width: 125 }}>
                    <input className="ci" value={item.category} onChange={(e) => updateItem(item.id, { category: e.target.value })}
                      style={{ width: "100%", padding: "0.4rem 0.6rem", color: "#e0e0e0", fontSize: "0.85rem", fontWeight: 500, borderRadius: 6, outline: "none" }} />
                  </td>

                  {/* Sub-category */}
                  <td style={{ padding: "0.5rem 0.75rem", width: 125 }}>
                    <input className="ci" value={item.subcategory} onChange={(e) => updateItem(item.id, { subcategory: e.target.value })}
                      placeholder="e.g. Paneer Dishes"
                      style={{ width: "100%", padding: "0.4rem 0.6rem", color: "var(--text-secondary)", fontSize: "0.82rem", borderRadius: 6, outline: "none" }} />
                  </td>

                  {/* Name + Description */}
                  <td style={{ padding: "0.5rem 0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input className="ci" value={item.name} onChange={(e) => updateItem(item.id, { name: e.target.value })}
                        placeholder="Item name"
                        style={{ flex: 1, padding: "0.4rem 0.6rem", color: "#fff", fontSize: "0.88rem", fontWeight: 700, letterSpacing: "0.01em", borderRadius: 6, outline: "none" }} />
                    </div>
                    <input className="ci" value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      placeholder="Description..."
                      style={{ width: "100%", padding: "0.3rem 0.6rem", color: "var(--text-muted)", fontSize: "0.8rem", borderRadius: 6, outline: "none", marginTop: 2 }} />
                  </td>

                  {/* Variants Field WITH Checkbox right inside VARIANTS column */}
                  <td style={{ padding: "0.5rem 0.75rem", width: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectItem(item.id)}
                        title="Check to include this dish in Variant Group"
                        style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#a855f7", flexShrink: 0 }}
                      />
                      <input className="ci" value={item.variants} onChange={(e) => updateItem(item.id, { variants: e.target.value })}
                        placeholder="e.g. Small (₹150), Large (₹220)"
                        style={{ flex: 1, padding: "0.4rem 0.6rem", color: hasVariants ? "#c084fc" : "var(--text-secondary)", fontSize: "0.82rem", fontWeight: hasVariants ? 600 : 400, borderRadius: 6, outline: "none" }} />
                      {hasVariants && (
                        <button
                          onClick={() => setEditingVariantItem(item)}
                          title="Edit / Ungroup Variant"
                          style={{ padding: "4px 6px", background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 6, color: "#c084fc", cursor: "pointer", fontSize: "0.75rem" }}
                        >
                          ✎
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Qty */}
                  <td style={{ padding: "0.5rem 0.75rem", width: 125 }}>
                    <div style={{ display: "flex", alignItems: "center", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", height: 34 }}>
                      <input type="text" inputMode="decimal" value={item.quantity_num}
                        onChange={(e) => updateItem(item.id, { quantity_num: e.target.value })}
                        placeholder="0"
                        style={{ width: 44, textAlign: "center", fontSize: "0.9rem", fontWeight: 600, borderRight: "1px solid var(--border)", height: "100%", outline: "none" }} />
                      <select value={item.quantity_unit} onChange={(e) => updateItem(item.id, { quantity_unit: e.target.value })}
                        style={{ flex: 1, padding: "0 4px", fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 500, height: "100%", outline: "none", cursor: "pointer" }}>
                        {["Unit", "Ml", "Piece", "Kg", "Inches", "Ltr", "Ounces", "Pound", "Serves", "Slices", "Cm", "Gm", "Scoop"].map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                  </td>

                  {/* Base Price */}
                  <td style={{ padding: "0.5rem 0.75rem", width: 96, textAlign: "right" }}>
                    {hasMultipleVariantPrices ? (
                      <span
                        onClick={() => setEditingVariantItem(item)}
                        title="Variant prices — click to edit"
                        style={{ fontSize: "0.85rem", fontWeight: 700, color: "#c084fc", cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        {basePriceDisplay}
                      </span>
                    ) : (
                      <input type="text" inputMode="decimal" className="ci"
                        value={item.base_price}
                        onChange={(e) => updateItem(item.id, { base_price: e.target.value })}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          updateItem(item.id, { base_price: v > 0 ? String(v) : "" });
                        }}
                        placeholder="—"
                        style={{ width: "100%", textAlign: "right", padding: "0.4rem 0.6rem", color: "#e0e0e0", fontSize: "0.95rem", fontWeight: 600, borderRadius: 6, outline: "none" }} />
                    )}
                  </td>

                  {/* Online Price */}
                  <td style={{ padding: "0.85rem 1.25rem", width: 140, textAlign: "right" }}>
                    <span style={{ fontSize: hasMultipleVariantPrices ? "0.85rem" : "1rem", fontWeight: 800, color: "#fff", whiteSpace: "nowrap" }}>
                      {onlinePriceDisplay}
                    </span>
                  </td>

                  {/* Half */}
                  <td style={{ padding: "0.85rem 1.25rem", width: 80, textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <input type="checkbox" checked={item.has_half} onChange={(e) => updateItem(item.id, { has_half: e.target.checked })} />
                      {item.has_half && (
                        <span style={{ fontSize: "0.75rem", color: "#4ade80", fontWeight: 700 }}>₹{item.half_price}</span>
                      )}
                    </div>
                  </td>

                  {/* Add-ons */}
                  <td style={{ padding: "0.5rem 0.75rem", width: 180 }}>
                    <input className="ci" value={item.addons} onChange={(e) => updateItem(item.id, { addons: e.target.value })}
                      placeholder="e.g. Extra Cheese, Raita"
                      style={{ width: "100%", padding: "0.4rem 0.6rem", color: "var(--text-secondary)", fontSize: "0.85rem", borderRadius: 6, outline: "none" }} />
                  </td>

                  {/* Dynamic custom cols */}
                  {dynamicCols.map((col) => (
                    <td key={col} style={{ padding: "0.5rem 0.75rem", width: 130 }}>
                      <input className="ci"
                        value={item.custom_columns[col] || ""}
                        onChange={(e) => {
                          const updated = { ...item.custom_columns, [col]: e.target.value };
                          updateItem(item.id, { custom_columns: updated });
                        }}
                        style={{ width: "100%", padding: "0.4rem 0.6rem", color: "#c0c0c0", fontSize: "0.85rem", borderRadius: 6, outline: "none" }} />
                    </td>
                  ))}

                  {/* Delete */}
                  <td style={{ padding: "0.85rem 0.75rem", textAlign: "center", width: 40 }}>
                    <button className="del-btn" onClick={() => deleteItem(item.id)}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.95rem", padding: 4, borderRadius: 6 }}>
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "6rem", color: "var(--text-muted)", fontSize: "1rem" }}>
            No items match your search
          </div>
        )}
      </div>

      {/* ── VARIANT EDITOR MODAL ───────────────────────────────────────────── */}
      {editingVariantItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div style={{ width: "100%", maxWidth: 540, background: "#161616", border: "1px solid #272727", borderRadius: 16, padding: "1.75rem", boxShadow: "0 20px 40px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #272727", paddingBottom: "0.75rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#c084fc", textTransform: "uppercase", letterSpacing: "0.08em" }}>Variant Options & Pricing</span>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#fff", margin: 0 }}>{editingVariantItem.name}</h3>
              </div>
              <button onClick={() => setEditingVariantItem(null)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#aaa", marginBottom: 6, display: "block" }}>Item Title</label>
              <input
                type="text"
                value={editingVariantItem.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditingVariantItem((prev) => prev ? { ...prev, name: val } : null);
                  updateItem(editingVariantItem.id, { name: val });
                }}
                style={{ width: "100%", padding: "0.6rem 0.8rem", background: "#0a0a0a", border: "1px solid #333", borderRadius: 8, color: "#fff", fontSize: "0.9rem", fontWeight: 700 }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#aaa", marginBottom: 6, display: "block" }}>Variants String (Options & Pricing)</label>
              <textarea
                rows={3}
                value={editingVariantItem.variants}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditingVariantItem((prev) => prev ? { ...prev, variants: val } : null);
                  updateItem(editingVariantItem.id, { variants: val });
                }}
                placeholder="e.g. Veg (₹180), Egg (₹200), Chicken (₹220)"
                style={{ width: "100%", padding: "0.6rem 0.8rem", background: "#0a0a0a", border: "1px solid #333", borderRadius: 8, color: "#c084fc", fontSize: "0.88rem", fontFamily: "inherit" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #272727", paddingTop: "1rem" }}>
              <button
                onClick={() => dissolveVariantFamily(editingVariantItem)}
                style={{ ...btnBase, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
                title="Split variant family back into individual menu items"
              >
                ⟲ Dissolve / Ungroup Items
              </button>

              <button
                onClick={() => setEditingVariantItem(null)}
                style={{ ...btnBase, background: "#fff", color: "#000", border: "none", fontWeight: 800 }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,image/*,application/pdf" multiple style={{ display: "none" }} onChange={(e) => processFiles(e.target.files)} />

      {/* Custom Modal: Add-ons Count Prompt (Replacing window.prompt) */}
      {showAddonsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card bg-paper-dark border-purple-500/30 w-full max-w-sm p-6 space-y-4 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold text-ink">Generate Menu Add-Ons</h3>
              </div>
              <button onClick={() => setShowAddonsModal(false)} className="text-ink/40 hover:text-ink">
                ✕
              </button>
            </div>
            <p className="text-xs text-ink/70">How many add-on options should AI generate per menu item?</p>
            <div>
              <label className="text-[11px] font-semibold text-ink/60 uppercase block mb-1">Add-ons Per Item (1 - 6)</label>
              <input
                type="number"
                min="1"
                max="6"
                value={addonsCountInput}
                onChange={(e) => setAddonsCountInput(e.target.value)}
                className="input font-mono text-sm font-bold text-purple-400"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button onClick={() => setShowAddonsModal(false)} className="btn btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={() => {
                  const val = Math.min(Math.max(parseInt(addonsCountInput) || 3, 1), 6);
                  executeAddonsGeneration(val);
                }}
                className="btn bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-md transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" /> Generate Add-Ons
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal: Confirm Start Over */}
      {showConfirmStartOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card bg-paper-dark border-rose-500/30 w-full max-w-sm p-6 space-y-4 relative shadow-2xl">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <span className="text-rose-400 font-bold text-base">⚠️</span>
              <h3 className="text-sm font-bold text-ink">Reset Menu Automation</h3>
            </div>
            <p className="text-xs text-ink/70 leading-relaxed">
              Are you sure you want to start over? All currently loaded items and customizations will be cleared.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button onClick={() => setShowConfirmStartOver(false)} className="btn btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={() => {
                  resetMenuAutomation();
                  setShowConfirmStartOver(false);
                }}
                className="btn bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-md transition-all"
              >
                Yes, Start Over
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal: Error / Notice Banner */}
      {menuNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card bg-paper-dark border-line w-full max-w-sm p-5 space-y-3 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider">System Notification</h4>
              <button onClick={() => setMenuNotice(null)} className="text-ink/40 hover:text-ink text-xs font-bold">✕</button>
            </div>
            <p className="text-xs text-ink/80 leading-relaxed">{menuNotice}</p>
            <div className="flex justify-end pt-2">
              <button onClick={() => setMenuNotice(null)} className="btn btn-primary text-xs">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
