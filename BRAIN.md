# 🧠 Ethers Dashboard — Master Architecture & Brain Document

Welcome to the **Ethers Dashboard Master Architecture & System Knowledgebase**. This document serves as the single source of truth for the system design, background engines, database models, RBAC rules, and API specifications.

---

## 🏛️ **System Architecture & Tech Stack**

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, Lucide Icons, Framer Motion.
- **Backend APIs**: Next.js API Routes (`/api/...`), Python Flask Automation Server (`port 5000`), Python Hygiene Audit Server (`port 8000`).
- **State Management & Context**: `AutomationStoreContext`, `BrandContext`, `SidebarContext`, `ActivityTrackerProvider`.
- **Database & Data Storage**: Lightweight JSON file persistence with in-memory caching (`data/chat.json`, `data/activity.json`, `data/employees.json`, `data/documents.json`).
- **Browser Automation Engine**: ~~Selenium~~ → **Replaced with Bing Async HTTP Engine** (no browser, no CAPTCHA, multi-threading safe). See Picture Automation section below.

---

## 🗺️ **Complete Route Directory**

| Route / Path | Feature Module | Description & Capabilities |
| :--- | :--- | :--- |
| `/dashboard` | **The Brain Overview** | Executive analytics overview, sales summary, quick actions. |
| `/dashboard/chat` | **Internal Team Chat** | 1-on-1 & Group Channel messaging (`#general`, `#growth-team`, `#tech-ops`), live online/offline badges, message history. |
| `/dashboard/employees` | **Executive Employee Hub** | RBAC accounts management, password generator, HR payslip/offer letter generator, and **Co-Founder Screen Time & Module Analytics**. |
| `/dashboard/picture-automation` | **Food Photo Extraction** | Zomato & Swiggy HD dish photo scraper engine, live SSE logs, candidate link count, bulk image preview/delete, 1-click ZIP export. |
| `/dashboard/menu-automation` | **Menu & Price Hike Engine**| Excel/CSV menu parser, +25% Swiggy/Zomato markup price hike calculator, half-portion 60% rule, variant generator, Excel export. |
| `/dashboard/hygiene-check` | **Hygiene Audit & Store Score**| Store compliance auditor for Zomato/Swiggy brand presence, photo quality, description completeness, and hygiene score (0-100%). |
| `/dashboard/pricing-strategy` | **Pricing & Margin Engine** | Net payout per dish calculator considering platform commission (23-28%), GST, and packaging costs. |
| `/dashboard/discount-calculator` | **Discount Strategy** | Flat % vs Flat ₹ off margin safety caps and campaign profitability calculator. |
| `/dashboard/marketing-strategy` | **Marketing & Growth** | Campaign planner, ROI tracker, ad spend allocation. |
| `/dashboard/projections` | **Sales Projections** | Multi-brand sales forecasting and revenue targets. |
| `/dashboard/brands` | **Brands Directory** | Multi-outlet cloud kitchen management & store URLs. |
| `/dashboard/leads` | **Leads CRM** | Client acquisition pipeline & onboarding tracker. |
| `/dashboard/reporting` | **Reports & Performance** | Detailed financial & operational reports. |
| `/dashboard/settings` | **System Config** | Restaurant branding, logo uploads, system preferences. |

---

## 🔐 **Role-Based Access Control (RBAC)**

### 1. **Co-Founder (Admin Role)**
- Full access to all 14 dashboard modules.
- Employee account creation, password resets, and account deletion.
- HR Document issuance (Payslips, Offer Letters, Experience Certificates).
- **Exclusive View**: `Screen Time & Module Analytics` tab in Employee Hub, tracking exact employee screen time per module and real-time AFK status.

### 2. **Staff Member (Staff Role)**
- Access to operational tools (Picture Automation, Menu Automation, Hygiene Check, Team Chat).
- Personal HR Portal (View & download personal payslips, appointment letter).
- Restricted from employee account management and company-wide screen time analytics.

---

## ⚡ **Background Processing Services & Port Mapping**

- **Port 3000**: Next.js Dev / Production Web Server (`npm run dev` / `npm run start`).
- **Port 5000**: Flask Picture Automation Server (`cd 'data/picture automation' && python app.py`).
- **Port 8000**: Hygiene Audit Compliance Server (`cd 'data/hygeine check' && python server.py`).

