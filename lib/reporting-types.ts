export type ReportPlatform = "zomato" | "swiggy";
export type ReportType = "delivery" | "dinein";

export type SectionKey =
  | "zomato_delivery"
  | "swiggy_delivery"
  | "overall_delivery"
  | "zomato_dinein"
  | "swiggy_dineout"
  | "overall_dineout";

export interface BasePeriodMetrics {
  id: string;
  brandId?: string;
  section: SectionKey;
  platform: ReportPlatform;
  type: ReportType;
  periodLabel: string; // e.g., "July 20", "1-10 Aug '26", "May"
  startDate?: string;
  endDate?: string;
  updatedAt: string;
  rawInput?: Record<string, any>;
}

export interface ZomatoDeliveryMetrics extends BasePeriodMetrics {
  section: "zomato_delivery";
  orders: number;
  subTotal: number;
  packagingCharges: number;
  subTotalWithPkg: number;
  cancelledOrderRefund: number;
  discount: number;
  discountPct: number;
  commissionableValue: number;
  orderLevelDeduction: number;
  taxDeduction: number;
  ads: number;
  adsPct: number;
  hyperpure: number;
  netPayout: number;
  netPayoutWithHyperpure: number;
  netPayoutPct: number;
  overallBurnPct: number;
}

export interface SwiggyDeliveryMetrics extends BasePeriodMetrics {
  section: "swiggy_delivery";
  orders: number;
  subTotal: number;
  packagingCharges: number;
  subTotalWithPkg: number;
  discount: number;
  discountPct: number;
  commissionableValue: number;
  comPgGst: number;
  complaintsCancellation: number;
  tax: number;
  ads: number;
  adsPct: number;
  netPayout: number;
  netPayoutPct: number;
  overallBurnPct: number;
}

export interface ZomatoDineInMetrics extends BasePeriodMetrics {
  section: "zomato_dinein";
  transactions: number;
  preGmv: number;
  postGmv: number;
  discount: number;
  discountPct: number;
  commission: number;
  commissionPct: number;
  ads: number;
  netPayout: number;
  netPayoutPct: number;
  overallBurnPct: number;
}

export interface SwiggyDineoutMetrics extends BasePeriodMetrics {
  section: "swiggy_dineout";
  transactions: number;
  preGmv: number;
  postGmv: number;
  discount: number;
  discountPct: number;
  commission: number;
  commissionPct: number;
  ads: number;
  netPayout: number;
  netPayoutPct: number;
  overallBurnPct: number;
}

export type AnyPeriodMetrics =
  | ZomatoDeliveryMetrics
  | SwiggyDeliveryMetrics
  | ZomatoDineInMetrics
  | SwiggyDineoutMetrics;

export interface ReportingStore {
  zomato_delivery: ZomatoDeliveryMetrics[];
  swiggy_delivery: SwiggyDeliveryMetrics[];
  zomato_dinein: ZomatoDineInMetrics[];
  swiggy_dineout: SwiggyDineoutMetrics[];
}

