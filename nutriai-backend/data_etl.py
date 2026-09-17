"""
data_etl.py --" NutriAI Dataset ETL Pipeline
==========================================
Transforms:
  1. USDA National Nutrient Database (train.csv + test.csv)     ?' nutrition.json
  2. Food.com RAW_recipes.csv (optional, if present)            ?' recipes.json (merged)

Run:  python data_etl.py
"""

import csv
import json
import os
import re
import ast
import random
import hashlib
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# """ Paths """"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
USDA_TRAIN     = os.path.join(DATA_DIR, "train.csv")
USDA_TEST      = os.path.join(DATA_DIR, "test.csv")
FOODCOM_CSV    = os.path.join(DATA_DIR, "RAW_recipes.csv")
INDIAN_CSV     = os.path.join(DATA_DIR, "indian_food.csv")
OUT_NUTRITION  = os.path.join(DATA_DIR, "nutrition.json")
OUT_RECIPES    = os.path.join(DATA_DIR, "recipes.json")
EXISTING_NUTR  = os.path.join(DATA_DIR, "nutrition.json")
EXISTING_REC   = os.path.join(DATA_DIR, "recipes.json")

# """ Heuristic helpers """"""""""""""""""""""""""""""""""""""""""""""""""""""""

GLUTEN_KEYWORDS = {
    "wheat", "barley", "rye", "semolina", "spelt", "kamut", "triticale",
    "flour", "bread", "pasta", "noodle", "cracker", "biscuit", "cake",
    "cereal", "malt", "bran", "couscous", "bulgur", "farro"
}

DAIRY_KEYWORDS = {
    "milk", "cheese", "cream", "butter", "yogurt", "whey", "lactose",
    "casein", "ghee", "paneer", "ricotta", "mozzarella", "cheddar",
    "parmesan", "custard", "ice cream", "gelato"
}

# High-sodium keywords (> 400mg/100g likely)
HIGH_SODIUM_KEYWORDS = {
    "pickle", "soy sauce", "bacon", "ham", "sausage", "pepperoni",
    "anchov", "olive", "pretzels", "chips", "cracker", "salted"
}


def normalize_name(name: str) -> str:
    """Lowercase, strip, remove extra spaces and trailing punctuation."""
    name = name.lower().strip()
    name = re.sub(r"\s+", " ", name)
    name = re.sub(r"[,;]+$", "", name)
    return name


def keyword_check(name: str, keywords: set) -> bool:
    """Return True if any keyword appears in the food name."""
    name_lower = name.lower()
    return any(kw in name_lower for kw in keywords)


def estimate_gi(carbs: float, fiber: float, sugar: float, food_name: str) -> int:
    """
    Estimate glycemic index from nutrition data.
    Very low GI foods: most proteins, fats, non-starchy vegetables.
    Uses carb-to-fiber ratio as a proxy.
    """
    name = food_name.lower()

    # Pure proteins/fats = 0 GI
    if carbs < 2:
        return 0

    # Known high-GI foods
    high_gi_keywords = ["white bread", "white rice", "potato", "corn flakes",
                        "donut", "waffle", "white flour", "glucose", "maltose",
                        "rice cake", "sport drink", "sugar"]
    if any(kw in name for kw in high_gi_keywords):
        return random.randint(70, 87)

    # Low-GI legumes/beans
    if any(kw in name for kw in ["lentil", "chickpea", "bean", "dal", "soy", "pea"]):
        return random.randint(15, 35)

    # Dairy
    if any(kw in name for kw in ["milk", "yogurt", "cheese"]):
        return random.randint(15, 35)

    # Fruits
    if any(kw in name for kw in ["apple", "pear", "peach", "plum", "cherry", "grape"]):
        return random.randint(30, 55)
    if any(kw in name for kw in ["banana", "mango", "watermelon", "pineapple"]):
        return random.randint(50, 70)

    # Vegetables
    if carbs < 10 and fiber > 1:
        return random.randint(10, 30)

    # Calculate by carb-fiber ratio
    if fiber > 0:
        ratio = (carbs - fiber) / fiber
    else:
        ratio = carbs

    if ratio < 3:
        return random.randint(25, 45)
    elif ratio < 7:
        return random.randint(45, 65)
    else:
        return random.randint(65, 85)


def diabetes_rating(gi: int, carbs: float, fiber: float) -> str:
    """Rate a food for diabetes based on GI and fiber content."""
    if gi == 0 and carbs < 5:
        return "excellent"
    if gi <= 30 and fiber >= 3:
        return "excellent"
    if gi <= 55 and fiber >= 2:
        return "good"
    if gi <= 70:
        return "moderate"
    return "poor"


def safe_float(val, default=0.0) -> float:
    try:
        return float(val) if val not in (None, "", "nan") else default
    except (ValueError, TypeError):
        return default


# ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
# PART 1: USDA Nutrition Dataset ?' nutrition.json
# ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

def process_usda_row(row: dict) -> tuple[str, dict]:
    """
    Convert a single USDA CSV row to (name_key, nutrient_dict) for nutrition.json.
    """
    name = normalize_name(row.get("Descrip", "unknown food"))
    if not name or name == "unknown food":
        return None, None

    energy   = safe_float(row.get("Energy_kcal", 0))
    protein  = safe_float(row.get("Protein_g", 0))
    fat      = safe_float(row.get("Fat_g", 0))
    carbs    = safe_float(row.get("Carb_g", 0))
    sugar    = safe_float(row.get("Sugar_g", 0))
    fiber    = safe_float(row.get("Fiber_g", 0))
    sodium   = safe_float(row.get("Calcium_mg", 0))   # note: column name in CSV
    calcium  = safe_float(row.get("Calcium_mg", 0))
    iron     = safe_float(row.get("Iron_mg", 0))
    potassium = safe_float(row.get("Phosphorus_mg", 0))  # used as proxy if K missing
    # Vitamins
    vitc     = safe_float(row.get("VitC_mg", 0))
    vita     = safe_float(row.get("VitA_mcg", 0))
    vitb12   = safe_float(row.get("VitB12_mcg", 0))

    # Re-read sodium correctly (it's not in this CSV by that name; use Selenium as 0)
    # The USDA CSV columns are: Calcium_mg, not Sodium_mg
    # We'll set sodium to 0 by default since this CSV doesn't include it directly
    sodium = 0  # USDA CSV doesn't have sodium column, set to 0

    gi       = estimate_gi(carbs, fiber, sugar, name)
    gf       = not keyword_check(name, GLUTEN_KEYWORDS)
    df       = not keyword_check(name, DAIRY_KEYWORDS)
    dr       = diabetes_rating(gi, carbs, fiber)

    food_group = row.get("FoodGroup", "")

    nutrient_data = {
        "calories_kcal":    round(energy, 1),
        "protein_g":        round(protein, 2),
        "carbs_g":          round(carbs, 2),
        "fat_g":            round(fat, 2),
        "fiber_g":          round(fiber, 2),
        "sugar_g":          round(sugar, 2),
        "sodium_mg":        round(sodium, 1),
        "potassium_mg":     round(potassium, 1),
        "calcium_mg":       round(calcium, 1),
        "iron_mg":          round(iron, 2),
        "vitamin_c_mg":     round(vitc, 2),
        "vitamin_a_mcg":    round(vita, 2),
        "vitamin_b12_mcg":  round(vitb12, 3),
        "glycemic_index":   gi,
        "food_group":       food_group,
        "common_allergens": (["gluten", "wheat"] if not gf else []) + (["dairy", "lactose"] if not df else []),
        "gluten_free":      gf,
        "dairy_free":       df,
        "diabetes_rating":  dr,
        "source":           "USDA National Nutrient Database",
        "notes":            f"{food_group}. GI?^{gi}. {'Gluten-free. ' if gf else 'Contains gluten. '}{'Dairy-free.' if df else 'Contains dairy.'}"
    }

    return name, nutrient_data


