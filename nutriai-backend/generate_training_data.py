"""
generate_training_data.py -- NutriAI ML Training Data Generator
==============================================================
Generates a synthetic dataset of ~3000 food items with realistic
nutritional profiles, each labelled safe/unsafe for 14 health conditions
based on established medical guidelines:
  ADA 2024 (Diabetes), JNC8/AHA (Hypertension), AHA Diet (Heart Disease),
  WHO (Obesity), Celiac Foundation, NIH, KDIGO 2022 (Kidney), NCEP ATP III
  (Cholesterol), Endocrine Society (PCOS), ATA (Thyroid), WHO (Anemia),
  ACR 2020 (Gout), NICE/Monash (IBS), EASL 2018 (Liver Disease)

Run: python generate_training_data.py
Output: data/training_data.csv
"""

import os
import numpy as np
import pandas as pd

np.random.seed(42)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)
OUT_CSV  = os.path.join(DATA_DIR, "training_data.csv")

# -- Food categories ------------------------------------------------------------
# Each entry:
# (name, cal, prot, carb, fat, fiber, sugar, sodium, potassium, calcium,
#  iron, vitc, gi, sat_fat, gluten_free, dairy_free,
#  purine_level 0=low/1=med/2=high, fodmap 0=low/1=med/2=high,
#  goitrogen 0/1, n_samples)
CATEGORIES = [
    # name                  cal        prot     carb     fat      fib      sug      sod      pot      cal_mg   iron     vitc     gi        sat      gf df pu fo go  n
    ("leafy_vegetables",   (15,  50), (1, 4),  (2, 8),  (0,  1), (2, 6),  (0, 3),  (5, 80),(200,500),(50,150),(1, 4),(20,80),(10,25),(0,  1),  1, 1, 0, 0, 1, 200),
    ("root_vegetables",    (50, 120), (1, 3),  (10,25), (0,  1), (2, 5),  (3, 8),  (20,100),(200,400),(20,60),(0, 2),(5, 30),(35,65),(0,  1),  1, 1, 0, 1, 0, 150),
    ("cruciferous_veg",    (20,  60), (2, 5),  (3, 10), (0,  1), (2, 5),  (2, 5),  (10,60),(200,400),(40,100),(1, 3),(40,100),(15,30),(0, 1), 1, 1, 0, 1, 1, 100),
    ("legumes",            (90, 160), (6,15),  (15,28), (0,  3), (6,12),  (1, 4),  (5, 50),(250,500),(40,100),(2, 5),(1,  5),(25,40),(0,  1),  1, 1, 1, 0, 0, 200),
    ("whole_grains",       (120,200), (3, 8),  (25,45), (1,  3), (3, 8),  (1, 4),  (5,200),(100,300),(10,40),(1, 4),(0,  2),(45,65),(0,  1),  0, 1, 0, 1, 0, 150),
    ("refined_grains",     (150,280), (3, 8),  (30,60), (1,  5), (0, 2),  (2,15),(100,500),(50,150),(10, 40),(0, 2),(0,  1),(65,90),(0,  2),  0, 1, 0, 0, 0, 100),
    ("white_rice_pasta",   (130,200), (2, 5),  (28,45), (0,  2), (0, 1),  (0, 3),  (0,100),(30, 80),(5,  20),(0, 1),(0,  1),(70,90),(0,  1),  1, 1, 0, 0, 0, 100),
    ("red_meat",           (150,300), (18,28), (0,  3), (8, 20), (0, 0),  (0, 0),(50, 300),(200,400),(5, 20),(2, 4),(0,  2),(0,  5),(3, 10),  1, 1, 2, 0, 0, 150),
    ("poultry",            (120,250), (20,30), (0,  2), (3, 12), (0, 0),  (0, 0),(50, 200),(200,350),(5, 20),(1, 3),(0,  2),(0,  5),(1,  4),  1, 1, 1, 0, 0, 100),
    ("fish_low_purine",    (100,200), (18,28), (0,  2), (2,  8), (0, 0),  (0, 0),(50, 200),(250,400),(20,60),(1, 2),(0,  2),(0,  5),(0,  2),  1, 1, 1, 0, 0, 100),
    ("fish_high_purine",   (130,250), (18,28), (0,  2), (4, 15), (0, 0),  (0, 0),(50, 300),(250,400),(20,60),(1, 2),(0,  2),(0,  5),(1,  4),  1, 1, 2, 0, 0,  80),
    ("shellfish",          (80, 150), (12,22), (2,  8), (1,  4), (0, 0),  (0, 2),(100,400),(150,300),(40,100),(2, 8),(2,  8),(0,  5),(0,  1), 1, 1, 2, 0, 0,  60),
    ("eggs",               (130,160), (10,14), (0,  2), (8, 12), (0, 0),  (0, 1),(60, 140),(100,160),(40,60),(1, 2),(0,  1),(0,  5),(2,  4),  1, 1, 0, 0, 0, 100),
    ("full_fat_dairy",     (100,200), (4, 10), (3,  8), (5, 15), (0, 0),  (3, 7),(40, 150),(100,200),(100,250),(0,1),(0, 2),(25,40),(3,  8),  1, 0, 0, 1, 0, 100),
    ("low_fat_dairy",      (40, 100), (5, 12), (4,  8), (0,  3), (0, 0),  (4, 8),(50, 150),(150,250),(120,250),(0,1),(0, 2),(30,45),(0,  2),  1, 0, 0, 1, 0, 100),
    ("nuts_seeds",         (150,650), (5, 20), (5, 20), (12,55), (2, 8),  (1, 5),(1,  100),(150,700),(20,100),(1, 5),(0,  3),(10,30),(1,  8),  1, 1, 0, 1, 0, 120),
    ("oils_fats",          (700,900), (0,  1), (0,  1), (70,100),(0, 0),  (0, 0),(0,   50),(0,    5),(0,   5),(0, 0),(0,  0),(0,  5),(10,60),  1, 0, 0, 0, 0,  50),
    ("fruits_low_gi",      (30,  80), (0,  2), (7, 18), (0,  1), (1, 4),  (5,14),(0,   10),(100,300),(10,40),(0, 1),(5, 50),(30,50),(0,  0),  1, 1, 0, 1, 0, 150),
    ("fruits_high_gi",     (40, 100), (0,  2), (12,28), (0,  1), (1, 3), (10,22),(0,   10),(100,300),(10,30),(0, 1),(5, 40),(55,75),(0,  0),  1, 1, 0, 0, 0, 100),
    ("processed_foods",    (200,500), (3, 15), (20,55), (8, 30), (0, 2),  (5,25),(400,1500),(100,250),(30,150),(1,4),(0, 5),(50,80),(2, 15),  0, 1, 0, 0, 0, 150),
    ("sweets_desserts",    (200,500), (2,  8), (30,70), (8, 25), (0, 2), (20,60),(50, 300),(50, 200),(20,100),(0, 2),(0,  5),(65,90),(3, 12),  0, 0, 0, 0, 0, 100),
    ("sugary_beverages",   (100,300), (0,  2), (25,70), (0,  1), (0, 0), (25,70),(0,  100),(10,  50),(0,  20),(0, 0),(0, 10),(70,90),(0,  0),  1, 1, 0, 0, 0,  80),
    ("healthy_beverages",  (0,   50), (0,  2), (0,  8), (0,  0), (0, 1),  (0, 8),(0,   50),(50, 300),(10,100),(0, 1),(0, 50),(0, 20),(0,  0),  1, 1, 0, 0, 0,  80),
    ("herbs_spices",       (5,   80), (1,  5), (2, 15), (0,  4), (2, 7),  (0, 3),(5,   40),(100,600),(50,300),(5,30),(2, 30),(5, 20),(0,  1),  1, 1, 0, 0, 1,  60),
    ("fermented_foods",    (20, 100), (2,  8), (2, 15), (0,  5), (0, 2),  (0, 5),(200,800),(50, 200),(30,200),(0, 1),(0,  5),(20,50),(0,  2),  0, 0, 0, 1, 0,  80),
    ("alcohol",            (100,300), (0,  1), (0, 20), (0,  0), (0, 0),  (0,10),(5,  100),(50, 150),(5,  20),(0, 0),(0,  0),(70,100),(0, 0),  0, 0, 1, 1, 0,  50),
    ("high_iron_foods",    (80, 250), (15,30), (0, 15), (2, 15), (0, 4),  (0, 3),(50, 300),(150,400),(20,80),(5,15),(5, 20),(0, 35),(1,  5),  1, 1, 1, 0, 0, 100),
    ("calcium_rich",       (50, 200), (5, 15), (5, 15), (0,  8), (0, 2),  (2, 8),(50, 200),(100,300),(200,500),(0,2),(0,40),(20,45),(0,  4),  1, 1, 0, 0, 0,  80),
]

