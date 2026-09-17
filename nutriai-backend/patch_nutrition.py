"""
patch_nutrition.py — inject clean short-name aliases into nutrition.json
so that every cuisine ingredient has an exact key match.
Run once: python patch_nutrition.py
"""
import json

DATA_PATH = "data/nutrition.json"

with open(DATA_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

ingr = data["ingredients"]

# ── Short-name → USDA key (must already exist in the DB) ──────────────────────
USDA_ALIASES = {
    "spinach":        "spinach, raw",
    "tomato":         "tomatoes, red, ripe, raw, year round average",
    "onion":          "onions, raw",
    "potato":         "potatoes, raw, skin",
    "cauliflower":    "cauliflower, raw",
    "brinjal":        "eggplant, raw",
    "bhindi":         "okra, raw",
    "bitter gourd":   "balsam-pear (bitter gourd), pods, raw",
    "banana":         "bananas, raw",
    "apple":          "apples, raw, with skin",
    "mango":          "mangos, raw",
    "guava":          "guavas, common, raw",
    "papaya":         "papayas, raw",
    "pomegranate":    "pomegranates, raw",
    "quinoa":         "quinoa, cooked",
    "almonds":        "nuts, almonds",
    "cashews":        "nuts, cashew nuts, raw",
    "peanuts":        "peanuts, all types, raw",
    "walnuts":        "nuts, walnuts, english",
    "chia seeds":     "seeds, chia seeds, dried",
    "flaxseeds":      "seeds, flaxseed",
    "eggs":           "egg, whole, raw, fresh",
    "chicken breast": "chicken, broilers or fryers, breast, meat only, cooked, roasted",
    "firm tofu":      "tofu, firm, prepared with calcium sulfate",
    "milk":           "milk, whole, 3.25% milkfat, with added vitamin d",
    "yogurt":         "yogurt, plain, whole milk, 8 grams protein per 8 ounce",
    "paneer":         "cheese, cottage, creamed, large or small curd",
    "salmon":         "fish, salmon, atlantic, wild, raw",
    "tuna":           "fish, tuna, light, canned in water, drained solids",
    "brown rice":     "rice, brown, long-grain, cooked",
    "basmati rice":   "rice, white, long-grain, regular, cooked, unenriched, with salt",
    "oats":           "cereals, oats, instant, fortified, plain, dry",
    "honey":          "honey",
    "olive oil":      "oil, olive, salad or cooking",
    "sesame oil":     "oil, sesame, salad or cooking",
    "coconut milk":   "beverages, coconut water, not from concentrate",
    "lentils":        "lentils, raw",
    "toor dal":       "lentils, raw",
    "moong dal":      "mung beans, mature seeds, raw",
    "chana dal":      "chickpeas (garbanzo beans, bengal gram), mature seeds, raw",
    "masoor dal":     "lentils, raw",
    "urad dal":       "mung beans, mature seeds, raw",
    "rajma":          "beans, kidney, red, mature seeds, raw",
    "black eyed peas":"cowpeas (blackeyes), immature seeds, raw",
    "chana":          "chickpeas (garbanzo beans, bengal gram), mature seeds, raw",
    "chickpeas":      "chickpeas (garbanzo beans, bengal gram), mature seeds, raw",
    "green moong dal":"mung beans, mature seeds, raw",
    "soya chunks":    "soybeans, mature seeds, raw",
}

# ── Hand-crafted nutrition for ingredients not in USDA ────────────────────────
# Format matches existing DB rows: calories_kcal, protein_g, carbs_g, fat_g,
# fiber_g, sodium_mg, glycemic_index, gluten_free, dairy_free,
# diabetes_rating, notes
MANUAL_ENTRIES = {
    "ghee": {
        "calories_kcal": 900, "protein_g": 0.0,  "carbs_g": 0.0,
        "fat_g": 99.8,  "fiber_g": 0.0, "sodium_mg": 2,
        "glycemic_index": 0, "gluten_free": True, "dairy_free": False,
        "diabetes_rating": "moderate",
        "notes": "Clarified butter used widely in Indian cooking. High in saturated fat — use in moderation."
    },
    "coconut oil": {
        "calories_kcal": 862, "protein_g": 0.0, "carbs_g": 0.0,
        "fat_g": 100.0, "fiber_g": 0.0, "sodium_mg": 0,
        "glycemic_index": 0, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "good",
        "notes": "Rich in medium-chain triglycerides (MCTs). Good for high-heat cooking."
    },
    "mustard oil": {
        "calories_kcal": 884, "protein_g": 0.0, "carbs_g": 0.0,
        "fat_g": 100.0, "fiber_g": 0.0, "sodium_mg": 0,
        "glycemic_index": 0, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "good",
        "notes": "High in monounsaturated fats and omega-3. Traditional cooking oil in North/East India."
    },
    "besan": {
        "calories_kcal": 387, "protein_g": 22.4, "carbs_g": 58.0,
        "fat_g": 6.7, "fiber_g": 10.9, "sodium_mg": 64,
        "glycemic_index": 35, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "excellent",
        "notes": "Chickpea flour. High protein, low GI, excellent for diabetics."
    },
    "ragi flour": {
        "calories_kcal": 336, "protein_g": 7.3, "carbs_g": 72.6,
        "fat_g": 1.5, "fiber_g": 3.6, "sodium_mg": 11,
        "glycemic_index": 68, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "good",
        "notes": "Finger millet flour. Rich in calcium. Good gluten-free alternative."
    },
    "jowar flour": {
        "calories_kcal": 349, "protein_g": 10.4, "carbs_g": 72.6,
        "fat_g": 3.3, "fiber_g": 6.3, "sodium_mg": 6,
        "glycemic_index": 62, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "good",
        "notes": "Sorghum flour. Gluten-free, high fibre, suitable for diabetics."
    },
    "semolina": {
        "calories_kcal": 360, "protein_g": 12.7, "carbs_g": 72.8,
        "fat_g": 1.1, "fiber_g": 3.9, "sodium_mg": 1,
        "glycemic_index": 66, "gluten_free": False, "dairy_free": True,
        "diabetes_rating": "moderate",
        "notes": "Durum wheat semolina (Rava/Sooji). Medium GI — moderate portion size for diabetics."
    },
    "poha": {
        "calories_kcal": 350, "protein_g": 6.6, "carbs_g": 77.0,
        "fat_g": 0.6, "fiber_g": 1.3, "sodium_mg": 15,
        "glycemic_index": 70, "gluten_free": False, "dairy_free": True,
        "diabetes_rating": "moderate",
        "notes": "Flattened rice. Light and easy to digest. Moderate GI — limit portion for diabetics."
    },
    "turmeric": {
        "calories_kcal": 354, "protein_g": 7.8, "carbs_g": 64.9,
        "fat_g": 9.9, "fiber_g": 21.1, "sodium_mg": 38,
        "glycemic_index": 15, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "excellent",
        "notes": "Powerful anti-inflammatory and antioxidant spice. Curcumin has documented health benefits."
    },
    "cumin seeds": {
        "calories_kcal": 375, "protein_g": 17.8, "carbs_g": 44.2,
        "fat_g": 22.3, "fiber_g": 10.5, "sodium_mg": 168,
        "glycemic_index": 5, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "excellent",
        "notes": "Rich in iron. Aids digestion. Used in tiny amounts so calorie impact is negligible."
    },
    "coriander seeds": {
        "calories_kcal": 298, "protein_g": 12.4, "carbs_g": 54.9,
        "fat_g": 17.8, "fiber_g": 41.9, "sodium_mg": 35,
        "glycemic_index": 5, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "excellent",
        "notes": "Helps lower blood sugar. Excellent for digestive health."
    },
    "mustard seeds": {
        "calories_kcal": 508, "protein_g": 26.1, "carbs_g": 28.1,
        "fat_g": 36.2, "fiber_g": 12.2, "sodium_mg": 13,
        "glycemic_index": 5, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "excellent",
        "notes": "Rich in omega-3, selenium and manganese. Used in small amounts for tempering."
    },
    "garam masala": {
        "calories_kcal": 379, "protein_g": 13.0, "carbs_g": 50.4,
        "fat_g": 15.0, "fiber_g": 14.0, "sodium_mg": 63,
        "glycemic_index": 10, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "excellent",
        "notes": "Blend of ground spices. Anti-inflammatory properties. Used in small quantities."
    },
    "red chili powder": {
        "calories_kcal": 282, "protein_g": 13.5, "carbs_g": 49.7,
        "fat_g": 14.3, "fiber_g": 27.2, "sodium_mg": 30,
        "glycemic_index": 15, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "good",
        "notes": "Capsaicin boosts metabolism. High in vitamin C and antioxidants."
    },
    "cardamom": {
        "calories_kcal": 311, "protein_g": 10.8, "carbs_g": 68.5,
        "fat_g": 6.7, "fiber_g": 28.0, "sodium_mg": 18,
        "glycemic_index": 5, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "excellent",
        "notes": "Digestive aid. Used in small amounts — negligible calorie impact."
    },
    "cloves": {
        "calories_kcal": 274, "protein_g": 6.0, "carbs_g": 65.5,
        "fat_g": 13.0, "fiber_g": 33.9, "sodium_mg": 277,
        "glycemic_index": 5, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "excellent",
        "notes": "Eugenol in cloves has strong antioxidant properties. Helps regulate blood sugar."
    },
    "cinnamon": {
        "calories_kcal": 247, "protein_g": 4.0, "carbs_g": 80.6,
        "fat_g": 1.2, "fiber_g": 53.1, "sodium_mg": 10,
        "glycemic_index": 5, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "excellent",
        "notes": "Improves insulin sensitivity. One of the best spices for blood sugar control."
    },
    "coconut yogurt": {
        "calories_kcal": 99, "protein_g": 0.9, "carbs_g": 7.4,
        "fat_g": 7.8, "fiber_g": 0.4, "sodium_mg": 47,
        "glycemic_index": 35, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "good",
        "notes": "Dairy-free yogurt alternative. Contains live cultures. Good for lactose intolerance."
    },
    "almond milk unsweetened": {
        "calories_kcal": 17, "protein_g": 0.6, "carbs_g": 0.3,
        "fat_g": 1.4, "fiber_g": 0.3, "sodium_mg": 72,
        "glycemic_index": 25, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "excellent",
        "notes": "Very low calorie, low GI dairy-free milk. Excellent for weight management and diabetics."
    },
    "soy milk": {
        "calories_kcal": 54, "protein_g": 3.3, "carbs_g": 6.3,
        "fat_g": 1.8, "fiber_g": 0.5, "sodium_mg": 51,
        "glycemic_index": 34, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "excellent",
        "notes": "High protein dairy alternative. Suitable for vegans and lactose-intolerant."
    },
    "soya chunks": {
        "calories_kcal": 336, "protein_g": 52.4, "carbs_g": 33.0,
        "fat_g": 0.5, "fiber_g": 13.0, "sodium_mg": 17,
        "glycemic_index": 15, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "excellent",
        "notes": "Very high plant protein. Excellent meat alternative. Low GI, low fat."
    },
    "fish fillet": {
        "calories_kcal": 105, "protein_g": 22.1, "carbs_g": 0.0,
        "fat_g": 1.2, "fiber_g": 0.0, "sodium_mg": 61,
        "glycemic_index": 0, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "excellent",
        "notes": "Lean protein source. Zero carbs, high in omega-3. Ideal for diabetics and weight loss."
    },
    "fenugreek leaves": {
        "calories_kcal": 49, "protein_g": 4.4, "carbs_g": 6.0,
        "fat_g": 0.9, "fiber_g": 2.7, "sodium_mg": 67,
        "glycemic_index": 15, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "excellent",
        "notes": "Methi leaves. One of the best foods for blood sugar control. Rich in iron and folate."
    },
    "drumstick": {
        "calories_kcal": 37, "protein_g": 2.1, "carbs_g": 8.5,
        "fat_g": 0.2, "fiber_g": 3.2, "sodium_mg": 42,
        "glycemic_index": 20, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "excellent",
        "notes": "Moringa drumstick. Extremely nutrient-dense. Anti-diabetic properties."
    },
    "jaggery": {
        "calories_kcal": 383, "protein_g": 0.4, "carbs_g": 98.0,
        "fat_g": 0.1, "fiber_g": 0.0, "sodium_mg": 19,
        "glycemic_index": 84, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "poor",
        "notes": "Unrefined cane sugar. Slightly more minerals than white sugar but still high GI — avoid for diabetes."
    },
    "stevia": {
        "calories_kcal": 0, "protein_g": 0.0, "carbs_g": 0.0,
        "fat_g": 0.0, "fiber_g": 0.0, "sodium_mg": 1,
        "glycemic_index": 0, "gluten_free": True, "dairy_free": True,
        "diabetes_rating": "excellent",
        "notes": "Zero-calorie natural plant sweetener. Zero GI — ideal for diabetics."
    },
}

# ── Apply USDA aliases ────────────────────────────────────────────────────────
alias_added, alias_skipped = 0, 0
for short_name, usda_key in USDA_ALIASES.items():
    if short_name not in ingr:
        if usda_key in ingr:
            ingr[short_name] = ingr[usda_key]
            alias_added += 1
        else:
            alias_skipped += 1
            print(f"[MISSING USDA] {short_name} <- {usda_key}")

# ── Apply manual entries ──────────────────────────────────────────────────────
manual_added, manual_skipped = 0, 0
for name, entry in MANUAL_ENTRIES.items():
    if name not in ingr:
        ingr[name] = entry
        manual_added += 1
    else:
        manual_skipped += 1

data["ingredients"] = ingr

with open(DATA_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)

print(f"\n✅ Done!")
print(f"   USDA aliases added : {alias_added}  (skipped existing: {alias_skipped})")
print(f"   Manual entries added: {manual_added} (skipped existing: {manual_skipped})")
print(f"   Total ingredients  : {len(ingr)}")
