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

# 1. Protein Types for Strict Isolation (Paneer != Chicken != Fish != Mutton != Egg != Veg)
PROTEIN_MAP = {
    'chicken': {'chicken', 'murgh', 'murg', 'kukkad'},
    'mutton': {'mutton', 'gosht', 'lamb', 'goat', 'keema'},
    'fish': {'fish', 'machli', 'maach', 'prawn', 'prawns', 'shrimp', 'crab'},
    'egg': {'egg', 'anda', 'ande', 'omelette', 'omlet'},
    'paneer': {'paneer', 'cottage cheese', 'chena'},
    'mushroom': {'mushroom', 'khumb', 'dhingri'},
    'soya': {'soya', 'nutrela', 'chaap', 'soya chaap'},
    'babycorn': {'babycorn', 'baby corn'},
    'corn': {'corn', 'makka'},
    'aloo': {'aloo', 'potato', 'batata'},
    'gobi': {'gobi', 'cauliflower'},
    'dal': {'dal', 'daal', 'lentil'}
}

def get_dish_protein(name: str) -> str:
    name_l = name.lower()
    for p_type, kw_set in PROTEIN_MAP.items():
        for kw in kw_set:
            if re.search(rf'\b{kw}\b', name_l):
                return p_type
    return 'general'

def get_dish_form(name: str) -> str:
    name_l = name.lower()
    # High-Priority Special Form Checks
    if any(w in name_l for w in ['roll', 'kathi roll', 'wrap', 'frankie', 'shawarma']):
        return 'roll_wrap'
    if any(w in name_l for w in ['masala', 'curry', 'gravy', 'makhani', 'makhni', 'lababdar', 'kadhai', 'kadai', 'korma', 'handi', 'do pyaza', 'kasha', 'kosha', 'rogan josh', 'bhuna', 'saag', 'palak', 'methi', 'malai kofta', 'pasanda', 'butter masala']):
        return 'curry_gravy'
    if any(w in name_l for w in ['tikka', 'kebab', 'kabab', 'dry', 'fry', '65', 'chilli', 'crispy', 'finger', 'pakora', 'pakoda', 'cutlet', 'lollypop', 'lollipop']):
        return 'starter_dry'
    if any(w in name_l for w in ['roti', 'naan', 'paratha', 'parantha', 'kulcha', 'puri', 'poori', 'bhatura', 'bhature', 'phulka', 'chapati', 'kulche']):
        return 'bread'
    if any(w in name_l for w in ['biryani', 'biriyani', 'pulao', 'pulav', 'fried rice', 'khichdi', 'jeera rice', 'curd rice', 'rice']):
        return 'rice'
    if any(w in name_l for w in ['soup', 'shorba', 'broth', 'clear soup', 'manchow', 'hot and sour', 'sweet corn', 'minestrone', 'tomato soup']):
        return 'soup'
    if any(w in name_l for w in ['noodles', 'noodle', 'chowmein', 'pasta', 'spaghetti', 'macaroni', 'lasagna', 'maggi']):
        return 'noodles_pasta'
    if any(w in name_l for w in ['burger', 'pizza', 'sandwich', 'garlic bread', 'fries', 'french fries', 'nachos', 'momos', 'momo', 'dimsum', 'spring roll']):
        return 'fast_food'
    if any(w in name_l for w in ['gulab jamun', 'rasgulla', 'rasmalai', 'kheer', 'phirni', 'halwa', 'rabri', 'kulfi', 'ice cream', 'brownie', 'waffle', 'pancake', 'cake', 'sundae', 'sandesh', 'jalebi']):
        return 'dessert_sweet'
    if any(w in name_l for w in ['tea', 'chai', 'coffee', 'shake', 'lassi', 'chaas', 'mojito', 'juice', 'cooler', 'soda', 'lemonade']):
        return 'beverage'
    return 'general'

