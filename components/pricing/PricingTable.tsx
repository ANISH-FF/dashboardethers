"use client";

import { useState } from "react";
import { Plus, Trash2, Download, TrendingUp, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
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
}

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

export function PricingTable({
  items,
  setItems,
  competitorCount,
  competitorNames = [],
  discountPct,
  commissionPct,
  adsPct,
  foodCostPct,
  priceEnding = "9_7_5"
}: TableProps) {

  const handleItemChange = (id: string, field: keyof StrategyItem, val: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };
        if (field === "myBrandPrice") {
          const compPrices = updated.competitors.map((c) => c.price);
          updated.suggestivePrice = recalculateSuggestivePrice(
            Number(val || 0),
            compPrices,
            discountPct,
            commissionPct,
            adsPct,
            priceEnding
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
          item.myBrandPrice,
          compPrices,
          discountPct,
          commissionPct,
          adsPct,
          priceEnding
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
        const c = item.competitors[i] || { name: `Competitor ${i + 1}`, price: 0 };
        row[`${c.name || `Comp ${i + 1}`} (Price)`] = c.price;
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
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pricing Strategy");
    XLSX.writeFile(workbook, `Ethers_Pricing_Strategy_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

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

  return (
    <div className="space-y-4">
      
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink/60">
          <span>Items Analyzed: <strong className="text-ink font-bold">{items.length}</strong></span>
          <span>•</span>
          <span className="text-emerald-400">Formula Mode: Live Auto-Calculation</span>
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

      {/* Main Datagrid Table */}
      <div className="card bg-paper border-line p-0 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-paper-dark/95 border-b border-line text-ink/70 uppercase tracking-wider font-bold text-[10px]">
                <th className="py-3.5 px-4 sticky left-0 bg-paper-dark z-10 min-w-[160px]">Item Name</th>
                <th className="py-3.5 px-4 min-w-[110px]">My Brand Price</th>

                {/* Dynamic Competitor Headers */}
                {Array.from({ length: competitorCount }).map((_, idx) => {
                  const compTitle = competitorNames[idx] || `Competitor ${idx + 1}`;
                  return (
                    <th key={idx} className="py-3.5 px-4 min-w-[170px] text-blue-400 border-l border-line/40">
                      <div className="font-bold text-[11px] text-blue-300 truncate" title={compTitle}>
                        {compTitle}
                      </div>
                      <div className="text-[9px] text-ink/40 font-normal lowercase tracking-normal">Matched Item & Price</div>
                    </th>
                  );
                })}

                <th className="py-3.5 px-4 min-w-[130px] text-purple-400 bg-purple-500/5 border-l border-line">Suggestive Price</th>
                <th className="py-3.5 px-4 min-w-[110px] text-amber-400">Discount ({discountPct}%)</th>
                <th className="py-3.5 px-4 min-w-[130px]">Commissionable Value</th>
                <th className="py-3.5 px-4 min-w-[110px] text-rose-400">Commission ({commissionPct}%)</th>
                <th className="py-3.5 px-4 min-w-[100px] text-cyan-400">Ads ({adsPct}%)</th>
                <th className="py-3.5 px-4 min-w-[110px] text-purple-400">Food Cost ({foodCostPct}%)</th>
                <th className="py-3.5 px-4 min-w-[120px] text-emerald-400 font-extrabold bg-emerald-500/5">Profit (₹)</th>
                <th className="py-3.5 px-4 min-w-[100px] text-emerald-400 font-extrabold bg-emerald-500/5">Profit %</th>
                <th className="py-3.5 px-4 text-right min-w-[60px]">Del</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line/40 font-medium">
              {items.map((item) => {
                // Exact formula calculations from spreadsheet
                const discountAmt = item.suggestivePrice * (discountPct / 100);
                const commVal = item.suggestivePrice - discountAmt;
                const commAmt = commVal * (commissionPct / 100);
                const adsAmt = commVal * (adsPct / 100);
                const foodCostAmt = item.myBrandPrice * (foodCostPct / 100);
                const profit = commVal - commAmt - adsAmt - foodCostAmt;
                const profitPct = item.suggestivePrice > 0 ? (profit / item.suggestivePrice) * 100 : 0;

                const isEndingPsychological = [9, 7, 5].includes(Math.round(item.suggestivePrice) % 10);

                return (
                  <tr key={item.id} className="hover:bg-paper-dark/60 transition-colors group">
                    
                    {/* Item Name */}
                    <td className="py-3 px-4 sticky left-0 bg-paper group-hover:bg-paper-dark transition-colors z-10">
                      <input
                        type="text"
                        value={item.itemName}
                        onChange={(e) => handleItemChange(item.id, "itemName", e.target.value)}
                        className="bg-transparent border-none text-xs font-bold text-ink focus:ring-1 focus:ring-ink/30 rounded px-1.5 py-1 w-full"
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
                                  Not Available
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

                    {/* Net Profit % */}
                    <td className="py-3 px-4 bg-emerald-500/5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                        profitPct >= 30 
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : profitPct > 0
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}>
                        {profitPct.toFixed(1)}%
                      </span>
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
