"use client";

import { useState, useEffect } from "react";
import {
  MapPin,
  Users,
  Percent,
  Sparkles,
  Zap,
  DollarSign,
  Layers,
  Settings2,
  FileSpreadsheet,
  ShieldCheck,
  AlertTriangle,
  Link,
  Bot,
  Building2,
  CheckCircle2,
} from "lucide-react";

export type ResearchMode = "names" | "links";

interface HeaderProps {
  location: string;
  setLocation: (loc: string) => void;
  researchMode: ResearchMode;
  setResearchMode: (mode: ResearchMode) => void;
  manualCompetitors: string;
  setManualCompetitors: (val: string) => void;
  manualCompetitorLinks: string;
  setManualCompetitorLinks: (val: string) => void;
  competitorCount: number;
  setCompetitorCount: (count: number) => void;
  discountPct: number;
  setDiscountPct: (val: number) => void;
  commissionPct: number;
  setCommissionPct: (val: number) => void;
  adsPct: number;
  setAdsPct: (val: number) => void;
  foodCostPct: number;
  setFoodCostPct: (val: number) => void;
  priceEnding?: "9_7_5" | "round" | "none";
  setPriceEnding?: (val: "9_7_5" | "round" | "none") => void;
  onOpenUploadModal: () => void;
  onOpenPromptModal: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function PricingHeader({
  location,
  setLocation,
  researchMode,
  setResearchMode,
  manualCompetitors,
  setManualCompetitors,
  manualCompetitorLinks,
  setManualCompetitorLinks,
  competitorCount,
  setCompetitorCount,
  discountPct,
  setDiscountPct,
  commissionPct,
  setCommissionPct,
  adsPct,
  setAdsPct,
  foodCostPct,
  setFoodCostPct,
  onOpenUploadModal,
  onOpenPromptModal,
  onGenerate,
  isGenerating,
}: HeaderProps) {
  // Internal competitor name and URL inputs synchronized with count
  const [compInputs, setCompInputs] = useState<string[]>([]);
  const [linkInputs, setLinkInputs] = useState<string[]>([]);

  useEffect(() => {
    const nameParts = manualCompetitors.split(",").map((s) => s.trim());
    const linkParts = manualCompetitorLinks.split(",").map((s) => s.trim());
    setCompInputs(Array.from({ length: competitorCount }, (_, i) => nameParts[i] || ""));
    setLinkInputs(Array.from({ length: competitorCount }, (_, i) => linkParts[i] || ""));
  }, [competitorCount, manualCompetitors, manualCompetitorLinks]);

  const handleCompInput = (idx: number, value: string) => {
    const next = [...compInputs];
    next[idx] = value;
    setCompInputs(next);
    setManualCompetitors(next.filter(Boolean).join(", "));
  };

  const handleLinkInput = (idx: number, value: string) => {
    const next = [...linkInputs];
    next[idx] = value;
    setLinkInputs(next);
    setManualCompetitorLinks(next.filter(Boolean).join(", "));
  };

  const filledNamesCount = compInputs.filter((v) => v.trim().length > 0).length;
  const filledLinksCount = linkInputs.filter((v) => v.trim().length > 0).length;

  return (
    <div className="space-y-4">

      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-paper-dark border border-line text-white shadow-sm">
              <Zap className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-ink tracking-tight">Pricing Strategy Engine</h1>
          </div>
          <p className="mt-1 text-sm text-ink/50">
            Benchmark competitor prices, auto-calculate suggestive prices, commission, ads & food cost margins.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenUploadModal}
            className="btn btn-secondary text-xs flex items-center gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Upload File [EXCEL, PDF, IMAGES]</span>
          </button>

          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="btn btn-primary text-xs flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg"
          >
            <Sparkles className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
            <span>{isGenerating ? "Processing..." : "Generate Strategy"}</span>
          </button>
        </div>
      </div>

      {/* Control Panel */}
      <div className="card bg-paper-dark border-line p-4 space-y-4 shadow-xl">

        {/* Row 1: Location | Competition Count (Max 10) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Location */}
          <div>
            <label className="label text-[10px] flex items-center gap-1">
              <MapPin className="w-3 h-3 text-rose-400" /> Brand Specific Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Golmuri, Jamshedpur"
              className="input text-xs font-mono"
            />
          </div>

          {/* Competition Count (1 to 10) */}
          <div>
            <label className="label text-[10px] flex items-center gap-1">
              <Users className="w-3 h-3 text-blue-400" /> Competition Count (Max 10)
            </label>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCompetitorCount(num)}
                  className={`flex-1 min-w-[28px] py-2 text-xs font-bold rounded-lg border transition-all ${
                    competitorCount === num
                      ? "bg-blue-500/20 border-blue-500 text-blue-400 shadow-sm"
                      : "bg-paper border-line text-ink/60 hover:text-ink"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Research Mode Selector & Competitor Inputs */}
        <div className="pt-3 border-t border-line/50 space-y-3">
          
          {/* Mode Switcher Tabs */}
          <div>
            <label className="label text-[10px] flex items-center gap-1 mb-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" /> Competitor Pricing Research Method
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              {/* Mode 1: Competitor Brand Names */}
              <button
                type="button"
                onClick={() => setResearchMode("names")}
                className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                  researchMode === "names"
                    ? "bg-blue-500/15 border-blue-500/80 text-blue-300 shadow-md ring-1 ring-blue-500/40"
                    : "bg-paper border-line text-ink/60 hover:text-ink hover:border-line/80"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-ink">Competitor Brand Names</div>
                    <div className="text-[10px] text-ink/40">Scrape by restaurant names</div>
                  </div>
                </div>
                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 shrink-0">
                  80% Accuracy
                </span>
              </button>

              {/* Mode 2: Direct Store Links */}
              <button
                type="button"
                onClick={() => setResearchMode("links")}
                className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                  researchMode === "links"
                    ? "bg-emerald-500/15 border-emerald-500/80 text-emerald-300 shadow-md ring-1 ring-emerald-500/40"
                    : "bg-paper border-line text-ink/60 hover:text-ink hover:border-line/80"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Link className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-ink">Direct Store Links</div>
                    <div className="text-[10px] text-ink/40">Paste exact Swiggy/Zomato URLs</div>
                  </div>
                </div>
                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shrink-0">
                  100% Accuracy
                </span>
              </button>

            </div>
          </div>

          {researchMode === "names" && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <label className="label text-[10px] flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-blue-400" />
                  Competitor Brand Names (~80% Accuracy)
                  <span className="text-ink/40 ml-1">(System searches Swiggy by restaurant names)</span>
                </label>
                <span className="flex items-center gap-1 text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded-full px-2 py-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  {filledNamesCount}/{competitorCount} Names Filled · 80% Accuracy
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {compInputs.map((val, idx) => (
                  <div key={idx} className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-ink/30 select-none pointer-events-none">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => handleCompInput(idx, e.target.value)}
                      placeholder={`Restaurant ${idx + 1}`}
                      className="input text-xs font-mono pl-6 placeholder:text-ink/25"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {researchMode === "links" && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <label className="label text-[10px] flex items-center gap-1">
                  <Link className="w-3 h-3 text-emerald-400" />
                  Direct Swiggy / Zomato Store URLs (100% Accuracy)
                  <span className="text-ink/40 ml-1">(System scrapes direct URLs with exact store matching)</span>
                </label>
                <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  {filledLinksCount}/{competitorCount} URLs Pasted · 100% Accuracy
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {linkInputs.map((val, idx) => (
                  <div key={idx} className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-emerald-500/50 select-none pointer-events-none">
                      {idx + 1}.
                    </span>
                    <input
                      type="url"
                      value={val}
                      onChange={(e) => handleLinkInput(idx, e.target.value)}
                      placeholder={`https://swiggy.com/restaurants/...`}
                      className="input text-xs font-mono pl-6 placeholder:text-ink/25 border-emerald-500/30 focus:border-emerald-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Row 3: Financial Modifiers */}
        <div className="pt-3 border-t border-line/60 grid grid-cols-2 sm:grid-cols-4 gap-3">

          {/* Discount % */}
          <div className="p-2.5 rounded-lg bg-paper border border-line flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">Discount %</span>
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(Number(e.target.value))}
                  className="w-14 bg-paper-dark border border-line rounded px-1.5 py-0.5 font-mono text-xs text-ink font-bold"
                />
                <span className="text-xs text-ink/40">%</span>
              </div>
            </div>
            <div className="p-2 rounded bg-amber-500/10 text-amber-400">
              <Percent className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Commission % */}
          <div className="p-2.5 rounded-lg bg-paper border border-line flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">Commission %</span>
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  value={commissionPct}
                  onChange={(e) => setCommissionPct(Number(e.target.value))}
                  className="w-14 bg-paper-dark border border-line rounded px-1.5 py-0.5 font-mono text-xs text-ink font-bold"
                />
                <span className="text-xs text-ink/40">%</span>
              </div>
            </div>
            <div className="p-2 rounded bg-rose-500/10 text-rose-400">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Ads % */}
          <div className="p-2.5 rounded-lg bg-paper border border-line flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">Ads %</span>
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  value={adsPct}
                  onChange={(e) => setAdsPct(Number(e.target.value))}
                  className="w-14 bg-paper-dark border border-line rounded px-1.5 py-0.5 font-mono text-xs text-ink font-bold"
                />
                <span className="text-xs text-ink/40">%</span>
              </div>
            </div>
            <div className="p-2 rounded bg-cyan-500/10 text-cyan-400">
              <Percent className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Food Cost % */}
          <div className="p-2.5 rounded-lg bg-paper border border-line flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">Food Cost %</span>
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  value={foodCostPct}
                  onChange={(e) => setFoodCostPct(Number(e.target.value))}
                  className="w-14 bg-paper-dark border border-line rounded px-1.5 py-0.5 font-mono text-xs text-ink font-bold"
                />
                <span className="text-xs text-ink/40">%</span>
              </div>
            </div>
            <div className="p-2 rounded bg-purple-500/10 text-purple-400">
              <Percent className="w-3.5 h-3.5" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
