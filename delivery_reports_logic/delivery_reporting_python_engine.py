"""
Zomato & Swiggy Delivery Report Image Extraction Engine (Python Version)
========================================================================
This module uses Google Gemini 2.5 Flash API to extract exact payout metrics
from Zomato & Swiggy Partner App weekly payout screenshots and calculates 
deterministic net payout %, overall burn %, discount %, and ads %.

Requirements:
    pip install requests pillow
"""

import re
import json
import base64
import requests

# -------------------------------------------------------------------
# PROMPTS
# -------------------------------------------------------------------

ZOMATO_DELIVERY_GEMINI_PROMPT = """
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
Rules:
- Read numbers strictly as shown. Do NOT apply any percentage calculations.
- "commissionable_value": read strictly from "Net order value (A)" on Zomato screenshot (e.g. 63905.53), else sub_total + packaging_charges - discount.
- "discount": sum of promo discounts, flat offs, Gold, relisted discounts.
- "order_level_deduction": read strictly from "Order level deductions (C)" header on Zomato screenshot (e.g. 16580.86), else sum of base service fee, payment mechanism fee, long distance enablement fee.
- "tax_deduction": read strictly from "Tax deductions (D)" header on Zomato screenshot (e.g. 10280.45), else sum of GST on service fees, TCS, TDS 194O, and GST u/s 9(5).
""".strip()

SWIGGY_DELIVERY_GEMINI_PROMPT = """
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
Rules:
- Read numbers strictly as shown on the screen.
- "orders": total orders count (e.g. 26).
- "sub_total": Item Total (e.g. 21539).
- "packaging_charges": Packaging Charges (e.g. 630).
- "discount": Restaurant Discounts (e.g. 1639.88).
- "commissionable_value": read strictly from "(A) Total Customer Paid" on Swiggy screenshot (e.g. 21555.7), else sub_total + packaging_charges - discount.
- "total_fees": read strictly from "(B) Total Fees" on Swiggy screenshot (e.g. 5383.41).
- "gst_on_fees": read strictly from "GST @ 18%" under Total Taxes on Swiggy screenshot (e.g. 969.02), else 0.
- "ads": read strictly from "(E) Growth Investments in Ads" on Swiggy screenshot (e.g. 2525.2), else 0.
- "net_payout": read strictly from "FINAL PAYOUT" at top of screen (e.g. 11631).
""".strip()

# -------------------------------------------------------------------
# GEMINI VISION CALLER
# -------------------------------------------------------------------

def extract_json_with_gemini(prompt: str, image_paths_or_b64: list, api_key: str) -> dict:
    """Call Gemini 2.5 Flash Vision API with prompt and images."""
    parts = [{"text": prompt}]

    for item in image_paths_or_b64:
        if item.startswith("data:") or len(item) > 1000:
            # Base64 string
            clean_b64 = item.split(",")[-1]
            parts.append({
                "inlineData": {
                    "mimeType": "image/jpeg",
                    "data": clean_b64
                }
            })
        else:
            # File path
            with open(item, "rb") as f:
                b64_data = base64.b64encode(f.read()).decode("utf-8")
                parts.append({
                    "inlineData": {
                        "mimeType": "image/jpeg",
                        "data": b64_data
                    }
                })

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json"
        }
    }

    res = requests.post(url, json=payload, timeout=30)
    res.raise_for_status()
    data = res.json()

    text = data["candidates"][0]["content"]["parts"][0]["text"]
    match = re.search(r'\{[\s\S]*\}', text)
    if not match:
        raise ValueError("No valid JSON found in Gemini output: " + text)
    return json.loads(match.group(0))

# -------------------------------------------------------------------
# ZOMATO COMPUTATION
# -------------------------------------------------------------------

def compute_zomato_delivery(raw: dict, period_label: str, manual_ads: float = 0.0) -> dict:
    orders = float(raw.get("total_orders", 0))
    sub_total = float(raw.get("sub_total", 0))
    packaging_charges = float(raw.get("packaging_charges", 0))
    sub_total_with_pkg = float(raw.get("sub_total_with_pkg", 0)) or (sub_total + packaging_charges)
    cancelled_refund = float(raw.get("cancelled_order_refund", 0))
    discount = float(raw.get("discount", 0))

    discount_pct = round((discount / sub_total_with_pkg * 100), 2) if sub_total_with_pkg > 0 else 0.0

    comm_val = float(raw.get("commissionable_value", 0)) or (sub_total + packaging_charges - discount)
    order_deduction = float(raw.get("order_level_deduction", 0))
    tax_deduction = float(raw.get("tax_deduction", 0))
    ads = manual_ads or float(raw.get("ads", 0))
    ads_pct = round((ads / sub_total_with_pkg * 100), 2) if sub_total_with_pkg > 0 else 0.0
    hyperpure = float(raw.get("hyperpure", 0))
    net_payout = float(raw.get("net_payout", 0))
    net_payout_pct = round((net_payout / sub_total_with_pkg * 100), 2) if sub_total_with_pkg > 0 else 0.0
    overall_burn_pct = round(100.0 - net_payout_pct, 2)

    return {
        "section": "zomato_delivery",
        "periodLabel": period_label,
        "orders": orders,
        "subTotal": sub_total,
        "packagingCharges": packaging_charges,
        "subTotalWithPkg": sub_total_with_pkg,
        "cancelledOrderRefund": cancelled_refund,
        "discount": discount,
        "discountPct": discount_pct,
        "commissionableValue": comm_val,
        "orderLevelDeduction": order_deduction,
        "taxDeduction": tax_deduction,
        "ads": ads,
        "adsPct": ads_pct,
        "hyperpure": hyperpure,
        "netPayout": net_payout,
        "netPayoutWithHyperpure": net_payout + hyperpure,
        "netPayoutPct": net_payout_pct,
        "overallBurnPct": overall_burn_pct
    }