def _rng(lo, hi):
    return round(float(np.random.uniform(lo, hi)), 2)

def _rng_i(lo, hi):
    return int(np.random.randint(lo, hi + 1))

def generate_sample(cat):
    (_, cal, pro, carb, fat, fib, sug, sod, pot, cal_mg,
     iron, vitc, gi, sat, gf, df, pu, fo, go, _n) = cat
    return {
        "calories_kcal":    _rng(*cal),
        "protein_g":        _rng(*pro),
        "carbs_g":          _rng(*carb),
        "fat_g":            _rng(*fat),
        "fiber_g":          _rng(*fib),
        "sugar_g":          _rng(*sug),
        "sodium_mg":        _rng(*sod),
        "potassium_mg":     _rng(*pot),
        "calcium_mg":       _rng(*cal_mg),
        "iron_mg":          _rng(*iron),
        "vitamin_c_mg":     _rng(*vitc),
        "glycemic_index":   _rng_i(*gi),
        "saturated_fat_g":  _rng(*sat),
        "gluten_free":      gf,
        "dairy_free":       df,
        "purine_level":     pu,    # 0=low,1=medium,2=high
        "fodmap_score":     fo,    # 0=low,1=medium,2=high
        "goitrogen_flag":   go,    # 0=no,1=yes
    }

