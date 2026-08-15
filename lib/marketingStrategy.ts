/**
 * Marketing Strategy Calculation Engine
 * Replicates 100% exact cell formulas from 'MARKETING PLAN' Excel sheet.
 */

export interface DineoutRowInput {
  id: string;
  day: string;
  mealTime: string;
  totalDiscount: number;
  cofunding?: number;
  covers: number;
}

export interface DineoutRowInput {
  id: string;
  day: string;
  mealTime: string;
  totalDiscount: number;
  cofunding?: number;
  mxBurn?: number;
  covers: number;
}

export interface DineoutStrategyConfig {
  mode: "detailed" | "simplified";
  discountBurnPct: number; // e.g. 15%
  detailedRows: DineoutRowInput[];
  simplifiedRows: DineoutRowInput[];
  walkInRow?: DineoutRowInput;
}

export function getDefaultDineoutConfig(): DineoutStrategyConfig {
  return {
    mode: "detailed",
    discountBurnPct: 15,
    detailedRows: [
      { id: "d1", day: "Mon To Fri", mealTime: "Lunch", totalDiscount: 30, cofunding: 5, mxBurn: 25, covers: 20 },
      { id: "d2", day: "Mon To Fri", mealTime: "Dinner", totalDiscount: 25, cofunding: 5, mxBurn: 20, covers: 20 },
      { id: "d3", day: "Sat to Sun", mealTime: "Lunch", totalDiscount: 20, cofunding: 5, mxBurn: 15, covers: 20 },
      { id: "d4", day: "Sat to Sun", mealTime: "Dinner", totalDiscount: 15, cofunding: 5, mxBurn: 10, covers: 20 },
    ],
    simplifiedRows: [
      { id: "s1", day: "Mon To Fri", mealTime: "All day", totalDiscount: 20, cofunding: 5, mxBurn: 15, covers: 20 },
      { id: "s2", day: "Sat to Sun", mealTime: "All day", totalDiscount: 15, cofunding: 5, mxBurn: 10, covers: 20 },
    ],
    walkInRow: {
      id: "w1",
      day: "Mon To Sun",
      mealTime: "All day",
      totalDiscount: 10,
      cofunding: 5,
      mxBurn: 5,
      covers: 20,
    },
  };
}

export function computeDineoutStrategy(config: DineoutStrategyConfig) {
  const baseBurn = typeof config.discountBurnPct === "number" && !isNaN(config.discountBurnPct) 
    ? Math.max(10, Math.round(config.discountBurnPct / 5) * 5)
    : 15;

  const isDetailed = config.mode === "detailed";
  const sourceRows = isDetailed 
    ? (config.detailedRows && config.detailedRows.length === 4 ? config.detailedRows : getDefaultDineoutConfig().detailedRows)
    : (config.simplifiedRows && config.simplifiedRows.length === 2 ? config.simplifiedRows : getDefaultDineoutConfig().simplifiedRows);

  const detailedOffsets = [15, 10, 5, 0];
  const simplifiedOffsets = [5, 0];
  const offsets = isDetailed ? detailedOffsets : simplifiedOffsets;

  const processedRows = sourceRows.map((r, idx) => {
    const offset = offsets[idx] !== undefined ? offsets[idx] : 0;
    const calcTotal = r.totalDiscount !== undefined && !isNaN(r.totalDiscount) 
      ? Math.max(5, r.totalDiscount) 
      : Math.max(10, Math.round((baseBurn + offset) / 5) * 5);
      
    const cofunding = typeof r.cofunding === "number" && !isNaN(r.cofunding) ? Math.max(0, r.cofunding) : 5;
    
    const mxBurn = r.mxBurn !== undefined && !isNaN(r.mxBurn) 
      ? Math.max(0, r.mxBurn) 
      : Math.max(0, calcTotal - cofunding);
      
    const covers = typeof r.covers === "number" && !isNaN(r.covers) ? Math.max(0, r.covers) : 20;

    return {
      ...r,
      totalDiscount: calcTotal,
      cofunding,
      mxBurn,
      covers,
    };
  });

  // Walk In Offers Row
  const lowestDiscount = processedRows.length > 0 ? Math.min(...processedRows.map((r) => r.totalDiscount)) : 15;
  const defaultWalkInDiscount = Math.max(5, Math.round((lowestDiscount - 5) / 5) * 5);

  const walkInSource = config.walkInRow || {
    id: "w1",
    day: "Mon To Sun",
    mealTime: "All day",
    totalDiscount: defaultWalkInDiscount,
    cofunding: 5,
    mxBurn: Math.max(0, defaultWalkInDiscount - 5),
    covers: 20,
  };

  const walkInTotalDiscount = walkInSource.totalDiscount !== undefined && !isNaN(walkInSource.totalDiscount) 
    ? Math.max(5, walkInSource.totalDiscount) 
    : defaultWalkInDiscount;
    
  const walkInCofunding = typeof walkInSource.cofunding === "number" && !isNaN(walkInSource.cofunding) ? Math.max(0, walkInSource.cofunding) : 5;
  
  const walkInMxBurn = walkInSource.mxBurn !== undefined && !isNaN(walkInSource.mxBurn) 
    ? Math.max(0, walkInSource.mxBurn) 
    : Math.max(0, walkInTotalDiscount - walkInCofunding);
    
  const walkInCovers = typeof walkInSource.covers === "number" && !isNaN(walkInSource.covers) ? Math.max(0, walkInSource.covers) : 20;

  const walkInProcessed = {
    id: "w1",
    category: "Walk In offers",
    day: walkInSource.day || "Mon To Sun",
    mealTime: walkInSource.mealTime || "All day",
    totalDiscount: walkInTotalDiscount,
    cofunding: walkInCofunding,
    mxBurn: walkInMxBurn,
    covers: walkInCovers,
  };

  // Compute Averages across all slots including Walk In
  const allDiscountRates = [...processedRows.map((r) => r.totalDiscount), walkInProcessed.totalDiscount];
  const avgDiscountBurn = Number((allDiscountRates.reduce((a, b) => a + b, 0) / allDiscountRates.length).toFixed(1));

  const allMxBurnRates = [...processedRows.map((r) => r.mxBurn), walkInProcessed.mxBurn];
  const avgMxBurn = Number((allMxBurnRates.reduce((a, b) => a + b, 0) / allMxBurnRates.length).toFixed(1));

  const totalCovers = processedRows.reduce((a, b) => a + b.covers, 0) + walkInProcessed.covers;

  return {
    mode: config.mode,
    discountBurnPct: baseBurn,
    rows: processedRows,
    walkIn: walkInProcessed,
    summary: {
      avgDiscountBurn,
      avgMxBurn,
      totalCovers,
    },
  };
}

