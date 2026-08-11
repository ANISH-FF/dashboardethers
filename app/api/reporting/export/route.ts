import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getReportingStore, computeCombinedDeliveryRecords, computeCombinedDineoutRecords } from "@/lib/reporting";

export async function GET() {
  try {
    const store = getReportingStore();
    const wb = XLSX.utils.book_new();

    // 1. Zomato Delivery Sheet
    const zdHeaders = ["Metrics", ...store.zomato_delivery.map((p) => p.periodLabel)];
    const zdRows = [
      ["Orders", ...store.zomato_delivery.map((p) => p.orders)],
      ["Sub Total", ...store.zomato_delivery.map((p) => p.subTotal)],
      ["Packaging Charges", ...store.zomato_delivery.map((p) => p.packagingCharges)],
      ["Sub Total + Packaging Charges", ...store.zomato_delivery.map((p) => p.subTotalWithPkg)],
      ["Cancelled Order Refund", ...store.zomato_delivery.map((p) => p.cancelledOrderRefund)],
      ["Discount", ...store.zomato_delivery.map((p) => p.discount)],
      ["Discount %", ...store.zomato_delivery.map((p) => `${p.discountPct}%`)],
      ["Comisionable Value (Including GST Collected by the customer)", ...store.zomato_delivery.map((p) => p.commissionableValue)],
      ["Order level Deduction (Com + PG )", ...store.zomato_delivery.map((p) => p.orderLevelDeduction)],
      ["Tax Deduction", ...store.zomato_delivery.map((p) => p.taxDeduction)],
      ["Ads", ...store.zomato_delivery.map((p) => p.ads)],
      ["Ads%", ...store.zomato_delivery.map((p) => `${p.adsPct}%`)],
      ["Hyperpure", ...store.zomato_delivery.map((p) => p.hyperpure)],
      ["Net Payout", ...store.zomato_delivery.map((p) => p.netPayout)],
      ["Net Payout + Hyperpure", ...store.zomato_delivery.map((p) => p.netPayoutWithHyperpure)],
      ["Net Payout %", ...store.zomato_delivery.map((p) => `${p.netPayoutPct}%`)],
      ["Overall Burn %", ...store.zomato_delivery.map((p) => `${p.overallBurnPct}%`)],
    ];
    const zdSheet = XLSX.utils.aoa_to_sheet([zdHeaders, ...zdRows]);
    XLSX.utils.book_append_sheet(wb, zdSheet, "Zomato Delivery");

    // 2. Zomato Dinein Sheet
    const zdiHeaders = ["Metrics", ...store.zomato_dinein.map((p) => p.periodLabel)];
    const zdiRows = [
      ["Transactions", ...store.zomato_dinein.map((p) => p.transactions)],
      ["Pre Gmv", ...store.zomato_dinein.map((p) => p.preGmv)],
      ["Post Gmv", ...store.zomato_dinein.map((p) => p.postGmv)],
      ["Discount", ...store.zomato_dinein.map((p) => p.discount)],
      ["Discount %", ...store.zomato_dinein.map((p) => `${p.discountPct}%`)],
      ["Commission", ...store.zomato_dinein.map((p) => p.commission)],
      ["Commission%", ...store.zomato_dinein.map((p) => `${p.commissionPct}%`)],
      ["Ads", ...store.zomato_dinein.map((p) => p.ads)],
      ["Net Payout", ...store.zomato_dinein.map((p) => p.netPayout)],
      ["Net Payout %", ...store.zomato_dinein.map((p) => `${p.netPayoutPct}%`)],
      ["Overall Burn %", ...store.zomato_dinein.map((p) => `${p.overallBurnPct}%`)],
    ];
    const zdiSheet = XLSX.utils.aoa_to_sheet([zdiHeaders, ...zdiRows]);
    XLSX.utils.book_append_sheet(wb, zdiSheet, "Zomato Dineout");

    // 3. Swiggy Delivery Sheet
    const sdHeaders = ["Metrics", ...store.swiggy_delivery.map((p) => p.periodLabel)];
    const sdRows = [
      ["Orders", ...store.swiggy_delivery.map((p) => p.orders)],
      ["ST", ...store.swiggy_delivery.map((p) => p.subTotal)],
      ["PC", ...store.swiggy_delivery.map((p) => p.packagingCharges)],
      ["ST + PC", ...store.swiggy_delivery.map((p) => p.subTotalWithPkg)],
      ["Discount", ...store.swiggy_delivery.map((p) => p.discount)],
      ["Discount %", ...store.swiggy_delivery.map((p) => `${p.discountPct}%`)],
      ["Comisionable Value", ...store.swiggy_delivery.map((p) => p.commissionableValue)],
      ["Com + PG + GST", ...store.swiggy_delivery.map((p) => p.comPgGst)],
      ["Complaints and cancellation charges", ...store.swiggy_delivery.map((p) => p.complaintsCancellation)],
      ["Tax", ...store.swiggy_delivery.map((p) => p.tax)],
      ["Ads", ...store.swiggy_delivery.map((p) => p.ads)],
      ["Ads%", ...store.swiggy_delivery.map((p) => `${p.adsPct}%`)],
      ["Net Payout", ...store.swiggy_delivery.map((p) => p.netPayout)],
      ["Net Payout %", ...store.swiggy_delivery.map((p) => `${p.netPayoutPct}%`)],
      ["Overall Burn %", ...store.swiggy_delivery.map((p) => `${p.overallBurnPct}%`)],
    ];
    const sdSheet = XLSX.utils.aoa_to_sheet([sdHeaders, ...sdRows]);
    XLSX.utils.book_append_sheet(wb, sdSheet, "Swiggy delivery");

    // 4. Swiggy Dineout Sheet
    const sdoHeaders = ["Metrics", ...store.swiggy_dineout.map((p) => p.periodLabel)];
    const sdoRows = [
      ["Transactions", ...store.swiggy_dineout.map((p) => p.transactions)],
      ["Pre Gmv", ...store.swiggy_dineout.map((p) => p.preGmv)],
      ["Post Gmv", ...store.swiggy_dineout.map((p) => p.postGmv)],
      ["Discount", ...store.swiggy_dineout.map((p) => p.discount)],
      ["Discount %", ...store.swiggy_dineout.map((p) => `${p.discountPct}%`)],
      ["Commission", ...store.swiggy_dineout.map((p) => p.commission)],
      ["Commission%", ...store.swiggy_dineout.map((p) => `${p.commissionPct}%`)],
      ["Ads", ...store.swiggy_dineout.map((p) => p.ads)],
      ["Net Payout", ...store.swiggy_dineout.map((p) => p.netPayout)],
      ["Net Payout %", ...store.swiggy_dineout.map((p) => `${p.netPayoutPct}%`)],
      ["Overall Burn %", ...store.swiggy_dineout.map((p) => `${p.overallBurnPct}%`)],
    ];
    const sdoSheet = XLSX.utils.aoa_to_sheet([sdoHeaders, ...sdoRows]);
    XLSX.utils.book_append_sheet(wb, sdoSheet, "Swiggy Dineout");

    // 5. Overall Delivery (Combined Zomato + Swiggy)
    const combinedDelivery = computeCombinedDeliveryRecords(store.zomato_delivery, store.swiggy_delivery);
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
    const combinedDineout = computeCombinedDineoutRecords(store.zomato_dinein, store.swiggy_dineout);
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