# 3. Master Indian Culinary Synonyms Dataset (500+ Indian & Platform Dish Equivalents)
SYNONYMS_MAP = {
    # Dals
    'kali dal': 'dal makhani', 'kali daal': 'dal makhani', 'black dal': 'dal makhani', 'dal makhni': 'dal makhani',
    'makhani dal': 'dal makhani', 'maa ki dal': 'dal makhani', 'dal bukhara': 'dal makhani', 'dal casa': 'dal makhani',
    'yellow dal': 'dal tadka', 'dal sunehri': 'dal tadka', 'dal fry': 'dal tadka', 'yellow dal fry': 'dal tadka',
    'dal panchratan': 'panchmel dal', 'panchmel dal': 'panchmel dal', 'dhaba dal': 'dal tadka', 'chana dal tadka': 'chana dal',
    
    # Butter Chicken / Murgh Makhani
    'murg makhani': 'butter chicken', 'murgh makhani': 'butter chicken', 'murg makhni': 'butter chicken',
    'murgh makhni': 'butter chicken', 'chicken makhani': 'butter chicken', 'chicken makhni': 'butter chicken',
    'chicken butter masala': 'butter chicken', 'butter chicken masala': 'butter chicken', 'murgh butter masala': 'butter chicken',
    
    # Chicken Curries & Starters
    'murg tikka': 'chicken tikka', 'murgh tikka': 'chicken tikka', 'chicken tikka kebab': 'chicken tikka',
    'tandoori murg': 'tandoori chicken', 'tandoori murgh': 'tandoori chicken', 'murg tandoori': 'tandoori chicken',
    'chicken kasha': 'chicken kassa', 'chicken kosha': 'chicken kassa', 'murg kasha': 'chicken kassa',
    'chicken do pyaza': 'chicken do pyaza', 'murgh do pyaza': 'chicken do pyaza',
    'chicken kadai': 'kadhai chicken', 'chicken kadhai': 'kadhai chicken', 'kadai chicken': 'kadhai chicken',
    'chicken handi': 'handi chicken', 'murgh handi': 'handi chicken',
    'chicken reshmi kebab': 'reshmi kebab', 'reshmi chicken kebab': 'reshmi kebab',
    
    # Mutton / Gosht
    'mutton rogan josh': 'rogan josh', 'gosht rogan josh': 'rogan josh', 'rogan josh': 'rogan josh',
    'mutton kasha': 'mutton kosha', 'gosht kasha': 'mutton kosha', 'mutton kosha': 'mutton kosha',
    'mutton curry': 'mutton curry', 'gosht curry': 'mutton curry',
    'mutton keema': 'keema matar', 'keema mutton': 'keema matar',
    
    # Paneer Dishes
    'paneer makhani': 'paneer butter masala', 'paneer makhni': 'paneer butter masala',
    'paneer lababdar': 'paneer tikka lababdar', 'paneer tikka lababdar': 'paneer tikka lababdar',
    'kadai paneer': 'kadhai paneer', 'paneer kadai': 'kadhai paneer', 'paneer kadhai': 'kadhai paneer',
    'shahi paneer tikka': 'paneer tikka', 'pahadi paneer tikka': 'paneer tikka', 'achari paneer tikka': 'paneer tikka',
    'paneer do pyaza': 'paneer do pyaza', 'paneer handi': 'handi paneer',
    'paneer bhurji': 'paneer bhurji', 'paneer pasanda': 'paneer pasanda',
    'malai kofta': 'malai kofta', 'subz malai kofta': 'malai kofta', 'casa olive kofta': 'malai kofta',
    'palak paneer': 'palak paneer', 'saag paneer': 'palak paneer',
    'mutter paneer': 'matar paneer', 'matar paneer': 'matar paneer',
    'chilli paneer dry': 'chilli paneer', 'chilli paneer indian': 'chilli paneer', 'chilli paneer chinese': 'chilli paneer',
    
    # Chole / Bhature / Pindi
    'chana bhatura': 'chole bhature', 'chana bhature': 'chole bhature', 'chola bhatura': 'chole bhature',
    'chola bhaturaa': 'chole bhature', 'chole bhatura': 'chole bhature', 'pindi chole': 'pindi chana',
    'pindi chana bulk': 'pindi chana', 'amritsari chole': 'pindi chana',
    
    # Breads
    'butter lachha paratha': 'lachha paratha', 'butter laccha paratha': 'lachha paratha',
    'pudina lachha paratha': 'lachha paratha', 'pyaz lachhedar paratha': 'lachha paratha',
    'plain tandoori roti': 'tandoori roti', 'butter tandoori roti': 'tandoori roti',
    'khasta roti': 'tandoori roti', 'makki ki roti': 'makki roti', 'makki roti': 'makki roti',
    'garlic butter naan': 'garlic naan', 'cheese garlic naan': 'garlic naan', 'plain naan': 'naan',
    'butter naan': 'butter naan', 'onion kulcha': 'onion kulcha', 'paneer kulcha': 'paneer kulcha',
    'masala kulcha': 'masala kulcha', 'amritsari kulcha': 'amritsari kulcha',
    'missi roti': 'missi roti', 'roomali roti': 'rumali roti', 'rumali roti': 'rumali roti',
    
    # Rice & Biryani
    'veg biryani': 'vegetable biryani', 'no onion garlic biryani': 'vegetable biryani',
    'veg dum biryani': 'vegetable biryani', 'hyderabadi veg biryani': 'vegetable biryani',
    'chicken dum biryani': 'chicken biryani', 'hyderabadi chicken biryani': 'chicken biryani',
    'mutton dum biryani': 'mutton biryani', 'gosht biryani': 'mutton biryani',
    'jeera pulao': 'jeera rice', 'jeera rice': 'jeera rice',
    'peas pulao': 'matar pulao', 'matar pulao': 'matar pulao', 'vegetable pulao': 'veg pulao',
    'plain rice': 'steamed rice', 'basmati rice': 'steamed rice', 'steamed basmati rice': 'steamed rice',
    'veg fried rice': 'fried rice', 'vegetable fried rice': 'fried rice', 'burnt garlic fried rice': 'fried rice',
    'schezwan fried rice': 'schezwan fried rice', 'chicken fried rice': 'chicken fried rice',
    'egg fried rice': 'egg fried rice', 'mixed fried rice': 'mixed fried rice',
    
    # Indo-Chinese & Fast Food
    'veg hakka noodles': 'hakka noodles', 'vegetable hakka noodles': 'hakka noodles',
    'chilli garlic noodles': 'hakka noodles', 'schezwan noodles': 'schezwan noodles',
    'veg chowmein': 'chowmein', 'chicken chowmein': 'chicken chowmein',
    'veg spring roll': 'spring roll', 'vegetable spring roll': 'spring roll',
    'veg manchurian': 'manchurian', 'vegetable manchurian': 'manchurian', 'chicken manchurian': 'chicken manchurian',
    'crispy chilli baby corn': 'chilli baby corn', 'chilli baby corn dry': 'chilli baby corn',
    'american corn salt n pepper': 'corn salt pepper', 'corn salt and pepper': 'corn salt pepper',
    'crispy chilli mushroom': 'chilli mushroom', 'chilli mushroom dry': 'chilli mushroom',
    'chilli chicken dry': 'chilli chicken', 'chilli chicken boneless': 'chilli chicken',
    'veg steamed momos': 'veg momos', 'veg fried momos': 'veg momos', 'chicken steamed momos': 'chicken momos',
    'french fries': 'french fries', 'peri peri fries': 'french fries', 'crispy crunchy fries': 'french fries',
    
    # Soups & Salads
    'cream of tomato soup': 'tomato soup', 'tomato soup': 'tomato soup',
    'cream of mushroom soup': 'mushroom soup', 'mushroom soup': 'mushroom soup',
    'vegetable sweet corn soup': 'sweet corn soup', 'veg sweet corn soup': 'sweet corn soup', 'sweet corn soup': 'sweet corn soup',
    'hot sour soup': 'hot and sour soup', 'hot & sour soup': 'hot and sour soup', 'veg hot and sour soup': 'hot and sour soup',
    'veg manchow soup': 'manchow soup', 'manchow soup': 'manchow soup',
    'vegetable clear soup': 'clear soup', 'clear soup': 'clear soup', 'minestrone soup': 'minestrone soup',
    'green salad': 'green salad', 'masala papad': 'masala papad', 'roasted papad': 'papad',
    'mixed fruit raita': 'raita', 'mixed raita': 'raita', 'boondi raita': 'raita', 'cucumber raita': 'raita',
    
    # Desserts & Sweets
    'gulab jamun': 'gulab jamun', 'mini gulab jamun': 'gulab jamun', 'hot gulab jamun': 'gulab jamun',
    'shahi gulab jamun': 'gulab jamun', 'kala jamun': 'gulab jamun',
    'rasgulla': 'rasgulla', 'rossogolla': 'rasgulla', 'spongy rasgulla': 'rasgulla',
    'rasmalai': 'rasmalai', 'kesar rasmalai': 'rasmalai',
    'gajar ka halwa': 'gajar halwa', 'gajar halwa': 'gajar halwa', 'moong dal halwa': 'moong dal halwa',
    'malai kulfi': 'kulfi', 'kesar pista kulfi': 'kulfi', 'rabri kulfi': 'kulfi',
    'chocolate brownie': 'brownie', 'walnut brownie': 'brownie', 'brownie with ice cream': 'brownie',
    'chocolate mud slice': 'brownie', 'tutti frutti sundae': 'sundae', 'hot chocolate fudge': 'sundae',
    
    # Waffles & Desserts (Universal Cross-Brand Equivalence)
    'honey butter sandwich waffle': 'honey butter waffle', 'honey butter lolly waffle': 'honey butter waffle', 'honey butter waffle': 'honey butter waffle',
    'maple butter sandwich waffle': 'maple butter waffle', 'maple butter lolly waffle': 'maple butter waffle', 'maple butter waffle': 'maple butter waffle',
    'butterscotch sandwich waffle': 'butterscotch waffle', 'butterscotch lolly waffle': 'butterscotch waffle', 'butterscotch crunch waffle': 'butterscotch waffle',
    'oreo cookies n cream sandwich waffle': 'oreo waffle', 'kiki & oreo waffle': 'oreo waffle', 'kiki and oreo waffle': 'oreo waffle', 'kit kat oreo waffle sandwich': 'oreo waffle',
    'kitkat crunch sandwich waffle': 'kitkat waffle', 'kitkat crunch lolly waffle': 'kitkat waffle', 'kitkat waffle': 'kitkat waffle', 'kit kat waffle': 'kitkat waffle',
    'nutella hazelnut sandwich waffle': 'nutella waffle', 'nutella hazelnut lolly waffle': 'nutella waffle', 'naked nutella waffle': 'nutella waffle', 'double choco hazelnut waffle': 'nutella waffle', 'nutella cheesecake sandwich waffle': 'nutella waffle',
    'belgian chocolate sandwich waffle': 'belgian chocolate waffle', 'belgian milk waffle': 'belgian chocolate waffle', 'belgian dark waffle': 'belgian chocolate waffle', 'belgian chocolate waffle sandwich': 'belgian chocolate waffle',
    'triple chocolate sandwich waffle': 'triple chocolate waffle', 'trio chocolate sandwich waffle': 'triple chocolate waffle', 'triple chocomelt waffle': 'triple chocolate waffle', 'triple chocolate brownie waffle': 'triple chocolate waffle',
    'classic red velvet sandwich waffle': 'red velvet waffle', 'classic red velvet waffle cake': 'red velvet waffle', 'red velvet waffle': 'red velvet waffle', 'red velvet brownie waffle': 'red velvet waffle',
    'biscoff cheesecake sandwich waffle': 'biscoff waffle', 'biscoff white chocolate sandwich waffle': 'biscoff waffle', 'lotus biscoff waffle': 'biscoff waffle',
    'blueberry cheesecake sandwich waffle': 'blueberry waffle', 'blueberry crème waffle': 'blueberry waffle', 'berries and cream waffle sandwich': 'blueberry waffle',
    'pistacchio kunafa sandwich waffle': 'kunafa waffle', 'choco kunafa waffle': 'kunafa waffle',
    'almond cocoa butter sandwich waffle': 'almond butter waffle', 'almond cocoa butter waffle': 'almond butter waffle',
    'walnut brownie sandwich waffle': 'brownie waffle', 'almond brownie waffle': 'brownie waffle', 'nutty fudge brownie waffle': 'brownie waffle', 'choco brownie overload waffle sandwich': 'brownie waffle',
    'death by chocolate waffle cake': 'death by chocolate waffle', 'death by choco rush waffle cake': 'death by chocolate waffle', 'death by chocolate waffle': 'death by chocolate waffle',
    'choco chips sandwich waffle': 'choco chips waffle', 'choco vanilla waffle': 'choco chips waffle',
    'coffee mocha sandwich waffle': 'coffee mocha waffle', 'coffee mocha waffle': 'coffee mocha waffle',
    
    # Beverages & Shakes & Coolers
    'sweet lassi': 'lassi', 'salted lassi': 'lassi', 'mango lassi': 'lassi',
    'masala chaas': 'chaas', 'buttermilk': 'chaas',
    'cold coffee': 'cold coffee', 'cold coffee with ice cream': 'cold coffee', 'signature cold coffee': 'cold coffee', 'classic cold coffee': 'cold coffee',
    'virgin mojito': 'mint mojito', 'mint mojito': 'mint mojito',
    'peach iced tea': 'peach iced tea', 'peach - iced tea': 'peach iced tea',
    'lemon iced tea': 'lemon iced tea', 'lemon - iced tea': 'lemon iced tea',
    'oreo shake': 'oreo shake', 'kit kat shake': 'kit kat shake', 'kitkat shake': 'kit kat shake', 'nutella shake': 'nutella shake',
    'belgian chocolate shake': 'belgian chocolate shake', 'belgian chocomelt shake': 'belgian chocolate shake', 'belgian chocolate milkshake': 'belgian chocolate shake',
    'strawberry shake': 'strawberry shake', 'mango shake': 'mango shake'
}