export interface SwiggyAdProduct {
  id: string; // "cpc" | "cba" | "ul" | "top_picks"
  name: string;
  shortName: string;
  description: string;
  target: string; // "AU (All Users)"
  referenceNote: string;
  defaultWeight: number; // For AI allocation weighting
}

export const SWIGGY_AD_PRODUCTS: SwiggyAdProduct[] = [
  {
    id: "cpc",
    name: "CPC (Cost Per Clicks)",
    shortName: "CPC",
    description: "Pay per user click on restaurant ad listings",
    target: "AU (All Users)",
    referenceNote: "Performance-driven search & discovery clicks",
    defaultWeight: 50,
  },
  {
    id: "cba",
    name: "CBA (Brand on search — Cuisine Tag, Brand Level)",
    shortName: "CBA",
    description: "High visibility search banners for specific cuisines & brand keywords",
    target: "AU (All Users)",
    referenceNote: "Top search banner positioning",
    defaultWeight: 25,
  },
  {
    id: "ul",
    name: "Unlimited Clicks (UL)",
    shortName: "Unlimited Clicks",
    description: "Fixed monthly plan for uncapped user clicks",
    target: "AU (All Users)",
    referenceNote: "10% of GMV OR minimum ₹5000 budget",
    defaultWeight: 15,
  },
  {
    id: "top_picks",
    name: "Top Picks - item wise",
    shortName: "Top Picks",
    description: "Highlights top menu dishes directly on search & home feed",
    target: "AU (All Users)",
    referenceNote: "150 per item / month",
    defaultWeight: 10,
  },
];

export interface SwiggyAdsConfig {
  mode: "tryout" | "no_tryout";
  tryoutPct: number; // e.g. 10%
  gmv: number; // e.g. 100000
  baseAdsAmount: number; // e.g. 10000
  selectedProductIds: string[]; // e.g. ["cpc", "cba", "top_picks"]
}

export interface SwiggyAdsSplitItem {
  id: string;
  name: string;
  shortName: string;
  target: string;
  referenceNote: string;
  allocatedBudget: number;
  percentage: number;
}

export interface SwiggyAdsResult {
  mode: "tryout" | "no_tryout";
  totalAdsBudget: number;
  selectedProducts: SwiggyAdProduct[];
  split: SwiggyAdsSplitItem[];
}

export function getDefaultSwiggyAdsConfig(): SwiggyAdsConfig {
  return {
    mode: "tryout",
    tryoutPct: 10,
    gmv: 100000,
    baseAdsAmount: 10000,
    selectedProductIds: ["cpc", "cba", "top_picks"],
  };
}

