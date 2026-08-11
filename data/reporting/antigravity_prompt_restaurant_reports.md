# Build Prompt for Antigravity — Zomato/Swiggy Automated Payout Report Tool

## 1. What to build
A web app for a restaurant owner to upload Zomato/Swiggy payout screenshots or exported
files, extract the numbers automatically (using Gemini 2.5 Flash for OCR/extraction only),
run ALL calculations in application code (not the LLM), and produce a running,
period-by-period report table — same structure as the reference Excel described below.

**Cost principle:** Gemini 2.5 Flash is called ONLY to read an image and return raw
numbers as JSON. It never does arithmetic, percentages, or aggregation. All formulas
live in the backend code so the numbers are deterministic and auditable.

---

## 2. User flow

**Important — periods are NOT locked to calendar months.** The restaurant owner
generates reports on their own cadence (e.g. every 10 days: 1st–10th, 11th–20th,
21st–end), and separately, Zomato/Swiggy's own payout cycles often don't align to
calendar months either (e.g. "26th Jul–31st Jul"). So instead of a rigid "Month"
selector, use a **flexible period**:

1. User picks **Platform**: `Zomato` or `Swiggy`
2. User picks **Report type**: `Delivery` or `Dine-in / Dineout`
3. User defines the **Reporting Period** for this report — either:
   - a start date + end date (covers their 10-day cadence, or any custom range), or
   - a quick-pick of "This month" / "Last 10 days" / "Custom range" for convenience
4. Upload UI changes based on the combination picked (see section 3)
5. On submit → backend extracts → backend computes → a column for that exact period
   (labelled with its date range, e.g. "1–10 Aug '26") is inserted/updated in the
   running report table → user can view/export.
6. Re-uploading for a platform/type where the **exact same period already exists**
   should **overwrite** that period's column, not duplicate it (there's already a
   note in the source sheet about this exact behavior — "jab naya data aayega purana
   replace hoga"). Periods are matched by exact date range, not by month name, so
   "1–10 Aug" and "1–31 Aug" are treated as different, independent columns — both can
   coexist if the owner wants both a 10-day view and a monthly rollup.
7. Optional but useful: a "roll up to month" view that auto-sums all periods whose
   date ranges fall fully inside a calendar month, purely for a monthly summary —
   without forcing every upload to be monthly.

---

## 3. The four data sources (exact fields to extract per type)

### A) Zomato Delivery — 2 screenshots per period
The Zomato payout-details popup needs to be scrolled, so the user gives 2 screenshots
covering the full popup for the period's payout cycle. Extract these fields (they appear
under labelled sections in the screenshot):

- Net payout, Payout Cycle (date range)
- Total orders
- Net order value (A): Item subtotal, Packaging charges, Total GST collected from
  customers, Restaurant discount (Promos), Restaurant discount (Flat offs/Freebies/
  Gold/relisted/others), Delivery charge discount
- Additions (B): Cancelled order refunds, TDS 194H, TDS 194C
- Order level deductions (C): Base service fee, Payment mechanism fee, Customer
  compensation/recoupment, Rejection penalty
- Tax deductions (D): GST on service & payment mechanism fees @18%, TDS 194O,
  GST paid by Zomato on behalf of restaurant u/s 9(5)
- Investments in growth (E): Online ordering ads (incl 18% GST)
- Hyperpure spend (F)
- Est. payout (A+B+C+D+E+F)

### B) Zomato Dine-in — 1 Excel file per period (native export, e.g. "La Soirée...xlsx")
Parse directly with a spreadsheet library (no LLM needed). Read the `Summary` sheet:
- Report period, Total number of transactions, Total sales
- Total Additions (Tips for kitchen staff, Ads, Forfeited amount, Other additions)
- Total deductions (Commissions, Attributed Discounts, Ads, Other deductions)
- Tax rate, Tax on commissions
- Net Payout, Settled, Unsettled

### C) Swiggy Delivery — 1 screenshot per WEEK, multiple weeks per period
Swiggy only shows weekly payout cards (not monthly), so the user will upload several
screenshots (one per week) tagged to the same reporting period. Extract per screenshot:
- Payout period (date range), Total Orders
- (A) Total Customer Paid
- (B) Total Fees
- (C) Complaint & Cancellation Charges
- (D) Total Taxes
- (E) Growth Investments in Ads
- (F) Other Charges & Refunds
- Net Payout (A+B+C+D+E+F)

