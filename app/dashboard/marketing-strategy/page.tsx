"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Zap,
  Tag,
  Percent,
  Layers,
  Store,
  Utensils,
  DollarSign,
  TrendingUp,
  Award,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sliders,
  Download,
  FileSpreadsheet,
  Users,
  MapPin,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  CheckSquare,
  Save,
  RefreshCw,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useBrand } from "@/components/BrandContext";
import {
  getPrimaryDiscountCodes,
  getStepperDiscountCodes,
  getPartyDiscountCodes,
  computeEmployeeDiscountAutomation,
  calculateAdsModelM1,
  calculateAdsModelM2,
  calculateAdsModelM3,
  calculateAdsModelSGM,
  getDefaultDineoutConfig,
  computeDineoutStrategy,
  getDefaultSwiggyAdsConfig,
  computeSwiggyAdsStrategy,
  SWIGGY_AD_PRODUCTS,
  SwiggyAdsConfig,
  DineoutStrategyConfig,
  DineoutRowInput,
  EmployeeDiscountInputs,
  AdsModelInputs,
  AdsModelResult,
} from "@/lib/marketingStrategy";

export default function MarketingStrategyPage() {
  const { activeBrand } = useBrand();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Platform, Channel & Location State
  const [channel, setChannel] = useState<"delivery" | "dineout">("delivery");
  const [platform, setPlatform] = useState<"zomato" | "swiggy">("zomato");
  const [location, setLocation] = useState("Bistupur, Jamshedpur");

  // Strategy & Calculation Inputs
  const [targetDiscountBurnPct, setTargetDiscountBurnPct] = useState<number>(20); // 20%
  const [aov, setAov] = useState<number>(699); // ₹699
  const [totalOrders, setTotalOrders] = useState<number>(100); // 100 orders
  const [laPct, setLaPct] = useState<number>(60);
  const [mmPct, setMmPct] = useState<number>(10);
  const [umPct, setUmPct] = useState<number>(30);

  // Strategy Option Selectors
  const [primaryOption, setPrimaryOption] = useState<
    "single_new" | "single_repeat" | "single_all" | "single_radius" | "option1" | "option2"
  >("option1");
  const [stepperSegregation, setStepperSegregation] = useState<"la_mm_um" | "au">("la_mm_um");
  const [flatOffChoices, setFlatOffChoices] = useState<number[]>([125]);
  const [partyCodesEnabled, setPartyCodesEnabled] = useState<boolean>(true);

  // Dineout Discounts State & Handlers
  const [dineoutConfig, setDineoutConfig] = useState<DineoutStrategyConfig>(getDefaultDineoutConfig());

  const dineoutStrategyResult = useMemo(
    () => computeDineoutStrategy(dineoutConfig),
    [dineoutConfig]
  );

  function updateDineoutRowField(rowId: string, field: "totalDiscount" | "mxBurn" | "cofunding" | "covers", val: number) {
    setDineoutConfig((prev) => {
      if (rowId === "w1") {
        const currentWalkIn = prev.walkInRow || {
          id: "w1",
          day: "Mon To Sun",
          mealTime: "All day",
          totalDiscount: 10,
          cofunding: 5,
          mxBurn: 5,
          covers: 20,
        };
        const finalVal = Math.max(0, val || 0);
        const updatedWalkIn = { ...currentWalkIn, [field]: finalVal };

        if (field === "totalDiscount" || field === "cofunding") {
          const tot = updatedWalkIn.totalDiscount || 0;
          const cof = updatedWalkIn.cofunding || 0;
          updatedWalkIn.mxBurn = Math.max(0, tot - cof);
        } else if (field === "mxBurn") {
          const tot = updatedWalkIn.totalDiscount || 0;
          updatedWalkIn.cofunding = Math.max(0, tot - finalVal);
        }

        return { ...prev, walkInRow: updatedWalkIn };
      }

      const isDetailed = prev.mode === "detailed";
      const targetKey = isDetailed ? "detailedRows" : "simplifiedRows";
      const updatedRows = prev[targetKey].map((row) => {
        if (row.id !== rowId) return row;
        const finalVal = Math.max(0, val || 0);
        const updatedRow = { ...row, [field]: finalVal };

        if (field === "totalDiscount" || field === "cofunding") {
          const tot = updatedRow.totalDiscount || 0;
          const cof = updatedRow.cofunding || 0;
          updatedRow.mxBurn = Math.max(0, tot - cof);
        } else if (field === "mxBurn") {
          const tot = updatedRow.totalDiscount || 0;
          updatedRow.cofunding = Math.max(0, tot - finalVal);
        }

        return updatedRow;
      });
      return { ...prev, [targetKey]: updatedRows };
    });
  }

  function setDineoutMode(mode: "detailed" | "simplified") {
    setDineoutConfig((prev) => ({ ...prev, mode }));
  }

  // Swiggy Ads State & Handlers
  const [swiggyAdsConfig, setSwiggyAdsConfig] = useState<SwiggyAdsConfig>(getDefaultSwiggyAdsConfig());

  const swiggyAdsResult = useMemo(
    () => computeSwiggyAdsStrategy(swiggyAdsConfig),
    [swiggyAdsConfig]
  );

  function setSwiggyAdsMode(mode: "tryout" | "no_tryout") {
    setSwiggyAdsConfig((prev) => ({ ...prev, mode }));
  }

  function toggleSwiggyAdProduct(productId: string) {
    setSwiggyAdsConfig((prev) => {
      const selected = prev.selectedProductIds || [];
      if (selected.includes(productId)) {
        if (selected.length <= 1) return prev; // keep at least 1 product selected
        return { ...prev, selectedProductIds: selected.filter((id) => id !== productId) };
      } else {
        return { ...prev, selectedProductIds: [...selected, productId] };
      }
    });
  }

  // Zomato Base Ads Placements Multi-Select State & Handler
  const [selectedZomatoPlacements, setSelectedZomatoPlacements] = useState<string[]>([
    "gvp",
    "psp",
    "spendingPotential",
    "boss",
    "bigBoss",
  ]);

  function toggleZomatoPlacement(id: string) {
    setSelectedZomatoPlacements((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // keep at least 1 placement selected
        return prev.filter((p) => p !== id);
      } else {
        return [...prev, id];
      }
    });
  }

  // Helper function for Flat Off Multi-Select Toggle
  function toggleFlatOffChoice(amt: number) {
    setFlatOffChoices((prev) => {
      if (prev.includes(amt)) {
        if (prev.length <= 1) return prev; // keep at least 1 tier selected
        return prev.filter((a) => a !== amt);
      } else {
        return [...prev, amt].sort((a, b) => a - b);
      }
    });
  }

  // Ads Financial Inputs
  const [selectedAdsModel, setSelectedAdsModel] = useState<"M1" | "M2" | "M3" | "SGM">("M1");
  const [baselineCV, setBaselineCV] = useState<number>(100000);
  const [totalSales, setTotalSales] = useState<number>(200000);
  const [subtotalSales, setSubtotalSales] = useState<number>(200000);
  const [rateX, setRateX] = useState<number>(10); // 10%
  const [rateY, setRateY] = useState<number>(20); // 20%
  const [baseAdsAmount, setBaseAdsAmount] = useState<number>(18000);

  // Persistence & UI State
  const [activeTab, setActiveTab] = useState<"discounting" | "ads" | "summary">("discounting");
  const [adsSubTab, setAdsSubTab] = useState<"delivery" | "dineout">("delivery");
  const [dineoutPlatformFilter, setDineoutPlatformFilter] = useState<"swiggy" | "zomato">("zomato");
  const [showAddDineoutModal, setShowAddDineoutModal] = useState(false);
  const [customDineoutAds, setCustomDineoutAds] = useState<any[]>([]);
  const [newDineoutAd, setNewDineoutAd] = useState({
    platform: "zomato",
    name: "",
    pricingModel: "Click Based",
    zoneScope: "8-10 KM Radius",
    organicRatio: "",
    description: "",
  });

  const [loadingBrandData, setLoadingBrandData] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    fetchCustomDineoutAds();
  }, []);

  const fetchCustomDineoutAds = async () => {
    try {
      const res = await fetch("/api/marketing/dineout-ads");
      if (res.ok) {
        const json = await res.json();
        if (json.customAds) setCustomDineoutAds(json.customAds);
      }
    } catch (e) {
      console.error("Failed to fetch custom Dineout ads:", e);
    }
  };

  // ── PER-BRAND DATA FETCHING & AUTOMATIC PERSISTENCE ────────────────────────

  useEffect(() => {
    if (!activeBrand?.id) return;
    fetchBrandStrategy(activeBrand.id);
  }, [activeBrand?.id]);

  async function fetchBrandStrategy(id: string) {
    setLoadingBrandData(true);
    try {
      const res = await fetch(`/api/marketing/strategy?brandId=${id}`);
      const data = await res.json();
      if (data.strategy) {
        const s = data.strategy;
        setChannel(s.channel || "delivery");
        setPlatform(s.platform || "zomato");
        setLocation(s.location || "Bistupur, Jamshedpur");
        setTargetDiscountBurnPct(s.targetDiscountBurnPct !== undefined ? s.targetDiscountBurnPct : 20);
        setAov(s.aov !== undefined ? s.aov : 699);
        setTotalOrders(s.totalOrders !== undefined ? s.totalOrders : 100);
        setLaPct(s.laPct !== undefined ? s.laPct : 60);
        setMmPct(s.mmPct !== undefined ? s.mmPct : 10);
        setUmPct(s.umPct !== undefined ? s.umPct : 30);
        setPrimaryOption(s.primaryOption || "option1");
        setStepperSegregation(s.stepperSegregation || "la_mm_um");
        if (s.flatOffChoices && Array.isArray(s.flatOffChoices) && s.flatOffChoices.length > 0) {
          setFlatOffChoices(s.flatOffChoices);
        } else if (s.flatOffChoice) {
          setFlatOffChoices([s.flatOffChoice]);
        } else {
          setFlatOffChoices([125]);
        }
        setPartyCodesEnabled(s.partyCodesEnabled !== undefined ? s.partyCodesEnabled : true);
        setDineoutConfig(s.dineoutConfig || getDefaultDineoutConfig());
        setSwiggyAdsConfig(s.swiggyAdsConfig || getDefaultSwiggyAdsConfig());
        setSelectedAdsModel(s.selectedAdsModel || "M1");
        setBaselineCV(s.baselineCV !== undefined ? s.baselineCV : 100000);
        setTotalSales(s.totalSales !== undefined ? s.totalSales : 200000);
        setSubtotalSales(s.subtotalSales !== undefined ? s.subtotalSales : 200000);
        setRateX(s.rateX !== undefined ? s.rateX : 10);
        setRateY(s.rateY !== undefined ? s.rateY : 20);
        setBaseAdsAmount(s.baseAdsAmount !== undefined ? s.baseAdsAmount : 18000);
      } else {
        // Reset to clean defaults when switching to a new brand with no saved strategy
        setChannel("delivery");
        setPlatform("zomato");
        setLocation("Bistupur, Jamshedpur");
        setTargetDiscountBurnPct(20);
        setAov(699);
        setTotalOrders(100);
        setLaPct(60);
        setMmPct(10);
        setUmPct(30);
        setPrimaryOption("option1");
        setStepperSegregation("la_mm_um");
        setFlatOffChoices([125]);
        setPartyCodesEnabled(true);
        setDineoutConfig(getDefaultDineoutConfig());
        setSwiggyAdsConfig(getDefaultSwiggyAdsConfig());
        setSelectedAdsModel("M1");
        setBaselineCV(100000);
        setTotalSales(200000);
        setSubtotalSales(200000);
        setRateX(10);
        setRateY(20);
        setBaseAdsAmount(18000);
      }
    } catch (err) {
      console.error("Failed to load brand strategy:", err);
    } finally {
      setLoadingBrandData(false);
    }
  }

  async function saveCurrentBrandStrategy() {
    if (!activeBrand?.id) return;
    setSaveStatus("Saving...");
    try {
      await fetch("/api/marketing/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: activeBrand.id,
          brandName: activeBrand.name,
          channel,
          platform,
          location,
          targetDiscountBurnPct,
          aov,
          totalOrders,
          laPct,
          mmPct,
          umPct,
          primaryOption,
          stepperSegregation,
          flatOffChoice: flatOffChoices[0] || 125,
          flatOffChoices,
          partyCodesEnabled,
          dineoutConfig,
          swiggyAdsConfig,
          selectedAdsModel,
          baselineCV,
          totalSales,
          subtotalSales,
          rateX,
          rateY,
          baseAdsAmount,
        }),
      });
      setSaveStatus(`Saved!`);
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (err) {
      console.error("Failed to save brand strategy:", err);
      setSaveStatus("Failed to save");
    }
  }

  // ── COMPUTATIONS ───────────────────────────────────────────────────────────

  const primaryCodes = useMemo(() => getPrimaryDiscountCodes(aov, targetDiscountBurnPct), [aov, targetDiscountBurnPct]);
  const stepperCodes = useMemo(() => getStepperDiscountCodes(aov, targetDiscountBurnPct), [aov, targetDiscountBurnPct]);
  const partyCodes = useMemo(() => getPartyDiscountCodes(), []);

  // Employee Automation Calculation
  const discountInputs: EmployeeDiscountInputs = useMemo(
    () => ({
      channel,
      targetDiscountBurnPct,
      aov,
      totalOrders,
      laPct,
      mmPct,
      umPct,
      primaryOption,
      stepperSegregation,
      flatOffChoices,
      partyCodesEnabled,
    }),
    [
      channel,
      targetDiscountBurnPct,
      aov,
      totalOrders,
      laPct,
      mmPct,
      umPct,
      primaryOption,
      stepperSegregation,
      flatOffChoices,
      partyCodesEnabled,
    ]
  );

  const discountAutomation = useMemo(
    () => computeEmployeeDiscountAutomation(discountInputs),
    [discountInputs]
  );

  const adsInputs: AdsModelInputs = useMemo(
    () => ({
      platform,
      baselineCV,
      totalSales,
      subtotal: subtotalSales,
      rateX: rateX / 100,
      rateY: rateY / 100,
      baseAdsAmount,
      selectedPlacements: selectedZomatoPlacements,
    }),
    [platform, baselineCV, totalSales, subtotalSales, rateX, rateY, baseAdsAmount, selectedZomatoPlacements]
  );

  const adsResult: AdsModelResult = useMemo(() => {
    if (selectedAdsModel === "M1") return calculateAdsModelM1(adsInputs);
    if (selectedAdsModel === "M2") return calculateAdsModelM2(adsInputs);
    if (selectedAdsModel === "M3") return calculateAdsModelM3(adsInputs);
    return calculateAdsModelSGM(adsInputs);
  }, [selectedAdsModel, adsInputs]);

  function formatCurrency(val: number) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  }

  function autoFitColumns(ws: XLSX.WorkSheet, data: any[]) {
    if (!data || data.length === 0) return;
    const keys = Object.keys(data[0]);
    const cols = keys.map((key) => {
      let maxLen = key.toString().length;
      data.forEach((row) => {
        const val = row[key] !== undefined && row[key] !== null ? row[key].toString() : "";
        if (val.length > maxLen) {
          maxLen = val.length;
        }
      });
      return { wch: Math.max(maxLen + 8, 38) };
    });
    ws["!cols"] = cols;
  }

  function handleExportExcel() {
    if (!activeBrand) return;
    const summaryData = [
      { "Executive Strategy Parameter": "Active Restaurant Brand", "Report Value / Status": activeBrand.name },
      { "Executive Strategy Parameter": "Cuisine / Restaurant Type", "Report Value / Status": activeBrand.type },
      { "Executive Strategy Parameter": "Operating Channel Mode", "Report Value / Status": channel.toUpperCase() },
      { "Executive Strategy Parameter": "Selected Platform", "Report Value / Status": platform.toUpperCase() },
      { "Executive Strategy Parameter": "City / Operating Location", "Report Value / Status": location },
      { "Executive Strategy Parameter": "Target AOV (₹)", "Report Value / Status": `₹${aov}` },
      { "Executive Strategy Parameter": "Monthly Target Orders", "Report Value / Status": totalOrders },
      { "Executive Strategy Parameter": "Customer Segments Breakdown (Orders)", "Report Value / Status": `LA: ${laPct}, MM: ${mmPct}, UM: ${umPct}` },
      { "Executive Strategy Parameter": "Discount Burn Target %", "Report Value / Status": `${targetDiscountBurnPct}%` },
      { "Executive Strategy Parameter": "Calculated Effective Burn %", "Report Value / Status": `${discountAutomation.overallEffectiveBurnPct}%` },
      { "Executive Strategy Parameter": "Target Burn Compliance", "Report Value / Status": discountAutomation.targetCompliance ? "PASSED (WITHIN LIMIT)" : "EXCEEDED TARGET" },
      { "Executive Strategy Parameter": "Primary Codes Strategy", "Report Value / Status": primaryOption.startsWith("single") ? "Single Primary Code Strategy" : "Dual Primary Codes Combination Set" },
      { "Executive Strategy Parameter": "Selected Stepper Flat Off Tiers", "Report Value / Status": flatOffChoices.map((amt) => `Flat ₹${amt}`).join(", ") },
      { "Executive Strategy Parameter": "Selected Grow Maxx Ad Model", "Report Value / Status": adsResult.modelName },
      { "Executive Strategy Parameter": "Total Calculated Ads Budget (₹)", "Report Value / Status": `₹${adsResult.totalAdsAmount.toLocaleString("en-IN")}` },
      { "Executive Strategy Parameter": "Base Ads Budget (₹)", "Report Value / Status": `₹${adsResult.baseAdsAmount.toLocaleString("en-IN")}` },
      { "Executive Strategy Parameter": "Base Ads Validation Status", "Report Value / Status": adsResult.baseAdsValid ? "VALID (Base Ads <= Grow Maxx)" : "INVALID (Base Ads Exceeds Grow Maxx)" },
    ];

    const primaryData = primaryCodes.map((c) => ({
      "User Segment Target": c.segmentTarget,
      "Discount Code Format": c.name,
      "Max Discount Cap (₹)": `₹${c.discountCap}`,
      "Minimum Order Value (₹)": `₹${c.mov}`,
      "Burn Percentage (%)": `${c.burnPct}%`,
      "Selected Status": discountAutomation.selectedPrimaryCodes.some((sp) => sp.id === c.id) ? "ACTIVE (SELECTED)" : "INACTIVE",
    }));

    const activeStepperList = discountAutomation.selectedStepperCodes || [discountAutomation.selectedStepperCode];

    const stepperData = stepperCodes.map((c) => ({
      "Target Customer Segment": c.segmentTarget,
      "Flat Off Code": c.name,
      "Flat Amount (₹)": `₹${c.discountCap}`,
      "Minimum Order Value (₹)": `₹${c.mov}`,
      "Burn Percentage (%)": `${c.burnPct}%`,
      "Selected Status": activeStepperList.some((sc) => sc.id === c.id) ? "ACTIVE (SELECTED)" : "INACTIVE",
    }));

    const adsBreakdownData = Object.entries(adsResult.baseAdsBreakdown).map(([_, item]) => ({
      "Ad Placement Type": item.name,
      "Target Audience Segment": item.target,
      "Allocation (%)": `${item.pct}%`,
      "Budget Amount (₹)": `₹${item.amount.toLocaleString("en-IN")}`,
    }));

    const dineoutExportData = [
      ...dineoutStrategyResult.rows.map((r) => ({
        "Category": "Pre Book / Reserve",
        "Day": r.day,
        "Meal Time": r.mealTime,
        "Total Discount (%)": `${r.totalDiscount}%`,
        "MX Burn (%)": `${r.mxBurn}%`,
        "Cofunding (%)": `${r.cofunding}%`,
        "Covers": r.covers,
      })),
      {
        "Category": "Walk In Offers",
        "Day": dineoutStrategyResult.walkIn.day,
        "Meal Time": dineoutStrategyResult.walkIn.mealTime,
        "Total Discount (%)": `${dineoutStrategyResult.walkIn.totalDiscount}%`,
        "MX Burn (%)": "N/A",
        "Cofunding (%)": "N/A",
        "Covers": "N/A",
      },
    ];

    const swiggyAdsExportData = swiggyAdsResult.split.map((s) => ({
      "Selected Product": s.name,
      "Target Audience": s.target,
      "Budget Share (%)": `${s.percentage}%`,
      "AI Suggested Allocation (₹)": `₹${s.allocatedBudget.toLocaleString("en-IN")}`,
      "Strategy Note": s.referenceNote,
    }));

    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    autoFitColumns(wsSummary, summaryData);

    const wsPrimary = XLSX.utils.json_to_sheet(primaryData);
    autoFitColumns(wsPrimary, primaryData);

    const wsStepper = XLSX.utils.json_to_sheet(stepperData);
    autoFitColumns(wsStepper, stepperData);

    const wsDineout = XLSX.utils.json_to_sheet(dineoutExportData);
    autoFitColumns(wsDineout, dineoutExportData);

    const wsSwiggyAds = XLSX.utils.json_to_sheet(swiggyAdsExportData);
    autoFitColumns(wsSwiggyAds, swiggyAdsExportData);

    const wsAds = XLSX.utils.json_to_sheet(adsBreakdownData);
    autoFitColumns(wsAds, adsBreakdownData);

    XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");
    XLSX.utils.book_append_sheet(wb, wsPrimary, "Primary Codes Matrix");
    XLSX.utils.book_append_sheet(wb, wsStepper, "Stepper Codes Matrix");
    XLSX.utils.book_append_sheet(wb, wsDineout, "Dineout Discounts");
    XLSX.utils.book_append_sheet(wb, wsSwiggyAds, "Swiggy Ads Split");
    XLSX.utils.book_append_sheet(wb, wsAds, "Ads Placements");

    const safeBrand = activeBrand.name.replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `${safeBrand}_Marketing_Plan_${platform.toUpperCase()}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  // ── DINEOUT AD PRODUCTS DIRECTORY CONSTANTS ─────────────────────────────────
  const DEFAULT_DINEOUT_ADS = [
    {
      id: "zomato_clicks",
      platform: "zomato",
      name: "Clicks",
      pricingModel: "Click Based Product",
      zoneScope: "AU (All Users)",
      description: "Performance ad placement charged per user click on restaurant dining listing.",
    },
    {
      id: "zomato_impressions",
      platform: "zomato",
      name: "Impressions",
      pricingModel: "Impression Based Product",
      zoneScope: "AU (All Users)",
      description: "High visibility banner & listing placement charged per impression (views).",
    },
    {
      id: "zomato_video_ads",
      platform: "zomato",
      name: "Video Ads",
      pricingModel: "High Engagement Video Unit",
      zoneScope: "In-Feed & Home Screen",
      description: "Immersive video ad units highlighting signature dishes and dining experience.",
    },
    {
      id: "zomato_billboard",
      platform: "zomato",
      name: "Billboard (Limelight)",
      pricingModel: "Top-of-Feed Premium Unit",
      zoneScope: "High Priority Top Banner",
      description: "Dominant full-width Limelight Billboard positioned right at the top of the Zomato app opening feed.",
    },
    {
      id: "zomato_qlmbb",
      platform: "zomato",
      name: "Quick Link Billboard (QLMBB)",
      pricingModel: "Direct Call-to-Action Link",
      zoneScope: "Interactive Link Placement",
      description: "Interactive billboard equipped with direct action quick links for instant menu or booking access.",
    },
    {
      id: "zomato_dsr",
      platform: "zomato",
      name: "DSR — Featured Around You",
      pricingModel: "General Location Boosting Pack",
      zoneScope: "Geo-Targeted Radius",
      description: "Local area general boosting pack elevating visibility under the 'Featured Around You' recommendations.",
    },
    {
      id: "zomato_push_notifications",
      platform: "zomato",
      name: "Push Notifications Broadcast",
      pricingModel: "Direct User Device Broadcast",
      zoneScope: "Targeted User List",
      description: "Direct push notification alerts delivered straight to active customer smartphones during peak meal hours.",
    },
    {
      id: "zomato_top_picks",
      platform: "zomato",
      name: "Top Picks (Right Shift Dishes & Combos)",
      pricingModel: "Item & Combo Level Highlight",
      zoneScope: "Menu & Search Page",
      description: "Right-shift dish highlight placement promoting high-margin hero dishes and combo packages.",
    },
    {
      id: "zomato_guarantee_roi",
      platform: "zomato",
      name: "Guarantee ROI (Pilot Testing)",
      pricingModel: "Pilot Testing New Product",
      zoneScope: "Selected Few Restaurants Only",
      description: "Experimental ROI-backed pilot ad product available strictly to select partner outlets undergoing trial testing.",
    },
    {
      id: "swiggy_clicks",
      platform: "swiggy",
      name: "Clicks",
      pricingModel: "Click Based Product",
      zoneScope: "AU (All Users)",
      description: "Cost per click dining ad product driving direct traffic to restaurant page.",
    },
    {
      id: "swiggy_cpc",
      platform: "swiggy",
      name: "CPC — Cost Per Click",
      pricingModel: "Click Based Product",
      zoneScope: "AU (All Users)",
      description: "Pay per user click on restaurant ad listing in search and discovery feed.",
    },
    {
      id: "swiggy_cpv_banner",
      platform: "swiggy",
      name: "CPV Banner — Cost Per View",
      pricingModel: "Impression Based Banner",
      zoneScope: "AU (All Users)",
      description: "High impact impression-based visual banner placement.",
    },
    {
      id: "swiggy_rdp_video",
      platform: "swiggy",
      name: "RDP Views / Video Ads",
      pricingModel: "3 Types (Bites, Landscape like Zomato, In-Brand Page Video)",
      zoneScope: "Rich Engagement Video Formats",
      description: "Dynamic video ad placements including short Bite-sized clips, Landscape feed videos, and dedicated In-Brand page video.",
    },
    {
      id: "swiggy_collection_banner",
      platform: "swiggy",
      name: "Collection Banner",
      pricingModel: "Zone-Wise Premium Placement",
      zoneScope: "Only 5 Brands on Top Zone-Wise",
      description: "Featured positioning for Cafe & Premium Dining collections, capped at top 5 brands per zone.",
    },
    {
      id: "swiggy_featured_banner",
      platform: "swiggy",
      name: "Featured This Week Banner",
      pricingModel: "Outlet Radius Placement",
      zoneScope: "Only 10 Outlets (8-10 KM Radius Zone-Wise)",
      description: "Hyper-local weekly featured banner targeting customers within an 8-10 KM radius of the outlet.",
    },
    {
      id: "swiggy_spotlight_banner",
      platform: "swiggy",
      name: "In The Spotlight / Topical Banner",
      pricingModel: "Divided into 6 Price-Sensitive Zones",
      zoneScope: "Zone-Wise Targeted Banner",
      description: "Segmented topical banners tailored for price-sensitive customer segments across 6 defined city zones.",
    },
    {
      id: "swiggy_half_card",
      platform: "swiggy",
      name: "Half Card",
      pricingModel: "Pan-City High Visibility",
      zoneScope: "Pan-City Reach",
      description: "Wide-format half card unit providing maximum pan-city brand visibility.",
    },
    {
      id: "swiggy_pre_cursor",
      platform: "swiggy",
      name: "Pre Cursor (Premium Product)",
      pricingModel: "Weekly Pan-City Premium",
      zoneScope: "Only 3 Brands Per Week Pan-City",
      description: "Ultra-exclusive premium weekly placement reserved for a maximum of 3 brands across the entire city.",
    },
    {
      id: "swiggy_thoughtfully_curated",
      platform: "swiggy",
      name: "Thoughtfully Curated / Off-App Editorial",
      pricingModel: "80% Organic Free / 20% Paid",
      zoneScope: "Story, Carousel & Dedicated Video Shoot",
      description: "High-end editorial content package blending 80% free organic storytelling with 20% sponsored media shoots and carousels.",
    },
  ];

  const allDineoutAds = useMemo(() => {
    return [...customDineoutAds, ...DEFAULT_DINEOUT_ADS];
  }, [customDineoutAds]);

  const filteredDineoutAds = useMemo(() => {
    return allDineoutAds.filter((a) => a.platform === dineoutPlatformFilter);
  }, [allDineoutAds, dineoutPlatformFilter]);

  const handleCreateCustomDineoutAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDineoutAd.name.trim()) return;

    try {
      const res = await fetch("/api/marketing/dineout-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDineoutAd),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.customAds) setCustomDineoutAds(json.customAds);
        setNewDineoutAd({
          platform: "swiggy",
          name: "",
          pricingModel: "Click Based",
          zoneScope: "8-10 KM Radius",
          organicRatio: "",
          description: "",
        });
        setShowAddDineoutModal(false);
      }
    } catch (err) {
      console.error("Error creating custom ad:", err);
    }
  };

  if (!mounted || !activeBrand) {
    return null;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-16">
      {/* ── PAGE HEADER BAR ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Zap className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-ink tracking-tight">
              F&B Marketing Strategy Engine
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-paper-dark border border-line text-purple-400 uppercase tracking-wider">
              Automated Strategy Engine
            </span>
          </div>
          <p className="mt-1 text-sm text-ink/50" suppressHydrationWarning>
            Isolated Marketing Plan for Active Restaurant:{" "}
            <strong suppressHydrationWarning className="text-emerald-400 font-bold">{activeBrand.name}</strong> ({activeBrand.type})
          </p>
        </div>

        {/* Platform Selector, Save Button & Export */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {/* Professional Dark-Theme Platform Selector */}
          <div className="flex items-center p-1 rounded-xl bg-paper-dark border border-line gap-1">
            <button
              onClick={() => setPlatform("zomato")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                platform === "zomato"
                  ? "bg-rose-500/15 text-rose-300 border border-rose-500/30 font-extrabold"
                  : "text-ink/60 hover:text-ink border border-transparent"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${platform === "zomato" ? "bg-rose-400" : "bg-ink/30"}`} />
              <span>Zomato</span>
            </button>

            <button
              onClick={() => setPlatform("swiggy")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                platform === "swiggy"
                  ? "bg-orange-500/15 text-orange-300 border border-orange-500/30 font-extrabold"
                  : "text-ink/60 hover:text-ink border border-transparent"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${platform === "swiggy" ? "bg-orange-400" : "bg-ink/30"}`} />
              <span>Swiggy</span>
            </button>
          </div>

          <button
            onClick={saveCurrentBrandStrategy}
            className="btn btn-primary text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saveStatus || "Save Strategy"}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Export (.xlsx)
          </button>
        </div>
      </div>

      {/* ── SECTION TABS ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-line">
        <button
          onClick={() => setActiveTab("discounting")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === "discounting"
              ? "border-purple-400 text-purple-400 bg-paper-dark rounded-t-lg"
              : "border-transparent text-ink/50 hover:text-ink"
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>1. Discounting Strategy & Inputs</span>
        </button>

        <button
          onClick={() => setActiveTab("ads")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === "ads"
              ? "border-purple-400 text-purple-400 bg-paper-dark rounded-t-lg"
              : "border-transparent text-ink/50 hover:text-ink"
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>2. Ads Spend Engine</span>
        </button>

        <button
          onClick={() => setActiveTab("summary")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === "summary"
              ? "border-purple-400 text-purple-400 bg-paper-dark rounded-t-lg"
              : "border-transparent text-ink/50 hover:text-ink"
          }`}
        >
          <Award className="w-4 h-4" />
          <span>3. Executive Plan Summary</span>
        </button>
      </div>

      {/* ── TAB 1: DISCOUNTING STRATEGY & INPUTS ────────────────────────── */}
      {activeTab === "discounting" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* ── CLEAN BRAND STRATEGY INPUT PANEL ──────────────────────────────── */}
          <div className="card bg-paper-dark border-line p-6 space-y-5 shadow-2xl relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 font-bold border border-purple-500/20">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <span>{activeBrand.name} — Strategy Configuration</span>
                    {loadingBrandData && (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                    )}
                  </h3>
                  <p className="text-xs text-ink/50">
                    Adjust target burn %, AOV, order targets, and code tiers for {activeBrand.name}.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider self-start sm:self-auto">
                {activeBrand.name} Profile
              </span>
            </div>

            {/* Operating Channel Selector: Delivery vs Dineout */}
            <div className="p-3.5 rounded-xl bg-paper border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                  Operating Channel Mode
                </span>
                <span className="text-[11px] text-ink/50">
                  Select whether this strategy applies to online Delivery or Dineout
                </span>
              </div>
              <div className="flex items-center gap-2 p-1 rounded-xl bg-paper-dark border border-line self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setChannel("delivery")}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    channel === "delivery"
                      ? "bg-purple-600 text-white shadow-md"
                      : "text-ink/60 hover:text-ink"
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Delivery</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChannel("dineout")}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    channel === "dineout"
                      ? "bg-amber-600 text-white shadow-md"
                      : "text-ink/60 hover:text-ink"
                  }`}
                >
                  <Utensils className="w-3.5 h-3.5" />
                  <span>Dineout</span>
                </button>
              </div>
            </div>

            {/* ── DINEOUT DISCOUNTS ENGINE ──────────────────────────────── */}
            {channel === "dineout" && (
              <div className="space-y-6 pt-2">
                {/* Dineout Header, Master Input & Mode Selector */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-line pb-4">
                  <div>
                    <h3 className="text-base font-bold text-ink flex items-center gap-2">
                      <Utensils className="w-5 h-5 text-amber-400" />
                      <span>Dining / Dineout — Discounts Engine</span>
                    </h3>
                    <p className="text-xs text-ink/50">
                      Automated Dineout Discount Configuration for {activeBrand.name}.
                    </p>
                  </div>

                  {/* Dineout Master Input & Mode Toggle */}
                  <div className="flex items-center gap-3 shrink-0 flex-wrap">
                    {/* Master Input: Discount Burn % */}
                    <div className="p-2.5 rounded-xl bg-paper border border-line flex items-center gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-amber-400 whitespace-nowrap">
                        Discount Burn %
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={10}
                          step={5}
                          value={dineoutConfig.discountBurnPct || 15}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 10;
                            const newBaseBurn = Math.max(10, Math.round(val / 5) * 5);
                            setDineoutConfig((prev) => {
                              const detailedOffsets = [15, 10, 5, 0];
                              const simplifiedOffsets = [5, 0];

                              const newDetailed = prev.detailedRows.map((r, idx) => {
                                const tot = Math.max(10, Math.round((newBaseBurn + (detailedOffsets[idx] || 0)) / 5) * 5);
                                const cof = r.cofunding || 5;
                                return { ...r, totalDiscount: tot, mxBurn: Math.max(0, tot - cof) };
                              });

                              const newSimplified = prev.simplifiedRows.map((r, idx) => {
                                const tot = Math.max(10, Math.round((newBaseBurn + (simplifiedOffsets[idx] || 0)) / 5) * 5);
                                const cof = r.cofunding || 5;
                                return { ...r, totalDiscount: tot, mxBurn: Math.max(0, tot - cof) };
                              });

                              return {
                                ...prev,
                                discountBurnPct: val,
                                detailedRows: newDetailed,
                                simplifiedRows: newSimplified,
                              };
                            });
                          }}
                          className="w-16 bg-paper-dark border border-line rounded px-2.5 py-1 text-xs font-mono font-extrabold text-ink text-center outline-none focus:border-amber-500"
                        />
                        <span className="text-xs font-bold text-amber-400">%</span>
                      </div>
                    </div>

                    {/* Option Mode Toggle (Option 1 Detailed vs Option 2 Simplified) */}
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-paper border border-line">
                      <button
                        type="button"
                        onClick={() => setDineoutMode("detailed")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          dineoutConfig.mode === "detailed"
                            ? "bg-amber-500/20 border border-amber-500 text-amber-300 font-extrabold shadow-sm"
                            : "text-ink/60 hover:text-ink"
                        }`}
                      >
                        Option 1 (4 Slots)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDineoutMode("simplified")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          dineoutConfig.mode === "simplified"
                            ? "bg-amber-500/20 border border-amber-500 text-amber-300 font-extrabold shadow-sm"
                            : "text-ink/60 hover:text-ink"
                        }`}
                      >
                        Option 2 (2 Slots)
                      </button>
                    </div>
                  </div>
                </div>

                {/* DINEOUT SUMMARY METRICS BAR */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Average Discount Burn</span>
                      <span className="text-xl font-extrabold text-amber-300 font-mono">
                        {dineoutStrategyResult.summary?.avgDiscountBurn}%
                      </span>
                    </div>
                    <Utensils className="w-6 h-6 text-amber-400/40" />
                  </div>

                  <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">Average MX Burn</span>
                      <span className="text-xl font-extrabold text-purple-300 font-mono">
                        {dineoutStrategyResult.summary?.avgMxBurn}%
                      </span>
                    </div>
                    <Zap className="w-6 h-6 text-purple-400/40" />
                  </div>

                  <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">Total Covers Target</span>
                      <span className="text-xl font-extrabold text-blue-300 font-mono">
                        {dineoutStrategyResult.summary?.totalCovers}
                      </span>
                    </div>
                    <Users className="w-6 h-6 text-blue-400/40" />
                  </div>
                </div>

                {/* DINEOUT DISCOUNTS TABLE */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                      Dining / Dineout Offers ({dineoutConfig.mode === "detailed" ? "Option 1 — 4 Time Slots" : "Option 2 — 2 Time Slots"})
                    </span>
                    <span className="text-[10px] font-mono text-ink/50">
                      Discounts strictly multiple of 5 | Minimum 5%
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-line bg-paper">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-paper-dark border-b border-line text-ink/60 uppercase tracking-wider text-[11px]">
                          <th className="p-3.5 font-semibold">Category</th>
                          <th className="p-3.5 font-semibold">Day</th>
                          <th className="p-3.5 font-semibold">Meal Time</th>
                          <th className="p-3.5 font-semibold text-center text-amber-300">Total Discounts (%) [Editable]</th>
                          <th className="p-3.5 font-semibold text-center text-amber-400">MX Burn (%) [Editable]</th>
                          <th className="p-3.5 font-semibold text-center">Cofunding (%)</th>
                          <th className="p-3.5 font-semibold text-center">Covers</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line font-mono">
                        {/* Pre Book / Reserve Rows */}
                        {dineoutStrategyResult.rows.map((row, idx) => (
                          <tr key={row.id} className="hover:bg-paper-dark/40 transition-all">
                            {idx === 0 && (
                              <td
                                rowSpan={dineoutStrategyResult.rows.length}
                                className="p-3.5 font-bold text-amber-300 border-r border-line bg-amber-500/5 align-middle text-center"
                              >
                                Pre Book <br /> Reserve
                              </td>
                            )}
                            <td className="p-3.5 font-semibold text-ink">{row.day}</td>
                            <td className="p-3.5 text-ink/70 font-semibold">{row.mealTime}</td>
                            
                            {/* Total Discounts Input */}
                            <td className="p-2.5 text-center bg-amber-500/5">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min={5}
                                  step={5}
                                  value={row.totalDiscount}
                                  onChange={(e) => updateDineoutRowField(row.id, "totalDiscount", parseFloat(e.target.value) || 0)}
                                  className="w-16 bg-paper-dark border border-line rounded px-2.5 py-1 text-xs font-extrabold text-amber-300 text-center outline-none focus:border-amber-500"
                                />
                                <span className="text-xs text-amber-300/60">%</span>
                              </div>
                            </td>

                            {/* MX Burn Input (Editable Override) */}
                            <td className="p-2.5 text-center bg-amber-500/10">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={row.mxBurn}
                                  onChange={(e) => updateDineoutRowField(row.id, "mxBurn", parseFloat(e.target.value) || 0)}
                                  className="w-16 bg-paper-dark border border-line rounded px-2.5 py-1 text-xs font-extrabold text-amber-400 text-center outline-none focus:border-amber-400"
                                />
                                <span className="text-xs text-amber-400/60">%</span>
                              </div>
                            </td>

                            {/* Cofunding Input */}
                            <td className="p-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={row.cofunding}
                                  onChange={(e) => updateDineoutRowField(row.id, "cofunding", parseFloat(e.target.value) || 0)}
                                  className="w-16 bg-paper-dark border border-line rounded px-2.5 py-1 text-xs font-bold text-ink text-center outline-none focus:border-emerald-500"
                                />
                                <span className="text-xs text-ink/40">%</span>
                              </div>
                            </td>

                            {/* Covers Input */}
                            <td className="p-2.5 text-center">
                              <input
                                type="number"
                                min={0}
                                value={row.covers}
                                onChange={(e) => updateDineoutRowField(row.id, "covers", parseInt(e.target.value) || 0)}
                                className="w-16 bg-paper-dark border border-line rounded px-2.5 py-1 text-xs font-bold text-ink text-center outline-none focus:border-blue-500"
                              />
                            </td>
                          </tr>
                        ))}

                        {/* Walk In Offers Row (Fully Editable) */}
                        <tr className="bg-emerald-500/5 hover:bg-emerald-500/10 transition-all font-bold border-t-2 border-line">
                          <td className="p-3.5 font-bold text-emerald-400 border-r border-line text-center">
                            Walk In offers
                          </td>
                          <td className="p-3.5 text-ink">{dineoutStrategyResult.walkIn.day}</td>
                          <td className="p-3.5 text-ink/70">{dineoutStrategyResult.walkIn.mealTime}</td>
                          
                          {/* Walk In Total Discount Input */}
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min={5}
                                step={5}
                                value={dineoutStrategyResult.walkIn.totalDiscount}
                                onChange={(e) => updateDineoutRowField("w1", "totalDiscount", parseFloat(e.target.value) || 0)}
                                className="w-16 bg-paper-dark border border-emerald-500/40 rounded px-2.5 py-1 text-xs font-extrabold text-emerald-400 text-center outline-none focus:border-emerald-400"
                              />
                              <span className="text-xs text-emerald-400/60">%</span>
                            </div>
                          </td>

                          {/* Walk In MX Burn Input */}
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={dineoutStrategyResult.walkIn.mxBurn}
                                onChange={(e) => updateDineoutRowField("w1", "mxBurn", parseFloat(e.target.value) || 0)}
                                className="w-16 bg-paper-dark border border-amber-500/40 rounded px-2.5 py-1 text-xs font-extrabold text-amber-400 text-center outline-none focus:border-amber-400"
                              />
                              <span className="text-xs text-amber-400/60">%</span>
                            </div>
                          </td>

                          {/* Walk In Cofunding Input */}
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={dineoutStrategyResult.walkIn.cofunding}
                                onChange={(e) => updateDineoutRowField("w1", "cofunding", parseFloat(e.target.value) || 0)}
                                className="w-16 bg-paper-dark border border-line rounded px-2.5 py-1 text-xs font-bold text-ink text-center outline-none focus:border-emerald-500"
                              />
                              <span className="text-xs text-ink/40">%</span>
                            </div>
                          </td>

                          {/* Walk In Covers Input */}
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              min={0}
                              value={dineoutStrategyResult.walkIn.covers}
                              onChange={(e) => updateDineoutRowField("w1", "covers", parseInt(e.target.value) || 0)}
                              className="w-16 bg-paper-dark border border-line rounded px-2.5 py-1 text-xs font-bold text-ink text-center outline-none focus:border-blue-500"
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── DELIVERY DISCOUNTS ENGINE (SHOWN ONLY WHEN CHANNEL IS DELIVERY) ── */}
            {channel === "delivery" && (
              <>
                {/* Row 1: Key Financial Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Discount Burn % */}
                  <div className="p-3.5 rounded-xl bg-paper border border-line space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                      Discount Burn Target %
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={targetDiscountBurnPct}
                        onChange={(e) => setTargetDiscountBurnPct(Number(e.target.value))}
                        className="w-full bg-paper-dark border border-line rounded-lg px-3 py-1.5 text-sm font-mono font-extrabold text-ink outline-none focus:border-amber-500"
                      />
                      <span className="text-sm font-bold text-amber-400">%</span>
                    </div>
                  </div>

                  {/* AOV */}
                  <div className="p-3.5 rounded-xl bg-paper border border-line space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                      Target AOV (₹)
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-emerald-400">₹</span>
                      <input
                        type="number"
                        value={aov}
                        onChange={(e) => setAov(Math.max(1, parseFloat(e.target.value) || 0))}
                        className="w-full bg-paper-dark border border-line rounded-lg px-3 py-1.5 text-sm font-mono font-extrabold text-ink outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Total Orders */}
                  <div className="p-3.5 rounded-xl bg-paper border border-line space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-blue-400 block">
                      Total Monthly Orders
                    </label>
                    <input
                      type="number"
                      value={totalOrders}
                      onChange={(e) => setTotalOrders(parseFloat(e.target.value) || 0)}
                      className="w-full bg-paper-dark border border-line rounded-lg px-3 py-1.5 text-sm font-mono font-extrabold text-ink outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* City / Location */}
                  <div className="p-3.5 rounded-xl bg-paper border border-line space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-rose-400 block">
                      City / Location
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full bg-paper-dark border border-line rounded-lg px-3 py-1.5 text-xs font-mono text-ink outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* Row 2: Customer Segments Distribution Inputs (LA / MM / UM - Absolute Numbers) */}
                <div className="p-4 rounded-xl bg-paper border border-line space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                      Customer Segments Breakdown (Numbers / Count)
                    </span>
                    <span className="text-[11px] font-mono text-ink/50">
                      Total: {(Number(laPct) || 0) + (Number(mmPct) || 0) + (Number(umPct) || 0)} Orders
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-paper-dark border border-line">
                      <span className="text-xs font-medium text-ink/70">LA (Less Affluent):</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={laPct}
                          onChange={(e) => setLaPct(Number(e.target.value))}
                          className="w-16 bg-paper border border-line rounded px-2 py-1 text-xs font-bold font-mono text-ink text-center"
                        />
                        <span className="text-xs text-ink/40">Orders</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-paper-dark border border-line">
                      <span className="text-xs font-medium text-ink/70">MM (Middle Market):</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={mmPct}
                          onChange={(e) => setMmPct(Number(e.target.value))}
                          className="w-16 bg-paper border border-line rounded px-2 py-1 text-xs font-bold font-mono text-ink text-center"
                        />
                        <span className="text-xs text-ink/40">Orders</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-paper-dark border border-line">
                      <span className="text-xs font-medium text-ink/70">UM (Upper Market):</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={umPct}
                          onChange={(e) => setUmPct(Number(e.target.value))}
                          className="w-16 bg-paper border border-line rounded px-2 py-1 text-xs font-bold font-mono text-ink text-center"
                        />
                        <span className="text-xs text-ink/40">Orders</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 3: Code Strategy Selection Controls */}
                <div className="pt-2 border-t border-line grid grid-cols-1 lg:grid-cols-3 gap-5">
                  
                  {/* Primary Codes Choice */}
                  <div className="p-4 rounded-xl bg-paper border border-line space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                        1. Primary Codes Selection
                      </span>
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {primaryOption.startsWith("single") ? "1 Code Active" : "2 Codes Active"}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink/50">Deploy a single primary code or a dual code set:</p>
                    
                    {/* Single Code Options (1 Code) */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink/40 block">
                        Single Primary Code (1 Code)
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                        <button
                          type="button"
                          onClick={() => setPrimaryOption("single_new")}
                          className={`p-2 rounded-lg border text-left transition-all ${
                            primaryOption === "single_new"
                              ? "bg-blue-500/20 border-blue-500 text-blue-300 font-bold"
                              : "bg-paper-dark border-line text-ink/60 hover:text-ink"
                          }`}
                        >
                          60% (New User)
                        </button>

                        <button
                          type="button"
                          onClick={() => setPrimaryOption("single_repeat")}
                          className={`p-2 rounded-lg border text-left transition-all ${
                            primaryOption === "single_repeat"
                              ? "bg-blue-500/20 border-blue-500 text-blue-300 font-bold"
                              : "bg-paper-dark border-line text-ink/60 hover:text-ink"
                          }`}
                        >
                          50% (Repeat User)
                        </button>

                        <button
                          type="button"
                          onClick={() => setPrimaryOption("single_all")}
                          className={`p-2 rounded-lg border text-left transition-all ${
                            primaryOption === "single_all"
                              ? "bg-blue-500/20 border-blue-500 text-blue-300 font-bold"
                              : "bg-paper-dark border-line text-ink/60 hover:text-ink"
                          }`}
                        >
                          40% (All User)
                        </button>

                        <button
                          type="button"
                          onClick={() => setPrimaryOption("single_radius")}
                          className={`p-2 rounded-lg border text-left transition-all ${
                            primaryOption === "single_radius"
                              ? "bg-blue-500/20 border-blue-500 text-blue-300 font-bold"
                              : "bg-paper-dark border-line text-ink/60 hover:text-ink"
                          }`}
                        >
                          30% (4km Radius)
                        </button>
                      </div>
                    </div>

                    {/* Dual Codes Options (2 Codes) */}
                    <div className="space-y-1.5 pt-2 border-t border-line/60">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink/40 block">
                        Dual Primary Codes Set (2 Codes)
                      </span>
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => setPrimaryOption("option1")}
                          className={`w-full p-2.5 rounded-lg border text-left text-xs transition-all ${
                            primaryOption === "option1"
                              ? "bg-blue-500/20 border-blue-500 text-blue-300 font-bold"
                              : "bg-paper-dark border-line text-ink/60 hover:text-ink"
                          }`}
                        >
                          <div>Option 1: All User (40%) + New User (60%)</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPrimaryOption("option2")}
                          className={`w-full p-2.5 rounded-lg border text-left text-xs transition-all ${
                            primaryOption === "option2"
                              ? "bg-blue-500/20 border-blue-500 text-blue-300 font-bold"
                              : "bg-paper-dark border-line text-ink/60 hover:text-ink"
                          }`}
                        >
                          <div>Option 2: New User (60%) + Repeat User (50%)</div>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Stepper / Flat Off Choice (Multi-Select) */}
                  <div className="p-4 rounded-xl bg-paper border border-line space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 block uppercase tracking-wider">
                        2. Stepper Flat Off Tiers (Multi-Select)
                      </span>
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {flatOffChoices.length} Selected
                      </span>
                    </div>
                    <p className="text-[11px] text-ink/50">Select one or multiple flat off tiers:</p>
                    
                    <div className="flex items-center gap-2 pb-1">
                      <button
                        type="button"
                        onClick={() => setStepperSegregation("la_mm_um")}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${
                          stepperSegregation === "la_mm_um"
                            ? "bg-amber-500/20 border-amber-500 text-amber-300"
                            : "bg-paper-dark border-line text-ink/60"
                        }`}
                      >
                        LA, MM, UM
                      </button>
                      <button
                        type="button"
                        onClick={() => setStepperSegregation("au")}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${
                          stepperSegregation === "au"
                            ? "bg-amber-500/20 border-amber-500 text-amber-300"
                            : "bg-paper-dark border-line text-ink/60"
                        }`}
                      >
                        AU (All User)
                      </button>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5">
                      {[100, 125, 150, 175, 200].map((amt) => {
                        const isSelected = flatOffChoices.includes(amt);
                        return (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => toggleFlatOffChoice(amt)}
                            className={`py-2 text-xs font-extrabold rounded-lg border font-mono transition-all flex items-center justify-center gap-1 ${
                              isSelected
                                ? "bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                                : "bg-paper-dark border-line text-ink/60 hover:text-ink hover:border-amber-500/40"
                            }`}
                          >
                            {isSelected && <CheckSquare className="w-3 h-3" />}
                            <span>₹{amt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Party Code Choice */}
                  <div className="p-4 rounded-xl bg-paper border border-line space-y-2.5">
                    <span className="text-xs font-bold text-purple-400 block uppercase tracking-wider">
                      3. Party Code Strategy
                    </span>
                    <p className="text-[11px] text-ink/50">High value group order discount:</p>

                    <button
                      type="button"
                      onClick={() => setPartyCodesEnabled(!partyCodesEnabled)}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        partyCodesEnabled
                          ? "bg-purple-500/20 border-purple-500 text-purple-300 font-bold"
                          : "bg-paper-dark border-line text-ink/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CheckSquare className={`w-4 h-4 ${partyCodesEnabled ? "text-purple-400" : ""}`} />
                        <span>Flat 10% on MOV ₹999</span>
                      </div>
                      <span className="font-mono text-[11px]">10.0% Burn</span>
                    </button>
                  </div>

                </div>
              </>
            )}
          </div>

            {/* ── AUTOMATED RECOMMENDATION ENGINE CARD (DELIVERY ONLY) ── */}
            {channel === "delivery" && (
              <>
                <div
                  className={`card p-6 space-y-4 shadow-2xl relative border-2 transition-all ${
                    discountAutomation.targetCompliance
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                      : "bg-amber-500/10 border-amber-500/40 text-amber-300"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line/40 pb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-3 rounded-xl ${
                          discountAutomation.targetCompliance
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        <Sparkles className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-ink">
                          Automated Best Discount Recommendation — {activeBrand.name}
                        </h3>
                        <p className="text-xs text-ink/60">
                          {discountAutomation.recommendationMessage}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] uppercase font-bold text-ink/40 block">
                        Effective Burn vs Target
                      </span>
                      <div className="flex items-center justify-end gap-2 font-mono">
                        <span className="text-2xl font-extrabold text-ink">
                          {discountAutomation.overallEffectiveBurnPct}%
                        </span>
                        <span className="text-xs text-ink/50">/ Target {targetDiscountBurnPct}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Recommended Selected Codes Set */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                    {/* Primary Codes Set */}
                    <div className="p-3.5 rounded-xl bg-paper border border-line space-y-1">
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">
                        Selected Primary Codes ({discountAutomation.selectedPrimaryCodes.length})
                      </span>
                      {discountAutomation.selectedPrimaryCodes.map((c) => (
                        <div key={c.id} className="text-ink font-semibold flex items-center justify-between">
                          <span>{c.name}</span>
                          <span className="text-emerald-400">{c.burnPct}%</span>
                        </div>
                      ))}
                    </div>

                    {/* Stepper Codes */}
                    <div className="p-3.5 rounded-xl bg-paper border border-line space-y-1">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                        Selected Stepper Tiers ({(discountAutomation.selectedStepperCodes || [discountAutomation.selectedStepperCode]).length})
                      </span>
                      {(discountAutomation.selectedStepperCodes || [discountAutomation.selectedStepperCode]).map((sc) => (
                        <div key={sc.id} className="text-ink font-semibold flex items-center justify-between">
                          <span>{sc.name}</span>
                          <span className="text-amber-400">{sc.burnPct}%</span>
                        </div>
                      ))}
                    </div>

                    {/* Party Code */}
                    <div className="p-3.5 rounded-xl bg-paper border border-line space-y-1">
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                        Party Code
                      </span>
                      {discountAutomation.selectedPartyCode ? (
                        <div className="text-ink font-semibold flex items-center justify-between">
                          <span>{discountAutomation.selectedPartyCode.name}</span>
                          <span className="text-emerald-400">10.0%</span>
                        </div>
                      ) : (
                        <div className="text-ink/40">Disabled</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Primary Codes Master Reference Table */}
                <div className="card !p-0 overflow-hidden border-line">
                  <div className="p-4 bg-paper-dark border-b border-line flex items-center justify-between">
                    <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                      <Tag className="w-4 h-4 text-blue-400" /> Primary Discount Tiers Reference
                    </h3>
                    <span className="text-xs text-ink/40 font-mono">6 Tiers</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-paper border-b border-line text-ink/60 uppercase tracking-wider text-[11px]">
                          <th className="p-3.5 font-semibold">User Type / Target</th>
                          <th className="p-3.5 font-semibold">Discount Format</th>
                          <th className="p-3.5 font-semibold text-right">Max Cap</th>
                          <th className="p-3.5 font-semibold text-right">MOV</th>
                          <th className="p-3.5 font-semibold text-right">Burn %</th>
                          <th className="p-3.5 font-semibold">Formula Logic</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {primaryCodes.map((c) => (
                          <tr key={c.id} className="hover:bg-paper-dark/50 transition-all">
                            <td className="p-3.5 font-bold text-ink">{c.segmentTarget}</td>
                            <td className="p-3.5 font-mono text-blue-400 font-semibold">{c.name}</td>
                            <td className="p-3.5 text-right font-mono">₹{c.discountCap}</td>
                            <td className="p-3.5 text-right font-mono">₹{c.mov}</td>
                            <td className="p-3.5 text-right font-mono font-bold text-emerald-400">
                              {c.burnPct}%
                            </td>
                            <td className="p-3.5 text-ink/40 font-mono">{c.formulaNote}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
        </div>
      )}

      {/* ── TAB 2: ADS SPEND ENGINE VIEW ────────────────────────────────────────── */}
      {activeTab === "ads" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Sub-Tab Navigation Bar: Delivery Ads vs Dineout Ad Products Directory */}
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAdsSubTab("delivery")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  adsSubTab === "delivery"
                    ? "bg-purple-500/20 border border-purple-500 text-purple-300 shadow-sm"
                    : "bg-paper-dark border border-line text-ink/60 hover:text-ink"
                }`}
              >
                <Zap className="w-4 h-4 text-purple-400" />
                <span>Delivery Ads Engine (Calculations)</span>
              </button>
              <button
                type="button"
                onClick={() => setAdsSubTab("dineout")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  adsSubTab === "dineout"
                    ? "bg-amber-500/20 border border-amber-500 text-amber-300 shadow-sm"
                    : "bg-paper-dark border border-line text-ink/60 hover:text-ink"
                }`}
              >
                <Utensils className="w-4 h-4 text-amber-400" />
                <span>Dine-In & Dineout Ad Products Directory</span>
              </button>
            </div>

            {adsSubTab === "dineout" && (
              <button
                type="button"
                onClick={() => setShowAddDineoutModal(true)}
                className="btn btn-primary text-xs flex items-center gap-1.5"
              >
                <span>+ Add Custom Ad Product</span>
              </button>
            )}
          </div>

          {/* ── DINEOUT AD PRODUCTS DIRECTORY VIEW ── */}
          {adsSubTab === "dineout" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Filter Header & Platform Badges */}
              <div className="card p-5 bg-paper-dark border-line flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                <div>
                  <div className="flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-amber-400" />
                    <h3 className="text-base font-bold text-ink">
                      Zomato Dining & Swiggy Dineout Ad Products Catalog
                    </h3>
                  </div>
                  <p className="text-xs text-ink/50 mt-1">
                    Official platform placement directory & pricing models for interns, co-founders & growth strategy teams.
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-paper border border-line p-1 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setDineoutPlatformFilter("zomato")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      dineoutPlatformFilter === "zomato"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : "text-ink/60 hover:text-ink"
                    }`}
                  >
                    Zomato Dining ({allDineoutAds.filter((a) => a.platform === "zomato").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDineoutPlatformFilter("swiggy")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      dineoutPlatformFilter === "swiggy"
                        ? "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                        : "text-ink/60 hover:text-ink"
                    }`}
                  >
                    Swiggy Dineout ({allDineoutAds.filter((a) => a.platform === "swiggy").length})
                  </button>
                </div>
              </div>

              {/* Grid of Dineout Ad Products Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDineoutAds.map((ad, idx) => (
                  <div
                    key={ad.id || idx}
                    className="card p-5 bg-paper border-line hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-4 shadow-lg group relative"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border ${
                            ad.platform === "swiggy"
                              ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {ad.platform === "swiggy" ? "Swiggy Dineout" : "Zomato Dining"}
                        </span>
                        {ad.isCustom && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                            Custom User Added
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-ink group-hover:text-amber-300 transition-colors leading-snug">
                        {ad.name}
                      </h4>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-paper-dark text-blue-400 border border-line">
                          Model: {ad.pricingModel}
                        </span>
                        {ad.zoneScope && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                            Scope: {ad.zoneScope}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-ink/70 leading-relaxed pt-1">
                        {ad.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── DELIVERY ADS MODULE (CALCULATIONS ENGINE) ── */}
          {adsSubTab === "delivery" && (
            <>
          {/* ── SWIGGY ADS MODULE (PRODUCTS & AI BUDGET SEGREGATION) ── */}
          {platform === "swiggy" && (
            <div className="card bg-paper-dark border-line p-6 space-y-6 shadow-2xl relative">
              {/* Header & Mode Toggle */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-line pb-4">
                <div>
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <Store className="w-5 h-5 text-orange-400" />
                    <span>Swiggy Ads — Product-Wise Budget Planning & AI Segregation</span>
                  </h3>
                  <p className="text-xs text-ink/50">
                    Select Swiggy ad products and let AI dynamically distribute your total budget across selected products.
                  </p>
                </div>

                {/* Mode Toggle: Tryout / Hyperboost vs No Tryouts */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-paper border border-line shrink-0">
                  <button
                    type="button"
                    onClick={() => setSwiggyAdsMode("tryout")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      swiggyAdsConfig.mode === "tryout"
                        ? "bg-orange-500/20 border border-orange-500 text-orange-300 font-extrabold shadow-sm"
                        : "text-ink/60 hover:text-ink"
                    }`}
                  >
                    Mode 1 (Tryout / Hyperboost)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSwiggyAdsMode("no_tryout")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      swiggyAdsConfig.mode === "no_tryout"
                        ? "bg-purple-500/20 border border-purple-500 text-purple-300 font-extrabold shadow-sm"
                        : "text-ink/60 hover:text-ink"
                    }`}
                  >
                    Mode 2 (No Tryouts)
                  </button>
                </div>
              </div>

              {/* STEP 1: Total Ads Budget Calculation Inputs */}
              <div className="p-4 rounded-xl bg-paper border border-line space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-orange-400 block">
                    1. Total Ads Budget Calculation ({swiggyAdsConfig.mode === "tryout" ? "Mode 1 — Tryout / Hyperboost" : "Mode 2 — No Tryouts"})
                  </span>
                  <span className="text-xs font-mono font-bold text-ink">
                    Calculated Total Ads Budget: <strong className="text-emerald-400 text-base ml-1">₹{swiggyAdsResult.totalAdsBudget.toLocaleString("en-IN")}</strong>
                  </span>
                </div>

                {swiggyAdsConfig.mode === "tryout" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Tryout X% */}
                    <div>
                      <label className="text-[11px] font-bold text-ink/70 block mb-1">X% (Tryout Percentage)</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={swiggyAdsConfig.tryoutPct}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setSwiggyAdsConfig((prev) => ({ ...prev, tryoutPct: val }));
                          }}
                          className="w-full bg-paper-dark border border-line rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-ink outline-none focus:border-orange-500"
                        />
                        <span className="text-xs font-bold text-orange-400">%</span>
                      </div>
                    </div>

                    {/* GMV */}
                    <div>
                      <label className="text-[11px] font-bold text-ink/70 block mb-1">GMV (Gross Merchandise Value)</label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-emerald-400">₹</span>
                        <input
                          type="number"
                          min={0}
                          value={swiggyAdsConfig.gmv}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setSwiggyAdsConfig((prev) => ({ ...prev, gmv: val }));
                          }}
                          className="w-full bg-paper-dark border border-line rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-ink outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Calculated Budget Summary */}
                    <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 flex flex-col justify-center font-mono">
                      <span className="text-[10px] text-orange-400 font-bold uppercase">Formula: GMV × X%</span>
                      <span className="text-xs text-ink/70">₹{swiggyAdsConfig.gmv.toLocaleString("en-IN")} × {swiggyAdsConfig.tryoutPct}%</span>
                      <span className="text-sm font-extrabold text-emerald-400">₹{swiggyAdsResult.totalAdsBudget.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono">
                    {/* Base Ads Amount Input */}
                    <div>
                      <label className="text-[11px] font-bold text-ink/70 block mb-1 font-sans">Base Ads Amount (₹)</label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-emerald-400">₹</span>
                        <input
                          type="number"
                          min={0}
                          value={swiggyAdsConfig.baseAdsAmount}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setSwiggyAdsConfig((prev) => ({ ...prev, baseAdsAmount: val }));
                          }}
                          className="w-full bg-paper-dark border border-line rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-ink outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>

                    {/* Direct Amount Summary */}
                    <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 flex flex-col justify-center">
                      <span className="text-[10px] text-purple-400 font-bold uppercase font-sans">Flat Total Ads Budget</span>
                      <span className="text-base font-extrabold text-emerald-400">₹{swiggyAdsResult.totalAdsBudget.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 2: Swiggy Ads Products Multi-Select */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink block">
                    2. Select Swiggy Ads Products (Target: AU - All Users)
                  </span>
                  <span className="text-[11px] font-mono text-ink/50">
                    {swiggyAdsConfig.selectedProductIds.length} Products Selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {SWIGGY_AD_PRODUCTS.map((prod) => {
                    const isSelected = swiggyAdsConfig.selectedProductIds.includes(prod.id);
                    return (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => toggleSwiggyAdProduct(prod.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                          isSelected
                            ? "bg-orange-500/10 border-orange-500 text-orange-300 shadow-lg shadow-orange-500/5"
                            : "bg-paper border-line text-ink/50 hover:text-ink hover:border-line/80"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs text-ink flex items-center gap-1.5">
                              <CheckSquare className={`w-3.5 h-3.5 ${isSelected ? "text-orange-400" : "text-ink/30"}`} />
                              {prod.shortName}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-paper-dark border border-line text-orange-400">
                              {prod.target}
                            </span>
                          </div>
                          <p className="text-[11px] text-ink/60 leading-snug">{prod.description}</p>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-line/40 text-[10px] font-mono text-ink/40">
                          Ref: {prod.referenceNote}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STEP 3 & 4: AI SUGGESTED BUDGET SPLIT */}
              <div className="space-y-3 pt-3 border-t border-line">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-300 block">
                      AI Suggested Budget Split (Gemini 2.5 Dynamic Segregation)
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 border border-purple-500/20 text-purple-300">
                    AI Dynamic Allocation Engine
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-line bg-paper">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-paper-dark border-b border-line text-ink/60 uppercase tracking-wider text-[11px]">
                        <th className="p-3.5 font-semibold">Selected Product</th>
                        <th className="p-3.5 font-semibold">Target Audience</th>
                        <th className="p-3.5 font-semibold text-center">Budget Share (%)</th>
                        <th className="p-3.5 font-semibold text-right text-emerald-400">AI Suggested Allocation (₹)</th>
                        <th className="p-3.5 font-semibold">Strategy & Reference Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line font-mono">
                      {swiggyAdsResult.split.map((item) => (
                        <tr key={item.id} className="hover:bg-paper-dark/40 transition-all">
                          <td className="p-3.5 font-bold text-ink flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0"></span>
                            {item.name}
                          </td>
                          <td className="p-3.5 text-ink/70">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-paper-dark border border-line text-orange-300">
                              {item.target}
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-bold text-purple-300 text-sm">
                            {item.percentage}%
                          </td>
                          <td className="p-3.5 text-right font-extrabold text-emerald-400 text-base bg-emerald-500/5">
                            ₹{item.allocatedBudget.toLocaleString("en-IN")}
                          </td>
                          <td className="p-3.5 text-ink/50 text-[11px]">
                            {item.referenceNote}
                          </td>
                        </tr>
                      ))}
                      {/* Total Row */}
                      <tr className="bg-paper-dark font-bold text-ink border-t-2 border-line">
                        <td colSpan={2} className="p-3.5 text-right text-xs uppercase tracking-wider font-sans">
                          Total Segregated Budget:
                        </td>
                        <td className="p-3.5 text-center text-purple-400 text-sm">
                          100%
                        </td>
                        <td className="p-3.5 text-right text-emerald-400 text-lg font-extrabold">
                          ₹{swiggyAdsResult.totalAdsBudget.toLocaleString("en-IN")}
                        </td>
                        <td className="p-3.5 text-ink/40 text-[10px] font-normal font-sans">
                          *AI suggestion automatically calculates exact 100% split across selected products.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── ZOMATO GROW MAXX ADS ENGINE (ZOMATO PLATFORM ONLY) ── */}
          {platform === "zomato" && (
            <>
              {/* Model Selector Strip */}
              <div className="card p-4 space-y-3 bg-paper-dark border-line">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink/60">
                    Select Grow Maxx Ad Calculation Model (Zomato)
                  </span>
                  <span className="text-[10px] text-purple-400 font-mono">
                    Formula Engine: Sheet Aligned
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {[
                    { id: "M1", title: "Model M1", sub: "Flat % of Projected CV" },
                    { id: "M2", title: "Model M2", sub: "Tiered Baseline + Growth" },
                    { id: "M3", title: "Model M3", sub: "Flat % of Subtotal" },
                    { id: "SGM", title: "Model SGM", sub: "Singular Grow Maxx" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedAdsModel(m.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedAdsModel === m.id
                          ? "bg-purple-500/10 border-purple-500 text-purple-300 shadow-md"
                          : "bg-paper border-line text-ink/60 hover:text-ink"
                      }`}
                    >
                      <div className="font-bold text-xs">{m.title}</div>
                      <div className="text-[10px] opacity-70 mt-0.5">{m.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Audience Segment Order Breakdown Controls (LA, MM, UM Numbers / Orders Count) */}
              <div className="card p-4 space-y-3 bg-paper border-line">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400 block">
                    Target Audience Segments (LA / MM / UM Orders Count)
                  </span>
                  <span className="text-xs font-mono font-bold text-ink">
                    Total Calculated Orders: <strong className="text-emerald-400">{(Number(laPct) || 0) + (Number(mmPct) || 0) + (Number(umPct) || 0)} Orders</strong>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-ink/70 block mb-1 font-sans">LA (Less Affluent Orders)</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        value={laPct}
                        onChange={(e) => setLaPct(parseFloat(e.target.value) || 0)}
                        className="w-full bg-paper-dark border border-line rounded px-3 py-1.5 font-bold text-ink outline-none focus:border-purple-500"
                      />
                      <span className="text-xs text-ink/40 font-sans">Orders</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-ink/70 block mb-1 font-sans">MM (Middle Market Orders)</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        value={mmPct}
                        onChange={(e) => setMmPct(parseFloat(e.target.value) || 0)}
                        className="w-full bg-paper-dark border border-line rounded px-3 py-1.5 font-bold text-ink outline-none focus:border-purple-500"
                      />
                      <span className="text-xs text-ink/40 font-sans">Orders</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-ink/70 block mb-1 font-sans">UM (Upper Market Orders)</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        value={umPct}
                        onChange={(e) => setUmPct(parseFloat(e.target.value) || 0)}
                        className="w-full bg-paper-dark border border-line rounded px-3 py-1.5 font-bold text-ink outline-none focus:border-purple-500"
                      />
                      <span className="text-xs text-ink/40 font-sans">Orders</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Model Parameter Adjusters */}
              <div className="card p-4 space-y-4">
                <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                  Financial Inputs & Ad Rates ({activeBrand.name}) — {selectedAdsModel}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="label text-[10px]">Rate X% (Tier 1 / Baseline Rate)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={rateX}
                        onChange={(e) => setRateX(Number(e.target.value))}
                        className="input text-xs font-bold font-mono"
                      />
                      <span className="text-xs text-ink/40">%</span>
                    </div>
                  </div>

                  {selectedAdsModel === "M2" && (
                    <>
                      <div>
                        <label className="label text-[10px]">Rate Y% (Tier 2 / Incremental Growth Rate)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={rateY}
                            onChange={(e) => setRateY(Number(e.target.value))}
                            className="input text-xs font-bold font-mono"
                          />
                          <span className="text-xs text-ink/40">%</span>
                        </div>
                      </div>

                      <div>
                        <label className="label text-[10px]">Baseline CV (₹)</label>
                        <input
                          type="number"
                          value={baselineCV}
                          onChange={(e) => setBaselineCV(parseFloat(e.target.value) || 0)}
                          className="input text-xs font-bold font-mono"
                        />
                      </div>
                    </>
                  )}

                  {selectedAdsModel === "M3" ? (
                    <div>
                      <label className="label text-[10px]">Projected Subtotal (₹)</label>
                      <input
                        type="number"
                        value={subtotalSales}
                        onChange={(e) => setSubtotalSales(parseFloat(e.target.value) || 0)}
                        className="input text-xs font-bold font-mono"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="label text-[10px]">Projected CV / Total Sales (₹)</label>
                      <input
                        type="number"
                        value={totalSales}
                        onChange={(e) => setTotalSales(parseFloat(e.target.value) || 0)}
                        className="input text-xs font-bold font-mono"
                      />
                    </div>
                  )}

                  <div>
                    <label className="label text-[10px]">Base Ads Budget Override (₹)</label>
                    <input
                      type="number"
                      value={baseAdsAmount}
                      onChange={(e) => setBaseAdsAmount(parseFloat(e.target.value) || 0)}
                      className="input text-xs font-bold font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Formula Breakdown Output Card */}
              <div className="card p-6 bg-gradient-to-br from-paper via-paper-dark to-paper border-purple-500/30 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div>
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-wider block">
                      Active Formula Calculation
                    </span>
                    <h3 className="text-lg font-bold text-ink">{adsResult.modelName}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-ink/50 block">Calculated Total Ads Budget</span>
                    <span className="text-2xl font-extrabold text-purple-400 font-mono">
                      {formatCurrency(adsResult.totalAdsAmount)}
                    </span>
                  </div>
                </div>

                {/* Formula Step-by-Step Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-paper border border-line space-y-1.5">
                    <span className="text-xs font-bold text-blue-400 block">{adsResult.adsXName}</span>
                    <p className="text-xs text-ink/60 font-mono">{adsResult.adsXFormula}</p>
                    <div className="text-lg font-bold text-ink font-mono pt-1">
                      {formatCurrency(adsResult.adsXAmount)}
                    </div>
                  </div>

                  {adsResult.adsYName && (
                    <div className="p-4 rounded-xl bg-paper border border-line space-y-1.5">
                      <span className="text-xs font-bold text-emerald-400 block">{adsResult.adsYName}</span>
                      <p className="text-xs text-ink/60 font-mono">{adsResult.adsYFormula}</p>
                      <div className="text-lg font-bold text-ink font-mono pt-1">
                        {formatCurrency(adsResult.adsYAmount || 0)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Base Ads Validation Warning */}
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium ${
                    adsResult.baseAdsValid
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {adsResult.baseAdsValid ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    <span>
                      Base Ads Validation: Base Ads Amount ({formatCurrency(adsResult.baseAdsAmount)}) must be ≤ Grow Maxx Ads ({formatCurrency(adsResult.growMaxxAdsAmount)})
                    </span>
                  </div>
                  <span className="font-mono font-bold">
                    {adsResult.baseAdsValid ? "VALID ALLOCATION" : "WARNING: BASE ADS TOO HIGH"}
                  </span>
                </div>
              </div>

              {/* Zomato Placement Products Multi-Select Selector Card */}
              <div className="card p-4 bg-paper-dark border-line space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink block">
                    Select Zomato Base Ads Placement Products
                  </span>
                  <span className="text-[11px] font-mono text-purple-400 font-bold">
                    {selectedZomatoPlacements.length} Placement Products Selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {[
                    { id: "gvp", name: "GVP", full: "General Visit Pack" },
                    { id: "psp", name: "PSP", full: "Promoted Smart Placement" },
                    { id: "spendingPotential", name: "Spending Potential", full: "Target UM Only" },
                    { id: "boss", name: "BOSS", full: "Cuisine Tag" },
                    { id: "bigBoss", name: "BIG BOSS", full: "Brand Tag" },
                    { id: "dishPsp", name: "Dish PSP", full: "Click Placement" },
                  ].map((p) => {
                    const isSelected = selectedZomatoPlacements.includes(p.id);
                    const dynamicPct = (adsResult.baseAdsBreakdown as any)[p.id]?.pct || 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleZomatoPlacement(p.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "bg-purple-500/15 border-purple-500 text-purple-300 shadow-md font-bold"
                            : "bg-paper border-line text-ink/40 hover:text-ink"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs flex items-center gap-1.5">
                            <CheckSquare className={`w-3.5 h-3.5 ${isSelected ? "text-purple-400" : "text-ink/30"}`} />
                            {p.name}
                          </span>
                          <span className="text-[9px] font-mono font-bold text-purple-400 bg-paper-dark px-1 py-0.5 rounded border border-line">
                            {dynamicPct}%
                          </span>
                        </div>
                        <div className="text-[10px] text-ink/50 mt-1 truncate">{p.full}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Base Ads Placements Breakdown Table */}
              <div className="card !p-0 overflow-hidden border-line">
                <div className="p-4 bg-paper-dark border-b border-line flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                      <Store className="w-4 h-4 text-purple-400" /> Zomato Base Ads Placements Distribution
                    </h3>
                    <p className="text-[11px] text-ink/50 mt-0.5 font-sans">
                      Target segments with exact order counts (LA: {Math.round(totalOrders * (laPct / 100))} orders, MM: {Math.round(totalOrders * (mmPct / 100))} orders, UM: {Math.round(totalOrders * (umPct / 100))} orders)
                    </p>
                  </div>
                  <span className="text-xs text-ink/40 font-mono">
                    Total Base Ads: {formatCurrency(adsResult.baseAdsAmount)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-paper border-b border-line text-ink/60 uppercase tracking-wider text-[11px]">
                        <th className="p-3.5 font-semibold">Ad Placement Type</th>
                        <th className="p-3.5 font-semibold">Target Audience Segment (Exact Orders)</th>
                        <th className="p-3.5 font-semibold text-right">Allocation %</th>
                        <th className="p-3.5 font-semibold text-right">Budget Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line font-mono">
                      {[
                        {
                          key: "gvp",
                          name: "General Visit Pack (GVP)",
                          target: `All Users (AU) — ${totalOrders} Total Orders`,
                          pct: adsResult.baseAdsBreakdown.gvp.pct,
                          amount: adsResult.baseAdsBreakdown.gvp.amount,
                        },
                        {
                          key: "psp",
                          name: "Promoted Smart Placement (PSP)",
                          target: `UM (${Math.round(totalOrders * (umPct / 100))} orders) → MM (${Math.round(totalOrders * (mmPct / 100))} orders) → LA (${Math.round(totalOrders * (laPct / 100))} orders)`,
                          pct: adsResult.baseAdsBreakdown.psp.pct,
                          amount: adsResult.baseAdsBreakdown.psp.amount,
                        },
                        {
                          key: "spendingPotential",
                          name: "Spending Potential",
                          target: `Target Upper Market (UM) Only — ${Math.round(totalOrders * (umPct / 100))} Orders`,
                          pct: adsResult.baseAdsBreakdown.spendingPotential.pct,
                          amount: adsResult.baseAdsBreakdown.spendingPotential.amount,
                        },
                        {
                          key: "boss",
                          name: "BOSS (Brand Overall Search Slot)",
                          target: `Cuisine Tag Placement — ${totalOrders} Orders Target`,
                          pct: adsResult.baseAdsBreakdown.boss.pct,
                          amount: adsResult.baseAdsBreakdown.boss.amount,
                        },
                        {
                          key: "bigBoss",
                          name: "BIG BOSS",
                          target: `Brand Tag Placement — ${totalOrders} Orders Target`,
                          pct: adsResult.baseAdsBreakdown.bigBoss.pct,
                          amount: adsResult.baseAdsBreakdown.bigBoss.amount,
                        },
                        {
                          key: "dishPsp",
                          name: "Dish PSP",
                          target: `Click-based dish placement — ${totalOrders} Orders Target`,
                          pct: adsResult.baseAdsBreakdown.dishPsp.pct,
                          amount: adsResult.baseAdsBreakdown.dishPsp.amount,
                        },
                      ]
                        .filter((item) => selectedZomatoPlacements.includes(item.key))
                        .map((item) => (
                          <tr key={item.key} className="hover:bg-paper-dark/50 transition-all">
                            <td className="p-3.5 font-bold text-ink flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0"></span>
                              {item.name}
                            </td>
                            <td className="p-3.5 text-ink/70">{item.target}</td>
                            <td className="p-3.5 text-right font-bold text-purple-400">{item.pct}%</td>
                            <td className="p-3.5 text-right font-bold text-emerald-400">
                              {formatCurrency(item.amount)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )}

      {/* ── MODAL: ADD CUSTOM DINEOUT AD PRODUCT ───────────────────────────── */}
      {showAddDineoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-paper border border-line rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-ink">Add Custom Dineout Ad Product</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDineoutModal(false)}
                className="text-ink/40 hover:text-ink"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomDineoutAd} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink/60 uppercase block mb-1.5">Platform</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewDineoutAd({ ...newDineoutAd, platform: "zomato" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      newDineoutAd.platform === "zomato"
                        ? "bg-rose-500/20 border-rose-500 text-rose-300"
                        : "bg-paper-dark border-line text-ink/60 hover:text-ink"
                    }`}
                  >
                    Zomato Dining
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDineoutAd({ ...newDineoutAd, platform: "swiggy" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      newDineoutAd.platform === "swiggy"
                        ? "bg-orange-500/20 border-orange-500 text-orange-300"
                        : "bg-paper-dark border-line text-ink/60 hover:text-ink"
                    }`}
                  >
                    Swiggy Dineout
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink/60 uppercase block mb-1.5">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zomato Spotlight Banner or Swiggy Super Flash"
                  value={newDineoutAd.name}
                  onChange={(e) => setNewDineoutAd({ ...newDineoutAd, name: e.target.value })}
                  className="w-full bg-paper-dark border border-line rounded-xl px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink/60 uppercase block mb-1.5">Pricing Model</label>
                  <input
                    type="text"
                    placeholder="e.g. Click Based, CPV, Zone Flat"
                    value={newDineoutAd.pricingModel}
                    onChange={(e) => setNewDineoutAd({ ...newDineoutAd, pricingModel: e.target.value })}
                    className="w-full bg-paper-dark border border-line rounded-xl px-4 py-2.5 text-xs text-ink focus:outline-none focus:border-ink"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink/60 uppercase block mb-1.5">Zone Scope / Radius</label>
                  <input
                    type="text"
                    placeholder="e.g. 8-10 KM Radius, Pan City"
                    value={newDineoutAd.zoneScope}
                    onChange={(e) => setNewDineoutAd({ ...newDineoutAd, zoneScope: e.target.value })}
                    className="w-full bg-paper-dark border border-line rounded-xl px-4 py-2.5 text-xs text-ink focus:outline-none focus:border-ink"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink/60 uppercase block mb-1.5">Intern Notes / Product Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe placement rules, brand caps, or audience targeting..."
                  value={newDineoutAd.description}
                  onChange={(e) => setNewDineoutAd({ ...newDineoutAd, description: e.target.value })}
                  className="w-full bg-paper-dark border border-line rounded-xl p-3 text-xs text-ink focus:outline-none focus:border-ink"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAddDineoutModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-ink/60 hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition-all"
                >
                  Save Ad Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TAB 3: EXECUTIVE PLAN SUMMARY ─────────────────────────────────────── */}
      {activeTab === "summary" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="card p-6 space-y-6 bg-paper-dark border-line">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider block">
                  Client Executive Strategy Report
                </span>
                <h2 className="text-xl font-bold text-ink">
                  {activeBrand.name} — {platform.toUpperCase()} Marketing Plan
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Saved & Verified
              </span>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-paper border border-line space-y-1">
                <span className="text-xs text-ink/50 font-medium">Target AOV</span>
                <div className="text-2xl font-extrabold text-ink font-mono">₹{aov}</div>
                <p className="text-[11px] text-ink/40">Baseline for primary discounts</p>
              </div>

              <div className="p-4 rounded-xl bg-paper border border-line space-y-1">
                <span className="text-xs text-ink/50 font-medium">Effective Discount Burn</span>
                <div className="text-2xl font-extrabold text-amber-400 font-mono">
                  {discountAutomation.overallEffectiveBurnPct}%
                </div>
                <p className="text-[11px] text-ink/40">Target Burn: {targetDiscountBurnPct}%</p>
              </div>

              <div className="p-4 rounded-xl bg-paper border border-line space-y-1">
                <span className="text-xs text-ink/50 font-medium">Recommended Total Ads Budget</span>
                <div className="text-2xl font-extrabold text-purple-400 font-mono">
                  {formatCurrency(adsResult.totalAdsAmount)}
                </div>
                <p className="text-[11px] text-ink/40">Based on {adsResult.modelName}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-paper border border-line space-y-2 text-xs">
              <span className="font-bold text-ink block">Strategic Executive Notes:</span>
              <ul className="list-disc pl-4 space-y-1 text-ink/70">
                <li>Primary Codes configuration deployed under {primaryOption === "option1" ? "Option 1 (All User + New User)" : "Option 2 (New User + Repeat User)"}.</li>
                <li>Stepper Code configured at Flat {flatOffChoices.map((amt) => `₹${amt}`).join(", ")} off on MOV ₹699 targeting {stepperSegregation === "la_mm_um" ? "LA, MM, UM" : "All Users (AU)"}.</li>
                <li>Grow Maxx Ad budget calculated via {adsResult.modelName} for {platform.toUpperCase()} with Base Ads allocation at {formatCurrency(adsResult.baseAdsAmount)}.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
