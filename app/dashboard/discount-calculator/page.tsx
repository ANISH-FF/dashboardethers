"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  Calculator, 
  Percent, 
  Store, 
  Plus, 
  Trash2, 
  Sparkles, 
  Upload, 
  Info, 
  CheckCircle2, 
  Tag, 
  Layers, 
  ChevronDown,
  RefreshCw,
  FileSpreadsheet
} from "lucide-react";

import { useBrand } from "@/components/BrandContext";

export type CodeType = "primary" | "stepper";

export interface DiscountCode {
  id: string;
  name: string; // e.g. "30% upto 75 on 199" or "Flat 125 on 599"
  type: CodeType;
  discount: number; // Max discount for primary, or Flat discount for stepper
  minOrder: number;
  percentage?: number; // e.g. 30 for 30%
  enabled: boolean;
}

const INITIAL_CODES: DiscountCode[] = [
  { id: "1", name: "30% upto 75 on 199", type: "primary", discount: 75, minOrder: 199, percentage: 30, enabled: true },
  { id: "2", name: "20% upto 50 on 199", type: "primary", discount: 50, minOrder: 199, percentage: 20, enabled: true },
  { id: "3", name: "Flat 125 on 599", type: "stepper", discount: 125, minOrder: 599, enabled: true },
  { id: "4", name: "Flat 125 on 649", type: "stepper", discount: 125, minOrder: 649, enabled: true },
  { id: "5", name: "Flat 150 on 699", type: "stepper", discount: 150, minOrder: 699, enabled: true },
  { id: "6", name: "Flat 150 on 749", type: "stepper", discount: 150, minOrder: 749, enabled: true },
  { id: "7", name: "Flat 200 on 899", type: "stepper", discount: 200, minOrder: 899, enabled: true },
  { id: "8", name: "Flat 200 on 999", type: "stepper", discount: 200, minOrder: 999, enabled: true },
];

