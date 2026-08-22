import sys
import io
import json
import traceback

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from flask import Flask, request, jsonify
from hygiene_scanner_engine import audit_url, find_restaurant_urls

app = Flask(__name__)

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
    return response

@app.route('/api/audit', methods=['POST', 'OPTIONS'])
def handle_audit():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'})
    
    try:
        payload = request.get_json(force=True, silent=True) or {}
        url = payload.get('url', '').strip()
        if not url:
            url = "https://www.zomato.com/jamshedpur/novelty-multicuisine-restaurant-bistupur/order"
            
        print(f"[Flask Audit Request] -> Target URL: {url}")
        audit_result = audit_url(url)
        return jsonify(audit_result)
    except Exception as e:
        print(f"[!] Flask Audit Error: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/search', methods=['POST', 'OPTIONS'])
def handle_search():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'})
        
    try:
        payload = request.get_json(force=True, silent=True) or {}
        name = payload.get('name', '').strip()
        location = payload.get('location', '').strip()
        
        if not name or not location:
            return jsonify({'error': 'Name and Location are required'}), 400
            
        print(f"[Flask Search Request] -> {name} at {location}")
        search_results = find_restaurant_urls(name, location)
        
        response_payload = {
            "zomato_base": search_results.get("zomato_base"),
            "zomato_delivery": search_results.get("zomato_delivery"),
            "zomato_dineout": search_results.get("zomato_dineout"),
            "zomato": search_results.get("zomato"),
            "swiggy_delivery": search_results.get("swiggy_delivery"),
            "swiggy_dineout": search_results.get("swiggy_dineout"),
            "swiggy": search_results.get("swiggy"),
        }
        return jsonify(response_payload)
    except Exception as e:
        print(f"[!] Flask Search Error: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("[+] Starting Hygiene Check Flask Server on Port 8000...")
    app.run(host='127.0.0.1', port=8000, threaded=True, debug=False)
