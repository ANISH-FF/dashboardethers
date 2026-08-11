# Ethers Dashboard — System Requirements & Server Running Guide

This guide explains all required Python dependencies, backend servers, and commands needed to run all modules of the Ethers Dashboard.

---

## 1. System Requirements & Dependencies

### Python Requirements
Ensure Python 3.10+ is installed on your system. Install all required Python packages with:

```bash
python -m pip install flask openpyxl requests beautifulsoup4 pandas selenium webdriver-manager duckduckgo_search playwright
```

*Note: Playwright browser setup (if using Playwright engine):*
```bash
python -m playwright install
```

### Node.js Requirements
Ensure Node.js 18+ is installed:
```bash
npm install
```

---

## 2. Ports & Architecture Overview

| Module | Service / Backend | Port | Command |
| :--- | :--- | :--- | :--- |
| **Main Dashboard** | Next.js Frontend & API Gateway | `3000` | `npm run dev` |
| **Hygiene Checker** | Python Live Audit Engine (`server.py`) | `8000` | `python "data/hygeine check/server.py"` |
| **Picture Automation** | Python Scraper Engine (`app.py`) | `5000` | `python "data/picture automation/app.py"` |

---

## 3. How to Run the Project

### Option A: One-Command Start (All Services Together) ⭐ *Recommended*
Runs Next.js Frontend + Hygiene Audit Server + Picture Automation Server concurrently in Git Bash:

```bash
npm run dev:all
```

### Option B: Standalone Startup (Module-by-Module)

#### Step 1: Start Main Dashboard (Port 3000)
```bash
npm run dev
```

#### Step 2: Start Hygiene Checker Backend (Port 8000)
```bash
cd "data/hygeine check"
python server.py
```

#### Step 3: Start Picture Automation Backend (Port 5000)
```bash
cd "data/picture automation"
python app.py
```

---

## 4. How to Stop All Running Servers

To instantly stop and kill all running background processes across ports `3000`, `5000`, and `8000`:

```bash
npm run stop
```

---

## 5. Memory & Performance Notes
- **Idle Memory Usage**:
  - Next.js Dev Server: ~150 MB RAM
  - Hygiene Audit Python Server (port 8000): ~45 MB RAM
  - Picture Automation Python Server (port 5000): ~35 MB RAM
  - **Total Idle RAM**: ~230 MB RAM (Very lightweight!)
- Running `npm run dev:all` consumes minimal background memory while giving you 100% instant functionality across all modules.
