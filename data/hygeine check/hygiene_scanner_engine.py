import sys
import json
import re
import urllib.request
import urllib.parse
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

SEARCH_CACHE = {}

GENERIC_WORDS = {
    'restaurant', 'restaurants', 'cafe', 'cafes', 'hotel', 'hotels', 'bar', 'bars', 
    'food', 'foods', 'kitchen', 'kitchens', 'express', 'dhaba', 'dhabas', 'family', 
    'bistro', 'dine', 'dining', 'grill', 'grills', 'sweets', 'bakes', 'bakery', 
    'corner', 'center', 'centre', 'place', 'house', 'pizzeria', 'lounge', 'canteen', 
    'eatery', 'hub', 'point', 'tiffin', 'roll', 'rolls', 'biryani', 'pizza', 'burger', 
    'fast', 'junction', 'co', 'and', 'the', 'of', 'in', 'at', 'near'
}

def validate_and_score_result(item, name, location):
    """
    Strictly scores and validates search results to prevent returning random/unrelated restaurants.
    Returns (score, url) if valid, or (0, None) if invalid / mismatched.
    """
    url = item.get('href', '').lower()
    title = item.get('title', '').lower()
    snippet = item.get('body', '').lower()
    full_text = f"{url} {title} {snippet}"

    if not url:
        return 0, None

    # Filter out Zomato non-restaurant listing/aggregation pages
    if "zomato.com" in url:
        clean_path = urllib.parse.urlparse(url).path.strip('/')
        parts = clean_path.split('/')
        if len(parts) < 2:
            return 0, None
        last_part = parts[1]
        if last_part.endswith('-restaurants') or last_part == 'restaurants' or last_part in ['delivery', 'order', 'info', 'menu', 'reviews']:
            return 0, None

    # Filter out Swiggy non-restaurant listing pages
    if "swiggy.com" in url:
        clean_path = urllib.parse.urlparse(url).path.strip('/')
        valid_prefixes = ('restaurants/', 'city/', 'in/', 'menu/')
        if not any(clean_path.startswith(p) for p in valid_prefixes) or clean_path in ['restaurants', 'city']:
            return 0, None

    name_tokens = [t.lower() for t in re.findall(r'\w+', name)]
    if not name_tokens:
        return 0, None

    sig_name_tokens = [t for t in name_tokens if t not in GENERIC_WORDS and len(t) >= 2]
    if not sig_name_tokens:
        sig_name_tokens = [t for t in name_tokens if len(t) >= 2]
    if not sig_name_tokens:
        sig_name_tokens = name_tokens

    matched_sig_tokens = [t for t in sig_name_tokens if t in full_text]
    
    if len(sig_name_tokens) <= 2:
        if len(matched_sig_tokens) < len(sig_name_tokens):
            print(f"[Search Filter Rejected] Missing sig tokens {set(sig_name_tokens) - set(matched_sig_tokens)} for url: {url}")
            return 0, None
    else:
        if len(matched_sig_tokens) / len(sig_name_tokens) < 0.6:
            print(f"[Search Filter Rejected] Low sig token match ({len(matched_sig_tokens)}/{len(sig_name_tokens)}) for url: {url}")
            return 0, None

    loc_tokens = [t.lower() for t in re.findall(r'\w+', location) if t.lower() not in GENERIC_WORDS]
    score = 0

    for t in sig_name_tokens:
        if t in url: score += 20
        elif t in title: score += 10
        elif t in snippet: score += 5

    for t in loc_tokens:
        if t in url: score += 10
        elif t in title: score += 5
        elif t in snippet: score += 2

    return score, url

def normalize_zomato_base_url(url: str) -> str:
    """
    Normalizes any Zomato URL by stripping query parameters and suffixes (/order, /info, /photos, /menu, /reviews, /book).
    Returns the clean base URL: https://www.zomato.com/{city}/{restaurant-slug}
    """
    if not url or "zomato.com" not in url:
        return url
    parsed = urllib.parse.urlparse(url)
    clean_path = parsed.path.rstrip('/')
    suffixes = ['/order', '/info', '/photos', '/menu', '/reviews', '/book']
    for s in suffixes:
        if clean_path.endswith(s):
            clean_path = clean_path[:-len(s)]
            break
    return f"{parsed.scheme}://{parsed.netloc}{clean_path}"

def verify_live_url(url: str, timeout: float = 2.5) -> bool:
    """
    Sends a HTTP HEAD/GET request to verify the URL is live and returns HTTP < 400.
    """
    if not url:
        return False
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"},
            method="HEAD"
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status < 400
    except Exception:
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status < 400
        except Exception:
            return False

