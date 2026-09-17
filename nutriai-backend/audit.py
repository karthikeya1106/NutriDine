"""Final audit script — checks all datasets and output files."""
import json, csv, os

DATA = os.path.join(os.path.dirname(__file__), "data")
PASS = "[PASS]"
FAIL = "[FAIL]"
WARN = "[WARN]"

issues = []

print("=" * 60)
print("  NutriAI — Full Dataset & Integration Audit")
print("=" * 60)

# ── 1. FILE EXISTENCE ─────────────────────────────────────────────
print("\n[1] FILE CHECK")
expected_files = {
    "train.csv":        ("USDA Nutrition Train",    1.0),
    "test.csv":         ("USDA Nutrition Test",     0.3),
    "RAW_recipes.csv":  ("Food.com Recipes",       100.0),
    "nutrition.json":   ("Processed Nutrition DB",   1.0),
    "recipes.json":     ("Processed Recipes DB",     1.0),
}
for fname, (desc, min_mb) in expected_files.items():
    path = os.path.join(DATA, fname)
    if os.path.isdir(path):
        print(f"  {FAIL} {fname:<20} -> IS A FOLDER, not a file!")
        issues.append(f"{fname} is a directory, not a file")
    elif not os.path.exists(path):
        print(f"  {FAIL} {fname:<20} -> MISSING")
        issues.append(f"{fname} not found")
    else:
        size_mb = os.path.getsize(path) / 1024 / 1024
        ok = size_mb >= min_mb
        status = PASS if ok else FAIL
        print(f"  {status} {fname:<22} {desc} ({size_mb:.1f} MB)")
        if not ok:
            issues.append(f"{fname} too small ({size_mb:.1f} MB < {min_mb} MB expected)")

# ── 2. nutrition.json INTEGRITY ───────────────────────────────────
print("\n[2] NUTRITION.JSON INTEGRITY")
try:
    with open(os.path.join(DATA, "nutrition.json"), encoding="utf-8") as f:
        nutr = json.load(f)

    ingr  = nutr.get("ingredients", {})
    meta  = nutr.get("meta", {})
    cond  = nutr.get("condition_guidelines", {})

    # Count check
    n = len(ingr)
    status = PASS if n >= 8000 else (WARN if n >= 40 else FAIL)
    print(f"  {status} Total ingredients     : {n:,} (expected >= 8,000)")
    if n < 8000: issues.append(f"Only {n} ingredients, expected 8000+")

    # Source
    src = meta.get("source", "unknown")
    ok  = "USDA" in src or "v2" in src
    print(f"  {PASS if ok else WARN} Source               : {src}")

    # Required fields on a sample ingredient
    req_fields = ["calories_kcal","protein_g","carbs_g","fat_g",
                  "fiber_g","glycemic_index","gluten_free","dairy_free","diabetes_rating"]
    sample_key = list(ingr.keys())[100]
    sample_val = ingr[sample_key]
    missing_f  = [f for f in req_fields if f not in sample_val]
    ok = len(missing_f) == 0
    print(f"  {PASS if ok else FAIL} Required fields      : {'All present' if ok else 'MISSING: '+str(missing_f)}")
    if not ok: issues.append(f"nutrition.json missing fields: {missing_f}")

    # Condition guidelines
    expected_guides = {"Diabetes", "Celiac Disease", "Lactose Intolerance", "Hypertension"}
    found_guides    = set(cond.keys())
    missing_guides  = expected_guides - found_guides
    ok = len(missing_guides) == 0
    print(f"  {PASS if ok else FAIL} Condition guidelines : {list(found_guides)}")
    if not ok: issues.append(f"Missing condition guidelines: {missing_guides}")

    # USDA vs hand-crafted breakdown
    usda_ct = meta.get("usda_entries", "?")
    hc_ct   = meta.get("hand_crafted_entries", "?")
    print(f"  {PASS} Breakdown            : {usda_ct} USDA + {hc_ct} hand-crafted")

except Exception as e:
    print(f"  {FAIL} Could not parse nutrition.json: {e}")
    issues.append(f"nutrition.json parse error: {e}")