def load_usda_nutrition() -> dict:
    """Load + merge train.csv and test.csv from USDA dataset."""
    ingredients = {}
    total = 0
    skipped = 0

    for csv_path in [USDA_TRAIN, USDA_TEST]:
        if not os.path.exists(csv_path):
            print(f"  [WARN] Missing file: {csv_path}")
            continue

        print(f"  Loading {os.path.basename(csv_path)}...")
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                total += 1
                name, data = process_usda_row(row)
                if name and data:
                    ingredients[name] = data
                else:
                    skipped += 1

    print(f"  [OK] USDA: {len(ingredients)} ingredients processed ({skipped} skipped from {total} rows)")
    return ingredients


def build_nutrition_json():
    """
    Build new nutrition.json merging existing hand-crafted data with USDA data.
    Existing entries take priority (they have richer GI/condition data).
    """
    print("\n[Phase 1] Processing USDA Nutrition Dataset...")

    # Load existing hand-crafted nutrition data
    existing_ingr = {}
    if os.path.exists(EXISTING_NUTR):
        with open(EXISTING_NUTR, "r", encoding="utf-8") as f:
            existing = json.load(f)
            existing_ingr = existing.get("ingredients", {})
            existing_guidelines = existing.get("condition_guidelines", {})
            existing_meta = existing.get("meta", {})
        print(f"  Loaded {len(existing_ingr)} existing hand-crafted ingredients (will be preserved)")
    else:
        existing_guidelines = {}
        existing_meta = {}

    # Load USDA data
    usda_ingr = load_usda_nutrition()

    # Merge: existing takes priority, USDA fills the rest
    merged = {**usda_ingr, **existing_ingr}  # existing overwrites USDA for same keys

    print(f"  Merged total: {len(merged)} ingredients")
    print(f"    - Hand-crafted (preserved): {len(existing_ingr)}")
    print(f"    - USDA (added): {len(usda_ingr) - sum(1 for k in usda_ingr if k in existing_ingr)}")

    output = {
        "meta": {
            **existing_meta,
            "source": "NutriAI Nutrition Database v2.0 (USDA + Hand-crafted)",
            "total_ingredients": len(merged),
            "usda_entries": len(usda_ingr),
            "hand_crafted_entries": len(existing_ingr),
            "unit": "per 100g unless noted",
            "generated_at": datetime.now().isoformat(),
            "fields": [
                "calories_kcal", "protein_g", "carbs_g", "fat_g", "fiber_g",
                "sugar_g", "sodium_mg", "potassium_mg", "calcium_mg", "iron_mg",
                "vitamin_c_mg", "vitamin_a_mcg", "vitamin_b12_mcg",
                "glycemic_index", "food_group", "gluten_free", "dairy_free",
                "diabetes_rating", "source", "notes"
            ]
        },
        "ingredients": merged,
        "condition_guidelines": existing_guidelines
    }

    with open(OUT_NUTRITION, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"  [OK] Written to {OUT_NUTRITION}")
    return len(merged)


# ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
# PART 2: Food.com Recipes Dataset ?' recipes.json (if available)
# ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

# Food.com tag ?' NutriAI dietary tag mappings
DIETARY_TAG_MAP = {
    "vegetarian":              "Vegetarian",
    "vegan":                   "Vegan",
    "gluten-free":             "Gluten Free",
    "gluten_free":             "Gluten Free",
    "dairy-free":              "Lactose Free",
    "dairy_free":              "Lactose Free",
    "low-carb":                "Low Carb",
    "low-calorie":             "Low Calorie",
    "high-protein":            "High Protein",
    "high-fiber":              "High Fiber",
    "low-fat":                 "Low Fat",
    "diabetic":                "Diabetic Friendly",
    "diabetic-friendly":       "Diabetic Friendly",
    "heart-healthy":           "Heart Healthy",
    "low-sodium":              "Low Sodium",
    "keto":                    "Low Carb",
    "paleo":                   "Paleo",
    "whole-grain":             "High Fiber",
    "high-calcium":            "High Calcium",
    "high-iron":               "High Iron",
    "nut-free":                "Nut Free",
    "egg-free":                "Egg Free",
}

# Food.com tag ?' NutriAI meal_type
MEAL_TYPE_MAP = {
    "breakfast":               "Breakfast",
    "brunch":                  "Breakfast",
    "lunch":                   "Lunch",
    "dinner":                  "Dinner",
    "supper":                  "Dinner",
    "snacks":                  "Snack",
    "snack":                   "Snack",
    "appetizers":              "Snack",
    "desserts":                "Snack",
    "dessert":                 "Snack",
    "side-dishes":             "Lunch",
    "main-dish":               "Dinner",
    "main dish":               "Dinner",
    "one-dish-meal":           "Dinner",
}

# Food.com tag ?' NutriAI cuisine
CUISINE_MAP = {
    "italian-american":        "Italian",
    "italian":                 "Italian",
    "mexican":                 "Mexican",
    "indian":                  "Indian",
    "chinese":                 "Chinese",
    "japanese":                "Japanese",
    "thai":                    "Thai",
    "greek":                   "Greek",
    "french":                  "French",
    "american":                "American",
    "southern-united-states":  "American",
    "tex-mex":                 "Mexican",
    "cajun":                   "American",
    "mediterranean":           "Mediterranean",
    "middle-eastern":          "Middle Eastern",
    "african":                 "African",
    "spanish":                 "Spanish",
    "korean":                  "Korean",
    "vietnamese":              "Vietnamese",
    "caribbean":               "Caribbean",
}


