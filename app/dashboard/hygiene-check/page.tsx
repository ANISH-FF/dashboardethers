"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Search,
  Link as LinkIcon,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Camera,
  FileText,
  Layers,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Utensils,
  Store,
  Clock,
  Phone,
  CreditCard,
  Tag,
  Award,
  Info,
  ChevronRight,
  Download,
  Share2,
  ExternalLink,
  Star,
  Building2,
  Check,
  Zap,
  Eye,
  Printer,
  Copy,
} from "lucide-react";

interface AuditResult {
  platform: string;
  restaurant_name: string;
  city: string;
  url: string;
  cuisines: string;
  ratings: {
    delivery: string;
    dining: string;
  };
  scorecard: {
    overall_score: number;
    total_dishes: number;
    dishes_with_photos: number;
    dishes_missing_photos: number;
    photo_coverage_pct: number;
    dishes_with_descs: number;
    dishes_missing_descs: number;
    desc_coverage_pct: number;
  };
  categories: Array<{
    menu_group?: string;
    category_name: string;
    total_items: number;
    photos_present: number;
    photos_missing: number;
    photos_missing_items?: string[];
    descs_present: number;
    descs_missing: number;
    descs_missing_items?: string[];
  }>;
  missing_photos_all: Array<{ category: string; dish: string }>;
  missing_descs_all: Array<{ category: string; dish: string }>;
  dining_info?: {
    cost_for_two?: string;
    timings?: string;
    phone?: string;
    amenities?: string[];
    offers?: string[];
    photos?: string[];
  };
  ai_insights?: {
    cuisine_analysis: string;
    thumbnail_analysis: string;
    bad_images?: Array<{ category: string; dish: string }>;
  };
  all_items_with_photos?: Array<{ dish: string; image: string }>;
}

interface VisionResultItem {
  dish: string;
  image_url: string;
  match: boolean;
  reason: string;
}