export function computeSwiggyAdsStrategy(config: SwiggyAdsConfig): SwiggyAdsResult {
  const mode = config.mode || "tryout";
  
  let totalAdsBudget = 0;
  if (mode === "tryout") {
    const pct = Math.max(0, config.tryoutPct || 0);
    const gmvVal = Math.max(0, config.gmv || 0);
    totalAdsBudget = Math.round((gmvVal * pct) / 100);
  } else {
    totalAdsBudget = Math.max(0, Math.round(config.baseAdsAmount || 0));
  }

  const selectedIds = config.selectedProductIds && config.selectedProductIds.length > 0 
    ? config.selectedProductIds 
    : ["cpc"];

  const selectedProducts = SWIGGY_AD_PRODUCTS.filter((p) => selectedIds.includes(p.id));

  // Compute AI intelligent budget distribution
  const totalWeight = selectedProducts.reduce((sum, p) => sum + p.defaultWeight, 0);

  let remaining = totalAdsBudget;
  const split: SwiggyAdsSplitItem[] = selectedProducts.map((p, idx) => {
    let amount = 0;
    if (idx === selectedProducts.length - 1) {
      amount = remaining;
    } else {
      const weightRatio = totalWeight > 0 ? p.defaultWeight / totalWeight : 1 / selectedProducts.length;
      amount = Math.round(totalAdsBudget * weightRatio);
      remaining -= amount;
    }

    const pct = totalAdsBudget > 0 ? Number(((amount / totalAdsBudget) * 100).toFixed(1)) : 0;

    return {
      id: p.id,
      name: p.name,
      shortName: p.shortName,
      target: p.target,
      referenceNote: p.referenceNote,
      allocatedBudget: amount,
      percentage: pct,
    };
  });

  return {
    mode,
    totalAdsBudget,
    selectedProducts,
    split,
  };
}

export interface BrandMarketingStrategyData {
  brandId: string;
  brandName?: string;
  channel?: "delivery" | "dineout";
  platform: "zomato" | "swiggy";
  location: string;
  targetDiscountBurnPct: number;
  aov: number;
  totalOrders: number;
  laPct: number;
  mmPct: number;
  umPct: number;
  primaryOption: "single_new" | "single_repeat" | "single_all" | "single_radius" | "option1" | "option2";
  stepperSegregation: "la_mm_um" | "au";
  flatOffChoice?: 100 | 125 | 150 | 175 | 200;
  flatOffChoices?: number[];
  partyCodesEnabled: boolean;
  dineoutConfig?: DineoutStrategyConfig;
  swiggyAdsConfig?: SwiggyAdsConfig;
  selectedAdsModel: "M1" | "M2" | "M3" | "SGM";
  baselineCV: number;
  totalSales: number;
  subtotalSales: number;
  rateX: number;
  rateY: number;
  baseAdsAmount: number;
  updatedAt?: string;
}

export interface DiscountCodeRule {
  id: string;
  name: string;
  userType: "New User" | "Repeat User" | "All User" | "Radius 4km" | "Tier 5" | "Tier 6";
  type: "primary" | "stepper" | "party";
  percentage?: number;
  discountCap: number; // Flat amount for stepper, or Max cap for primary
  mov: number;
  burnPct: number;
  segmentTarget: string;
  formulaNote: string;
}

export interface EmployeeDiscountInputs {
  channel?: "delivery" | "dineout";
  targetDiscountBurnPct: number; // e.g. 20%
  aov: number; // e.g. 699
  totalOrders: number; // e.g. 100
  laPct: number; // e.g. 60
  mmPct: number; // e.g. 10
  umPct: number; // e.g. 30
  primaryOption: "single_new" | "single_repeat" | "single_all" | "single_radius" | "option1" | "option2";
  stepperSegregation: "la_mm_um" | "au";
  flatOffChoice?: 100 | 125 | 150 | 175 | 200;
  flatOffChoices?: number[];
  partyCodesEnabled: boolean;
}

export interface EmployeeDiscountAutomationResult {
  selectedPrimaryCodes: DiscountCodeRule[];
  selectedStepperCode: DiscountCodeRule;
  selectedStepperCodes: DiscountCodeRule[];
  selectedPartyCode?: DiscountCodeRule;
  primaryAvgBurn: number;
  stepperBurn: number;
  partyBurn: number;
  overallEffectiveBurnPct: number;
  targetCompliance: boolean; // overallEffectiveBurnPct <= targetDiscountBurnPct
  recommendationMessage: string;
}

export interface AdsModelInputs {
  platform: "zomato" | "swiggy";
  baselineCV: number;
  totalSales: number;
  subtotal: number;
  rateX: number; // e.g. 0.10 for 10%
  rateY: number; // e.g. 0.20 for 20%
  baseAdsAmount: number;
  selectedPlacements?: string[];
}