def derive_condition_safety_from_nutrition(nutrition: dict, ingredients_list: list) -> dict:
    """
    Rule-based condition safety derivation from nutrition + ingredient scan.
    Returns condition_safety dict matching existing schema.
    Covers 14 health conditions based on medical guidelines.
    """
    cal     = nutrition.get("calories", 300)
    carbs   = nutrition.get("carbs", 30)
    fat     = nutrition.get("fat", 10)
    fiber   = nutrition.get("fiber", 3)
    sodium  = nutrition.get("sodium", 300)
    protein = nutrition.get("protein", 10)
    sugar   = nutrition.get("sugar", 10)

    ingr_text = " ".join(ingredients_list).lower()

    # -- Ingredient flags ------------------------------------------------------
    has_gluten  = keyword_check(ingr_text, GLUTEN_KEYWORDS)
    has_dairy   = keyword_check(ingr_text, DAIRY_KEYWORDS)

    # High-potassium ingredients (bad for Kidney Disease)
    HIGH_K_KW = {"banana", "potato", "tomato", "spinach", "avocado",
                 "orange", "beans", "lentil", "dal", "raisin", "prune"}
    has_high_k = any(kw in ingr_text for kw in HIGH_K_KW)

    # High-purine ingredients (bad for Gout)
    HIGH_PURINE_KW = {"liver", "anchov", "sardine", "mackerel", "herring",
                      "mussel", "scallop", "organ", "game meat", "yeast"}
    MED_PURINE_KW  = {"beef", "pork", "lamb", "chicken", "turkey", "shrimp", "crab", "lobster"}
    has_high_purine = any(kw in ingr_text for kw in HIGH_PURINE_KW)
    has_med_purine  = any(kw in ingr_text for kw in MED_PURINE_KW)

    # High-FODMAP ingredients (bad for IBS)
    HIGH_FODMAP_KW = {"garlic", "onion", "wheat", "honey", "apple", "pear",
                      "milk", "cream", "cashew", "pistachio", "leek", "shallot"}
    has_high_fodmap = any(kw in ingr_text for kw in HIGH_FODMAP_KW)

    # Goitrogenic vegetables (raw are bad for thyroid; cooking reduces effect)
    GOITROGEN_KW = {"broccoli", "cabbage", "cauliflower", "kale", "brussels",
                    "bok choy", "turnip", "millet", "soybean", "tofu", "tempeh"}
    has_goitrogen = any(kw in ingr_text for kw in GOITROGEN_KW)

    # Iron-rich foods (good for Anemia)
    IRON_RICH_KW = {"spinach", "lentil", "dal", "chickpea", "kidney bean",
                    "beef", "lamb", "liver", "tofu", "pumpkin seed", "quinoa"}
    VITC_KW      = {"lemon", "orange", "tomato", "bell pepper", "amla",
                    "kiwi", "guava", "strawberr"}
    has_iron_rich = any(kw in ingr_text for kw in IRON_RICH_KW)
    has_vitc      = any(kw in ingr_text for kw in VITC_KW)

    # Alcohol (bad for Liver Disease & Gout)
    has_alcohol   = any(kw in ingr_text for kw in {"wine", "beer", "whiskey", "rum",
                                                    "vodka", "alcohol", "brandy"})

    # Estimate GI from carb/fiber/sugar
    gi = estimate_gi(carbs, fiber, sugar, ingr_text[:100])

    # -- 1. Diabetes (ADA 2024) ------------------------------------------------
    if gi < 55 and carbs < 40 and fiber >= 3:
        diab_safe   = True
        diab_reason = f"Estimated GI~{gi}. Moderate carbs ({carbs}g) with good fiber ({fiber}g) content."
    elif gi >= 70 or (carbs > 60 and fiber < 2):
        diab_safe   = False
        diab_reason = f"High estimated GI~{gi} or high carb-to-fiber ratio. May cause blood sugar spikes."
    else:
        diab_safe   = True
        diab_reason = f"Moderate GI~{gi}. Consume in controlled portions."

    # -- 2. Celiac Disease -----------------------------------------------------
    if has_gluten:
        celiac_safe   = False
        celiac_reason = "Contains gluten-based ingredients (wheat/flour/bread). Unsafe for Celiac disease."
    else:
        celiac_safe   = True
        celiac_reason = "No gluten-containing ingredients detected. Suitable for Celiac disease."

    # -- 3. Lactose Intolerance -----------------------------------------------
    if has_dairy:
        lactose_safe   = False
        lactose_reason = "Contains dairy ingredients. Substitute with plant-based alternatives."
    else:
        lactose_safe   = True
        lactose_reason = "No dairy ingredients detected. Suitable for lactose intolerance."

    # -- 4. Hypertension (JNC8/AHA) -------------------------------------------
    if sodium > 600:
        htn_safe   = False
        htn_reason = f"High sodium content (~{sodium}mg per serving). Reduce sodium for hypertension."
    elif sodium < 200 and fat < 10:
        htn_safe   = True
        htn_reason = f"Low sodium (~{sodium}mg) and low fat. Heart-friendly recipe."
    else:
        htn_safe   = True
        htn_reason = f"Moderate sodium (~{sodium}mg). Keep overall daily intake under 1500mg."

    # -- 5. Heart Disease (AHA) ------------------------------------------------
    if fat > 20 and sodium > 500:
        heart_safe   = False
        heart_reason = f"High fat ({fat}g) and sodium ({sodium}mg). Not ideal for heart disease."
    else:
        heart_safe   = True
        heart_reason = f"Acceptable fat ({fat}g) and sodium ({sodium}mg) levels for heart health."

    # -- 6. Obesity (WHO) ------------------------------------------------------
    if cal > 500 and fiber < 3:
        obesity_safe   = False
        obesity_reason = f"High calorie ({cal} kcal) and low fiber. Not ideal for weight management."
    else:
        obesity_safe   = True
        obesity_reason = f"Moderate calorie density ({cal} kcal) with fiber ({fiber}g) for satiety."

    # -- 7. Kidney Disease / CKD (KDIGO 2022) ----------------------------------
    if has_high_k or protein > 25 or sodium > 500:
        kidney_safe   = False
        kidney_reason = (
            "High potassium ingredients detected. " if has_high_k else ""
        ) + (
            f"High protein ({protein}g) strains kidneys. " if protein > 25 else ""
        ) + (
            f"High sodium ({sodium}mg) -- limit to 1500mg/day for CKD." if sodium > 500 else ""
        )
    else:
        kidney_safe   = True
        kidney_reason = f"Low potassium, controlled protein ({protein}g) and sodium ({sodium}mg). CKD-friendly."

    # -- 8. High Cholesterol (NCEP ATP III) ------------------------------------
    sat_fat_proxy = fat * 0.35  # saturated fat estimate
    if sat_fat_proxy > 7 or fat > 20:
        chol_safe   = False
        chol_reason = f"High fat content (~{fat}g). Estimated saturated fat >{sat_fat_proxy:.1f}g. Avoid for high cholesterol."
    elif fiber >= 5:
        chol_safe   = True
        chol_reason = f"High fiber ({fiber}g) helps lower LDL cholesterol. Low saturated fat."
    else:
        chol_safe   = True
        chol_reason = f"Moderate fat ({fat}g). Keep saturated fat under 7g/day."

    # -- 9. PCOS (Endocrine Society) -------------------------------------------
    if gi < 55 and fiber >= 3 and sugar < 12:
        pcos_safe   = True
        pcos_reason = f"Low GI~{gi} and high fiber ({fiber}g). Supports insulin sensitivity for PCOS."
    elif gi >= 70 or sugar > 20:
        pcos_safe   = False
        pcos_reason = f"High GI~{gi} or sugar ({sugar}g). May worsen insulin resistance in PCOS."
    else:
        pcos_safe   = True
        pcos_reason = f"Moderate GI~{gi}. Consume in portions to manage PCOS."

    # -- 10. Thyroid Disorder (ATA 2023) --------------------------------------
    if has_goitrogen:
        thyroid_safe   = True   # safe if cooked (cooking neutralises 70-90% of goitrogens)
        thyroid_reason = "Contains goitrogenic vegetables. Ensure they are cooked thoroughly to reduce thyroid interference."
    else:
        thyroid_safe   = True
        thyroid_reason = "No significant goitrogenic ingredients detected. Thyroid-friendly."

    # -- 11. Anemia (WHO) -----------------------------------------------------
    if has_iron_rich:
        anemia_safe   = True
        anemia_reason = "Contains iron-rich ingredients. " + (
            "Vitamin C present -- enhances iron absorption." if has_vitc else
            "Add a vitamin C source (lemon/tomato) to boost iron absorption."
        )
    else:
        anemia_safe   = True
        anemia_reason = "Low-iron recipe. Supplement with iron-rich foods (lentils, spinach) in your overall diet."

    # -- 12. Gout (ACR 2020) --------------------------------------------------
    if has_high_purine or has_alcohol:
        gout_safe   = False
        gout_reason = (
            "Contains high-purine ingredients (organ meat/seafood). " if has_high_purine else ""
        ) + ("Alcohol raises uric acid -- avoid for gout." if has_alcohol else "")
    elif has_med_purine or sugar > 20:
        gout_safe   = True
        gout_reason = "Contains moderate-purine proteins. Consume in limited quantities for gout."
    else:
        gout_safe   = True
        gout_reason = "Low-purine recipe. Suitable for gout management."

    # -- 13. IBS (NICE/Monash Low-FODMAP) -------------------------------------
    if has_high_fodmap:
        ibs_safe   = False
        ibs_reason = "Contains high-FODMAP ingredients (garlic/onion/wheat/dairy) that may trigger IBS symptoms."
    elif fiber > 10:
        ibs_safe   = True
        ibs_reason = f"Very high fiber ({fiber}g) -- may cause symptoms in some. Monitor portion size."
    else:
        ibs_safe   = True
        ibs_reason = "Low-FODMAP ingredients. Generally well-tolerated for IBS."

    # -- 14. Liver Disease (EASL 2018) ----------------------------------------
    if has_alcohol or (fat > 20 and sodium > 400):
        liver_safe   = False
        liver_reason = (
            "Contains alcohol -- strictly avoid with liver disease. " if has_alcohol else ""
        ) + (f"High fat ({fat}g) and sodium ({sodium}mg) burden the liver." if fat > 20 else "")
    else:
        liver_safe   = True
        liver_reason = f"Moderate fat ({fat}g), low sodium ({sodium}mg), no alcohol. Liver-friendly."

    return {
        "Diabetes":            {"safe": diab_safe,    "reason": diab_reason},
        "Celiac Disease":      {"safe": celiac_safe,  "reason": celiac_reason},
        "Lactose Intolerance": {"safe": lactose_safe, "reason": lactose_reason},
        "Hypertension":        {"safe": htn_safe,     "reason": htn_reason},
        "Heart Disease":       {"safe": heart_safe,   "reason": heart_reason},
        "Obesity":             {"safe": obesity_safe, "reason": obesity_reason},
        "Kidney Disease":      {"safe": kidney_safe,  "reason": kidney_reason},
        "High Cholesterol":    {"safe": chol_safe,    "reason": chol_reason},
        "PCOS":                {"safe": pcos_safe,    "reason": pcos_reason},
        "Thyroid Disorder":    {"safe": thyroid_safe, "reason": thyroid_reason},
        "Anemia":              {"safe": anemia_safe,  "reason": anemia_reason},
        "Gout":                {"safe": gout_safe,    "reason": gout_reason},
        "IBS":                 {"safe": ibs_safe,     "reason": ibs_reason},
        "Liver Disease":       {"safe": liver_safe,   "reason": liver_reason},

        # -- 8 New Conditions --------------------------------------------------
        # Estimated saturated fat: ~35% of total fat (standard nutrition estimate)
        # GERD / Acid Reflux (NIDDK/ACG): avoid high fat, fried foods, sugar
        "GERD": {
            "safe":   fat < 10 and (fat * 0.35) < 4 and sugar < 15,
            "reason": f"Fat={fat}g (limit 10g), Est.Sat.fat={round(fat*0.35,1)}g (limit 4g), Sugar={sugar}g (limit 15g)",
        },

        # Osteoporosis (NOF): high calcium foods (dairy proxy), adequate protein, low sodium
        "Osteoporosis": {
            "safe":   has_dairy and protein >= 5 and sodium < 400,
            "reason": f"Calcium source={'Yes (dairy)' if has_dairy else 'Low'}, Protein={protein}g, Sodium={sodium}mg (limit 400mg)",
        },

        # Rheumatoid Arthritis (Arthritis Foundation): anti-inflammatory diet
        "Rheumatoid Arthritis": {
            "safe":   (fat * 0.35) < 5 and sugar < 12 and sodium < 300,
            "reason": f"Est.Sat.fat={round(fat*0.35,1)}g (anti-inflammatory limit 5g), Sugar={sugar}g, Sodium={sodium}mg",
        },

        # NAFLD (AASLD): low fructose/sugar, low fat, low calorie
        "NAFLD": {
            "safe":   sugar < 8 and fat < 8 and cal < 250,
            "reason": f"Sugar={sugar}g (limit 8g, fructose drives NAFLD), Fat={fat}g (limit 8g), Cal={cal}kcal",
        },

        # Gallbladder Disease (ACG): very low fat -- fat triggers gallbladder contraction
        "Gallbladder Disease": {
            "safe":   fat < 5 and (fat * 0.35) < 2,
            "reason": f"Fat={fat}g (strictly <5g), Est.Sat.fat={round(fat*0.35,1)}g -- fat triggers gallbladder contraction",
        },

        # Crohn's Disease (CCFA): low fiber during flare, low fat, low FODMAP
        "Crohn's Disease": {
            "safe":   fiber < 4 and fat < 10 and not has_high_fodmap,
            "reason": f"Fiber={fiber}g (limit 4g), Fat={fat}g, FODMAP={'Low' if not has_high_fodmap else 'High (avoid)'}",
        },

        # Chronic Pancreatitis (APA/EPC): extremely low fat -- most critical restriction
        "Chronic Pancreatitis": {
            "safe":   fat < 3 and sugar < 15 and cal < 200,
            "reason": f"Fat={fat}g (strictly <3g for pancreatitis), Sugar={sugar}g, Calories={cal}kcal",
        },

        # Migraine (American Migraine Foundation): avoid tyramine (purine proxy), MSG (sodium proxy)
        "Migraine": {
            "safe":   not has_high_purine and not has_med_purine and sodium < 300 and sugar < 15,
            "reason": f"Tyramine/purine={'Low' if not has_high_purine and not has_med_purine else 'High (avoid)'}, Sodium={sodium}mg, Sugar={sugar}g",
        },
    }



