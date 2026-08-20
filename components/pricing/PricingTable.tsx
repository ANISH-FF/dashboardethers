"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, Download, TrendingUp, CheckCircle2, AlertTriangle, Sparkles, Target, RotateCcw } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export type StrategyItem = {
  id: string;
  itemName: string;
  myBrandPrice: number;
  competitors: { name: string; price: number | null; url?: string }[];
  suggestivePrice: number;
};

interface TableProps {
  items: StrategyItem[];
  setItems: React.Dispatch<React.SetStateAction<StrategyItem[]>>;
  competitorCount: number;
  competitorNames?: string[];
  discountPct: number;
  commissionPct: number;
  adsPct: number;
  foodCostPct: number;
  priceEnding?: "9_7_5" | "round" | "none";
  // New: target profit %
  targetProfitPct?: number;
  onTargetProfitPctChange?: (val: number) => void;
}

// ─── Price ending helper ───────────────────────────────────────────────────
function applyPriceEnding(price: number, strategy: string = "9_7_5"): number {
  if (strategy !== "9_7_5" || price <= 10) return Math.round(price);
  const r = Math.round(price);
  const last = r % 10;
  if ([9, 7, 5].includes(last)) return r;
  if (last === 8 || last === 6 || last === 4) return r + 1;
  if (last === 3) return r + 2;
  if (last === 2) return r + 3;
  if (last === 1) return r - 2;
  return r - 1;
}

// ─── Forward: competitor-based suggestive price ────────────────────────────
function recalculateSuggestivePrice(
  myBrandPrice: number,
  competitorPrices: (number | null)[],
  discountPct: number,
  commissionPct: number,
  adsPct: number,
  priceEnding: string = "9_7_5"
): number {
  const validPrices = competitorPrices.map((p) => Number(p || 0)).filter((p) => p > 0);
  const totalDeductionsPct = (commissionPct + adsPct + discountPct) / 100;
  const costBasedPrice = myBrandPrice * (1 + totalDeductionsPct);

  if (validPrices.length === 0) {
    return applyPriceEnding(costBasedPrice, priceEnding);
  }

  const avg = validPrices.reduce((a, b) => a + b, 0) / validPrices.length;
  const max = Math.max(...validPrices);
  const marketBasedPrice = avg * 0.95;

  let suggestiveRaw = (costBasedPrice + marketBasedPrice) / 2;
  const minAcceptablePrice = myBrandPrice * 1.1;
  if (suggestiveRaw < minAcceptablePrice) suggestiveRaw = minAcceptablePrice;
  if (suggestiveRaw > max * 1.2) suggestiveRaw = max * 1.2;

  return applyPriceEnding(suggestiveRaw, priceEnding);
}

// ─── Reverse: given target profit %, calculate needed suggestive price ─────
// Formula derivation:
//   profit     = commVal × (1 - comm% - ads%) - foodCostAmt
//   commVal    = sp × (1 - disc%)
//   foodCostAmt = myBrandPrice × foodCost%
//   profitPct  = profit / sp
//
//   → sp = (myBrandPrice × foodCost%) /
//            [(1 - disc%) × (1 - comm% - ads%) - targetProfitPct/100]
//
// Returns null if target is mathematically unachievable with current settings.
function calcSuggestiveFromProfit(
  myBrandPrice: number,
  targetProfitPct: number,
  discountPct: number,
  commissionPct: number,
  adsPct: number,
  foodCostPct: number,
  priceEnding: string = "9_7_5"
): number | null {
  const disc   = discountPct    / 100;
  const comm   = commissionPct  / 100;
  const ads    = adsPct         / 100;
  const food   = foodCostPct    / 100;
  const target = targetProfitPct / 100;

  const denominator = (1 - disc) * (1 - comm - ads) - target;
  if (denominator <= 0.001) return null; // unachievable

  const raw = (myBrandPrice * food) / denominator;
  if (raw <= 0) return null;

  return applyPriceEnding(raw, priceEnding);
}

