export type MonthData = {
  name: string; // e.g. "April", "Month - 1"
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

// Seed dataset matching the exact values from projections.xlsx
export const DEFAULT_PROJECTION_DATA: ProjectionBrandState = {
  brandName: "The Qwality Kitchen",
  notes: "After ensuring that all organic elements are properly in place such as item reels, high-quality product pictures, engaging thumbnails, discount codes, and timely flash sales, the M2O (Menu-to-Order) ratio is expected to improve. An increase in M2O will directly enhance the order conversion rate, resulting in higher order volumes, increased sales, and overall better revenue performance.",
  historicalMonths: [
    {
      name: "April",
      isProjection: false,
      orders: 904,
      subTotal: 277215,
      aov: 285,
      packagingCharges: 12318,
      subTotalWithPkg: 289533,
      merchantDiscountBurn: 35894,
      effectiveDiscountPct: 0.124,
      commissionableValue: 266320,
      advertisement: 35081,
      advertisementPct: 0.1317,
      commissionPgGst: 74581,
      commissionPct: 0.28,
      netPayout: 146298,
      payoutPct: 50.53,
      burnPct: 49.47,
      m2o: 0.074,
      menuOpens: 12353
    },
    {
      name: "May",
      isProjection: false,
      orders: 1279,
      subTotal: 432311,
      aov: 317,
      packagingCharges: 17521,
      subTotalWithPkg: 449832,
      merchantDiscountBurn: 50025,
      effectiveDiscountPct: 0.1112,
      commissionableValue: 419797,
      advertisement: 103809,
      advertisementPct: 0.2473,
      commissionPgGst: 113973,
      commissionPct: 0.2715,
      netPayout: 184969,
      payoutPct: 41.12,
      burnPct: 58.88,
      m2o: 0.07,
      menuOpens: 18674
    },
    {
      name: "June",
      isProjection: false,
      orders: 1269,
      subTotal: 407581,
      aov: 328,
      packagingCharges: 17812,
      subTotalWithPkg: 425393,
      merchantDiscountBurn: 16747,
      effectiveDiscountPct: 0.0394,
      commissionableValue: 429078,
      advertisement: 126933,
      advertisementPct: 0.2958,
      commissionPgGst: 119400,
      commissionPct: 0.2783,
      netPayout: 166459,
      payoutPct: 39.13,
      burnPct: 60.87,
      m2o: 0.063,
      menuOpens: 20137
    }
  ],
  projectedMonths: [
    {
      name: "Month - 1",
      isProjection: true,
      orders: 1440,
      subTotal: 504000,
      aov: 350,
      packagingCharges: 21600,
      subTotalWithPkg: 525600,
      merchantDiscountBurn: 25200,
      effectiveDiscountPct: 0.05,
      commissionableValue: 500400,
      advertisement: 95076,
      advertisementPct: 0.19,
      commissionPgGst: 140112,
      commissionPct: 0.28,
      netPayout: 265212,
      payoutPct: 50.46,
      burnPct: 49.54,
      m2o: 0.08,
      menuOpens: 18000
    },
    {
      name: "Month - 2",
      isProjection: true,
      orders: 1800,
      subTotal: 666000,
      aov: 370,
      packagingCharges: 27000,
      subTotalWithPkg: 693000,
      merchantDiscountBurn: 53280,
      effectiveDiscountPct: 0.08,
      commissionableValue: 639720,
      advertisement: 121547,
      advertisementPct: 0.15,
      commissionPgGst: 179122,
      commissionPct: 0.28,
      netPayout: 339052,
      payoutPct: 48.93,
      burnPct: 51.07,
      m2o: 0.10,
      menuOpens: 18000
    },
    {
      name: "Month - 3",
      isProjection: true,
      orders: 1800,
      subTotal: 720000,
      aov: 400,
      packagingCharges: 27000,
      subTotalWithPkg: 747000,
      merchantDiscountBurn: 57600,
      effectiveDiscountPct: 0.08,
      commissionableValue: 689400,
      advertisement: 130986,
      advertisementPct: 0.15,
      commissionPgGst: 193032,
      commissionPct: 0.28,
      netPayout: 365382,
      payoutPct: 48.91,
      burnPct: 51.09,
      m2o: 0.10,
      menuOpens: 18000
    }
  ]
};

// Calculate projection metrics from inputs
export function calculateMonthMetrics(month: Partial<MonthData>): MonthData {
  const m2o = month.m2o || 0.08;
  const menuOpens = month.menuOpens || 18000;
  const orders = month.orders !== undefined && month.orders !== null ? month.orders : Math.round(menuOpens * m2o);
  
  const aov = month.aov || 350;
  const subTotal = month.subTotal !== undefined && month.subTotal !== null ? month.subTotal : Math.round(orders * aov);
  
  const packagingCharges = month.packagingCharges !== undefined ? month.packagingCharges : Math.round(orders * 15);
  const subTotalWithPkg = subTotal + packagingCharges;

  const effectiveDiscountPct = month.effectiveDiscountPct || 0.05;
  const merchantDiscountBurn = Math.round(subTotal * effectiveDiscountPct);

  const commissionableValue = subTotalWithPkg - merchantDiscountBurn;

  const advertisementPct = month.advertisementPct || 0.15;
  const advertisement = Math.round(commissionableValue * advertisementPct);

  const commissionPct = month.commissionPct || 0.28;
  const commissionPgGst = Math.round(commissionableValue * commissionPct);

  const netPayout = commissionableValue - advertisement - commissionPgGst;

  const payoutPct = subTotal > 0 ? Number(((netPayout / subTotal) * 100).toFixed(2)) : 0;
  const burnPct = Number((100 - payoutPct).toFixed(2));

  return {
    name: month.name || "Month",
    isProjection: !!month.isProjection,
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
