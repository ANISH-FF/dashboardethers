import urllib.request, re, time

t0 = time.time()
url = "https://www.zomato.com/jamshedpur/moon-brewery-and-restaurant-bistupur/photos"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/'
}
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, timeout=15) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

t1 = time.time()
print(f"Page fetched in {t1-t0:.2f}s, size: {len(html)//1024}KB")

# Current strict filter (no ?  no fit-in)
strict = re.findall(r'https://b\.zmtcdn\.com/data/pictures/[^\s"\'<>?]+\.(?:jpg|jpeg|png)', html)
strict = [u for u in dict.fromkeys(strict) if 'fit-in' not in u]

# Wider filter (allow ?)
wide = re.findall(r'https://b\.zmtcdn\.com/data/pictures/[^\s"\'<>]+\.(?:jpg|jpeg|png)', html)
wide_clean = [u.split('?')[0] for u in wide]  # strip query params
wide_unique = list(dict.fromkeys(wide_clean))

print(f"\nStrict filter (no ?):  {len(strict)} URLs")
for u in strict[:8]:
    print("  ", u)

print(f"\nWide filter (strip ?): {len(wide_unique)} URLs")
for u in wide_unique[:8]:
    print("  ", u)

# Also check sizes of a few
print("\nChecking sizes of first 5 strict URLs:")
for u in strict[:5]:
    try:
        r = urllib.request.Request(u, headers={'User-Agent': headers['User-Agent']})
        with urllib.request.urlopen(r, timeout=8) as res:
            size_kb = len(res.read()) // 1024
            print(f"  {size_kb}KB  {u[-60:]}")
    except Exception as e:
        print(f"  ERROR: {e}  {u[-60:]}")