export default function HygieneCheckPage() {
  // Mode selection: Single Platform vs Dual Platform Comparison
  const [auditMode, setAuditMode] = useState<"single" | "dual">("single");

  // Single Input states
  const [urlInput, setUrlInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [searchPlatform, setSearchPlatform] = useState<"zomato" | "swiggy">("zomato");
  const [searchMode, setSearchMode] = useState<"delivery" | "dining">("delivery");

  // Dual Input states
  const [zomatoUrlInput, setZomatoUrlInput] = useState("https://www.zomato.com/jamshedpur/novelty-multicuisine-restaurant-bistupur/order");
  const [swiggyUrlInput, setSwiggyUrlInput] = useState("https://www.swiggy.com/city/jamshedpur/novelty-restaurant-bistupur-rest12034");
  const [dualCompareLoading, setDualCompareLoading] = useState(false);
  const [dualCompareData, setDualCompareData] = useState<any | null>(null);

  // PDF Download States
  const [isDownloadingSinglePdf, setIsDownloadingSinglePdf] = useState(false);
  const [isDownloadingDualPdf, setIsDownloadingDualPdf] = useState(false);

  // Audit Data & Loading Status
  const [loading, setLoading] = useState(false);
  const [loaderSub, setLoaderSub] = useState("Scraping live menu items, photos and description copy...");
  const [auditData, setAuditData] = useState<AuditResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active Tab & Search inside tab
  const [activeTab, setActiveTab] = useState<"photos" | "descs" | "categories" | "ai">("photos");
  const [tabSearchQuery, setTabSearchQuery] = useState("");

  // Vision Scan States
  const [scanningVision, setScanningVision] = useState(false);
  const [visionBtnText, setVisionBtnText] = useState("Run Deep Vision Scan (Cloud AI)");
  const [visionResults, setVisionResults] = useState<VisionResultItem[]>([]);
  const [visionSummaryReport, setVisionSummaryReport] = useState<string | null>(null);

  // AI Reports States
  const [executiveReportText, setExecutiveReportText] = useState<string | null>(null);
  const [loadingExecutiveReport, setLoadingExecutiveReport] = useState(false);

  const [diningReportText, setDiningReportText] = useState<string | null>(null);
  const [loadingDiningReport, setLoadingDiningReport] = useState(false);

  // Run Direct Audit by URL
  const runAuditByUrl = async (urlToAudit?: string) => {
    let targetUrl = urlToAudit || urlInput.trim();
    if (!targetUrl) {
      setErrorMsg("Please enter a valid Zomato or Swiggy URL link.");
      return;
    }

    // Auto-correct Zomato dining vs order URLs
    if (searchMode === "dining" && targetUrl.includes("zomato.com") && targetUrl.endsWith("/order")) {
      targetUrl = targetUrl.replace(/\/order$/, "");
      setUrlInput(targetUrl);
    } else if (searchMode === "delivery" && targetUrl.includes("zomato.com") && !targetUrl.endsWith("/order")) {
      targetUrl = targetUrl + "/order";
      setUrlInput(targetUrl);
    }

    setErrorMsg(null);
    setLoading(true);
    setLoaderSub(`Connecting to ${targetUrl}...`);
    setVisionResults([]);
    setVisionSummaryReport(null);
    setExecutiveReportText(null);
    setDiningReportText(null);

    try {
      const res = await fetch("/api/hygiene-check/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data: AuditResult = await res.json();
      setAuditData(data);

      if (searchMode === "dining" || data.dining_info) {
        generateDiningAiReport(data);
      }
    } catch (err: any) {
      console.error("Audit error:", err);
      setErrorMsg("Could not complete live scan. Loading cached fallback audit data.");
    } finally {
      setLoading(false);
    }
  };

  // Run Auto Search & Scan by Name & Location
  const runAutoSearch = async () => {
    if (!nameInput.trim() || !locationInput.trim()) {
      setErrorMsg("Please enter both Restaurant Name and Location.");
      return;
    }

    setErrorMsg(null);
    setLoading(true);
    setLoaderSub(`Searching online listings for "${nameInput}" at "${locationInput}"...`);
    setVisionResults([]);
    setVisionSummaryReport(null);
    setExecutiveReportText(null);
    setDiningReportText(null);

    try {
      const searchRes = await fetch("/api/hygiene-check/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput, location: locationInput }),
      });

      if (!searchRes.ok) {
        throw new Error(`Search returned status ${searchRes.status}`);
      }

      const searchJson = await searchRes.json();
      let targetUrl = "";

      if (searchPlatform === "swiggy") {
        targetUrl = searchMode === "dining" ? searchJson.swiggy_dineout : (searchJson.swiggy_delivery || searchJson.swiggy);
      } else {
        targetUrl = searchMode === "dining" 
          ? (searchJson.zomato_dineout || searchJson.zomato_base || (searchJson.zomato ? searchJson.zomato.replace(/\/order$/, '') : ""))
          : (searchJson.zomato_delivery || (searchJson.zomato_base ? `${searchJson.zomato_base}/order` : searchJson.zomato));
      }

      if (!targetUrl) {
        setErrorMsg(`No verified listing found on ${searchPlatform.toUpperCase()} for "${nameInput}" in "${locationInput}". Please check restaurant name & location spelling, or paste a direct URL.`);
        setLoading(false);
        return;
      }

      setUrlInput(targetUrl);
      setLoaderSub(`Found listing: ${targetUrl}. Auditing menu and hygiene metrics...`);

      const auditRes = await fetch("/api/hygiene-check/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl, name: nameInput, location: locationInput }),
      });

      const data: AuditResult = await auditRes.json();
      data.restaurant_name = nameInput;
      data.city = locationInput;
      setAuditData(data);

      if (searchMode === "dining" || data.dining_info) {
        generateDiningAiReport(data);
      }
    } catch (err: any) {
      console.error("Auto search error:", err);
      setErrorMsg("Failed to complete auto-search. Please try pasting a direct listing URL.");
    } finally {
      setLoading(false);
    }
  };

  // Run Dual-Platform Comparison Audit
  const runDualComparison = async () => {
    if (!zomatoUrlInput.trim() || !swiggyUrlInput.trim()) {
      setErrorMsg("Please enter both Zomato URL and Swiggy URL link for comparison.");
      return;
    }

    setErrorMsg(null);
    setDualCompareLoading(true);
    try {
      const res = await fetch("/api/hygiene-check/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zomatoUrl: zomatoUrlInput.trim(), swiggyUrl: swiggyUrlInput.trim() }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setDualCompareData(data);
    } catch (err: any) {
      console.error("Dual comparison error:", err);
      setErrorMsg("Failed to complete dual-platform comparison.");
    } finally {
      setDualCompareLoading(false);
    }
  };

  // PDF Audit Report Downloads
  const downloadSinglePdfReport = async () => {
    if (!auditData || isDownloadingSinglePdf) return;
    setIsDownloadingSinglePdf(true);
    try {
      const res = await fetch("/api/hygiene-check/download-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "single", data: auditData }),
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(auditData.restaurant_name || "Restaurant").replace(/\s+/g, "_")}_Hygiene_Audit.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF Download error:", err);
    } finally {
      setIsDownloadingSinglePdf(false);
    }
  };

  const downloadDualPdfReport = async () => {
    if (!dualCompareData || isDownloadingDualPdf) return;
    setIsDownloadingDualPdf(true);
    try {
      const res = await fetch("/api/hygiene-check/download-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "dual", data: dualCompareData }),
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(dualCompareData.restaurant_name || "Restaurant").replace(/\s+/g, "_")}_Zomato_vs_Swiggy_Audit.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Dual PDF Download error:", err);
    } finally {
      setIsDownloadingDualPdf(false);
    }
  };

  // Vision Scan Abort & Control References
  const stopVisionRef = useRef(false);
  const visionControllerRef = useRef<AbortController | null>(null);

  const stopDeepVisionScan = () => {
    stopVisionRef.current = true;
    if (visionControllerRef.current) {
      visionControllerRef.current.abort();
    }
    setScanningVision(false);
    setVisionBtnText("Scan Stopped by User");
  };

  useEffect(() => {
    return () => {
      stopVisionRef.current = true;
      if (visionControllerRef.current) {
        visionControllerRef.current.abort();
      }
    };
  }, []);

  // Run AI Vision Scan (Batched Image Audit)
  const runDeepVisionScan = async () => {
    if (!auditData || !auditData.all_items_with_photos || auditData.all_items_with_photos.length === 0) {
      return;
    }

    stopVisionRef.current = false;
    visionControllerRef.current = new AbortController();
    setScanningVision(true);
    setVisionResults([]);
    setVisionSummaryReport(null);

    const items = auditData.all_items_with_photos.filter(
      (it) => it.image && !it.image.includes("default") && it.image !== "Not Found"
    );

    if (items.length === 0) {
      setVisionBtnText("No valid dish images to audit");
      setScanningVision(false);
      return;
    }

    const collectedResults: VisionResultItem[] = [];

    for (let i = 0; i < items.length; i++) {
      if (stopVisionRef.current) {
        console.log("Vision scan stopped by user.");
        break;
      }

      const item = items[i];
      setVisionBtnText(`Scanning ${i + 1} / ${items.length}: ${item.dish}...`);

      try {
        const res = await fetch("/api/hygiene-check/vision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: [item], mode: "delivery" }),
          signal: visionControllerRef.current?.signal,
        });

        if (stopVisionRef.current) break;

        const data = await res.json();
        if (data.mismatches && Array.isArray(data.mismatches)) {
          for (const m of data.mismatches) {
            if (stopVisionRef.current) break;
            collectedResults.push(m);
            setVisionResults((prev) => [...prev, m]);
            await new Promise((resolve) => setTimeout(resolve, 80));
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError" || stopVisionRef.current) {
          console.log("Vision item scan aborted.");
          break;
        }
        console.error("Vision item scan error:", err);
      }
    }

    if (!stopVisionRef.current) {
      setVisionBtnText("Generating Final Summary Report...");

      try {
        const repRes = await fetch("/api/hygiene-check/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ results: collectedResults }),
          signal: visionControllerRef.current?.signal,
        });
        const repData = await repRes.json();
        if (repData.report && !stopVisionRef.current) {
          setVisionSummaryReport(repData.report);
        }
      } catch (e: any) {
        if (e.name !== "AbortError") {
          console.error("Report generation error:", e);
        }
      }

      const mismatchesCount = collectedResults.filter((r) => !r.match).length;
      setVisionBtnText(`Scan Complete (${mismatchesCount} Mismatches Detected)`);
    } else {
      setVisionBtnText("Scan Stopped by User");
    }

    setScanningVision(false);
  };

  // Generate Executive AI Report
  const generateExecutiveReport = async (dataToUse?: AuditResult) => {
    const currentData = dataToUse || auditData;
    if (!currentData) return;

    setLoadingExecutiveReport(true);
    try {
      const res = await fetch("/api/hygiene-check/executive_report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentData),
      });
      const resJson = await res.json();
      if (resJson.report) {
        setExecutiveReportText(resJson.report);
      }
    } catch (err) {
      console.error("Executive report error:", err);
    } finally {
      setLoadingExecutiveReport(false);
    }
  };

  // Generate Dining AI Report
  const generateDiningAiReport = async (dataToUse?: AuditResult) => {
    const currentData = dataToUse || auditData;
    if (!currentData) return;

    setLoadingDiningReport(true);
    try {
      const res = await fetch("/api/hygiene-check/dining_report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentData),
      });
      const resJson = await res.json();
      if (resJson.report) {
        setDiningReportText(resJson.report);
      }
    } catch (err) {
      console.error("Dining report error:", err);
    } finally {
      setLoadingDiningReport(false);
    }
  };

  // Format Markdown Text to HTML
  const formatMarkdownToHTML = (md?: string | null) => {
    if (!md) return "";
    let html = md
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-white mt-4 mb-2 border-b border-zinc-800 pb-1">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-white mt-5 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-extrabold text-white mt-6 mb-4">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-zinc-300">$1</em>')
      .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc text-zinc-300 text-xs my-1">$1</li>')
      .replace(/\n\n/g, '<br/><br/>');
    return html;
  };

  // Helper for Presets
  const loadDemoPreset = (presetName: string, location: string, url: string) => {
    setNameInput(presetName);
    setLocationInput(location);
    setUrlInput(url);
    runAuditByUrl(url);
  };

  // Export JSON Report
  const downloadReportJson = () => {
    if (!auditData) return;
    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Hygiene_Audit_${auditData.restaurant_name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter missing items by tab search query
  const filteredPhotos = auditData?.missing_photos_all?.filter((item) =>
    item.dish.toLowerCase().includes(tabSearchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(tabSearchQuery.toLowerCase())
  ) || [];

  const filteredDescs = auditData?.missing_descs_all?.filter((item) =>
    item.dish.toLowerCase().includes(tabSearchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(tabSearchQuery.toLowerCase())
  ) || [];

  const filteredCategories = auditData?.categories?.filter((cat) =>
    cat.category_name.toLowerCase().includes(tabSearchQuery.toLowerCase()) ||
    (cat.menu_group && cat.menu_group.toLowerCase().includes(tabSearchQuery.toLowerCase()))
  ) || [];

  // Helper for Score Colors
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (score >= 60) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    return "text-rose-400 border-rose-500/30 bg-rose-500/10";
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-100 p-4 md:p-8 font-sans space-y-8">
      {/* Top Header & Logo Bar */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-zinc-800/80"
      >
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl backdrop-blur-md">
            <img
              src="/uploads/logo.png"
              alt="Ethers OS Logo"
              className="h-10 w-auto object-contain brightness-0 dark:invert"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                Listing Hygiene Checker
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                LIVE HYGIENE AUDIT ENGINE
              </span>
            </div>
            <p className="text-xs md:text-sm text-zinc-400 mt-0.5">
              Listing Hygiene Intelligence and Automated Telemetry Suite
            </p>
          </div>
        </div>

        {/* Action Controls Header */}
        <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setAuditMode("single")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                auditMode === "single"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Single Platform Audit
            </button>
            <button
              onClick={() => setAuditMode("dual")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                auditMode === "dual"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Dual-Platform Comparison
            </button>
          </div>

          {auditMode === "single" && auditData && (
            <button
              onClick={downloadSinglePdfReport}
              disabled={isDownloadingSinglePdf}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {isDownloadingSinglePdf ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Download Executive PDF Report</span>
            </button>
          )}

          {auditMode === "dual" && dualCompareData && (
            <button
              onClick={downloadDualPdfReport}
              disabled={isDownloadingDualPdf}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {isDownloadingDualPdf ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Download Dual Comparison PDF</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Marquee Info Bar */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-xs text-zinc-400 flex items-center gap-3 overflow-hidden backdrop-blur-sm shadow-inner">
        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
        <div className="overflow-hidden whitespace-nowrap w-full">
          <span className="inline-block text-xs font-medium tracking-wide">
            Automated platform listing scanner for Zomato and Swiggy listings. Analyzes menu photos, copy, ratings and dining information.
          </span>
        </div>
      </div>

      {/* Main Search & Audit Control Box */}
      {auditMode === "single" ? (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-6"
        >
          {/* Direct URL Input */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <LinkIcon className="w-4 h-4 text-emerald-400" />
              <span>Enter Zomato or Swiggy Restaurant URL Link</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste link e.g. https://www.zomato.com/jamshedpur/novelty-multicuisine-restaurant-bistupur/order"
                onKeyDown={(e) => e.key === "Enter" && runAuditByUrl()}
                className="flex-1 bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-all"
              />
              <button
                onClick={() => runAuditByUrl()}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50 shrink-0"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 fill-current" />
                )}
                <span>Audit Live Listing</span>
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800/80"></div>
            </div>
            <span className="relative bg-zinc-900 px-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
              Or Auto-Search by Restaurant Name and Location
            </span>
          </div>

          {/* Auto Search Form */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2 bg-zinc-950/80 border border-zinc-800 rounded-xl p-1.5 text-xs">
                <span className="text-zinc-400 font-medium px-2 uppercase text-[10px] tracking-wider">Platform:</span>
                <button
                  type="button"
                  onClick={() => setSearchPlatform("zomato")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    searchPlatform === "zomato"
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Zomato
                </button>
                <button
                  type="button"
                  onClick={() => setSearchPlatform("swiggy")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    searchPlatform === "swiggy"
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Swiggy
                </button>
              </div>

              <div className="flex items-center gap-2 bg-zinc-950/80 border border-zinc-800 rounded-xl p-1.5 text-xs">
                <span className="text-zinc-400 font-medium px-2 uppercase text-[10px] tracking-wider">Mode:</span>
                <button
                  type="button"
                  onClick={() => setSearchMode("delivery")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    searchMode === "delivery"
                      ? "bg-zinc-800 text-white border border-zinc-700"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Delivery
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode("dining")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    searchMode === "dining"
                      ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Dining
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Restaurant Name (e.g. Sher E Punjab)"
                onKeyDown={(e) => e.key === "Enter" && runAutoSearch()}
                className="bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-all"
              />
              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="Location (e.g. Golmuri)"
                onKeyDown={(e) => e.key === "Enter" && runAutoSearch()}
                className="bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-all"
              />
              <button
                onClick={runAutoSearch}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm border border-zinc-700 transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>Auto Search & Scan</span>
              </button>
            </div>
          </div>

          {/* Quick Demo Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/60 text-xs">
            <span className="text-zinc-500 font-semibold uppercase text-[10px] tracking-wider">Quick Presets:</span>
            <button
              onClick={() => loadDemoPreset("Novelty Multicuisine", "Jamshedpur", "https://www.zomato.com/jamshedpur/novelty-multicuisine-restaurant-bistupur/order")}
              className="px-3 py-1.5 rounded-lg bg-zinc-950/60 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all"
            >
              Novelty Multicuisine (Jamshedpur)
            </button>
            <button
              onClick={() => loadDemoPreset("Sher-E-Punjab", "Golmuri", "https://www.swiggy.com/restaurants/sher-e-punjab-golmuri-jamshedpur-385938")}
              className="px-3 py-1.5 rounded-lg bg-zinc-950/60 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all"
            >
              Sher-E-Punjab (Swiggy)
            </button>
          </div>
        </motion.div>
      ) : (
        /* Dual-Platform Comparison Form */
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/80 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-6 relative overflow-hidden"
        >
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-400 uppercase tracking-wider">
            <Layers className="w-4 h-4" />
            <span>Dual-Platform Cross-Sync Audit (Zomato vs Swiggy)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                Zomato Restaurant URL Link
              </label>
              <input
                type="text"
                value={zomatoUrlInput}
                onChange={(e) => setZomatoUrlInput(e.target.value)}
                placeholder="Paste Zomato link..."
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500 transition-all font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-orange-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                Swiggy Restaurant URL Link
              </label>
              <input
                type="text"
                value={swiggyUrlInput}
                onChange={(e) => setSwiggyUrlInput(e.target.value)}
                placeholder="Paste Swiggy link..."
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 transition-all font-mono"
              />
            </div>
          </div>

          <button
            onClick={runDualComparison}
            disabled={dualCompareLoading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {dualCompareLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <BarChart3 className="w-4 h-4" />
            )}
            <span>Run Dual-Platform Hygiene Comparison (Zomato vs Swiggy)</span>
          </button>
        </motion.div>
      )}

      {/* Error / Alert Bar */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Loading Overlay State */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-12 text-center space-y-4 shadow-2xl backdrop-blur-md"
        >
          <div className="inline-flex p-4 rounded-full bg-zinc-950 border border-zinc-800 mb-2">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
          <h3 className="text-lg font-bold text-white">Auditing Listing Hygiene Telemetry...</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">{loaderSub}</p>
        </motion.div>
      )}

      {/* Audit Dashboard Output View */}
      {auditData && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          {/* Restaurant Header Meta Banner */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">
                  {auditData.restaurant_name}
                </h2>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    auditData.platform?.toLowerCase() === "swiggy"
                      ? "bg-orange-500/15 text-orange-400 border border-orange-500/30"
                      : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {auditData.platform}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {auditData.city}
                </span>
              </div>
              <p className="text-xs text-zinc-400 flex items-center gap-2">
                <Utensils className="w-3.5 h-3.5 text-zinc-500" />
                <span>{auditData.cuisines || "Multi-Cuisine Restaurant"}</span>
              </p>
            </div>

            {/* Platform Rating Cards */}
            <div className="flex items-center gap-3 self-stretch md:self-auto">
              <div className="flex-1 md:flex-initial bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-right">
                <div className="flex items-center justify-end gap-1 font-bold text-lg text-white">
                  <span>{auditData.ratings?.dining || "N/A"}</span>
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                </div>
                <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Dining Rating</div>
              </div>
              <div className="flex-1 md:flex-initial bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-right">
                <div className="flex items-center justify-end gap-1 font-bold text-lg text-white">
                  <span>{auditData.ratings?.delivery || "N/A"}</span>
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                </div>
                <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Delivery Rating</div>
              </div>
            </div>
          </div>

          {/* DINE-IN SAAS EXECUTIVE DASHBOARD CARD (Only shown in Dining mode or when dining info present) */}
          {searchMode === "dining" && auditData.dining_info && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden space-y-6"
            >
              {/* Top Accent Bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-emerald-500 to-amber-500"></div>

              {/* Title & Mode Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-zinc-800 gap-4">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block"></span>
                    DINING & DINE-IN INTELLIGENCE METRICS
                  </div>
                  <h3 className="text-xl font-extrabold text-white">
                    Dine-In Operational & Experience Summary
                  </h3>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-950 border border-zinc-800 text-zinc-300">
                  Mode: Dine-In Analytics
                </span>
              </div>

              {/* 3 Metric Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Cost for Two</span>
                  </div>
                  <div className="text-xl font-black text-white">
                    {auditData.dining_info.cost_for_two || "N/A"}
                  </div>
                  <p className="text-[11px] text-zinc-500">Average meal cost estimate</p>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <Clock className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Operating Hours</span>
                  </div>
                  <div className="text-base font-extrabold text-white">
                    {auditData.dining_info.timings || "N/A"}
                  </div>
                  <p className="text-[11px] text-emerald-400 font-semibold">Active Schedule</p>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Contact Details</span>
                  </div>
                  <div className="text-base font-extrabold text-white break-all">
                    {auditData.dining_info.phone || "N/A"}
                  </div>
                  <p className="text-[11px] text-zinc-500">Direct inquiry line</p>
                </div>
              </div>

              {/* Amenities & Highlights Matrix */}
              {auditData.dining_info.amenities && auditData.dining_info.amenities.length > 0 && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-3">
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <span>Amenities & Highlights</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {auditData.dining_info.amenities.map((amenity, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-200 flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{amenity}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Pre-Book & Walk-In Discounts / Offers */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-3">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-400" />
                  <span>Pre-Book & Walk-In Discounts / Offers</span>
                </div>
                {auditData.dining_info.offers && auditData.dining_info.offers.length > 0 ? (
                  <div className="space-y-2">
                    {auditData.dining_info.offers.map((offer, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl bg-zinc-900 border border-emerald-500/20 text-xs font-semibold text-zinc-200 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Active Offer
                          </span>
                          <span>{offer}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-zinc-900 border border-dashed border-zinc-800 text-xs text-zinc-400 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>No active pre-book or walk-in discount offers listed on platform. Offering a 10%-15% pre-book discount can boost weekend dining footfalls by 25%.</span>
                  </div>
                )}
              </div>

              {/* Automated AI Executive Dining Audit Section */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>AI Executive Dining & Experience Report</span>
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1">
                      Real-time AI audit of dining posture, ratings, value tier, amenities and footfall growth tactics.
                    </p>
                  </div>
                  <button
                    onClick={() => generateDiningAiReport()}
                    disabled={loadingDiningReport}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-semibold text-xs border border-zinc-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shrink-0"
                  >
                    {loadingDiningReport ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>Re-Analyze Dining AI Report</span>
                  </button>
                </div>

                {loadingDiningReport ? (
                  <div className="py-12 text-center space-y-2 bg-zinc-900/60 rounded-xl border border-dashed border-zinc-800">
                    <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
                    <p className="text-xs font-semibold text-zinc-300">Processing Dine-In Telemetry via Cloud AI...</p>
                  </div>
                ) : diningReportText ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(diningReportText)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition-all flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Report Text</span>
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition-all flex items-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print / Save PDF</span>
                      </button>
                    </div>
                    <div
                      className="text-xs leading-relaxed text-zinc-300 space-y-2"
                      dangerouslySetInnerHTML={{ __html: formatMarkdownToHTML(diningReportText) }}
                    />
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-zinc-500 bg-zinc-900/60 rounded-xl border border-dashed border-zinc-800">
                    Click Re-Analyze Dining AI Report above to generate executive dine-in intelligence report.
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* VISUAL DISH HYGIENE AUDIT CARD (AI VISION) - Delivery Mode */}
          {searchMode === "delivery" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Eye className="w-4 h-4 text-emerald-400" />
                    <span>Visual Dish Hygiene Audit</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Instantly audit delivery dish photo authenticity and visual hygiene using AI Vision.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  {scanningVision ? (
                    <>
                      <button
                        onClick={stopDeepVisionScan}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs border border-rose-500 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-4 h-4 text-white" />
                        <span>Stop Scan</span>
                      </button>
                      <span className="text-xs font-semibold text-amber-400 bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-800 flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        <span>{visionBtnText}</span>
                      </span>
                    </>
                  ) : (
                    <button
                      onClick={runDeepVisionScan}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs border border-zinc-700 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4 text-emerald-400" />
                      <span>{visionBtnText}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* SaaS Level AI Vision Inspection Console Panel */}
              {(scanningVision || visionResults.length > 0) && (
                <div className="space-y-4 pt-2 border-t border-zinc-800/80">
                  {/* Console Header Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-[11px] font-extrabold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${scanningVision ? "bg-amber-400 animate-ping" : "bg-emerald-400 animate-pulse"}`}></span>
                      <span>{scanningVision ? "AI Vision Telemetry Stream (Scanning In Progress...)" : `AI Vision Audit Completed (${visionResults.length} Items Analyzed)`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Ethers AI Vision
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                        Single-Item Stream
                      </span>
                    </div>
                  </div>

                  {/* Picture Automation Style Terminal Logstream Console */}
                  <div className="space-y-2">
                    <div className="bg-zinc-950 border border-zinc-800/90 rounded-xl overflow-hidden shadow-2xl">
                      {/* Terminal Window Header Bar */}
                      <div className="bg-zinc-900/90 border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest pl-2 border-l border-zinc-800">
                            ETHERS_AI_VISION_AUDITOR_V2.0
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {scanningVision && (
                            <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>LIVE SCANNING...</span>
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-zinc-500">
                            {visionResults.length} LOGS
                          </span>
                        </div>
                      </div>

                      {/* Log Rows */}
                      <div className="p-3 font-mono space-y-2.5 max-h-[360px] overflow-y-auto divide-y divide-zinc-900/90 bg-zinc-950/95">
                        {scanningVision && visionResults.length === 0 && (
                          <div className="py-8 text-center text-amber-400/90 text-xs flex items-center justify-center gap-2 font-mono">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Initializing Ethers AI Vision stream & auditing dish photos...</span>
                          </div>
                        )}

                        {visionResults.map((res, i) => (
                          <div
                            key={i}
                            className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-start sm:items-center gap-3 min-w-0">
                              {res.image_url ? (
                                <img
                                  src={res.image_url}
                                  alt={res.dish}
                                  className="w-10 h-10 rounded-lg object-cover border border-zinc-800 shrink-0 mt-0.5 sm:mt-0"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 shrink-0 font-bold text-[10px]">
                                  LOG
                                </div>
                              )}
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase">LOG #{i + 1}</span>
                                  <h4 className="font-bold text-zinc-100 font-sans text-xs truncate">{res.dish}</h4>
                                </div>
                                <p className="text-[11px] font-sans text-zinc-300 leading-snug line-clamp-2">{res.reason}</p>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-2 self-end sm:self-auto">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider font-sans ${
                                  res.match
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                    : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                                }`}
                              >
                                {res.match ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-rose-400" />}
                                <span>{res.match ? "PASSED" : "MISMATCH"}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* AI Vision Summary Report Box */}
                  {visionSummaryReport && (
                    <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 space-y-2 shadow-md">
                      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          <span>AI Vision Executive Summary & Quality Score</span>
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">Telemetry Complete</span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed text-zinc-300 font-sans">{visionSummaryReport}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* 4 Scorecard KPI Metrics Grid (Shown in Delivery mode or general overview) */}
          {searchMode === "delivery" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* KPI 1: Overall Hygiene Scorecard */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl relative overflow-hidden space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  <span>Overall Hygiene Index</span>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white">
                    {auditData.scorecard.overall_score}
                  </span>
                  <span className="text-xs text-zinc-500 font-bold">/ 100</span>
                </div>
                <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(auditData.scorecard.overall_score, 100)}%` }}
                  />
                </div>
                <span className={`inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${getScoreColor(auditData.scorecard.overall_score)}`}>
                  Weighted Photo & Description Score
                </span>
              </div>

              {/* KPI 2: Total Items Parsed */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  <span>Total Dishes Audited</span>
                  <Layers className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="text-3xl font-black text-white">
                  {auditData.scorecard.total_dishes}
                </div>
                <p className="text-xs text-zinc-400">Live Menu Items Scanned</p>
              </div>

              {/* KPI 3: Missing Photos */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-2 relative border-l-4 border-l-rose-500">
                <div className="flex justify-between items-center text-xs font-bold text-rose-400 uppercase tracking-wider">
                  <span>Missing Dish Photos</span>
                  <Camera className="w-4 h-4 text-rose-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white">
                    {auditData.scorecard.dishes_missing_photos}
                  </span>
                  <span className="text-xs text-rose-400 font-semibold">
                    ({(100 - auditData.scorecard.photo_coverage_pct).toFixed(1)}%)
                  </span>
                </div>
                <p className="text-xs text-zinc-400">Menu items lacking photos</p>
              </div>

              {/* KPI 4: Missing Descriptions */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-2 relative border-l-4 border-l-amber-500">
                <div className="flex justify-between items-center text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <span>Missing Descriptions</span>
                  <FileText className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white">
                    {auditData.scorecard.dishes_missing_descs}
                  </span>
                  <span className="text-xs text-amber-400 font-semibold">
                    ({(100 - auditData.scorecard.desc_coverage_pct).toFixed(1)}%)
                  </span>
                </div>
                <p className="text-xs text-zinc-400">Menu items lacking description</p>
              </div>
            </div>
          )}

          {/* Detailed Tab Navigation & Results Panel */}
          {searchMode === "delivery" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl p-2 shadow-md">
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setActiveTab("photos")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "photos"
                        ? "bg-zinc-800 text-white border border-zinc-700 shadow"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Missing Photos ({auditData.missing_photos_all?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab("descs")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "descs"
                        ? "bg-zinc-800 text-white border border-zinc-700 shadow"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Missing Descriptions ({auditData.missing_descs_all?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab("categories")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "categories"
                        ? "bg-zinc-800 text-white border border-zinc-700 shadow"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Category Matrix ({auditData.categories?.length || 0})
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("ai");
                      if (!executiveReportText) generateExecutiveReport();
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "ai"
                        ? "bg-zinc-800 text-white border border-zinc-700 shadow"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    AI Insights
                  </button>
                </div>

                {/* Search Bar for filtering tab content */}
                {(activeTab === "photos" || activeTab === "descs" || activeTab === "categories") && (
                  <div className="relative w-full sm:w-64 px-2">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={tabSearchQuery}
                      onChange={(e) => setTabSearchQuery(e.target.value)}
                      placeholder="Search dish name..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                    />
                  </div>
                )}
              </div>

              {/* TAB CONTENT PANELS */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-2xl min-h-[360px]">
                {/* Tab 1: Missing Photos Grid */}
                {activeTab === "photos" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Camera className="w-4 h-4 text-rose-400" />
                      <span>Dishes Missing Official Photos ({filteredPhotos.length})</span>
                    </h3>

                    {filteredPhotos.length === 0 ? (
                      <div className="py-12 text-center text-zinc-500 text-xs">
                        All menu items have official photos!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {filteredPhotos.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-all space-y-2"
                          >
                            <div>
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                                {item.category || "Menu Item"}
                              </span>
                              <h4 className="text-sm font-semibold text-zinc-100 mt-0.5">
                                {item.dish}
                              </h4>
                            </div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 self-start">
                              <XCircle className="w-3 h-3" />
                              <span>Photo Missing</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Missing Descriptions Grid */}
                {activeTab === "descs" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-400" />
                      <span>Dishes Missing Descriptions ({filteredDescs.length})</span>
                    </h3>

                    {filteredDescs.length === 0 ? (
                      <div className="py-12 text-center text-zinc-500 text-xs">
                        All menu items have descriptions!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {filteredDescs.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-all space-y-2"
                          >
                            <div>
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                                {item.category || "Menu Item"}
                              </span>
                              <h4 className="text-sm font-semibold text-zinc-100 mt-0.5">
                                {item.dish}
                              </h4>
                            </div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 self-start">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Description Missing</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Category Matrix Table */}
                {activeTab === "categories" && (
                  <div className="space-y-4 overflow-x-auto">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span>Category Coverage Matrix</span>
                    </h3>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] tracking-wider">
                          <th className="py-3 px-4">Menu & Category</th>
                          <th className="py-3 px-4 text-center">Total Items</th>
                          <th className="py-3 px-4 text-center">Photo Coverage</th>
                          <th className="py-3 px-4 text-center">Photos Missing</th>
                          <th className="py-3 px-4 text-center">Descriptions Missing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {filteredCategories.map((cat, idx) => {
                          const pct = cat.total_items > 0 ? Math.round((cat.photos_present / cat.total_items) * 100) : 0;
                          return (
                            <tr key={idx} className="hover:bg-zinc-950/60 transition-colors">
                              <td className="py-3 px-4 text-zinc-300 font-semibold">
                                <strong className="text-zinc-100">{cat.menu_group || "Menu"}</strong> &rarr; {cat.category_name || "General"}
                              </td>
                              <td className="py-3 px-4 text-center text-zinc-300 font-bold">{cat.total_items}</td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-16 bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                                    <div
                                      className={`h-full rounded-full ${pct >= 70 ? "bg-emerald-400" : "bg-rose-400"}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="font-bold text-[11px] text-zinc-300">{pct}%</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center text-rose-400 font-bold">{cat.photos_missing}</td>
                              <td className="py-3 px-4 text-center font-bold text-amber-400">{cat.descs_missing}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tab 4: AI Insights & Executive Report */}
                {activeTab === "ai" && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-zinc-800 pb-3 gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-400" />
                          <span>AI Listing Intelligence & Executive Audit Report</span>
                        </h3>
                        <p className="text-xs text-zinc-400">Deep listing telemetry report generated live via AI</p>
                      </div>
                      <button
                        onClick={() => generateExecutiveReport()}
                        disabled={loadingExecutiveReport}
                        className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs border border-zinc-700 transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2"
                      >
                        {loadingExecutiveReport ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
                        <span>Generate Full AI Report</span>
                      </button>
                    </div>

                    {/* Telemetry 3 Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-1">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Photo Coverage</span>
                        <p className="text-xl font-black text-white">{auditData.scorecard.photo_coverage_pct}%</p>
                        <p className="text-[11px] text-rose-400 font-semibold">{auditData.scorecard.dishes_missing_photos} dishes missing photos</p>
                      </div>

                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-1">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Description Coverage</span>
                        <p className="text-xl font-black text-white">{auditData.scorecard.desc_coverage_pct}%</p>
                        <p className="text-[11px] text-amber-400 font-semibold">{auditData.scorecard.dishes_missing_descs} dishes missing descriptions</p>
                      </div>

                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-1">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Categories Scanned</span>
                        <p className="text-xl font-black text-white">{auditData.categories?.length || 0}</p>
                        <p className="text-[11px] text-emerald-400 font-semibold">{auditData.scorecard.total_dishes} total dishes audited</p>
                      </div>
                    </div>

                    {/* Executive Report Container */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-4">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        <span>Executive AI Listing Audit Report</span>
                      </h4>

                      {loadingExecutiveReport ? (
                        <div className="py-12 text-center space-y-2 bg-zinc-900/60 rounded-xl border border-dashed border-zinc-800">
                          <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
                          <p className="text-xs font-semibold text-zinc-300">Analyzing Listing Telemetry via AI...</p>
                        </div>
                      ) : executiveReportText ? (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => navigator.clipboard.writeText(executiveReportText)}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition-all flex items-center gap-1.5"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Report Text</span>
                            </button>
                            <button
                              onClick={() => window.print()}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition-all flex items-center gap-1.5"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Print / Save PDF</span>
                            </button>
                          </div>
                          <div
                            className="text-xs leading-relaxed text-zinc-300 space-y-2"
                            dangerouslySetInnerHTML={{ __html: formatMarkdownToHTML(executiveReportText) }}
                          />
                        </div>
                      ) : (
                        <div className="py-8 text-center text-xs text-zinc-500 bg-zinc-900/60 rounded-xl border border-dashed border-zinc-800">
                          Click Generate Full AI Report above to trigger deep listing telemetry analysis.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </motion.div>
      )}

      {/* DUAL-PLATFORM COMPARISON AUDIT RESULTS VIEW */}
      {auditMode === "dual" && dualCompareData && !dualCompareLoading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          {/* Header Banner */}
          <div className="bg-zinc-900/90 border border-emerald-500/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">
                  {dualCompareData.restaurant_name}
                </h2>
                <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ZOMATO VS SWIGGY CROSS-SYNC HYGIENE AUDIT
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Cross-Platform Menu Matching, Missing Items Telemetry, and Price Discrepancy Audit
              </p>
            </div>

            <button
              onClick={downloadDualPdfReport}
              disabled={isDownloadingDualPdf}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all shadow-lg active:scale-95 disabled:opacity-50 shrink-0"
            >
              {isDownloadingDualPdf ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Download Executive Comparison PDF</span>
            </button>
          </div>

          {/* Side-by-Side Platform Scorecards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Zomato Scorecard */}
            <div className="bg-zinc-900/90 border-t-4 border-t-rose-500 border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <span className="text-sm font-extrabold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  ZOMATO AUDIT METRICS
                </span>
                <span className="text-xs font-mono text-zinc-400">{dualCompareData.zomatoScorecard?.total_dishes} Total Items</span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white">{dualCompareData.zomatoScorecard?.overall_score}</span>
                <span className="text-sm text-zinc-500 font-bold">/ 100 Hygiene Score</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Photo Coverage</span>
                  <p className="text-lg font-extrabold text-emerald-400 mt-0.5">{dualCompareData.zomatoScorecard?.photo_coverage_pct}%</p>
                  <p className="text-[10px] text-zinc-500">{dualCompareData.zomatoScorecard?.dishes_with_photos} / {dualCompareData.zomatoScorecard?.total_dishes} photos</p>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Description Coverage</span>
                  <p className="text-lg font-extrabold text-emerald-400 mt-0.5">{dualCompareData.zomatoScorecard?.desc_coverage_pct}%</p>
                  <p className="text-[10px] text-zinc-500">{dualCompareData.zomatoScorecard?.dishes_with_descs} / {dualCompareData.zomatoScorecard?.total_dishes} descs</p>
                </div>
              </div>
            </div>

            {/* Swiggy Scorecard */}
            <div className="bg-zinc-900/90 border-t-4 border-t-orange-500 border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <span className="text-sm font-extrabold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                  SWIGGY AUDIT METRICS
                </span>
                <span className="text-xs font-mono text-zinc-400">{dualCompareData.swiggyScorecard?.total_dishes} Total Items</span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white">{dualCompareData.swiggyScorecard?.overall_score}</span>
                <span className="text-sm text-zinc-500 font-bold">/ 100 Hygiene Score</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Photo Coverage</span>
                  <p className="text-lg font-extrabold text-amber-400 mt-0.5">{dualCompareData.swiggyScorecard?.photo_coverage_pct}%</p>
                  <p className="text-[10px] text-zinc-500">{dualCompareData.swiggyScorecard?.dishes_with_photos} / {dualCompareData.swiggyScorecard?.total_dishes} photos</p>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Description Coverage</span>
                  <p className="text-lg font-extrabold text-amber-400 mt-0.5">{dualCompareData.swiggyScorecard?.desc_coverage_pct}%</p>
                  <p className="text-[10px] text-zinc-500">{dualCompareData.swiggyScorecard?.dishes_with_descs} / {dualCompareData.swiggyScorecard?.total_dishes} descs</p>
                </div>
              </div>
            </div>
          </div>

          {/* Missing Items Table: Present on Zomato but MISSING on Swiggy */}
          {dualCompareData.comparison?.missingOnSwiggy?.length > 0 && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Dishes Present on Zomato but MISSING on Swiggy ({dualCompareData.comparison.missingOnSwiggy.length} Items)
                  </h3>
                </div>
                <span className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full">
                  Potential Revenue Leakage
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-zinc-300">
                  <thead className="bg-zinc-950 text-zinc-400 font-bold uppercase text-[10px] border-b border-zinc-800">
                    <tr>
                      <th className="p-3">Category</th>
                      <th className="p-3">Dish Name</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-medium">
                    {dualCompareData.comparison.missingOnSwiggy.map((m: any, i: number) => (
                      <tr key={i} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="p-3 text-zinc-400">{m.category}</td>
                        <td className="p-3 font-bold text-white">{m.dish}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Missing on Swiggy
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Missing Items Table: Present on Swiggy but MISSING on Zomato */}
          {dualCompareData.comparison?.missingOnZomato?.length > 0 && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Dishes Present on Swiggy but MISSING on Zomato ({dualCompareData.comparison.missingOnZomato.length} Items)
                  </h3>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-zinc-300">
                  <thead className="bg-zinc-950 text-zinc-400 font-bold uppercase text-[10px] border-b border-zinc-800">
                    <tr>
                      <th className="p-3">Category</th>
                      <th className="p-3">Dish Name</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-medium">
                    {dualCompareData.comparison.missingOnZomato.map((m: any, i: number) => (
                      <tr key={i} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="p-3 text-zinc-400">{m.category}</td>
                        <td className="p-3 font-bold text-white">{m.dish}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Missing on Zomato
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </motion.div>
      )}
    </div>
  );
}
