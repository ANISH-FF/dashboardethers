"use client";

import { useRef, useState } from "react";

type Insights = {
  bestSeller: string;
  worstSeller: string;
  revenueByPlatform: { platform: string; revenue: number }[];
  marginTrend: string;
  dayOverDayChange: string;
  insights: string[];
};

export default function ReportsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setLoading(true);
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/reports/generate", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInsights(data.insights);
    } catch (e: any) {
      setError(e.message || "Something went wrong generating the report.");
      setInsights(null);
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    if (!insights) return;
    const lines = [
      ["Metric", "Value"],
      ["Best seller", insights.bestSeller],
      ["Worst seller", insights.worstSeller],
      ["Margin trend", insights.marginTrend],
      ["Day-over-day change", insights.dayOverDayChange],
      [],
      ["Platform", "Revenue"],
      ...insights.revenueByPlatform.map((p) => [p.platform, String(p.revenue)]),
      [],
      ["Insights"],
      ...insights.insights.map((i) => [i])
    ];
    const csv = lines.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ethers-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Reports Automation</h1>
        <p className="text-sm text-ink/50">Upload your daily sales export (CSV) and get an AI-built report.</p>
      </div>

      <div
        className={`card flex flex-col items-center justify-center gap-2 border-2 border-dashed py-12 text-center transition-colors ${
          dragOver ? "border-accent bg-accent/5" : "border-line"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        <p className="text-sm text-ink/60">Drag & drop a CSV export here, or</p>
        <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
          Choose file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {fileName && <p className="mt-2 text-xs text-ink/40">Last uploaded: {fileName}</p>}
      </div>

      {loading && <div className="card text-sm text-ink/50">Analyzing your data with AI…</div>}

      {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {insights && !loading && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="btn-secondary" onClick={exportCSV}>
              ⬇ Export report (CSV)
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card">
              <p className="label">Best seller</p>
              <p className="mt-1 text-lg font-semibold">{insights.bestSeller}</p>
            </div>
            <div className="card">
              <p className="label">Worst seller</p>
              <p className="mt-1 text-lg font-semibold">{insights.worstSeller}</p>
            </div>
            <div className="card">
              <p className="label">Margin trend</p>
              <p className="mt-1 text-sm">{insights.marginTrend}</p>
            </div>
            <div className="card">
              <p className="label">Day-over-day change</p>
              <p className="mt-1 text-sm">{insights.dayOverDayChange}</p>
            </div>
          </div>

          <div className="card">
            <p className="label mb-3">Revenue by platform</p>
            <table className="w-full text-sm">
              <tbody>
                {insights.revenueByPlatform.map((p, idx) => (
                  <tr key={idx} className="border-b border-line last:border-0">
                    <td className="py-2">{p.platform}</td>
                    <td className="py-2 text-right font-medium">₹{p.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <p className="label mb-2">AI insights</p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {insights.insights.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
