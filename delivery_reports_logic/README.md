# 🚀 Zomato & Swiggy Delivery Report Extraction — Complete Logic & Code Base

This folder contains the **exact, production-ready logic** for extracting and calculating delivery payout telemetry from **Zomato & Swiggy partner app weekly payout screenshots (images)**.

---

## 📁 Files Included in this Folder

1. **`delivery_reporting_types.ts`**: Complete TypeScript interfaces & types for raw OCR JSON inputs and computed telemetry metrics.
2. **`zomato_delivery_ocr_engine.ts`**: TypeScript engine for Zomato Delivery screenshots (Gemini Vision prompt + deterministic formulas).
3. **`swiggy_delivery_ocr_engine.ts`**: TypeScript engine for Swiggy Delivery screenshots (Gemini Vision prompt + deterministic formulas).
4. **`delivery_reporting_python_engine.py`**: Python equivalent engine using `requests` and Google Gemini 2.5 Flash API.
5. **`sample_payloads.json`**: Sample input & output JSON structures for testing.

---

## 🔍 1. Zomato Delivery Image Logic

### 🖼️ Screenshots Required:
- 1 to 2 scrolled Zomato Partner App Payout screenshots showing:
  - Total Orders
  - Sub Total & Packaging Charges
  - Net order value (A)
  - Order level deductions (C)
  - Tax deductions (D)
  - Ads / Growth investment
  - Hyperpure deductions (if any)
  - Final Net Payout credited to bank account.

### 🧠 Gemini Vision OCR Prompt:
```text
Extract raw numerical values from these Zomato Payout details screenshot(s).
Respond ONLY with a JSON object containing these exact keys (use 0 if a field is not found):
{
  "total_orders": number,
  "sub_total": number,
  "packaging_charges": number,
  "sub_total_with_pkg": number,
  "cancelled_order_refund": number,
  "discount": number,
  "commissionable_value": number,
  "order_level_deduction": number,
  "tax_deduction": number,
  "ads": number,
  "hyperpure": number,
  "net_payout": number
}
```

### 📐 Formulas applied on Zomato Data:
1. **Subtotal with Packaging (`subTotalWithPkg`)**:
   $$\text{subTotalWithPkg} = \text{subTotal} + \text{packagingCharges}$$

2. **Discount Percentage (`discountPct`)**:
   $$\text{discountPct} = \left( \frac{\text{discount}}{\text{subTotalWithPkg}} \right) \times 100$$

3. **Ads Percentage (`adsPct`)**:
   $$\text{adsPct} = \left( \frac{\text{ads}}{\text{subTotalWithPkg}} \right) \times 100$$

4. **Net Payout Percentage (`netPayoutPct`)**:
   $$\text{netPayoutPct} = \left( \frac{\text{netPayout}}{\text{subTotalWithPkg}} \right) \times 100$$

5. **Overall Burn Percentage (`overallBurnPct`)**:
   $$\text{overallBurnPct} = 100 - \text{netPayoutPct}$$

6. **Net Payout with Hyperpure (`netPayoutWithHyperpure`)**:
   $$\text{netPayoutWithHyperpure} = \text{netPayout} + \text{hyperpure}$$

---

## 🧡 2. Swiggy Delivery Image Logic

### 🖼️ Screenshots Required:
- 1 to 2 Swiggy Partner App weekly payout screenshots showing:
  - Delivered Orders Count
  - Item Total (Subtotal) & Packaging Charges
  - (A) Total Customer Paid
  - (B) Total Fees (Commission + PG)
  - GST @ 18% on Fees
  - (E) Growth Investments in Ads
  - Total Taxes (TCS + TDS + GST 9(5))
  - FINAL PAYOUT

### 🧠 Gemini Vision OCR Prompt:
```text
Extract numerical metrics from these Swiggy payout details screenshot(s).
Respond ONLY in JSON with these exact keys (use 0 if a field is not found):
{
  "orders": number,
  "sub_total": number,
  "packaging_charges": number,
  "sub_total_with_pkg": number,
  "discount": number,
  "commissionable_value": number,
  "total_fees": number,
  "gst_on_fees": number,
  "complaints_cancellation": number,
  "total_taxes": number,
  "ads": number,
  "net_payout": number
}
```

### 📐 Formulas applied on Swiggy Data:
1. **Total Fees + GST (`comPgGst`)**:
   $$\text{comPgGst} = | \text{total\_fees} | + | \text{gst\_on\_fees} |$$

2. **Discount Percentage (`discountPct`)**:
   $$\text{discountPct} = \left( \frac{\text{discount}}{\text{subTotalWithPkg}} \right) \times 100$$

3. **Ads Percentage (`adsPct`)**:
   $$\text{adsPct} = \left( \frac{\text{ads}}{\text{subTotal}} \right) \times 100$$

4. **Net Payout Percentage (`netPayoutPct`)**:
   $$\text{netPayoutPct} = \left( \frac{\text{netPayout}}{\text{subTotalWithPkg}} \right) \times 100$$

5. **Overall Burn Percentage (`overallBurnPct`)**:
   $$\text{overallBurnPct} = 100 - \text{netPayoutPct}$$

---

## 🛠️ How to copy and use this in your project

1. Copy the folder `delivery_reports_logic` directly to your codebase.
2. Ensure you have `GEMINI_API_KEY` set in your `.env` file.
3. For Next.js/Node.js, import `processZomatoDeliveryImagesWithGemini` & `computeZomatoDeliveryMetrics` from `./zomato_delivery_ocr_engine`.
4. For Python, import `compute_zomato_delivery` & `compute_swiggy_delivery` from `delivery_reporting_python_engine.py`.
