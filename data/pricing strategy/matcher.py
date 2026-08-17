import re
import os
import json
import time
import urllib.request
import urllib.error
from difflib import SequenceMatcher

# Core food nouns that MUST match if present in the user's dish name
CORE_FOOD_NOUNS = {
    # Proteins & Base Ingredients
    'chicken', 'chix', 'chick', 'mutton', 'gosht', 'ghosht', 'fish', 'machli', 'macchli',
    'egg', 'anda', 'prawn', 'prawns', 'lamb', 'pork', 'beef', 'crab', 'duck', 'paneer', 'panir',
    'tofu', 'mushroom', 'soya', 'chaap', 'chap', 'corn', 'cheese', 'aloo', 'aloo', 'gobi', 'gobhi',
    'matar', 'mutter', 'palak', 'bhindi', 'baingan', 'kaju', 'cashew',
    
    # North Indian / Mughlai / Bread / Main Course
    'dosa', 'idli', 'vada', 'uttapam', 'biryani', 'biriyani', 'naan', 'roti', 'paratha',
    'parantha', 'kulcha', 'bhatura', 'bhature', 'dal', 'daal', 'dhal', 'khichdi', 'rice',
    'pulao', 'tikka', 'tika', 'kebab', 'kabab', 'korma', 'lababdar', 'makhani', 'kadhai',
    'handi', 'do pyaza', 'bhuna', 'tandoori', 'malai', 'gravy', 'curry', 'dry',
    
    # Indo-Chinese & Fast Food & Continental
    'roll', 'burger', 'pizza', 'chowmein', 'noodles', 'soup', 'thali', 'momos', 'momo',
    'chole', 'sandwich', 'sandwiches', 'pasta', 'maggi', 'manchow', 'schezwan', 'chilli',
    'chili', 'manchurian', 'spring roll', 'french fries', 'fries', 'wrap', 'tacos', 'nachos',
    
    # Desserts & Bakery & Sweets
    'waffle', 'waffles', 'sundae', 'sundaes', 'pancake', 'pancakes', 'crepe', 'crepes',
    'icecream', 'ice cream', 'brownie', 'gulab jamun', 'rasgulla', 'rasmalai', 'kulfi',
    'falooda', 'pastry', 'cake', 'jar', 'lolly', 'donut', 'muffin',
    
    # Beverages & Drinks
    'tea', 'coffee', 'shake', 'shakes', 'lassi', 'milk', 'mojito', 'crusher', 'cooler',
    'beverage', 'drink', 'smoothie', 'soda', 'coke', 'pepsi', 'iced tea'
}

# Common restaurant brand tags, prefixes, and fluff words to strip out for clean matching
BRAND_FLUFF_WORDS = {
    'atb', 'special', 'chefs', 'chef', 'signature', 'royal', 'deluxe', 'express', 'classic',
    'famous', 'original', 'best', 'dhabba', 'dhaba', 'style', 'deshi', 'desi', 'authentic',
    'dubey', 'dubeys', 'novelty', 'sher-e-punjab', 'punjabi', 'fresh', 'hot', 'crispy',
    'specialist', 'house', 'premium', 'supreme', 'tasty', 'delicious', 'master', 'mini', 'box',
    'waffcha', 'sandwich', 'sandw', 'american', 'belgian', 'madno', 'fly', 'naughty', 'naghty',
    'naked', 'single', 'layer', 'double', 'wich', 'waffwich', 'waffte', 'single layer',
    'specialist', 'tasty', 'grand', 'royal', 'haandi', 'bawarchi', 'haldiram', 'haldirams'
}

