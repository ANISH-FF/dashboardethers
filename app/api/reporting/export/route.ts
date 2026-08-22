import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getReportingStore, computeCombinedDeliveryRecords, computeCombinedDineoutRecords } from "@/lib/reporting";

function computeRollupList<T extends Record<string, any>>(items: T[], isRollupOnly: boolean): T[] {
  if (!items || items.length === 0) return [];

  const monthGroups: Record<string, T[]> = {};
  items.forEach((item) => {
    let monthName = "";
    const label = item.periodLabel || "";
    const match = label.match(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i);
    if (match) {
      const mStr = match[0].toLowerCase();
      const mNames: Record<string, string> = {
        jan: "January", feb: "February", mar: "March", apr: "April",
        may: "May", jun: "June", jul: "July", aug: "August",
        sep: "September", oct: "October", nov: "November", dec: "December"
      };
      monthName = mNames[mStr] || match[0];
    } else {
      monthName = label;
    }
    if (!monthGroups[monthName]) monthGroups[monthName] = [];
    monthGroups[monthName].push(item);
  });

  const result: T[] = [];

  Object.entries(monthGroups).forEach(([mName, groupItems]) => {
    if (!isRollupOnly) {
      groupItems.forEach((gi) => result.push(gi));
    }

    const orders = groupItems.reduce((a, b) => a + (b.orders || 0), 0);
    const transactions = groupItems.reduce((a, b) => a + (b.transactions || 0), 0);
    const subTotal = groupItems.reduce((a, b) => a + (b.subTotal || 0), 0);
    const packagingCharges = groupItems.reduce((a, b) => a + (b.packagingCharges || 0), 0);
    const subTotalWithPkg = groupItems.reduce((a, b) => a + (b.subTotalWithPkg || 0), 0);
    const cancelledOrderRefund = groupItems.reduce((a, b) => a + (b.cancelledOrderRefund || 0), 0);
    const discount = groupItems.reduce((a, b) => a + (b.discount || 0), 0);
    const commissionableValue = groupItems.reduce((a, b) => a + (b.commissionableValue || 0), 0);
    const orderLevelDeduction = groupItems.reduce((a, b) => a + (b.orderLevelDeduction || 0), 0);
    const taxDeduction = groupItems.reduce((a, b) => a + (b.taxDeduction || 0), 0);
    const comPgGst = groupItems.reduce((a, b) => a + (b.comPgGst || 0), 0);
    const complaintsCancellation = groupItems.reduce((a, b) => a + (b.complaintsCancellation || 0), 0);
    const tax = groupItems.reduce((a, b) => a + (b.tax || 0), 0);
    const preGmv = groupItems.reduce((a, b) => a + (b.preGmv || 0), 0);
    const postGmv = groupItems.reduce((a, b) => a + (b.postGmv || 0), 0);
    const commission = groupItems.reduce((a, b) => a + (b.commission || 0), 0);
    const ads = groupItems.reduce((a, b) => a + (b.ads || 0), 0);
    const hyperpure = groupItems.reduce((a, b) => a + (b.hyperpure || 0), 0);
    const netPayout = groupItems.reduce((a, b) => a + (b.netPayout || 0), 0);
    const platformFeesDeductions = groupItems.reduce(
      (a, b) =>
        a +
        (b.platformFeesDeductions !== undefined
          ? Number(b.platformFeesDeductions || 0)
          : Number(b.orderLevelDeduction || 0) +
            Number(b.taxDeduction || 0) +
            Number(b.comPgGst || 0) +
            Number(b.tax || 0)),
      0
    );

    const grossBase = subTotalWithPkg || preGmv || subTotal || 1;
    const discountPct = Number(((discount / grossBase) * 100).toFixed(2));
    const adsPct = Number(((ads / grossBase) * 100).toFixed(2));
    const commissionPct = postGmv > 0 ? Number(((commission / postGmv) * 100).toFixed(2)) : 0;
    const netPayoutPct = Number(((netPayout / grossBase) * 100).toFixed(2));
    const overallBurnPct = Number((100 - netPayoutPct).toFixed(2));

    const rollupObj: any = {
      periodLabel: isRollupOnly ? `${mName} (Rollup)` : `${mName} (Total)`,
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

    result.push(rollupObj as T);
  });

  return result;
}

export async function GET(req: NextRequest) {
  try {
    const store = getReportingStore();
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get("brandId");
    const isRollupOnly = searchParams.get("monthlyRollup") === "true";

    const filterByBrand = <T extends { brandId?: string }>(list: T[]) =>
      brandId ? list.filter((p) => !p.brandId || p.brandId === brandId) : list;

    const raw_zomato_delivery = filterByBrand(store.zomato_delivery || []);
    const raw_zomato_dinein = filterByBrand(store.zomato_dinein || []);
    const raw_swiggy_delivery = filterByBrand(store.swiggy_delivery || []);
    const raw_swiggy_dineout = filterByBrand(store.swiggy_dineout || []);

    const zomato_delivery = computeRollupList(raw_zomato_delivery, isRollupOnly);
    const zomato_dinein = computeRollupList(raw_zomato_dinein, isRollupOnly);
    const swiggy_delivery = computeRollupList(raw_swiggy_delivery, isRollupOnly);
    const swiggy_dineout = computeRollupList(raw_swiggy_dineout, isRollupOnly);

    const wb = XLSX.utils.book_new();

    // 1. Zomato Delivery Sheet
    const zdHeaders = ["Metrics", ...zomato_delivery.map((p) => p.periodLabel)];
    const zdRows = [
      ["Orders", ...zomato_delivery.map((p) => p.orders)],
      ["Sub Total", ...zomato_delivery.map((p) => p.subTotal)],
      ["Packaging Charges", ...zomato_delivery.map((p) => p.packagingCharges)],
      ["Sub Total + Packaging Charges", ...zomato_delivery.map((p) => p.subTotalWithPkg)],
      ["Cancelled Order Refund", ...zomato_delivery.map((p) => p.cancelledOrderRefund)],
      ["Discount", ...zomato_delivery.map((p) => p.discount)],
      ["Discount %", ...zomato_delivery.map((p) => `${p.discountPct}%`)],
      ["Comisionable Value (Including GST Collected by the customer)", ...zomato_delivery.map((p) => p.commissionableValue)],
      ["Order level Deduction (Com + PG )", ...zomato_delivery.map((p) => p.orderLevelDeduction)],
      ["Tax Deduction", ...zomato_delivery.map((p) => p.taxDeduction)],
      ["Ads", ...zomato_delivery.map((p) => p.ads)],
      ["Ads%", ...zomato_delivery.map((p) => `${p.adsPct}%`)],
      ["Hyperpure", ...zomato_delivery.map((p) => p.hyperpure)],
      ["Net Payout", ...zomato_delivery.map((p) => p.netPayout)],
      ["Net Payout + Hyperpure", ...zomato_delivery.map((p) => p.netPayoutWithHyperpure)],
      ["Net Payout %", ...zomato_delivery.map((p) => `${p.netPayoutPct}%`)],
      ["Overall Burn %", ...zomato_delivery.map((p) => `${p.overallBurnPct}%`)],
    ];
    const zdSheet = XLSX.utils.aoa_to_sheet([zdHeaders, ...zdRows]);
    XLSX.utils.book_append_sheet(wb, zdSheet, "Zomato Delivery");

    // 2. Zomato Dinein Sheet
    const zdiHeaders = ["Metrics", ...zomato_dinein.map((p) => p.periodLabel)];
    const zdiRows = [
      ["Transactions", ...zomato_dinein.map((p) => p.transactions)],
      ["Pre Gmv", ...zomato_dinein.map((p) => p.preGmv)],
      ["Post Gmv", ...zomato_dinein.map((p) => p.postGmv)],
      ["Discount", ...zomato_dinein.map((p) => p.discount)],
      ["Discount %", ...zomato_dinein.map((p) => `${p.discountPct}%`)],
      ["Commission", ...zomato_dinein.map((p) => p.commission)],
      ["Commission%", ...zomato_dinein.map((p) => `${p.commissionPct}%`)],
      ["Ads", ...zomato_dinein.map((p) => p.ads)],
      ["Net Payout", ...zomato_dinein.map((p) => p.netPayout)],
      ["Net Payout %", ...zomato_dinein.map((p) => `${p.netPayoutPct}%`)],
      ["Overall Burn %", ...zomato_dinein.map((p) => `${p.overallBurnPct}%`)],
    ];
    const zdiSheet = XLSX.utils.aoa_to_sheet([zdiHeaders, ...zdiRows]);
    XLSX.utils.book_append_sheet(wb, zdiSheet, "Zomato Dineout");

    // 3. Swiggy Delivery Sheet
    const sdHeaders = ["Metrics", ...swiggy_delivery.map((p) => p.periodLabel)];
    const sdRows = [
      ["Orders", ...swiggy_delivery.map((p) => p.orders)],
      ["ST", ...swiggy_delivery.map((p) => p.subTotal)],
      ["PC", ...swiggy_delivery.map((p) => p.packagingCharges)],
      ["ST + PC", ...swiggy_delivery.map((p) => p.subTotalWithPkg)],
      ["Discount", ...swiggy_delivery.map((p) => p.discount)],
      ["Discount %", ...swiggy_delivery.map((p) => `${p.discountPct}%`)],
      ["Comisionable Value", ...swiggy_delivery.map((p) => p.commissionableValue)],
      ["Com + PG + GST", ...swiggy_delivery.map((p) => p.comPgGst)],
      ["Complaints and cancellation charges", ...swiggy_delivery.map((p) => p.complaintsCancellation)],
      ["Tax", ...swiggy_delivery.map((p) => p.tax)],
      ["Ads", ...swiggy_delivery.map((p) => p.ads)],
      ["Ads%", ...swiggy_delivery.map((p) => `${p.adsPct}%`)],
      ["Net Payout", ...swiggy_delivery.map((p) => p.netPayout)],
      ["Net Payout %", ...swiggy_delivery.map((p) => `${p.netPayoutPct}%`)],
      ["Overall Burn %", ...swiggy_delivery.map((p) => `${p.overallBurnPct}%`)],
    ];
    const sdSheet = XLSX.utils.aoa_to_sheet([sdHeaders, ...sdRows]);
    XLSX.utils.book_append_sheet(wb, sdSheet, "Swiggy delivery");

    // 4. Swiggy Dineout Sheet
    const sdoHeaders = ["Metrics", ...swiggy_dineout.map((p) => p.periodLabel)];
    const sdoRows = [
      ["Transactions", ...swiggy_dineout.map((p) => p.transactions)],
      ["Pre Gmv", ...swiggy_dineout.map((p) => p.preGmv)],
      ["Post Gmv", ...swiggy_dineout.map((p) => p.postGmv)],
      ["Discount", ...swiggy_dineout.map((p) => p.discount)],
      ["Discount %", ...swiggy_dineout.map((p) => `${p.discountPct}%`)],
      ["Commission", ...swiggy_dineout.map((p) => p.commission)],
      ["Commission%", ...swiggy_dineout.map((p) => `${p.commissionPct}%`)],
      ["Ads", ...swiggy_dineout.map((p) => p.ads)],
      ["Net Payout", ...swiggy_dineout.map((p) => p.netPayout)],
      ["Net Payout %", ...swiggy_dineout.map((p) => `${p.netPayoutPct}%`)],
      ["Overall Burn %", ...swiggy_dineout.map((p) => `${p.overallBurnPct}%`)],
    ];
    const sdoSheet = XLSX.utils.aoa_to_sheet([sdoHeaders, ...sdoRows]);
    XLSX.utils.book_append_sheet(wb, sdoSheet, "Swiggy Dineout");

    // 5. Overall Delivery (Combined Zomato + Swiggy)
    const raw_combined_delivery = computeCombinedDeliveryRecords(raw_zomato_delivery, raw_swiggy_delivery);
    const combinedDelivery = computeRollupList(raw_combined_delivery, isRollupOnly);
    const cdHeaders = ["Metrics", ...combinedDelivery.map((p) => p.periodLabel)];
    const cdRows = [
      ["Combined Orders", ...combinedDelivery.map((p) => p.orders)],
      ["Sub Total", ...combinedDelivery.map((p) => p.subTotal)],
      ["Packaging Charges", ...combinedDelivery.map((p) => p.packagingCharges)],
      ["Sub Total + Packaging Charges", ...combinedDelivery.map((p) => p.subTotalWithPkg)],
      ["Discount", ...combinedDelivery.map((p) => p.discount)],
      ["Discount %", ...combinedDelivery.map((p) => `${p.discountPct}%`)],
      ["Commissionable Value", ...combinedDelivery.map((p) => p.commissionableValue)],
      ["Platform Fees & Deductions", ...combinedDelivery.map((p) => p.platformFeesDeductions)],
      ["Ads Spend", ...combinedDelivery.map((p) => p.ads)],
      ["Ads %", ...combinedDelivery.map((p) => `${p.adsPct}%`)],
      ["Hyperpure (Zomato)", ...combinedDelivery.map((p) => p.hyperpure)],
      ["Net Payout", ...combinedDelivery.map((p) => p.netPayout)],
      ["Net Payout %", ...combinedDelivery.map((p) => `${p.netPayoutPct}%`)],
      ["Overall Burn %", ...combinedDelivery.map((p) => `${p.overallBurnPct}%`)],
    ];
    const cdSheet = XLSX.utils.aoa_to_sheet([cdHeaders, ...cdRows]);
    XLSX.utils.book_append_sheet(wb, cdSheet, "Overall Delivery");

    // 6. Overall Dineout (Combined Zomato + Swiggy)
    const raw_combined_dineout = computeCombinedDineoutRecords(raw_zomato_dinein, raw_swiggy_dineout);
    const combinedDineout = computeRollupList(raw_combined_dineout, isRollupOnly);
    const cdoHeaders = ["Metrics", ...combinedDineout.map((p) => p.periodLabel)];
    const cdoRows = [
      ["Combined Transactions", ...combinedDineout.map((p) => p.transactions)],
      ["Pre GMV", ...combinedDineout.map((p) => p.preGmv)],
      ["Post GMV", ...combinedDineout.map((p) => p.postGmv)],
      ["Discount", ...combinedDineout.map((p) => p.discount)],
      ["Discount %", ...combinedDineout.map((p) => `${p.discountPct}%`)],
      ["Commission", ...combinedDineout.map((p) => p.commission)],
      ["Commission %", ...combinedDineout.map((p) => `${p.commissionPct}%`)],
      ["Ads Spend", ...combinedDineout.map((p) => p.ads)],
      ["Net Payout", ...combinedDineout.map((p) => p.netPayout)],
      ["Net Payout %", ...combinedDineout.map((p) => `${p.netPayoutPct}%`)],
      ["Overall Burn %", ...combinedDineout.map((p) => `${p.overallBurnPct}%`)],
    ];
    const cdoSheet = XLSX.utils.aoa_to_sheet([cdoHeaders, ...cdoRows]);
    XLSX.utils.book_append_sheet(wb, cdoSheet, "Overall Dineout");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Ethers_Payout_Report_${Date.now()}.xlsx"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to generate Excel export." }, { status: 500 });
  }
}
