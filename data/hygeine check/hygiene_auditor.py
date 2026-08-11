import sys
import json
import re
import urllib.request
import os

class ZomatoHygieneAuditor:
    """
    Automated Zomato Restaurant Listing Hygiene Auditor
    Scrapes live Zomato restaurant listing state and computes:
    - Photo hygiene coverage (%)
    - Description hygiene coverage (%)
    - Category-wise missing dish photos list
    - Category-wise missing dish descriptions list
    - Rating & Review metrics
    - Actionable hygiene recommendations
    """

    def __init__(self, target_url: str):
        self.target_url = target_url
        self.raw_html = ""
        self.preloaded_state = {}
        self.audit_result = {}

    def fetch_page(self):
        print(f"[+] Fetching live content from: {self.target_url}")
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        }
        req = urllib.request.Request(self.target_url, headers=headers)
        with urllib.request.urlopen(req) as response:
            self.raw_html = response.read().decode('utf-8', errors='ignore')

    def extract_state(self):
        match = re.search(r'window\.__PRELOADED_STATE__\s*=\s*JSON\.parse\((.*?)\);', self.raw_html)
        if match:
            json_raw = match.group(1)
            self.preloaded_state = json.loads(json.loads(json_raw))
            print("[+] Successfully parsed Zomato preloaded state JSON.")
        else:
            raise ValueError("Could not find window.__PRELOADED_STATE__ in page source.")

    def run_audit(self):
        if not self.preloaded_state:
            self.extract_state()

        pages = self.preloaded_state.get('pages', {})
        restaurant_pages = pages.get('restaurant', {})
        if not restaurant_pages:
            raise ValueError("No restaurant data found in state.")

        res_id = list(restaurant_pages.keys())[0]
        res_data = restaurant_pages[res_id]

        # Basic Info
        basic_info = res_data.get('sections', {}).get('SECTION_BASIC_INFO', {})
        restaurant_name = basic_info.get('name', 'Unknown Restaurant')
        cuisines = basic_info.get('cuisine_string', '')
        rating_obj = basic_info.get('rating_new', {}).get('ratings', {})

        dining_rating = rating_obj.get('DINING', {}).get('rating', 'N/A')
        dining_count = rating_obj.get('DINING', {}).get('reviewCount', '0')
        delivery_rating = rating_obj.get('DELIVERY', {}).get('rating', 'N/A')
        delivery_count = rating_obj.get('DELIVERY', {}).get('reviewCount', '0')

        # Menu Audit
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

                    # Check Description
                    desc = item.get('desc') or item.get('description')
                    if desc and len(str(desc).strip()) > 0:
                        dishes_with_desc += 1
                        c_with_descs += 1
                    else:
                        dishes_without_desc += 1
                        c_missing_descs.append(dish_name)
                        missing_descs_all.append({'category': c_name, 'dish': dish_name})

                    # Check Photo
                    has_photo = False
                    for k, v in item.items():
                        if any(term in k.lower() for term in ['image', 'photo', 'thumb', 'pic', 'media']) and v:
                            has_photo = True
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

        # Hygiene Score Calculation (Weighted Formula)
        rating_score = (float(delivery_rating) / 5.0 * 100) if delivery_rating != 'N/A' else 70
        hygiene_score = round((photo_coverage_pct * 0.50) + (desc_coverage_pct * 0.30) + (rating_score * 0.20))

        self.audit_result = {
            'restaurant_info': {
                'name': restaurant_name,
                'cuisines': cuisines,
                'dining_rating': f"{dining_rating}* ({dining_count} reviews)",
                'delivery_rating': f"{delivery_rating}* ({delivery_count} reviews)",
                'url': self.target_url
            },
            'hygiene_scorecard': {
                'overall_hygiene_score': hygiene_score,
                'total_dishes_audited': total_dishes,
                'photo_coverage_pct': photo_coverage_pct,
                'dishes_with_photos': dishes_with_photo,
                'dishes_missing_photos': dishes_without_photo,
                'desc_coverage_pct': desc_coverage_pct,
                'dishes_with_descs': dishes_with_desc,
                'dishes_missing_descs': dishes_without_desc
            },
            'category_breakdown': categories_summary,
            'missing_photos_all': missing_photos_all,
            'missing_descs_all': missing_descs_all
        }

        return self.audit_result

    def generate_json_report(self, output_path: str = "hygiene_audit.json"):
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.audit_result, f, indent=2)
        print(f"[+] JSON report saved to: {output_path}")

    def generate_markdown_report(self, output_path: str = "hygiene_audit.md"):
        res = self.audit_result
        info = res['restaurant_info']
        card = res['hygiene_scorecard']

        lines = [
            f"# Zomato Restaurant Listing Hygiene Audit",
            f"**Restaurant:** {info['name']}  ",
            f"**Cuisines:** {info['cuisines']}  ",
            f"**Dining Rating:** {info['dining_rating']}  ",
            f"**Delivery Rating:** {info['delivery_rating']}  ",
            f"**Overall Hygiene Index:** **{card['overall_hygiene_score']} / 100**  \n",
            f"---",
            f"## Executive Summary Scorecard\n",
            f"| Metric | Value | Coverage % | Status |",
            f"| :--- | :--- | :--- | :--- |",
            f"| **Total Menu Items** | {card['total_dishes_audited']} Dishes | 100% | Scanned |",
            f"| **Dish Photos Present** | {card['dishes_with_photos']} Dishes | {card['photo_coverage_pct']}% | {'Good' if card['photo_coverage_pct'] > 80 else 'Action Needed'} |",
            f"| **Dish Photos MISSING** | {card['dishes_missing_photos']} Dishes | {round(100 - card['photo_coverage_pct'], 1)}% | {'Critical Fix Needed' if card['dishes_missing_photos'] > 50 else 'Normal'} |",
            f"| **Descriptions Present** | {card['dishes_with_descs']} Dishes | {card['desc_coverage_pct']}% | {'Good' if card['desc_coverage_pct'] > 90 else 'Fix Needed'} |",
            f"| **Descriptions MISSING** | {card['dishes_missing_descs']} Dishes | {round(100 - card['desc_coverage_pct'], 1)}% | {'Missing Text' if card['dishes_missing_descs'] > 0 else 'Perfect'} |",
            f"\n---\n",
            f"## Category Breakdown\n"
        ]

        for cat in res['category_breakdown']:
            lines.append(f"### {cat['menu_group']} -> {cat['category_name']}")
            lines.append(f"- **Total Items:** {cat['total_items']}")
            lines.append(f"- **Photos:** {cat['photos_present']} present | **{cat['photos_missing']} missing**")
            lines.append(f"- **Descriptions:** {cat['descs_present']} present | **{cat['descs_missing']} missing**")
            if cat['photos_missing_items']:
                lines.append(f"  - **Missing Photos:** {', '.join(cat['photos_missing_items'][:8])}")
            if cat['descs_missing_items']:
                lines.append(f"  - **Missing Descriptions:** {', '.join(cat['descs_missing_items'])}")
            lines.append("")

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        print(f"[+] Markdown report saved to: {output_path}")


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.zomato.com/jamshedpur/novelty-multicuisine-restaurant-bistupur/order"
    auditor = ZomatoHygieneAuditor(url)
    auditor.fetch_page()
    auditor.run_audit()
    auditor.generate_json_report("hygiene_audit.json")
    auditor.generate_markdown_report("hygiene_audit.md")