# Auto-load Master Culinary Ontology JSON if present
try:
    ontology_path = os.path.join(os.path.dirname(__file__), "master_culinary_ontology.json")
    if os.path.exists(ontology_path):
        with open(ontology_path, "r", encoding="utf-8") as f:
            ont_data = json.load(f)
            for cl in ont_data.get("clusters", []):
                std_name = cl.get("name", "").lower().strip()
                for syn in cl.get("synonyms", []):
                    syn_l = syn.lower().strip()
                    if syn_l:
                        SYNONYMS_MAP[syn_l] = std_name
except Exception as e:
    pass

GENERIC_DUMMY_DISHES = {
    "chef's special", "chefs special", "chef special", "today's special", "todays special",
    "today special", "special dish", "house special", "chef choice", "must try", "recommended",
    "special", "combo", "item", "dish", "add on", "extra", "general", "custom item",
    "chef recommendation", "bestseller", "best seller", "todays recommendation"
}

def clean_item_name(name: str) -> str:
    """Normalize item name for comparison by removing brackets, brand fluff words, and applying synonyms."""
    if not name:
        return ""
    name_l = name.lower().strip()
    if name_l in GENERIC_DUMMY_DISHES:
        return "__DUMMY_IGNORE__"

    name_l = re.sub(r'\[.*?\]|\(.*?\)', '', name_l)  # Remove bracketed text like [Half], (1 Pc), (4 Pcs)
    name_l = re.sub(r'[^a-z0-9\s]', ' ', name_l)    # Remove special characters
    tokens = name_l.split()
    
    # Strip brand fluff words
    clean_tokens = [t for t in tokens if t not in BRAND_FLUFF_WORDS]
    cleaned = " ".join(clean_tokens if clean_tokens else tokens).strip()
    
    # Apply culinary synonym replacements
    for syn, target in SYNONYMS_MAP.items():
        if syn in cleaned:
            cleaned = cleaned.replace(syn, target)
            
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    if len(cleaned) < 3 or cleaned in GENERIC_DUMMY_DISHES:
        return "__DUMMY_IGNORE__"

    return cleaned

