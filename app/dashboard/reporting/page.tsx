"use client";

import { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  Trash2,
  Edit3,
  Calendar,
  Layers,
  CheckCircle,
  AlertCircle,
  X,
  Plus,
  RefreshCw,
  Info,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  ReportingStore,
  SectionKey,
  ReportPlatform,
  ReportType,
  ZomatoDeliveryMetrics,
  SwiggyDeliveryMetrics,
  ZomatoDineInMetrics,
  SwiggyDineoutMetrics,
  computeCombinedDeliveryRecords,
  computeCombinedDineoutRecords,
} from "@/lib/reporting-types";
import { useBrand } from "@/components/BrandContext";

export default function ReportingPage() {
  const { activeBrand } = useBrand();
  const [store, setStore] = useState<ReportingStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SectionKey>("zomato_delivery");
  const [monthlyRollup, setMonthlyRollup] = useState(false);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadPlatform, setUploadPlatform] = useState<ReportPlatform>("zomato");
  const [uploadType, setUploadType] = useState<ReportType>("delivery");
  const [periodLabel, setPeriodLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [manualAds, setManualAds] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  // Edit modal state
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<{
    section: SectionKey;
    id: string;
    label: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Mini Calendar State
  const [calDate, setCalDate] = useState(() => new Date());

  useEffect(() => {
    fetchStore();
  }, [activeBrand?.id]);

  async function fetchStore() {
    setLoading(true);
    try {
      const url = activeBrand?.id ? `/api/reporting/periods?brandId=${activeBrand.id}` : "/api/reporting/periods";
      const res = await fetch(url);
      const data = await res.json();
      setStore(data);
    } catch (err) {
      console.error("Failed to load reporting store:", err);
    } finally {
      setLoading(false);
    }
  }

  async function confirmDeletePeriod() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/reporting/periods?section=${deleteTarget.section}&id=${deleteTarget.id}`,
        {
          method: "DELETE",
        }
      );
      const data = await res.json();
      if (data.success) {
        setStore(data.store);
      }
    } catch (err) {
      console.error("Failed to delete period:", err);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!periodLabel.trim()) {
      setUploadError("Please select a date range or provide a period label.");
      return;
    }
    if (selectedFiles.length === 0) {
      setUploadError("Please select at least 1 file to upload.");
      return;
    }

    setUploadError("");
    setUploadSuccess("");
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("platform", uploadPlatform);
      formData.append("type", uploadType);
      formData.append("periodLabel", periodLabel.trim());
      if (activeBrand) formData.append("brandId", activeBrand.id);
      if (startDate) formData.append("startDate", startDate);
      if (endDate) formData.append("endDate", endDate);
      if (manualAds) formData.append("manualAds", manualAds);

      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      const res = await fetch("/api/reporting/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to process report.");
      }

      setUploadSuccess(`Successfully created report column for "${periodLabel}"!`);
      fetchStore();
      setTimeout(() => {
        setShowUploadModal(false);
        setPeriodLabel("");
        setStartDate("");
        setEndDate("");
        setManualAds("");
        setSelectedFiles([]);
        setUploadSuccess("");
      }, 1200);
    } catch (err: any) {
      setUploadError(err.message || "An error occurred while parsing.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleExportExcel() {
    window.open("/api/reporting/export", "_blank");
  }

  function formatCurrency(val: number) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  }

  function formatPct(val: number) {
    return `${(val || 0).toFixed(2)}%`;
  }

  // Quick Presets Helper
  function handleQuickDate(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days + 1);

    const endStr = end.toISOString().split("T")[0];
    const startStr = start.toISOString().split("T")[0];

    setStartDate(startStr);
    setEndDate(endStr);
    setCalDate(new Date(start));

    const sMonth = start.toLocaleString("default", { month: "short" });
    const eMonth = end.toLocaleString("default", { month: "short" });

    let autoLabel = "";
    if (sMonth === eMonth) {
      autoLabel = `${start.getDate()}-${end.getDate()} ${sMonth}`;
    } else {
      autoLabel = `${start.getDate()} ${sMonth} - ${end.getDate()} ${eMonth}`;
    }
    setPeriodLabel(autoLabel);
  }

  // Mini Calendar Day Click Handler
  function handleCalendarDayClick(year: number, month: number, day: number) {
    const selectedDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (!startDate || (startDate && endDate)) {
      setStartDate(selectedDateStr);
      setEndDate("");
      const monthShort = new Date(year, month, day).toLocaleString("default", { month: "short" });
      setPeriodLabel(`${day} ${monthShort}`);
    } else {
      const s = new Date(startDate);
      const e = new Date(selectedDateStr);

      if (e < s) {
        setStartDate(selectedDateStr);
        setEndDate("");
        const monthShort = e.toLocaleString("default", { month: "short" });
        setPeriodLabel(`${day} ${monthShort}`);
      } else {
        setEndDate(selectedDateStr);
        const sMonthStr = s.toLocaleString("default", { month: "short" });
        const eMonthStr = e.toLocaleString("default", { month: "short" });

        let label = "";
        if (sMonthStr === eMonthStr) {
          label = `${s.getDate()}-${e.getDate()} ${sMonthStr}`;
        } else {
          label = `${s.getDate()} ${sMonthStr} - ${e.getDate()} ${eMonthStr}`;
        }
        setPeriodLabel(label);
      }
    }
  }

  // Helper to filter items strictly belonging to the currently active brand
  const currentBrandId = activeBrand?.id;

  const brandZomatoDelivery = (store?.zomato_delivery || []).filter(
    (item) => !currentBrandId || item.brandId === currentBrandId || (!item.brandId && currentBrandId === "1")
  );

  const brandSwiggyDelivery = (store?.swiggy_delivery || []).filter(
    (item) => !currentBrandId || item.brandId === currentBrandId || (!item.brandId && currentBrandId === "1")
  );

  const brandZomatoDinein = (store?.zomato_dinein || []).filter(
    (item) => !currentBrandId || item.brandId === currentBrandId || (!item.brandId && currentBrandId === "1")
  );

  const brandSwiggyDineout = (store?.swiggy_dineout || []).filter(
    (item) => !currentBrandId || item.brandId === currentBrandId || (!item.brandId && currentBrandId === "1")
  );

  // Combined Aggregations for Overall Delivery & Overall Dineout — Strictly for activeBrand
  const combinedDeliveryList = store
    ? computeCombinedDeliveryRecords(brandZomatoDelivery, brandSwiggyDelivery)
    : [];

  const combinedDineoutList = store
    ? computeCombinedDineoutRecords(brandZomatoDinein, brandSwiggyDineout)
    : [];

  // Aggregation for Monthly Rollup & Section Selection — Strictly for activeBrand
  const rawItems = store
    ? activeTab === "overall_delivery"
      ? combinedDeliveryList
      : activeTab === "overall_dineout"
      ? combinedDineoutList
      : activeTab === "zomato_delivery"
      ? brandZomatoDelivery
      : activeTab === "swiggy_delivery"
      ? brandSwiggyDelivery
      : activeTab === "zomato_dinein"
      ? brandZomatoDinein
      : activeTab === "swiggy_dineout"
      ? brandSwiggyDineout
      : []
    : [];
  let currentItems: any[] = rawItems;

  if (monthlyRollup && rawItems.length > 0) {
    const monthGroups: Record<string, any[]> = {};

    rawItems.forEach((item) => {
      let monthName = "July";
      if (item.startDate) {
        const d = new Date(item.startDate);
        monthName = d.toLocaleString("default", { month: "short", year: "numeric" });
      } else {
        const match = item.periodLabel.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*/i);
        if (match) {
          monthName = match[0];
        } else {
          monthName = item.periodLabel;
        }
      }
      if (!monthGroups[monthName]) monthGroups[monthName] = [];
      monthGroups[monthName].push(item);
    });

    currentItems = Object.entries(monthGroups).map(([mName, items]) => {
      const orders = items.reduce((a, b) => a + (b.orders || 0), 0);
      const transactions = items.reduce((a, b) => a + (b.transactions || 0), 0);
      const subTotal = items.reduce((a, b) => a + (b.subTotal || 0), 0);
      const packagingCharges = items.reduce((a, b) => a + (b.packagingCharges || 0), 0);
      const subTotalWithPkg = items.reduce((a, b) => a + (b.subTotalWithPkg || 0), 0);
      const cancelledOrderRefund = items.reduce((a, b) => a + (b.cancelledOrderRefund || 0), 0);
      const discount = items.reduce((a, b) => a + (b.discount || 0), 0);
      const commissionableValue = items.reduce((a, b) => a + (b.commissionableValue || 0), 0);
      const orderLevelDeduction = items.reduce((a, b) => a + (b.orderLevelDeduction || 0), 0);
      const taxDeduction = items.reduce((a, b) => a + (b.taxDeduction || 0), 0);
      const comPgGst = items.reduce((a, b) => a + (b.comPgGst || 0), 0);
      const complaintsCancellation = items.reduce((a, b) => a + (b.complaintsCancellation || 0), 0);
      const tax = items.reduce((a, b) => a + (b.tax || 0), 0);
      const preGmv = items.reduce((a, b) => a + (b.preGmv || 0), 0);
      const postGmv = items.reduce((a, b) => a + (b.postGmv || 0), 0);
      const commission = items.reduce((a, b) => a + (b.commission || 0), 0);
      const ads = items.reduce((a, b) => a + (b.ads || 0), 0);
      const hyperpure = items.reduce((a, b) => a + (b.hyperpure || 0), 0);
      const netPayout = items.reduce((a, b) => a + (b.netPayout || 0), 0);
      const platformFeesDeductions = items.reduce(
        (a, b) =>
          a +
          (b.platformFeesDeductions !== undefined
            ? Number(b.platformFeesDeductions || 0)
            : Number(b.orderLevelDeduction || 0) +
              Number(b.taxDeduction || 0) +
              Number(b.comPgGst || 0) +
              Number(b.complaintsCancellation || 0) +
              Number(b.tax || 0)),
        0
      );

      const grossBase = subTotalWithPkg || preGmv || subTotal || 1;
      const discountPct = (discount / grossBase) * 100;
      const adsPct = (ads / grossBase) * 100;
      const commissionPct = postGmv > 0 ? (commission / postGmv) * 100 : 0;
      const netPayoutPct = (netPayout / grossBase) * 100;
      const overallBurnPct = 100 - netPayoutPct;

      return {
        id: `rolled_${mName}`,
        periodLabel: `${mName} (Rollup)`,
        isRollup: true,
        orders,
        transactions,
        subTotal,
        packagingCharges,
        subTotalWithPkg,
        cancelledOrderRefund,
        discount,
        discountPct,
        commissionableValue,
        platformFeesDeductions,
        orderLevelDeduction,
        taxDeduction,
        comPgGst,
        complaintsCancellation,
        tax,
        preGmv,
        postGmv,
        commission,
        commissionPct,
        ads,
        adsPct,
        hyperpure,
        netPayout,
        netPayoutWithHyperpure: netPayout + hyperpure,
        netPayoutPct,
        overallBurnPct,
      };
    });
  }

  // Auto-Save Monthly Rollup to Brand History ("Main Brain")
  useEffect(() => {
    if (monthlyRollup && currentItems.length > 0 && activeBrand) {
      currentItems.forEach(async (rollupItem: any) => {
        if (rollupItem.isRollup) {
          try {
            await fetch("/api/reporting/rollups", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                brandId: activeBrand.id,
                brandName: activeBrand.name,
                section: activeTab,
                monthName: rollupItem.periodLabel.replace(" (Rollup)", ""),
                orders: rollupItem.orders,
                transactions: rollupItem.transactions,
                subTotal: rollupItem.subTotal,
                packagingCharges: rollupItem.packagingCharges,
                subTotalWithPkg: rollupItem.subTotalWithPkg,
                discount: rollupItem.discount,
                discountPct: rollupItem.discountPct,
                commission: rollupItem.commission || rollupItem.orderLevelDeduction || rollupItem.comPgGst,
                platformFeesDeductions: rollupItem.platformFeesDeductions,
                ads: rollupItem.ads,
                adsPct: rollupItem.adsPct,
                netPayout: rollupItem.netPayout,
                netPayoutPct: rollupItem.netPayoutPct,
                overallBurnPct: rollupItem.overallBurnPct,
              }),
            });
          } catch (err) {
            console.error("Auto-save rollup error:", err);
          }
        }
      });
    }
  }, [monthlyRollup, activeTab, activeBrand?.id]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#272727] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#161616] border border-[#272727] text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Automated Payout & Performance Reporting
              </h1>
              <p className="text-sm text-[#a3a3a3] mt-0.5">
                Period-by-period financial telemetry & burn audit for Zomato & Swiggy
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Monthly Rollup Toggle */}
          <button
            onClick={() => setMonthlyRollup(!monthlyRollup)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium transition-all ${
              monthlyRollup
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-[#111111] border-[#272727] text-[#a3a3a3] hover:text-[#f5f5f5]"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Monthly Rollup</span>
            <span
              className={`w-2 h-2 rounded-full ${
                monthlyRollup ? "bg-emerald-400 animate-pulse" : "bg-[#555555]"
              }`}
            />
          </button>

          {/* Export Excel Button */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#111111] border border-[#272727] text-xs font-medium text-[#f5f5f5] hover:bg-[#161616] hover:border-[#333333] transition-all"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>Export Excel</span>
          </button>

          {/* Upload New Report Button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Payout Data</span>
          </button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex items-center gap-2 border-b border-[#272727] overflow-x-auto pb-2 scrollbar-none">
        {[
          { key: "zomato_delivery", label: "Zomato Delivery", count: store?.zomato_delivery?.length || 0, isCombined: false },
          { key: "swiggy_delivery", label: "Swiggy Delivery", count: store?.swiggy_delivery?.length || 0, isCombined: false },
          { key: "overall_delivery", label: "Overall Delivery", count: combinedDeliveryList.length, isCombined: true },
          { key: "zomato_dinein", label: "Zomato Dineout", count: store?.zomato_dinein?.length || 0, isCombined: false },
          { key: "swiggy_dineout", label: "Swiggy Dineout", count: store?.swiggy_dineout?.length || 0, isCombined: false },
          { key: "overall_dineout", label: "Overall Dineout", count: combinedDineoutList.length, isCombined: true },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as SectionKey)}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-t-lg text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? tab.isCombined
                  ? "border-purple-400 text-purple-300 bg-[#111111]"
                  : "border-emerald-400 text-emerald-400 bg-[#111111]"
                : "border-transparent text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#111111]/50"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === tab.key
                  ? tab.isCombined
                    ? "bg-purple-500/20 text-purple-300"
                    : "bg-emerald-500/20 text-emerald-300"
                  : "bg-[#222222] text-[#888888]"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Summary KPI Highlights */}
      {currentItems.length > 0 && (() => {
        const totalNetPayout = currentItems.reduce((acc, curr: any) => acc + (curr.netPayout || 0), 0);
        const totalAds = currentItems.reduce((acc, curr: any) => acc + (curr.ads || 0), 0);
        
        // Base for weighted average (SubTotalWithPkg for delivery, PreGmv for dine-in)
        const totalBaseGross = currentItems.reduce((acc, curr: any) => {
          return acc + (curr.subTotalWithPkg || curr.preGmv || curr.subTotal || 0);
        }, 0);

        const weightedNetPayoutPct = totalBaseGross > 0 ? (totalNetPayout / totalBaseGross) * 100 : 0;
        const weightedBurnPct = totalBaseGross > 0 ? 100 - weightedNetPayoutPct : 0;

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#111111] border border-[#272727] p-4 rounded-xl space-y-1">
              <p className="text-xs text-[#a3a3a3]">Total Net Payout</p>
              <p className="text-xl font-bold text-emerald-400">
                {formatCurrency(totalNetPayout)}
              </p>
              <p className="text-[11px] text-[#555555]">Summed across {currentItems.length} periods</p>
            </div>

            <div className="bg-[#111111] border border-[#272727] p-4 rounded-xl space-y-1">
              <p className="text-xs text-[#a3a3a3]">Weighted Net Payout %</p>
              <p className="text-xl font-bold text-blue-400">
                {formatPct(weightedNetPayoutPct)}
              </p>
              <p className="text-[11px] text-[#555555]">Weighted retention from gross sales</p>
            </div>

            <div className="bg-[#111111] border border-[#272727] p-4 rounded-xl space-y-1">
              <p className="text-xs text-[#a3a3a3]">Weighted Overall Burn %</p>
              <p className="text-xl font-bold text-amber-400">
                {formatPct(weightedBurnPct)}
              </p>
              <p className="text-[11px] text-[#555555]">Commissions + Taxes + Ads</p>
            </div>

            <div className="bg-[#111111] border border-[#272727] p-4 rounded-xl space-y-1">
              <p className="text-xs text-[#a3a3a3]">Total Ads Investment</p>
              <p className="text-xl font-bold text-purple-400">
                {formatCurrency(totalAds)}
              </p>
              <p className="text-[11px] text-[#555555]">Growth & ad spend</p>
            </div>
          </div>
        );
      })()}

      {/* Main Reporting Matrix Table */}
      <div className="bg-[#111111] border border-[#272727] rounded-xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3 text-[#a3a3a3]">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
            <p className="text-sm">Loading payout metrics...</p>
          </div>
        ) : currentItems.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 rounded-full bg-[#161616] border border-[#272727] text-[#555555]">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#f5f5f5]">No period data uploaded yet</h3>
              <p className="text-xs text-[#a3a3a3] max-w-sm mt-1">
                Upload your Zomato/Swiggy payout screenshots or Excel/CSV files to build your period-by-period comparison table.
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-semibold rounded-lg transition-all"
            >
              Upload First Period
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[#272727]">
            <table className="w-full text-left text-xs border-collapse">
              {/* Header Row: Metrics + Periods */}
              <thead>
                <tr className="bg-[#161616] border-b border-[#272727] text-[#a3a3a3] uppercase tracking-wider text-[11px]">
                  <th className="p-4 font-semibold w-72 sticky left-0 bg-[#161616] border-r border-[#272727] z-10 shadow-r">
                    Metrics
                  </th>
                  {currentItems.map((item: any) => (
                    <th key={item.id} className="p-4 font-semibold text-right min-w-[140px] border-r border-[#272727]">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#f5f5f5] normal-case text-xs font-bold">
                            {item.periodLabel}
                          </span>
                          {activeTab !== "overall_delivery" && activeTab !== "overall_dineout" && (
                            <button
                              onClick={() =>
                                setDeleteTarget({
                                  section: activeTab,
                                  id: item.id,
                                  label: item.periodLabel,
                                })
                              }
                              className="text-[#555555] hover:text-red-400 p-0.5 rounded transition-all"
                              title="Delete period"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {item.startDate && item.endDate && (
                          <span className="text-[10px] text-[#666666] font-normal lowercase">
                            {item.startDate} to {item.endDate}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-[#1e1e1e]">
                {/* 1. Format Z Delivery Matrix */}
                {activeTab === "zomato_delivery" && (
                  <>
                    <RowLabel label="Orders" isNumber items={currentItems} field="orders" />
                    <RowLabel label="Sub Total" isCurrency items={currentItems} field="subTotal" />
                    <RowLabel label="Packaging Charges" isCurrency items={currentItems} field="packagingCharges" />
                    <RowLabel label="Sub Total + Packaging Charges" isCurrency items={currentItems} field="subTotalWithPkg" highlight />
                    <RowLabel label="Cancelled Order Refund" isCurrency items={currentItems} field="cancelledOrderRefund" />
                    <RowLabel label="Discount" isCurrency items={currentItems} field="discount" />
                    <RowLabel label="Discount %" isPct items={currentItems} field="discountPct" badgeColor="blue" />
                    <RowLabel label="Comisionable Value (Including GST Collected)" isCurrency items={currentItems} field="commissionableValue" />
                    <RowLabel label="Order level Deduction (Com + PG )" isCurrency items={currentItems} field="orderLevelDeduction" />
                    <RowLabel label="Tax Deduction" isCurrency items={currentItems} field="taxDeduction" />
                    <RowLabel label="Ads" isCurrency items={currentItems} field="ads" />
                    <RowLabel label="Ads%" isPct items={currentItems} field="adsPct" badgeColor="purple" />
                    <RowLabel label="Hyperpure" isCurrency items={currentItems} field="hyperpure" />
                    <RowLabel label="Net Payout" isCurrency items={currentItems} field="netPayout" highlightGreen />
                    <RowLabel label="Net Payout + Hyperpure" isCurrency items={currentItems} field="netPayoutWithHyperpure" />
                    <RowLabel label="Net Payout %" isPct items={currentItems} field="netPayoutPct" badgeColor="emerald" />
                    <RowLabel label="Overall Burn %" isPct items={currentItems} field="overallBurnPct" badgeColor="amber" />
                  </>
                )}

                {/* 2. Format Z Dinein Matrix */}
                {activeTab === "zomato_dinein" && (
                  <>
                    <RowLabel label="Transactions" isNumber items={currentItems} field="transactions" />
                    <RowLabel label="Pre Gmv (Bill Amount)" isCurrency items={currentItems} field="preGmv" />
                    <RowLabel label="Post Gmv (Bill Amount - Discount)" isCurrency items={currentItems} field="postGmv" highlight />
                    <RowLabel label="Discount" isCurrency items={currentItems} field="discount" />
                    <RowLabel label="Discount %" isPct items={currentItems} field="discountPct" badgeColor="blue" />
                    <RowLabel label="Commission" isCurrency items={currentItems} field="commission" />
                    <RowLabel label="Commission%" isPct items={currentItems} field="commissionPct" badgeColor="purple" />
                    <RowLabel label="Ads" isCurrency items={currentItems} field="ads" />
                    <RowLabel label="Net Payout" isCurrency items={currentItems} field="netPayout" highlightGreen />
                    <RowLabel label="Net Payout %" isPct items={currentItems} field="netPayoutPct" badgeColor="emerald" />
                    <RowLabel label="Overall Burn %" isPct items={currentItems} field="overallBurnPct" badgeColor="amber" />
                  </>
                )}

                {/* 3. Swiggy Delivery Matrix */}
                {activeTab === "swiggy_delivery" && (
                  <>
                    <RowLabel label="Orders" isNumber items={currentItems} field="orders" />
                    <RowLabel label="ST" isCurrency items={currentItems} field="subTotal" />
                    <RowLabel label="PC" isCurrency items={currentItems} field="packagingCharges" />
                    <RowLabel label="ST + PC" isCurrency items={currentItems} field="subTotalWithPkg" highlight />
                    <RowLabel label="Discount" isCurrency items={currentItems} field="discount" />
                    <RowLabel label="Discount %" isPct items={currentItems} field="discountPct" badgeColor="blue" />
                    <RowLabel label="Comisionable Value" isCurrency items={currentItems} field="commissionableValue" />
                    <RowLabel label="Com + PG + GST" isCurrency items={currentItems} field="comPgGst" />
                    <RowLabel label="Complaints and cancellation charges" isCurrency items={currentItems} field="complaintsCancellation" />
                    <RowLabel label="Tax" isCurrency items={currentItems} field="tax" />
                    <RowLabel label="Ads" isCurrency items={currentItems} field="ads" />
                    <RowLabel label="Ads%" isPct items={currentItems} field="adsPct" badgeColor="purple" />
                    <RowLabel label="Net Payout" isCurrency items={currentItems} field="netPayout" highlightGreen />
                    <RowLabel label="Net Payout %" isPct items={currentItems} field="netPayoutPct" badgeColor="emerald" />
                    <RowLabel label="Overall Burn %" isPct items={currentItems} field="overallBurnPct" badgeColor="amber" />
                  </>
                )}

                {/* 4. Swiggy Dineout Matrix */}
                {activeTab === "swiggy_dineout" && (
                  <>
                    <RowLabel label="Transactions" isNumber items={currentItems} field="transactions" />
                    <RowLabel label="Pre Gmv" isCurrency items={currentItems} field="preGmv" />
                    <RowLabel label="Post Gmv" isCurrency items={currentItems} field="postGmv" highlight />
                    <RowLabel label="Discount" isCurrency items={currentItems} field="discount" />
                    <RowLabel label="Discount %" isPct items={currentItems} field="discountPct" badgeColor="blue" />
                    <RowLabel label="Commission" isCurrency items={currentItems} field="commission" />
                    <RowLabel label="Commission%" isPct items={currentItems} field="commissionPct" badgeColor="purple" />
                    <RowLabel label="Ads" isCurrency items={currentItems} field="ads" />
                    <RowLabel label="Net Payout" isCurrency items={currentItems} field="netPayout" highlightGreen />
                    <RowLabel label="Net Payout %" isPct items={currentItems} field="netPayoutPct" badgeColor="emerald" />
                    <RowLabel label="Overall Burn %" isPct items={currentItems} field="overallBurnPct" badgeColor="amber" />
                  </>
                )}

                {/* 5. Overall Delivery Matrix (Combined Zomato + Swiggy) */}
                {activeTab === "overall_delivery" && (
                  <>
                    <RowLabel label="Combined Orders" isNumber items={currentItems} field="orders" />
                    <RowLabel label="Sub Total" isCurrency items={currentItems} field="subTotal" />
                    <RowLabel label="Packaging Charges" isCurrency items={currentItems} field="packagingCharges" />
                    <RowLabel label="Sub Total + Packaging Charges" isCurrency items={currentItems} field="subTotalWithPkg" highlight />
                    <RowLabel label="Discount" isCurrency items={currentItems} field="discount" />
                    <RowLabel label="Discount %" isPct items={currentItems} field="discountPct" badgeColor="blue" />
                    <RowLabel label="Commissionable Value" isCurrency items={currentItems} field="commissionableValue" />
                    <RowLabel label="Platform Fees & Deductions" isCurrency items={currentItems} field="platformFeesDeductions" />
                    <RowLabel label="Ads Spend" isCurrency items={currentItems} field="ads" />
                    <RowLabel label="Ads %" isPct items={currentItems} field="adsPct" badgeColor="purple" />
                    <RowLabel label="Hyperpure (Zomato)" isCurrency items={currentItems} field="hyperpure" />
                    <RowLabel label="Net Payout" isCurrency items={currentItems} field="netPayout" highlightGreen />
                    <RowLabel label="Net Payout %" isPct items={currentItems} field="netPayoutPct" badgeColor="emerald" />
                    <RowLabel label="Overall Burn %" isPct items={currentItems} field="overallBurnPct" badgeColor="amber" />
                  </>
                )}

                {/* 6. Overall Dineout Matrix (Combined Zomato + Swiggy) */}
                {activeTab === "overall_dineout" && (
                  <>
                    <RowLabel label="Combined Transactions" isNumber items={currentItems} field="transactions" />
                    <RowLabel label="Pre Gmv" isCurrency items={currentItems} field="preGmv" />
                    <RowLabel label="Post Gmv" isCurrency items={currentItems} field="postGmv" highlight />
                    <RowLabel label="Discount" isCurrency items={currentItems} field="discount" />
                    <RowLabel label="Discount %" isPct items={currentItems} field="discountPct" badgeColor="blue" />
                    <RowLabel label="Commission" isCurrency items={currentItems} field="commission" />
                    <RowLabel label="Commission %" isPct items={currentItems} field="commissionPct" badgeColor="purple" />
                    <RowLabel label="Ads Spend" isCurrency items={currentItems} field="ads" />
                    <RowLabel label="Net Payout" isCurrency items={currentItems} field="netPayout" highlightGreen />
                    <RowLabel label="Net Payout %" isPct items={currentItems} field="netPayoutPct" badgeColor="emerald" />
                    <RowLabel label="Overall Burn %" isPct items={currentItems} field="overallBurnPct" badgeColor="amber" />
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111111] border border-[#272727] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[#272727] p-5 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute top-4 right-4 text-[#555555] hover:text-[#f5f5f5] p-1 rounded-lg transition-all z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-0.5 pr-6">
              <h2 className="text-base font-bold text-[#f5f5f5]">Upload Payout Report Data</h2>
              <p className="text-xs text-[#a3a3a3]">
                Upload screenshots or Excel/CSV files for automatic extraction & matrix reporting
              </p>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Platform & Type Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-[#a3a3a3] font-medium">Platform</label>
                  <select
                    value={uploadPlatform}
                    onChange={(e) => setUploadPlatform(e.target.value as ReportPlatform)}
                    className="w-full bg-[#161616] border border-[#272727] rounded-lg p-2.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-emerald-500"
                  >
                    <option value="zomato">Zomato</option>
                    <option value="swiggy">Swiggy</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-[#a3a3a3] font-medium">Type</label>
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value as ReportType)}
                    className="w-full bg-[#161616] border border-[#272727] rounded-lg p-2.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-emerald-500"
                  >
                    <option value="delivery">Delivery</option>
                    <option value="dinein">Dine-in / Dineout</option>
                  </select>
                </div>
              </div>

              {/* Period Label */}
              <div className="space-y-1.5">
                <label className="text-xs text-[#a3a3a3] font-medium">Period Label</label>
                <input
                  type="text"
                  placeholder="e.g. '1-10 Aug', 'July 20', 'May'"
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  className="w-full bg-[#161616] border border-[#272727] rounded-lg p-2.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Interactive Mini Calendar & Quick Presets Selector */}
              <div className="space-y-3 p-3.5 rounded-xl bg-[#161616] border border-[#272727]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#f5f5f5] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Select Date Range</span>
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {startDate && endDate
                      ? `${startDate} → ${endDate}`
                      : startDate
                      ? `From ${startDate} (pick end date)`
                      : "Pick start & end date below"}
                  </span>
                </div>

                {/* Mini Calendar UI */}
                <div className="bg-[#111111] border border-[#222222] rounded-lg p-2.5 space-y-2">
                  {/* Calendar Month Navigation Header */}
                  <div className="flex items-center justify-between px-1">
                    <button
                      type="button"
                      onClick={() =>
                        setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1))
                      }
                      className="p-1 rounded text-[#a3a3a3] hover:text-white hover:bg-[#222222] transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-[#f5f5f5]">
                      {calDate.toLocaleString("default", { month: "long", year: "numeric" })}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1))
                      }
                      className="p-1 rounded text-[#a3a3a3] hover:text-white hover:bg-[#222222] transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Day of Week Header */}
                  <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-[#666666]">
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                      <div key={d} className="py-1">
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Days Grid */}
                  {(() => {
                    const year = calDate.getFullYear();
                    const month = calDate.getMonth();
                    const firstDayIdx = new Date(year, month, 1).getDay();
                    const totalDays = new Date(year, month + 1, 0).getDate();

                    const sObj = startDate ? new Date(startDate) : null;
                    const eObj = endDate ? new Date(endDate) : null;

                    const days = [];
                    // Padding leading blanks
                    for (let i = 0; i < firstDayIdx; i++) {
                      days.push(<div key={`blank-${i}`} className="p-1" />);
                    }

                    // Month days
                    for (let d = 1; d <= totalDays; d++) {
                      const currStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                      const currObj = new Date(year, month, d);

                      const isStart = startDate === currStr;
                      const isEnd = endDate === currStr;
                      const isInRange =
                        sObj &&
                        eObj &&
                        currObj > sObj &&
                        currObj < eObj;

                      let btnStyle = "bg-[#181818] text-[#cccccc] hover:bg-[#252525] hover:text-white";
                      if (isStart || isEnd) {
                        btnStyle = "bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/20";
                      } else if (isInRange) {
                        btnStyle = "bg-emerald-500/20 text-emerald-300 font-medium";
                      }

                      days.push(
                        <button
                          key={`day-${d}`}
                          type="button"
                          onClick={() => handleCalendarDayClick(year, month, d)}
                          className={`h-7 w-full rounded text-[11px] flex items-center justify-center transition-all ${btnStyle}`}
                        >
                          {d}
                        </button>
                      );
                    }

                    return <div className="grid grid-cols-7 gap-1">{days}</div>;
                  })()}
                </div>

                {/* Quick Presets */}
                <div className="space-y-1.5 pt-1 border-t border-[#222222]">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-[#a3a3a3] uppercase font-bold tracking-wider">Quick Presets</p>
                    <span className="text-[10px] text-[#555555]">1-Click Selection</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickDate(7)}
                      className="px-2.5 py-1 rounded-full bg-[#111111] hover:bg-[#252525] border border-[#2d2d2d] text-[10px] text-[#a3a3a3] hover:text-white transition-all"
                    >
                      Last 1 week
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDate(14)}
                      className="px-2.5 py-1 rounded-full bg-[#111111] hover:bg-[#252525] border border-[#2d2d2d] text-[10px] text-[#a3a3a3] hover:text-white transition-all"
                    >
                      Last 2 weeks
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDate(21)}
                      className="px-2.5 py-1 rounded-full bg-[#111111] hover:bg-[#252525] border border-[#2d2d2d] text-[10px] text-[#a3a3a3] hover:text-white transition-all"
                    >
                      Last 3 weeks
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDate(30)}
                      className="px-2.5 py-1 rounded-full bg-[#111111] hover:bg-[#252525] border border-[#2d2d2d] text-[10px] text-[#a3a3a3] hover:text-white transition-all"
                    >
                      Last 4 weeks
                    </button>
                  </div>
                </div>

                {/* Start Date & End Date Range Inputs */}
                <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-[#222222]">
                  <div>
                    <label className="text-[10px] text-[#888888] block mb-1 font-medium">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-[#111111] border border-[#272727] rounded-lg p-2 text-xs text-[#f5f5f5] focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#888888] block mb-1 font-medium">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-[#111111] border border-[#272727] rounded-lg p-2 text-xs text-[#f5f5f5] focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* File Dropzone */}
              <div className="space-y-1">
                <label className="text-xs text-[#a3a3a3] font-medium">Upload File(s)</label>
                <div className="border-2 border-dashed border-[#272727] hover:border-emerald-500/50 rounded-xl p-3.5 text-center space-y-1 bg-[#161616]/50 transition-all cursor-pointer relative">
                  <input
                    type="file"
                    multiple={uploadType === "delivery" || uploadPlatform === "swiggy"}
                    accept={uploadType === "delivery" ? "image/*" : ".xlsx,.csv"}
                    onChange={(e) => {
                      if (e.target.files) {
                        setSelectedFiles(Array.from(e.target.files));
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <UploadCloud className="w-6 h-6 text-emerald-400 mx-auto" />
                  <p className="text-xs text-[#f5f5f5] font-medium">
                    {uploadType === "dinein"
                      ? uploadPlatform === "zomato"
                        ? "Click or drag Zomato Dine-in Excel file (.xlsx)"
                        : "Click or drag Swiggy Dineout CSV file (.csv)"
                      : uploadPlatform === "zomato"
                      ? "Click or drag Zomato Payout Screenshots (1-2 images)"
                      : "Click or drag Swiggy Payout Screenshots (1-2 images)"}
                  </p>
                  <p className="text-[10px] text-[#666666]">
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length} file(s) selected: ${selectedFiles.map((f) => f.name).join(", ")}`
                      : uploadType === "delivery"
                      ? "Upload Partner App Payout Screenshots (PNG, JPG, WEBP)"
                      : "Recommended: Official Merchant Settlement Excel/CSV (.xlsx, .csv)"}
                  </p>
                </div>
              </div>

              {/* Manual Ads Input */}
              <div className="space-y-1">
                <label className="text-xs text-[#a3a3a3] font-medium flex items-center justify-between">
                  <span>Manual Ads Override (Optional)</span>
                  <span className="text-[10px] text-[#555555]">Useful if Ads missing in CSV</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 59000"
                  value={manualAds}
                  onChange={(e) => setManualAds(e.target.value)}
                  className="w-full bg-[#161616] border border-[#272727] rounded-lg p-2 text-xs text-[#f5f5f5] focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Messages */}
              {uploadError && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              {/* Pinned Submit Button */}
              <div className="sticky bottom-0 bg-[#111111] pt-2 pb-1 border-t border-[#222222] z-20">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black text-xs font-bold rounded-lg shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Extracting & Calculating Metrics...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Process & Generate Period Column</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Classy Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#111111] border border-[#272727] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setDeleteTarget(null)}
              className="absolute top-4 right-4 text-[#555555] hover:text-[#f5f5f5] p-1 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Warning Icon Badge */}
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#f5f5f5]">
                  Delete Period Column?
                </h3>
                <p className="text-xs text-red-400/90 font-medium mt-0.5">
                  This action cannot be undone
                </p>
              </div>
            </div>

            {/* Message Body */}
            <div className="p-3.5 rounded-xl bg-[#161616] border border-[#222222] space-y-1">
              <p className="text-xs text-[#a3a3a3]">
                Are you sure you want to permanently remove the telemetry data for:
              </p>
              <p className="text-sm font-bold text-emerald-400 font-mono">
                "{deleteTarget.label}"
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#222222]">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-[#181818] hover:bg-[#222222] border border-[#2d2d2d] text-xs font-medium text-[#cccccc] hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeletePeriod}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold shadow-lg shadow-red-500/20 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete Column</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Table Row Component
function RowLabel({
  label,
  isCurrency,
  isPct,
  isNumber,
  items,
  field,
  highlight,
  highlightGreen,
  badgeColor,
}: {
  label: string;
  isCurrency?: boolean;
  isPct?: boolean;
  isNumber?: boolean;
  items: any[];
  field: string;
  highlight?: boolean;
  highlightGreen?: boolean;
  badgeColor?: "emerald" | "amber" | "blue" | "purple";
}) {
  function formatValue(val: any) {
    if (val === undefined || val === null) return "-";
    if (isCurrency) {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(Number(val));
    }
    if (isPct) {
      return `${Number(val).toFixed(2)}%`;
    }
    return String(val);
  }

  return (
    <tr
      className={`hover:bg-[#161616]/50 transition-all ${
        highlight ? "bg-[#141414] font-semibold text-[#f5f5f5]" : ""
      } ${highlightGreen ? "bg-emerald-500/5 font-bold text-emerald-400" : ""}`}
    >
      <td className="p-4 border-r border-[#272727] sticky left-0 bg-[#111111] font-medium text-[#d4d4d4] z-10">
        {label}
      </td>
      {items.map((item) => {
        const rawVal = item[field];
        return (
          <td key={item.id} className="p-4 border-r border-[#272727] text-right font-mono">
            {badgeColor ? (
              <span
                className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                  badgeColor === "emerald"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : badgeColor === "amber"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : badgeColor === "blue"
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                }`}
              >
                {formatValue(rawVal)}
              </span>
            ) : (
              <span>{formatValue(rawVal)}</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}
