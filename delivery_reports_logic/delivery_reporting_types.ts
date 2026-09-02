/**
 * Complete Type Definitions for Zomato & Swiggy Delivery Payout Telemetry & Image Extraction
 */

export interface ZomatoDeliveryRawOCR {
  total_orders: number;
  sub_total: number;
  packaging_charges: number;
  sub_total_with_pkg?: number;
  cancelled_order_refund: number;
  promo_discount?: number;
  other_discount?: number;
  discount: number;
  delivery_charge_discount?: number;
  commissionable_value: number;
  order_level_deduction: number;
  tax_deduction: number;
  ads: number;
  hyperpure: number;
  net_payout: number;
}

export interface ZomatoDeliveryMetrics {
  id: string;
  brandId?: string;
  section: "zomato_delivery";
  platform: "zomato";
  type: "delivery";
  periodLabel: string; // e.g. "1-10 Aug", "July 2026"
  startDate?: string;
  endDate?: string;
  updatedAt: string;
  
  // Extracted Raw Metrics
  orders: number;
  subTotal: number;
  packagingCharges: number;
  subTotalWithPkg: number; // subTotal + packagingCharges
  cancelledOrderRefund: number;
  discount: number;
  commissionableValue: number; // Net order value (A)
  orderLevelDeduction: number; // Order level deductions (C) (Commission + PG + Long Distance)
  taxDeduction: number; // Tax deductions (D) (GST on fees + TCS + TDS + GST 9(5))
  ads: number;
  hyperpure: number; // Raw material B2B procurement
  netPayout: number;
  netPayoutWithHyperpure: number; // netPayout + hyperpure

  // Derived Performance Metrics
  discountPct: number; // (discount / subTotalWithPkg) * 100
  adsPct: number; // (ads / subTotalWithPkg) * 100
  netPayoutPct: number; // (netPayout / subTotalWithPkg) * 100
  overallBurnPct: number; // 100 - netPayoutPct

  rawInput?: Record<string, any>;
}

export interface SwiggyDeliveryRawOCR {
  orders: number;
  sub_total: number;
  packaging_charges: number;
  sub_total_with_pkg?: number;
  trade_discount?: number;
  coupon_discount?: number;
  discount: number;
  commissionable_value: number;
  total_fees: number;
  gst_on_fees: number;
  complaints_cancellation: number;
  total_taxes: number;
  ads: number;
  other_deductions?: number;
  other_refunds?: number;
  net_payout: number;
}

export interface SwiggyDeliveryMetrics {
  id: string;
  brandId?: string;
  section: "swiggy_delivery";
  platform: "swiggy";
  type: "delivery";
  periodLabel: string;
  startDate?: string;
  endDate?: string;
  updatedAt: string;

  // Extracted Raw Metrics
  orders: number;
  subTotal: number;
  packagingCharges: number;
  subTotalWithPkg: number; // subTotal + packagingCharges
  discount: number;
  commissionableValue: number; // (A) Total Customer Paid
  comPgGst: number; // Total Fees (B) + GST @ 18% on Fees
  complaintsCancellation: number; // Complaints & cancellation charges
  tax: number; // TCS + TDS + GST 9(5)
  ads: number; // (E) Growth Investments in Ads
  otherDeductions?: number; // (F) Unsettled Deductions / Other Charges
  otherRefunds?: number; // (F) Other Refunds added
  netPayout: number; // FINAL PAYOUT

  // Derived Performance Metrics
  discountPct: number; // (discount / subTotalWithPkg) * 100
  adsPct: number; // (ads / subTotal) * 100
  netPayoutPct: number; // (netPayout / subTotalWithPkg) * 100
  overallBurnPct: number; // 100 - netPayoutPct

  rawInput?: Record<string, any>;
}