export function computeZomatoDelivery(
  input: Partial<ZomatoDeliveryMetrics> & { periodLabel: string }
): ZomatoDeliveryMetrics {
  const orders = Number(input.orders || 0);
  const subTotal = Number(input.subTotal || 0);
  const packagingCharges = Number(input.packagingCharges || 0);
  const subTotalWithPkg =
    input.subTotalWithPkg !== undefined && input.subTotalWithPkg !== 0
      ? Number(input.subTotalWithPkg)
      : subTotal + packagingCharges;

  const cancelledOrderRefund = Number(input.cancelledOrderRefund || 0);
  const discount = Number(input.discount || 0);
  const discountPct =
    subTotalWithPkg > 0 ? Number(((discount / subTotalWithPkg) * 100).toFixed(2)) : 0;

  const commissionableValue = Number(input.commissionableValue || 0);
  const orderLevelDeduction = Number(input.orderLevelDeduction || 0);
  const taxDeduction = Number(input.taxDeduction || 0);
  const ads = Number(input.ads || 0);
  const adsPct =
    subTotalWithPkg > 0 ? Number(((ads / subTotalWithPkg) * 100).toFixed(2)) : 0;

  const hyperpure = Number(input.hyperpure || 0);
  const netPayout = Number(input.netPayout || 0);
  const netPayoutWithHyperpure = netPayout + hyperpure;
  const netPayoutPct =
    subTotalWithPkg > 0
      ? Number(((netPayout / subTotalWithPkg) * 100).toFixed(2))
      : 0;
  const overallBurnPct = Number((100 - netPayoutPct).toFixed(2));

  return {
    id: input.id || `zd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    brandId: input.brandId,
    section: "zomato_delivery",
    platform: "zomato",
    type: "delivery",
    periodLabel: input.periodLabel,
    startDate: input.startDate,
    endDate: input.endDate,
    updatedAt: new Date().toISOString(),
    rawInput: input.rawInput,
    orders,
    subTotal,
    packagingCharges,
    subTotalWithPkg,
    cancelledOrderRefund,
    discount,
    discountPct,
    commissionableValue,
    orderLevelDeduction,
    taxDeduction,
    ads,
    adsPct,
    hyperpure,
    netPayout,
    netPayoutWithHyperpure,
    netPayoutPct,
    overallBurnPct,
  };
}

export function computeSwiggyDelivery(
  input: Partial<SwiggyDeliveryMetrics> & { periodLabel: string }
): SwiggyDeliveryMetrics {
  const orders = Number(input.orders || 0);
  const subTotal = Number(input.subTotal || 0);
  const packagingCharges = Number(input.packagingCharges || 0);
  const subTotalWithPkg =
    input.subTotalWithPkg !== undefined && input.subTotalWithPkg !== 0
      ? Number(input.subTotalWithPkg)
      : subTotal + packagingCharges;

  const discount = Number(input.discount || 0);
  const discountPct =
    subTotalWithPkg > 0 ? Number(((discount / subTotalWithPkg) * 100).toFixed(2)) : 0;

  const commissionableValue = Number(input.commissionableValue || 0);
  const comPgGst = Number(input.comPgGst || 0);
  const complaintsCancellation = Number(input.complaintsCancellation || 0);
  const tax = Number(input.tax || 0);
  const ads = Number(input.ads || 0);
  const baseForAds = subTotal > 0 ? subTotal : subTotalWithPkg;
  const adsPct =
    baseForAds > 0 ? Number(((ads / baseForAds) * 100).toFixed(2)) : 0;

  const netPayout = Number(input.netPayout || 0);
  const netPayoutPct =
    subTotalWithPkg > 0
      ? Number(((netPayout / subTotalWithPkg) * 100).toFixed(2))
      : 0;
  const overallBurnPct = Number((100 - netPayoutPct).toFixed(2));

  return {
    id: input.id || `sd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    brandId: input.brandId,
    section: "swiggy_delivery",
    platform: "swiggy",
    type: "delivery",
    periodLabel: input.periodLabel,
    startDate: input.startDate,
    endDate: input.endDate,
    updatedAt: new Date().toISOString(),
    rawInput: input.rawInput,
    orders,
    subTotal,
    packagingCharges,
    subTotalWithPkg,
    discount,
    discountPct,
    commissionableValue,
    comPgGst,
    complaintsCancellation,
    tax,
    ads,
    adsPct,
    netPayout,
    netPayoutPct,
    overallBurnPct,
  };
}

export function computeZomatoDineIn(
  input: Partial<ZomatoDineInMetrics> & { periodLabel: string }
): ZomatoDineInMetrics {
  const transactions = Number(input.transactions || 0);
  const preGmv = Number(input.preGmv || 0);
  const discount = Number(input.discount || 0);
  const postGmv =
    input.postGmv !== undefined && input.postGmv !== 0
      ? Number(input.postGmv)
      : preGmv - discount;

  const discountPct =
    preGmv > 0 ? Number(((discount / preGmv) * 100).toFixed(2)) : 0;

  const commission = Number(input.commission || 0);
  const commissionPct =
    postGmv > 0 ? Number(((commission / postGmv) * 100).toFixed(2)) : 0;

  const ads = Number(input.ads || 0);
  const netPayout = Number((postGmv - commission - ads).toFixed(2));

  const netPayoutPct =
    preGmv > 0 ? Number(((netPayout / preGmv) * 100).toFixed(2)) : 0;
  const overallBurnPct = Number((100 - netPayoutPct).toFixed(2));

  return {
    id: input.id || `zdi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    brandId: input.brandId,
    section: "zomato_dinein",
    platform: "zomato",
    type: "dinein",
    periodLabel: input.periodLabel,
    startDate: input.startDate,
    endDate: input.endDate,
    updatedAt: new Date().toISOString(),
    rawInput: input.rawInput,
    transactions,
    preGmv,
    postGmv,
    discount,
    discountPct,
    commission,
    commissionPct,
    ads,
    netPayout,
    netPayoutPct,
    overallBurnPct,
  };
}

export function computeSwiggyDineout(
  input: Partial<SwiggyDineoutMetrics> & { periodLabel: string }
): SwiggyDineoutMetrics {
  const transactions = Number(input.transactions || 0);
  const preGmv = Number(input.preGmv || 0);
  const discount = Number(input.discount || 0);
  const postGmv =
    input.postGmv !== undefined && input.postGmv !== 0
      ? Number(input.postGmv)
      : preGmv - discount;

  const discountPct =
    preGmv > 0 ? Number(((discount / preGmv) * 100).toFixed(2)) : 0;

  const commission = Number(input.commission || 0);
  const commissionPct =
    postGmv > 0 ? Number(((commission / postGmv) * 100).toFixed(2)) : 0;

  const ads = Number(input.ads || 0);
  const netPayout = Number((postGmv - commission - ads).toFixed(2));

  const netPayoutPct =
    preGmv > 0 ? Number(((netPayout / preGmv) * 100).toFixed(2)) : 0;
  const overallBurnPct = Number((100 - netPayoutPct).toFixed(2));

  return {
    id: input.id || `sdo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    brandId: input.brandId,
    section: "swiggy_dineout",
    platform: "swiggy",
    type: "dinein",
    periodLabel: input.periodLabel,
    startDate: input.startDate,
    endDate: input.endDate,
    updatedAt: new Date().toISOString(),
    rawInput: input.rawInput,
    transactions,
    preGmv,
    postGmv,
    discount,
    discountPct,
    commission,
    commissionPct,
    ads,
    netPayout,
    netPayoutPct,
    overallBurnPct,
  };
}