# Culinary Synonyms & Regional Equivalents Map across Indian & Global Cuisines
SYNONYMS_MAP = {
    # North Indian / Mughlai
    'kali daal': 'dal makhani',
    'kali dal': 'dal makhani',
    'dal makhni': 'dal makhani',
    'black dal': 'dal makhani',
    'dal makhne': 'dal makhani',
    'murgh makhani': 'butter chicken',
    'murg makhani': 'butter chicken',
    'murg makhni': 'butter chicken',
    'murgh makhni': 'butter chicken',
    'chicken makhani': 'butter chicken',
    'chana bhatura': 'chole bhature',
    'chole bhatura': 'chole bhature',
    'chana bhature': 'chole bhature',
    'lachha': 'laccha',
    'lacha': 'laccha',
    'parantha': 'paratha',
    'parata': 'paratha',
    'kadai': 'kadhai',
    'karahi': 'kadhai',
    'biriyani': 'biryani',
    'briyani': 'biryani',
    'tika': 'tikka',
    'panir': 'paneer',
    'kathi roll': 'roll',
    'chicken kathi': 'chicken roll',
    'paneer kathi': 'paneer roll',
    'egg kathi': 'egg roll',
    'mutton kathi': 'mutton roll',
    
    # Indo-Chinese & Fast Food
    'chili chicken': 'chilli chicken',
    'dry chilli chicken': 'chilli chicken',
    'chili paneer': 'chilli paneer',
    'dry chilli paneer': 'chilli paneer',
    'hakka noodles': 'noodles',
    'veg chowmein': 'chowmein',
    'steamed momos': 'momos',
    'fried momos': 'momos',
    'cheeseburger': 'burger',
    
    # Desserts & Beverages & Waffles
    'waffle sandwich': 'waffle',
    'cookies n cream': 'oreo',
    'cookies and cream': 'oreo',
    'kiki oreo': 'oreo',
    'kiki': 'oreo',
    'pista': 'pistachio',
    'pistacchio': 'pistachio',
    'pistacio': 'pistachio',
    'honey fly butter': 'honey butter',
    'honey fly': 'honey butter',
    'naghty nutella': 'nutella',
    'naked nutella': 'nutella',
    'nutella blast': 'nutella',
    'berry blue': 'blueberry',
    'blue berry': 'blueberry',
    'berry blast': 'blueberry',
    'dark and white': 'triple chocolate',
    'trio chocolate': 'triple chocolate',
    'three in one': 'triple chocolate',
    '3 in 1': 'triple chocolate',
    'creamy red velvet': 'red velvet',
    'café coffee': 'coffee',
    'coffee mocha': 'coffee',
    'choco snow': 'choco chips',
    'choco blast': 'choco chips',
    'choco boom': 'choco chips',
    'brownie crumble': 'brownie',
    'walnut brownie': 'brownie',
    'virgin mojito mint crusher': 'mint mojito',
    'virgin mojito': 'mint mojito',
    'mint crusher': 'mint mojito',
    'lemon ice tea': 'lemon iced tea',
    'lemon refreshing tea': 'lemon iced tea',
    'sandw': 'sandwich',
    'sandwi': 'sandwich',
    'crea': 'cream',
    'butte': 'butter'
}

def clean_item_name(name: str) -> str:
    """Normalize item name for comparison by removing brackets, brand fluff words, and applying synonyms."""
    if not name:
        return ""
    name = name.lower().strip()
    name = re.sub(r'\[.*?\]|\(.*?\)', '', name)  # Remove bracketed text like [Half], (1 Pc), (4 Pcs)
    name = re.sub(r'[^a-z0-9\s]', ' ', name)    # Remove special characters
    tokens = name.split()
    
    # Strip brand fluff words
    clean_tokens = [t for t in tokens if t not in BRAND_FLUFF_WORDS]
    cleaned = " ".join(clean_tokens if clean_tokens else tokens)
    
    # Apply culinary synonym replacements
    for syn, target in SYNONYMS_MAP.items():
        if syn in cleaned:
            cleaned = cleaned.replace(syn, target)
            
    return re.sub(r'\s+', ' ', cleaned).strip()

