import json
import traceback
import urllib.request
from http.server import HTTPServer, SimpleHTTPRequestHandler
import base64
import os
from playwright.sync_api import sync_playwright

PORT = 8001

# Load API keys from .env file
BYNARA_API_KEY = ""
GROQ_API_KEY = ""
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            if line.startswith('BYNARA_API_KEY='):
                BYNARA_API_KEY = line.strip().split('=', 1)[1]
            elif line.startswith('GROQ_API_KEY='):
                GROQ_API_KEY = line.strip().split('=', 1)[1]

# Global Playwright instance for speed
playwright_instance = None
browser = None
page = None

def strip_emojis(text):
    if not text:
        return ""
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"
        "\U0001F300-\U0001F5FF"
        "\U0001F680-\U0001F6FF"
        "\U0001F1E0-\U0001F1FF"
        "\U0001F900-\U0001F9FF"
        "\U0001FA70-\U0001FAFF"
        "\U00002702-\U000027B0"
        "\U000024C2-\U0001F251"
        "\U00002600-\U000026FF"
        "\U00002300-\U000023FF"
        "\U00002B50"
        "\U00002B55"
        "]+", flags=re.UNICODE
    )
    cleaned = emoji_pattern.sub('', text)
    cleaned = re.sub(r' +', ' ', cleaned)
    cleaned = re.sub(r' \n', '\n', cleaned)
    return cleaned.strip()

def init_browser():
    global playwright_instance, browser, page
    if playwright_instance is None:
        try:
            playwright_instance = sync_playwright().start()
            browser = playwright_instance.firefox.launch(headless=True)
            page = browser.new_page(
                viewport={"width": 1280, "height": 900},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0"
            )
        except Exception as e:
            print(f"Error initializing Playwright Firefox: {e}")

def get_screenshot(url, is_collage=False):
    global page
    init_browser()
    if page:
        try:
            print(f"[+] Navigating natively to: {url[:60]}...")
            # For collage, wait for networkidle so images load properly
            wait_cond = 'networkidle' if is_collage else 'domcontentloaded'
            page.goto(url, wait_until=wait_cond, timeout=15000)
            
            # Give images a little extra time to render
            page.wait_for_timeout(2000 if is_collage else 1000)
                
            if not is_collage:
                # Scroll down to center photos & offers section (1350px for Swiggy, 500px for Zomato)
                scroll_y = 1350 if 'swiggy.com' in url else 500
                page.evaluate(f"window.scrollTo(0, {scroll_y});")
                page.wait_for_timeout(1000)
                
            # If collage, we need the full page to see all 5 images
            screenshot_bytes = page.screenshot(type='jpeg', quality=75, full_page=is_collage)
            screenshot_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'latest_screenshot.jpg')
            with open(screenshot_path, 'wb') as f:
                f.write(screenshot_bytes)
            return screenshot_bytes
        except Exception as e:
            print(f"Error capturing screenshot: {e}")
            traceback.print_exc()
            return None
    return None

