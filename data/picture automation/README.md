# 🍽️ Food Image Batch Scraper

Searches **Zomato & Swiggy by food name** (not by link/ID) and downloads
real restaurant food photos. Packages everything into a ZIP named after your brand.

---

## ✅ How It Works (The Right Way)

| ❌ Old (broken) approach | ✅ New approach |
|---|---|
| Needs a direct Zomato/Swiggy link | Searches by food **name** — works for any item |
| Fails when item has no dish page | Uses Zomato/Swiggy **search** like a real user would |
| Can't batch multiple items | Processes your **entire list** automatically |
| Manual image naming | Auto-renames to `paneer_butter_masala_01.jpg` |

---

## 🚀 Run the Tool

```bash
python food_image_batch_scraper.py
```

The GUI window opens. Then:

1. **Upload** your Excel / CSV / TXT file with food item names
2. **Set** your brand name (used as the ZIP filename)
3. **Choose** platform: Zomato / Swiggy / Both
4. **Set** images per item (e.g. 5)
5. Click **🚀 Generate Images**
6. ZIP file saved to your output folder automatically

---

## 📄 Input File Format

**Excel (.xlsx)** — one item per row in column A:
```
Paneer Butter Masala
Chicken Biryani
Masala Dosa
Dal Makhani
```
> Use `sample_food_list.xlsx` as a starting template.

**CSV or TXT** — also supported, one item per line.

---

## 📦 Output Structure

```
downloads/
  my_brand/
    paneer_butter_masala/
      paneer_butter_masala_01.jpg
      paneer_butter_masala_02.jpg
    chicken_biryani/
      chicken_biryani_01.jpg
      ...
  my_brand.zip   ← ready to share / upload to Drive
```

---

## 🔍 Scraping Strategy (3-layer fallback)

1. **Zomato Search** — visits `zomato.com/{city}/delivery?q={food_name}` across
   15+ Indian cities, extracts images from `b.zmtcdn.com/data/dish_photos/` CDN
2. **Swiggy Search** — visits `swiggy.com/city/{city}/dish-{name}` and search URL
3. **Google Images fallback** — searches `{food_name} zomato restaurant dish photo`
   if Zomato/Swiggy didn't return enough images

> **No AI-generated or stock images** — all images come directly from Zomato/Swiggy CDN URLs.

---

## 📦 Install Requirements

```bash
pip install undetected-chromedriver selenium requests openpyxl pillow
```

> Requires Google Chrome installed on your PC.

---

## 💡 Tips

- Use **"Both"** platform for best results
- **5–8 images** per item is a good target
- Chrome will open in the background (headless mode) — don't close it
- If Zomato/Swiggy blocks scraping temporarily, the Google fallback kicks in