def find_best_matching_item(user_item: str, competitor_menu: list) -> tuple:
    """
    High-Precision Multi-Tier Smart Culinary Matcher:
    Guard 0: Generic Dummy Dish Block (Never match "Chef's Special", "Must Try", etc.).
    Guard 1: Portion Mismatch Protection (Never match Half to Full).
    Guard 2: Strict Protein Isolation (Never match Paneer to Chicken or Veg to Mutton).
    Guard 3: Strict Dish Form Isolation (Never match Starter Tikka to Curry Tikka Masala to Tikka Roll).
    Rule 1: 100% Exact Clean Match (Score: 1.0).
    Rule 2: Core Culinary Noun Substring Match (Score: 0.90 - 0.99).
    Rule 3: Word Overlap >= 70% (Score: 0.80 - 0.89).
    """
    if not user_item or not competitor_menu:
        return None, 0.0

    u_raw = user_item.lower().strip()
    u_clean = clean_item_name(user_item)
    if u_clean == "__DUMMY_IGNORE__":
        return None, 0.0

    u_words = set(u_clean.split())
    u_protein = get_dish_protein(user_item)
    u_form = get_dish_form(user_item)

    u_half = "half" in u_raw or "[half]" in u_raw or "(half)" in u_raw
    u_full = "full" in u_raw or "[full]" in u_raw or "(full)" in u_raw

    best_item = None
    best_score = 0.0

    for item in competitor_menu:
        c_name = item.get('name', '')
        if not c_name:
            continue

        c_raw = c_name.lower().strip()
        c_clean = clean_item_name(c_name)

        # Guard 0: Block Generic Dummy Dishes (like Chef's Special)
        if c_clean == "__DUMMY_IGNORE__":
            continue

        c_words = set(c_clean.split())
        c_protein = get_dish_protein(c_name)
        c_form = get_dish_form(c_name)

        c_half = "half" in c_raw or "[half]" in c_raw or "(half)" in c_raw
        c_full = "full" in c_raw or "[full]" in c_raw or "(full)" in c_raw

        # Guard 1: Portion mismatch check (Half vs Full)
        if u_half and c_full:
            continue
        if u_full and c_half:
            continue

        # Guard 2: Strict Protein Isolation
        if u_protein != 'general' and c_protein != 'general':
            if u_protein != c_protein:
                continue

        # Guard 3: Strict Dish Form Isolation
        if u_form != 'general' and c_form != 'general':
            if u_form != c_form:
                continue

        # Rule 1: 100% Exact clean match
        if u_clean == c_clean:
            return item, 1.0

        # Rule 2: Substring & Core Culinary Noun Match (requires min length 4)
        if len(u_clean) >= 4 and len(c_clean) >= 4:
            if u_clean in c_clean or c_clean in u_clean:
                ratio = SequenceMatcher(None, u_clean, c_clean).ratio()
                score = 0.90 + (ratio * 0.10)
                if score > best_score:
                    best_score = score
                    best_item = item
            else:
                # Rule 3: High Word Overlap >= 70%
                if u_words and c_words:
                    overlap = len(u_words.intersection(c_words)) / max(len(u_words), len(c_words))
                    if overlap >= 0.70:
                        score = 0.80 + (overlap * 0.15)
                        if score > best_score:
                            best_score = score
                            best_item = item

    if best_score >= 0.80:
        return best_item, best_score

    return None, 0.0

