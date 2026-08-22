"use client";

import { useEffect, useState, useCallback } from "react";
import type { MenuItem } from "@/lib/db";

type Toast = { type: "success" | "error"; message: string };
type BatchProgress = { done: number; total: number; label: string } | null;

const BATCH_SIZE = 25;

export default function MenuAutomationPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgress>(null);
  const [onlineHike, setOnlineHike] = useState(15);
  const [halfPortionPct, setHalfPortionPct] = useState(60);
  const [history, setHistory] = useState<MenuItem[][]>([]);
  const [future, setFuture] = useState<MenuItem[][]>([]);


  const showToast = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 3500);
  };

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/menu");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems(data.items);
    } catch (e: any) {
      showToast({ type: "error", message: e.message || "Could not load the menu." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function pushHistory() {
    setHistory((h) => [...h, items]);
    setFuture([]);
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture((f) => [items, ...f]);
    setHistory((h) => h.slice(0, -1));
    setItems(prev);
  }

  function redo() {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((h) => [...h, items]);
    setFuture((f) => f.slice(1));
    setItems(next);
  }

  async function persist(next: MenuItem[]) {
    setItems(next);
  }

  async function updateField(id: string, patch: Partial<MenuItem>) {
    pushHistory();
    const next = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    setItems(next);
    try {
      await fetch("/api/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch })
      });
    } catch {
      showToast({ type: "error", message: "Couldn't save that change." });
    }
  }

  async function addItem() {
    try {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New item", category: "Uncategorized", basePrice: 0 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      pushHistory();
      setItems((prev) => [...prev, data.item]);
    } catch (e: any) {
      showToast({ type: "error", message: e.message || "Could not add item." });
    }
  }

  async function removeItem(id: string) {
    pushHistory();
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch("/api/menu", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
    } catch {
      showToast({ type: "error", message: "Couldn't delete that item." });
    }
  }

  function applyHikes() {
    pushHistory();
    const next = items.map((i) => ({
      ...i,
      onlinePrice: Math.round(i.basePrice * (1 + onlineHike / 100)),
      halfPortionPrice: i.halfPortionAvailable
        ? Math.round(i.basePrice * (halfPortionPct / 100))
        : i.halfPortionPrice
    }));
    setItems(next);
    Promise.all(
      next.map((i) =>
        fetch("/api/menu", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: i.id, onlinePrice: i.onlinePrice, halfPortionPrice: i.halfPortionPrice })
        })
      )
    ).catch(() => showToast({ type: "error", message: "Some prices failed to save." }));
    showToast({ type: "success", message: "Online & half-portion prices updated." });
  }

  async function runAIBatched(action: "ai-subcategories" | "ai-descriptions" | "ai-addons", label: string) {
    setBusy(action);
    setBatchProgress(null);
    pushHistory();

    try {
      let startIndex = 0;
      let latestItems: MenuItem[] = items;
      let done = false;

      // First call to find out how many items need processing
      const firstRes = await fetch(`/api/menu/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startIndex: 0, batchSize: BATCH_SIZE }),
      });
      const firstData = await firstRes.json();
      if (!firstRes.ok) throw new Error(firstData.error);

      latestItems = firstData.items || latestItems;
      setItems(latestItems);

      const totalMissing: number = firstData.totalMissing ?? latestItems.length;
      done = firstData.done ?? true;
      startIndex += BATCH_SIZE;

      setBatchProgress({ done: Math.min(BATCH_SIZE, totalMissing), total: totalMissing, label });

      // Continue remaining batches
      while (!done) {
        const res = await fetch(`/api/menu/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startIndex, batchSize: BATCH_SIZE }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        latestItems = data.items || latestItems;
        setItems(latestItems);
        done = data.done ?? true;
        startIndex += BATCH_SIZE;

        setBatchProgress({
          done: Math.min(startIndex, totalMissing),
          total: totalMissing,
          label,
        });
      }

      showToast({ type: "success", message: `${label} complete — ${totalMissing} item(s) processed!` });
    } catch (e: any) {
      showToast({ type: "error", message: e.message || `${label} failed.` });
    } finally {
      setBusy(null);
      setBatchProgress(null);
    }
  }

  function exportCSV() {
    const headers = ["Name", "Category", "Sub-category", "Diet", "Base Price", "Online Price", "Half Portion Price", "Description"];
    const rows = items.map((i) => [
      i.name,
      i.category,
      i.subCategory || "",
      i.diet,
      i.basePrice,
      i.onlinePrice ?? "",
      i.halfPortionPrice ?? "",
      (i.description || "").replace(/,/g, ";")
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ethers-menu.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Menu Automation</h1>
          <p className="text-sm text-ink/50">
            <span className="rounded-full bg-ink/5 px-2 py-0.5 font-medium">{items.length} items</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={undo} disabled={history.length === 0}>
            ↶ Undo
          </button>
          <button className="btn-secondary" onClick={redo} disabled={future.length === 0}>
            ↷ Redo
          </button>
          <button className="btn-secondary" onClick={exportCSV}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`rounded-md px-4 py-2 text-sm ${
            toast.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="card flex flex-wrap items-end gap-4">
        <button
          className="btn-primary"
          onClick={() => runAIBatched("ai-subcategories", "AI sub-categories")}
          disabled={busy !== null}
        >
          {busy === "ai-subcategories" ? "Working…" : "✨ AI Sub-Categories"}
        </button>
        <button
          className="btn-primary"
          onClick={() => runAIBatched("ai-descriptions", "AI descriptions")}
          disabled={busy !== null}
        >
          {busy === "ai-descriptions" ? "Working…" : "✨ AI Descriptions"}
        </button>
        <button
          className="btn-primary"
          onClick={() => runAIBatched("ai-addons", "AI add-ons")}
          disabled={busy !== null}
        >
          {busy === "ai-addons" ? "Working…" : "✨ AI Add-ons"}
        </button>

        <div className="ml-auto flex items-end gap-3">
          <div>
            <label className="label mb-1 block">Online hike %</label>
            <input
              type="number"
              className="input w-24"
              value={onlineHike}
              onChange={(e) => setOnlineHike(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label mb-1 block">Half portion %</label>
            <input
              type="number"
              className="input w-24"
              value={halfPortionPct}
              onChange={(e) => setHalfPortionPct(Number(e.target.value))}
            />
          </div>
          <button className="btn-secondary" onClick={applyHikes}>
            Apply
          </button>
        </div>
      </div>

      {/* Live Batch Progress Bar */}
      {batchProgress && (
        <div className="card space-y-2 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink/70">
              ✨ {batchProgress.label} — processing in batches…
            </span>
            <span className="text-xs text-ink/40">
              {batchProgress.done} / {batchProgress.total} items done
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-ink/10 overflow-hidden">
            <div
              className="h-2 rounded-full bg-accent transition-all duration-500"
              style={{ width: `${Math.round((batchProgress.done / batchProgress.total) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-ink/40">
            Saving progress after every {BATCH_SIZE} items — you can safely wait.
          </p>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <div className="p-8 text-center text-sm text-ink/40">Loading menu…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink/40">
            No items yet.{" "}
            <button className="text-accent underline" onClick={addItem}>
              Add your first item
            </button>
            .
          </div>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink/40">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Sub-category</th>
                <th className="px-4 py-3">Diet</th>
                <th className="px-4 py-3">Base ₹</th>
                <th className="px-4 py-3">Online ₹</th>
                <th className="px-4 py-3">Half ₹</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Add-ons</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-0 hover:bg-paper/60">
                  <td className="px-4 py-2">
                    <input
                      className="input"
                      value={item.name}
                      onChange={(e) => updateField(item.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className="input"
                      value={item.category}
                      onChange={(e) => updateField(item.id, { category: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <input
                        className="input"
                        value={item.subCategory || ""}
                        onChange={(e) => updateField(item.id, { subCategory: e.target.value })}
                      />
                      {item.aiFields?.includes("subCategory") && <span className="ai-badge">AI</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      className="input"
                      value={item.diet}
                      onChange={(e) => updateField(item.id, { diet: e.target.value as MenuItem["diet"] })}
                    >
                      <option value="veg">Veg</option>
                      <option value="nonveg">Non-veg</option>
                      <option value="egg">Egg</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      className="input w-24"
                      value={item.basePrice}
                      onChange={(e) => updateField(item.id, { basePrice: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-4 py-2 text-ink/60">{item.onlinePrice ?? "—"}</td>
                  <td className="px-4 py-2 text-ink/60">
                    {item.halfPortionAvailable ? item.halfPortionPrice ?? "—" : "—"}
                    <label className="ml-2 inline-flex items-center gap-1 text-xs text-ink/40">
                      <input
                        type="checkbox"
                        checked={item.halfPortionAvailable}
                        onChange={(e) => updateField(item.id, { halfPortionAvailable: e.target.checked })}
                      />
                      avail.
                    </label>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-start gap-1">
                      <textarea
                        className="input min-w-[180px]"
                        rows={2}
                        value={item.description || ""}
                        onChange={(e) => updateField(item.id, { description: e.target.value })}
                      />
                      {item.aiFields?.includes("description") && <span className="ai-badge">AI</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-1 max-w-[160px]">
                      {(item.addOns || []).map((a, idx) => (
                        <span key={idx} className="rounded-full bg-paper px-2 py-0.5 text-xs">
                          {a}
                        </span>
                      ))}
                      {item.aiFields?.includes("addOns") && <span className="ai-badge">AI</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <button className="text-xs text-red-500 hover:underline" onClick={() => removeItem(item.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <button className="btn-secondary" onClick={addItem}>
        + Add item
      </button>
    </div>
  );
}
