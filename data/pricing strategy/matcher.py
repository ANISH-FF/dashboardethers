import re
from difflib import SequenceMatcher

# Core food nouns that MUST match if present in the user's dish name
CORE_FOOD_NOUNS = {
    'chicken', 'mutton', 'fish', 'egg', 'prawn', 'prawns', 'lamb', 'pork', 'beef', 'crab', 'duck',
    'paneer', 'dosa', 'idli', 'biryani', 'naan', 'roti', 'paratha', 'roll', 'burger', 'pizza',
    'chowmein', 'noodles', 'soup', 'thali', 'rice', 'dal', 'khichdi', 'pattice', 'tea', 'coffee',
    'shake', 'lassi', 'milk', 'momos', 'chole', 'bhature', 'sandwich', 'pasta', 'maggi'
}

def clean_item_name(name: str) -> str:
    """Normalize item name for comparison."""
    name = name.lower().strip()
    name = re.sub(r'\[.*?\]|\(.*?\)', '', name)  # Remove bracketed text like [Half], (1 Pc)
    name = re.sub(r'[^a-z0-9\s]', ' ', name)    # Remove special characters
    return re.sub(r'\s+', ' ', name).strip()

def find_best_matching_item(user_item: str, competitor_menu: list) -> dict:
    """
    Finds the best matching food item from a competitor's menu list for a given user item name.
    Strictly verifies core food nouns (e.g. chicken, paneer, dosa) to prevent false matches.
    """
    user_clean = clean_item_name(user_item)
    user_tokens = set(user_clean.split())

    # Find essential nouns in user item
    user_core_nouns = user_tokens.intersection(CORE_FOOD_NOUNS)

    best_match = None
    highest_score = 0.0

    for item in competitor_menu:
        comp_name = item.get('name', '')
        comp_clean = clean_item_name(comp_name)
        comp_tokens = set(comp_clean.split())

        # Core Noun Guard: If user dish specifies chicken/paneer/dosa/etc., candidate MUST contain it
        if user_core_nouns:
            comp_core_nouns = comp_tokens.intersection(CORE_FOOD_NOUNS)
            if not user_core_nouns.issubset(comp_core_nouns):
                continue

        # Exact clean match
        if user_clean == comp_clean:
            return item

        # Token overlap ratio
        overlap = len(user_tokens.intersection(comp_tokens))
        if overlap == 0:
            continue

        token_score = (overlap / max(len(user_tokens), 1)) * 0.7
        seq_score = SequenceMatcher(None, user_clean, comp_clean).ratio() * 0.3
        total_score = token_score + seq_score
        
        # Penalize bulk or combo items so single portions win ties
        bulk_keywords = ['pack of', 'family', 'combo', 'bucket', 'party', 'bulk', 'kilo', 'kg', 'serves']
        if any(keyword in comp_name.lower() for keyword in bulk_keywords):
            total_score -= 0.15

        if total_score > highest_score:
            highest_score = total_score
            best_match = item

    # Return best match if confidence score > 0.50
    if best_match and highest_score >= 0.50:
        return best_match

    return None
