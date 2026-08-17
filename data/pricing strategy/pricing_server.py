"""
Standalone Pricing Strategy API Server
Runs on port 8001 — uses search_helper, swiggy_scraper, matcher
No dependency on hygiene_scanner_engine
"""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import json
import sys
import os
import traceback

PORT = 8002

class PricingServer(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        print(f"[{self.address_string()}] {format % args}")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)

        try:
            payload = json.loads(post_data.decode('utf-8'))
        except Exception:
            self._send_json({'error': 'Invalid JSON'}, 400)
            return

        if self.path.startswith('/api/pricing/discover'):
            self._handle_discover(payload)
        elif self.path.startswith('/api/pricing/scrape'):
            self._handle_scrape(payload)
        else:
            self._send_json({'error': 'Not Found'}, 404)

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except Exception as e:
            print(f"[!] Send error: {e}")

    def _handle_discover(self, payload):
        """Discover live restaurants from Swiggy area page"""
        try:
            location = payload.get('location', 'Golmuri').strip()
            city = payload.get('city', 'Jamshedpur').strip()
            count = int(payload.get('count', 4))

            print(f"[Discover] area={location}, city={city}, count={count}")

            from search_helper import fetch_swiggy_area_restaurants
            restaurants = fetch_swiggy_area_restaurants(area=location, city=city)

            result_list = [
                {'name': r['name'], 'url': r['url']}
                for r in restaurants[:count]
            ]

            print(f"[Discover] Found {len(result_list)} restaurants")
            self._send_json({'success': True, 'restaurants': result_list, 'total_found': len(restaurants)})

        except Exception as e:
            traceback.print_exc()
            self._send_json({'error': str(e)}, 500)

    def _handle_scrape(self, payload):
        """Scrape competitor menus and match items"""
        try:
            competitors = payload.get('competitors', [])
            location = payload.get('location', 'Golmuri').strip()
            city = payload.get('city', 'Jamshedpur').strip()
            user_items = payload.get('items', [])

            if not competitors or not user_items:
                raise Exception("'competitors' and 'items' are required")

            print(f"[Scrape] location={location}, city={city}, competitors={[c['name'] for c in competitors]}")

            from search_helper import find_swiggy_link
            from swiggy_scraper import SwiggyMenuScraper
            from matcher import match_all_items_hybrid
            import concurrent.futures

            def process_competitor(comp):
                comp_name = comp.get('name', '').strip()
                is_manual = comp.get('isManual', False)
                direct_url = comp.get('url') or comp.get('swiggyUrl')

                if not comp_name and not direct_url:
                    return None

                if direct_url and direct_url.startswith('http'):
                    swiggy_url = direct_url
                    print(f"[*] Using direct store link for '{comp_name or 'Competitor'}': {swiggy_url}")
                else:
                    print(f"[*] Finding Swiggy link for: {comp_name}")
                    try:
                        swiggy_url = find_swiggy_link(comp_name, location=location, city=city)
                    except Exception as e:
                        print(f"[!] Link error for {comp_name}: {e}")
                        swiggy_url = None

                if not swiggy_url:
                    print(f"[!] No link found for {comp_name}")
                    return {'competitorName': comp_name or 'Competitor', 'isManual': is_manual, 'found': False, 'items': []}

                scraper = SwiggyMenuScraper()
                menu_items = []
                actual_name = comp_name
                try:
                    rest_info, menu_items = scraper.fetch_menu_from_url(swiggy_url)
                    if rest_info and rest_info.get('name') and rest_info['name'] != 'Unknown Restaurant':
                        actual_name = rest_info['name']
                except Exception as e:
                    print(f"[!] Full menu scrape notice for {comp_name}: {e}")

                matched_items = match_all_items_hybrid(user_items, menu_items)

                return {
                    'competitorName': actual_name or comp_name or 'Competitor',
                    'isManual': is_manual,
                    'swiggyUrl': swiggy_url,
                    'found': True,
                    'items': matched_items
                }

            results = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                futures = [executor.submit(process_competitor, comp) for comp in competitors]
                results = [f.result() for f in futures if f.result() is not None]

            self._send_json({'success': True, 'results': results})

        except Exception as e:
            traceback.print_exc()
            self._send_json({'error': str(e)}, 500)


if __name__ == '__main__':
    print(f"[+] Pricing Strategy API Server starting on http://localhost:{PORT}")
    print(f"[+] Endpoints: POST /api/pricing/discover  |  POST /api/pricing/scrape")
    server = ThreadingHTTPServer(('0.0.0.0', PORT), PricingServer)
    server.serve_forever()
