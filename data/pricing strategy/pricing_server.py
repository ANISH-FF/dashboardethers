from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import json
import sys
import os
import traceback
import threading
import uuid
import time

PORT = 8002
JOB_PROGRESS = {}

class PricingServer(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        print(f"[{self.address_string()}] {format % args}")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/api/pricing/progress'):
            from urllib.parse import urlparse, parse_qs
            query = parse_qs(urlparse(self.path).query)
            job_id = query.get('jobId', ['default'])[0]
            prog = JOB_PROGRESS.get(job_id, {'status': 'NOT_FOUND', 'logs': []})
            self._send_json(prog)
        else:
            self._send_json({'error': 'Not Found'}, 404)

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

            from search_helper import fetch_swiggy_area_restaurants
            restaurants = fetch_swiggy_area_restaurants(area=location, city=city)

            result_list = [
                {'name': r['name'], 'url': r['url']}
                for r in restaurants[:count]
            ]
            self._send_json({'success': True, 'restaurants': result_list, 'total_found': len(restaurants)})

        except Exception as e:
            traceback.print_exc()
            self._send_json({'error': str(e)}, 500)

    def _handle_scrape(self, payload):
        """Scrape competitor menus and match items asynchronously"""
        competitors = payload.get('competitors', [])
        user_items = payload.get('items') or payload.get('itemNames') or []

        if not competitors or not user_items:
            self._send_json({'error': "'competitors' and ('items' or 'itemNames') are required"}, 400)
            return

        job_id = payload.get('jobId') or f"job_{uuid.uuid4().hex[:8]}"
        JOB_PROGRESS[job_id] = {
            'status': 'RUNNING',
            'logs': [],
            'results': None,
            'summary': None,
            'error': None
        }

        # Launch background thread
        t = threading.Thread(target=self._run_scrape_async, args=(job_id, payload), daemon=True)
        t.start()

        # Return immediately in < 5ms!
        self._send_json({'status': 'RUNNING', 'jobId': job_id})

    def _run_scrape_async(self, job_id, payload):
        try:
            competitors = payload.get('competitors', [])
            location = payload.get('location', 'Golmuri').strip()
            city = payload.get('city', 'Jamshedpur').strip()
            user_items = payload.get('items') or payload.get('itemNames') or []

            def emit_log(text, color="text-zinc-400"):
                if job_id in JOB_PROGRESS:
                    JOB_PROGRESS[job_id]['logs'].append({'text': text, 'color': color})

            emit_log(f"[SCRAPE] Starting market analysis for {len(competitors)} competitor outlets...", "text-blue-400 font-medium")
            print(f"[Scrape Async] job_id={job_id}, location={location}, competitors={[c.get('name') for c in competitors]}")

            from search_helper import find_swiggy_link
            from swiggy_scraper import SwiggyMenuScraper
            import matcher
            import importlib
            importlib.reload(matcher)
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
                    emit_log(f"[STORE] Verified direct store link for '{comp_name or 'Outlet'}': {swiggy_url}", "text-blue-400")
                else:
                    emit_log(f"[SEARCH] Finding Swiggy link for '{comp_name}'...", "text-zinc-400")
                    try:
                        swiggy_url = find_swiggy_link(comp_name, location=location, city=city)
                    except Exception as e:
                        swiggy_url = None

                if not swiggy_url:
                    emit_log(f"[WARN] Could not locate Swiggy link for '{comp_name}'", "text-red-400 font-medium")
                    return {'competitorName': comp_name or 'Competitor', 'isManual': is_manual, 'found': False, 'items': []}

                scraper = SwiggyMenuScraper()
                menu_items = []
                actual_name = comp_name
                try:
                    rest_info, menu_items = scraper.fetch_menu_from_url(swiggy_url)
                    if rest_info and rest_info.get('name') and rest_info['name'] != 'Unknown Restaurant':
                        actual_name = rest_info['name']
                    emit_log(f"[MENU] Extracted {len(menu_items)} items from '{actual_name}'", "text-emerald-400")
                except Exception as e:
                    print(f"[!] Full menu scrape notice for {comp_name}: {e}")

                def sub_log(t, c="text-zinc-400"):
                    emit_log(f"[{actual_name}] {t}", c)

                matched_items = match_all_items_hybrid(user_items, menu_items, progress_cb=sub_log)

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

            total_items = len(user_items)
            local_count = 0
            ai_count = 0
            not_found_count = 0

            for comp_res in results:
                for item in comp_res.get('items', []):
                    src = item.get('matchSource')
                    price_v = item.get('price')
                    if price_v and price_v > 0:
                        if src == 'ethers_ai' or src == 'nara_ai':
                            ai_count += 1
                        else:
                            local_count += 1
                    else:
                        not_found_count += 1

            emit_log(f"[SUMMARY] Processed {len(results)} Outlets for {total_items} Items", "text-emerald-400 font-bold")
            emit_log(f"[LOCAL GUARD] Fast Local Guard Matches: {local_count} items", "text-emerald-300")
            emit_log(f"[ETHERS AI]   Ethers AI Verified Matches:  {ai_count} items", "text-amber-300")
            emit_log(f"[UNMATCHED]   Not Available / Missing:     {not_found_count} items", "text-zinc-400")

            JOB_PROGRESS[job_id]['status'] = 'COMPLETED'
            JOB_PROGRESS[job_id]['results'] = results
            JOB_PROGRESS[job_id]['summary'] = {
                'totalItems': total_items,
                'localMatches': local_count,
                'aiMatches': ai_count,
                'notAvailable': not_found_count
            }
        except Exception as e:
            traceback.print_exc()
            if job_id in JOB_PROGRESS:
                JOB_PROGRESS[job_id]['status'] = 'FAILED'
                JOB_PROGRESS[job_id]['error'] = str(e)


if __name__ == '__main__':
    print(f"[+] Pricing Strategy API Server starting on http://localhost:{PORT}")
    print(f"[+] Endpoints: POST /api/pricing/discover  |  POST /api/pricing/scrape (Async) | GET /api/pricing/progress")
    server = ThreadingHTTPServer(('0.0.0.0', PORT), PricingServer)
    server.serve_forever()