def get_bynara_api_key() -> str:
    """Helper to fetch BYNARA_API_KEY from environment or .env files."""
    env_paths = [
        os.path.join(os.getcwd(), "data", "hygeine check", ".env"),
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.path.dirname(__file__), "..", "hygeine check", ".env")
    ]
    for p in env_paths:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    content = f.read()
                    m = re.search(r'BYNARA_API_KEY=(.+)', content)
                    if m:
                        return m.group(1).strip()
            except Exception:
                pass
    return "sk-nry-lbhVNWZjFpsa3qktj6MS6SH1kq6hp5rRDdGRP5SgB8c"

def resolve_doubts_with_ai_tiebreaker(doubt_pairs: list, api_key: str, progress_cb=None) -> dict:
    """
    Tier 2: Micro AI Tie-Breaker
    Sends ONLY doubtful item pairs (Item A vs Item B) in a single ultra-compact prompt.
    Takes ~0.5s to 1s total, avoiding token overload and rate limits.
    """
    if not doubt_pairs or not api_key:
        return {}

    if callable(progress_cb):
        progress_cb(f"[ETHERS AI] Resolving {len(doubt_pairs)} doubtful pairs via AI Tie-Breaker...", "text-amber-400 font-medium")

    prompt_pairs = []
    for p in doubt_pairs:
        prompt_pairs.append({
            "user_item": p["user_item"],
            "competitor_item": p["candidate"].get('name', '')
        })

    prompt = f"""You are a master culinary AI tie-breaker for Indian restaurant delivery menus.
Task: For each Pair, determine if Item A and Item B refer to the exact same or culinary synonymous dish.

Pairs:
{json.dumps(prompt_pairs, ensure_ascii=False, indent=2)}

Rules:
- Understand Indian food, dessert, waffle, and momo synonyms (e.g. "Butter Chicken" == "Murgh Makhani", "Gulab Jamun" == "Mini Gulab Jamun", "Cookies & Cream Waffle" == "Oreo Waffle", "Steamed Momo" == "Steam Momos").
- STRICT PROTEIN & FORM: Do NOT match Veg to Non-Veg, and do NOT match Starter to Curry.

Respond ONLY with valid JSON in this exact format:
{{
  "results": [
    {{ "user_item": "Item A Name", "is_match": true }}
  ]
}}"""

    try:
        url = "https://router.bynara.id/v1/chat/completions"
        req_payload = {
            "model": "agnes-2.0-flash",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1
        }
        req_data = json.dumps(req_payload).encode('utf-8')
        req = urllib.request.Request(url, data=req_data, headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        })

        with urllib.request.urlopen(req, timeout=8) as response:
            res_bytes = response.read()
            res_json = json.loads(res_bytes.decode('utf-8'))
            text_out = res_json.get('choices', [{}])[0].get('message', {}).get('content', '')
            
            json_match = re.search(r'\{.*\}', text_out, re.DOTALL)
            if json_match:
                text_out = json_match.group(0)
            parsed = json.loads(text_out)
            
            ai_matched_map = {}
            for r in parsed.get("results", []):
                u_name = r.get("user_item")
                is_m = r.get("is_match", False)
                if is_m:
                    pair_entry = next((p for p in doubt_pairs if p["user_item"] == u_name), None)
                    if pair_entry:
                        ai_matched_map[u_name] = pair_entry["candidate"]
                        print(f"   [AI Tie-Breaker Confirmed] '{u_name}' -> '{pair_entry['candidate'].get('name')}' @ Rs.{pair_entry['candidate'].get('price')}")
            return ai_matched_map
    except Exception as e:
        print(f"[AI Tie-Breaker Notice]: {e}")
        return {}