export default function DiscountCalculator() {
  const { activeBrand } = useBrand();
  const [aov, setAov] = useState<number>(800);
  const [codes, setCodes] = useState<DiscountCode[]>(INITIAL_CODES);
  const [showAddModal, setShowAddModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [calcFormError, setCalcFormError] = useState<string | null>(null);
  const [bulkParseError, setBulkParseError] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // New Code Form State
  const [newCodeName, setNewCodeName] = useState("");
  const [newCodeType, setNewCodeType] = useState<CodeType>("primary");
  const [newDiscount, setNewDiscount] = useState<string>("");
  const [newMinOrder, setNewMinOrder] = useState<string>("");
  const [newPercentage, setNewPercentage] = useState<string>("");

  // Calculation Helpers
  const getItemBurn = (code: DiscountCode, targetAov: number): number => {
    if (!code.enabled || targetAov <= 0) return 0;
    if (code.type === "primary") {
      // Primary formula: Max Discount / AOV * 100
      return (code.discount / targetAov) * 100;
    } else {
      // Stepper formula: Flat Discount / Min Order * 100
      return (code.discount / code.minOrder) * 100;
    }
  };

  const calculatedItems = useMemo(() => {
    return codes.map((c) => {
      const burn = getItemBurn(c, aov);
      const formulaStr = c.type === "primary" 
        ? `${c.discount}/AOV *100` 
        : `${c.discount}/${c.minOrder} *100`;
      return {
        ...c,
        burn,
        formulaStr,
      };
    });
  }, [codes, aov]);

  const activeCalculatedItems = useMemo(() => {
    return calculatedItems.filter((i) => i.enabled);
  }, [calculatedItems]);

  const totalAverageBurn = useMemo(() => {
    if (activeCalculatedItems.length === 0) return 0;
    const sum = activeCalculatedItems.reduce((acc, curr) => acc + curr.burn, 0);
    return sum / activeCalculatedItems.length;
  }, [activeCalculatedItems]);

  const primaryAverageBurn = useMemo(() => {
    const primaryItems = activeCalculatedItems.filter((i) => i.type === "primary");
    if (primaryItems.length === 0) return 0;
    return primaryItems.reduce((acc, curr) => acc + curr.burn, 0) / primaryItems.length;
  }, [activeCalculatedItems]);

  const stepperAverageBurn = useMemo(() => {
    const stepperItems = activeCalculatedItems.filter((i) => i.type === "stepper");
    if (stepperItems.length === 0) return 0;
    return stepperItems.reduce((acc, curr) => acc + curr.burn, 0) / stepperItems.length;
  }, [activeCalculatedItems]);

  const [loadingBrand, setLoadingBrand] = useState(false);

  useEffect(() => {
    if (activeBrand?.id) {
      loadBrandDiscountCalculator(activeBrand.id);
    }
  }, [activeBrand?.id]);

  const loadBrandDiscountCalculator = async (bId: string) => {
    setLoadingBrand(true);
    try {
      const res = await fetch(`/api/discount-calculator/store?brandId=${bId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          if (json.data.aov !== undefined) setAov(json.data.aov);
          if (json.data.codes && Array.isArray(json.data.codes)) {
            setCodes(json.data.codes);
          } else {
            setCodes(INITIAL_CODES);
          }
        } else {
          setAov(800);
          setCodes(INITIAL_CODES);
        }
      }
    } catch (e) {
      console.error("Failed to load brand discount calculator:", e);
    } finally {
      setLoadingBrand(false);
    }
  };

  const saveBrandDiscountCalculator = (newCodes?: DiscountCode[], newAov?: number) => {
    if (!activeBrand?.id) return;
    fetch("/api/discount-calculator/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandId: activeBrand.id,
        brandName: activeBrand.name,
        aov: newAov !== undefined ? newAov : aov,
        codes: newCodes || codes,
      }),
    }).catch(() => null);
  };

  // Handlers
  const toggleCode = (id: string) => {
    setCodes((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c));
      saveBrandDiscountCalculator(next);
      return next;
    });
  };

  const deleteCode = (id: string) => {
    setCodes((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveBrandDiscountCalculator(next);
      return next;
    });
  };

  const handleAddCode = (e: React.FormEvent) => {
    e.preventDefault();
    setCalcFormError(null);
    const disc = parseFloat(newDiscount) || 0;
    const minO = parseFloat(newMinOrder) || 0;
    const pct = parseFloat(newPercentage) || undefined;

    if (!newCodeName || disc <= 0 || minO <= 0) {
      setCalcFormError("Please fill in valid code name, discount amount, and min order.");
      return;
    }

    const newEntry: DiscountCode = {
      id: crypto.randomUUID(),
      name: newCodeName,
      type: newCodeType,
      discount: disc,
      minOrder: minO,
      percentage: pct,
      enabled: true,
    };

    setCodes((prev) => {
      const next = [...prev, newEntry];
      saveBrandDiscountCalculator(next);
      return next;
    });

    setNewCodeName("");
    setNewDiscount("");
    setNewMinOrder("");
    setNewPercentage("");
    setShowAddModal(false);
  };

  // Smart Parser for Bulk Upload / Text input
  const parseAndAddBulkText = () => {
    setBulkParseError(null);
    if (!bulkText.trim()) return;
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsedCodes: DiscountCode[] = [];

    lines.forEach((line) => {
      // Check for Primary Code e.g. "30% upto 75 on 199" or "30% up to 75 on 199"
      const primaryMatch = line.match(/(\d+)%\s*(?:upto|up to)?\s*(\d+)\s*on\s*(\d+)/i);
      if (primaryMatch) {
        parsedCodes.push({
          id: crypto.randomUUID(),
          name: line,
          type: "primary",
          percentage: parseFloat(primaryMatch[1]),
          discount: parseFloat(primaryMatch[2]),
          minOrder: parseFloat(primaryMatch[3]),
          enabled: true,
        });
        return;
      }

      // Check for Stepper Code e.g. "Flat 125 on 599" or "125 on 599"
      const stepperMatch = line.match(/(?:flat)?\s*(\d+)\s*on\s*(\d+)/i);
      if (stepperMatch) {
        parsedCodes.push({
          id: crypto.randomUUID(),
          name: line.startsWith("Flat") || line.startsWith("flat") ? line : `Flat ${line}`,
          type: "stepper",
          discount: parseFloat(stepperMatch[1]),
          minOrder: parseFloat(stepperMatch[2]),
          enabled: true,
        });
        return;
      }
    });

    if (parsedCodes.length > 0) {
      setCodes((prev) => {
        const next = [...prev, ...parsedCodes];
        saveBrandDiscountCalculator(next);
        return next;
      });
      setBulkText("");
      setShowBulkInput(false);
    } else {
      setBulkParseError("Could not automatically parse lines. Please format as e.g. '30% upto 75 on 199' or 'Flat 125 on 599'.");
    }
  };

  if (!mounted || !activeBrand) {
    return null;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      {/* ── TOP HEADER BAR ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-ink/5 border border-line text-ink">
              <Calculator className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-ink tracking-tight">Discount Burn Calculator</h1>
          </div>
          <p className="mt-1 text-sm text-ink/60" suppressHydrationWarning>
            Calculate average discount burn % across Primary & Stepper codes based on Target AOV for <strong suppressHydrationWarning className="text-ink">{activeBrand.name}</strong>.
          </p>
        </div>

        {/* Target AOV Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-paper-dark border border-line rounded-xl p-2 px-4 shadow-sm">
            <span className="text-xs font-semibold text-ink/40 uppercase tracking-wider">Target AOV:</span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-ink/60">₹</span>
              <input
                type="number"
                value={aov}
                onChange={(e) => {
                  const val = Math.max(1, parseFloat(e.target.value) || 0);
                  setAov(val);
                  saveBrandDiscountCalculator(undefined, val);
                }}
                className="w-20 bg-transparent text-base font-extrabold text-ink focus:outline-none border-b border-ink/20 focus:border-ink text-center"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI METRICS SUMMARY ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Average Burn */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-paper via-paper-dark to-paper p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/50">Total Average Burn</span>
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-ink tracking-tight">
            {totalAverageBurn.toFixed(2)}%
          </div>
          <p className="mt-2 text-xs text-ink/40">
            Average of all {activeCalculatedItems.length} active discount codes
          </p>
        </div>

        {/* Primary Codes Burn */}
        <div className="rounded-2xl border border-line bg-paper-dark p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/50">Primary Codes Burn</span>
            <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Tag className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-ink tracking-tight">
            {primaryAverageBurn.toFixed(2)}%
          </div>
          <p className="mt-2 text-xs text-ink/40">
            Formula: Max Discount / AOV * 100
          </p>
        </div>

        {/* Stepper Codes Burn */}
        <div className="rounded-2xl border border-line bg-paper-dark p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/50">Stepper Codes Burn</span>
            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-ink tracking-tight">
            {stepperAverageBurn.toFixed(2)}%
          </div>
          <p className="mt-2 text-xs text-ink/40">
            Formula: Flat Discount / Min Order * 100
          </p>
        </div>

        {/* Selected Brand Stats */}
        <div className="rounded-2xl border border-line bg-paper-dark p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/50">Brand Target</span>
            <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Store className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-ink truncate">
            {activeBrand.name}
          </div>
          <p className="mt-2 text-xs text-ink/40 truncate">
            {activeBrand.type} · AOV ₹{aov}
          </p>
        </div>
      </div>

      {/* ── ACTION BUTTONS BAR ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-ink">Discount Codes ({codes.length})</h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-paper border border-line text-ink/60">
            {activeCalculatedItems.length} active in calculation
          </span>
          <div className="flex items-center gap-1.5 ml-1">
            <button
              onClick={() => {
                const next = codes.map((c) => ({ ...c, enabled: true }));
                setCodes(next);
                saveBrandDiscountCalculator(next);
              }}
              className="px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 transition-all active:scale-95 flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Select All</span>
            </button>
            <button
              onClick={() => {
                const next = codes.map((c) => ({ ...c, enabled: false }));
                setCodes(next);
                saveBrandDiscountCalculator(next);
              }}
              className="px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold border border-rose-500/30 transition-all active:scale-95 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Deselect All</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBulkInput(!showBulkInput)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-paper-dark border border-line text-sm font-semibold text-ink hover:bg-line/40 transition-colors"
          >
            <Upload className="w-4 h-4 text-ink/60" />
            Bulk Paste Codes
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-ink text-paper text-sm font-bold hover:bg-ink/90 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Custom Code
          </button>
        </div>
      </div>

      {/* ── BULK INPUT DRAWER ───────────────────────────────────────────────────── */}
      {showBulkInput && (
        <div className="rounded-2xl border border-line bg-paper-dark p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Smart Text / Multi-line Parser
            </h3>
            <span className="text-xs text-ink/40">Paste codes line by line</span>
          </div>

          <textarea
            rows={4}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`30% upto 75 on 199\n20% upto 50 on 199\nFlat 125 on 599\nFlat 150 on 699`}
            className="w-full bg-paper border border-line rounded-xl p-3 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-ink font-mono"
          />

          {bulkParseError && (
            <p className="text-xs text-rose-400 font-medium bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
              {bulkParseError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setShowBulkInput(false)}
              className="px-4 py-2 text-xs font-semibold text-ink/60 hover:text-ink"
            >
              Cancel
            </button>
            <button
              onClick={parseAndAddBulkText}
              className="px-4 py-2 rounded-lg bg-ink text-paper text-xs font-bold hover:bg-ink/90"
            >
              Parse & Add Codes
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN DISCOUNT TABLE ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-line bg-paper-dark overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-paper border-b border-line">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-ink/50 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={codes.length > 0 && codes.every((c) => c.enabled)}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      const next = codes.map((c) => ({ ...c, enabled: isChecked }));
                      setCodes(next);
                      saveBrandDiscountCalculator(next);
                    }}
                    title={codes.every((c) => c.enabled) ? "Deselect All Codes" : "Select All Codes"}
                    className="w-4 h-4 rounded accent-ink cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-ink/50">Format Example / Code</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-ink/50">Types of Codes</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-ink/50">Calculation Formula</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-ink/50 text-right">Average Burn %</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-ink/50 text-center w-16">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line/60 bg-paper-dark">
              {calculatedItems.map((item) => (
                <tr
                  key={item.id}
                  className={`transition-colors hover:bg-paper/40 ${!item.enabled ? "opacity-40" : ""}`}
                >
                  {/* Toggle Checkbox */}
                  <td className="px-6 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={() => toggleCode(item.id)}
                      className="w-4 h-4 rounded accent-ink cursor-pointer"
                    />
                  </td>

                  {/* Code Name */}
                  <td className="px-6 py-4 font-bold text-ink">
                    {item.name}
                  </td>

                  {/* Code Type Badge */}
                  <td className="px-6 py-4">
                    {item.type === "primary" ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Tag className="w-3 h-3" />
                        Primary Code
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Layers className="w-3 h-3" />
                        Stepper Code
                      </span>
                    )}
                  </td>

                  {/* Formula Calculation */}
                  <td className="px-6 py-4 font-mono text-xs text-ink/70">
                    {item.formulaStr}
                  </td>

                  {/* Calculated Burn % */}
                  <td className="px-6 py-4 text-right">
                    <span className="inline-block font-extrabold text-base text-ink bg-paper px-3 py-1 rounded-lg border border-line">
                      {item.burn.toFixed(2)}%
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => deleteCode(item.id)}
                      className="p-1.5 rounded-lg text-ink/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete code"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {calculatedItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-ink/40">
                    No discount codes added yet. Click "Add Custom Code" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Summary */}
        <div className="bg-paper p-5 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-ink/60">
            <Info className="w-4 h-4 text-ink/40 shrink-0" />
            <span>
              <strong>Target AOV = ₹{aov}</strong> · Burn formulas update dynamically based on AOV.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-ink/60 uppercase tracking-wider">Total Average Burn:</span>
            <span className="text-xl font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-xl">
              {totalAverageBurn.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* ── ADD CODE MODAL ────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-paper border border-line rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <h3 className="text-lg font-bold text-ink">Add Discount Code</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-ink/40 hover:text-ink"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCode} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink/60 uppercase block mb-1.5">Code Format / Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 30% upto 75 on 199 or Flat 150 on 699"
                  value={newCodeName}
                  onChange={(e) => setNewCodeName(e.target.value)}
                  className="w-full bg-paper-dark border border-line rounded-xl px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-ink"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-ink/60 uppercase block mb-1.5">Code Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewCodeType("primary")}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      newCodeType === "primary"
                        ? "bg-blue-500/10 border-blue-500 text-blue-400"
                        : "bg-paper-dark border-line text-ink/60 hover:text-ink"
                    }`}
                  >
                    Primary Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCodeType("stepper")}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      newCodeType === "stepper"
                        ? "bg-amber-500/10 border-amber-500 text-amber-400"
                        : "bg-paper-dark border-line text-ink/60 hover:text-ink"
                    }`}
                  >
                    Stepper Code
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink/60 uppercase block mb-1.5">
                    {newCodeType === "primary" ? "Max Discount (₹)" : "Flat Discount (₹)"}
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 75 or 125"
                    value={newDiscount}
                    onChange={(e) => setNewDiscount(e.target.value)}
                    className="w-full bg-paper-dark border border-line rounded-xl px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-ink"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-ink/60 uppercase block mb-1.5">Min Order (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 199 or 599"
                    value={newMinOrder}
                    onChange={(e) => setNewMinOrder(e.target.value)}
                    className="w-full bg-paper-dark border border-line rounded-xl px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-ink"
                  />
                </div>
              </div>

              {newCodeType === "primary" && (
                <div>
                  <label className="text-xs font-semibold text-ink/60 uppercase block mb-1.5">Percentage (%)</label>
                  <input
                    type="number"
                    placeholder="e.g. 30"
                    value={newPercentage}
                    onChange={(e) => setNewPercentage(e.target.value)}
                    className="w-full bg-paper-dark border border-line rounded-xl px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-ink"
                  />
                </div>
              )}

              {calcFormError && (
                <p className="text-xs text-rose-400 font-medium bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                  {calcFormError}
                </p>
              )}

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-ink/60 hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-ink text-paper text-xs font-bold hover:bg-ink/90 shadow-sm"
                >
                  Add Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