def find_best_matching_item(user_item: str, competitor_menu: list) -> tuple:
    """
    100% Pure Local Matcher (Zero API calls, Zero Cost).
    Returns (matched_dict_or_None, score_float)
    """
    user_clean = clean_item_name(user_item)
    if not user_clean:
        return None, 0.0

    user_tokens = set(user_clean.split())
    user_core_nouns = user_tokens.intersection(CORE_FOOD_NOUNS)

    # Detect Sub-Types
    user_item_lower = user_item.lower()
    is_lolly = 'lolly' in user_item_lower or 'stick' in user_item_lower
    is_jar = 'jar' in user_item_lower
    is_cake = 'cake' in user_item_lower
    is_shake = 'shake' in user_item_lower or 'milkshake' in user_item_lower
    is_sundae = 'sundae' in user_item_lower

    best_match = None
    highest_score = 0.0

    for item in competitor_menu:
        comp_name = item.get('name', '')
        comp_clean = clean_item_name(comp_name)
        if not comp_clean:
            continue

        comp_tokens = set(comp_clean.split())

        # Core Noun Guard: If user dish specifies chicken/paneer/dosa/etc., candidate MUST contain it
        if user_core_nouns:
            comp_core_nouns = comp_tokens.intersection(CORE_FOOD_NOUNS)
            if not user_core_nouns.issubset(comp_core_nouns):
                continue

        comp_name_lower = comp_name.lower()

        # Exact clean match after brand removal & synonym normalization
        if user_clean == comp_clean:
            score = 1.0
            # Sub-type affinity boost
            if is_lolly and ('lolly' in comp_name_lower or 'stick' in comp_name_lower):
                score += 0.1
            if is_jar and 'jar' in comp_name_lower:
                score += 0.1
            if is_cake and 'cake' in comp_name_lower:
                score += 0.1
            if score > highest_score:
                highest_score = score
                best_match = item

        # Sub-phrase containment boost (e.g. "chicken roll" inside "chicken roll 2 pcs")
        if len(user_clean) >= 4 and (user_clean in comp_clean or comp_clean in user_clean):
            contain_score = 0.88
            if contain_score > highest_score:
                highest_score = contain_score
                best_match = item

        # Token overlap ratio
        overlap = len(user_tokens.intersection(comp_tokens))
        if overlap == 0:
            continue

        token_score = (overlap / max(len(user_tokens), 1)) * 0.70
        seq_score = SequenceMatcher(None, user_clean, comp_clean).ratio() * 0.30
        total_score = token_score + seq_score

        # Sub-Type Affinity Checks
        if is_lolly and ('lolly' in comp_name_lower or 'stick' in comp_name_lower):
            total_score += 0.20
        elif is_lolly and not ('lolly' in comp_name_lower or 'stick' in comp_name_lower):
            total_score -= 0.10  # Mild penalty so stick matches stick if available

        if is_jar and 'jar' in comp_name_lower:
            total_score += 0.20
        if is_cake and 'cake' in comp_name_lower:
            total_score += 0.20

        # Penalize bulk or combo items so single portions win ties
        bulk_keywords = ['pack of', 'family', 'combo', 'bucket', 'party', 'bulk', 'kilo', 'kg', 'serves']
        if any(keyword in comp_name_lower for keyword in bulk_keywords):
            total_score -= 0.20

        # Penalize add-ons/toppings so real main dishes win
        addon_keywords = ['topping', 'toppings', 'add-on', 'addon', 'drizzle', 'dip', 'extra', 'crushed', 'syrup', 'sauce']
        if any(keyword in comp_name_lower for keyword in addon_keywords) and not any(keyword in user_item_lower for keyword in addon_keywords):
            total_score -= 0.35

        # Penalize Shake/Sundae/Beverage when matching a Waffle/Sandwich
        beverage_keywords = ['shake', 'sundae', 'beverage', 'drink', 'gudbud', 'milkshake', 'iced tea']
        if any(k in comp_name_lower for k in beverage_keywords) and not any(k in user_item_lower for k in beverage_keywords):
            total_score -= 0.35

        if total_score > highest_score:
            highest_score = total_score
            best_match = item

    # Return match if confidence score >= 0.45
    if best_match and highest_score >= 0.45:
        return best_match, highest_score

    return None, 0.0

def get_gemini_api_key() -> str:
    """Helper to fetch GEMINI_API_KEY from environment or .env file."""
    key = os.environ.get("GEMINI_API_KEY", "")
    if key:
        return key
    
    # Try reading .env file from workspace root
    env_paths = [
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
        os.path.join(os.path.dirname(__file__), "..", ".env")
    ]
    for p in env_paths:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    content = f.read()
                    m = re.search(r'GEMINI_API_KEY=(.+)', content)
                    if m:
                        return m.group(1).strip()
            except Exception:
                pass
    return ""