def label_sample(s):
    """
    Medical-guideline-based safety labels for each condition.
    1 = safe, 0 = unsafe
    """
    gi  = s["glycemic_index"]
    cal = s["calories_kcal"]
    pro = s["protein_g"]
    carb= s["carbs_g"]
    fat = s["fat_g"]
    fib = s["fiber_g"]
    sug = s["sugar_g"]
    sod = s["sodium_mg"]
    pot = s["potassium_mg"]
    calcium = s["calcium_mg"]
    iron= s["iron_mg"]
    vitc= s["vitamin_c_mg"]
    sat = s["saturated_fat_g"]
    gf  = s["gluten_free"]
    df  = s["dairy_free"]
    pu  = s["purine_level"]
    fo  = s["fodmap_score"]
    go  = s["goitrogen_flag"]

    return {
        # ADA 2024: low GI, controlled carbs, adequate fiber, low sugar
        "label_Diabetes":           int(gi < 55 and carb < 45 and fib >= 2.5 and sug < 12),

        # JNC8/AHA: low sodium, low fat
        "label_Hypertension":       int(sod < 300 and fat < 15),

        # AHA Diet Guidelines: low saturated fat, low sodium, adequate fiber
        "label_Heart Disease":      int(sat < 5 and sod < 250 and fat < 15),

        # WHO: calorie-controlled, high fiber, low sugar
        "label_Obesity":            int(cal < 400 and fib >= 3 and sug < 15),

        # Celiac Foundation: strictly gluten-free
        "label_Celiac Disease":     int(gf == 1),

        # NIH: dairy-free
        "label_Lactose Intolerance":int(df == 1),

        # KDIGO 2022: low potassium, controlled protein, low sodium
        "label_Kidney Disease":     int(pot < 200 and pro < 15 and sod < 200),

        # NCEP ATP III: low sat fat, high fiber, low total fat
        "label_High Cholesterol":   int(sat < 4 and fib >= 4 and fat < 12),

        # Endocrine Society: low GI, high fiber, low sugar (insulin sensitivity)
        "label_PCOS":               int(gi < 55 and fib >= 3.5 and sug < 10),

        # ATA 2023: avoid goitrogenic foods (suppress thyroid function)
        "label_Thyroid Disorder":   int(go == 0),

        # WHO: high iron, vitamin C enhances non-heme iron absorption
        "label_Anemia":             int(iron >= 2.5 or (iron >= 1.5 and vitc >= 20)),

        # ACR 2020: low purine, limited fructose/sugar
        "label_Gout":               int(pu == 0 and sug < 15),

        # NICE/Monash Low-FODMAP: low FODMAP score, moderate fiber
        "label_IBS":                int(fo == 0 and fib < 8),

        # EASL 2018: low fat, low sodium, low sugar
        "label_Liver Disease":      int(fat < 10 and sod < 300 and sug < 15),

        # NIDDK/ACG: low fat, low sugar, avoid acidic/fried foods
        "label_GERD":               int(fat < 10 and sat < 4 and sug < 15),

        # NOF: high calcium, adequate protein, low sodium (prevents calcium loss)
        "label_Osteoporosis":       int(calcium >= 100 and pro >= 5 and sod < 400),

        # Arthritis Foundation: anti-inflammatory -- low sat fat, low sugar, low sodium
        "label_Rheumatoid Arthritis": int(sat < 5 and sug < 12 and sod < 300),

        # AASLD: very low sugar (esp. fructose), low fat, low calorie
        "label_NAFLD":              int(sug < 8 and fat < 8 and cal < 250),

        # ACG: ultra-low fat (fat triggers gallbladder contraction)
        "label_Gallbladder Disease": int(fat < 5 and sat < 2),

        # CCFA: low fiber during flare, low fat, low FODMAP
        "label_Crohn's Disease":    int(fib < 4 and fat < 10 and fo == 0),

        # APA/EPC: extremely low fat is critical for pancreatitis
        "label_Chronic Pancreatitis": int(fat < 3 and sug < 15 and cal < 200),

        # American Migraine Foundation: low tyramine (purine proxy), low sodium, low sugar
        "label_Migraine":           int(pu == 0 and sod < 300 and sug < 15),
    }

def main():
    rows = []
    for cat in CATEGORIES:
        n = cat[-1]
        for _ in range(n):
            s = generate_sample(cat)
            l = label_sample(s)
            rows.append({**s, **l})

    df = pd.DataFrame(rows)
    df.to_csv(OUT_CSV, index=False)

    print(f"[OK] Generated {len(df)} training samples -> {OUT_CSV}")
    print(f"     Features : {len([c for c in df.columns if not c.startswith('label_')])} columns")
    print(f"     Conditions: {len([c for c in df.columns if c.startswith('label_')])} labels\n")
    print(f"  {'Condition':<26}  Safe    Unsafe")
    print(f"  {'-'*50}")
    for col in sorted(c for c in df.columns if c.startswith("label_")):
        pos = int(df[col].sum())
        neg = len(df) - pos
        print(f"  {col[6:]:26s} {pos:5d}   {neg:5d}")


if __name__ == "__main__":
    main()
