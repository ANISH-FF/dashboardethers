import sys
import json
import re
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

try:
    from ddgs import DDGS
except ImportError:
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        DDGS = None

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.google.com/"
}

def slugify(text):
    text = text.lower().strip()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s-]+', '-', text)
    return text.strip('-')

def extract_tel(url):
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=4) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            tels = re.findall(r'href="tel:([^"]+)"', html)
            if tels:
                return tels[0]
    except Exception:
        pass
    return None

def process_outlet(item):
    name = item.get("name", "").strip()
    area = item.get("area", "").strip()
    city = item.get("city", "Jamshedpur").strip()
    
    if not name:
        return {"name": name, "area": area, "phone": None}

    city_slug = slugify(city)
    clean_name = name.split("-")[0].split("(")[0].strip()
    name_slug = slugify(clean_name)
    area_slug = slugify(area)
    
    candidates = [
        f"https://www.zomato.com/{city_slug}/{name_slug}-{area_slug}",
        f"https://www.zomato.com/{city_slug}/{name_slug}",
        f"https://www.zomato.com/{city_slug}/{slugify(name)}-{area_slug}",
        f"https://www.zomato.com/{city_slug}/{slugify(name)}",
        f"https://www.zomato.com/{city_slug}/{name_slug}-bistupur",
        f"https://www.zomato.com/{city_slug}/{name_slug}-sakchi",
        f"https://www.zomato.com/{city_slug}/{name_slug}-mango",
    ]
    
    for url in list(set(candidates)):
        phone = extract_tel(url)
        if phone:
            return {"name": name, "area": area, "phone": phone}

    # Fallback: DDGS Search Engine
    if DDGS:
        queries = [
            f"site:zomato.com/{city_slug} {clean_name} {area}",
            f"Zomato {city} {clean_name} {area}",
            f"Zomato {city} {clean_name}"
        ]
        
        for q in queries:
            try:
                ddgs = DDGS()
                results = list(ddgs.text(q, max_results=4))
                for r in results:
                    href = r.get("href", "")
                    if "zomato.com" in href and city_slug in href.lower() and not any(b in href for b in ["/order", "/reviews", "/photos"]):
                        clean_url = href.split("?")[0]
                        phone = extract_tel(clean_url)
                        if phone:
                            return {"name": name, "area": area, "phone": phone}
            except Exception:
                pass

    return {"name": name, "area": area, "phone": None}

def main():
    try:
        input_data = ""
        if len(sys.argv) > 1:
            import base64
            input_data = base64.b64decode(sys.argv[1]).decode("utf-8")
        else:
            input_data = sys.stdin.read().strip()

        if not input_data:
            print(json.dumps([]))
            return
            
        outlets = json.loads(input_data)
        results = []
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            results = list(executor.map(process_outlet, outlets))
            
        print(json.dumps(results))
    except Exception as e:
        sys.stderr.write(str(e))
        print(json.dumps([]))

if __name__ == "__main__":
    main()