export interface AdsModelResult {
  modelName: string;
  adsXName: string;
  adsXAmount: number;
  adsXFormula: string;
  adsYName?: string;
  adsYAmount?: number;
  adsYFormula?: string;
  totalAdsAmount: number;
  totalAdsFormula: string;
  baseAdsAmount: number;
  growMaxxAdsAmount: number;
  baseAdsValid: boolean; // baseAds <= growMaxxAds
  baseAdsBreakdown: Record<string, { name: string; target: string; amount: number; pct: number }>;
}

// ── 1. DISCOUNTING CALCULATIONS ─────────────────────────────────────────────

export interface PrimaryTierDefinition {
  percentage: number;
  uptoCap: number;
  defaultMov: number;
}

export const STANDARD_PRIMARY_TIERS: PrimaryTierDefinition[] = [
  { percentage: 60, uptoCap: 120, defaultMov: 199 },
  { percentage: 50, uptoCap: 100, defaultMov: 199 },
  { percentage: 40, uptoCap: 80, defaultMov: 199 },
  { percentage: 30, uptoCap: 75, defaultMov: 199 },
  { percentage: 20, uptoCap: 50, defaultMov: 199 },
  { percentage: 10, uptoCap: 40, defaultMov: 199 },
];

export function calculatePrimaryCodeBurn(percentage: number, uptoCap: number, aov: number): number {
  const safeAov = Math.max(1, aov);
  const actualDiscount = Math.min(uptoCap, safeAov * (percentage / 100));
  return Number(((actualDiscount / safeAov) * 100).toFixed(2));
}

export function getPrimaryDiscountCodes(aov: number = 699, targetBurnPct: number = 20): DiscountCodeRule[] {
  const safeAov = Math.max(1, aov);

  return [
    {
      id: "p1",
      name: `60% upto ₹120 on ₹199`,
      userType: "New User",
      type: "primary",
      percentage: 60,
      discountCap: 120,
      mov: 199,
      burnPct: calculatePrimaryCodeBurn(60, 120, safeAov),
      segmentTarget: "New User (60% upto ₹120)",
      formulaNote: "min(120, AOV * 0.60) / AOV * 100",
    },
    {
      id: "p2",
      name: `50% upto ₹100 on ₹199`,
      userType: "Repeat User",
      type: "primary",
      percentage: 50,
      discountCap: 100,
      mov: 199,
      burnPct: calculatePrimaryCodeBurn(50, 100, safeAov),
      segmentTarget: "Repeat User (50% upto ₹100)",
      formulaNote: "min(100, AOV * 0.50) / AOV * 100",
    },
    {
      id: "p3",
      name: `40% upto ₹80 on ₹199`,
      userType: "All User",
      type: "primary",
      percentage: 40,
      discountCap: 80,
      mov: 199,
      burnPct: calculatePrimaryCodeBurn(40, 80, safeAov),
      segmentTarget: "All Users (40% upto ₹80)",
      formulaNote: "min(80, AOV * 0.40) / AOV * 100",
    },
    {
      id: "p4",
      name: `30% upto ₹75 on ₹199`,
      userType: "All User",
      type: "primary",
      percentage: 30,
      discountCap: 75,
      mov: 199,
      burnPct: calculatePrimaryCodeBurn(30, 75, safeAov),
      segmentTarget: "30% upto ₹75 Code",
      formulaNote: "min(75, AOV * 0.30) / AOV * 100",
    },
    {
      id: "p5",
      name: `20% upto ₹50 on ₹199`,
      userType: "All User",
      type: "primary",
      percentage: 20,
      discountCap: 50,
      mov: 199,
      burnPct: calculatePrimaryCodeBurn(20, 50, safeAov),
      segmentTarget: "20% upto ₹50 Code",
      formulaNote: "min(50, AOV * 0.20) / AOV * 100",
    },
    {
      id: "p6",
      name: `10% upto ₹40 on ₹199`,
      userType: "All User",
      type: "primary",
      percentage: 10,
      discountCap: 40,
      mov: 199,
      burnPct: calculatePrimaryCodeBurn(10, 40, safeAov),
      segmentTarget: "10% upto ₹40 Code",
      formulaNote: "min(40, AOV * 0.10) / AOV * 100",
    },
  ];
}

const STANDARD_MOVS = [199, 299, 399, 499, 599, 699, 799, 899, 999, 1199, 1499, 1999];