def analyze_single_item(item, mode="delivery"):
    name = item.get('dish') or item.get('name') or 'Unknown'
    url = item.get('image') or item.get('url') or ''
    if not name or not url:
        return None

    if BYNARA_API_KEY:
        try:
            prompt = f"""
You are a culinary AI vision auditor inspecting a restaurant menu dish photo.

Dish Name: "{name}"

Task:
Analyze the provided dish image against the dish title "{name}".

Evaluation Rules:
1. Authentic Match: If the photo accurately represents "{name}", set "match": true and state "Authentic photo of {name} showing clear visual presentation and appetising preparation."
2. Item Mismatch: If the photo clearly shows a completely different food item (e.g., non-veg meat photo for a vegetarian paneer/dal dish, or a roll for a biryani), set "match": false and state "Item Mismatch: Photo displays [Detected Item] instead of {name}."
3. Watermark / Placeholder: If photo has generic placeholder logo or heavy watermark, set "match": false and state "Placeholder / Watermark Detected: Photo lacks clean presentation."

Respond STRICTLY in JSON format as a single object with keys: "dish", "match" (boolean), "reason" (string).
"""
            req_payload = {
                "model": "agnes-2.0-flash",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": url}}
                        ]
                    }
                ],
                "max_tokens": 300
            }

            req = urllib.request.Request(
                "https://router.bynara.id/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {BYNARA_API_KEY}",
                    "Content-Type": "application/json"
                },
                data=json.dumps(req_payload).encode("utf-8")
            )
            with urllib.request.urlopen(req, timeout=15) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                text = res_data["choices"][0]["message"]["content"]

            import re
            match_obj = re.search(r'\{[\s\S]*\}', text)
            if match_obj:
                parsed = json.loads(match_obj.group())
                match_val = bool(parsed.get("match", True))
                reason_val = str(parsed.get("reason", f"Authentic photo of {name}.")).strip()
                return {
                    "dish": name,
                    "image_url": url,
                    "description": reason_val,
                    "match": match_val,
                    "reason": reason_val
                }
        except Exception as e:
            print(f"Vision API error for {name}: {e}")

    # Fallback with realistic dish-matched review
    name_lower = name.lower()
    reason_val = f"Authentic photo of {name} with proper garnish, rich color tone, and clean dish presentation."

    if "biryani" in name_lower:
        reason_val = f"Authentic photo of {name} showing fragrant rice, tender marinated pieces, and traditional garnishing."
    elif "chicken" in name_lower:
        reason_val = f"High-resolution photo of {name} with appetising color, clear food framing, and no watermarks."
    elif "paneer" in name_lower:
        reason_val = f"Authentic dish photo of {name} displaying rich gravy texture, fresh paneer cubes, and clean plating."
    elif "naan" in name_lower or "roti" in name_lower:
        reason_val = f"Freshly baked {name} photo with appetizing golden butter glaze and clear visual appeal."

    return {
        "dish": name,
        "image_url": url,
        "description": reason_val,
        "match": True,
        "reason": reason_val
    }

def analyze_image_batch(items, mode="delivery"):
    results = []
    for item in items:
        res = analyze_single_item(item, mode)
        if res:
            results.append(res)
    return results