export interface CombinedDeliveryMetrics {
  id: string;
  brandId?: string;
  section: "overall_delivery";
  periodLabel: string;
  startDate?: string;
  endDate?: string;
  updatedAt: string;
  orders: number;
  subTotal: number;
  packagingCharges: number;
  subTotalWithPkg: number;
  discount: number;
  discountPct: number;
  commissionableValue: number;
  platformFeesDeductions: number;
  ads: number;
  adsPct: number;
  hyperpure: number;
  netPayout: number;
  netPayoutPct: number;
  overallBurnPct: number;
  hasZomato: boolean;
  hasSwiggy: boolean;
}

export interface CombinedDineoutMetrics {
  id: string;
  brandId?: string;
  section: "overall_dineout";
  periodLabel: string;
  startDate?: string;
  endDate?: string;
  updatedAt: string;
  transactions: number;
  preGmv: number;
  discount: number;
  discountPct: number;
  postGmv: number;
  commission: number;
  commissionPct: number;
  ads: number;
  netPayout: number;
  netPayoutPct: number;
  overallBurnPct: number;
  hasZomato: boolean;
  hasSwiggy: boolean;
}

export function computeCombinedDeliveryRecords(
  zomatoList: ZomatoDeliveryMetrics[],
  swiggyList: SwiggyDeliveryMetrics[]
): CombinedDeliveryMetrics[] {
  const periodMap = new Map<string, { zomato?: ZomatoDeliveryMetrics; swiggy?: SwiggyDeliveryMetrics }>();

  zomatoList.forEach((z) => {
    const key = z.periodLabel.trim().toLowerCase();
    if (!periodMap.has(key)) periodMap.set(key, {});
    periodMap.get(key)!.zomato = z;
  });

  swiggyList.forEach((s) => {
    const key = s.periodLabel.trim().toLowerCase();
    if (!periodMap.has(key)) periodMap.set(key, {});
    periodMap.get(key)!.swiggy = s;
  });

  const result: CombinedDeliveryMetrics[] = [];

  periodMap.forEach((val, key) => {
    const z = val.zomato;
    const s = val.swiggy;

    const periodLabel = z?.periodLabel || s?.periodLabel || key;
    const startDate = z?.startDate || s?.startDate;
    const endDate = z?.endDate || s?.endDate;

    const orders = (z?.orders || 0) + (s?.orders || 0);
    const subTotal = (z?.subTotal || 0) + (s?.subTotal || 0);
    const packagingCharges = (z?.packagingCharges || 0) + (s?.packagingCharges || 0);
    const subTotalWithPkg = (z?.subTotalWithPkg || 0) + (s?.subTotalWithPkg || 0);
    const discount = (z?.discount || 0) + (s?.discount || 0);
    const discountPct = subTotalWithPkg > 0 ? Number(((discount / subTotalWithPkg) * 100).toFixed(2)) : 0;
    const commissionableValue = (z?.commissionableValue || 0) + (s?.commissionableValue || 0);

    const zDeductions = (z?.orderLevelDeduction || 0) + (z?.taxDeduction || 0);
    const sDeductions = (s?.comPgGst || 0) + (s?.complaintsCancellation || 0) + (s?.tax || 0);
    const platformFeesDeductions = zDeductions + sDeductions;

    const ads = (z?.ads || 0) + (s?.ads || 0);
    const adsPct = subTotalWithPkg > 0 ? Number(((ads / subTotalWithPkg) * 100).toFixed(2)) : 0;
    const hyperpure = z?.hyperpure || 0;
    const netPayout = (z?.netPayout || 0) + (s?.netPayout || 0);
    const netPayoutPct = subTotalWithPkg > 0 ? Number(((netPayout / subTotalWithPkg) * 100).toFixed(2)) : 0;
    const overallBurnPct = Number((100 - netPayoutPct).toFixed(2));

    result.push({
      id: `comb_del_${periodLabel.replace(/\s+/g, "_")}`,
      brandId: z?.brandId || s?.brandId,
      section: "overall_delivery",
      periodLabel,
      startDate,
      endDate,
      updatedAt: new Date().toISOString(),
      orders,
      subTotal,
      packagingCharges,
      subTotalWithPkg,
      discount,
      discountPct,
      commissionableValue,
      platformFeesDeductions,
      ads,
      adsPct,
      hyperpure,
      netPayout,
      netPayoutPct,
      overallBurnPct,
      hasZomato: Boolean(z),
      hasSwiggy: Boolean(s),
    });
  });

  return result;
}

