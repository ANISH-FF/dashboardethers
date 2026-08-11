# Ethers Consultancy — Executive Operations & AI Intelligence Dashboard

An all-in-one executive AI dashboard engineered specifically for **F&B Consulting, Restaurant Chain Operations, Competitor Price Benchmarking, and HR Document Management**.

---

## ⚡ Architectural Superiority: Why AI-First Grounding Beats Legacy Scraping

| Capability | Legacy Scraping Architecture (Playwright / Puppeteer) | **Ethers AI-First Architecture (Gemini Grounding)** |
| :--- | :--- | :--- |
| **Execution Speed** | 🐢 **Hours to Days** (Slow headless browser rendering & queue delays) | ⚡ **~2 Seconds** (Instant real-time AI Search Grounding) |
| **Anti-Bot & Captcha Resilience** | ❌ **High Failure Rate** (Fails when Swiggy/Zomato update Cloudflare/captchas) | ✅ **100% Resilient** (Bypasses browser DOM dependencies via search grounding) |
| **Infrastructure Cost** | 💸 **Expensive ($200+/mo)** (Requires Redis queues, Chrome clusters, worker nodes) | 🟢 **Ultra-Lightweight** (Runs smoothly on standard 2-Core / 8GB VPS) |
| **Maintenance Burden** | 🛠️ **High** (Constantly breaks on HTML/CSS selector changes) | 🛡️ **Zero DOM Maintenance** (Semantic AI understanding of menu structures) |
| **User Experience** | ⌛ **Delayed Async Jobs** | 🚀 **Real-Time Interactive AI Recommendations** |

---

## 🚀 Core Platform Modules

1. **Menu Automation & AI Enhancer**: Generates high-converting item descriptions, subcategories, and recommended add-ons using Gemini AI.
2. **Hygiene Auditor (Vision AI)**: Computer-vision quality and cleanliness auditor for kitchen, dining, and food prep areas.
3. **Picture Automation Engine**: Intelligent food item image finder and automated downloader for restaurant listings.
4. **Competitor Pricing Strategy & OCR**: Instant competitor price benchmarking via AI Search Grounding + OCR menu parsing.
5. **Financial Projections & Excel Engine**: Instant revenue, order volume, AOV, and margin projections with full Excel state persistence.
6. **Marketing Campaign & Dine-In/Dineout Planner**: Data-driven promotion strategies, campaign ROI forecasting, and Dineout Ad product directory.
7. **Official HR Record & Certificate Generator**: Ultra-premium A4 PDF employment certificate generator with custom vector rosette seal and cursive signatures.

---

## 🛠️ Stack & Setup

* **Frontend & Server**: Next.js 14 (App Router), TypeScript, TailwindCSS
* **AI Intelligence**: Google Gemini API (Grounding & Multimodal Vision)
* **Backends**: Python (Flask / OpenCV / Tesseract OCR / Pandas)
* **Process Manager**: PM2 (24/7 background execution)
* **Web Server & SSL**: Nginx + Certbot (HTTPS)

### Environment Variables (`.env`)

```env
GEMINI_API_KEY=your_gemini_api_key_here
SESSION_SECRET=a_secure_random_string_for_signed_cookies
```

### Local Development

```bash
# Install Node dependencies
npm install

# Build Next.js app
npm run build

# Start production server
npm run start
```

---

## 🔒 Security & Privacy

* **Isolated Session Security**: Signed-cookie authentication (`lib/auth.ts`).
* **Environment Protection**: Restricted `.env` file permissions on Linux VPS (`600` root lock).
* **Zero Ephemeral Data Loss**: Persistent JSON storage in `/data` and uploaded media assets in `/public/uploads`.