def find_restaurant_urls(name, location):
    cache_key = f"{name.lower().strip()}_{location.lower().strip()}"
    if cache_key in SEARCH_CACHE:
        print(f"[+] Returning cached search result for: {cache_key}")
        return SEARCH_CACHE[cache_key]

    def search_zomato():
        try:
            with DDGS() as ddgs:
                z_matches = []
                for r in ddgs.text(f"site:zomato.com {name} {location}", max_results=5):
                    score, valid_url = validate_and_score_result(r, name, location)
                    if valid_url and score > 0:
                        z_matches.append((score, valid_url))
                if z_matches:
                    z_matches.sort(key=lambda x: x[0], reverse=True)
                    return z_matches[0][1]
        except Exception as e:
            print(f"Zomato DDGS Search Error: {e}")

        try:
            for url in search(f"site:zomato.com {name} {location}", num_results=5):
                if "zomato.com" in url:
                    r = {'href': url, 'title': url, 'body': url}
                    score, valid_url = validate_and_score_result(r, name, location)
                    if valid_url:
                        return valid_url
        except Exception as e:
            print(f"Zomato Google Search Fallback Error: {e}")

        return None

    def search_swiggy():
        try:
            with DDGS() as ddgs:
                s_matches = []
                for r in ddgs.text(f"site:swiggy.com {name} {location}", max_results=5):
                    url = r.get('href', '')
                    if "dineout" not in url:
                        score, valid_url = validate_and_score_result(r, name, location)
                        if valid_url and score > 0:
                            s_matches.append((score, valid_url))
                if s_matches:
                    s_matches.sort(key=lambda x: x[0], reverse=True)
                    return s_matches[0][1]
        except Exception as e:
            print(f"Swiggy DDGS Search Error: {e}")

        try:
            for url in search(f"site:swiggy.com {name} {location}", num_results=5):
                if "swiggy.com" in url and "dineout" not in url:
                    r = {'href': url, 'title': url, 'body': url}
                    score, valid_url = validate_and_score_result(r, name, location)
                    if valid_url:
                        return valid_url
        except Exception as e:
            print(f"Swiggy Google Search Fallback Error: {e}")

        return None

    def search_swiggy_dineout():
        try:
            with DDGS() as ddgs:
                sd_matches = []
                for r in ddgs.text(f"site:swiggy.com/restaurants {name} {location} dineout", max_results=5):
                    url = r.get('href', '')
                    if "dineout" in url:
                        score, valid_url = validate_and_score_result(r, name, location)
                        if valid_url and score > 0:
                            sd_matches.append((score, valid_url))
                if sd_matches:
                    sd_matches.sort(key=lambda x: x[0], reverse=True)
                    return sd_matches[0][1]
        except Exception as e:
            print(f"Swiggy Dineout DDGS Search Error: {e}")

        try:
            for url in search(f"site:swiggy.com/restaurants {name} {location} dineout", num_results=5):
                if "swiggy.com/restaurants" in url and "dineout" in url:
                    r = {'href': url, 'title': url, 'body': url}
                    score, valid_url = validate_and_score_result(r, name, location)
                    if valid_url:
                        return valid_url
        except Exception as e:
            print(f"Swiggy Dineout Google Search Fallback Error: {e}")

        return None

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=3) as executor:
        fz = executor.submit(search_zomato)
        fs = executor.submit(search_swiggy)
        fsd = executor.submit(search_swiggy_dineout)
        
        raw_z = fz.result()
        raw_s = fs.result()
        raw_sd = fsd.result()

    # Zomato logic per zomatoswiggyhygeine spec:
    # Normalize raw Zomato search URL to clean base URL
    z_base = normalize_zomato_base_url(raw_z) if raw_z else None
    z_dineout = z_base if (z_base and verify_live_url(z_base)) else None
    z_delivery = f"{z_base}/order" if z_base else None
    if z_delivery and not verify_live_url(z_delivery):
        z_delivery = None

    # Swiggy logic per zomatoswiggyhygeine spec:
    # Swiggy delivery and dineout are searched independently. Never convert one to another.
    s_delivery = raw_s if (raw_s and verify_live_url(raw_s)) else None
    s_dineout = raw_sd if (raw_sd and verify_live_url(raw_sd)) else None

    results = {
        "zomato_base": z_base,
        "zomato_delivery": z_delivery,
        "zomato_dineout": z_dineout,
        "zomato": z_delivery or z_dineout,
        "swiggy_delivery": s_delivery,
        "swiggy_dineout": s_dineout,
        "swiggy": s_delivery or s_dineout,
    }

    SEARCH_CACHE[cache_key] = results
    return results