**Aggregation logic required:** sum all fields (A–F, Net Payout, Orders) across every
weekly screenshot the user tagged to that period. If a week's date range spans across
the period boundary, let the user assign it to whichever period they choose at upload
time (don't try to auto-split it — keep this simple and manual).

### D) Swiggy Dineout — 1 CSV export per period (date-range export)
Parse directly with a CSV/dataframe library (no LLM needed). Columns present:
`Bill Amount (A)`, `Base Discount Amount (B)`, `Coupon Discount Amount (C)`,
`DineCash discount (D)`, `Net Amount (E = A-B-C-D)`, `Commission (F)`, `GST (G)`,
`Tip Amount (H)`, `Amount Receivable`, `Transaction Status`.

- Filter rows to `Transaction Status == completed` and within the selected period's date range.
- Sum: Bill Amount → Pre GMV; Net Amount → Post GMV; (B+C+D) → total discount;
  (F+G) → commission+GST; Amount Receivable → Net Payout; row count → Transactions.
- **Known gap:** some CSV exports don't include an Ads column at all. If no Ads data
  exists in the file, default Ads to 0 for that period AND show a UI flag/input so the
  user can manually type the Ads figure in if they have it from elsewhere. Never
  silently guess a number.

---

## 4. Output structure (must match this exactly — it's the existing tracker format)

Four sections, each a table of **metrics (rows) × periods (columns)**, so every new
upload just adds a new column onto the existing ones (columns are labelled by their
date range, e.g. "1–10 Aug '26", not forced into calendar months):

**Zomato Delivery:** Orders → Sub Total → Packaging Charges → Sub Total+Packaging →
Cancelled Order Refund → Discount → Discount% → Commissionable Value (incl. GST
collected) → Order-level Deduction (Comm+PG) → Tax Deduction → Ads → Ads% →
Hyperpure → Net Payout → Net Payout+Hyperpure → Net Payout% → Overall Burn%
(= 1 − Net Payout%)

**Swiggy Delivery:** Orders → ST (Item Total) → PC (Packaging Charges) → ST+PC →
Discount → Discount% (=Discount/(ST+PC)) → Commissionable Value/Total Customer
Paid → Total Fees (Comm+PG+GST) → Complaints & Cancellation Charges → Total Taxes →
Ads → Ads% (=Ads/ST) → Net Payout → Net Payout% (=Net Payout/(ST+PC)) →
Overall Burn%

**Zomato Dine-in:** Transactions → Pre GMV (Bill Amount) → Post GMV (Bill Amount −
Base Discount) → Discount → Discount% (=Discount/Pre GMV) → Commission+GST →
Commission% (=Commission/Post GMV) → Ads → Net Payout (=Post GMV − Commission − Ads)
→ Net Payout% (=Net Payout/Pre GMV) → Overall Burn% (=1 − Net Payout%)

**Swiggy Dineout:** Transactions → Pre GMV (Bill Amount) → Post GMV (Net Amount) →
Discount (Base+Coupon+DineCash) → Discount% (=Discount/Bill Amount) →
Commission+GST → Commission% (=Commission/Post GMV) → Ads (manual/0 if missing) →
Net Payout (Amount Receivable, summed) → Net Payout% (=Net Payout/Pre GMV) →
Overall Burn%

All percentage formulas should be computed in code exactly as shown above (these are
taken directly from the working reference sheet's existing formulas — don't invent
new ones).

---

## 5. Tech / implementation notes

- **Frontend:** simple form — Platform dropdown → Type dropdown → Period picker (date range) →
  dynamic upload zone (single file, multiple files, or Excel/CSV depending on
  selection from section 3) → Submit.
- **Backend:**
  - Route images to Gemini 2.5 Flash with a strict extraction prompt: "Return ONLY
    valid JSON with these exact keys: {...}. Do not compute anything, do not add
    commentary, just read the numbers as shown in the image." Use the field lists
    in section 3A/3C as the JSON schema.
  - Route Excel/CSV files to a direct parser (pandas/openpyxl or equivalent) — no
    LLM call at all for these, since the data is already structured.
  - Store raw extracted values in a database table keyed by
    `(platform, type, period_start, period_end, source_file_id)`.
  - A separate calculation layer reads the raw values and computes every derived
    metric per section 4, writes/overwrites that period's column in the report table.
- **Storage:** one row per period per metric (or a wide table with period columns —
  either works, but keep raw extracted values and computed values separate so
  formulas can be re-run later if a formula needs correcting).
- **Export:** allow downloading the full report table as an Excel file mirroring
  section 4's layout (metrics as rows, periods as columns, 4 separate sheets/blocks),
  plus the optional monthly roll-up view from section 2.7.
- **Validation:** if extraction confidence is low or a required field is missing
  from a screenshot, show the raw extracted JSON to the user before saving so they
  can correct a misread number rather than silently trusting OCR.

---

## 6. Edge cases to explicitly handle
- Swiggy Delivery: multiple weekly screenshots per period, must sum, not overwrite
  each other — need a way to add several files under one period before finalizing.
- Swiggy Dineout: Ads column sometimes absent from the CSV entirely — handle via
  manual override field, default 0, never fabricate.
- Re-uploading a period that already has data (exact same date range) → overwrite
  that period's column only.
- A payout cycle that doesn't align with a calendar month (e.g. "26th Jul–31st Jul")
  → this is naturally solved since periods are defined by exact date range, not
  forced into a calendar month bucket.
