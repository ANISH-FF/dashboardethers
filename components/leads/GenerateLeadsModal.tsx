"use client";

import { useState } from "react";
import { LeadItem } from "@/lib/db";
import { X, Sparkles, MapPin, Store, Hash, AlertCircle } from "lucide-react";

interface GenerateLeadsModalProps {
  onClose: () => void;
  onLeadsGenerated: (newLeads: LeadItem[]) => void;
}

export function GenerateLeadsModal({ onClose, onLeadsGenerated }: GenerateLeadsModalProps) {
  const [location, setLocation] = useState("Bistupur, Jamshedpur");
  const [category, setCategory] = useState("Restaurant");
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/leads/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, category, count })
      });

      const data = await res.json();

      if (res.ok && data.success && Array.isArray(data.leads)) {
        onLeadsGenerated(data.leads);
        onClose();
      } else {
        throw new Error(data.error || "Failed to generate leads");
      }
    } catch (err: any) {
      console.error("AI Lead Gen Error:", err);
      setError(err.message || "An error occurred while generating leads.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="card bg-paper border-line w-full max-w-md p-0 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-paper-dark/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">AI Lead Discovery</h3>
              <p className="text-xs text-ink/60">Generate targeted B2B leads using Gemini AI (Single API Call)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink/40 hover:text-ink hover:bg-paper-dark transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleGenerate} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Location Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink/80 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-400" /> Target Location / City
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Bistupur, Jamshedpur"
              className="bg-paper-dark border border-line rounded-lg px-3.5 py-2 text-xs text-ink w-full focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </div>

          {/* Category Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink/80 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-emerald-400" /> Business Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-paper-dark border border-line rounded-lg px-3.5 py-2 text-xs text-ink w-full focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            >
              <option value="Restaurant">Restaurant</option>
              <option value="Cafe">Cafe</option>
              <option value="Bakery">Bakery</option>
              <option value="Fast Food">Fast Food</option>
            </select>
          </div>

          {/* Number of Leads */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink/80 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-purple-400" /> Max Leads Count (Single API Call)
            </label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="bg-paper-dark border border-line rounded-lg px-3.5 py-2 text-xs text-ink w-full focus:outline-none focus:ring-1 focus:ring-purple-500/50"
            >
              <option value={5}>5 Leads</option>
              <option value={10}>10 Leads (Max)</option>
            </select>
          </div>

          <div className="p-3 rounded-lg bg-paper-dark/80 border border-line/60 text-[11px] text-ink/60 leading-relaxed">
            💡 Excludes national chains (KFC, Domino&apos;s, etc.) to fetch only local independent business opportunities.
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary text-xs bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Fetching AI Leads...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                  <span>Generate Leads</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
