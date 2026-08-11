import re
import urllib.parse
import sys
import json

# Reconfigure encoding for Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass


import os

try:
    from googlesearch import search
except ImportError:
    search = None

try:
    from ddgs import DDGS
except ImportError:
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        DDGS = None

# Import hygiene scanner engine's exact search logic
HYGIENE_DIR = os.path.join(os.path.dirname(__file__), '..', 'hygeine check')
if HYGIENE_DIR not in sys.path:
    sys.path.insert(0, os.path.abspath(HYGIENE_DIR))

try:
    from hygiene_scanner_engine import find_restaurant_urls, validate_and_score_result
except Exception as e:
    print(f"[!] Could not import hygiene_scanner_engine: {e}")
    find_restaurant_urls = None
    validate_and_score_result = None


def fetch_swiggy_area_restaurants(area: str = "Golmuri", city: str = "Jamshedpur") -> list:
    """
    Fetches real active restaurants and their Swiggy links via fast DDGS search (No Playwright).
    """
    city_clean = re.sub(r'[^a-zA-Z0-9]', '', city.lower()) or "jamshedpur"
    area_clean = re.sub(r'[^a-zA-Z0-9]', '', area.lower().replace(city_clean, '')) or "golmuri"
    results = []

    if DDGS:
        try:
            with DDGS() as ddgs:
                for r in ddgs.text(f"site:swiggy.com restaurants {area_clean} {city_clean}", max_results=10):
                    url = r.get('href', '')
                    title = r.get('title', '')
                    if "swiggy.com" in url and ("-rest" in url or "/restaurants/" in url or "/city/" in url):
                        clean_name = title.split('|')[0].replace('Order from', '').replace('online in', '').strip()
                        results.append({'name': clean_name or title, 'url': url})
        except Exception as e:
            print(f"[!] Swiggy area fetch error: {e}")

    return results


def is_valid_swiggy_url(url: str, restaurant_name: str = "", city: str = "") -> bool:
    if not url or not isinstance(url, str):
        return False
    u = url.lower().split('?')[0]
    if "swiggy.com" not in u:
        return False
    if "dineout" in u or "accounts.google" in u or "facebook" in u or "login" in u:
        return False
    if "/city/" not in u and "/restaurants/" not in u and "-rest" not in u:
        return False

    if city:
        city_clean = re.sub(r'[^a-z0-9]', '', city.lower())
        city_match = re.search(r'/city/([^/]+)', u)
        if city_match:
            url_city = re.sub(r'[^a-z0-9]', '', city_match.group(1).lower())
            if city_clean and url_city and city_clean not in url_city and url_city not in city_clean:
                print(f"[is_valid_swiggy_url Rejected] City mismatch: url city '{url_city}' != requested city '{city_clean}'")
                return False

    if restaurant_name:
        sig_tokens = [t.lower() for t in re.findall(r'\w+', restaurant_name) if len(t) > 2 and t.lower() not in {'hotel', 'restaurant', 'the', 'and', 'café', 'cafe'}]
        if sig_tokens:
            url_tokens = set(re.findall(r'\w+', u))
            if not any(t in url_tokens or t in u for t in sig_tokens):
                return False
    return True


import threading
import time

DDGS_LOCK = threading.Lock()
CACHE_LOCK = threading.Lock()
CACHE_FILE = os.path.join(os.path.dirname(__file__), 'swiggy_links_cache.json')

def load_disk_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with CACHE_LOCK:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    content = f.read().strip()
                    if content:
                        return json.loads(content)
        except Exception as e:
            print(f"[!] Error reading cache: {e}")
    return {}

def save_disk_cache(key: str, value: str):
    try:
        with CACHE_LOCK:
            current = {}
            if os.path.exists(CACHE_FILE):
                try:
                    with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                        c = f.read().strip()
                        if c:
                            current = json.loads(c)
                except Exception:
                    current = {}
            current[key] = value
            tmp_file = CACHE_FILE + ".tmp"
            with open(tmp_file, 'w', encoding='utf-8') as f:
                json.dump(current, f, indent=2, ensure_ascii=False)
            os.replace(tmp_file, CACHE_FILE)
            global DISK_CACHE
            DISK_CACHE = current
            print(f"[OK] [DISK CACHE SAVED] Saved '{key}' -> '{value}'")
    except Exception as e:
        print(f"[!] Failed to save link cache: {e}")

DISK_CACHE = load_disk_cache()