export function getStepperDiscountCodes(aov: number = 699, targetBurnPct: number = 20): DiscountCodeRule[] {
  const safeAov = Math.max(1, aov);
  const safeTargetBurn = Math.max(5, Math.min(60, targetBurnPct || 20)) / 100; // e.g. 0.30 for 30%

  // Snap to closest standard Swiggy/Zomato MOV threshold ending in 99
  const calcMov = (cap: number, laFactor: number = 1.0) => {
    const rawMov = (cap / safeTargetBurn) * laFactor;
    let closest = STANDARD_MOVS[0];
    let minDiff = Math.abs(rawMov - closest);
    for (const movVal of STANDARD_MOVS) {
      const diff = Math.abs(rawMov - movVal);
      if (diff < minDiff) {
        minDiff = diff;
        closest = movVal;
      }
    }
    return closest;
  };

  const mov100_la = calcMov(100, 0.85);
  const mov100_mm = calcMov(100, 1.0);
  const mov125_la = calcMov(125, 0.85);
  const mov125_mm = calcMov(125, 1.0);
  const mov150_la = calcMov(150, 0.85);
  const mov150_mm = calcMov(150, 1.0);
  const mov175_la = calcMov(175, 0.85);
  const mov175_mm = calcMov(175, 1.0);
  const mov200_la = calcMov(200, 0.85);
  const mov200_mm = calcMov(200, 1.0);

  return [
    {
      id: "s1_la",
      name: `Flat ₹100 off on ₹${mov100_la}`,
      userType: "All User",
      type: "stepper",
      discountCap: 100,
      mov: mov100_la,
      burnPct: Number(((100 / mov100_la) * 100).toFixed(2)),
      segmentTarget: "Less Affluent (LA) - Most Discount Centric",
      formulaNote: `Flat Discount / MOV * 100 = 100 / ${mov100_la} * 100`,
    },
    {
      id: "s1_mm",
      name: `Flat ₹100 off on ₹${mov100_mm}`,
      userType: "All User",
      type: "stepper",
      discountCap: 100,
      mov: mov100_mm,
      burnPct: Number(((100 / mov100_mm) * 100).toFixed(2)),
      segmentTarget: "Middle Market (MM) - Neutral to Discount",
      formulaNote: `Flat Discount / MOV * 100 = 100 / ${mov100_mm} * 100`,
    },
    {
      id: "s2_la",
      name: `Flat ₹125 off on ₹${mov125_la}`,
      userType: "All User",
      type: "stepper",
      discountCap: 125,
      mov: mov125_la,
      burnPct: Number(((125 / mov125_la) * 100).toFixed(2)),
      segmentTarget: "Less Affluent (LA) - Flat 125",
      formulaNote: `Flat Discount / MOV * 100 = 125 / ${mov125_la} * 100`,
    },
    {
      id: "s2_mm",
      name: `Flat ₹125 off on ₹${mov125_mm}`,
      userType: "All User",
      type: "stepper",
      discountCap: 125,
      mov: mov125_mm,
      burnPct: Number(((125 / mov125_mm) * 100).toFixed(2)),
      segmentTarget: "Middle Market (MM) - Flat 125",
      formulaNote: `Flat Discount / MOV * 100 = 125 / ${mov125_mm} * 100`,
    },
    {
      id: "s3_la",
      name: `Flat ₹150 off on ₹${mov150_la}`,
      userType: "All User",
      type: "stepper",
      discountCap: 150,
      mov: mov150_la,
      burnPct: Number(((150 / mov150_la) * 100).toFixed(2)),
      segmentTarget: "Upper Market (UM) - Flat 150 LA",
      formulaNote: `Flat Discount / MOV * 100 = 150 / ${mov150_la} * 100`,
    },
    {
      id: "s3_mm",
      name: `Flat ₹150 off on ₹${mov150_mm}`,
      userType: "All User",
      type: "stepper",
      discountCap: 150,
      mov: mov150_mm,
      burnPct: Number(((150 / mov150_mm) * 100).toFixed(2)),
      segmentTarget: "Upper Market (UM) - Flat 150 MM",
      formulaNote: `Flat Discount / MOV * 100 = 150 / ${mov150_mm} * 100`,
    },
    {
      id: "s4_la",
      name: `Flat ₹175 off on ₹${mov175_la}`,
      userType: "All User",
      type: "stepper",
      discountCap: 175,
      mov: mov175_la,
      burnPct: Number(((175 / mov175_la) * 100).toFixed(2)),
      segmentTarget: "Upper Market (UM) - Flat 175 LA",
      formulaNote: `Flat Discount / MOV * 100 = 175 / ${mov175_la} * 100`,
    },
    {
      id: "s4_mm",
      name: `Flat ₹175 off on ₹${mov175_mm}`,
      userType: "All User",
      type: "stepper",
      discountCap: 175,
      mov: mov175_mm,
      burnPct: Number(((175 / mov175_mm) * 100).toFixed(2)),
      segmentTarget: "Upper Market (UM) - Flat 175 MM",
      formulaNote: `Flat Discount / MOV * 100 = 175 / ${mov175_mm} * 100`,
    },
    {
      id: "s5_la",
      name: `Flat ₹200 off on ₹${mov200_la}`,
      userType: "All User",
      type: "stepper",
      discountCap: 200,
      mov: mov200_la,
      burnPct: Number(((200 / mov200_la) * 100).toFixed(2)),
      segmentTarget: "Upper Market (UM) - Flat 200 LA",
      formulaNote: `Flat Discount / MOV * 100 = 200 / ${mov200_la} * 100`,
    },
    {
      id: "s5_mm",
      name: `Flat ₹200 off on ₹${mov200_mm}`,
      userType: "All User",
      type: "stepper",
      discountCap: 200,
      mov: mov200_mm,
      burnPct: Number(((200 / mov200_mm) * 100).toFixed(2)),
      segmentTarget: "Upper Market (UM) - Flat 200 MM",
      formulaNote: `Flat Discount / MOV * 100 = 200 / ${mov200_mm} * 100`,
    },
  ];
}