# -------------------------------------------------------------------
# SWIGGY COMPUTATION
# -------------------------------------------------------------------

def compute_swiggy_delivery(raw: dict, period_label: str, manual_ads: float = 0.0) -> dict:
    orders = float(raw.get("orders", 0))
    sub_total = float(raw.get("sub_total", 0))
    packaging_charges = float(raw.get("packaging_charges", 0))
    sub_total_with_pkg = float(raw.get("sub_total_with_pkg", 0)) or (sub_total + packaging_charges)
    discount = float(raw.get("discount", 0))

    discount_pct = round((discount / sub_total_with_pkg * 100), 2) if sub_total_with_pkg > 0 else 0.0

    comm_val = float(raw.get("commissionable_value", 0)) or (sub_total + packaging_charges - discount)
    total_fees = abs(float(raw.get("total_fees", 0)))
    gst_on_fees = abs(float(raw.get("gst_on_fees", 0)))
    com_pg_gst = round(total_fees + gst_on_fees, 2)

    complaints_cancellation = float(raw.get("complaints_cancellation", 0))
    tax = float(raw.get("total_taxes", 0))
    ads = manual_ads or float(raw.get("ads", 0))
    
    base_for_ads = sub_total if sub_total > 0 else sub_total_with_pkg
    ads_pct = round((ads / base_for_ads * 100), 2) if base_for_ads > 0 else 0.0
    
    net_payout = float(raw.get("net_payout", 0))
    net_payout_pct = round((net_payout / sub_total_with_pkg * 100), 2) if sub_total_with_pkg > 0 else 0.0
    overall_burn_pct = round(100.0 - net_payout_pct, 2)

    return {
        "section": "swiggy_delivery",
        "periodLabel": period_label,
        "orders": orders,
        "subTotal": sub_total,
        "packagingCharges": packaging_charges,
        "subTotalWithPkg": sub_total_with_pkg,
        "discount": discount,
        "discountPct": discount_pct,
        "commissionableValue": comm_val,
        "comPgGst": com_pg_gst,
        "complaintsCancellation": complaints_cancellation,
        "tax": tax,
        "ads": ads,
        "adsPct": ads_pct,
        "netPayout": net_payout,
        "netPayoutPct": net_payout_pct,
        "overallBurnPct": overall_burn_pct
    }

# -------------------------------------------------------------------
# EXAMPLE USAGE
# -------------------------------------------------------------------
if __name__ == "__main__":
    import os
    API_KEY = os.getenv("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY_HERE")
    
    print("=== Testing Zomato Delivery Parsing ===")
    sample_zomato_raw = {
        "total_orders": 84,
        "sub_total": 62100.0,
        "packaging_charges": 1805.53,
        "sub_total_with_pkg": 63905.53,
        "cancelled_order_refund": 0,
        "discount": 4500.0,
        "commissionable_value": 59405.53,
        "order_level_deduction": 16580.86,
        "tax_deduction": 10280.45,
        "ads": 5900.0,
        "hyperpure": 12000.0,
        "net_payout": 26624.22
    }
    z_res = compute_zomato_delivery(sample_zomato_raw, "1-10 Aug '26")
    print(json.dumps(z_res, indent=2))

    print("\n=== Testing Swiggy Delivery Parsing ===")
    sample_swiggy_raw = {
        "orders": 26,
        "sub_total": 21539.0,
        "packaging_charges": 630.0,
        "sub_total_with_pkg": 22169.0,
        "discount": 1639.88,
        "commissionable_value": 20529.12,
        "total_fees": 5383.41,
        "gst_on_fees": 969.02,
        "complaints_cancellation": 0,
        "total_taxes": 1200.0,
        "ads": 2525.2,
        "net_payout": 11631.0
    }
    s_res = compute_swiggy_delivery(sample_swiggy_raw, "1-10 Aug '26")
    print(json.dumps(s_res, indent=2))
