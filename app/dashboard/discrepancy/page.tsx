"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Record = { id: string; itemName: string; issueType: string; source: "Internal" | "Swiggy" | "Zomato"; detail: string };

export default function DiscrepancyPage() {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExternalSource, setHasExternalSource] = useState(true);

  async function runScan() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/discrepancy/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecords(data.records);
      setHasExternalSource(data.hasExternalSource);
    } catch (e: any) {
      setError(e.message || "Scan failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runScan();
  }, []);

  const sourceColor = { Internal: "bg-ink/5 text-ink/60", Zomato: "bg-red-50 text-red-700", Swiggy: "bg-orange-50 text-orange-700" };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Discrepancy Manager</h1>
          <p className="text-sm text-ink/50">Internal checks are instant. External checks are AI-read from your public listing.</p>
        </div>
        <button className="btn-secondary" onClick={runScan} disabled={loading}>
          {loading ? "Scanning…" : "↻ Re-scan"}
        </button>
      </div>

      {!hasExternalSource && (
        <div className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          No public Zomato/Swiggy listing URL set — only internal checks are running.{" "}
          <Link href="/dashboard/settings" className="underline">Add one in Settings</Link>.
        </div>
      )}

      {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="card text-sm text-ink/50">Scanning menu & public listing…</div>
      ) : records.length === 0 ? (
        <div className="card text-sm text-ink/40">No issues found. 🎉</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink/40">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Issue</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium">{r.itemName}</td>
                  <td className="px-4 py-3">{r.issueType}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sourceColor[r.source]}`}>{r.source}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href="/dashboard/menu" className="text-xs text-accent underline">
                      Fix in Menu
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