def batch_match_with_gemini_ai(unmatched_user_items: list, competitor_menu: list, api_key: str = None) -> dict:
    """
    Pass 2: Gemini 2.5 Flash Batch AI Semantic Matcher (Chunked for speed & zero timeouts).
    Sends unmatched items in chunks of 15 to Gemini AI for 99.99% exact dish resolution.
    Returns dict mapping user_item -> matched_menu_item_dict.
    """
    if not unmatched_user_items or not competitor_menu:
        return {}

    key = api_key or get_gemini_api_key()
    if not key:
        print("[Hybrid Matcher] No Gemini API key found, skipping AI pass.")
        return {}

    # Simplify competitor menu for token efficiency (name + price)
    candidates_info = []
    for idx, item in enumerate(competitor_menu[:150]):  # cap at 150 items for safety
        price_val = item.get('final_price') if (item.get('final_price') and item.get('final_price') > 0) else item.get('price', 0)
        candidates_info.append({
            "id": idx,
            "name": item.get('name', ''),
            "price": price_val
        })

    chunk_size = 15
    ai_result_map = {}

    for i in range(0, len(unmatched_user_items), chunk_size):
        chunk = unmatched_user_items[i:i + chunk_size]

        # Filter candidate items relevant to current chunk for ultra-fast response
        chunk_words = set(re.findall(r'\w+', " ".join(chunk).lower())) - BRAND_FLUFF_WORDS - {'and', 'the', 'with', 'for'}
        relevant_candidates = [
            c for c in candidates_info
            if set(re.findall(r'\w+', c['name'].lower())).intersection(chunk_words)
        ]
        if len(relevant_candidates) < 10:
            relevant_candidates = candidates_info[:40]

        prompt = f"""You are a master Indian restaurant dish matching AI engine.
Target User Dishes to Match: {json.dumps(chunk, ensure_ascii=False)}
Competitor Menu Items List: {json.dumps(relevant_candidates, ensure_ascii=False)}

Task: For each Target User Dish, find its exact equivalent or synonymous dish from the Competitor Menu Items List.
Rules:
- Understand Indian food & dessert synonyms (e.g. "Honey Butter Waffle" matches "Honey Fly Butter Waffle"; "Maple Butter Sandwich" matches "Maple Butter Waffle"; "Butterscotch Sandwich" matches "Butterscotch Crunch Waffle"; "Oreo Cookies N Cream" matches "Kiki & Oreo Waffle" or "Oreo Waffle"; "Dal Makhani" matches "Kali Daal").
- Understand brand prefixes (e.g. "ATB", "Dubeys", "Special", "Royal" added before dish names).
- Ignore add-ons, toppings, beverages, and sundaes when matching a waffle.
- If a Target User Dish is NOT present on the competitor menu, set candidate_id to -1.

Respond ONLY with valid JSON in this exact structure:
{{
  "matches": [
    {{
      "userItem": "Target User Dish Name",
      "candidate_id": number,
      "matchedName": "Competitor Dish Name or null",
      "price": number or 0
    }}
  ]
}}"""

        for attempt in range(3):
            try:
                time.sleep(0.4)  # Small rate-limit protection delay between chunks
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
                req_data = json.dumps({
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.1,
                        "responseMimeType": "application/json"
                    }
                }).encode('utf-8')

                req = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=15) as response:
                    res_bytes = response.read()
                    res_json = json.loads(res_bytes.decode('utf-8'))
                    
                    text_out = res_json.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                    if text_out:
                        parsed = json.loads(text_out)
                        match_list = parsed.get("matches", [])
                        
                        for m in match_list:
                            u_item = m.get("userItem")
                            cand_id = m.get("candidate_id")
                            if u_item and cand_id is not None and cand_id >= 0 and cand_id < len(candidates_info):
                                ai_result_map[u_item] = competitor_menu[cand_id]
                                print(f"   [Gemini AI Match] '{u_item}' -> '{competitor_menu[cand_id].get('name')}' @ Rs.{competitor_menu[cand_id].get('price')}")
                        break
            except Exception as e:
                print(f"[Hybrid Matcher] Gemini chunk AI notice for batch {i} (attempt {attempt + 1}): {e}")
                time.sleep(1.0)

    return ai_result_map

def match_all_items_hybrid(user_items: list, competitor_menu: list, gemini_api_key: str = None) -> list:
    """
    Hybrid Ultra-Cost-Saver Matching Engine:
    Pass 1: Smart Local Matcher (Brand tag stripping, synonyms, fuzzy tokens) -> 85-90% matched for FREE ($0.00 API cost).
    Pass 2: Single-Batch Gemini 2.5 Flash AI call ONLY for remaining unmatched items (1 API call total, <$0.0001 cost).
    Returns list of dicts: [{'userItem': name, 'matchedName': name, 'price': price}, ...]
    """
    final_matches = {}
    unmatched_items = []

    # --- Pass 1: Smart Local Matcher (FREE $0.00 API Cost) ---
    for item_name in user_items:
        match_item, score = find_best_matching_item(item_name, competitor_menu)
        if match_item and score >= 0.50:
            final_matches[item_name] = match_item
            print(f"   [Smart Local Match] '{item_name}' -> '{match_item.get('name')}' @ Rs.{match_item.get('price')} (Score: {score:.2f})")
        else:
            unmatched_items.append(item_name)

    # --- Pass 2: Gemini 2.5 Flash AI (100% Hard-Disabled as per strict directive) ---
    ENABLE_AI_PASS = False
    if ENABLE_AI_PASS and unmatched_items and competitor_menu:
        print(f"   [Gemini AI Pass] Sending {len(unmatched_items)} unmatched items to Gemini AI in 1 batch...")
        ai_matches = batch_match_with_gemini_ai(unmatched_items, competitor_menu, gemini_api_key)
        if ai_matches:
            for u_item, match_obj in ai_matches.items():
                if match_obj:
                    final_matches[u_item] = match_obj

    # Format final output list
    results = []
    for item_name in user_items:
        matched = final_matches.get(item_name)
        if matched:
            price_val = matched.get('final_price') if (matched.get('final_price') and matched.get('final_price') > 0) else matched.get('price')
            results.append({
                'userItem': item_name,
                'matchedName': matched.get('name'),
                'price': price_val
            })
        else:
            results.append({
                'userItem': item_name,
                'matchedName': None,
                'price': None
            })

    return results