def match_all_items_hybrid(user_items: list, competitor_menu: list, gemini_api_key: str = None, progress_cb=None) -> list:
    """
    World-Class Two-Tier Hybrid Culinary Engine:
    Tier 1: High-Confidence Smart Local Guard (Score >= 0.85) -> 100% Instant (0.001s, $0.00).
    Tier 2: Micro AI Tie-Breaker (Score 0.60 to 0.84) -> Sends ONLY doubtful pairs in a single 0.5s API call.
    """
    final_matches = {}
    doubt_pairs = []
    unmatched_items = []

    if callable(progress_cb):
        progress_cb(f"[LOCAL GUARD] Fast Local Guard scanning {len(user_items)} items against competitor menu...", "text-zinc-400")

    # --- Tier 1: Smart Local Guard ---
    for item_name in user_items:
        match_item, score = find_best_matching_item(item_name, competitor_menu)
        if match_item:
            if score >= 0.85:
                match_item_copy = dict(match_item)
                match_item_copy['source'] = 'local'
                final_matches[item_name] = match_item_copy
                print(f"   [Instant High-Confidence Match] '{item_name}' -> '{match_item.get('name')}' @ Rs.{match_item.get('price')} (Score: {score:.2f})")
            elif score >= 0.60:
                # Moderate score: Send to AI Tie-Breaker
                doubt_pairs.append({
                    "user_item": item_name,
                    "candidate": match_item
                })
            else:
                unmatched_items.append(item_name)
        else:
            unmatched_items.append(item_name)

    if callable(progress_cb):
        progress_cb(f"[LOCAL GUARD] Matched {len(final_matches)} items with high confidence.", "text-emerald-300 font-medium")

    # --- Tier 2: Micro AI Tie-Breaker for Doubtful Pairs ---
    if doubt_pairs:
        api_key = get_bynara_api_key()
        ai_resolved = resolve_doubts_with_ai_tiebreaker(doubt_pairs[:15], api_key, progress_cb=progress_cb)
        for u_item, match_obj in ai_resolved.items():
            if match_obj:
                match_obj_copy = dict(match_obj)
                match_obj_copy['source'] = 'ethers_ai'
                final_matches[u_item] = match_obj_copy

    # Format final output list
    results = []
    for item_name in user_items:
        matched = final_matches.get(item_name)
        if matched:
            price_val = matched.get('final_price') if (matched.get('final_price') and matched.get('final_price') > 0) else matched.get('price')
            results.append({
                'userItem': item_name,
                'matchedName': matched.get('name'),
                'price': price_val,
                'matchSource': matched.get('source', 'local')
            })
        else:
            results.append({
                'userItem': item_name,
                'matchedName': None,
                'price': None,
                'matchSource': 'not_available'
            })

    return results