export function computeCombinedDineoutRecords(
  zomatoDineinList: ZomatoDineInMetrics[],
  swiggyDineoutList: SwiggyDineoutMetrics[]
): CombinedDineoutMetrics[] {
  const periodMap = new Map<string, { zomato?: ZomatoDineInMetrics; swiggy?: SwiggyDineoutMetrics }>();

  zomatoDineinList.forEach((z) => {
    const key = z.periodLabel.trim().toLowerCase();
    if (!periodMap.has(key)) periodMap.set(key, {});
    periodMap.get(key)!.zomato = z;
  });

  swiggyDineoutList.forEach((s) => {
    const key = s.periodLabel.trim().toLowerCase();
    if (!periodMap.has(key)) periodMap.set(key, {});
    periodMap.get(key)!.swiggy = s;
  });

  const result: CombinedDineoutMetrics[] = [];

  periodMap.forEach((val, key) => {
    const z = val.zomato;
    const s = val.swiggy;

    const periodLabel = z?.periodLabel || s?.periodLabel || key;
    const startDate = z?.startDate || s?.startDate;
    const endDate = z?.endDate || s?.endDate;

    const transactions = (z?.transactions || 0) + (s?.transactions || 0);
    const preGmv = (z?.preGmv || 0) + (s?.preGmv || 0);
    const discount = (z?.discount || 0) + (s?.discount || 0);
    const discountPct = preGmv > 0 ? Number(((discount / preGmv) * 100).toFixed(2)) : 0;
    const postGmv = (z?.postGmv || 0) + (s?.postGmv || 0);
    const commission = (z?.commission || 0) + (s?.commission || 0);
    const commissionPct = postGmv > 0 ? Number(((commission / postGmv) * 100).toFixed(2)) : 0;
    const ads = (z?.ads || 0) + (s?.ads || 0);
    const netPayout = (z?.netPayout || 0) + (s?.netPayout || 0);
    const netPayoutPct = preGmv > 0 ? Number(((netPayout / preGmv) * 100).toFixed(2)) : 0;
    const overallBurnPct = Number((100 - netPayoutPct).toFixed(2));

    result.push({
      id: `comb_dine_${periodLabel.replace(/\s+/g, "_")}`,
      brandId: z?.brandId || s?.brandId,
      section: "overall_dineout",
      periodLabel,
      startDate,
      endDate,
      updatedAt: new Date().toISOString(),
      transactions,
      preGmv,
      discount,
      discountPct,
      postGmv,
      commission,
      commissionPct,
      ads,
      netPayout,
      netPayoutPct,
      overallBurnPct,
      hasZomato: Boolean(z),
      hasSwiggy: Boolean(s),
    });
  });

  return result;
}

export interface MonthlyRollupRecord {
  id: string;
  brandId: string;
  brandName: string;
  section: SectionKey;
  monthName: string; // e.g., "July 2026"
  savedAt: string;
  orders: number;
  transactions: number;
  subTotal: number;
  packagingCharges: number;
  subTotalWithPkg: number;
  discount: number;
  discountPct: number;
  commission: number;
  ads: number;
  adsPct: number;
  netPayout: number;
  netPayoutPct: number;
  overallBurnPct: number;
}