export function getPartyDiscountCodes(): DiscountCodeRule[] {
  return [
    {
      id: "party1",
      name: "Flat 10% off on ₹999",
      userType: "All User",
      type: "party",
      percentage: 10,
      discountCap: 100,
      mov: 999,
      burnPct: 10.0,
      segmentTarget: "High Value / Group Orders (Party Code)",
      formulaNote: "Flat 10% on Minimum Order Value ₹999",
    },
  ];
}

// ── EMPLOYEE DISCOUNT AUTOMATION ENGINE ────────────────────────────────────

export function computeEmployeeDiscountAutomation(
  inputs: EmployeeDiscountInputs
): EmployeeDiscountAutomationResult {
  const {
    targetDiscountBurnPct,
    aov,
    primaryOption,
    stepperSegregation,
    flatOffChoice,
    flatOffChoices,
    partyCodesEnabled,
  } = inputs;

  const allPrimary = getPrimaryDiscountCodes(aov, targetDiscountBurnPct);
  const allStepper = getStepperDiscountCodes(aov, targetDiscountBurnPct);
  const allParty = getPartyDiscountCodes();

  // Determine active flat off choices list (array)
  const activeChoices: number[] =
    flatOffChoices && flatOffChoices.length > 0
      ? flatOffChoices
      : flatOffChoice
      ? [flatOffChoice]
      : [125];

  // 1. Select Primary Codes based on Employee Option (Single vs Dual)
  let selectedPrimaryCodes: DiscountCodeRule[] = [];
  if (primaryOption === "single_new") {
    selectedPrimaryCodes = [allPrimary[0]];
  } else if (primaryOption === "single_repeat") {
    selectedPrimaryCodes = [allPrimary[1]];
  } else if (primaryOption === "single_all") {
    selectedPrimaryCodes = [allPrimary[2]];
  } else if (primaryOption === "single_radius") {
    selectedPrimaryCodes = [allPrimary[3]];
  } else if (primaryOption === "option2") {
    selectedPrimaryCodes = [allPrimary[0], allPrimary[1]];
  } else {
    selectedPrimaryCodes = [allPrimary[2], allPrimary[0]];
  }

  const primaryAvgBurn = Number(
    (
      selectedPrimaryCodes.reduce((acc, curr) => acc + curr.burnPct, 0) /
      selectedPrimaryCodes.length
    ).toFixed(2)
  );

  // 2. Select Stepper Codes based on active choices (Multi-select)
  let rawStepperCodes = allStepper.filter((s) => activeChoices.includes(s.discountCap));
  if (rawStepperCodes.length === 0) {
    rawStepperCodes = [allStepper[2]]; // default fallback
  }

  // Deduplicate identical code names so identical MOVs don't repeat
  let selectedStepperCodes = rawStepperCodes.filter((c, idx, self) =>
    idx === self.findIndex((t) => t.name === c.name)
  );

  if (stepperSegregation === "au") {
    // In AU (All User) mode, keep ONLY 1 code per discountCap (standard MM code)
    selectedStepperCodes = selectedStepperCodes.filter((c, idx, self) =>
      idx === self.findIndex((t) => t.discountCap === c.discountCap && t.id.endsWith("_mm"))
    ).map((sc) => ({
      ...sc,
      segmentTarget: "All User (AU) - Universal Stepper Code",
    }));
  }

  const stepperBurnSum = selectedStepperCodes.reduce((acc, curr) => acc + curr.burnPct, 0);
  const stepperBurn = Number((stepperBurnSum / selectedStepperCodes.length).toFixed(2));
  const selectedStepperCode = selectedStepperCodes[0];

  // 3. Party Code
  const selectedPartyCode = partyCodesEnabled ? allParty[0] : undefined;
  const partyBurn = selectedPartyCode ? selectedPartyCode.burnPct : 0;

  // 4. Overall Weighted Effective Burn % Calculation
  const codeCount = selectedPrimaryCodes.length + selectedStepperCodes.length + (selectedPartyCode ? 1 : 0);
  const totalBurnSum =
    selectedPrimaryCodes.reduce((acc, curr) => acc + curr.burnPct, 0) +
    stepperBurnSum +
    partyBurn;

  const overallEffectiveBurnPct = Number((totalBurnSum / codeCount).toFixed(2));
  const targetCompliance = overallEffectiveBurnPct <= targetDiscountBurnPct;

  let recommendationMessage = "";
  if (targetCompliance) {
    recommendationMessage = `Optimal discount configuration! Effective burn of ${overallEffectiveBurnPct}% is within employee target limit of ${targetDiscountBurnPct}%.`;
  } else {
    recommendationMessage = `Warning: Effective burn of ${overallEffectiveBurnPct}% exceeds employee target limit of ${targetDiscountBurnPct}%. Consider switching to Option 1 or a lower Flat Off tier (e.g. ₹100 or ₹125).`;
  }

  return {
    selectedPrimaryCodes,
    selectedStepperCode,
    selectedStepperCodes,
    selectedPartyCode,
    primaryAvgBurn,
    stepperBurn,
    partyBurn,
    overallEffectiveBurnPct,
    targetCompliance,
    recommendationMessage,
  };
}

