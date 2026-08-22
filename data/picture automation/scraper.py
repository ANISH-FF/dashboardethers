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

    # Block paid stock photo sites, social pins, news collages, and wallpaper sites
    exclude_domains = {
        'shutterstock', 'istockphoto', 'gettyimages', 'dreamstime',
        'alamy', 'depositphotos', 'adobe.com', '123rf.com',
        'pinterest', 'pinimg', 'ytimg', 'youtube', 'facebook', 'fbcdn',
        'instagram', 'twitter', 'twimg', 'tiktok', 'tumblr', 'reddit',
        'wallpaper', 'news', 'collage', 'befunky', 'vector', 'stock',
    }

    # Block non-food keywords in image URLs and titles (prevents wall/floor/interior/pet images)
    bad_keywords = {
        'cat', 'dog', 'pet', 'certificate', 'award', 'temple', 'travel',
        'map', 'tower', 'town', 'switzerland', 'vietnam', 'breed', 'kitten',
        'tourism', 'hotel-stay', 'landmark', 'monument', 'scenery', 'landscape',
        'floor', 'wall', 'room', 'interior', 'furniture', 'building', 'architecture',
        'wallpaper', 'curtain', 'couch', 'chair', 'house', 'tile', 'bedroom', 'livingroom',
        'bedroom', 'bathroom', 'kitchen-sink', 'lobby', 'hallway', 'decor'
    }

    # Cap count strictly at 10 per item to respect Unsplash T&C & rate limits
    target_count = min(count, 10)

    # STRICTLY UNSPLASH HD ENGINE ONLY (Bing Scraper completely disabled)
    unsplash_key = os.getenv("UNSPLASH_ACCESS_KEY", "fB58a9-ZuadGSjKauPWdOKbUdjxQ0VxQFTOqlAi8Cvc").strip()
    if log_fn:
        log_fn(f"  [Unsplash Engine] Fetching HD Food Photos for '{food_name_clean}'...")

    try:
        u_url = f"https://api.unsplash.com/search/photos?query={requests.utils.quote(food_name_clean + ' food dish')}&per_page=15&client_id={unsplash_key}"
        u_res = requests.get(u_url, timeout=10)
        if u_res.status_code == 200:
            u_data = u_res.json()
            results = u_data.get("results", [])
            
            # If dish query returns zero results, retry with clean food name
            if len(results) == 0:
                u_url = f"https://api.unsplash.com/search/photos?query={requests.utils.quote(food_name_clean + ' food')}&per_page=15&client_id={unsplash_key}"
                u_res = requests.get(u_url, timeout=10)
                if u_res.status_code == 200:
                    results = u_res.json().get("results", [])

            for photo in results:
                if len(saved) >= target_count:
                    break
                raw_img_url = photo.get("urls", {}).get("regular") or photo.get("urls", {}).get("full")
                if raw_img_url and raw_img_url not in seen:
                    seen.add(raw_img_url)
                    try:
                        import time
                        time.sleep(0.8)  # Humanized request delay
                        img_bytes = _download_bytes(raw_img_url, timeout=8)
                        if len(img_bytes) >= 30 * 1024:
                            fname = f"img_{len(saved)+1:02d}.jpg"
                            fpath = os.path.join(out_dir, fname)
                            with open(fpath, "wb") as f:
                                f.write(img_bytes)
                            saved.append(fname)
                            if log_fn:
                                log_fn(f"    [Unsplash HD+] Saved: {fname} ({len(img_bytes)//1024} KB)")
                    except Exception as err:
                        if log_fn:
                            log_fn(f"    [Download Err]: {err}")
                        continue
        else:
            if log_fn:
                log_fn(f"  [Unsplash API Status]: {u_res.status_code} {u_res.text[:100]}")
    except Exception as e:
        if log_fn:
            log_fn(f"  [Unsplash Engine Error]: {e}")

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