def parse_foodcom_tags(raw_tags: str) -> list:
    """Parse Food.com tags field (Python list string) into a list."""
    try:
        return ast.literal_eval(raw_tags)
    except Exception:
        return []


def parse_foodcom_ingredients(raw_ingr: str) -> list:
    """Parse Food.com ingredients field into a list of strings."""
    try:
        return ast.literal_eval(raw_ingr)
    except Exception:
        return []


def parse_foodcom_nutrition(raw_nutrition: str) -> dict:
    """
    Food.com nutrition field: [calories, total_fat_%DV, sugar_%DV, sodium_%DV,
                                protein_%DV, sat_fat_%DV, carbs_%DV]
    Convert %DV to approximate grams using standard DV values.
    """
    try:
        vals = ast.literal_eval(raw_nutrition)
        if len(vals) < 7:
            return {}
        # Index 0 = calories (absolute), rest are % Daily Value
        # DV reference: fat=78g, sugar=50g, sodium=2300mg, protein=50g, carbs=275g
        return {
            "calories": round(float(vals[0]), 1),
            "fat":      round(float(vals[1]) * 78 / 100, 1),
            "sugar":    round(float(vals[2]) * 50 / 100, 1),
            "sodium":   round(float(vals[3]) * 2300 / 100, 1),
            "protein":  round(float(vals[4]) * 50 / 100, 1),
            "sat_fat":  round(float(vals[5]) * 20 / 100, 1),
            "carbs":    round(float(vals[6]) * 275 / 100, 1),
        }
    except Exception:
        return {}