---

## ⏱️ **Activity Tracker & Idle Detection Algorithm**

- **Heartbeat Interval**: 30 seconds via `ActivityTrackerProvider.tsx`.
- **Active Focus Enforcement**: Time is tracked **only** when `document.hasFocus()` is true and `document.visibilityState === 'visible'`.
- **AFK Idle Threshold**: Automatically marks employee status as `Idle` after 3 minutes without mouse or keyboard input (`mousemove`, `keydown`, `scroll`).

---

## 📸 **Picture Automation Engine — How It Works**

### ❌ Old Approach (Broken — DO NOT USE)
- Used **Selenium / Playwright** with a headless Chrome browser.
- Searched Google Images for `"<dish name> zomato"` or `"<dish name> swiggy"`.
- **Problems**:
  - Google aggressively blocks automated requests → **CAPTCHA block** after 2-3 searches.
  - Each Chrome instance used **~1.5 GB RAM** → 4 employees = server crash.
  - Headless browser windows randomly popped up on screen.
  - Bot detection would block scraping mid-batch with no recovery.
  - CAPTCHA modal appeared in browser backend — employee **could not solve it** from web dashboard.

### ✅ New Approach — Bing Async HTTP Engine (WORKING — Multi-User Safe)

**Key Insight**: The old code used `bing.com/images/search` (full page HTML) which contains:
- Actual image results ✅
- Sidebar ads, sponsored content, related products ❌
- Random unrelated images from ads ❌

This caused **cats, court/law images, anime, bathroom ads** to appear in food photo results — even though Bing's actual image search showed correct food photos.

**The Fix**: Use Bing's **async image endpoint** instead:
```
GET https://www.bing.com/images/async?q=Seekh+Kabab+food&first=1&count=35&adlt=moderate&mmasync=1
```
This endpoint returns **ONLY actual image search result URLs** — no sidebar noise, no ads, no sponsored content.

### Implementation Details (`data/picture automation/scraper.py`)

**Function**: `_fast_http_cdn_search(food_name, out_dir, count, platform, log_fn)`

```python
# Step 1: Build simple human-like queries (NO fancy context mapping — Bing is smart)
queries = [
    f"{food_name_clean} food",    # e.g. "Seekh Kabab food"
    f"{food_name_clean} recipe",  # e.g. "Seekh Kabab recipe"
]

# Step 2: Hit Bing async endpoint (returns ONLY search results, no ads)
url = f"https://www.bing.com/images/async?q={quote(query)}&first=1&count=35&adlt=moderate&mmasync=1"

# Step 3: Extract image URLs using murl pattern
murls = re.findall(r'murl&quot;:&quot;(https?://[^&]+)&quot;', r.text)

# Step 4: Block paid stock photo sites (watermarks)
exclude_domains = {'shutterstock', 'istockphoto', 'gettyimages', 'dreamstime', 'alamy', ...}

# Step 5: Download + save
```

### Why NOT to add "fancy" context/synonym mapping:
- Adding extra words like `"Indian starter recipe dish"` to queries **confuses Bing** and returns wrong results.
- Example: `"Seek Kabab Indian starter recipe"` → Bing returned **Digital Law / Court** images (unrelated).
- But `"Seekh Kabab food"` → Bing **auto-corrects spelling** and returns perfect Seekh Kabab food photos.
- **Rule**: Trust Bing's intelligence. Keep queries simple — just `"<dish name> food"` or `"<dish name> recipe"`.

### Multi-Threading Safety:
- Zero Chrome/Playwright instances = **zero RAM overhead per employee**.
- `ThreadPoolExecutor(max_workers=20)` — 20 employees can run simultaneously.
- Each session gets isolated download folder: `downloads/<client_id>_<brand>/`.
- Results cached locally — repeat requests for same dish served instantly from disk.

### Speed Comparison:
| Approach | Time per dish | RAM per user | CAPTCHA Risk |
|:---|:---|:---|:---|
| Old Selenium/Chrome | 15–30 seconds | ~1.5 GB | HIGH |
| **New Bing Async HTTP** | **< 1 second** | **< 5 MB** | **ZERO** |