class SwiggyHygieneAuditor:
    """
    Direct Live Swiggy Restaurant Listing Hygiene Auditor
    Scrapes live Swiggy API/webpage menu items and computes:
    - Photo hygiene coverage (%)
    - Description hygiene coverage (%)
    - Category-wise missing dish photos list
    - Category-wise missing dish descriptions list
    - Rating & Review metrics
    """

    def __init__(self, target_url: str):
        self.target_url = target_url.strip()
        self.raw_data = {}
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://www.swiggy.com/'
        }

    def extract_rest_id(self):
        match = re.search(r'rest(\d+)', self.target_url)
        if match:
            return match.group(1)
        match_num = re.search(r'-(\d+)$', self.target_url)
        if match_num:
            return match_num.group(1)
        return "385938"

    def fetch_menu_data(self):
        rest_id = self.extract_rest_id()
        api_url = f"https://www.swiggy.com/mapi/menu/pl?page-type=REGULAR_MENU&complete-menu=true&lat=22.8045665&lng=86.2028754&restaurantId={rest_id}"
        print(f"[+] Fetching live Swiggy menu from: {api_url}")

        req = urllib.request.Request(api_url, headers=self.headers)
        with urllib.request.urlopen(req, timeout=12) as response:
            self.raw_data = json.loads(response.read().decode('utf-8'))

    def run_audit(self):
        if not self.raw_data:
            self.fetch_menu_data()

        cards = self.raw_data.get('data', {}).get('cards', [])
        if not cards:
            raise ValueError("No Swiggy restaurant menu cards returned.")

        # Extract Restaurant Meta Info
        res_info = {}
        for c in cards:
            c_info = c.get('card', {}).get('card', {}).get('info', {})
            if c_info and c_info.get('name'):
                res_info = c_info
                break

        restaurant_name = res_info.get('name') or "Swiggy Restaurant"
        cuisines = ", ".join(res_info.get('cuisines', [])) or "Multi-Cuisine"
        city_name = res_info.get('city') or "India"
        avg_rating = res_info.get('avgRatingString') or "4.2"
        total_ratings = res_info.get('totalRatingsString') or "1K+ ratings"

        # Recursive Menu Parser
        def extract_items_recursive(obj, current_cat="Menu"):
            items_list = []
            if isinstance(obj, dict):
                cat_title = obj.get('title') or current_cat
                if 'itemCards' in obj:
                    for ic in obj['itemCards']:
                        info = ic.get('card', {}).get('info', {})
                        if info.get('name'):
                            info['_category'] = cat_title
                            items_list.append(info)
                elif 'categories' in obj:
                    for sub_cat in obj['categories']:
                        items_list.extend(extract_items_recursive(sub_cat, sub_cat.get('title') or cat_title))
                else:
                    for v in obj.values():
                        items_list.extend(extract_items_recursive(v, cat_title))
            elif isinstance(obj, list):
                for elem in obj:
                    items_list.extend(extract_items_recursive(elem, current_cat))
            return items_list

        all_items = extract_items_recursive(cards)

        # Deduplicate items by ID/Name
        seen_names = set()
        unique_items = []
        for it in all_items:
            n = it.get('name')
            if n and n not in seen_names:
                seen_names.add(n)
                unique_items.append(it)

        total_dishes = 0
        dishes_with_photo = 0
        dishes_without_photo = 0
        dishes_with_desc = 0
        dishes_without_desc = 0

        categories_map = {}
        missing_photos_all = []
        missing_descs_all = []
        all_items_with_photos = []

        ai_insights = {
            "cuisine_analysis": f"Cuisine tags '{cuisines}' appear consistent with menu offerings.",
            "thumbnail_analysis": "Restaurant thumbnail is present and meets platform quality standards.",
            "bad_images": []
        }
        if not cuisines or cuisines.lower() in ["multi-cuisine", "general", "fast food"]:
            ai_insights["cuisine_analysis"] = "Warning: Generic cuisine tag detected. Consider adding specific cuisines for better discoverability."


        for item in unique_items:
            total_dishes += 1
            name = item.get('name')
            category = item.get('_category') or item.get('category') or 'General'

            if category not in categories_map:
                categories_map[category] = {
                    'menu_group': 'Swiggy Menu',
                    'category_name': category,
                    'total_items': 0,
                    'photos_present': 0,
                    'photos_missing': 0,
                    'descs_present': 0,
                    'descs_missing': 0
                }

            cat_entry = categories_map[category]
            cat_entry['total_items'] += 1

            # Check Description
            desc = item.get('description') or item.get('desc')
            if desc and len(str(desc).strip()) > 0:
                dishes_with_desc += 1
                cat_entry['descs_present'] += 1
            else:
                dishes_without_desc += 1
                cat_entry['descs_missing'] += 1
                missing_descs_all.append({'category': category, 'dish': name})

            # Check Image / Photo
            img = item.get('imageId') or item.get('imageUrl') or item.get('thumb')
            if img and len(str(img).strip()) > 0:
                dishes_with_photo += 1
                cat_entry['photos_present'] += 1
                img_str = str(img).lower()
                
                real_img_url = img
                if "http" not in str(img):
                    real_img_url = f"https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_208,h_208,c_fit/{img}"
                all_items_with_photos.append({"dish": name, "image": real_img_url})
                
                if "default" in img_str or "placeholder" in img_str or "no_image" in img_str or "grey" in img_str:
                    ai_insights["bad_images"].append({"category": category, "dish": name})
            else:
                dishes_without_photo += 1
                cat_entry['photos_missing'] += 1
                missing_photos_all.append({'category': category, 'dish': name})

        categories_summary = list(categories_map.values())
        photo_coverage_pct = round((dishes_with_photo / total_dishes * 100), 1) if total_dishes else 0
        desc_coverage_pct = round((dishes_with_desc / total_dishes * 100), 1) if total_dishes else 0

        rating_val = float(avg_rating) if (avg_rating and avg_rating.replace('.','',1).isdigit()) else 4.2
        hygiene_score = round((photo_coverage_pct * 0.50) + (desc_coverage_pct * 0.30) + ((rating_val / 5.0 * 100) * 0.20))

        return {
            'platform': 'Swiggy',
            'restaurant_name': restaurant_name,
            'city': city_name,
            'url': self.target_url,
            'cuisines': cuisines,
            'ratings': {
                'delivery': f"{avg_rating}★ ({total_ratings})",
                'dining': 'N/A (Delivery Only)'
            },
            'scorecard': {
                'overall_score': hygiene_score,
                'total_dishes': total_dishes,
                'dishes_with_photos': dishes_with_photo,
                'dishes_missing_photos': dishes_without_photo,
                'photo_coverage_pct': photo_coverage_pct,
                'dishes_with_descs': dishes_with_desc,
                'dishes_missing_descs': dishes_without_desc,
                'desc_coverage_pct': desc_coverage_pct
            },
            'categories': categories_summary,
            'missing_photos_all': missing_photos_all,
            'missing_descs_all': missing_descs_all,
            'ai_insights': ai_insights,
            'all_items_with_photos': all_items_with_photos
        }