def parse_foodcom_steps(raw_steps: str) -> list:
    """Parse Food.com steps field into a list of strings."""
    try:
        steps = ast.literal_eval(raw_steps)
        return [s.strip().capitalize() for s in steps if isinstance(s, str) and len(s) > 5]
    except Exception:
        return []


def parse_ingredients_structured(ingr_list: list) -> list:
    """
    Convert raw ingredient strings to structured {name, amount, unit} format.
    Food.com ingredients are like: "1 cup flour", "2 tablespoons butter", etc.
    """
    structured = []
    unit_map = {
        "cup": "cup", "cups": "cup",
        "tablespoon": "tbsp", "tablespoons": "tbsp", "tbsp": "tbsp",
        "teaspoon": "tsp", "teaspoons": "tsp", "tsp": "tsp",
        "ounce": "oz", "ounces": "oz", "oz": "oz",
        "pound": "lb", "pounds": "lb", "lb": "lb",
        "gram": "g", "grams": "g", "g": "g",
        "kg": "kg", "kilogram": "kg",
        "ml": "ml", "milliliter": "ml",
        "liter": "l", "litre": "l",
        "piece": "piece", "pieces": "piece",
        "clove": "clove", "cloves": "clove",
        "slice": "slice", "slices": "slice",
        "package": "pack", "packages": "pack", "pkg": "pack",
        "can": "can", "cans": "can",
        "bunch": "bunch", "handful": "handful",
        "pinch": "pinch", "dash": "dash",
        "whole": "whole",
    }

    fraction_map = {
        "1/2": 0.5,   "1/4": 0.25,  "3/4": 0.75,
        "1/3": 0.333, "2/3": 0.667,
        "1/8": 0.125, "3/8": 0.375,
    }

    for ingr in ingr_list:
        if not ingr or len(ingr) < 2:
            continue

        ingr = ingr.strip().lower()

        # Replace fraction characters
        for frac_char, frac_val in fraction_map.items():
            ingr = ingr.replace(frac_char, f" {frac_val} ")

        # Try to parse "amount unit name" or "amount name"
        parts = ingr.split()
        amount = 1.0
        unit   = ""
        name_parts = []

        i = 0
        # Parse amount (may be "1 1/2" style)
        if i < len(parts):
            # Handle fraction like "1/2"
            if "/" in parts[i]:
                try:
                    num, den = parts[i].split("/")
                    amount = float(num) / float(den)
                    i += 1
                    # Check if next part is also a number (mixed: "1 1/2")
                    if i > 1:
                        pass
                except Exception:
                    pass
            else:
                try:
                    amount = float(parts[i])
                    i += 1
                    # Check for "1 1/2" style
                    if i < len(parts) and "/" in parts[i]:
                        try:
                            num, den = parts[i].split("/")
                            amount += float(num) / float(den)
                            i += 1
                        except Exception:
                            pass
                except ValueError:
                    pass

        # Parse unit
        if i < len(parts) and parts[i] in unit_map:
            unit = unit_map[parts[i]]
            i += 1

        # The rest is the ingredient name
        name_parts = parts[i:]
        clean_name = " ".join(name_parts).strip()
        # Remove parenthetical notes
        clean_name = re.sub(r"\(.*?\)", "", clean_name).strip()

        if not clean_name:
            clean_name = ingr[:40]

        structured.append({
            "name":   clean_name.title() if len(clean_name) > 0 else "Unknown",
            "amount": round(amount, 2),
            "unit":   unit if unit else "piece"
        })

    return structured


