"use client";

import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { 
  TrendingUp, 
  Upload, 
  Download, 
  Sparkles, 
  RefreshCw, 
  FileSpreadsheet, 
  Sliders, 
  Store,
  FileImage,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  ArrowRight,
  Zap,
  Check,
  Building2
} from "lucide-react";
import { MonthData, ProjectionBrandState, calculateMonthMetrics } from "@/lib/projections";
import { useBrand } from "@/components/BrandContext";

// Helper: Calculate past 3 baseline months & target 3 projected months from a target date
function computeDynamicMonthNames(targetYear: number, targetMonthIdx: number) {
  const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const historical: { name: string; fullYear: number; monthIdx: number }[] = [];
  for (let i = 3; i >= 1; i--) {
    let m = targetMonthIdx - i;
    let y = targetYear;
    if (m < 0) {
      m += 12;
      y -= 1;
    }
    const yrShort = String(y).slice(-2);
    historical.push({
      name: `${monthNamesShort[m]} '${yrShort}`,
      fullYear: y,
      monthIdx: m,
    });
  }

  const projected: { name: string; fullYear: number; monthIdx: number }[] = [];
  for (let i = 0; i < 3; i++) {
    let m = targetMonthIdx + i;
    let y = targetYear;
    if (m >= 12) {
      m -= 12;
      y += 1;
    }
    const yrShort = String(y).slice(-2);
    projected.push({
      name: `${monthNamesShort[m]} '${yrShort}`,
      fullYear: y,
      monthIdx: m,
    });
  }

  return { historical, projected };
}

