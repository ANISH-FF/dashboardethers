"use client";

import { useState, useRef, useCallback, FormEvent, useEffect } from "react";
import * as XLSX from "xlsx";
import Image from "next/image";

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
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ data: result.split(",")[1], mediaType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
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
  const [history, setHistory] = useState<MenuItem[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const items = history[historyIndex] ?? [];

  const commitItems = useCallback((next: MenuItem[]) => {
    setHistory((h) => [...h.slice(0, historyIndex + 1), next]);
    setHistoryIndex((i) => i + 1);
  }, [historyIndex]);

  const undo = () => setHistoryIndex((i) => Math.max(0, i - 1));
  const redo = () => setHistoryIndex((i) => Math.min(history.length - 1, i + 1));

  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [funFact, setFunFact] = useState("Preparing the kitchen...");

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
  const [onlineHike, setOnlineHike] = useState(25);
  const [halfPct, setHalfPct] = useState(60);
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

  const applyHike = (hike: number, half: number) => {
    setOnlineHike(hike);
    setHalfPct(half);
    commitItems(items.map((item) => {
      const base = parseFloat(item.base_price || "0") || 0;
      const online = calcOnline(base, hike);
      return { ...item, online_price: online, half_price: calcHalf(online, half) };
    }));
  };

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    const allItems: MenuItem[] = [];

    try {
      for (const file of Array.from(files)) {
        if (/\.xlsx?$/i.test(file.name)) {
          setLoadingMsg("Parsing Excel: " + file.name);
          const buffer = await file.arrayBuffer();
          const wb = XLSX.read(buffer);
          const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);
          rows.forEach((row, idx) => {
            const name = String(row["Item Name"] || row["Name"] || "");
            const base = parseFloat(String(row["Base Price"] || "0")) || 0;
            const online = calcOnline(base, onlineHike);
            allItems.push({
              id: `${Date.now()}-xl-${idx}`,
              name,
              category: String(row["Category"] || "Main Course"),
              subcategory: String(row["Sub-Category"] || ""),
              description: String(row["Description"] || ""),
              quantity_num: String(row["Quantity"] || ""),
              quantity_unit: String(row["Unit"] || "Unit"),
              spice_level: resolveSpice(String(row["Spice Level"] || ""), name),
              variants: String(row["Variants"] || ""),
              base_price: base > 0 ? String(base) : "",
              online_price: online,
              half_price: calcHalf(online, halfPct),
              is_veg: String(row["Diet"]) !== "Non-Veg",
              has_half: !!row["Half Portion"],
              addons: String(row["Add-ons"] || ""),
              custom_columns: {},
            });
          });
        } else {
          setLoadingMsg("Extracting: " + file.name);
          const { data, mediaType } = await fileToBase64(file);
          const res = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: data, mediaType }),
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
      }
      commitItems([...items, ...allItems]);
    } catch (err) {
      alert("Error: " + String(err));
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const generateField = async (field: string) => {
    if (items.length === 0) return;
    let count: number | undefined;
    if (field === "addons") {
      const answer = window.prompt("How many add-ons per item?", "3");
      if (!answer) return; 
      count = Math.min(Math.max(parseInt(answer) || 3, 1), 6);
    }
    setLoading(true);
    setLoadingMsg(`✨ Generating ${field}...`);
    try {
      const res = await fetch("/api/generate-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, field, count }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      if (json.items) commitItems(json.items);
    } catch (err) {
      alert("Error: " + String(err));
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const runMagic = async (e: FormEvent) => {
    e.preventDefault();
    if (!magicPrompt.trim() || items.length === 0) return;
    setLoading(true);
    setLoadingMsg("✨ Running AI magic...");
    try {
      const res = await fetch("/api/magic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, prompt: magicPrompt }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      if (json.items) { commitItems(json.items); setMagicPrompt(""); }
    } catch (err) {
      alert("Error: " + String(err));
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const exportToExcel = () => {
    // 1. Menu Items Data
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

    // 2. Calculate Summary Statistics
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

    // 3. Generate Summary Sheet format
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
    // Set column widths for summary sheet to look clean
    wsSummary['!cols'] = [{ wch: 35 }, { wch: 40 }];

    // 4. Create Workbook and Append Sheets
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
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", background: "var(--bg-primary)" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ width: 80, height: 80, borderRadius: 18, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
            <Image src="/logo.png" alt="Ethers Logo" width={80} height={80} style={{ objectFit: "contain" }} />
          </div>
          <h1 style={{ fontSize: "2.8rem", fontWeight: 800, letterSpacing: "-0.04em", color: "#fff" }}>
            Ethers Menu Digitizer
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "1rem", fontSize: "1.05rem", maxWidth: 500, lineHeight: 1.5 }}>
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
            maxWidth: 560,
            border: `2px dashed ${dragging ? "#fff" : "var(--border)"}`,
            borderRadius: 24,
            padding: "3.5rem 2rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            cursor: "pointer",
            background: dragging ? "rgba(255,255,255,0.03)" : "var(--bg-secondary)",
            transition: "all 0.2s",
          }}
        >
          {/* Upload Icon */}
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: "0.5rem"
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
          
          <h2 style={{ fontWeight: 700, color: "#fff", fontSize: "1.35rem", margin: 0 }}>Upload your Menu</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0 }}>Select multiple photos, a PDF, or an Excel file</p>
          
          <div style={{ display: "flex", gap: "1.5rem", marginTop: "1rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Multi-Page Support
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              Photos
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              PDF
            </span>
          </div>
          
          <button style={{
            marginTop: "1.5rem", padding: "0.85rem 2.5rem",
            background: "#fff", color: "#000", border: "none", borderRadius: 10,
            fontWeight: 700, fontSize: "1rem", cursor: "pointer",
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
            <Image src="/logo.png" alt="Loading" width={48} height={48} style={{ objectFit: "contain", borderRadius: 8 }} />
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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-primary)" }}>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .tr-hover:hover  { background: var(--bg-hover) !important; }
        .tr-hover:hover .del-btn { opacity: 1 !important; }
        .del-btn { opacity: 0; transition: opacity 0.12s; }
        .ci:focus { background: rgba(255,255,255,0.05) !important; border-radius: 6px; }
        button:disabled { opacity: 0.35; cursor: not-allowed; }
      `}</style>

      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", padding: "1rem 1.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", flexShrink: 0, gap: "1.5rem" }}>

        {/* 1. Left: Logo & Item count */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontWeight: 800, fontSize: "1.25rem", letterSpacing: "-0.02em", color: "#fff" }}>
            Ethers Menu Digitizer
          </span>
          <div style={{ padding: "0.55rem 1.2rem", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, fontWeight: 600, fontSize: "0.85rem", color: "#ccc", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            {items.length} items
          </div>
        </div>

        {/* 2. Center: AI Buttons & Pricing Setup */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={() => generateField("subcategory")} disabled={loading} style={{ ...btnBase, background: "rgba(255,255,255,0.05)", color: "#e0e0e0" }}>
            ✦ AI Sub-Categories
          </button>
          <button onClick={() => generateField("description")} disabled={loading} style={{ ...btnBase, background: "rgba(255,255,255,0.05)", color: "#e0e0e0" }}>
            ✦ AI Descriptions
          </button>
          <button onClick={() => generateField("addons")} disabled={loading} style={{ ...btnBase, background: "rgba(251,146,60,0.08)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.2)" }}>
            + AI Add-ons
          </button>

          <div style={{ width: 1, height: 28, background: "var(--border)", margin: "0 0.25rem" }} />

          <div style={{ display: "flex", alignItems: "center", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            {[
              { label: "ONLINE HIKE", val: onlineHike, color: "#fff", setter: (v: number) => applyHike(v, halfPct) },
              { label: "HALF PORTION", val: halfPct, color: "#4ade80", setter: (v: number) => applyHike(onlineHike, v) },
            ].map((ctrl, i) => (
              <div key={i} style={{ padding: "0.4rem 1rem", borderRight: i === 0 ? "1px solid var(--border)" : "none" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{ctrl.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginTop: 2 }}>
                  <input
                    type="number"
                    value={ctrl.val}
                    onChange={(e) => ctrl.setter(Number(e.target.value))}
                    style={{ width: 36, fontWeight: 800, fontSize: "1.1rem", color: ctrl.color, textAlign: "center" }}
                  />
                  <span style={{ fontWeight: 700, fontSize: "0.85rem", color: ctrl.color }}>%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Right: History & Export */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {[
            { icon: "↩", fn: undo, disabled: historyIndex === 0, title: "Undo" },
            { icon: "↪", fn: redo, disabled: historyIndex >= history.length - 1, title: "Redo" },
          ].map((b) => (
            <button key={b.icon} onClick={b.fn} disabled={b.disabled} title={b.title}
              style={{ ...btnBase, width: 38, height: 38, padding: 0, justifyContent: "center", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: "1.1rem" }}>
              {b.icon}
            </button>
          ))}
          <button onClick={() => confirm("Start over? All data will be lost.") && (setHistory([[]]), setHistoryIndex(0))}
            style={{ ...btnBase, background: "var(--bg-card)", color: "var(--text-secondary)" }}>
            ⌂ Start Over
          </button>
          <button onClick={exportToExcel}
            style={{ ...btnBase, background: "#fff", color: "#000", border: "none", fontWeight: 800, boxShadow: "0 0 16px rgba(255,255,255,0.1)", fontSize: "0.9rem" }}>
            ↓ Export
          </button>
        </div>
      </div>

      {/* ── ACTION ROW ─────────────────────────────────────────────────────── */}
      <div style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-subtle)", padding: "0.65rem 1.75rem", display: "flex", alignItems: "center", gap: "0.8rem", flexShrink: 0 }}>
        {/* Search */}
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

        {/* ✦ Ask AI magic prompt */}
        <form onSubmit={runMagic} style={{ display: "flex", alignItems: "center", position: "relative" }}>
          <input
            type="text"
            placeholder='✦  Ask AI...  e.g. "increase prices by 10%"'
            value={magicPrompt}
            onChange={(e) => setMagicPrompt(e.target.value)}
            style={{
              padding: "0.55rem 3rem 0.55rem 1rem",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border)",
              borderRadius: 9,
              color: "var(--text-primary)",
              fontSize: "0.9rem",
              width: 440,
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

      {/* Loading bar */}
      {loading && (
        <div style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid var(--border-subtle)", padding: "0.55rem 1.75rem", display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0, animation: "pulse 2s ease-in-out infinite" }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
          <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{loadingMsg}</span>
        </div>
      )}

      {/* ── TABLE ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1500, fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)", position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid var(--border)" }}>
              {([
                { label: "#",      w: 48,   align: "center" },
                { label: "Diet",   w: 96,   align: "center" },
                { label: "Category", w: 125 },
                { label: "Sub-Category", w: 125 },
                { label: "Item Name  ·  Description", w: "auto" },
                { label: "Variants", w: 140 },
                { label: "Qty",    w: 130,  align: "center" },
                { label: "Base ₹", w: 96,   align: "right" },
                { label: `Online ₹ (+${onlineHike}%)`, w: 140, align: "right" },
                { label: "Half",   w: 80,   align: "center", isHalfCol: true },
                { label: "Add-ons", w: 200 },
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
                        onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                        onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
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
            {filtered.map((item, idx) => (
              <tr key={item.id} className="tr-hover" style={{ borderBottom: "1px solid var(--border-subtle)", background: "transparent" }}>

                {/* # */}
                <td style={{ padding: "0.85rem 1.25rem", textAlign: "center", color: "var(--text-muted)", fontWeight: 500, width: 48 }}>
                  {idx + 1}
                </td>

                {/* Diet + Spice */}
                <td style={{ padding: "0.75rem 1.25rem", textAlign: "center", width: 96 }}>
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
                  <input className="ci" value={item.name} onChange={(e) => updateItem(item.id, { name: e.target.value })}
                    placeholder="Item name"
                    style={{ width: "100%", padding: "0.4rem 0.6rem", color: "#fff", fontSize: "0.88rem", fontWeight: 700, letterSpacing: "0.01em", borderRadius: 6, outline: "none" }} />
                  <input className="ci" value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })}
                    placeholder="Description..."
                    style={{ width: "100%", padding: "0.3rem 0.6rem", color: "var(--text-muted)", fontSize: "0.8rem", borderRadius: 6, outline: "none", marginTop: 2 }} />
                </td>

                {/* Variants */}
                <td style={{ padding: "0.5rem 0.75rem", width: 140 }}>
                  <input className="ci" value={item.variants} onChange={(e) => updateItem(item.id, { variants: e.target.value })}
                    placeholder="e.g. Small, Medium, Large"
                    style={{ width: "100%", padding: "0.4rem 0.6rem", color: "var(--text-secondary)", fontSize: "0.82rem", borderRadius: 6, outline: "none" }} />
                </td>

                {/* Qty */}
                <td style={{ padding: "0.5rem 0.75rem", width: 130 }}>
                  <div style={{ display: "flex", alignItems: "center", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", height: 34 }}>
                    <input type="text" inputMode="decimal" value={item.quantity_num}
                      onChange={(e) => updateItem(item.id, { quantity_num: e.target.value })}
                      placeholder="0"
                      style={{ width: 48, textAlign: "center", fontSize: "0.9rem", fontWeight: 600, borderRight: "1px solid var(--border)", height: "100%", outline: "none" }} />
                    <select value={item.quantity_unit} onChange={(e) => updateItem(item.id, { quantity_unit: e.target.value })}
                      style={{ flex: 1, padding: "0 6px", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 500, height: "100%", outline: "none", cursor: "pointer" }}>
                      {["Unit", "Ml", "Piece", "Kg", "Inches", "Ltr", "Ounces", "Pound", "Serves", "Slices", "Cm", "Gm", "Scoop"].map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </td>

                {/* Base Price */}
                <td style={{ padding: "0.5rem 0.75rem", width: 96, textAlign: "right" }}>
                  <input type="text" inputMode="decimal" className="ci"
                    value={item.base_price}
                    onChange={(e) => updateItem(item.id, { base_price: e.target.value })}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      updateItem(item.id, { base_price: v > 0 ? String(v) : "" });
                    }}
                    placeholder="—"
                    style={{ width: "100%", textAlign: "right", padding: "0.4rem 0.6rem", color: "#e0e0e0", fontSize: "0.95rem", fontWeight: 600, borderRadius: 6, outline: "none" }} />
                </td>

                {/* Online Price */}
                <td style={{ padding: "0.85rem 1.25rem", width: 140, textAlign: "right" }}>
                  <span style={{ fontSize: "1rem", fontWeight: 800, color: "#fff" }}>₹{item.online_price}</span>
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
                <td style={{ padding: "0.5rem 0.75rem", width: 200 }}>
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
                    style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: "0.95rem", padding: 4, borderRadius: 6 }}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "6rem", color: "var(--text-muted)", fontSize: "1rem" }}>
            No items match your search
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,image/*,application/pdf" multiple style={{ display: "none" }} onChange={(e) => processFiles(e.target.files)} />
    </div>
  );
}