def derive_meal_type(tags: list, name: str) -> str:
    """Derive meal type from Food.com tags."""
    all_text = " ".join(tags).lower() + " " + name.lower()
    for tag, meal_type in MEAL_TYPE_MAP.items():
        if tag in all_text:
            return meal_type
    # Default heuristic from name
    if any(kw in name.lower() for kw in ["cake", "cookie", "muffin", "pie", "brownie", "pudding"]):
        return "Snack"
    if any(kw in name.lower() for kw in ["pancake", "waffle", "oatmeal", "cereal", "toast", "egg"]):
        return "Breakfast"
    return "Dinner"  # default


def derive_cuisine(tags: list) -> str:
    """Derive cuisine from Food.com tags."""
    tags_lower = [t.lower() for t in tags]
    for tag_kw, cuisine in CUISINE_MAP.items():
        if tag_kw in tags_lower or any(tag_kw in t for t in tags_lower):
            return cuisine
    return "International"


def derive_dietary_tags(tags: list, nutrition: dict, ingredients: list) -> list:
    """Derive dietary tags from Food.com tags + nutrition data."""
    result = set()

    tags_lower = [t.lower().replace(" ", "-") for t in tags]
    for tag_kw, nutriai_tag in DIETARY_TAG_MAP.items():
        if any(tag_kw in t for t in tags_lower):
            result.add(nutriai_tag)

    # Infer from nutrition
    cal     = nutrition.get("calories", 300)
    protein = nutrition.get("protein", 10)
    fat     = nutrition.get("fat", 10)
    carbs   = nutrition.get("carbs", 30)
    fiber   = nutrition.get("fiber", 3)
    sugar   = nutrition.get("sugar", 10)

    if cal < 250:        result.add("Low Calorie")
    if protein > 20:     result.add("High Protein")
    if fat < 5:          result.add("Low Fat")
    if carbs < 15:       result.add("Low Carb")
    if fiber > 6:        result.add("High Fiber")

    # Infer veg/vegan from ingredient scan
    ingr_text = " ".join(ingredients).lower()
    meat_kws  = ["chicken", "beef", "pork", "lamb", "fish", "shrimp", "turkey",
                 "bacon", "sausage", "ham", "tuna", "salmon", "crab", "lobster",
                 "anchov", "pepperoni", "veal", "duck", "venison"]
    dairy_kws = ["milk", "cheese", "cream", "butter", "yogurt", "ghee"]
    egg_kws   = ["egg"]

    has_meat  = any(kw in ingr_text for kw in meat_kws)
    has_dairy = any(kw in ingr_text for kw in dairy_kws)
    has_egg   = any(kw in ingr_text for kw in egg_kws)

    if not has_meat:
        result.add("Vegetarian")
    if not has_meat and not has_dairy and not has_egg:
        result.add("Vegan")
    if has_meat:
        result.add("Non-Vegetarian")

    # Gluten check
    has_gluten = keyword_check(ingr_text, GLUTEN_KEYWORDS)
    if not has_gluten:
        result.add("Gluten Free")

    # Dairy check
    if not has_dairy:
        result.add("Lactose Free")

    return sorted(list(result))


def derive_difficulty(n_steps: int, minutes: int) -> str:
    """Estimate recipe difficulty."""
    if n_steps <= 5 and minutes <= 30:
        return "Easy"
    elif n_steps <= 10 and minutes <= 60:
        return "Medium"
    else:
        return "Hard"