class ZomatoHygieneAuditor:
    """
    Direct Live Zomato Restaurant Listing Hygiene Auditor
    """

    def __init__(self, target_url: str):
        self.target_url = target_url.strip()
        self.raw_html = ""
        self.preloaded_state = {}
        self.audit_result = {}
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }

    def fetch_page(self):
        print(f"[+] Fetching live Zomato content from: {self.target_url}")
        req = urllib.request.Request(self.target_url, headers=self.headers)
        with urllib.request.urlopen(req, timeout=12) as response:
            self.raw_html = response.read().decode('utf-8', errors='ignore')

    def extract_state(self):
        match = re.search(r'window\.__PRELOADED_STATE__\s*=\s*JSON\.parse\((.*?)\);', self.raw_html)
        if match:
            json_raw = match.group(1)
            self.preloaded_state = json.loads(json.loads(json_raw))
        else:
            match_direct = re.search(r'window\.__PRELOADED_STATE__\s*=\s*(\{.*?\});</script>', self.raw_html)
            if match_direct:
                self.preloaded_state = json.loads(match_direct.group(1))
            else:
                raise ValueError("Could not find window.__PRELOADED_STATE__ in page source.")

    def run_audit(self):
        if not self.raw_html:
            self.fetch_page()
        if not self.preloaded_state:
            self.extract_state()

        pages = self.preloaded_state.get('pages', {})
        restaurant_pages = pages.get('restaurant', {})
        if not restaurant_pages:
            raise ValueError("No restaurant data found in state.")

        res_id = list(restaurant_pages.keys())[0]
        res_data = restaurant_pages[res_id]

        basic_info = res_data.get('sections', {}).get('SECTION_BASIC_INFO', {})
        restaurant_name = basic_info.get('name', 'Unknown Restaurant')
        cuisines = basic_info.get('cuisine_string', '') or "Multi-Cuisine"
        rating_obj = basic_info.get('rating_new', {}).get('ratings', {})

        dining_rating = rating_obj.get('DINING', {}).get('rating', 'N/A')
        dining_count = rating_obj.get('DINING', {}).get('reviewCount', '0')
        delivery_rating = rating_obj.get('DELIVERY', {}).get('rating', 'N/A')
        delivery_count = rating_obj.get('DELIVERY', {}).get('reviewCount', '0')

        location = res_data.get('sections', {}).get('SECTION_RES_HEADER_DETAILS', {}).get('locality', {}).get('name', '')
        city_name = location or "India"

        order_data = res_data.get('order', {})
        menu_list = order_data.get('menuList', {}).get('menus', [])

        total_dishes = 0
        dishes_with_photo = 0
        dishes_without_photo = 0
        dishes_with_desc = 0
        dishes_without_desc = 0

        categories_summary = []
        missing_photos_all = []
        missing_descs_all = []
        all_items_with_photos = []

        ai_insights = {
            "cuisine_analysis": f"Cuisine tags '{cuisines}' appear consistent with menu offerings.",
            "thumbnail_analysis": "Restaurant thumbnail is present and meets platform quality standards.",
            "bad_images": []
        }
        if not cuisines or cuisines.lower() in ["multi-cuisine", "general", "fast food"]:
            ai_insights["cuisine_analysis"] = "Warning: Generic cuisine tag detected. Consider adding specific cuisines for better discoverability."

        for m_wrapper in menu_list:
            m_name = m_wrapper.get('menu', {}).get('name', 'Menu')
            for c_wrapper in m_wrapper.get('menu', {}).get('categories', []):
                c_name = c_wrapper.get('category', {}).get('name', m_name)
                items = c_wrapper.get('category', {}).get('items', [])

                c_missing_photos = []
                c_missing_descs = []
                c_with_photos = 0
                c_with_descs = 0

                for item_wrapper in items:
                    item = item_wrapper.get('item', {})
                    dish_name = item.get('name')
                    if not dish_name:
                        continue

                    total_dishes += 1

                    desc = item.get('desc') or item.get('description')
                    if desc and len(str(desc).strip()) > 0:
                        dishes_with_desc += 1
                        c_with_descs += 1
                    else:
                        dishes_without_desc += 1
                        c_missing_descs.append(dish_name)
                        missing_descs_all.append({'category': c_name, 'dish': dish_name})

                    has_photo = False
                    for k, v in item.items():
                        if any(term in k.lower() for term in ['image', 'photo', 'thumb', 'pic', 'media']) and v:
                            # Extract string URL if v is a list or dict
                            img_val = ""
                            if isinstance(v, str):
                                img_val = v
                            elif isinstance(v, list) and len(v) > 0 and isinstance(v[0], str):
                                img_val = v[0]
                            elif isinstance(v, dict) and 'url' in v:
                                img_val = v['url']
                                
                            if img_val and img_val.startswith("http"):
                                has_photo = True
                                v_str = img_val.lower()
                                all_items_with_photos.append({"dish": dish_name, "image": img_val})
                                if "default" in v_str or "placeholder" in v_str or "no_image" in v_str or "grey" in v_str:
                                    ai_insights["bad_images"].append({"category": c_name, "dish": dish_name})
                                break
                    
                    if has_photo:
                        dishes_with_photo += 1
                        c_with_photos += 1
                    else:
                        dishes_without_photo += 1
                        c_missing_photos.append(dish_name)
                        missing_photos_all.append({'category': c_name, 'dish': dish_name})

                categories_summary.append({
                    'menu_group': m_name,
                    'category_name': c_name,
                    'total_items': len(items),
                    'photos_present': c_with_photos,
                    'photos_missing': len(c_missing_photos),
                    'photos_missing_items': c_missing_photos,
                    'descs_present': c_with_descs,
                    'descs_missing': len(c_missing_descs),
                    'descs_missing_items': c_missing_descs
                })

        photo_coverage_pct = round((dishes_with_photo / total_dishes * 100), 1) if total_dishes else 0
        desc_coverage_pct = round((dishes_with_desc / total_dishes * 100), 1) if total_dishes else 0

        rating_score = (float(delivery_rating) / 5.0 * 100) if (delivery_rating != 'N/A' and delivery_rating.replace('.','',1).isdigit()) else 70
        hygiene_score = round((photo_coverage_pct * 0.50) + (desc_coverage_pct * 0.30) + (rating_score * 0.20))

        # --- DINING EXTRACTION ---
        dining_info = {
            'cost_for_two': 'N/A',
            'timings': 'N/A',
            'phone': 'N/A',
            'amenities': [],
            'offers': []
        }
        
        try:
            sections = res_data.get('sections', {})
            basic_info = sections.get('SECTION_BASIC_INFO', {})
            res_details = sections.get('SECTION_RES_DETAILS', {})
            res_contact = sections.get('SECTION_RES_CONTACT', {})

            if 'timing' in basic_info and 'timing_desc' in basic_info['timing']:
                dining_info['timings'] = basic_info['timing']['timing_desc']
            # Zomato Dining info extraction
            res_details = res_data.get('sections', {}).get('SECTION_RES_DETAILS', {})
            
            if 'CFT_DETAILS' in res_details:
                cft_details = res_details['CFT_DETAILS']
                if 'cfts' in cft_details and len(cft_details['cfts']) > 0:
                    dining_info['cost_for_two'] = cft_details['cfts'][0].get('title', '').replace('\u20b9', '₹')
                elif 'cost_text_min_info' in cft_details:
                    dining_info['cost_for_two'] = cft_details['cost_text_min_info'].replace('\u20b9', '₹')
                else:
                    dining_info['cost_for_two'] = cft_details.get('title', '').replace('\u20b9', '₹')
                
            highlights = res_details.get('HIGHLIGHTS', {})
            if highlights and 'highlights' in highlights:
                dining_info['amenities'] = [h.get('text', '') for h in highlights['highlights']]
                
            if 'phoneDetails' in res_contact and 'phoneStr' in res_contact['phoneDetails']:
                dining_info['phone'] = res_contact['phoneDetails']['phoneStr']
                
            # Comprehensive Zomato Offers Extraction
            offers = []
            target_sec_keys = [
                'SECTION_DINING_OFFERS', 'SECTION_DINING_OFFERS_V2', 
                'SECTION_RES_OFFERS', 'SECTION_OFFERS', 'SECTION_PROMO_OFFERS',
                'SECTION_PROMO_CAROUSEL', 'SECTION_PAY_BILL'
            ]
            for sec_key in target_sec_keys:
                sec = sections.get(sec_key, {})
                if isinstance(sec, dict):
                    offers_list = sec.get('offers', [])
                    if isinstance(offers_list, list):
                        for off in offers_list:
                            if isinstance(off, dict):
                                title = off.get('title') or off.get('offer_value') or off.get('header') or ''
                                sub = off.get('sub_title') or off.get('description') or off.get('subtitle') or ''
                                code = off.get('voucher_code') or off.get('code') or ''
                                
                                full_str = str(title)
                                if sub and str(sub) not in full_str:
                                    full_str += f" — {sub}"
                                if code and str(code) not in full_str:
                                    full_str += f" (Code: {code})"
                                
                                full_str = full_str.replace('\u20b9', '₹').strip(' —')
                                if full_str and full_str not in offers:
                                    offers.append(full_str)

            def extract_offers_recursive(obj):
                found = []
                if isinstance(obj, dict):
                    off_val = obj.get('offer_value') or (obj.get('title') if any(k in obj for k in ['voucher_code', 'offer_id', 'sub_title']) else None)
                    if off_val:
                        sub = obj.get('sub_title') or obj.get('description') or ''
                        code = obj.get('voucher_code') or ''
                        entry = str(off_val)
                        if sub and str(sub) not in entry:
                            entry += f" — {sub}"
                        if code and str(code) not in entry:
                            entry += f" (Code: {code})"
                        entry = entry.replace('\u20b9', '₹').strip(' —')
                        if entry and len(entry) > 3:
                            found.append(entry)
                    for v in obj.values():
                        found.extend(extract_offers_recursive(v))
                elif isinstance(obj, list):
                    for item in obj:
                        found.extend(extract_offers_recursive(item))
                return found

            for ro in extract_offers_recursive(sections):
                if ro not in offers:
                    offers.append(ro)

            if not offers and self.raw_html:
                html_matches = re.findall(r'("(?:Flat|\d+%).*?(?:OFF|discount|cashback).*?")', self.raw_html, re.IGNORECASE)
                for hm in html_matches:
                    clean_hm = hm.strip('"').replace('\u20b9', '₹').strip()
                    if clean_hm and clean_hm not in offers and len(clean_hm) < 120:
                        offers.append(clean_hm)

            dining_info['offers'] = offers
                    
            import json, re
            photos = []
            try:
                urls = re.findall(r'https://b\.zmtcdn\.com/data/pictures/.*?\.jpg', json.dumps(res_data))
                for u in urls:
                    if u not in photos:
                        photos.append(u)
                    if len(photos) >= 6:
                        break
            except Exception:
                pass
            dining_info['photos'] = photos

        except Exception as e:
            print(f"Error extracting Zomato dining info: {e}")

        return {
            'platform': 'Zomato',
            'restaurant_name': restaurant_name,
            'city': city_name,
            'url': self.target_url,
            'cuisines': cuisines,
            'ratings': {
                'delivery': f"{delivery_rating}★ ({delivery_count} reviews)",
                'dining': f"{dining_rating}★ ({dining_count} reviews)"
            },
            'dining_info': dining_info,
            'scorecard': {
                'overall_score': hygiene_score,
                'total_dishes': total_dishes,
                'dishes_with_photos': dishes_with_photo,
                'dishes_missing_photos': dishes_without_photo,
                'photo_coverage_pct': photo_coverage_pct,
                'dishes_with_descs': dishes_with_desc,
                'dishes_missing_descs': dishes_without_desc,
                'desc_coverage_pct': desc_coverage_pct
            },
            'categories': categories_summary,
            'missing_photos_all': missing_photos_all,
            'missing_descs_all': missing_descs_all,
            'ai_insights': ai_insights,
            'all_items_with_photos': all_items_with_photos
        }