export default function ProjectionsPage() {
  const { activeBrand } = useBrand();
  const [brandName, setBrandName] = useState(activeBrand?.name || "Active Brand");
  
  // Dynamic Target Period State (defaulted to current target month)
  const now = new Date();
  const [targetYear, setTargetYear] = useState<number>(now.getFullYear());
  const [targetMonthIdx, setTargetMonthIdx] = useState<number>(now.getMonth());

  const [historicalMonths, setHistoricalMonths] = useState<MonthData[]>([]);
  const [projectedMonths, setProjectedMonths] = useState<MonthData[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"table" | "assumptions" | "ai">("table");

  // Modal State for Upload Data & Reports
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Per-month data cards for historical months (Month -3, Month -2, Month -1)
  const [monthCardStatus, setMonthCardStatus] = useState<
    {
      platform: "zomato" | "swiggy";
      files: File[];
      isLoaded: boolean;
      data: Partial<MonthData> | null;
      m2oPct: number;
      menuOpens: number;
      aov: number;
      source: "none" | "ocr" | "reporting" | "excel";
    }[]
  >([
    { platform: "zomato", files: [], isLoaded: false, data: null, m2oPct: 7.4, menuOpens: 12350, aov: 285, source: "none" },
    { platform: "zomato", files: [], isLoaded: false, data: null, m2oPct: 7.0, menuOpens: 18670, aov: 317, source: "none" },
    { platform: "zomato", files: [], isLoaded: false, data: null, m2oPct: 6.3, menuOpens: 20130, aov: 328, source: "none" },
  ]);

  const [ocrLoadingIdx, setOcrLoadingIdx] = useState<number | null>(null);
  const [autoSyncLoading, setAutoSyncLoading] = useState(false);
  const [projNotification, setProjNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  useEffect(() => {
    if (activeBrand?.name) {
      setBrandName(activeBrand.name);
    }
  }, [activeBrand]);

  const fileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkOcrLoading, setBulkOcrLoading] = useState(false);

  const handleRunBulkOcrScan = async (filesToScan?: File[]) => {
    const targetFiles = filesToScan || bulkFiles;
    if (targetFiles.length === 0) {
      setProjNotification({ type: "info", message: "Please select a 3-Month report screenshot or Excel file first." });
      return;
    }

    const firstFile = targetFiles[0];
    const isExcel = firstFile.name.endsWith(".xlsx") || firstFile.name.endsWith(".xls") || firstFile.name.endsWith(".csv");

    if (isExcel) {
      return handleBulkExcelUpload(firstFile);
    }

    setBulkOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append("platform", "combined_3month");
      targetFiles.forEach((file) => formData.append("files", file));

      const res = await fetch("/api/projections/ocr", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to process 3-month report.");
      }

      const monthsData: any[] = json.months || [];
      if (monthsData.length > 0) {
        const { historical } = computeDynamicMonthNames(targetYear, targetMonthIdx);

        setMonthCardStatus((prev) => {
          const next = [...prev];
          monthsData.forEach((m, idx) => {
            if (idx < 3) {
              next[idx] = {
                ...next[idx],
                isLoaded: true,
                source: "ocr",
                aov: m.aov || next[idx].aov,
                data: {
                  ...m,
                  name: historical[idx]?.name || m.name,
                },
              };
            }
          });
          return next;
        });
        setProjNotification({ type: "success", message: `AI OCR successfully extracted data for ${monthsData.length} months from your 3-Month report!` });
      }
    } catch (err: any) {
      setProjNotification({ type: "error", message: "Bulk OCR Error: " + String(err.message || err) });
    } finally {
      setBulkOcrLoading(false);
    }
  };

  const handleBulkExcelUpload = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });

      if (wb.SheetNames.length === 0) {
        throw new Error("Excel file has no readable worksheets.");
      }

      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      const parsedMonths: any[] = [];
      rawRows.forEach((row: any) => {
        if (!Array.isArray(row) || row.length < 5) return;

        const col0 = String(row[0] || "").toLowerCase();
        const isMonthRow = [
          "jan", "feb", "mar", "apr", "may", "jun",
          "jul", "aug", "sep", "oct", "nov", "dec"
        ].some((m) => col0.includes(m));

        if (isMonthRow || (!isNaN(Number(row[1])) && Number(row[1]) > 500)) {
          const orders = parseFloat(String(row[1] || "0")) || 0;
          const subTotal = parseFloat(String(row[2] || "0")) || 0;
          const netPayout = parseFloat(String(row[row.length - 1] || "0")) || 0;
          const discountBurn = parseFloat(String(row[3] || "0")) || 0;
          const adSpend = parseFloat(String(row[4] || "0")) || 0;

          if (orders > 0 || subTotal > 0) {
            parsedMonths.push({
              name: String(row[0] || "Month"),
              totalOrders: orders,
              subTotalSales: subTotal,
              aov: orders > 0 ? Math.round(subTotal / orders) : 300,
              merchantDiscountBurn: discountBurn,
              advertisement: adSpend,
              netPayout: netPayout > 0 ? netPayout : Math.round(subTotal * 0.65),
            });
          }
        }
      });

      if (parsedMonths.length === 0) {
        const jsonRows: any[] = XLSX.utils.sheet_to_json(firstSheet);
        jsonRows.forEach((r: any) => {
          const orders = parseFloat(r["Orders"] || r["total_orders"] || r["orders"] || "0") || 0;
          const sales = parseFloat(r["Sales"] || r["subtotal"] || r["gross_sales"] || "0") || 0;
          if (orders > 0 || sales > 0) {
            parsedMonths.push({
              name: r["Month"] || r["month"] || "Month",
              totalOrders: orders,
              subTotalSales: sales,
              aov: orders > 0 ? Math.round(sales / orders) : 300,
              merchantDiscountBurn: parseFloat(r["Discount"] || r["discounts"] || "0") || 0,
              advertisement: parseFloat(r["Ads"] || r["ad_spend"] || "0") || 0,
              netPayout: parseFloat(r["Payout"] || r["net_payout"] || "0") || Math.round(sales * 0.65),
            });
          }
        });
      }

      const { historical } = computeDynamicMonthNames(targetYear, targetMonthIdx);

      const rows: any[] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      let ordersRow: any[] | null = null;
      let subTotalRow: any[] | null = null;
      let aovRow: any[] | null = null;
      let netPayoutRow: any[] | null = null;
      let discountRow: any[] | null = null;
      let adsRow: any[] | null = null;
      let commRow: any[] | null = null;
      let pkgRow: any[] | null = null;

      rows.forEach((r: any) => {
        if (!r || !r[0]) return;
        const key = String(r[0]).toLowerCase();
        if (key.includes("orders")) ordersRow = r;
        else if (key.includes("sub total") || key.includes("subtotal")) subTotalRow = r;
        else if (key.includes("aov")) aovRow = r;
        else if (key.includes("net payout") || key.includes("payout")) netPayoutRow = r;
        else if (key.includes("discount")) discountRow = r;
        else if (key.includes("advertisement") || key.includes("ads")) adsRow = r;
        else if (key.includes("comm") || key.includes("commission")) commRow = r;
        else if (key.includes("packaging")) pkgRow = r;
      });

      setMonthCardStatus((prev) => {
        const next = [...prev];
        [0, 1, 2].forEach((idx) => {
          const col = idx + 1;
          const orders = ordersRow && ordersRow[col] ? Number(String(ordersRow[col]).replace(/[^0-9]/g, "")) || 0 : 0;
          const subTotal = subTotalRow && subTotalRow[col] ? Number(String(subTotalRow[col]).replace(/[^0-9]/g, "")) || 0 : 0;
          const aov = aovRow && aovRow[col] ? Number(String(aovRow[col]).replace(/[^0-9]/g, "")) || (orders > 0 ? Math.round(subTotal / orders) : next[idx].aov) : next[idx].aov;
          const netPayout = netPayoutRow && netPayoutRow[col] ? Number(String(netPayoutRow[col]).replace(/[^0-9]/g, "")) || 0 : 0;
          const packagingCharges = pkgRow && pkgRow[col] ? Number(String(pkgRow[col]).replace(/[^0-9]/g, "")) || 0 : 0;
          const merchantDiscountBurn = discountRow && discountRow[col] ? Number(String(discountRow[col]).replace(/[^0-9]/g, "")) || 0 : 0;
          const advertisement = adsRow && adsRow[col] ? Number(String(adsRow[col]).replace(/[^0-9]/g, "")) || 0 : 0;
          const commissionPgGst = commRow && commRow[col] ? Number(String(commRow[col]).replace(/[^0-9]/g, "")) || 0 : 0;

          if (subTotal > 0 || orders > 0 || netPayout > 0) {
            next[idx] = {
              ...next[idx],
              isLoaded: true,
              source: "excel",
              aov,
              data: {
                name: historical[idx]?.name || `Month ${idx + 1}`,
                orders,
                subTotal,
                aov,
                packagingCharges,
                merchantDiscountBurn,
                advertisement,
                commissionPgGst,
                netPayout,
              },
            };
          }
        });
        return next;
      });
      setProjNotification({ type: "success", message: "Successfully parsed 3-Month Excel report sheet!" });
    } catch (err: any) {
      setProjNotification({ type: "error", message: "Failed to parse Excel file: " + String(err.message || err) });
    }
  };

  // Re-compute month names whenever target month/year changes
  useEffect(() => {
    const { historical, projected } = computeDynamicMonthNames(targetYear, targetMonthIdx);

    setHistoricalMonths((prev) => {
      if (prev.length === 3) {
        return prev.map((m, idx) => ({ ...m, name: historical[idx].name }));
      }
      return historical.map((h) =>
        calculateMonthMetrics({
          name: h.name,
          isProjection: false,
          orders: 900,
          subTotal: 270000,
          aov: 300,
          m2o: 0.07,
          menuOpens: 13000,
        })
      );
    });

    setProjectedMonths((prev) => {
      if (prev.length === 3) {
        return prev.map((m, idx) => ({ ...m, name: projected[idx].name }));
      }
      return projected.map((p, idx) =>
        calculateMonthMetrics({
          name: p.name,
          isProjection: true,
          orders: 1400 + idx * 200,
          aov: 350 + idx * 20,
          m2o: 0.08 + idx * 0.01,
          menuOpens: 18000,
        })
      );
    });
  }, [targetYear, targetMonthIdx]);

  // Load dataset from API / Seed
  const loadProjections = async () => {
    setLoading(true);
    try {
      const url = activeBrand?.id ? `/api/projections?brandId=${activeBrand.id}` : "/api/projections";
      const res = await fetch(url);
      if (res.ok) {
        const data: ProjectionBrandState = await res.json();
        if (activeBrand?.name) {
          setBrandName(activeBrand.name);
        } else if (data.brandName) {
          setBrandName(data.brandName);
        }
        if (data.historicalMonths && data.historicalMonths.length === 3) {
          const recomputed = data.historicalMonths.map((m) => calculateMonthMetrics(m));
          setHistoricalMonths(recomputed);
        }
        if (data.projectedMonths && data.projectedMonths.length === 3) {
          const recomputed = data.projectedMonths.map((m) => calculateMonthMetrics(m));
          setProjectedMonths(recomputed);
        }
        setNotes(data.notes || "");
      }
    } catch (err) {
      console.error("Failed to load projections:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjections();
  }, [activeBrand?.id]);

  // Synchronize Modal Cards with loaded historicalMonths
  useEffect(() => {
    if (historicalMonths && historicalMonths.length === 3) {
      setMonthCardStatus((prev) =>
        historicalMonths.map((hm, idx) => {
          const cardData = prev[idx]?.data || {};
          const effectiveOrders = (cardData.orders && cardData.orders > 0) ? cardData.orders : (hm.orders || 0);
          const m2oDecimal = hm.m2o || 0.07;
          const m2oPct = Number((m2oDecimal * 100).toFixed(1));
          const computedMenuOpens = (effectiveOrders > 0 && m2oDecimal > 0)
            ? Math.round(effectiveOrders / m2oDecimal)
            : (hm.menuOpens || (prev[idx]?.menuOpens || 5000));

          return {
            platform: prev[idx]?.platform || "zomato",
            files: prev[idx]?.files || [],
            isLoaded: true,
            source: prev[idx]?.source || "reporting",
            m2oPct: m2oPct || 7.0,
            menuOpens: computedMenuOpens,
            aov: hm.aov || 300,
            data: {
              name: hm.name,
              orders: effectiveOrders,
              subTotal: cardData.subTotal || hm.subTotal,
              packagingCharges: cardData.packagingCharges !== undefined ? cardData.packagingCharges : hm.packagingCharges,
              merchantDiscountBurn: cardData.merchantDiscountBurn !== undefined ? cardData.merchantDiscountBurn : hm.merchantDiscountBurn,
              commissionPgGst: cardData.commissionPgGst !== undefined ? cardData.commissionPgGst : hm.commissionPgGst,
              advertisement: cardData.advertisement !== undefined ? cardData.advertisement : hm.advertisement,
              netPayout: cardData.netPayout !== undefined ? cardData.netPayout : hm.netPayout,
            },
          };
        })
      );
    }
  }, [historicalMonths]);

  // Update a single assumption for a historical baseline month
  const handleUpdateHistoricalMonth = (index: number, patch: Partial<MonthData>) => {
    setHistoricalMonths((prev) => {
      const next = [...prev];
      const current = next[index];

      const newM2o = patch.m2o !== undefined ? patch.m2o : current.m2o;
      const newMenuOpens = patch.menuOpens !== undefined ? patch.menuOpens : current.menuOpens;
      const newAov = patch.aov !== undefined ? patch.aov : current.aov;

      let newOrders = current.orders;
      if (patch.m2o !== undefined || patch.menuOpens !== undefined) {
        newOrders = Math.round(newMenuOpens * newM2o);
      } else if (patch.orders !== undefined) {
        newOrders = patch.orders;
      }

      let newSubTotal = current.subTotal;
      if (patch.m2o !== undefined || patch.menuOpens !== undefined || patch.aov !== undefined) {
        newSubTotal = Math.round(newOrders * newAov);
      } else if (patch.subTotal !== undefined) {
        newSubTotal = patch.subTotal;
      }

      const updatedPartial: Partial<MonthData> = {
        ...current,
        ...patch,
        m2o: newM2o,
        menuOpens: newMenuOpens,
        aov: newAov,
        orders: newOrders,
        subTotal: newSubTotal,
      };

      next[index] = calculateMonthMetrics(updatedPartial);
      return next;
    });
  };

  // Update a single assumption for a projected forward month
  const handleUpdateProjectedMonth = (index: number, patch: Partial<MonthData>) => {
    setProjectedMonths((prev) => {
      const next = [...prev];
      const current = next[index];

      const newM2o = patch.m2o !== undefined ? patch.m2o : current.m2o;
      const newMenuOpens = patch.menuOpens !== undefined ? patch.menuOpens : current.menuOpens;
      const newAov = patch.aov !== undefined ? patch.aov : current.aov;

      let newOrders = current.orders;
      if (patch.m2o !== undefined || patch.menuOpens !== undefined) {
        newOrders = Math.round(newMenuOpens * newM2o);
      } else if (patch.orders !== undefined) {
        newOrders = patch.orders;
      }

      let newSubTotal = current.subTotal;
      if (patch.m2o !== undefined || patch.menuOpens !== undefined || patch.aov !== undefined || patch.orders !== undefined) {
        newSubTotal = Math.round(newOrders * newAov);
      } else if (patch.subTotal !== undefined) {
        newSubTotal = patch.subTotal;
      }

      const updatedPartial: Partial<MonthData> = {
        name: patch.name || current.name,
        isProjection: true,
        m2o: newM2o,
        menuOpens: newMenuOpens,
        aov: newAov,
        orders: newOrders,
        subTotal: newSubTotal,
        effectiveDiscountPct: patch.effectiveDiscountPct !== undefined ? patch.effectiveDiscountPct : current.effectiveDiscountPct,
        advertisementPct: patch.advertisementPct !== undefined ? patch.advertisementPct : current.advertisementPct,
        commissionPct: patch.commissionPct !== undefined ? patch.commissionPct : current.commissionPct,
        packagingCharges: patch.packagingCharges !== undefined ? patch.packagingCharges : Math.round(newOrders * 15),
      };

      next[index] = calculateMonthMetrics(updatedPartial);
      return next;
    });
  };

  // ⚡ 1-Click Auto-Sync from Reporting Engine
  const handleAutoSyncFromReporting = async () => {
    setAutoSyncLoading(true);
    try {
      const brandId = activeBrand?.id || "";
      let rollups: any[] = [];

      if (brandId) {
        const rollupRes = await fetch(`/api/reporting/rollups?brandId=${brandId}`);
        if (rollupRes.ok) {
          const rJson = await rollupRes.json();
          rollups = rJson.rollups || [];
        }
      }

      const periodUrl = brandId ? `/api/reporting/periods?brandId=${brandId}` : "/api/reporting/periods";
      const res = await fetch(periodUrl);
      if (!res.ok) throw new Error("Failed to fetch reporting periods.");

      const data = await res.json();
      const periods: any[] = [
        ...(data.zomato_delivery || []),
        ...(data.swiggy_delivery || []),
        ...(data.zomato_dinein || []),
        ...(data.swiggy_dineout || []),
        ...(data.periods || [])
      ];

      if (rollups.length === 0 && periods.length === 0) {
        setProjNotification({ type: "info", message: `No saved reporting periods or monthly rollups found for ${activeBrand?.name || "this brand"} yet.` });
        return;
      }

      const { historical } = computeDynamicMonthNames(targetYear, targetMonthIdx);
      const nextStatus = [...monthCardStatus];

      historical.forEach((hist, idx) => {
        const targetMonthName = hist.name.toLowerCase();
        const matchedRollup = rollups.find((r) => (r.monthName || "").toLowerCase().includes(targetMonthName.slice(0, 3)));

        if (matchedRollup) {
          const aov = matchedRollup.orders > 0 ? Math.round(matchedRollup.subTotal / matchedRollup.orders) : nextStatus[idx].aov;
          const menuOpens = (matchedRollup.orders > 0 && nextStatus[idx].m2oPct > 0) ? Math.round(matchedRollup.orders / (nextStatus[idx].m2oPct / 100)) : nextStatus[idx].menuOpens;
          nextStatus[idx] = {
            ...nextStatus[idx],
            isLoaded: true,
            source: "reporting",
            aov,
            menuOpens,
            data: {
              name: hist.name,
              orders: matchedRollup.orders,
              subTotal: matchedRollup.subTotal,
              packagingCharges: matchedRollup.packagingCharges,
              merchantDiscountBurn: matchedRollup.discount,
              commissionPgGst: matchedRollup.commission,
              advertisement: matchedRollup.ads,
              netPayout: matchedRollup.netPayout,
            },
          };
          return;
        }

        const matched = periods.filter((p) => {
          const lbl = (p.periodLabel || "").toLowerCase();
          return lbl.includes(targetMonthName.slice(0, 3));
        });

        if (matched.length > 0) {
          let aggOrders = 0;
          let aggSubTotal = 0;
          let aggPkg = 0;
          let aggDiscount = 0;
          let aggComm = 0;
          let aggAds = 0;
          let aggNetPayout = 0;

          matched.forEach((p) => {
            aggOrders += Number(p.orders || p.transactions || 0);
            aggSubTotal += Number(p.subTotal || p.preGmv || 0);
            aggPkg += Number(p.packagingCharges || 0);
            aggDiscount += Number(p.discount || 0);
            aggComm += Number(p.commissionableValue ? (p.commissionableValue * 0.28) : (p.commission || p.comPgGst || 0));
            aggAds += Number(p.ads || 0);
            aggNetPayout += Number(p.netPayout || 0);
          });

          const aov = aggOrders > 0 ? Math.round(aggSubTotal / aggOrders) : nextStatus[idx].aov;
          const menuOpens = (aggOrders > 0 && nextStatus[idx].m2oPct > 0) ? Math.round(aggOrders / (nextStatus[idx].m2oPct / 100)) : nextStatus[idx].menuOpens;

          nextStatus[idx] = {
            ...nextStatus[idx],
            isLoaded: true,
            source: "reporting",
            aov,
            menuOpens,
            data: {
              name: hist.name,
              orders: aggOrders,
              subTotal: aggSubTotal,
              packagingCharges: aggPkg,
              merchantDiscountBurn: aggDiscount,
              commissionPgGst: aggComm,
              advertisement: aggAds,
              netPayout: aggNetPayout,
            },
          };
        }
      });

      setMonthCardStatus(nextStatus);
      setProjNotification({ type: "success", message: `Successfully Auto-Synced historical data for ${activeBrand?.name || "Active Brand"}!` });
    } catch (err: any) {
      setProjNotification({ type: "error", message: "Auto-Sync Error: " + String(err.message || err) });
    } finally {
      setAutoSyncLoading(false);
    }
  };

  // Run AI OCR on screenshots for a specific month card
  const handleRunCardOcrScan = async (cardIdx: number) => {
    const card = monthCardStatus[cardIdx];
    if (card.files.length === 0) {
      setProjNotification({ type: "info", message: "Please select payout screenshots first." });
      return;
    }

    setOcrLoadingIdx(cardIdx);
    try {
      const formData = new FormData();
      formData.append("platform", card.platform);
      const targetMonthName = historicalMonths[cardIdx]?.name || `Month - ${3 - cardIdx}`;
      formData.append("monthName", targetMonthName);

      card.files.forEach((file) => formData.append("files", file));

      const res = await fetch("/api/projections/ocr", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to process screenshot.");
      }

      const resData = json.data || {};
      const newAov = resData.aov || card.aov;

      setMonthCardStatus((prev) => {
        const next = [...prev];
        next[cardIdx] = {
          ...next[cardIdx],
          isLoaded: true,
          source: "ocr",
          aov: newAov,
          data: resData,
        };
        return next;
      });
    } catch (err: any) {
      setProjNotification({ type: "error", message: "OCR Processing Error: " + String(err.message || err) });
    } finally {
      setOcrLoadingIdx(null);
    }
  };

  // Apply all 3 loaded month cards to Projections Model
  const handleApplyAllCardsToModel = () => {
    const { historical } = computeDynamicMonthNames(targetYear, targetMonthIdx);

    const updatedHistorical = historicalMonths.map((m, idx) => {
      const card = monthCardStatus[idx];
      const m2oDecimal = card.m2oPct / 100;
      const monthName = historical[idx]?.name || m?.name || `Month - ${3 - idx}`;

      let orders = Math.round(card.menuOpens * m2oDecimal);
      let subTotal = Math.round(orders * card.aov);
      let packagingCharges = Math.round(orders * 15);
      let merchantDiscountBurn = 0;
      let commissionableValue = subTotal + packagingCharges - merchantDiscountBurn;
      let advertisement = Math.round(commissionableValue * 0.15);
      let commissionPgGst = Math.round(commissionableValue * 0.28);
      let netPayout = commissionableValue - advertisement - commissionPgGst;

      if (card.data) {
        orders = card.data.orders || orders;
        subTotal = card.data.subTotal || subTotal;
        packagingCharges = card.data.packagingCharges !== undefined ? card.data.packagingCharges : packagingCharges;
        merchantDiscountBurn = card.data.merchantDiscountBurn !== undefined ? card.data.merchantDiscountBurn : merchantDiscountBurn;
        commissionPgGst = card.data.commissionPgGst !== undefined ? card.data.commissionPgGst : commissionPgGst;
        advertisement = card.data.advertisement !== undefined ? card.data.advertisement : advertisement;
        netPayout = card.data.netPayout !== undefined ? card.data.netPayout : netPayout;
      }

      let computedMenuOpens = card.menuOpens;
      if (orders > 0 && m2oDecimal > 0) {
        computedMenuOpens = Math.round(orders / m2oDecimal);
      }

      const mergedPartial: Partial<MonthData> = {
        name: monthName,
        isProjection: false,
        m2o: m2oDecimal,
        menuOpens: computedMenuOpens,
        orders,
        subTotal,
        aov: card.aov,
        packagingCharges,
        merchantDiscountBurn,
        commissionableValue,
        advertisement,
        commissionPgGst,
        netPayout,
      };

      return calculateMonthMetrics(mergedPartial);
    });

    setHistoricalMonths(updatedHistorical);

    // Save strictly under activeBrand.id
    fetch("/api/projections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandId: activeBrand?.id || "default",
        brandName: brandName || activeBrand?.name || "Active Brand",
        historicalMonths: updatedHistorical,
        projectedMonths,
        notes,
      }),
    });

    setProjNotification({ type: "success", message: "Successfully applied 3-Month Historical Baseline to your Projections Engine!" });
    setShowUploadModal(false);
  };

  // Export 6-Month Projections to Executive Formatted Excel
  const exportToExcel = () => {
    const allMonths = [...historicalMonths, ...projectedMonths];
    
    const formatCurrency = (v: number) => `₹${Math.round(v || 0).toLocaleString("en-IN")}`;
    const formatPct = (v: number) => `${((v || 0) * 100).toFixed(1)}%`;
    const formatNum = (v: number) => Math.round(v || 0).toLocaleString("en-IN");

    const rows: any[][] = [
      ["ETHERS CONSULTANCY — BRAND REVENUE & GROWTH PROJECTIONS MODEL"],
      ["Active Client Brand:", brandName, "", "", "", "", "Report Date:", new Date().toLocaleDateString("en-IN")],
      ["Analysis Period:", "6-Month Financial Forecast (3 Historical Baseline + 3 Projected Target Months)"],
      [],
      ["1. REVENUE & VOLUME METRICS"],
      ["Metric Description", ...allMonths.map((m) => m.name), "Formula / Calculation Source"],
      ["Monthly Target Orders", ...allMonths.map((m) => formatNum(m.orders)), "Menu Opens * M2O Conversion Rate"],
      ["Sub Total Sales (₹)", ...allMonths.map((m) => formatCurrency(m.subTotal)), "Orders * Average Order Value (AOV)"],
      ["Average Order Value (AOV)", ...allMonths.map((m) => formatCurrency(m.aov)), "Historical Baseline / Target Assumption"],
      ["Packaging Charges (₹)", ...allMonths.map((m) => formatCurrency(m.packagingCharges)), "Historical Baseline / Target Assumption"],
      ["Sub Total + Packaging Charges (₹)", ...allMonths.map((m) => formatCurrency(m.subTotalWithPkg)), "Subtotal Sales + Packaging Charges"],
      [],
      ["2. DISCOUNTS, COMMISSIONS & ADVERTISING SPEND"],
      ["Merchant Discount Burn (₹)", ...allMonths.map((m) => formatCurrency(m.merchantDiscountBurn)), "Effective Discount % * Sub Total"],
      ["Effective Discount Rate (%)", ...allMonths.map((m) => formatPct(m.effectiveDiscountPct)), "Historical Baseline / Target Assumption"],
      ["Commissionable Gross Value (₹)", ...allMonths.map((m) => formatCurrency(m.commissionableValue)), "Sub Total + Packaging - Merchant Discount"],
      ["Advertisement Budget (₹)", ...allMonths.map((m) => formatCurrency(m.advertisement)), "Commissionable Value * Advertisement Rate %"],
      ["Advertisement Rate (%)", ...allMonths.map((m) => formatPct(m.advertisementPct)), "Historical Baseline / Target Assumption"],
      ["Platform Comm. + PG + GST (₹)", ...allMonths.map((m) => formatCurrency(m.commissionPgGst)), "Commissionable Value * Commission Rate %"],
      ["Commission %", ...allMonths.map((m) => m.commissionableValue > 0 ? `${((m.commissionPgGst / m.commissionableValue) * 100).toFixed(1)}%` : "0.0%"), "(Comm.+PG+GST / Commissionable Value) * 100"],
      ["Platform Commission Rate (%)", ...allMonths.map((m) => formatPct(m.commissionPct)), "Historical Baseline / Target Assumption"],
      [],
      ["3. PROFITABILITY, PAYOUTS & CONVERSION RATIOS"],
      ["Net Merchant Payout (₹)", ...allMonths.map((m) => formatCurrency(m.netPayout)), "Commissionable Value - Ads - Commission & Fees"],
      ["Net Payout Percentage (%)", ...allMonths.map((m) => `${m.payoutPct}%`), "(Net Payout / Sub Total) * 100"],
      ["Total Discount & Fee Burn (%)", ...allMonths.map((m) => `${m.burnPct}%`), "100% - Net Payout %"],
      ["Menu-to-Order Conversion (M2O %)", ...allMonths.map((m) => formatPct(m.m2o)), "Historical Baseline / Target Assumption"],
      ["Total Monthly Menu Opens", ...allMonths.map((m) => formatNum(m.menuOpens)), "Monthly Target Orders / M2O Conversion %"],
      [],
      ["4. STRATEGIC GROWTH OBSERVATIONS & RECOMMENDATIONS"],
      [notes || "No custom observations recorded."]
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const minWidths = [42, ...allMonths.map(() => 18), 45];
    
    // Auto-fit columns
    if (ws["!ref"]) {
      const range = XLSX.utils.decode_range(ws["!ref"]);
      const colWidths: { wch: number }[] = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        let maxLen = minWidths[C] || 15;
        for (let R = range.s.r; R <= range.e.r; ++R) {
          const cell = ws[XLSX.utils.encode_cell({ c: C, r: R })];
          if (cell && cell.v) {
            const len = String(cell.v).length;
            if (len > maxLen && len < 80) maxLen = len;
          }
        }
        colWidths.push({ wch: maxLen + 4 });
      }
      ws["!cols"] = colWidths;
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Executive Projections");

    const safeBrandName = brandName.toLowerCase().replace(/[^a-z0-9]/g, "_");
    XLSX.writeFile(wb, `${safeBrandName}_growth_projections.xlsx`);
  };

  // Generate AI Growth Insights
  const generateAiInsights = async () => {
    setAiGenerating(true);
    try {
      const res = await fetch("/api/generate-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: "projections_insights",
          brandName,
          historicalMonths,
          projectedMonths
        })
      }).catch(() => null);

      const data = res ? await res.json() : null;
      if (data && data.text) {
        setNotes(data.text);
      } else {
        setNotes(
          `Strategy Recommendation for ${brandName}:\n\n` +
          `1. M2O Optimization: Increasing M2O conversion from ${(historicalMonths[2]?.m2o * 100 || 7).toFixed(1)}% to ${(projectedMonths[2]?.m2o * 100 || 10).toFixed(1)}% increases projected monthly orders from ${projectedMonths[0]?.orders || 1440} to ${projectedMonths[2]?.orders || 1800}.\n` +
          `2. Ad Spend Efficiency: Maintaining ad spend at ${(projectedMonths[2]?.advertisementPct * 100 || 15).toFixed(1)}% on higher AOV (₹${projectedMonths[2]?.aov || 400}) boosts monthly Net Payout to ₹${(projectedMonths[2]?.netPayout || 365382).toLocaleString("en-IN")}.\n` +
          `3. Organic Growth Action: Deploy high-converting dish reels, photo upgrades, and flash discount triggers to ensure maximum menu open conversion.`
        );
      }
    } finally {
      setAiGenerating(false);
    }
  };

  const { historical, projected } = computeDynamicMonthNames(targetYear, targetMonthIdx);
  const allMonths = [...historicalMonths, ...projectedMonths];
  const lastProjected = projectedMonths[projectedMonths.length - 1] || calculateMonthMetrics({});

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-ink tracking-tight">
              Revenue Projections Engine
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-paper-dark border border-line text-emerald-400 uppercase tracking-wider">
              Zomato & Swiggy 6-Month Model
            </span>
          </div>
          <p className="mt-1 text-sm text-ink/50">
            Past 3-month baseline analysis and 3-month forward revenue, discount, ads, and payout modeling.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowUploadModal(true)}
            className="btn btn-secondary text-xs flex items-center gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 shadow-lg"
          >
            <Upload className="w-4 h-4" /> Upload Data & Reports
          </button>

          <button
            onClick={exportToExcel}
            className="btn btn-primary text-xs flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Export Projections (.xlsx)
          </button>
        </div>
      </div>

      {/* Brand Header Card */}
      <div className="card bg-paper-dark border-line p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-paper border border-line text-blue-400">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-ink/40 uppercase tracking-widest block">Active Client Brand</span>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="text-lg font-bold text-ink bg-transparent border-b border-dashed border-ink/30 focus:border-ink outline-none"
            />
          </div>
        </div>

        {/* Executive Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-paper border border-line">
            <span className="text-[10px] text-ink/50 block font-medium">Target Net Payout</span>
            <span className="text-sm font-extrabold text-emerald-400 font-mono">
              ₹{lastProjected.netPayout.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-paper border border-line">
            <span className="text-[10px] text-ink/50 block font-medium">Projected Subtotal</span>
            <span className="text-sm font-extrabold text-ink font-mono">
              ₹{lastProjected.subTotal.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-paper border border-line">
            <span className="text-[10px] text-ink/50 block font-medium">Target M2O Ratio</span>
            <span className="text-sm font-extrabold text-blue-400 font-mono">
              {(lastProjected.m2o * 100).toFixed(1)}%
            </span>
          </div>

          <div className="p-3 rounded-lg bg-paper border border-line">
            <span className="text-[10px] text-ink/50 block font-medium">Net Payout %</span>
            <span className="text-sm font-extrabold text-amber-400 font-mono">
              {lastProjected.payoutPct}%
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-line pb-1 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("table")}
          className={`px-4 py-2 rounded-t-lg transition-all flex items-center gap-1.5 ${
            activeTab === "table"
              ? "bg-paper-dark border-t border-x border-line text-ink font-bold"
              : "text-ink/50 hover:text-ink"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> 6-Month Financial Table
        </button>

        <button
          onClick={() => setActiveTab("assumptions")}
          className={`px-4 py-2 rounded-t-lg transition-all flex items-center gap-1.5 ${
            activeTab === "assumptions"
              ? "bg-paper-dark border-t border-x border-line text-ink font-bold"
              : "text-ink/50 hover:text-ink"
          }`}
        >
          <Sliders className="w-4 h-4 text-blue-400" /> Target Assumptions Modeler
        </button>

        <button
          onClick={() => setActiveTab("ai")}
          className={`px-4 py-2 rounded-t-lg transition-all flex items-center gap-1.5 ${
            activeTab === "ai"
              ? "bg-paper-dark border-t border-x border-line text-ink font-bold"
              : "text-ink/50 hover:text-ink"
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-400" /> AI Growth Strategy
        </button>
      </div>

      {/* TAB 1: 6-Month Financial Table */}
      {activeTab === "table" && (
        <div className="card bg-paper-dark border-line p-0 overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-xs text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-paper border-b border-line text-ink/60 font-mono text-[11px] uppercase tracking-wider">
                  <th className="p-3.5 sticky left-0 bg-paper z-10 w-64 border-r border-line">
                    Metrics & Parameters
                  </th>
                  {historicalMonths.map((m, i) => (
                    <th key={i} className="p-3.5 text-center w-36 border-r border-line bg-paper/50">
                      {m.name} <span className="block text-[9px] text-ink/40 font-normal">Past Baseline</span>
                    </th>
                  ))}
                  {projectedMonths.map((m, i) => (
                    <th key={i} className="p-3.5 text-center w-36 border-r border-line bg-emerald-950/20 text-emerald-400">
                      {m.name} <span className="block text-[9px] text-emerald-500/60 font-normal">Projection</span>
                    </th>
                  ))}
                  <th className="p-3.5 text-left w-64">Formula / Notes</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line/40 text-ink font-medium">
                {/* Orders */}
                <tr className="hover:bg-paper/30">
                  <td className="p-3 font-bold sticky left-0 bg-paper-dark border-r border-line">Orders</td>
                  {historicalMonths.map((m, i) => (
                    <td key={`h-${i}`} className="p-3 text-center font-mono font-bold text-ink border-r border-line/40">
                      {m.orders}
                    </td>
                  ))}
                  {projectedMonths.map((m, i) => (
                    <td key={`p-${i}`} className="p-2 text-center font-mono border-r border-line/40 text-emerald-400">
                      <input
                        type="number"
                        value={m.orders}
                        onChange={(e) => handleUpdateProjectedMonth(i, { orders: Number(e.target.value) })}
                        className="w-20 text-center bg-transparent border-b border-emerald-500/40 focus:border-emerald-400 outline-none font-bold text-emerald-400"
                      />
                    </td>
                  ))}
                  <td className="p-3 text-ink/40 font-mono text-[10px]">Menu Opens * M2O</td>
                </tr>

                {/* Sub Total */}
                <tr className="hover:bg-paper/30 bg-paper/10">
                  <td className="p-3 font-bold sticky left-0 bg-paper-dark border-r border-line">Sub Total (Sales ₹)</td>
                  {historicalMonths.map((m, i) => (
                    <td key={`h-${i}`} className="p-3 text-center font-mono font-extrabold text-ink border-r border-line/40">
                      ₹{m.subTotal.toLocaleString("en-IN")}
                    </td>
                  ))}
                  {projectedMonths.map((m, i) => (
                    <td key={`p-${i}`} className="p-2 text-center font-mono border-r border-line/40">
                      <div className="flex items-center justify-center gap-0.5">
                        <span className="text-emerald-400 font-extrabold">₹</span>
                        <input
                          type="number"
                          value={m.subTotal}
                          onChange={(e) => handleUpdateProjectedMonth(i, { subTotal: Number(e.target.value) })}
                          className="w-24 text-center bg-transparent border-b border-emerald-500/40 focus:border-emerald-400 outline-none font-extrabold text-emerald-400"
                        />
                      </div>
                    </td>
                  ))}
                  <td className="p-3 text-ink/40 font-mono text-[10px]">Orders * AOV</td>
                </tr>

                {/* AOV */}
                <tr className="hover:bg-paper/30">
                  <td className="p-3 font-medium text-ink/70 sticky left-0 bg-paper-dark border-r border-line">AOV (₹)</td>
                  {historicalMonths.map((m, i) => (
                    <td key={`h-${i}`} className="p-3 text-center font-mono font-bold text-ink/80 border-r border-line/40">
                      ₹{m.aov}
                    </td>
                  ))}
                  {projectedMonths.map((m, i) => (
                    <td key={`p-${i}`} className="p-2 text-center font-mono border-r border-line/40">
                      <div className="flex items-center justify-center gap-0.5">
                        <span className="text-emerald-400 font-bold">₹</span>
                        <input
                          type="number"
                          value={m.aov}
                          onChange={(e) => handleUpdateProjectedMonth(i, { aov: Number(e.target.value) })}
                          className="w-16 text-center bg-transparent border-b border-emerald-500/40 focus:border-emerald-400 outline-none font-extrabold text-emerald-400"
                        />
                      </div>
                    </td>
                  ))}
                  <td className="p-3 text-ink/40 font-mono text-[10px]">Average Order Value</td>
                </tr>

                {/* Packaging Charges */}
                <tr className="hover:bg-paper/30">
                  <td className="p-3 font-medium text-ink/70 sticky left-0 bg-paper-dark border-r border-line">Packaging Charges (₹)</td>
                  {historicalMonths.map((m, i) => (
                    <td key={`h-${i}`} className="p-3 text-center font-mono font-medium text-ink/80 border-r border-line/40">
                      ₹{m.packagingCharges.toLocaleString("en-IN")}
                    </td>
                  ))}
                  {projectedMonths.map((m, i) => (
                    <td key={`p-${i}`} className="p-2 text-center font-mono border-r border-line/40">
                      <div className="flex items-center justify-center gap-0.5">
                        <span className="text-emerald-400 font-medium">₹</span>
                        <input
                          type="number"
                          value={m.packagingCharges}
                          onChange={(e) => handleUpdateProjectedMonth(i, { packagingCharges: Number(e.target.value) })}
                          className="w-20 text-center bg-transparent border-b border-emerald-500/40 focus:border-emerald-400 outline-none font-medium text-emerald-400"
                        />
                      </div>
                    </td>
                  ))}
                  <td className="p-3 text-ink/40 font-mono text-[10px]">Inputted packaging revenue</td>
                </tr>

                {/* Sub Total + Packaging */}
                <tr className="hover:bg-paper/30 font-semibold bg-paper/20">
                  <td className="p-3 sticky left-0 bg-paper-dark border-r border-line">Sub Total + Packaging</td>
                  {allMonths.map((m, i) => (
                    <td key={i} className="p-3 text-center font-mono border-r border-line/40">
                      ₹{m.subTotalWithPkg.toLocaleString("en-IN")}
                    </td>
                  ))}
                  <td className="p-3 text-ink/40 font-mono text-[10px]">Subtotal + Packaging charges</td>
                </tr>

                {/* Merchant Discount Burn */}
                <tr className="hover:bg-paper/30 text-amber-400/90">
                  <td className="p-3 font-medium sticky left-0 bg-paper-dark border-r border-line">Merchant Discount Burn</td>
                  {allMonths.map((m, i) => (
                    <td key={i} className="p-3 text-center font-mono border-r border-line/40">
                      ₹{m.merchantDiscountBurn.toLocaleString("en-IN")}
                    </td>
                  ))}
                  <td className="p-3 text-ink/40 font-mono text-[10px]">Effective Discount * Subtotal</td>
                </tr>

                {/* Effective Discount % */}
                <tr className="hover:bg-paper/30 text-amber-400/80">
                  <td className="p-3 font-medium sticky left-0 bg-paper-dark border-r border-line">Effective Discount %</td>
                  {historicalMonths.map((m, i) => (
                    <td key={`h-${i}`} className="p-3 text-center font-mono font-bold text-amber-400 border-r border-line/40">
                      {Number((m.effectiveDiscountPct * 100).toFixed(1))}%
                    </td>
                  ))}
                  {projectedMonths.map((m, i) => (
                    <td key={`p-${i}`} className="p-2 text-center font-mono border-r border-line/40">
                      <div className="flex items-center justify-center gap-0.5">
                        <input
                          type="number"
                          step="0.1"
                          value={Number((m.effectiveDiscountPct * 100).toFixed(1))}
                          onChange={(e) => handleUpdateProjectedMonth(i, { effectiveDiscountPct: Number(e.target.value) / 100 })}
                          className="w-14 text-center bg-transparent border-b border-amber-500/40 focus:border-amber-400 outline-none font-bold text-amber-400"
                        />
                        <span className="text-amber-400">%</span>
                      </div>
                    </td>
                  ))}
                  <td className="p-3 text-ink/40 font-mono text-[10px]">Promo discount rate</td>
                </tr>

                {/* Commissionable Value */}
                <tr className="hover:bg-paper/30 font-bold bg-blue-500/5 text-blue-300">
                  <td className="p-3 sticky left-0 bg-paper-dark border-r border-line">Commissionable Value</td>
                  {allMonths.map((m, i) => (
                    <td key={i} className="p-3 text-center font-mono border-r border-line/40">
                      ₹{m.commissionableValue.toLocaleString("en-IN")}
                    </td>
                  ))}
                  <td className="p-3 text-ink/40 font-mono text-[10px]">(Subtotal + Pkg) - Discount Burn</td>
                </tr>

                {/* Advertisement */}
                <tr className="hover:bg-paper/30">
                  <td className="p-3 font-medium text-ink/70 sticky left-0 bg-paper-dark border-r border-line">Advertisement Spend</td>
                  {allMonths.map((m, i) => (
                    <td key={i} className="p-3 text-center font-mono border-r border-line/40">
                      ₹{m.advertisement.toLocaleString("en-IN")}
                    </td>
                  ))}
                  <td className="p-3 text-ink/40 font-mono text-[10px]">Commissionable Value * Ads %</td>
                </tr>

                {/* Advertisement % */}
                <tr className="hover:bg-paper/30">
                  <td className="p-3 font-medium text-ink/70 sticky left-0 bg-paper-dark border-r border-line">Advertisement %</td>
                  {historicalMonths.map((m, i) => (
                    <td key={`h-${i}`} className="p-3 text-center font-mono font-bold text-purple-400 border-r border-line/40">
                      {Number((m.advertisementPct * 100).toFixed(1))}%
                    </td>
                  ))}
                  {projectedMonths.map((m, i) => (
                    <td key={`p-${i}`} className="p-2 text-center font-mono border-r border-line/40">
                      <div className="flex items-center justify-center gap-0.5">
                        <input
                          type="number"
                          step="0.1"
                          value={Number((m.advertisementPct * 100).toFixed(1))}
                          onChange={(e) => handleUpdateProjectedMonth(i, { advertisementPct: Number(e.target.value) / 100 })}
                          className="w-14 text-center bg-transparent border-b border-purple-500/40 focus:border-purple-400 outline-none font-bold text-purple-400"
                        />
                        <span className="text-purple-400">%</span>
                      </div>
                    </td>
                  ))}
                  <td className="p-3 text-ink/40 font-mono text-[10px]">Ads budget allocation %</td>
                </tr>

                {/* Comm.+PG + GST */}
                <tr className="hover:bg-paper/30">
                  <td className="p-3 font-medium text-ink/70 sticky left-0 bg-paper-dark border-r border-line">Comm.+PG + GST</td>
                  {allMonths.map((m, i) => (
                    <td key={i} className="p-3 text-center font-mono border-r border-line/40">
                      ₹{m.commissionPgGst.toLocaleString("en-IN")}
                    </td>
                  ))}
                  <td className="p-3 text-ink/40 font-mono text-[10px]">Commissionable Value * Comm %</td>
                </tr>

                {/* Commission % */}
                <tr className="hover:bg-paper/30 font-semibold text-rose-400">
                  <td className="p-3 sticky left-0 bg-paper-dark border-r border-line">Commission %</td>
                  {allMonths.map((m, i) => {
                    const commPctVal = m.commissionableValue > 0 ? (m.commissionPgGst / m.commissionableValue) * 100 : 0;
                    return (
                      <td key={i} className="p-3 text-center font-mono border-r border-line/40">
                        {commPctVal.toFixed(1)}%
                      </td>
                    );
                  })}
                  <td className="p-3 text-ink/40 font-mono text-[10px]">(Comm.+PG+GST / Commissionable Value) * 100</td>
                </tr>

                {/* Net Payout */}
                <tr className="bg-emerald-500/10 hover:bg-emerald-500/20 font-black text-sm text-emerald-400 border-y border-emerald-500/30">
                  <td className="p-3.5 sticky left-0 bg-paper-dark border-r border-line text-emerald-400">NET PAYOUT (₹)</td>
                  {allMonths.map((m, i) => (
                    <td key={i} className="p-3.5 text-center font-mono border-r border-line/40">
                      ₹{m.netPayout.toLocaleString("en-IN")}
                    </td>
                  ))}
                  <td className="p-3.5 text-emerald-400/60 font-mono text-[10px]">Commissionable - Ads - Comm</td>
                </tr>

                {/* Payout % */}
                <tr className="hover:bg-paper/30 font-bold text-emerald-400/90">
                  <td className="p-3 sticky left-0 bg-paper-dark border-r border-line">Payout %</td>
                  {allMonths.map((m, i) => (
                    <td key={i} className="p-3 text-center font-mono border-r border-line/40">
                      {m.payoutPct}%
                    </td>
                  ))}
                  <td className="p-3 text-ink/40 font-mono text-[10px]">Net Payout / Sub Total * 100</td>
                </tr>

                {/* M2O */}
                <tr className="hover:bg-paper/30 text-blue-400">
                  <td className="p-3 font-semibold sticky left-0 bg-paper-dark border-r border-line">M2O (Menu to Order %)</td>
                  {historicalMonths.map((m, i) => (
                    <td key={`h-${i}`} className="p-3 text-center font-mono font-bold text-blue-400 border-r border-line/40">
                      {Number((m.m2o * 100).toFixed(1))}%
                    </td>
                  ))}
                  {projectedMonths.map((m, i) => (
                    <td key={`p-${i}`} className="p-2 text-center font-mono border-r border-line/40">
                      <div className="flex items-center justify-center gap-0.5">
                        <input
                          type="number"
                          step="0.1"
                          value={Number((m.m2o * 100).toFixed(1))}
                          onChange={(e) => handleUpdateProjectedMonth(i, { m2o: Number(e.target.value) / 100 })}
                          className="w-16 text-center bg-transparent border-b border-emerald-500/40 focus:border-emerald-400 outline-none font-extrabold text-emerald-400"
                        />
                        <span className="text-emerald-400 font-bold">%</span>
                      </div>
                    </td>
                  ))}
                  <td className="p-3 text-ink/40 font-mono text-[10px]">Order conversion efficiency</td>
                </tr>

                {/* Menu Opens */}
                <tr className="hover:bg-paper/30">
                  <td className="p-3 font-medium text-ink/70 sticky left-0 bg-paper-dark border-r border-line">Menu Opens</td>
                  {historicalMonths.map((m, i) => (
                    <td key={`h-${i}`} className="p-3 text-center font-mono font-bold text-ink border-r border-line/40">
                      {m.menuOpens.toLocaleString("en-IN")}
                    </td>
                  ))}
                  {projectedMonths.map((m, i) => (
                    <td key={`p-${i}`} className="p-2 text-center font-mono border-r border-line/40">
                      <input
                        type="number"
                        value={m.menuOpens}
                        onChange={(e) => handleUpdateProjectedMonth(i, { menuOpens: Number(e.target.value) })}
                        className="w-20 text-center bg-transparent border-b border-emerald-500/40 focus:border-emerald-400 outline-none font-extrabold text-emerald-400"
                      />
                    </td>
                  ))}
                  <td className="p-3 text-ink/40 font-mono text-[10px]">Total impression menu visits</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Target Assumptions Modeler */}
      {activeTab === "assumptions" && (
        <div className="space-y-6">
          <div className="card bg-paper-dark border-line p-5">
            <h3 className="text-base font-bold text-ink mb-1">Interactive Target Assumptions Modeler</h3>
            <p className="text-xs text-ink/50 mb-6">
              Adjust baseline assumptions for Past 3 Months and Target assumptions for Forward 3 Months. Net Payout and ratios calculate dynamically.
            </p>

            {/* Historical Past 3 Months Modeler */}
            <div className="mb-6">
              <span className="text-xs font-bold uppercase tracking-widest text-ink/50 block mb-3">
                📜 Past 3 Months Historical Baseline
              </span>
              <div className="grid md:grid-cols-3 gap-6">
                {historicalMonths.map((month, idx) => (
                  <div key={month.name} className="card bg-paper border-line p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <input
                        type="text"
                        value={month.name}
                        onChange={(e) => handleUpdateHistoricalMonth(idx, { name: e.target.value })}
                        className="font-bold text-ink text-sm bg-transparent border-b border-dashed border-ink/30 focus:border-ink outline-none"
                      />
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">
                        Past Baseline
                      </span>
                    </div>

                    {/* M2O */}
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-ink/70">
                        <span>Menu-to-Order (M2O %):</span>
                        <span className="font-mono font-bold text-blue-400">{(month.m2o * 100).toFixed(1)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.03"
                        max="0.20"
                        step="0.005"
                        value={month.m2o}
                        disabled
                        className="w-full accent-blue-400 opacity-50 cursor-not-allowed"
                      />
                    </div>

                    {/* Menu Opens */}
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-ink/70">
                        <span>Menu Opens:</span>
                        <span className="font-mono font-bold text-ink">{month.menuOpens.toLocaleString("en-IN")}</span>
                      </div>
                      <input
                        type="number"
                        value={month.menuOpens}
                        readOnly
                        disabled
                        className="input text-xs font-mono w-full opacity-60 cursor-not-allowed bg-paper-dark/50"
                      />
                    </div>

                    {/* AOV */}
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-ink/70">
                        <span>AOV (₹):</span>
                        <span className="font-mono font-bold text-ink">₹{month.aov}</span>
                      </div>
                      <input
                        type="number"
                        value={month.aov}
                        readOnly
                        disabled
                        className="input text-xs font-mono w-full opacity-60 cursor-not-allowed bg-paper-dark/50"
                      />
                    </div>

                    {/* Discount Burn % */}
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-ink/70">
                        <span>Discount Burn %:</span>
                        <span className="font-mono font-bold text-amber-400">{(month.effectiveDiscountPct * 100).toFixed(1)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.00"
                        max="0.25"
                        step="0.005"
                        value={month.effectiveDiscountPct}
                        disabled
                        className="w-full accent-amber-400 opacity-50 cursor-not-allowed"
                      />
                    </div>

                    {/* Output Summary Box */}
                    <div className="p-3 rounded-lg bg-paper-dark border border-line space-y-1 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-ink/40">Orders:</span>
                        <span className="font-bold text-ink">{month.orders}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink/40">Subtotal Sales:</span>
                        <span className="font-bold text-ink">₹{month.subTotal.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-line/50">
                        <span className="text-emerald-400 font-bold">Net Payout:</span>
                        <span className="font-bold text-emerald-400">₹{month.netPayout.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Forward 3 Months Modeler */}
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 block mb-3">
                🎯 Forward 3 Months Target Forecast
              </span>
              <div className="grid md:grid-cols-3 gap-6">
                {projectedMonths.map((month, idx) => (
                  <div key={month.name} className="card bg-paper border-line p-4 space-y-4 border-emerald-500/20">
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <input
                        type="text"
                        value={month.name}
                        onChange={(e) => handleUpdateProjectedMonth(idx, { name: e.target.value })}
                        className="font-bold text-emerald-400 text-sm bg-transparent border-b border-dashed border-emerald-500/30 focus:border-emerald-400 outline-none"
                      />
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        Forward Target
                      </span>
                    </div>

                    {/* Target M2O */}
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-ink/70">
                        <span>Menu-to-Order (M2O %):</span>
                        <span className="font-mono font-bold text-blue-400">{(month.m2o * 100).toFixed(1)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.03"
                        max="0.20"
                        step="0.005"
                        value={month.m2o}
                        onChange={(e) => handleUpdateProjectedMonth(idx, { m2o: Number(e.target.value) })}
                        className="w-full accent-blue-400 cursor-pointer"
                      />
                    </div>

                    {/* Menu Opens */}
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-ink/70">
                        <span>Target Menu Opens:</span>
                        <span className="font-mono font-bold text-ink">{month.menuOpens.toLocaleString("en-IN")}</span>
                      </div>
                      <input
                        type="number"
                        value={month.menuOpens}
                        onChange={(e) => handleUpdateProjectedMonth(idx, { menuOpens: Number(e.target.value) })}
                        className="input text-xs font-mono w-full"
                      />
                    </div>

                    {/* AOV */}
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-ink/70">
                        <span>Target AOV (₹):</span>
                        <span className="font-mono font-bold text-ink">₹{month.aov}</span>
                      </div>
                      <input
                        type="number"
                        value={month.aov}
                        onChange={(e) => handleUpdateProjectedMonth(idx, { aov: Number(e.target.value) })}
                        className="input text-xs font-mono w-full"
                      />
                    </div>

                    {/* Effective Discount % */}
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-ink/70">
                        <span>Discount Burn %:</span>
                        <span className="font-mono font-bold text-amber-400">{(month.effectiveDiscountPct * 100).toFixed(1)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.00"
                        max="0.25"
                        step="0.005"
                        value={month.effectiveDiscountPct}
                        onChange={(e) => handleUpdateProjectedMonth(idx, { effectiveDiscountPct: Number(e.target.value) })}
                        className="w-full accent-amber-400 cursor-pointer"
                      />
                    </div>

                    {/* Ads Spend % */}
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-ink/70">
                        <span>Ads Spend %:</span>
                        <span className="font-mono font-bold text-purple-400">{(month.advertisementPct * 100).toFixed(1)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="0.35"
                        step="0.005"
                        value={month.advertisementPct}
                        onChange={(e) => handleUpdateProjectedMonth(idx, { advertisementPct: Number(e.target.value) })}
                        className="w-full accent-purple-400 cursor-pointer"
                      />
                    </div>

                    {/* Calculated Output Summary Box */}
                    <div className="p-3 rounded-lg bg-paper-dark border border-line space-y-1 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-ink/40">Calculated Orders:</span>
                        <span className="font-bold text-ink">{month.orders}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink/40">Calculated Sales:</span>
                        <span className="font-bold text-ink">₹{month.subTotal.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-line/50">
                        <span className="text-emerald-400 font-bold">Net Payout:</span>
                        <span className="font-bold text-emerald-400">₹{month.netPayout.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AI Growth Strategy */}
      {activeTab === "ai" && (
        <div className="card bg-paper-dark border-line p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="text-base font-bold text-ink">AI Growth Observations & Strategy</h3>
                <p className="text-xs text-ink/50">Executive commentary based on M2O ratio, discount burn, and ad spend efficiency.</p>
              </div>
            </div>

            <button
              onClick={generateAiInsights}
              disabled={aiGenerating}
              className="btn btn-secondary text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${aiGenerating ? "animate-spin" : ""}`} />
              {aiGenerating ? "Generating..." : "Re-Generate Strategy"}
            </button>
          </div>

          <div className="p-4 rounded-xl bg-paper border border-line text-xs leading-relaxed font-mono whitespace-pre-wrap text-ink/80">
            {notes || "Click Re-Generate Strategy to curate executive recommendations for this brand."}
          </div>
        </div>
      )}

      {/* ── PREMIUM SAAS-LEVEL UPLOAD DATA & REPORTS WIZARD MODAL ───────────── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0b0c10] border border-zinc-800 w-full max-w-5xl max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl rounded-2xl text-ink flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 bg-zinc-950/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 shadow-inner">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    Data Configuration & Sync
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Establish your 3-month historical baseline ({historical.map(h => h.name).join(", ")}) to project {projected.map(p => p.name).join(", ")}.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Target Month & Year Selector */}
                <div className="bg-zinc-900/90 border border-zinc-800 px-3.5 py-2 rounded-xl text-xs shadow-inner flex flex-col sm:flex-row items-start sm:items-center gap-2.5 shrink-0">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-zinc-400 font-bold whitespace-nowrap">Target 3-Month Start:</span>
                    
                    <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1">
                      <select
                        value={targetMonthIdx}
                        onChange={(e) => setTargetMonthIdx(Number(e.target.value))}
                        className="bg-transparent font-extrabold text-white outline-none cursor-pointer text-xs"
                      >
                        {[
                          "January", "February", "March", "April", "May", "June",
                          "July", "August", "September", "October", "November", "December"
                        ].map((m, idx) => (
                          <option key={idx} value={idx} className="bg-zinc-900 text-white">
                            {m}
                          </option>
                        ))}
                      </select>

                      <select
                        value={targetYear}
                        onChange={(e) => setTargetYear(Number(e.target.value))}
                        className="bg-transparent font-extrabold text-white outline-none cursor-pointer border-l border-zinc-800 ml-2 pl-2 text-xs"
                      >
                        {[2024, 2025, 2026, 2027].map((y) => (
                          <option key={y} value={y} className="bg-zinc-900 text-white">
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="text-[11px] text-zinc-400 font-mono sm:pl-3 sm:border-l sm:border-zinc-800/80 whitespace-nowrap">
                    Target Forecast: <span className="text-emerald-400 font-extrabold">{projected.map(p => p.name).join(", ")}</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowUploadModal(false)}
                  className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all border border-zinc-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {/* Option 1: Quick 1-Click Auto Sync Banner */}
              <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Option 1: Auto-Sync from Reporting Engine</span>
                  </div>
                  <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
                    Instantly pull your verified payout numbers for {historical.map(h => h.name).join(", ")} directly from your saved reporting periods.
                  </p>
                </div>

                <button
                  onClick={handleAutoSyncFromReporting}
                  disabled={autoSyncLoading}
                  className="text-xs font-bold px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black transition-all flex items-center justify-center gap-2 shrink-0 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${autoSyncLoading ? "animate-spin" : ""}`} />
                  <span>{autoSyncLoading ? "Syncing Data..." : "Run Auto-Sync"}</span>
                </button>
              </div>

              {/* Option 2: Upload Combined 3-Month Report Dropzone */}
              <div className="p-5 rounded-2xl bg-zinc-950/80 border border-dashed border-zinc-700/80 hover:border-zinc-500 transition-all space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-white font-bold text-sm">
                      <FileSpreadsheet className="w-4 h-4 text-purple-400" />
                      <span>Option 2: Upload Combined 3-Month Report (1 Photo / Excel File)</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Upload a single photo of your 3-month summary report (or an Excel sheet) to extract all 3 months ({historical.map(h => h.name).join(", ")}) at once!
                    </p>
                  </div>

                  <input
                    ref={bulkFileInputRef}
                    type="file"
                    accept="image/*,.xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const files = Array.from(e.target.files);
                        setBulkFiles(files);
                        handleRunBulkOcrScan(files);
                      }
                    }}
                  />

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => bulkFileInputRef.current?.click()}
                      className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-white flex items-center gap-2 transition-all"
                    >
                      <Upload className="w-4 h-4 text-purple-400" />
                      <span>{bulkFiles.length > 0 ? bulkFiles[0].name : "Browse 3-Month File"}</span>
                    </button>

                    {bulkFiles.length > 0 && (
                      <button
                        onClick={() => handleRunBulkOcrScan()}
                        disabled={bulkOcrLoading}
                        className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${bulkOcrLoading ? "animate-spin" : ""}`} />
                        <span>{bulkOcrLoading ? "Scanning Report..." : "Scan & Extract"}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Consolidated 3-Month Data Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-1">
                  Historical Baseline Input
                </h4>
                
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-900/50 border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                        <th className="p-4 w-40">Month</th>
                        <th className="p-4">Data Source & Upload</th>
                        <th className="p-4 w-28">M2O (%)</th>
                        <th className="p-4 w-32">Menu Opens</th>
                        <th className="p-4 w-32">AOV (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {historical.map((hist, idx) => {
                        const card = monthCardStatus[idx];
                        const ref = fileInputRefs[idx];

                        return (
                          <tr key={idx} className="hover:bg-zinc-900/20 transition-colors">
                            <td className="p-4">
                              <span className="font-bold text-sm text-white block">{hist.name}</span>
                              <span className="text-[10px] text-zinc-500 mt-0.5 block">
                                {card.isLoaded ? (
                                  <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Verified</span>
                                ) : (
                                  <span className="text-amber-500/70">Pending Data</span>
                                )}
                              </span>
                            </td>
                            
                            <td className="p-4">
                              <div className="flex flex-col gap-2.5">
                                <div className="flex items-center gap-2.5">
                                  {/* Platform Toggle */}
                                  <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 shrink-0">
                                    <button
                                      onClick={() => {
                                        setMonthCardStatus((prev) => {
                                          const next = [...prev];
                                          next[idx].platform = "zomato";
                                          return next;
                                        });
                                      }}
                                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                                        card.platform === "zomato"
                                          ? "bg-zinc-700 text-white shadow-sm"
                                          : "text-zinc-500 hover:text-zinc-300"
                                      }`}
                                    >
                                      Zomato
                                    </button>
                                    <button
                                      onClick={() => {
                                        setMonthCardStatus((prev) => {
                                          const next = [...prev];
                                          next[idx].platform = "swiggy";
                                          return next;
                                        });
                                      }}
                                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                                        card.platform === "swiggy"
                                          ? "bg-zinc-700 text-white shadow-sm"
                                          : "text-zinc-500 hover:text-zinc-300"
                                      }`}
                                    >
                                      Swiggy
                                    </button>
                                  </div>
                                  
                                  <input
                                    ref={ref}
                                    type="file"
                                    accept="image/*,.xlsx,.xls,.csv"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                      if (e.target.files) {
                                        const files = Array.from(e.target.files);
                                        setMonthCardStatus((prev) => {
                                          const next = [...prev];
                                          next[idx].files = files;
                                          return next;
                                        });
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => ref.current?.click()}
                                    className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-[10px] font-medium text-zinc-300 flex items-center gap-1.5 transition-all"
                                  >
                                    <Upload className="w-3 h-3 text-zinc-400" /> 
                                    {card.files.length > 0 ? `${card.files.length} Selected` : 'Upload File'}
                                  </button>
                                  
                                  {card.files.length > 0 && !card.isLoaded && (
                                    <button
                                      onClick={() => handleRunCardOcrScan(idx)}
                                      disabled={ocrLoadingIdx === idx}
                                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all"
                                    >
                                      {ocrLoadingIdx === idx ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                      {ocrLoadingIdx === idx ? "Scanning..." : "Run OCR"}
                                    </button>
                                  )}
                                </div>

                                {card.data && (
                                  <div className="flex gap-4 text-[10px] font-mono text-zinc-400 bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-zinc-800/50 w-max">
                                    <span>Orders: <strong className="text-zinc-200">{card.data.orders || 0}</strong></span>
                                    <span>Sales: <strong className="text-zinc-200">₹{(card.data.subTotal || 0).toLocaleString()}</strong></span>
                                    <span>Net: <strong className="text-emerald-400">₹{(card.data.netPayout || 0).toLocaleString()}</strong></span>
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="p-4 align-top pt-5">
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={card.m2oPct}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setMonthCardStatus((prev) => {
                                      const next = [...prev];
                                      next[idx].m2oPct = val;
                                      const orders = next[idx].data?.orders || 0;
                                      if (orders > 0 && val > 0) {
                                        next[idx].menuOpens = Math.round(orders / (val / 100));
                                      }
                                      return next;
                                    });
                                  }}
                                  className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-zinc-500 transition-colors"
                                />
                                <span className="absolute right-2.5 top-2 text-[10px] text-zinc-500">%</span>
                              </div>
                            </td>

                            <td className="p-4 align-top pt-5">
                              {(() => {
                                const liveCardOrders = card.data?.orders || 0;
                                const liveCardM2o = card.m2oPct > 0 ? card.m2oPct / 100 : 0.07;
                                const liveComputedMenuOpens = liveCardOrders > 0
                                  ? Math.round(liveCardOrders / liveCardM2o)
                                  : card.menuOpens;
                                return (
                                  <input
                                    type="number"
                                    value={liveComputedMenuOpens}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setMonthCardStatus((prev) => {
                                        const next = [...prev];
                                        next[idx].menuOpens = val;
                                        const orders = next[idx].data?.orders || 0;
                                        if (orders > 0 && val > 0) {
                                          next[idx].m2oPct = Number(((orders / val) * 100).toFixed(1));
                                        }
                                        return next;
                                      });
                                    }}
                                    className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-zinc-500 transition-colors"
                                  />
                                );
                              })()}
                            </td>

                            <td className="p-4 align-top pt-5">
                              <div className="relative">
                                <span className="absolute left-2.5 top-2 text-[10px] text-zinc-500">₹</span>
                                <input
                                  type="number"
                                  value={card.aov}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setMonthCardStatus((prev) => {
                                      const next = [...prev];
                                      next[idx].aov = val;
                                      return next;
                                    });
                                  }}
                                  className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg pl-6 pr-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-zinc-500 transition-colors"
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Bottom Final Action Button */}
            <div className="p-6 md:p-8 pt-6 border-t border-zinc-800/80 bg-zinc-950/30 mt-auto flex justify-end">
              <button
                onClick={handleApplyAllCardsToModel}
                className="text-sm font-bold px-8 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black shadow-xl flex items-center gap-2 transition-all"
              >
                <span>Save & Generate Projections</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Custom System Notification Modal (Replacing native alert) */}
      {projNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card bg-paper-dark border-line w-full max-w-sm p-6 space-y-4 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className={`text-base font-bold ${
                  projNotification.type === "success" ? "text-emerald-400" : projNotification.type === "error" ? "text-rose-400" : "text-amber-400"
                }`}>
                  {projNotification.type === "success" ? "✓" : projNotification.type === "error" ? "⚠️" : "ℹ️"}
                </span>
                <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                  {projNotification.type === "success" ? "Success" : projNotification.type === "error" ? "Projections Error" : "Notice"}
                </h3>
              </div>
              <button onClick={() => setProjNotification(null)} className="text-ink/40 hover:text-ink">
                ✕
              </button>
            </div>
            <p className="text-xs text-ink/80 leading-relaxed font-sans">{projNotification.message}</p>
            <div className="flex justify-end pt-2 border-t border-line">
              <button onClick={() => setProjNotification(null)} className="btn btn-primary text-xs">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