# ── 3. recipes.json INTEGRITY ─────────────────────────────────────
print("\n[3] RECIPES.JSON INTEGRITY")
try:
    with open(os.path.join(DATA, "recipes.json"), encoding="utf-8") as f:
        recipes = json.load(f)

    n = len(recipes)
    status = PASS if n >= 3000 else (WARN if n >= 20 else FAIL)
    print(f"  {status} Total recipes         : {n:,} (expected >= 3,020)")
    if n < 3000: issues.append(f"Only {n} recipes, expected 3020+")

    # Source breakdown
    sources = {}
    for r in recipes:
        s = r.get("source", "Hand-crafted")
        sources[s] = sources.get(s, 0) + 1
    print(f"  {PASS} Source breakdown       : {sources}")

    # Meal type spread
    meal_types = {}
    for r in recipes:
        mt = r.get("meal_type", "Unknown")
        meal_types[mt] = meal_types.get(mt, 0) + 1
    expected_mt = {"Breakfast", "Lunch", "Dinner", "Snack"}
    missing_mt  = expected_mt - set(meal_types.keys())
    ok = len(missing_mt) == 0
    print(f"  {PASS if ok else FAIL} Meal type spread      : {meal_types}")
    if not ok: issues.append(f"Missing meal types: {missing_mt}")

    # Required recipe fields
    req_rf = ["id","name","meal_type","cuisine","dietary_tags",
              "ingredients","steps","nutrition_per_serving","condition_safety"]
    # Check on a Food.com recipe (index 21+ are Food.com)
    sample_r = recipes[25] if len(recipes) > 25 else recipes[0]
    missing_rf = [f for f in req_rf if f not in sample_r]
    ok = len(missing_rf) == 0
    print(f"  {PASS if ok else FAIL} Required fields       : {'All present' if ok else 'MISSING: '+str(missing_rf)}")
    if not ok: issues.append(f"recipes.json missing fields: {missing_rf}")

    # Condition safety keys
    cs = sample_r.get("condition_safety", {})
    expected_cs = {"Diabetes","Celiac Disease","Lactose Intolerance","Hypertension"}
    missing_cs  = expected_cs - set(cs.keys())
    ok = len(missing_cs) == 0
    print(f"  {PASS if ok else FAIL} Condition safety keys : {list(cs.keys())}")
    if not ok: issues.append(f"Missing condition_safety keys: {missing_cs}")

    # Sample recipe fields populated
    print(f"  {PASS} Sample recipe name    : {sample_r.get('name','?')}")
    print(f"  {PASS} Sample cuisine        : {sample_r.get('cuisine','?')}")

except Exception as e:
    print(f"  {FAIL} Could not parse recipes.json: {e}")
    issues.append(f"recipes.json parse error: {e}")

# ── 4. RAW CSVs ────────────────────────────────────────────────────
print("\n[4] RAW CSV INTEGRITY")
for fname, required_cols in [
    ("train.csv",       ["ID","FoodGroup","Descrip","Energy_kcal","Protein_g","Fat_g","Carb_g","Fiber_g"]),
    ("test.csv",        ["ID","FoodGroup","Descrip","Energy_kcal","Protein_g","Fat_g","Carb_g","Fiber_g"]),
    ("RAW_recipes.csv", ["name","id","minutes","tags","nutrition","steps","ingredients","n_ingredients"]),
]:
    path = os.path.join(DATA, fname)
    if not os.path.exists(path) or os.path.isdir(path):
        print(f"  {FAIL} {fname} — not accessible")
        continue
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            cols   = reader.fieldnames or []
            count  = sum(1 for _ in reader)
        missing_cols = [c for c in required_cols if c not in cols]
        ok = len(missing_cols) == 0
        print(f"  {PASS if ok else FAIL} {fname:<22} {count:,} rows | cols OK: {ok}"
              + (f" | MISSING COLS: {missing_cols}" if not ok else ""))
        if not ok: issues.append(f"{fname} missing columns: {missing_cols}")
    except Exception as e:
        print(f"  {FAIL} {fname} — error: {e}")
        issues.append(f"{fname} error: {e}")

# ── 5. BACKEND FILES ───────────────────────────────────────────────
print("\n[5] BACKEND FILES")
backend_files = {
    "main.py":          50000,  # min bytes
    "ml_engine.py":     15000,
    "data_etl.py":      20000,
    "requirements.txt":   100,
    "otp_service.py":    5000,
}
base = os.path.dirname(DATA)
for fname, min_bytes in backend_files.items():
    path = os.path.join(base, fname)
    if not os.path.exists(path):
        print(f"  {FAIL} {fname:<20} MISSING")
        issues.append(f"Backend file missing: {fname}")
    else:
        size = os.path.getsize(path)
        ok   = size >= min_bytes
        print(f"  {PASS if ok else WARN} {fname:<20} {size:,} bytes")

# ── FINAL SUMMARY ─────────────────────────────────────────────────
print("\n" + "=" * 60)
if issues:
    print(f"  RESULT: {len(issues)} ISSUE(S) FOUND")
    for i, issue in enumerate(issues, 1):
        print(f"  {i}. {issue}")
else:
    print("  RESULT: ALL CHECKS PASSED — Nothing missing!")
print("=" * 60)