// ── 2. ADS BUDGET CALCULATIONS (100% EXCEL CELL FORMULAS) ───────────────────

export function calculateAdsModelM1(inputs: AdsModelInputs): AdsModelResult {
  const { totalSales, rateX, baseAdsAmount, selectedPlacements } = inputs;
  const safeRateX = Math.abs(rateX);
  const safeSales = Math.max(0, totalSales);

  const totalAdsAmount = Number((safeSales * safeRateX).toFixed(2));

  return buildAdsResult({
    modelName: "Model M1 (Grow Maxx CV)",
    adsXName: "Ads through Previous CV",
    adsXAmount: totalAdsAmount,
    adsXFormula: `Previous CV (₹${safeSales.toLocaleString("en-IN")}) × ${(safeRateX * 100).toFixed(0)}%`,
    totalAdsAmount,
    totalAdsFormula: `Previous CV × Rate = ₹${safeSales.toLocaleString("en-IN")} × ${(safeRateX * 100).toFixed(0)}%`,
    baseAdsAmount: Math.max(0, baseAdsAmount),
    growMaxxAdsAmount: totalAdsAmount,
    selectedPlacements,
  });
}

export function calculateAdsModelM2(inputs: AdsModelInputs): AdsModelResult {
  const { baselineCV, totalSales, rateX, rateY, baseAdsAmount, selectedPlacements } = inputs;

  const safeRateX = Math.abs(rateX);
  const safeRateY = Math.abs(rateY);
  const safeBaseline = Math.max(0, baselineCV);
  const safeSales = Math.max(0, totalSales);

  // Baseline X Ads
  const adsXAmount = Number((safeBaseline * safeRateX).toFixed(2));
  
  // Incremental Y Ads
  const growthAmount = Math.max(0, safeSales - safeBaseline);
  const adsYAmount = Number((growthAmount * safeRateY).toFixed(2));

  // Total Ads = Ads X + Ads Y
  const totalAdsAmount = Number((adsXAmount + adsYAmount).toFixed(2));

  return buildAdsResult({
    modelName: "Model M2 (Tiered Baseline + Growth)",
    adsXName: "Ads through Baseline CV",
    adsXAmount,
    adsXFormula: `Baseline CV (₹${safeBaseline.toLocaleString("en-IN")}) × ${(safeRateX * 100).toFixed(0)}%`,
    adsYName: "Ads through Incremental Growth",
    adsYAmount,
    adsYFormula: `Incremental Growth (₹${growthAmount.toLocaleString("en-IN")}) × ${(safeRateY * 100).toFixed(0)}%`,
    totalAdsAmount,
    totalAdsFormula: `Baseline Ads (₹${adsXAmount.toLocaleString("en-IN")}) + Growth Ads (₹${adsYAmount.toLocaleString("en-IN")})`,
    baseAdsAmount: Math.max(0, baseAdsAmount),
    growMaxxAdsAmount: totalAdsAmount,
    selectedPlacements,
  });
}

