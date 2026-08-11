"use client";

import { useEffect, useState } from "react";
import type { MenuItem } from "@/lib/db";

type Result = {
  competitors: { name: string; price: number }[];
  suggestedPrice: number;
  reasoning: string;
  disclaimer: string;
  source?: string;
};

export default function PricingPage() {
  const [itemName, setItemName] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [matchedItem, setMatchedItem] = useState<MenuItem | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    fetch("/api/menu").then((r) => r.json()).then((d) => setItems(d.items || [])).catch(() => {});
    fetch("/api/settings").then((r) => r.json()).then((d) => setCity(d.settings?.city || "Mumbai")).catch(() => {});
  }, []);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!itemName.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setApplied(false);
    try {
      const res = await fetch("/api/pricing/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName, city })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setMatchedItem(items.find((i) => i.name.toLowerCase() === itemName.trim().toLowerCase()) || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not fetch competitor pricing.");
    } finally {
      setLoading(false);
    }
  }

  async function applyToMenu() {
    if (!matchedItem || !result) return;
    try {
      await fetch("/api/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: matchedItem.id, onlinePrice: result.suggestedPrice })
      });
      setApplied(true);
    } catch {
      // silently fail
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Competitor Price Bot</h1>
        <p className="text-sm text-ink/50">AI-gathered pricing for a dish, based on public listings nearby.</p>
      </div>

      <form onSubmit={runSearch} className="card flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="label mb-1 block">Dish name</label>
          <input className="input" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Butter Chicken" list="menu-items" />
          <datalist id="menu-items">
            {items.map((i) => (
              <option key={i.id} value={i.name} />
            ))}
          </datalist>
        </div>
        <div className="min-w-[160px]">
          <label className="label mb-1 block">City</label>
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" />
        </div>
        <button className="btn-primary" disabled={loading || !itemName.trim()}>
          {loading ? "Searching..." : "Compare prices"}
        </button>
      </form>

      {error && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
            <span className="mt-0.5 font-bold">!</span>
            <div>
              <p className="font-medium">{error}</p>
              <p className="text-amber-600 mt-1">Set a valid GEMINI_API_KEY in .env for live results.</p>
            </div>
          </div>
      )}

      {loading && (
        <div className="card flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-lime border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-ink/50">Gathering nearby listing prices...</span>
        </div>
      )}

      {result && !loading && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <p className="ai-badge">{result.disclaimer}</p>
            {result.source === "fallback" && (
              <span className="text-[10px] text-ink/40 bg-paper rounded px-2 py-0.5">Using sample data — add valid GEMINI_API_KEY for live results</span>
            )}
          </div>

          {result.competitors.length === 0 ? (
            <p className="text-sm text-ink/50">No competitor data found. {result.reasoning}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {result.competitors.map((c, idx) => (
                  <span key={idx} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-2 text-ink/50">₹{c.price}</span>
                  </span>
                ))}
              </div>

              <div className="rounded-lg bg-lime-light border border-lime p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-ink/50 uppercase">Suggested price for you</p>
                  <p className="text-2xl font-bold text-ink">₹{result.suggestedPrice}</p>
                </div>
                {matchedItem && (
                  <button className="btn-primary" onClick={applyToMenu} disabled={applied}>
                    {applied ? "Applied" : "Apply to menu"}
                  </button>
                )}
              </div>
            </div>
          )}

          <p className="text-sm text-ink/60">{result.reasoning}</p>

          {!matchedItem && itemName && (
            <p className="text-xs text-ink/40">
              No exact matching item in your menu. Add "{itemName}" in Menu Automation to apply this price directly.
            </p>
          )}
        </div>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-16 text-ink/20">
          <svg className="w-12 h-12 mx-auto mb-3 text-ink/15" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <p className="text-sm">Enter a dish name to compare competitor prices</p>
        </div>
      )}
    </div>
  );
}
