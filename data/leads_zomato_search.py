import sys
import re
import urllib.request
import urllib.parse

try:
    from ddgs import DDGS
except ImportError:
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        DDGS = None

def main():
    if len(sys.argv) < 4:
        print("PHONE:NONE")
        return
        
    city = sys.argv[1].strip()
    name = sys.argv[2].strip()
    area = sys.argv[3].strip()
    
    query = f"Zomato {city} {name} {area}"
    z_url = None
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }

    if DDGS:
        try:
            ddgs = DDGS()
            results = list(ddgs.text(query, max_results=5))
            for r in results:
                href = r.get("href", "")
                if "zomato.com" in href and city.lower() in href.lower() and not any(b in href for b in ["/order", "/reviews", "/photos"]):
                    z_url = href.split("?")[0]
                    break
        except Exception as e:
            pass

    if z_url:
        try:
            req = urllib.request.Request(z_url, headers=headers)
            with urllib.request.urlopen(req, timeout=5) as resp:
                html = resp.read().decode('utf-8', errors='ignore')
                tels = re.findall(r'href="tel:([^"]+)"', html)
                if tels:
                    print(f"PHONE:{tels[0]}")
                    return
        except Exception as e:
            pass

    print("PHONE:NONE")

if __name__ == "__main__":
    main()
