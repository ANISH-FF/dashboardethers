"""
Food Image Batch Scraper — Bing Async HTTP Engine
==================================================
Flow per item:
  1. Hit Bing's async image endpoint (no browser, no CAPTCHA)
  2. Parse actual image result URLs using murl pattern
  3. Filter out paid stock photo sites and non-food homonyms
  4. Download and rename images (e.g. paneer_butter_masala_01.jpg ...)

Requirements:
    pip install requests openpyxl
"""

import os
import re
import zipfile

import requests


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def slugify(text):
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]", "_", text.strip().lower())).strip("_")


def parse_item_list(filepath):
    """Parse Excel (.xlsx/.xls), CSV, or plain-text file → list of item names."""
    ext = os.path.splitext(filepath)[1].lower()
    items = []
    skip_headers = {"none", "item", "food", "name", "items", "food item",
                    "food name", "dish", "dish name", "product"}

    if ext in (".xlsx", ".xls"):
        import openpyxl
        wb = openpyxl.load_workbook(filepath, data_only=True)
        ws = wb.active
        for row in ws.iter_rows():
            for cell in row:
                val = str(cell.value or "").strip()
                if val and val.lower() not in skip_headers:
                    items.append(val)
    elif ext == ".csv":
        import csv
        with open(filepath, newline="", encoding="utf-8-sig") as f:
            for row in csv.reader(f):
                for cell in row:
                    val = cell.strip()
                    if val and val.lower() not in skip_headers:
                        items.append(val)
    else:
        with open(filepath, encoding="utf-8") as f:
            for line in f:
                val = line.strip().strip(",")
                if val and val.lower() not in skip_headers:
                    items.append(val)

    seen, unique = set(), []
    for item in items:
        k = item.lower()
        if k not in seen:
            seen.add(k)
            unique.append(item)
    return unique


def _download_bytes(url, referer="https://www.bing.com/", timeout=10):
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
        "Referer": referer,
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
    }
    r = requests.get(url, headers=headers, timeout=timeout)
    r.raise_for_status()
    return r.content


# ─────────────────────────────────────────────
# Core: Bing Async HTTP Image Engine
# ─────────────────────────────────────────────

def _fast_http_cdn_search(food_name, out_dir, count, platform="zomato", log_fn=None):
    food_name_clean = food_name.strip().title()
    saved = []
    seen = set()

    # Block paid stock photo sites & social/adult pin collages
    exclude_domains = {
        'shutterstock', 'istockphoto', 'gettyimages', 'dreamstime',
        'alamy', 'depositphotos', 'adobe.com', '123rf.com',
        'pinterest', 'pinimg', 'ytimg', 'youtube', 'facebook', 'fbcdn',
        'instagram', 'twitter', 'twimg', 'tiktok', 'tumblr', 'reddit',
    }

    # Block non-food keywords in image URLs
    bad_keywords = {
        'cat', 'dog', 'pet', 'certificate', 'award', 'temple', 'travel',
        'map', 'tower', 'town', 'switzerland', 'vietnam', 'breed', 'kitten',
        'tourism', 'hotel-stay', 'landmark', 'monument', 'scenery', 'landscape'
    }

    # Targeted culinary queries (prevents non-food homonyms like Cham Cham Switzerland or Peda cats)
    queries = [
        f"Indian sweet mithai dish {food_name_clean} recipe",
        f"Indian food dish {food_name_clean} photography",
    ]

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Referer": "https://www.bing.com/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Cookie": "SRCHHPGUSR=ADLT=DEMAND&NRSL=35; _EDGE_S=F=1;"
    }

    if log_fn:
        log_fn(f"  [Photo Engine] Searching '{food_name_clean}' photos...")

    for query in queries:
        if len(saved) >= count:
            break
        try:
            # Bing async endpoint — Strict SafeSearch enforced for Datacenter / VPS IPs
            url = f"https://www.bing.com/images/async?q={requests.utils.quote(query)}&first=1&count=35&adlt=strict&mmasync=1"
            r = requests.get(url, headers=headers, timeout=8)
            if r.status_code == 200:
                murls = re.findall(r'murl&quot;:&quot;(https?://[^&]+)&quot;', r.text)
                for img_url in murls:
                    if len(saved) >= count:
                        break
                    if not img_url or img_url in seen:
                        continue

                    # Block paid stock sites and non-food domains
                    u_lower = img_url.lower()
                    if any(bad in u_lower for bad in exclude_domains):
                        continue
                    if any(bad in u_lower for bad in bad_keywords):
                        continue

                    seen.add(img_url)

                    try:
                        img_bytes = _download_bytes(img_url, timeout=5)
                        if len(img_bytes) < 90 * 1024:  # Minimum 90 KB quality threshold
                            continue
                        ext = "webp" if "webp" in img_url.lower() else ("png" if "png" in img_url.lower() else "jpg")
                        fname = f"img_{len(saved)+1:02d}.{ext}"
                        fpath = os.path.join(out_dir, fname)
                        with open(fpath, "wb") as f:
                            f.write(img_bytes)
                        saved.append(fname)
                        if log_fn:
                            log_fn(f"    [+] Downloaded: {fname} ({len(img_bytes)//1024} KB)")
                    except Exception:
                        continue
        except Exception:
            pass

    return saved


# ─────────────────────────────────────────────
# Per-item orchestrator
# ─────────────────────────────────────────────

def scrape_item(item_name, base_dir, count, platform="zomato",
                log_fn=None, stop_flag=None, driver=None):
    safe = slugify(item_name)
    item_dir = os.path.join(base_dir, safe)
    os.makedirs(item_dir, exist_ok=True)

    if log_fn:
        log_fn(f"\n{'='*52}")
        log_fn(f"  ITEM: {item_name}  [{platform.upper()}]")
        log_fn(f"{'='*52}")

    saved = _fast_http_cdn_search(
        item_name, item_dir, count, platform=platform, log_fn=log_fn)

    # Rename: {safe_name}_01.jpg …
    renamed, idx = [], 1
    for fname in sorted(os.listdir(item_dir)):
        src_path = os.path.join(item_dir, fname)
        if not os.path.isfile(src_path):
            continue
        ext = os.path.splitext(fname)[1].lower() or ".jpg"
        new_name = f"{safe}_{idx:02d}{ext}"
        new_path = os.path.join(item_dir, new_name)
        try:
            if src_path != new_path:
                os.rename(src_path, new_path)
        except Exception:
            pass
        renamed.append(new_name)
        idx += 1

    if log_fn:
        log_fn(f"\n  [OK] '{item_name}' -> {len(renamed)} image(s) saved")
    return item_dir, renamed


# ─────────────────────────────────────────────
# ZIP
# ─────────────────────────────────────────────

def create_zip(base_dir, zip_path):
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(base_dir):
            for fname in sorted(files):
                fp = os.path.join(root, fname)
                arcname = os.path.relpath(fp, start=os.path.dirname(base_dir))
                zf.write(fp, arcname=arcname)
    return zip_path
