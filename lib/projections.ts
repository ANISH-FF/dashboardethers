export type MonthData = {
  name: string; // e.g. "Feb '26", "Month - 1"
  isProjection: boolean;
  orders: number;
  subTotal: number;
  aov: number;
  packagingCharges: number;
  subTotalWithPkg: number;
  merchantDiscountBurn: number;
  effectiveDiscountPct: number;
  commissionableValue: number;
  advertisement: number;
  advertisementPct: number;
  commissionPgGst: number;
  commissionPct: number;
  netPayout: number;
  payoutPct: number;
  burnPct: number;
  m2o: number;
  menuOpens: number;
};

export type ProjectionBrandState = {
  brandName: string;
  historicalMonths: MonthData[];
  projectedMonths: MonthData[];
  notes?: string;
};

// Seed dataset matching the exact values from the reference Excel sheet (Moon Delivery)
export const DEFAULT_PROJECTION_DATA: ProjectionBrandState = {
  brandName: "Moon (Delivery)",
  notes: "After ensuring that all organic elements are properly in place such as item reels, high-quality product pictures, engaging thumbnails, discount codes, and timely flash sales, the M2O (Menu-to-Order) ratio is expected to improve. An increase in M2O will directly enhance the order conversion rate, resulting in higher order volumes, increased sales, and overall better revenue performance.",
  historicalMonths: [
    {
      name: "Feb '26",
      isProjection: false,
      orders: 357,
      subTotal: 284760,
      aov: 759,
      packagingCharges: 3550,
      subTotalWithPkg: 288310,
      merchantDiscountBurn: 18916,
      effectiveDiscountPct: 0.0656,
      commissionableValue: 269394,
      advertisement: 20946,
      advertisementPct: 0.0727,
      commissionPgGst: 72896,
      commissionPct: 0.2706,
      netPayout: 175804,
      payoutPct: 60.98,
      burnPct: 39.02,
      m2o: 0.076,
      menuOpens: 4702
    },
    {
      name: "Mar '26",
      isProjection: false,
      orders: 298,
      subTotal: 239735,
      aov: 766,
      packagingCharges: 2940,
      subTotalWithPkg: 242675,
      merchantDiscountBurn: 16539,
      effectiveDiscountPct: 0.0682,
      commissionableValue: 226136,
      advertisement: 17881,
      advertisementPct: 0.0737,
      commissionPgGst: 61296,
      commissionPct: 0.2711,
      netPayout: 148210,
      payoutPct: 61.07,
      burnPct: 38.93,
      m2o: 0.063,
      menuOpens: 4784
    },
    {
      name: "Apr '26",
      isProjection: false,
      orders: 341,
      subTotal: 264750,
      aov: 740,
      packagingCharges: 3390,
      subTotalWithPkg: 268140,
      merchantDiscountBurn: 17310,
      effectiveDiscountPct: 0.0646,
      commissionableValue: 250830,
      advertisement: 19860,
      advertisementPct: 0.0741,
      commissionPgGst: 67873,
      commissionPct: 0.2706,
      netPayout: 163191,
      payoutPct: 60.86,
      burnPct: 39.14,
      m2o: 0.06,
      menuOpens: 5582
    }
  ],
  projectedMonths: [
    {
      name: "Month - 1",
      isProjection: true,
      orders: 430,
      subTotal: 322332,
      aov: 750,
      packagingCharges: 6876,
      subTotalWithPkg: 329209,
      merchantDiscountBurn: 26337,
      effectiveDiscountPct: 0.08,
      commissionableValue: 302872,
      advertisement: 20000,
      advertisementPct: 0.0608,
      commissionPgGst: 81955,
      commissionPct: 0.2706,
      netPayout: 200917,
      payoutPct: 61.03,
      burnPct: 38.97,
      m2o: 0.07,
      menuOpens: 6143
    },
    {
      name: "Month - 2",
      isProjection: true,
      orders: 497,
      subTotal: 382931,
      aov: 770,
      packagingCharges: 7957,
      subTotalWithPkg: 390888,
      merchantDiscountBurn: 31271,
      effectiveDiscountPct: 0.08,
      commissionableValue: 359617,
      advertisement: 20000,
      advertisementPct: 0.0512,
      commissionPgGst: 97310,
      commissionPct: 0.2706,
      netPayout: 242307,
      payoutPct: 61.99,
      burnPct: 38.01,
      m2o: 0.08,
      menuOpens: 6213
    },
    {
      name: "Month - 3",
      isProjection: true,
      orders: 544,
      subTotal: 435200,
      aov: 800,
      packagingCharges: 8704,
      subTotalWithPkg: 443904,
      merchantDiscountBurn: 35512,
      effectiveDiscountPct: 0.08,
      commissionableValue: 408392,
      advertisement: 20000,
      advertisementPct: 0.0451,
      commissionPgGst: 110511,
      commissionPct: 0.2706,
      netPayout: 277881,
      payoutPct: 62.60,
      burnPct: 37.40,
      m2o: 0.08,
      menuOpens: 6800
    }
  ]
};

