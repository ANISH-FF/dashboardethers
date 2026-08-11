from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import json
import os
import sys
import traceback
from hygiene_scanner_engine import audit_url, find_restaurant_urls

PORT = 8000

class HygieneAuditServer(SimpleHTTPRequestHandler):

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_GET(self):
        if self.path.startswith('/favicon.ico'):
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()

    def do_POST(self):
        if self.path.startswith('/api/audit'):
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                payload = json.loads(post_data.decode('utf-8'))
                url = payload.get('url', '').strip()

                if not url:
                    url = "https://www.zomato.com/jamshedpur/novelty-multicuisine-restaurant-bistupur/order"

                print(f"[API Audit Request] -> Target URL: {url}")
                audit_result = audit_url(url)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(audit_result).encode('utf-8'))

            except Exception as e:
                print(f"[!] API Error Handled: {e}")
                traceback.print_exc()

                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
                
        elif self.path.startswith('/api/search'):
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                payload = json.loads(post_data.decode('utf-8'))
                name = payload.get('name', '').strip()
                location = payload.get('location', '').strip()

                if not name or not location:
                    raise Exception("Name and Location are required")

                print(f"[API Search Request] -> {name} at {location}")
                search_results = find_restaurant_urls(name, location)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                
                response_payload = {
                    "zomato_base": search_results.get("zomato_base"),
                    "zomato_delivery": search_results.get("zomato_delivery"),
                    "zomato_dineout": search_results.get("zomato_dineout"),
                    "zomato": search_results.get("zomato"),
                    "swiggy_delivery": search_results.get("swiggy_delivery"),
                    "swiggy_dineout": search_results.get("swiggy_dineout"),
                    "swiggy": search_results.get("swiggy"),
                }
                self.wfile.write(json.dumps(response_payload).encode('utf-8'))

            except Exception as e:
                print(f"[!] API Error Handled: {e}")
                traceback.print_exc()

                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
                
        else:
            self.send_error(404, "Endpoint not found")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == '__main__':
    print(f"[+] Starting Zomato & Swiggy Hygiene Audit API Server on http://localhost:{PORT} ...")
    server = ThreadingHTTPServer(('0.0.0.0', PORT), HygieneAuditServer)
    server.serve_forever()