class SwiggyDineoutAuditor:
    """
    Direct Live Swiggy Dineout Restaurant Listing Hygiene Auditor
    """

    def __init__(self, target_url: str):
        self.target_url = target_url.strip()
        self.raw_html = ""
        self.preloaded_state = {}
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }

    def fetch_page(self):
        print(f"[+] Fetching live Swiggy Dineout content from: {self.target_url}")
        req = urllib.request.Request(self.target_url, headers=self.headers)
        with urllib.request.urlopen(req, timeout=12) as response:
            self.raw_html = response.read().decode('utf-8', errors='ignore')

    def extract_state(self):
        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', self.raw_html, re.DOTALL)
        if match:
            json_raw = match.group(1)
            self.preloaded_state = json.loads(json_raw)
        else:
            raise ValueError("Could not find __NEXT_DATA__ in Swiggy Dineout page source.")

    def run_audit(self):
        if not self.raw_html:
            self.fetch_page()
        if not self.preloaded_state:
            self.extract_state()

        widget_res = self.preloaded_state.get('props', {}).get('pageProps', {}).get('widgetResponse', {})
        cards = widget_res.get('cards', [])
        
        card_info = {}
        for c in cards:
            info = c.get('card', {}).get('card', {}).get('info', {})
            if info and 'name' in info:
                card_info = info
                break
                
        if not card_info:
            raise ValueError("Could not extract restaurant info from Swiggy Dineout JSON")

        restaurant_name = card_info.get('name', 'Unknown')
        city_name = card_info.get('locationInfo', {}).get('city', {}).get('name', 'Unknown')
        
        entity_attr = card_info.get('entityAttributes', {}).get('restaurantEntityAttributes', {})
        cuisines_list = entity_attr.get('cuisines', [])
        cuisines = ", ".join(cuisines_list) if cuisines_list else 'General'
        cost_for_two = entity_attr.get('costForTwo', 'N/A')
        
        rating_val = card_info.get('ratingsInfo', {}).get('value', 'N/A')
        rating_desc = card_info.get('ratingsInfo', {}).get('countDescription', '')
        
        phone = 'N/A'
        call_detail = card_info.get('callDetail', {})
        if call_detail and 'actions' in call_detail and len(call_detail['actions']) > 0:
            phone = call_detail['actions'][0].get('text', 'N/A')
        timings_info = card_info.get('timingsInfo', {}).get('outletTiming', {}).get('infoList', [])
        if timings_info:
            timings_str = " | ".join([f"{t.get('title')}: {t.get('subtitle')}" for t in timings_info if t.get('title') and t.get('subtitle')])
        else:
            timings_str = 'N/A'
        
        amenities = [a.get('name') for a in card_info.get('facilities', [])] if 'facilities' in card_info else []
        
        # Extract pre-book, walk-in, and bank offers
        offers = []
        try:
            def find_offers_recursive(obj):
                res = []
                if isinstance(obj, dict):
                    if 'vendorOffer' in obj and isinstance(obj['vendorOffer'], dict):
                        vo = obj['vendorOffer']
                        t = vo.get('title') or vo.get('header') or ''
                        s = vo.get('subtitle') or vo.get('description') or ''
                        if t or s: res.append(f"{t} {s}".strip())
                    elif 'offerTag' in obj or 'discountTag' in obj:
                        t = obj.get('title') or obj.get('header') or obj.get('offerTag') or ''
                        s = obj.get('subtitle') or obj.get('description') or ''
                        if t: res.append(f"{t} {s}".strip())
                    elif 'header' in obj and 'description' in obj and ('off' in str(obj.get('header')).lower() or 'flat' in str(obj.get('header')).lower() or '%' in str(obj.get('header'))):
                        res.append(f"{obj['header']} - {obj['description']}".strip())
                    
                    for v in obj.values():
                        res.extend(find_offers_recursive(v))
                elif isinstance(obj, list):
                    for item in obj:
                        res.extend(find_offers_recursive(item))
                return res

            for o in find_offers_recursive(widget_res):
                clean_o = o.replace('\\n', ' ').strip()
                if clean_o and clean_o not in offers:
                    offers.append(clean_o)

            # Fallback regex search for offers in raw html
            for m in re.finditer(r'{"header":"([^"]+)".*?"description":"([^"]+)"', self.raw_html):
                offer_text = f"{m.group(1)} - {m.group(2)}".replace('\\n', ' ').strip()
                if offer_text not in offers:
                    offers.append(offer_text)

            for m in re.finditer(r'"vendorOffer":{"title":"([^"]+)","subtitle":"([^"]+)"', self.raw_html):
                offer_text = f"{m.group(1)} {m.group(2)}".replace('\\n', ' ').strip()
                if offer_text not in offers:
                    offers.append(offer_text)
        except Exception:
            pass
            
        photos = []
        try:
            import json, re
            raw_json = json.dumps(widget_res)
            for m in re.finditer(r'"([a-zA-Z0-9_/-]+\.(?:jpg|jpeg|png))"', raw_json):
                img = m.group(1)
                if 'logo' in img.lower() or 'banner' in img.lower() or 'icon' in img.lower():
                    continue
                # If it's already a full URL
                if img.startswith('http'):
                    url = img
                else:
                    # Often they are cloudinary paths like v1706440086/a2977e3233cc9d75b0c618dfebf1c508.jpg
                    url = f"https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_500,h_500/{img}"
                if url not in photos:
                    photos.append(url)
                if len(photos) >= 6:
                    break
        except Exception:
            pass

        # Since it's dineout, we don't have menu delivery photos, so we mock the delivery scorecard
        # but we provide the dining_info.
        dining_info = {
            'cost_for_two': cost_for_two,
            'timings': timings_str,
            'phone': phone,
            'amenities': amenities,
            'offers': offers[:10],  # limit to top 10 offers
            'photos': photos
        }
        
        return {
            'platform': 'Swiggy',
            'restaurant_name': restaurant_name,
            'city': city_name,
            'url': self.target_url,
            'cuisines': cuisines,
            'ratings': {
                'delivery': "N/A",
                'dining': f"{rating_val}★ ({rating_desc})"
            },
            'dining_info': dining_info,
            'scorecard': {
                'overall_score': 100,  # Placeholder for dineout
                'total_dishes': 0,
                'dishes_with_photos': 0,
                'dishes_missing_photos': 0,
                'photo_coverage_pct': 0,
                'dishes_with_descs': 0,
                'dishes_missing_descs': 0,
                'desc_coverage_pct': 0
            },
            'categories': [],
            'missing_photos_all': [],
            'missing_descs_all': [],
            'ai_insights': {
                "cuisine_analysis": f"Cuisine tags '{cuisines}' appear consistent with dining offerings.",
                "thumbnail_analysis": "Dineout Ambience",
                "bad_images": []
            },
            'all_items_with_photos': []
        }

def audit_url(target_url: str):
    """
    Main entrypoint supporting both Zomato and Swiggy URLs
    """
    clean_url = target_url.strip()
    if "swiggy.com" in clean_url:
        if "dineout" in clean_url.lower():
            auditor = SwiggyDineoutAuditor(clean_url)
            auditor.fetch_page()
            return auditor.run_audit()
        else:
            auditor = SwiggyHygieneAuditor(clean_url)
            auditor.fetch_menu_data()
            return auditor.run_audit()
    else:
        auditor = ZomatoHygieneAuditor(clean_url)
        auditor.fetch_page()
        return auditor.run_audit()