def process_foodcom_row(row: dict, recipe_counter: int) -> dict | None:
    """Convert a Food.com CSV row to NutriAI recipe dict."""
    try:
        name     = row.get("name", "").strip().title()
        if not name or len(name) < 3:
            return None

        minutes  = int(float(row.get("minutes", 30) or 30))
        # Skip extreme values
        if minutes > 600 or minutes < 1:
            return None

        raw_tags   = row.get("tags", "[]")
        raw_ingr   = row.get("ingredients", "[]")
        raw_steps  = row.get("steps", "[]")
        raw_nutr   = row.get("nutrition", "[]")
        n_ingr     = int(float(row.get("n_ingredients", 0) or 0))
        n_steps_n  = int(float(row.get("n_steps", 0) or 0))

        if n_ingr < 2 or n_steps_n < 2:
            return None

        tags        = parse_foodcom_tags(raw_tags)
        ingr_raw    = parse_foodcom_ingredients(raw_ingr)
        steps       = parse_foodcom_steps(raw_steps)
        nutrition   = parse_foodcom_nutrition(raw_nutr)

        if not steps or not ingr_raw or not nutrition:
            return None

        ingr_structured = parse_ingredients_structured(ingr_raw)
        meal_type       = derive_meal_type(tags, name)
        cuisine         = derive_cuisine(tags)
        dietary_tags    = derive_dietary_tags(tags, nutrition, ingr_raw)
        difficulty      = derive_difficulty(n_steps_n, minutes)
        condition_safety = derive_condition_safety_from_nutrition(nutrition, ingr_raw)

        # Estimate fiber (not directly in Food.com nutrition)
        fiber_estimate = max(1, round(nutrition.get("carbs", 30) * 0.08, 1))
        nutrition["fiber"] = fiber_estimate

        recipe_id = f"fc_{hashlib.md5(name.encode()).hexdigest()[:8]}"

        # Description from name + tags
        top_tags = [t for t in tags if len(t) > 3 and "_" not in t][:3]
        description = f"A {', '.join(top_tags)} recipe. " if top_tags else ""
        description += f"{'Quick and easy' if minutes <= 30 else 'Classic'} {name.lower()} with {n_ingr} ingredients."

        prep_time = max(5, minutes // 4)
        cook_time = minutes - prep_time

        return {
            "id":          recipe_id,
            "name":        name,
            "description": description[:200],
            "cuisine":     cuisine,
            "meal_type":   meal_type,
            "prep_time":   prep_time,
            "cook_time":   cook_time,
            "servings":    4,  # default, Food.com doesn't always specify
            "difficulty":  difficulty,
            "dietary_tags": dietary_tags,
            "ingredients": ingr_structured,
            "steps":       steps,
            "nutrition_per_serving": {
                "calories": nutrition.get("calories", 0),
                "protein":  nutrition.get("protein", 0),
                "carbs":    nutrition.get("carbs", 0),
                "fat":      nutrition.get("fat", 0),
                "fiber":    nutrition.get("fiber", 0),
                "sodium":   nutrition.get("sodium", 0),
                "sugar":    nutrition.get("sugar", 0),
            },
            "condition_safety": condition_safety,
            "source": "Food.com",
            "tags": tags[:10],
        }

    except Exception as e:
        return None


# ===============================================================================
# PART 3: Indian Food Dataset -> recipes.json (merged)
# ===============================================================================

# Map Indian food 'course' column -> NutriAI meal_type
INDIAN_COURSE_MAP = {
    "main course": "Dinner",
    "starter":     "Lunch",
    "snack":       "Snack",
    "dessert":     "Snack",
}


def indian_nutrition_estimate(ingredients_text: str, diet: str) -> dict:
    """
    Estimate nutrition for an Indian recipe from ingredient heuristics.
    Indian food tends to be carb-moderate and fiber-rich.
    """
    text = ingredients_text.lower()
    # Base values for a typical Indian dish serving
    cal     = 280.0
    protein = 9.0
    carbs   = 38.0
    fat     = 9.0
    fiber   = 4.5
    sodium  = 320.0
    sugar   = 5.0

    # Adjustment by key ingredients
    if any(k in text for k in ["rice", "biryani", "pulao"]):
        carbs += 20; cal += 80
    if any(k in text for k in ["dal", "lentil", "chana", "rajma", "moong"]):
        protein += 6; fiber += 3; carbs -= 5
    if any(k in text for k in ["ghee", "butter", "cream"]):
        fat += 6; cal += 55
    if any(k in text for k in ["sugar", "jaggery", "honey"]):
        sugar += 10; cal += 40; carbs += 10
    if any(k in text for k in ["chicken", "mutton", "lamb", "fish", "prawn", "egg"]):
        protein += 8; fat += 4; cal += 60
    if any(k in text for k in ["paneer", "cheese", "milk", "yogurt", "curd"]):
        protein += 5; fat += 3; cal += 40
    if any(k in text for k in ["oats", "ragi", "jowar", "bajra"]):
        fiber += 4; carbs -= 5
    if "flour" in text or "maida" in text:
        carbs += 10

    # Vegan tends to be lower cal
    if diet == "vegetarian":
        cal = max(150, cal - 20)

    return {
        "calories": round(cal, 1),
        "protein":  round(protein, 1),
        "carbs":    round(carbs, 1),
        "fat":      round(fat, 1),
        "fiber":    round(fiber, 1),
        "sodium":   round(sodium, 1),
        "sugar":    round(sugar, 1),
    }


def process_indian_food_csv() -> list:
    """
    Read indian_food.csv and convert each row into a NutriAI recipe dict.
    Maps:
      name        -> name
      ingredients -> ingredients (comma-split to structured list)
      diet        -> dietary_tags
      prep_time   -> prep_time
      cook_time   -> cook_time
      course      -> meal_type
      state/region-> included in description
      cuisine     -> 'Indian' (hardcoded)
    """
    if not os.path.exists(INDIAN_CSV):
        print(f"  [INFO] indian_food.csv not found at {INDIAN_CSV} - skipping")
        return []

    print(f"  Loading Indian food dataset from {INDIAN_CSV}...")
    recipes = []

    with open(INDIAN_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                name = row.get("name", "").strip().title()
                if not name:
                    continue

                # Parse times (some rows have -1 for unknown)
                try:
                    prep_time = max(5, int(row.get("prep_time", 20) or 20))
                    if prep_time < 0: prep_time = 15
                except:
                    prep_time = 15
                try:
                    cook_time = max(5, int(row.get("cook_time", 20) or 20))
                    if cook_time < 0: cook_time = 20
                except:
                    cook_time = 20

                ingredients_raw = row.get("ingredients", "")
                diet = row.get("diet", "vegetarian").lower().strip()
                course = row.get("course", "main course").lower().strip()
                flavor = row.get("flavor_profile", "").strip()
                state = row.get("state", "").strip()
                region = row.get("region", "").strip()

                # Parse ingredients from comma-separated string
                ingr_names = [i.strip() for i in ingredients_raw.split(",") if i.strip()]
                if not ingr_names:
                    continue

                # Build structured ingredients
                ingredients_structured = [
                    {"name": i.strip().title(), "amount": 1.0, "unit": "piece"}
                    for i in ingr_names
                ]

                # Map course to meal_type
                meal_type = INDIAN_COURSE_MAP.get(course, "Dinner")

                # Dietary tags
                dietary_tags = []
                if diet == "vegetarian":
                    dietary_tags.extend(["Vegetarian", "Non-Vegetarian"])  # mark as veg
                    dietary_tags = ["Vegetarian"]
                elif diet == "non vegetarian":
                    dietary_tags = ["Non-Vegetarian"]
                else:
                    dietary_tags = ["Vegetarian"]

                # Extra inferred tags
                ingr_text = ingredients_raw.lower()
                if not keyword_check(ingr_text, GLUTEN_KEYWORDS):
                    dietary_tags.append("Gluten Free")
                if not keyword_check(ingr_text, DAIRY_KEYWORDS):
                    dietary_tags.append("Lactose Free")
                if any(k in ingr_text for k in ["dal", "lentil", "moong", "chana"]):
                    dietary_tags.append("High Fiber")
                if any(k in ingr_text for k in ["oats", "ragi", "bajra", "jowar"]):
                    dietary_tags.append("High Fiber")
                dietary_tags = sorted(set(dietary_tags))

                # Estimate nutrition
                nutrition = indian_nutrition_estimate(ingr_text, diet)

                # Condition safety
                condition_safety = derive_condition_safety_from_nutrition(nutrition, ingr_names)

                # Difficulty
                total_time = prep_time + cook_time
                difficulty = "Easy" if total_time <= 30 else ("Medium" if total_time <= 60 else "Hard")

                # Description
                parts = []
                if flavor: parts.append(f"{flavor.capitalize()} flavored")
                if state:  parts.append(f"from {state}")
                if region: parts.append(f"({region} India)")
                description = f"Traditional Indian dish " + ", ".join(parts) + "." if parts else f"Classic Indian recipe."
                description += f" Made with {', '.join(ingr_names[:4])}."

                recipe_id = f"ind_{hashlib.md5(name.encode()).hexdigest()[:8]}"

                step_text = (
                    f"Prepare and clean all ingredients: {', '.join(ingr_names[:5])}.",
                    f"Cook on medium heat for about {cook_time} minutes, adjusting spices to taste.",
                    "Serve hot and garnish as desired."
                )

                recipes.append({
                    "id":          recipe_id,
                    "name":        name,
                    "description": description[:250],
                    "cuisine":     "Indian",
                    "meal_type":   meal_type,
                    "prep_time":   prep_time,
                    "cook_time":   cook_time,
                    "servings":    4,
                    "difficulty":  difficulty,
                    "dietary_tags": dietary_tags,
                    "ingredients": ingredients_structured,
                    "steps":       list(step_text),
                    "nutrition_per_serving": {
                        "calories": nutrition["calories"],
                        "protein":  nutrition["protein"],
                        "carbs":    nutrition["carbs"],
                        "fat":      nutrition["fat"],
                        "fiber":    nutrition["fiber"],
                        "sodium":   nutrition["sodium"],
                        "sugar":    nutrition["sugar"],
                    },
                    "condition_safety": condition_safety,
                    "source": "Indian Food 101",
                    "tags": [diet, course, region.lower() if region else "indian"],
                })

            except Exception as e:
                continue

    print(f"  Processed {len(recipes)} Indian recipes")
    return recipes


def build_indian_recipes():
    """
    Phase 3: Merge Indian food recipes into existing recipes.json.
    Skips any recipe whose ID already exists (safe to re-run).
    """
    print("\n[Phase 3] Processing Indian Food Dataset...")

    # Load current recipes.json
    existing_recipes = []
    existing_ids = set()
    if os.path.exists(EXISTING_REC):
        with open(EXISTING_REC, "r", encoding="utf-8") as f:
            existing_recipes = json.load(f)
        existing_ids = {r["id"] for r in existing_recipes}
        print(f"  Current recipes.json has {len(existing_recipes)} recipes")

    # Process Indian CSV
    indian_recipes = process_indian_food_csv()

    # Add only new ones
    new_recipes = [r for r in indian_recipes if r["id"] not in existing_ids]
    all_recipes  = existing_recipes + new_recipes

    with open(OUT_RECIPES, "w", encoding="utf-8") as f:
        json.dump(all_recipes, f, indent=2, ensure_ascii=False)

    print(f"  Added {len(new_recipes)} new Indian recipes")
    print(f"  Total recipes now: {len(all_recipes)}")
    print(f"  Written to {OUT_RECIPES}")
    return len(all_recipes)


def load_foodcom_recipes(max_recipes: int = 3000) -> list:
    """
    Load and sample from Food.com RAW_recipes.csv.
    Samples across meal types for variety.
    """
    if not os.path.exists(FOODCOM_CSV):
        print(f"  [INFO] Food.com CSV not found at {FOODCOM_CSV} -- skipping recipe import")
        print(f"  [INFO] To add Food.com recipes, download RAW_recipes.csv and place in data/")
        return []

    print(f"  Loading Food.com recipes from {FOODCOM_CSV}...")

    # Sample into buckets by meal type
    buckets = {
        "Breakfast": [], "Lunch": [], "Dinner": [], "Snack": []
    }
    target_per_type = max_recipes // 4

    processed = 0
    added = 0
    errors = 0

    with open(FOODCOM_CSV, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            processed += 1

            # Early exit if all buckets full
            if all(len(b) >= target_per_type for b in buckets.values()):
                break

            recipe = process_foodcom_row(row, processed)
            if recipe:
                mt = recipe.get("meal_type", "Dinner")
                if len(buckets.get(mt, [])) < target_per_type:
                    buckets[mt].append(recipe)
                    added += 1
            else:
                errors += 1

            if processed % 10000 == 0:
                counts = {k: len(v) for k, v in buckets.items()}
                print(f"    Processed {processed:,} rows | Added {added} | Bucket counts: {counts}")

    # Flatten all buckets
    all_recipes = []
    for meal_type, recipes in buckets.items():
        print(f"    {meal_type}: {len(recipes)} recipes")
        all_recipes.extend(recipes)

    random.shuffle(all_recipes)
    print(f"  [OK] Food.com: {len(all_recipes)} recipes loaded ({processed:,} rows processed)")
    return all_recipes


def build_recipes_json(max_recipes: int = 3000):
    """Build new recipes.json merging existing hand-crafted + Food.com data."""
    print("\n[Phase 2] Processing Food.com Recipes Dataset...")

    # Load existing hand-crafted recipes
    existing_recipes = []
    existing_ids = set()
    if os.path.exists(EXISTING_REC):
        with open(EXISTING_REC, "r", encoding="utf-8") as f:
            existing_recipes = json.load(f)
        existing_ids = {r["id"] for r in existing_recipes}
        print(f"  Loaded {len(existing_recipes)} existing hand-crafted recipes (will be preserved)")

    # Load Food.com recipes
    foodcom_recipes = load_foodcom_recipes(max_recipes=max_recipes)

    # Merge: deduplicate by ID  
    new_recipes = [r for r in foodcom_recipes if r["id"] not in existing_ids]

    # Existing recipes first (hand-crafted), then Food.com recipes
    all_recipes = existing_recipes + new_recipes

    print(f"  Merged total: {len(all_recipes)} recipes")
    print(f"    - Hand-crafted (preserved): {len(existing_recipes)}")
    print(f"    - Food.com (added): {len(new_recipes)}")

    with open(OUT_RECIPES, "w", encoding="utf-8") as f:
        json.dump(all_recipes, f, indent=2, ensure_ascii=False)

    print(f"  [OK] Written to {OUT_RECIPES}")
    return len(all_recipes)


# ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
# MAIN
# ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

if __name__ == "__main__":
    print("=" * 65)
    print(" NutriAI Dataset ETL Pipeline v2.0")
    print("=" * 65)
    print(f" Data directory: {DATA_DIR}")
    print()

    # Check which files are present
    print("[Pre-check] Dataset files:")
    for fname, desc in [
        ("train.csv",       "USDA Nutrition Train Set"),
        ("test.csv",        "USDA Nutrition Test Set"),
        ("RAW_recipes.csv", "Food.com Recipes (optional)"),
    ]:
        path = os.path.join(DATA_DIR, fname)
        exists = os.path.exists(path)
        size = f"{os.path.getsize(path)/1024/1024:.1f} MB" if exists else "NOT FOUND"
        print(f"  {'OK' if exists else 'XX'} {fname:<25} - {desc} ({size})")

    print()

    # Phase 1: Nutrition
    n_ingr = build_nutrition_json()

    # Phase 2: Recipes (Food.com)
    n_recipes = build_recipes_json(max_recipes=3000)

    print()
    print("=" * 65)
    print(" ETL Complete!")
    print(f"  nutrition.json : {n_ingr:,} ingredients")
    print(f"  recipes.json   : {n_recipes:,} recipes")
    print("=" * 65)
    print()
    print(" Next steps:")
    print("  1. Restart the backend:  uvicorn main:app --reload")
    print("  2. Check GET /           -> verify counts")

    print("  3. Check GET /api/recipes?page=1&limit=20")
    print("  4. Check GET /api/nutrition/search?q=chicken")
    print()
    if not os.path.exists(FOODCOM_CSV):
        print(" [NOTE] To add Food.com recipes:")
        print("   Download RAW_recipes.csv from:")
        print("   https://www.kaggle.com/datasets/shuyangli94/food-com-recipes-and-user-interactions")
        print("   Place in: C:\\project\\nutriai-backend\\data\\RAW_recipes.csv")
        print("   Then re-run: python data_etl.py")