// ─── Max achievable profit % with current settings ─────────────────────────
function maxAchievableProfitPct(discountPct: number, commissionPct: number, adsPct: number): number {
  // When foodCost → 0, denominator → 0, target → (1-disc)*(1-comm-ads)
  const disc = discountPct   / 100;
  const comm = commissionPct / 100;
  const ads  = adsPct        / 100;
  return Math.floor((1 - disc) * (1 - comm - ads) * 100 * 10) / 10;
}

// ─── Component ─────────────────────────────────────────────────────────────
export function PricingTable({
  items,
  setItems,
  competitorCount,
  competitorNames = [],
  discountPct,
  commissionPct,
  adsPct,
  foodCostPct,
  priceEnding = "9_7_5",
  targetProfitPct = 20,
  onTargetProfitPctChange,
}: TableProps) {

  // Local state: which row's Profit % is being inline-edited
  const [editingProfitId, setEditingProfitId] = useState<string | null>(null);
  const [editingProfitVal, setEditingProfitVal] = useState<string>("");
  // Local draft for the global target profit % input in the toolbar
  const [draftTarget, setDraftTarget] = useState<string>(String(targetProfitPct));

  const maxPct = maxAchievableProfitPct(discountPct, commissionPct, adsPct);

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleItemChange = (id: string, field: keyof StrategyItem, val: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };
        if (field === "myBrandPrice") {
          const compPrices = updated.competitors.map((c) => c.price);
          updated.suggestivePrice = recalculateSuggestivePrice(
            Number(val || 0), compPrices, discountPct, commissionPct, adsPct, priceEnding
          );
        }
        return updated;
      })
    );
  };

  const handleCompetitorChange = (itemId: string, compIndex: number, name: string, price: number | null) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const comps = [...item.competitors];
        comps[compIndex] = { ...comps[compIndex], name, price };
        const compPrices = comps.map((c) => c.price);
        const newSuggestive = recalculateSuggestivePrice(
          item.myBrandPrice, compPrices, discountPct, commissionPct, adsPct, priceEnding
        );
        return { ...item, competitors: comps, suggestivePrice: newSuggestive };
      })
    );
  };

  const handleAddItem = () => {
    const newItem: StrategyItem = {
      id: `item_${Date.now()}`,
      itemName: "New Dish Item",
      myBrandPrice: 150,
      competitors: Array.from({ length: competitorCount }).map((_, i) => ({
        name: `Competitor ${i + 1}`,
        price: 180 + i * 20
      })),
      suggestivePrice: 199
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // ── Profit % per-row inline edit ──────────────────────────────────────────
  const startProfitEdit = (itemId: string, currentPct: number) => {
    setEditingProfitId(itemId);
    setEditingProfitVal(currentPct.toFixed(1));
  };

  const commitProfitEdit = (itemId: string) => {
    const newPct = parseFloat(editingProfitVal);
    if (!isNaN(newPct) && newPct > 0 && newPct < maxPct) {
      const item = items.find((i) => i.id === itemId);
      if (item) {
        const newSuggestive = calcSuggestiveFromProfit(
          item.myBrandPrice, newPct, discountPct, commissionPct, adsPct, foodCostPct, priceEnding
        );
        if (newSuggestive !== null) {
          setItems((prev) =>
            prev.map((i) => i.id === itemId ? { ...i, suggestivePrice: newSuggestive } : i)
          );
        }
      }
    }
    setEditingProfitId(null);
    setEditingProfitVal("");
  };

  // ── Apply target profit % to ALL items ────────────────────────────────────
  const handleApplyTargetToAll = () => {
    const tgt = parseFloat(draftTarget);
    if (isNaN(tgt) || tgt <= 0 || tgt >= maxPct) return;

    onTargetProfitPctChange?.(tgt);

    setItems((prev) =>
      prev.map((item) => {
        const newSuggestive = calcSuggestiveFromProfit(
          item.myBrandPrice, tgt, discountPct, commissionPct, adsPct, foodCostPct, priceEnding
        );
        return newSuggestive !== null ? { ...item, suggestivePrice: newSuggestive } : item;
      })
    );
  };

  // ── Export Excel ──────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (items.length === 0) return;

    const data = items.map((item) => {
      const discountAmt = item.suggestivePrice * (discountPct / 100);
      const commVal = item.suggestivePrice - discountAmt;
      const commAmt = commVal * (commissionPct / 100);
      const adsAmt = commVal * (adsPct / 100);
      const foodCostAmt = item.myBrandPrice * (foodCostPct / 100);
      const profit = commVal - commAmt - adsAmt - foodCostAmt;
      const profitPct = item.suggestivePrice > 0 ? (profit / item.suggestivePrice) * 100 : 0;

      const row: Record<string, any> = {
        "Item Name": item.itemName,
        "My Brand Price": item.myBrandPrice,
      };

      for (let i = 0; i < competitorCount; i++) {
        const compHeader = competitorNames[i]
          ? `${competitorNames[i]} (Price)`
          : `Competitor ${i + 1} (Price)`;
        const c = item.competitors[i];
        row[compHeader] = (c && c.price !== null && c.price > 0) ? c.price : "-";
      }

      row["Suggestive Price"] = item.suggestivePrice;
      row[`Discount (${discountPct}%)`] = Number(discountAmt.toFixed(2));
      row["Commissionable Value"] = Number(commVal.toFixed(2));
      row[`Commission (${commissionPct}%)`] = Number(commAmt.toFixed(2));
      row[`Ads (${adsPct}%)`] = Number(adsAmt.toFixed(2));
      row[`Food Cost (${foodCostPct}%)`] = Number(foodCostAmt.toFixed(2));
      row["Net Profit (₹)"] = Number(profit.toFixed(2));
      row["Profit %"] = `${profitPct.toFixed(1)}%`;

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);

    if (data.length > 0) {
      const colWidths = Object.keys(data[0]).map((key) => {
        let maxLen = key.length;
        data.forEach((r) => {
          const valStr = String(r[key] || "");
          if (valStr.length > maxLen) maxLen = valStr.length;
        });
        return { wch: Math.max(maxLen + 3, 12) };
      });
      worksheet["!cols"] = colWidths;
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pricing Strategy");
    XLSX.writeFile(workbook, `Ethers_Pricing_Strategy_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="card bg-paper-dark border-line p-12 text-center flex flex-col items-center justify-center">
        <Sparkles className="w-10 h-10 text-ink/30 mb-3" />
        <h3 className="text-base font-semibold text-ink">No Menu Items Added</h3>
        <p className="text-sm text-ink/50 mt-1 max-w-sm">Upload a menu file or add items manually to generate competitor pricing strategy.</p>
        <button onClick={handleAddItem} className="btn btn-primary text-xs mt-4 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add Item Manually
        </button>
      </div>
    );
  }

  const tgtNum = parseFloat(draftTarget);
  const tgtValid = !isNaN(tgtNum) && tgtNum > 0 && tgtNum < maxPct;

  return (
    <div className="space-y-4">

      {/* ── Header Actions Bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-zinc-300">
            Total Items: <strong className="text-white font-bold">{items.length}</strong>
          </span>
          <span className="text-zinc-600">|</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Fast Local Guard Active
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 font-medium text-[11px]">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Ethers AI Verified
          </span>
          {/* Auto-save indicator */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 font-medium text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            Auto-Save On
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleAddItem} className="btn btn-secondary text-xs flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-blue-400" /> Add Item
          </button>
          <button onClick={handleExportExcel} className="btn btn-secondary text-xs flex items-center gap-1.5 border-emerald-500/30 text-emerald-400">
            <Download className="w-3.5 h-3.5" /> Export Excel
          </button>
        </div>
      </div>

      {/* ── Target Profit % Toolbar ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-emerald-500/8 to-teal-500/5 border border-emerald-500/25 p-3.5 rounded-xl">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold text-emerald-300">Target Profit %</span>
        </div>

        {/* % input */}
        <div className="flex items-center gap-1.5 bg-paper-dark border border-emerald-500/30 rounded-lg px-3 py-1.5">
          <input
            type="number"
            min={1}
            max={Math.floor(maxPct)}
            step={0.5}
            value={draftTarget}
            onChange={(e) => setDraftTarget(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleApplyTargetToAll(); }}
            className="bg-transparent text-sm font-bold text-emerald-300 w-14 outline-none text-center"
          />
          <span className="text-xs text-emerald-400 font-bold">%</span>
        </div>

        {/* Apply button */}
        <button
          onClick={handleApplyTargetToAll}
          disabled={!tgtValid}
          className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg border transition-all ${
            tgtValid
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 hover:border-emerald-400/60"
              : "bg-zinc-800/50 border-zinc-700/50 text-zinc-600 cursor-not-allowed"
          }`}
        >
          <RotateCcw className="w-3 h-3" />
          Apply to All Items
        </button>

        {/* Info pills */}
        <div className="flex items-center gap-2 ml-auto text-[11px]">
          <span className="text-zinc-500">Max achievable with current settings:</span>
          <span className="font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
            {maxPct.toFixed(1)}%
          </span>
        </div>

        {/* Validation message */}
        {!tgtValid && draftTarget !== "" && (
          <span className="text-[11px] text-rose-400 font-medium w-full -mt-1">
            {tgtNum >= maxPct
              ? `⚠️ Target must be below ${maxPct.toFixed(1)}% (max achievable with your commission/discount/ads settings)`
              : "⚠️ Enter a valid profit % greater than 0"}
          </span>
        )}
      </div>

      {/* ── Main Datagrid Table ────────────────────────────────────────── */}
      <div className="card bg-paper border-line p-0 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-paper-dark/95 border-b border-line text-ink/70 uppercase tracking-wider font-bold text-[10px]">
                <th className="py-3.5 px-4 sticky left-0 bg-paper-dark z-20 min-w-[250px] w-[260px]">Item Name</th>
                <th className="py-3.5 px-4 min-w-[110px]">My Brand Price</th>

                {/* Dynamic Competitor Headers */}
                {Array.from({ length: competitorCount }).map((_, idx) => {
                  const compTitle = competitorNames[idx] || `Competitor ${idx + 1}`;
                  const compObj = items[0]?.competitors[idx];
                  const compUrl = compObj?.url;

                  return (
                    <th key={idx} className="py-3.5 px-4 min-w-[180px] max-w-[220px] text-blue-400 border-l border-line/40">
                      <div className="font-bold text-[11px] text-blue-300 truncate" title={compTitle}>
                        {compTitle}
                      </div>
                      {compUrl ? (
                        <a
                          href={compUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[9.5px] text-blue-400/80 hover:text-blue-300 underline font-normal lowercase tracking-normal flex items-center gap-1 mt-0.5"
                        >
                          🔗 Store Link
                        </a>
                      ) : (
                        <div className="text-[9px] text-ink/40 font-normal lowercase tracking-normal">Matched Item & Price</div>
                      )}
                    </th>
                  );
                })}

                <th className="py-3.5 px-4 min-w-[130px] text-purple-400 bg-purple-500/5 border-l border-line">Suggestive Price</th>
                <th className="py-3.5 px-4 min-w-[110px] text-amber-400">Discount ({discountPct}%)</th>
                <th className="py-3.5 px-4 min-w-[130px]">Commissionable Val</th>
                <th className="py-3.5 px-4 min-w-[110px] text-rose-400">Commission ({commissionPct}%)</th>
                <th className="py-3.5 px-4 min-w-[100px] text-cyan-400">Ads ({adsPct}%)</th>
                <th className="py-3.5 px-4 min-w-[110px] text-purple-400">Food Cost ({foodCostPct}%)</th>
                <th className="py-3.5 px-4 min-w-[120px] text-emerald-400 font-extrabold bg-emerald-500/5">Profit (₹)</th>
                <th className="py-3.5 px-4 min-w-[110px] text-emerald-400 font-extrabold bg-emerald-500/5">
                  <div>Profit %</div>
                  <div className="text-[9px] font-normal text-emerald-500/70 normal-case tracking-normal">click to set target</div>
                </th>
                <th className="py-3.5 px-4 text-right min-w-[60px]">Del</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line/40 font-medium">
              {items.map((item) => {
                // Profit calculations
                const discountAmt  = item.suggestivePrice * (discountPct / 100);
                const commVal      = item.suggestivePrice - discountAmt;
                const commAmt      = commVal * (commissionPct / 100);
                const adsAmt       = commVal * (adsPct / 100);
                const foodCostAmt  = item.myBrandPrice * (foodCostPct / 100);
                const profit       = commVal - commAmt - adsAmt - foodCostAmt;
                const profitPct    = item.suggestivePrice > 0 ? (profit / item.suggestivePrice) * 100 : 0;

                const isEndingPsychological = [9, 7, 5].includes(Math.round(item.suggestivePrice) % 10);
                const isEditingProfit = editingProfitId === item.id;

                return (
                  <tr key={item.id} className="hover:bg-paper-dark/60 transition-colors group">

                    {/* Item Name */}
                    <td className="py-3 px-4 sticky left-0 bg-paper group-hover:bg-paper-dark transition-colors z-20 min-w-[250px] w-[260px]">
                      <input
                        type="text"
                        value={item.itemName}
                        onChange={(e) => handleItemChange(item.id, "itemName", e.target.value)}
                        className="bg-transparent border-none text-xs font-bold text-ink focus:ring-1 focus:ring-ink/30 rounded px-1.5 py-1 w-full truncate"
                        title={item.itemName}
                      />
                    </td>

                    {/* My Brand Price */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-ink/40">₹</span>
                        <input
                          type="number"
                          value={item.myBrandPrice}
                          onChange={(e) => handleItemChange(item.id, "myBrandPrice", Number(e.target.value))}
                          className="bg-paper-dark border border-line rounded px-2 py-1 text-xs text-ink font-bold w-20 outline-none"
                        />
                      </div>
                    </td>

                    {/* Competitors 1..N */}
                    {Array.from({ length: competitorCount }).map((_, cIdx) => {
                      const comp = (item.competitors[cIdx] || { name: "", price: null }) as { name: string; price: number | null; url?: string };
                      const hasPrice = comp.price !== null && comp.price !== undefined && comp.price > 0;
                      const restaurantName = competitorNames[cIdx] || "";
                      const isRestaurantName = restaurantName && comp.name && (comp.name.toLowerCase().includes(restaurantName.toLowerCase()) || restaurantName.toLowerCase().includes(comp.name.toLowerCase()));
                      const cellDishName = isRestaurantName ? "" : comp.name;

                      return (
                        <td key={cIdx} className="py-3 px-4 border-l border-line/40">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <input
                                type="text"
                                value={cellDishName}
                                placeholder={hasPrice ? "Matched Dish Name" : "Not Available"}
                                onChange={(e) => handleCompetitorChange(item.id, cIdx, e.target.value, comp.price ?? 0)}
                                className="bg-transparent border-none text-[11px] text-ink/80 font-semibold w-full focus:ring-1 focus:ring-blue-500/30 rounded px-1 placeholder:text-ink/30"
                              />
                            </div>
                            <div className="flex items-center gap-1 font-mono whitespace-nowrap">
                              <span className="text-ink/40 text-[10px]">₹</span>
                              <input
                                type="number"
                                min={0}
                                value={hasPrice ? comp.price! : ""}
                                placeholder="0"
                                onChange={(e) => {
                                  const rawVal = e.target.value;
                                  const numVal = rawVal === "" ? 0 : parseFloat(rawVal) || 0;
                                  handleCompetitorChange(item.id, cIdx, comp.name, numVal);
                                }}
                                className={`border rounded px-1 py-0.5 text-[11px] font-bold w-12 text-center outline-none transition-all ${
                                  hasPrice
                                    ? "bg-paper-dark/80 border-line/60 text-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                                    : "bg-rose-500/10 border-rose-500/30 text-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30 placeholder:text-rose-400/50"
                                }`}
                              />
                              {!hasPrice && (
                                <span
                                  className="inline-block bg-rose-500/10 border border-rose-500/25 text-rose-400 text-[8.5px] font-bold px-1 py-0.5 rounded shrink-0 whitespace-nowrap cursor-pointer hover:bg-rose-500/20 transition-all leading-none"
                                  title="Type price in box to override Not Available"
                                >
                                  N/A
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}

                    {/* Suggestive Price */}
                    <td className="py-3 px-4 bg-purple-500/5 border-l border-line">
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-purple-400 font-bold">₹</span>
                        <input
                          type="number"
                          value={item.suggestivePrice}
                          onChange={(e) => handleItemChange(item.id, "suggestivePrice", Number(e.target.value))}
                          className="bg-paper-dark border border-purple-500/40 rounded px-2 py-1 text-xs text-purple-300 font-bold w-20 outline-none focus:ring-1 focus:ring-purple-400"
                        />
                        {isEndingPsychological && (
                          <span className="text-[9px] font-bold px-1 rounded bg-purple-500/20 text-purple-300">
                            .{(Math.round(item.suggestivePrice) % 10)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Discount Amount */}
                    <td className="py-3 px-4 font-mono text-amber-400">
                      ₹{discountAmt.toFixed(2)}
                    </td>

                    {/* Commissionable Value */}
                    <td className="py-3 px-4 font-mono text-ink/90 font-semibold">
                      ₹{commVal.toFixed(2)}
                    </td>

                    {/* Commission Amount */}
                    <td className="py-3 px-4 font-mono text-rose-400">
                      ₹{commAmt.toFixed(2)}
                    </td>

                    {/* Ads Amount */}
                    <td className="py-3 px-4 font-mono text-cyan-400">
                      ₹{adsAmt.toFixed(2)}
                    </td>

                    {/* Food Cost Amount */}
                    <td className="py-3 px-4 font-mono text-purple-400">
                      ₹{foodCostAmt.toFixed(2)}
                    </td>

                    {/* Net Profit Amount */}
                    <td className={`py-3 px-4 font-mono font-extrabold bg-emerald-500/5 text-sm ${profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      ₹{profit.toFixed(2)}
                    </td>

                    {/* Net Profit % — clickable to inline-edit target for this item */}
                    <td className="py-3 px-4 bg-emerald-500/5">
                      {isEditingProfit ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            autoFocus
                            min={0.1}
                            max={Math.floor(maxPct)}
                            step={0.5}
                            value={editingProfitVal}
                            onChange={(e) => setEditingProfitVal(e.target.value)}
                            onBlur={() => commitProfitEdit(item.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitProfitEdit(item.id);
                              if (e.key === "Escape") { setEditingProfitId(null); setEditingProfitVal(""); }
                            }}
                            className="bg-emerald-500/15 border border-emerald-500/50 rounded px-2 py-1 text-xs text-emerald-300 font-bold w-16 outline-none focus:ring-1 focus:ring-emerald-400 text-center"
                          />
                          <span className="text-[10px] text-emerald-500 font-bold">%</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => startProfitEdit(item.id, profitPct)}
                          title="Click to set a target profit % for this item"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold transition-all hover:ring-1 hover:ring-offset-1 hover:ring-offset-transparent cursor-pointer ${
                            profitPct >= 30
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:ring-emerald-500/50"
                              : profitPct > 0
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:ring-amber-500/50"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:ring-rose-500/50"
                          }`}
                        >
                          {profitPct.toFixed(1)}%
                          <span className="text-[8px] opacity-60">✎</span>
                        </button>
                      )}
                    </td>

                    {/* Delete Action */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1 rounded text-ink/30 hover:text-rose-400 hover:bg-paper-dark transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
