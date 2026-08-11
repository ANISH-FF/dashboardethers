import re
import json
import urllib.parse
import sys
import os
import csv
import time
from datetime import datetime

# Reconfigure stdout/stderr for Windows UTF-8 console output
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Playwright disabled completely for zero-browser fast HTTP operation
HAS_PLAYWRIGHT = False

# Check for requests / curl_cffi availability
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


class SwiggyMenuScraper:
    def __init__(self):
        self.restaurant_info = {
            'name': 'Unknown Restaurant',
            'city': '',
            'area': '',
            'rating': 'N/A',
            'total_ratings': '',
            'cuisines': ''
        }
        self.menu_items = []

    def fetch_menu_from_url(self, swiggy_url: str):
        """Main method to fetch menu from any Swiggy restaurant link."""
        swiggy_url = swiggy_url.strip()
        if "swiggy.com" not in swiggy_url:
            raise ValueError("Invalid link! Please enter a valid Swiggy restaurant link.")

        print(f"[*] Target Swiggy Link: {swiggy_url}")
        print("[*] Launching fast menu extractor...")

        # Strategy 1: Direct HTTP DAPI Request (Fastest)
        if HAS_REQUESTS:
            try:
                success = self._fetch_via_http(swiggy_url)
                if success and self.menu_items:
                    print("[✓] Menu fetched instantly via HTTP!")
                    return self.restaurant_info, self.menu_items
            except Exception as e:
                import traceback
                print(f"[!] HTTP strategy error:")
                traceback.print_exc()

        # Strategy 2: Playwright Interceptor (Fallback if AWS WAF blocks HTTP)
        if HAS_PLAYWRIGHT:
            try:
                print("[*] HTTP failed, falling back to Playwright interceptor...")
                success = self._fetch_via_playwright(swiggy_url)
                if success and self.menu_items:
                    return self.restaurant_info, self.menu_items
            except Exception as e:
                import traceback
                print(f"[!] Playwright strategy error:")
                traceback.print_exc()

        return self.restaurant_info, self.menu_items

    def fetch_live_item_prices(self, swiggy_url: str, item_list: list) -> dict:
        """
        Fetches the exact customer display price shown on Swiggy's UI by searching each dish on the restaurant page.
        Returns dict: { item_name: { 'matchedName': str, 'price': float } }
        """
        results = {}
        if not HAS_PLAYWRIGHT or not item_list:
            return results

        try:
            swiggy_url = swiggy_url.strip().split('?')[0]
            with sync_playwright() as p:
                browser = None
                for channel in [None, "msedge", "chrome"]:
                    try:
                        browser = p.chromium.launch(headless=True, channel=channel)
                        break
                    except Exception:
                        continue

                if not browser:
                    return results

                context = browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                    viewport={"width": 1366, "height": 768}
                )
                page = context.new_page()

                for user_item in item_list:
                    encoded_query = urllib.parse.quote(user_item.lower())
                    search_url = f"{swiggy_url}/search?hideHeader=false&query={encoded_query}"
                    
                    try:
                        page.goto(search_url, timeout=5000)
                        page.wait_for_timeout(600)
                        
                        dishes = page.evaluate("""() => {
                            const list = [];
                            const elements = document.querySelectorAll('div, h3, span');
                            elements.forEach(el => {
                                const txt = el.innerText || '';
                                if (txt.includes('₹') && txt.split('\\n').length >= 2) {
                                    const parts = txt.split('\\n').map(s => s.trim()).filter(Boolean);
                                    if (parts.length >= 2) {
                                        list.push(parts);
                                    }
                                }
                            });
                            return list;
                        }""")

                        matched_price = None
                        matched_name = None

                        for parts in dishes:
                            for idx, part in enumerate(parts):
                                if user_item.lower() in part.lower() or part.lower() in user_item.lower():
                                    for p_text in parts[idx:]:
                                        m = re.search(r'₹\s*(\d+)', p_text)
                                        if m:
                                            matched_price = float(m.group(1))
                                            matched_name = part
                                            break
                                if matched_price:
                                    break
                            if matched_price:
                                break

                        if matched_price:
                            results[user_item] = {"matchedName": matched_name, "price": matched_price}
                            print(f"[✓ Live UI Price] '{user_item}' ➔ '{matched_name}' @ ₹{matched_price}")
                    except Exception as e:
                        print(f"[!] Live search error for '{user_item}': {e}")

                browser.close()
        except Exception as e:
            print(f"[!] fetch_live_item_prices error: {e}")

        return results

    def _fetch_via_playwright(self, swiggy_url: str) -> bool:
        """Use headless browser to capture DAPI JSON or extract __NEXT_DATA__ from DOM."""
        captured_dapi_json = None

        with sync_playwright() as p:
            # Try launching Chromium / Edge / Chrome
            browser = None
            for channel in [None, "msedge", "chrome"]:
                try:
                    kwargs = {
                        "headless": True,
                        "args": [
                            '--disable-blink-features=AutomationControlled',
                            '--no-sandbox'
                        ]
                    }
                    if channel:
                        kwargs["channel"] = channel
                    browser = p.chromium.launch(**kwargs)
                    break
                except Exception:
                    continue

            if not browser:
                browser = p.chromium.launch(headless=True)

            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                viewport={"width": 1366, "height": 768}
            )

            page = context.new_page()

            # Listener for menu JSON responses
            def on_response(response):
                nonlocal captured_dapi_json
                if response.status == 200:
                    try:
                        ct = response.headers.get("content-type", "").lower()
                        if "json" in ct or "text" in ct:
                            data = response.json()
                            raw_str = json.dumps(data)
                            if "groupedCard" in raw_str or "itemCards" in raw_str:
                                captured_dapi_json = data
                                print("[✓] Swiggy Menu Network Data captured successfully!")
                    except Exception:
                        pass

            page.on("response", on_response)

            try:
                page.goto(swiggy_url, timeout=35000)
                page.wait_for_timeout(2000)

                # Strategy A: Extract __NEXT_DATA__ directly from DOM (instant)
                try:
                    dom_json_str = page.evaluate("""() => {
                        const script = document.querySelector('script#__NEXT_DATA__');
                        return script ? script.innerText : null;
                    }""")
                    if dom_json_str:
                        dom_json = json.loads(dom_json_str)
                        self._parse_swiggy_dapi_json(dom_json)
                        if len(self.menu_items) > 0:
                            print(f"[✓] Extracted {len(self.menu_items)} items directly from __NEXT_DATA__ DOM!")
                            return True
                except Exception as dom_err:
                    print(f"[!] DOM extraction attempt: {dom_err}")

                # Scroll slightly to trigger XHR network requests if DOM missed
                for _ in range(4):
                    if captured_dapi_json:
                        break
                    page.mouse.wheel(0, 500)
                    page.wait_for_timeout(800)

            finally:
                browser.close()

        if captured_dapi_json:
            self._parse_swiggy_dapi_json(captured_dapi_json)
            return len(self.menu_items) > 0

        return False

    def _fetch_via_http(self, swiggy_url: str) -> bool:
        """Direct HTTP request attempt using MAPI (speedy hack)."""
        import urllib.request
        import urllib.parse
        
        # Extract restaurant ID
        match_id = re.search(r'(?:rest|-)?(\d+)(?:\?|$|/|\s)', swiggy_url)
        if not match_id:
            return False
            
        rest_id = match_id.group(1)
        api_url = f"https://www.swiggy.com/mapi/menu/pl?page-type=REGULAR_MENU&complete-menu=true&lat=22.8045665&lng=86.2028754&restaurantId={rest_id}"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://www.swiggy.com/'
        }

        try:
            req = urllib.request.Request(api_url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as response:
                json_data = json.loads(response.read().decode('utf-8'))
                self._parse_swiggy_dapi_json(json_data)
                if len(self.menu_items) > 0:
                    print(f"[✓] Extracted {len(self.menu_items)} items via MAPI (Speedy Hack)!")
                    return True
        except Exception as e:
            print(f"[!] MAPI scrape attempt failed: {e}")

        return False

    def _parse_swiggy_dapi_json(self, json_data: dict):
        """Parse Swiggy menu JSON structure robustly."""
        self.menu_items = []
        seen_names = set()

        def extract_items_recursive(obj, current_category="General"):
            if isinstance(obj, dict):
                # Restaurant info check
                if 'name' in obj and 'avgRating' in obj and not self.restaurant_info['name'] != 'Unknown Restaurant':
                    self.restaurant_info['name'] = obj.get('name', 'Unknown')
                    self.restaurant_info['city'] = obj.get('city', '')
                    self.restaurant_info['area'] = obj.get('areaName', '')
                    self.restaurant_info['rating'] = str(obj.get('avgRating', 'N/A'))
                    self.restaurant_info['total_ratings'] = obj.get('totalRatingsString', '')
                    self.restaurant_info['cuisines'] = ", ".join(obj.get('cuisines', []))

                # Item check
                if 'info' in obj and isinstance(obj['info'], dict) and 'name' in obj['info']:
                    info = obj['info']
                    name = info.get('name', '').strip()
                    if name and name not in seen_names:
                        price_paise = info.get('price') or info.get('defaultPrice') or 0
                        price_inr = round(price_paise / 100, 2)
                        final_paise = info.get('finalPrice')
                        final_inr = round(final_paise / 100, 2) if final_paise else price_inr
                        is_veg = info.get('isVeg') == 1 or info.get('itemAttribute', {}).get('vegClassifier') == 'VEG'
                        in_stock = info.get('inStock', 1) == 1
                        description = info.get('description', '').strip()

                        if price_inr > 0:
                            seen_names.add(name)
                            self.menu_items.append({
                                'category': current_category,
                                'name': name,
                                'price': price_inr,
                                'final_price': final_inr,
                                'type': 'VEG' if is_veg else 'NON-VEG',
                                'in_stock': 'Yes' if in_stock else 'No (Out of Stock)',
                                'description': description
                            })

                title = obj.get('title', current_category)
                new_cat = title if isinstance(title, str) and title.strip() else current_category

                for k, v in obj.items():
                    extract_items_recursive(v, new_cat if k in ['card', 'itemCards', 'categories', 'cards'] else current_category)

            elif isinstance(obj, list):
                for item in obj:
                    extract_items_recursive(item, current_category)

        extract_items_recursive(json_data)

    def _extract_item_data(self, item_card: dict, category_title: str) -> dict:
        """Extract item name, price, veg/nonveg status, etc."""
        info = item_card.get('card', {}).get('info', {})
        if not info:
            return None

        name = info.get('name', 'Unknown Item').strip()
        
        # Prices in paise (1 INR = 100 paise)
        price_paise = info.get('price') or info.get('defaultPrice') or 0
        price_inr = round(price_paise / 100, 2)

        final_paise = info.get('finalPrice')
        final_inr = round(final_paise / 100, 2) if final_paise else price_inr

        is_veg = info.get('isVeg') == 1 or info.get('itemAttribute', {}).get('vegClassifier') == 'VEG'
        in_stock = info.get('inStock', 1) == 1
        description = info.get('description', '').strip()

        return {
            'category': category_title,
            'name': name,
            'price': price_inr,
            'final_price': final_inr,
            'type': 'VEG' if is_veg else 'NON-VEG',
            'in_stock': 'Yes' if in_stock else 'No (Out of Stock)',
            'description': description
        }


def print_banner():
    print("=" * 68)
    print("      🚀 SWIGGY ULTRA-FAST MENU & PRICE SCRAPER 🚀      ")
    print("=" * 68)


def display_results(rest_info: dict, items: list):
    print("\n" + "─" * 68)
    print(f" 🏨 Restaurant: {rest_info.get('name', 'N/A')}")
    if rest_info.get('area') or rest_info.get('city'):
        print(f" 📍 Location:   {rest_info.get('area', '')}, {rest_info.get('city', '')}")
    if rest_info.get('cuisines'):
        print(f" 🍕 Cuisines:   {rest_info.get('cuisines')}")
    if rest_info.get('rating') != 'N/A':
        print(f" ⭐ Rating:     {rest_info.get('rating')} ({rest_info.get('total_ratings', '')})")
    print("─" * 68)
    print(f" 📊 Total Menu Items Found: {len(items)}")
    print("─" * 68 + "\n")

    current_cat = None
    for idx, item in enumerate(items, 1):
        if item['category'] != current_cat:
            current_cat = item['category']
            print(f"\n📂 [{current_cat.upper()}]")
            print("─" * 52)

        veg_tag = "[🟢 VEG]" if item['type'] == 'VEG' else "[🔴 NON-VEG]"
        stock_status = "" if item['in_stock'] == 'Yes' else " (❌ Out of Stock)"

        if item['final_price'] < item['price']:
            price_str = f"₹{item['final_price']} (Reg: ₹{item['price']})"
        else:
            price_str = f"₹{item['price']}"

        print(f"  {idx:3d}. {item['name']:<40} | {veg_tag} | {price_str}{stock_status}")


def export_to_csv(rest_info: dict, items: list, filename: str = None):
    if not filename:
        clean_name = re.sub(r'[^a-zA-Z0-9]', '_', rest_info.get('name', 'swiggy_menu')).lower()
        filename = f"{clean_name}_menu.csv"

    with open(filename, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Category', 'Item Name', 'Type', 'Price (INR)', 'Final Price (INR)', 'In Stock', 'Description'])
        for item in items:
            writer.writerow([
                item['category'],
                item['name'],
                item['type'],
                item['price'],
                item['final_price'],
                item['in_stock'],
                item['description']
            ])

    print(f"\n[✓] Menu successfully exported to CSV: {os.path.abspath(filename)}")


def export_to_json(rest_info: dict, items: list, filename: str = None):
    if not filename:
        clean_name = re.sub(r'[^a-zA-Z0-9]', '_', rest_info.get('name', 'swiggy_menu')).lower()
        filename = f"{clean_name}_menu.json"

    export_data = {
        'restaurant_info': rest_info,
        'scraped_at': datetime.now().isoformat(),
        'total_items': len(items),
        'menu_items': items
    }

    with open(filename, mode='w', encoding='utf-8') as f:
        json.dump(export_data, f, indent=4, ensure_ascii=False)

    print(f"[✓] Menu successfully exported to JSON: {os.path.abspath(filename)}")


def main():
    print_banner()

    if len(sys.argv) > 1:
        url = sys.argv[1]
    else:
        print("Example Link: https://www.swiggy.com/city/jamshedpur/sher-e-punjab-kadma-market-golmuri-rest256769")
        url = input("\n👉 Enter Swiggy Restaurant Link: ").strip()

    if not url:
        print("[!] No URL provided. Exiting.")
        return

    scraper = SwiggyMenuScraper()

    try:
        start_time = datetime.now()
        rest_info, items = scraper.fetch_menu_from_url(url)
        elapsed = (datetime.now() - start_time).total_seconds()

        print(f"\n⚡ Scraping completed in {elapsed:.2f} seconds!")

        display_results(rest_info, items)

        # Save prompt
        print("\n" + "=" * 52)
        save_choice = input("💾 Do you want to save this menu to CSV/JSON? (c=CSV / j=JSON / b=Both / n=No): ").strip().lower()

        if save_choice in ['c', 'csv']:
            export_to_csv(rest_info, items)
        elif save_choice in ['j', 'json']:
            export_to_json(rest_info, items)
        elif save_choice in ['b', 'both']:
            export_to_csv(rest_info, items)
            export_to_json(rest_info, items)

    except Exception as e:
        print(f"\n[❌] Error: {e}")


if __name__ == "__main__":
    main()
