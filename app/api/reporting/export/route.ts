import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getReportingStore, computeCombinedDeliveryRecords, computeCombinedDineoutRecords } from "@/lib/reporting";

export async function GET(req: NextRequest) {
  try {
    const store = getReportingStore();
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get("brandId");

    const filterByBrand = <T extends { brandId?: string }>(list: T[]) =>
      brandId ? list.filter((p) => !p.brandId || p.brandId === brandId) : list;

    const zomato_delivery = filterByBrand(store.zomato_delivery || []);
    const zomato_dinein = filterByBrand(store.zomato_dinein || []);
    const swiggy_delivery = filterByBrand(store.swiggy_delivery || []);
    const swiggy_dineout = filterByBrand(store.swiggy_dineout || []);

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
    const combinedDelivery = computeCombinedDeliveryRecords(zomato_delivery, swiggy_delivery);
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
    const combinedDineout = computeCombinedDineoutRecords(zomato_dinein, swiggy_dineout);
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
