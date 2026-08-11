# Ethers Dashboard — Pricing Strategy Architecture & Logic Documentation

## 1. Overview
The Pricing Strategy Module automates competitor price discovery and suggestive price calculation for cloud kitchens and restaurants. It extracts live menu item prices from Swiggy in **3-5 seconds** using Swiggy's internal Mobile API (MAPI) and intelligent link discovery algorithms.

---

## 2. Technical Architecture

```
[ Frontend UI (Next.js) ]
       │ (POST /api/pricing-strategy/generate)
       ▼
[ Next.js API Route ]
       │ (POST /api/pricing/scrape)
       ▼
[ Standalone Python Pricing Server (Port 8002) ]
       ├── ThreadPoolExecutor (Parallel Competitor Processing)
       ├── Persistent Disk Cache (`swiggy_links_cache.json`)
       ├── URL Discovery Pipeline (DDGS → Google Fast Search → Hygiene Engine)
       └── MAPI Menu Scraper (`/mapi/menu/pl`)
```

---

## 3. URL Discovery & Validation Pipeline

To locate the exact Swiggy outlet URL for a competitor, the system executes a 5-layer search pipeline:

### Step 0: Persistent Disk Cache (Instant Recall - 0.001s)
- Checks `swiggy_links_cache.json` for normalized key `"{restaurant_name}_{city}"`.
- Uses **Atomic Thread Locks (`CACHE_LOCK`)** and `.tmp` file swapping to prevent file corruption during concurrent client requests.

### Step 1: DuckDuckGo Fast Search (`DDGS`)
- Executes targeted search queries: `site:swiggy.com {restaurant_name} {city}`.
- Governed by `DDGS_LOCK` with a 0.3s delay to prevent search engine rate limits (HTTP 429).

### Step 2: Google Fast Search (`googlesearch-python`)
- If DDGS is rate limited or returns empty, the system instantly invokes `googlesearch-python` (`from googlesearch import search`).
- Direct HTTP Google search without browser overhead (~1-2s response time).

### Step 3: Swiggy Hygiene Scanner Engine
- Integrates the exact search scoring engine from the Hygiene Scanner module.

### Step 4: Playwright Browser Fallback
- Launches headless Chromium only as a last resort if all fast API searches return no results.

---

## 4. Strict City Guard & Location Validation

To prevent returning outlets from incorrect cities (e.g., returning an *Itarsi* link when *Jamshedpur* was requested), every URL passes through strict validation filters:

1. **Swiggy URL City Slug Verification:**
   - Parses `/city/{city_slug}/` directly from the candidate Swiggy URL.
   - Rejects the URL immediately if `{city_slug}` does not match any token of the requested target city.

2. **Mandatory Location Token Filter:**
   - Verifies that at least one location/city token is present in the search result title, snippet, or URL slug.
   - Rejects unverified cross-city links immediately.

---

## 5. High-Speed Scraper (MAPI Integration)

Once the Swiggy outlet URL is resolved:
1. The scraper extracts the numeric `restaurantId` from the URL.
2. It hits Swiggy's internal Mobile API endpoint:
   `https://www.swiggy.com/mapi/menu/pl?page-type=REGULAR_MENU&complete-menu=true&lat=22.8045665&lng=86.2028754&restaurantId={rest_id}`
3. Bypasses front-end rendering, returning the structured full menu JSON instantly in **~1-2 seconds**.

---

## 6. Dish Matcher & Bulk Portion Penalty

The matcher evaluates competitor menu dishes against the user's target items using token overlap ratio and string sequence matching (`SequenceMatcher`).

### Bulk / Combo Penalty Rules:
- Items containing bulk or family keywords (`"pack of"`, `"combo"`, `"family"`, `"bulk"`, `"party"`, `"bucket"`, `"kilo"`) receive a **-0.15 score penalty**.
- **Result:** If a restaurant lists both *"Chicken Chilli Biryani (Pack of 4)"* (₹1236) and *"Chicken Chilli Biryani"* (₹309), the system correctly prioritizes the single portion size for **₹309**.
- Minimum confidence score threshold: **0.45**. If no good match is found, the item is marked as `Not Present`.

---

## 7. Suggestive Price Calculation Formula

The suggestive price balances platform costs with market competitive positioning:

$$\text{Cost Based Target} = \text{Base Price} \times (1 + \text{Total Deductions \%})$$
$$\text{Market Based Target} = \text{Competitor Avg Price} \times 0.95$$
$$\text{Raw Suggestive Price} = \frac{\text{Cost Based Target} + \text{Market Based Target}}{2}$$

- **Guardrails:**
  - Cap floor: Minimum $\text{Base Price} \times 1.10$.
  - Cap ceiling: Maximum $\text{Competitor Max Price} \times 1.20$.
- **Psychological Price Ending:** Rounds final suggestive prices to end in `9`, `7`, or `5` (e.g., ₹199, ₹247, ₹349).