export function calculateAdsModelM3(inputs: AdsModelInputs): AdsModelResult {
  const { subtotal, rateX, selectedPlacements } = inputs;
  const safeRateX = Math.abs(rateX);
  const safeSubtotal = Math.max(0, subtotal);

  const totalAdsAmount = Number((safeSubtotal * safeRateX).toFixed(2));

  return buildAdsResult({
    modelName: "Model M3 (Subtotal Grow Maxx)",
    adsXName: "Ads through Total Sales",
    adsXAmount: totalAdsAmount,
    adsXFormula: `Total Sales (₹${safeSubtotal.toLocaleString("en-IN")}) × ${(safeRateX * 100).toFixed(0)}%`,
    totalAdsAmount,
    totalAdsFormula: `Total Sales × Rate = ₹${safeSubtotal.toLocaleString("en-IN")} × ${(safeRateX * 100).toFixed(0)}%`,
    baseAdsAmount: 0,
    growMaxxAdsAmount: totalAdsAmount,
    selectedPlacements,
  });
}

export function calculateAdsModelSGM(inputs: AdsModelInputs): AdsModelResult {
  const { totalSales, rateX, baseAdsAmount, selectedPlacements } = inputs;
  const safeRateX = Math.abs(rateX);
  const safeSales = Math.max(0, totalSales);

  const totalAdsAmount = Number((safeSales * safeRateX).toFixed(2));

  return buildAdsResult({
    modelName: "Model SGM (Singular Grow Maxx)",
    adsXName: "Singular Grow Maxx Ads",
    adsXAmount: totalAdsAmount,
    adsXFormula: `Total Sales (₹${safeSales.toLocaleString("en-IN")}) × ${(safeRateX * 100).toFixed(0)}%`,
    totalAdsAmount,
    totalAdsFormula: `Total Sales × Rate = ₹${safeSales.toLocaleString("en-IN")} × ${(safeRateX * 100).toFixed(0)}%`,
    baseAdsAmount: Math.max(0, baseAdsAmount),
    growMaxxAdsAmount: totalAdsAmount,
    selectedPlacements,
  });
}

function buildAdsResult(params: {
  modelName: string;
  adsXName: string;
  adsXAmount: number;
  adsXFormula: string;
  adsYName?: string;
  adsYAmount?: number;
  adsYFormula?: string;
  totalAdsAmount: number;
  totalAdsFormula?: string;
  baseAdsAmount?: number;
  growMaxxAdsAmount?: number;
  selectedPlacements?: string[];
}): AdsModelResult {
  const baseAdsAmount = params.baseAdsAmount ?? 0;
  const growMaxxAdsAmount = params.growMaxxAdsAmount ?? params.totalAdsAmount;
  const selectedPlacements = params.selectedPlacements;
  const baseAdsValid = baseAdsAmount <= growMaxxAdsAmount;

  const defaultPlacementSpecs: Record<string, { name: string; target: string; weight: number }> = {
    gvp: { name: "General Visit Pack (GVP)", target: "All Users (AU)", weight: 25 },
    psp: { name: "Promoted Smart Placement (PSP)", target: "Target UM -> MM -> LA", weight: 30 },
    spendingPotential: { name: "Spending Potential", target: "Target Upper Market (UM) Only", weight: 20 },
    boss: { name: "BOSS (Brand Overall Search Slot)", target: "Cuisine Tag Placement", weight: 15 },
    bigBoss: { name: "BIG BOSS", target: "Brand Tag Placement", weight: 10 },
    dishPsp: { name: "Dish PSP", target: "Click-based dish placement", weight: 0 },
  };

  const activeKeys = selectedPlacements && selectedPlacements.length > 0 
    ? selectedPlacements 
    : Object.keys(defaultPlacementSpecs);

  const totalSelectedWeight = activeKeys.reduce((sum, key) => {
    const spec = defaultPlacementSpecs[key];
    return sum + (spec ? spec.weight : 0);
  }, 0);

  const breakdown: Record<string, { name: string; target: string; amount: number; pct: number }> = {};

  Object.keys(defaultPlacementSpecs).forEach((key) => {
    const spec = defaultPlacementSpecs[key];
    const isSelected = activeKeys.includes(key);

    if (isSelected) {
      let pct = 0;
      let amount = 0;
      if (totalSelectedWeight > 0) {
        pct = Number(((spec.weight / totalSelectedWeight) * 100).toFixed(1));
        amount = Math.round(baseAdsAmount * (spec.weight / totalSelectedWeight));
      } else {
        pct = Number((100 / activeKeys.length).toFixed(1));
        amount = Math.round(baseAdsAmount / activeKeys.length);
      }
      breakdown[key] = {
        name: spec.name,
        target: spec.target,
        amount,
        pct,
      };
    } else {
      breakdown[key] = {
        name: spec.name,
        target: spec.target,
        amount: 0,
        pct: 0,
      };
    }
  });

  return {
    ...params,
    totalAdsFormula: params.totalAdsFormula || "",
    baseAdsAmount,
    growMaxxAdsAmount,
    baseAdsValid,
    baseAdsBreakdown: breakdown,
  };
}