// Calculate projection metrics from inputs
export function calculateMonthMetrics(month: Partial<MonthData>): MonthData {
  const isProjection = !!month.isProjection;

  // 1) HISTORICAL BASELINE MONTHS (isProjection === false):
  //    Keep RAW FACTUAL DATA as-is without applying projection override formulas!
  if (!isProjection) {
    const orders = Number(month.orders || 0);
    const subTotal = Number(month.subTotal || 0);
    const aov = month.aov !== undefined && month.aov !== 0 ? month.aov : (orders > 0 ? Math.round(subTotal / orders) : 0);
    const packagingCharges = Number(month.packagingCharges || 0);
    const subTotalWithPkg = month.subTotalWithPkg !== undefined ? month.subTotalWithPkg : (subTotal + packagingCharges);
    const merchantDiscountBurn = Number(month.merchantDiscountBurn || 0);
    const effectiveDiscountPct = subTotalWithPkg > 0 ? Number((merchantDiscountBurn / subTotalWithPkg).toFixed(4)) : (month.effectiveDiscountPct || 0);
    const commissionableValue = month.commissionableValue !== undefined ? month.commissionableValue : (subTotalWithPkg - merchantDiscountBurn);
    const advertisement = Number(month.advertisement || 0);
    const advertisementPct = commissionableValue > 0 ? Number((advertisement / commissionableValue).toFixed(4)) : (month.advertisementPct || 0);
    const commissionPgGst = Number(month.commissionPgGst || 0);
    const commissionPct = commissionableValue > 0 ? Number((commissionPgGst / commissionableValue).toFixed(4)) : (month.commissionPct || 0);
    const netPayout = Number(month.netPayout !== undefined ? month.netPayout : (commissionableValue - advertisement - commissionPgGst));
    const payoutPct = subTotal > 0 ? Number(((netPayout / subTotal) * 100).toFixed(2)) : 0;
    const burnPct = Number((100 - payoutPct).toFixed(2));
    const m2o = month.m2o !== undefined ? month.m2o : 0.07;
    const menuOpens = month.menuOpens !== undefined && month.menuOpens !== 0 ? month.menuOpens : (orders > 0 && m2o > 0 ? Math.round(orders / m2o) : 0);

    return {
      name: month.name || "Month",
      isProjection: false,
      orders,
      subTotal,
      aov,
      packagingCharges,
      subTotalWithPkg,
      merchantDiscountBurn,
      effectiveDiscountPct,
      commissionableValue,
      advertisement,
      advertisementPct,
      commissionPgGst,
      commissionPct,
      netPayout,
      payoutPct,
      burnPct,
      m2o,
      menuOpens,
    };
  }

  // 2) FORWARD 3 PROJECTED MONTHS (isProjection === true):
  //    Apply Dynamic Projection Modeler Formulas
  const m2o = month.m2o !== undefined && month.m2o !== null ? month.m2o : 0.08;
  const menuOpens = month.menuOpens !== undefined && month.menuOpens !== null
    ? month.menuOpens
    : ((month.orders !== undefined && month.orders > 0 && m2o > 0) ? Math.round(month.orders / m2o) : 0);
  
  const orders = month.orders !== undefined && month.orders !== null
    ? month.orders
    : Math.round(menuOpens * m2o);
  
  const aov = month.aov !== undefined && month.aov !== null ? month.aov : 750;
  const subTotal = month.subTotal !== undefined && month.subTotal !== null ? month.subTotal : Math.round(orders * aov);
  
  const packagingCharges = month.packagingCharges !== undefined && month.packagingCharges !== null
    ? month.packagingCharges
    : Math.round(orders * 16);
  const subTotalWithPkg = subTotal + packagingCharges;

  const effectiveDiscountPct = month.effectiveDiscountPct !== undefined && month.effectiveDiscountPct !== null 
    ? month.effectiveDiscountPct 
    : (month.merchantDiscountBurn !== undefined && month.merchantDiscountBurn !== null && subTotal > 0 
        ? month.merchantDiscountBurn / subTotal 
        : 0.08);

  const merchantDiscountBurn = (month.effectiveDiscountPct !== undefined && month.effectiveDiscountPct !== null)
    ? Math.round(subTotal * effectiveDiscountPct)
    : (month.merchantDiscountBurn !== undefined && month.merchantDiscountBurn !== null
        ? month.merchantDiscountBurn
        : Math.round(subTotal * effectiveDiscountPct));

  const commissionableValue = subTotalWithPkg - merchantDiscountBurn;

  const advertisement = month.advertisement !== undefined && month.advertisement !== null
    ? month.advertisement
    : Math.round(commissionableValue * (month.advertisementPct !== undefined ? month.advertisementPct : 0.06));

  const advertisementPct = month.advertisementPct !== undefined && month.advertisementPct !== null
    ? month.advertisementPct
    : (commissionableValue > 0 ? Number((advertisement / commissionableValue).toFixed(4)) : 0.06);

  const commissionPct = month.commissionPct !== undefined && month.commissionPct !== null
    ? month.commissionPct
    : (month.commissionPgGst !== undefined && month.commissionPgGst !== null && commissionableValue > 0
        ? Number((month.commissionPgGst / commissionableValue).toFixed(4))
        : 0.2706);

  const commissionPgGst = month.commissionPgGst !== undefined && month.commissionPgGst !== null && !month.commissionPct
    ? month.commissionPgGst
    : Math.round(commissionableValue * commissionPct);

  const netPayout = month.netPayout !== undefined && month.netPayout !== null && !month.effectiveDiscountPct && !month.advertisementPct
    ? month.netPayout
    : commissionableValue - advertisement - commissionPgGst;

  const payoutPct = subTotal > 0 ? Number(((netPayout / subTotal) * 100).toFixed(2)) : 0;
  const burnPct = Number((100 - payoutPct).toFixed(2));

  return {
    name: month.name || "Month",
    isProjection: true,
    orders,
    subTotal,
    aov,
    packagingCharges,
    subTotalWithPkg,
    merchantDiscountBurn,
    effectiveDiscountPct,
    commissionableValue,
    advertisement,
    advertisementPct,
    commissionPgGst,
    commissionPct,
    netPayout,
    payoutPct,
    burnPct,
    m2o,
    menuOpens
  };
}
