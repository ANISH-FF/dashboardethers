"use client";

import { useEffect, useState } from "react";
import type { MenuItem } from "@/lib/db";

export default function PicturesPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/menu");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setItems(data.items);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function openSuggestions(item: MenuItem) {
    setActiveItem(item);
    setSuggestions([]);
    setSuggesting(true);
    setError(null);
    try {
      const res = await fetch("/api/pictures/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName: item.name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuggestions(data.images);
    } catch (e: any) {
      setError(e.message || "Could not fetch suggestions.");
    } finally {
      setSuggesting(false);
    }
  }

  async function applyImage(url: string) {
    if (!activeItem) return;
    await fetch("/api/menu", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activeItem.id, imageUrl: url })
    });
    setItems((prev) => prev.map((i) => (i.id === activeItem.id ? { ...i, imageUrl: url } : i)));
    setActiveItem(null);
  }

  async function handleManualUpload(item: MenuItem, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/pictures/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    await fetch("/api/menu", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, imageUrl: data.url })
    });
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, imageUrl: data.url } : i)));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Pictures Automation</h1>
        <p className="text-sm text-ink/50">AI-suggested photos for every dish, or upload your own.</p>
      </div>

      {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="card text-sm text-ink/50">Loading menu…</div>
      ) : items.length === 0 ? (
        <div className="card text-sm text-ink/40">No menu items yet — add some in Menu Automation first.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="card">
              <div className="mb-3 flex h-36 items-center justify-center overflow-hidden rounded-md bg-paper">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-ink/30">No photo yet</span>
                )}
              </div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-ink/40">{item.category}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-secondary text-xs" onClick={() => openSuggestions(item)}>
                  ✨ AI suggest
                </button>
                <label className="btn-secondary cursor-pointer text-xs">
                  Upload
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleManualUpload(item, file);
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setActiveItem(null)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">AI photo suggestions — {activeItem.name}</h2>
              <button className="text-sm text-ink/40" onClick={() => setActiveItem(null)}>✕</button>
            </div>
            <p className="mb-3 text-xs text-ink/40">
              AI-gathered from public sources — review before applying.
            </p>
            {suggesting ? (
              <p className="text-sm text-ink/50">Searching for photos…</p>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-ink/50">No suggestions found. Try uploading manually instead.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {suggestions.map((url, idx) => (
                  <button key={idx} className="group overflow-hidden rounded-md border border-line" onClick={() => applyImage(url)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-32 w-full object-cover group-hover:opacity-80" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