def find_swiggy_link(restaurant_name: str, location: str = "Golmuri", city: str = "Jamshedpur") -> str:
    """
    Finds the exact Swiggy URL using fast Disk Cache first, DDGS search, and Hygiene Scanner engine.
    """
    name_clean = restaurant_name.strip()
    city_clean = city.strip() if city else location.strip()
    city_slug = re.sub(r'[^a-z0-9]', '', city_clean.lower())
    loc_clean = f"{location}, {city}".strip() if (city and city.lower() not in location.lower()) else location.strip()

    # Step 0: Check Persistent Disk Cache (Instant 0.001s Recall)
    cache_key = f"{name_clean.lower()}_{city_clean.lower()}"
    current_cache = load_disk_cache()
    if cache_key in current_cache and current_cache[cache_key]:
        cached_url = current_cache[cache_key]
        if is_valid_swiggy_url(cached_url, name_clean, city=city_clean):
            print(f"[OK] [DISK CACHE HIT] Instant recall for '{name_clean}' ({city_clean}): {cached_url}")
            return cached_url

    # Method 1: Fast DDGS Search (Targeted City URL Query + Location)
    if DDGS and validate_and_score_result:
        queries_to_try = [
            f"site:swiggy.com {name_clean} {city}" if city else None,
            f"site:swiggy.com {name_clean} {loc_clean}"
        ]
        for query in filter(None, queries_to_try):
            try:
                print(f"[*] [DDGS Search] Query: '{query}'...")
                with DDGS_LOCK:
                    time.sleep(0.3)  # Prevent rate limits on concurrent thread queries
                    ddgs = DDGS()
                    results = list(ddgs.text(query, max_results=5))
                matches = []
                for r in results:
                    score, valid_url = validate_and_score_result(r, name_clean, loc_clean)
                    if valid_url and is_valid_swiggy_url(valid_url, name_clean, city=city):
                        clean_url = valid_url.split('?')[0].replace('/dineout', '')
                        if clean_url.endswith('/menu'):
                            clean_url = clean_url[:-5]
                        matches.append((score, clean_url))
                if matches:
                    matches.sort(key=lambda x: x[0], reverse=True)
                    best_url = matches[0][1]
                    print(f"[OK] [DDGS Validated Swiggy URL]: {best_url}")
                    save_disk_cache(cache_key, best_url)
                    return best_url
            except Exception as e:
                print(f"[!] DDGS error for '{query}': {e}")

    # Method 1.5: Fast Google Search via googlesearch-python (Identical to Hygiene Checker)
    if search and validate_and_score_result:
        try:
            print(f"[*] [Google Fast Search] Querying Google for '{name_clean} {city}'...")
            for url in search(f"site:swiggy.com {name_clean} {city}", num_results=5):
                if "swiggy.com" in url and "dineout" not in url:
                    item = {'href': url, 'title': url, 'body': url}
                    score, valid_url = validate_and_score_result(item, name_clean, loc_clean)
                    if valid_url and is_valid_swiggy_url(valid_url, name_clean, city=city):
                        clean_url = valid_url.split('?')[0].replace('/dineout', '')
                        if clean_url.endswith('/menu'):
                            clean_url = clean_url[:-5]
                        print(f"[OK] [Google Fast Search Validated Swiggy URL]: {clean_url}")
                        save_disk_cache(cache_key, clean_url)
                        return clean_url
        except Exception as e:
            print(f"[!] Google Fast Search error: {e}")

    # Method 2: Swiggy Hygiene Scanner (Direct Fast Search)
    if find_restaurant_urls:
        try:
            print(f"[*] [Hygiene Scanner] Looking up Swiggy URL for: '{name_clean}'...")
            urls = find_restaurant_urls(name_clean, loc_clean)
            if urls and isinstance(urls, dict):
                swiggy_url = urls.get("swiggy_delivery") or urls.get("swiggy")
                if swiggy_url and is_valid_swiggy_url(swiggy_url, name_clean, city=city):
                    clean_url = swiggy_url.split('?')[0].replace('/dineout', '')
                    if clean_url.endswith('/menu'):
                        clean_url = clean_url[:-5]
                    print(f"[OK] [Hygiene Scanner Validated Swiggy URL]: {clean_url}")
                    save_disk_cache(cache_key, clean_url)
                    return clean_url
        except Exception as e:
            print(f"[!] Hygiene scanner error for '{name_clean}': {e}")


    # Method 4: Swiggy Area Collection fallback (Slower but accurate for exact cities)
    try:
        print(f"[*] [Area Collection Fallback] Looking up Swiggy URL for: '{name_clean}'...")
        area_res = fetch_swiggy_area_restaurants(location, city)
        matches = []
        for r in area_res:
            item = {'href': r['url'], 'title': r['name'], 'body': ''}
            score, valid_url = validate_and_score_result(item, name_clean, loc_clean)
            if valid_url and is_valid_swiggy_url(valid_url, name_clean, city=city):
                matches.append((score, valid_url))
        if matches:
            matches.sort(key=lambda x: x[0], reverse=True)
            best_url = matches[0][1].split('?')[0].replace('/dineout', '')
            print(f"[OK] [Area Collection Validated Swiggy URL]: {best_url}")
            save_disk_cache(cache_key, best_url)
            return best_url
    except Exception as e:
        print(f"[!] Area Collection error for '{name_clean}': {e}")
    print(f"[!] No valid Swiggy link found for '{name_clean}'")
    return None