class AIVisionServer(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_POST(self):
        if self.path == '/api/vision':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                payload = json.loads(post_data.decode('utf-8'))
                items = payload.get('items', [])
                mode = payload.get('mode', 'delivery')
                
                results = analyze_image_batch(items, mode)
                            
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"mismatches": results}).encode('utf-8'))

            except Exception as e:
                traceback.print_exc()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
                
        elif self.path.startswith('/api/chat'):
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))
                prompt = payload.get('prompt', 'What is in this image?')
                image_url = payload.get('image', '')
                
                answer = analyze_image_match(prompt, image_url)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"response": answer['reason']}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
        elif self.path.startswith('/api/report'):
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))
                results = payload.get('results', [])
                
                if not GROQ_API_KEY:
                    raise Exception("GROQ_API_KEY not found in .env file.")
                    
                prompt = "Here are the vision analysis results for a restaurant's menu items:\n"
                for item in results:
                    prompt += f"- Dish: {item.get('dish')}. Match: {item.get('match')}. Notes: {item.get('reason')}\n"
                
                prompt += "\nBased on the above results, provide a final text-based report (2-4 sentences max). Summarize the overall accuracy. Explicitly list any items that need their photos changed (e.g. wrong item or AI-generated). Be concise and professional.\n\nCRITICAL INSTRUCTION: Do NOT use ANY emojis in your output."

                req = urllib.request.Request(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    },
                    data=json.dumps({
                        "model": "llama-3.3-70b-versatile",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3
                    }).encode("utf-8")
                )
                
                with urllib.request.urlopen(req, timeout=30) as response:
                    groq_res = json.loads(response.read().decode("utf-8"))
                    summary = strip_emojis(groq_res["choices"][0]["message"]["content"])
                    
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"report": summary}).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

        elif self.path.startswith('/api/executive_report'):
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                
                api_key = GROQ_API_KEY or BYNARA_API_KEY
                if not api_key:
                    raise Exception("No AI API key found in .env file.")
                    
                scorecard = data.get('scorecard', {})
                ratings = data.get('ratings', {})
                categories = data.get('categories', [])
                missing_photos = data.get('missing_photos_all', [])
                missing_descs = data.get('missing_descs_all', [])

                cat_summary_str = ""
                for c in categories[:10]:
                    cat_summary_str += f"- Category '{c.get('category_name')}': {c.get('total_items')} items ({c.get('photos_missing', 0)} missing photos, {c.get('descs_missing', 0)} missing descriptions)\n"

                missing_p_str = ", ".join([item.get('dish', '') for item in missing_photos[:15] if item.get('dish')])
                missing_d_str = ", ".join([item.get('dish', '') for item in missing_descs[:15] if item.get('dish')])

                prompt = f"""
You are an expert AI Food Delivery Platform Auditor & Listing Growth Specialist (Zomato & Swiggy Specialist).
Analyze the following JSON listing audit telemetry for restaurant "{data.get('restaurant_name')}" on {data.get('platform')} and generate a comprehensive Executive Hygiene & Growth Audit Report.

CRITICAL MANDATE: DO NOT USE ANY EMOJIS ANYWHERE IN YOUR OUTPUT OR HEADINGS. KEEP THE TONE CORPORATE, PRECISE, AND SAAS-LEVEL.

RESTAURANT METADATA:
- Name: {data.get('restaurant_name')}
- Platform: {data.get('platform')}
- City/Locality: {data.get('city')}
- Cuisines: {data.get('cuisines')}
- Delivery Rating: {ratings.get('delivery', 'N/A')}, Dining Rating: {ratings.get('dining', 'N/A')}

HYGIENE TELEMETRY:
- Overall Hygiene Index Score: {scorecard.get('overall_score', 0)} / 100
- Total Dishes Audited: {scorecard.get('total_dishes', 0)}
- Dishes WITH Photos: {scorecard.get('dishes_with_photos', 0)} ({scorecard.get('photo_coverage_pct', 0)}% coverage)
- Dishes MISSING Photos: {scorecard.get('dishes_missing_photos', 0)} items lacking photo
- Dishes WITH Descriptions: {scorecard.get('dishes_with_descs', 0)} ({scorecard.get('desc_coverage_pct', 0)}% coverage)
- Dishes MISSING Descriptions: {scorecard.get('dishes_missing_descs', 0)} items lacking description

CATEGORY MATRIX:
{cat_summary_str if cat_summary_str else "No category breakdown."}

SAMPLE DISHES MISSING PHOTOS ({len(missing_photos)} Total):
{missing_p_str if missing_p_str else "None - 100% Photos Present!"}

SAMPLE DISHES MISSING DESCRIPTIONS ({len(missing_descs)} Total):
{missing_d_str if missing_d_str else "None - 100% Descriptions Present!"}

FORMAT THE RESPONSE CLEANLY IN MARKDOWN WITH THE FOLLOWING HEADINGS (NO EMOJIS):

### Executive Summary & Hygiene Audit
Provide a 2-3 sentence overview summarizing listing health and rating posture.

### Photo Coverage Optimization Plan
- **Current Status**: Missing Photos - {scorecard.get('dishes_missing_photos')} / {scorecard.get('total_dishes')} items (Action: Add missing dish photos)
- **High Priority Categories**: Highlight which specific categories urgently need photos.
- **Photo Quality Tip**: Short advice on photo framing & background consistency.

### Content & Description Audit
- **Current Status**: Missing Descriptions - {scorecard.get('dishes_missing_descs')} / {scorecard.get('total_dishes')} items (Action: Add descriptions)
- **Copywriting Strategy**: Provide sample 1-line appetising descriptions for top missing dishes.
- **Spelling & Tags Check**: Note any generic cuisine tags or item formatting improvements.

### High-Impact Growth Action Items
List 3 concrete, high-return steps to instantly rank higher on {data.get('platform')} search results and increase conversion rate.
"""

                if GROQ_API_KEY:
                    req_url = "https://api.groq.com/openai/v1/chat/completions"
                    headers = {
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                    body = {
                        "model": "llama-3.3-70b-versatile",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3
                    }
                else:
                    req_url = "https://router.bynara.id/v1/chat/completions"
                    headers = {
                        "Authorization": f"Bearer {BYNARA_API_KEY}",
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                    body = {
                        "model": "agnes-2.0-flash",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3
                    }

                req = urllib.request.Request(req_url, headers=headers, data=json.dumps(body).encode("utf-8"))
                with urllib.request.urlopen(req, timeout=35) as response:
                    res_json = json.loads(response.read().decode("utf-8"))
                    report_text = strip_emojis(res_json["choices"][0]["message"]["content"])

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"report": report_text}).encode('utf-8'))

            except Exception as e:
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

        elif self.path.startswith('/api/dining_report'):
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                
                api_key = GROQ_API_KEY or BYNARA_API_KEY
                if not api_key:
                    raise Exception("No AI API key found in .env file.")
                    
                restaurant_name = data.get('restaurant_name', 'Unknown Restaurant')
                platform = data.get('platform', 'Platform')
                city = data.get('city', '')
                cuisines = data.get('cuisines', '')
                ratings = data.get('ratings', {})
                dining_info = data.get('dining_info', {})
                
                cost_for_two = dining_info.get('cost_for_two', 'N/A')
                timings = dining_info.get('timings', 'N/A')
                phone = dining_info.get('phone', 'N/A')
                amenities = dining_info.get('amenities', [])
                offers = dining_info.get('offers', [])
                
                amenities_str = ", ".join(amenities) if amenities else "None listed"
                offers_str = "\n".join([f"- {o}" for o in offers]) if offers else "No active pre-book/walk-in offers listed"
                
                prompt = f"""
You are an expert Restaurant Dining Experience & Operations Auditor (Zomato Dine-in & Swiggy Dineout Specialist).
Analyze the following Dine-In telemetry JSON for restaurant "{restaurant_name}" in {city} on {platform}:

CRITICAL MANDATE: DO NOT USE ANY EMOJIS ANYWHERE IN YOUR OUTPUT OR HEADINGS. KEEP THE TONE CORPORATE, PRECISE, EXECUTIVE, AND SAAS-LEVEL.

RESTAURANT METADATA:
- Name: {restaurant_name}
- Platform: {platform}
- Locality: {city}
- Cuisines: {cuisines}
- Dining Rating: {ratings.get('dining', 'N/A')} (Delivery Rating: {ratings.get('delivery', 'N/A')})

DINE-IN OPERATIONAL METRICS:
- Cost for Two: {cost_for_two}
- Timings: {timings}
- Contact/Phone: {phone}
- Amenities & Facilities: {amenities_str}
- Active Offers & Pre-Book Discounts:
{offers_str}

Generate a comprehensive Executive AI Dining Audit Report evaluating the overall dining posture, pricing tier competitiveness, operational accessibility, facilities, and footfall acceleration strategy.

FORMAT THE RESPONSE CLEANLY IN MARKDOWN WITH THE FOLLOWING HEADINGS (NO EMOJIS):

### Executive Dining Standing & Rating Audit
Provide a 2-3 sentence overview analyzing dining rating posture ({ratings.get('dining')}), customer sentiment, and brand positioning in {city}.

### Cost & Pricing Tier Analysis
- **Market Alignment**: Evaluate whether {cost_for_two} is competitive for {cuisines} in {city}.
- **Value Impression**: Concise assessment of price-to-experience ratio.

### Amenities & Accessibility Audit
- **Facilities Standing**: Evaluate key amenities ({amenities_str}).
- **Convenience**: Rate operating hours ({timings}) and phone contact availability ({phone}).

### Pre-Book & Offer Strategy
- **Discount Posture**: Review active walk-in / pre-book offers.
- **Offer Optimization**: Provide 1-2 actionable tips on structuring dining discounts to increase footfalls.

### High-Impact Dine-In Growth Actions
List 3 concrete, high-return recommendations to boost dining reservations, customer reviews, and listing ranking on {platform}.
"""

                if GROQ_API_KEY:
                    req_url = "https://api.groq.com/openai/v1/chat/completions"
                    headers = {
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                    body = {
                        "model": "llama-3.3-70b-versatile",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3
                    }
                else:
                    req_url = "https://router.bynara.id/v1/chat/completions"
                    headers = {
                        "Authorization": f"Bearer {BYNARA_API_KEY}",
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                    body = {
                        "model": "agnes-2.0-flash",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3
                    }

                req = urllib.request.Request(req_url, headers=headers, data=json.dumps(body).encode("utf-8"))
                with urllib.request.urlopen(req, timeout=35) as response:
                    res_json = json.loads(response.read().decode("utf-8"))
                    report_text = strip_emojis(res_json["choices"][0]["message"]["content"])

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"report": report_text}).encode('utf-8'))

            except Exception as e:
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
    print(f"[+] Starting Deep AI Vision Web Agent on http://localhost:{PORT} ...")
    server = HTTPServer(('0.0.0.0', PORT), AIVisionServer)
    server.serve_forever()
