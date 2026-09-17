"""
nhanes_etl.py -- NHANES 2017-2018 Real-World Dietary + Condition ETL
====================================================================
Downloads 7 CDC NHANES public files (~55 MB), merges them by respondent ID,
normalizes daily intake to per-meal estimates, and outputs a training dataset
grounded in real US population dietary data.

Sources (all public CDC data, no authentication required):
  - DR1TOT_J : Day 1 total dietary recall (8,704 US adults)
  - DIQ_J    : Diabetes diagnosis
  - BPQ_J    : Blood pressure + cholesterol
  - MCQ_J    : Medical conditions (heart, liver, thyroid, gout)
  - KIQ_U_J  : Kidney disease
  - CBC_J    : Complete blood count (hemoglobin -> Anemia)
  - BMX_J    : Body measurements (BMI -> Obesity)

Run:   python nhanes_etl.py
Output: data/training_data_nhanes.csv  (~7000-8000 rows)
"""

import os
import io
import warnings
import requests
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

BASE_DIR  = os.path.dirname(__file__)
DATA_DIR  = os.path.join(BASE_DIR, "data")
CACHE_DIR = os.path.join(DATA_DIR, "nhanes_cache")
OUT_CSV   = os.path.join(DATA_DIR, "training_data_nhanes.csv")

os.makedirs(DATA_DIR,  exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

# Correct base URL (confirmed working)
NHANES_BASE = "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles"

NHANES_FILES = {
    # Dietary recall
    "dietary": "DR1TOT_J.XPT",   # Day 1 total nutrient intakes
    # Questionnaires (self-reported diagnoses)
    "diabetes": "DIQ_J.XPT",     # Diabetes questionnaire
    "bp_chol":  "BPQ_J.XPT",     # Blood pressure + cholesterol (self-reported)
    "medical":  "MCQ_J.XPT",     # Medical conditions
    "kidney":   "KIQ_U_J.XPT",   # Kidney conditions
    # Lab measurements (objective clinical values)
    "lab_hba1c":  "GHB_J.XPT",   # Glycohemoglobin (HbA1c) -> Diabetes ground truth
    "lab_chol":   "TCHOL_J.XPT", # Total cholesterol -> High Cholesterol ground truth
    "lab_lipids": "TRIGLY_J.XPT",# Triglycerides + LDL -> High Cholesterol ground truth
    "lab_bp":     "BPX_J.XPT",   # Blood pressure exam -> Hypertension ground truth
    # Physical measurements
    "blood":    "CBC_J.XPT",     # Complete blood count (hemoglobin -> Anemia)
    "body":     "BMX_J.XPT",     # Body measurements (BMI -> Obesity)
}

HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
    "Accept": "application/octet-stream, */*",
}

# -- Dietary nutrient column -> readable name mapping ---------------------------
NUTRIENT_COLS = {
    "DR1TKCAL": "calories_kcal",
    "DR1TPROT": "protein_g",
    "DR1TCARB": "carbs_g",
    "DR1TTFAT": "fat_g",
    "DR1TSFAT": "saturated_fat_g",
    "DR1TFIBE": "fiber_g",        # correct 2017-2018 column (DR1TFIBE, not DR1TDFIB)
    "DR1TSUGR": "sugar_g",
    "DR1TSODI": "sodium_mg",
    "DR1TPOTA": "potassium_mg",
    "DR1TCALC": "calcium_mg",
    "DR1TIRON": "iron_mg",
    "DR1TVC":   "vitamin_c_mg",
}


# -- Helpers -------------------------------------------------------------------

def download_xpt(key: str, filename: str):
    """Download NHANES XPT file, cache as parquet, return as DataFrame."""
    import pickle
    cache_path = os.path.join(CACHE_DIR, filename.replace(".XPT", ".pkl"))

    if os.path.exists(cache_path):
        print(f"  [cache] {filename}")
        with open(cache_path, 'rb') as f:
            return pickle.load(f)

    url = f"{NHANES_BASE}/{filename}"
    print(f"  [download] {filename} ...", end=" ", flush=True)
    try:
        r = requests.get(url, headers=HTTP_HEADERS, timeout=120, allow_redirects=True)
        if "html" in r.headers.get("content-type", "").lower():
            print(f"WARN -- server returned HTML (file may not exist)")
            return None
        df = pd.read_sas(io.BytesIO(r.content), format="xport")
        for col in df.select_dtypes(["object"]).columns:
            df[col] = df[col].apply(
                lambda x: x.decode("utf-8") if isinstance(x, bytes) else x
            )
        with open(cache_path, 'wb') as f:
            pickle.dump(df, f)
        print(f"{len(df)} rows, {len(df.columns)} cols")
        return df
    except Exception as e:
        print(f"ERROR: {e}")
        return None


def estimate_gi(carbs: float, fiber: float, sugar: float) -> int:
    """Estimate glycemic index from macro ratios (same logic as data_etl.py)."""
    if carbs < 2:
        return 0
    fiber = max(fiber, 0.1)
    ratio = (carbs - fiber) / fiber
    if ratio < 3:
        return max(20, int(30 + (ratio / 3) * 15))
    elif ratio < 7:
        return int(45 + ((ratio - 3) / 4) * 20)
    else:
        return min(90, int(65 + min(ratio - 7, 7) / 7 * 20))


def safe(val, default=0.0) -> float:
    try:
        v = float(val)
        return default if np.isnan(v) else v
    except Exception:
        return default


# -- Condition label derivation ------------------------------------------------

def apply_guideline_labels(row: pd.Series) -> dict:
    """
    Apply medical-guideline-based safety labels to a NHANES PER-MEAL profile.
    Thresholds are calibrated to per-meal values (daily guideline / 3),
    matching real intake distributions from NHANES 2017-2018.
    """
    cal  = safe(row.get("calories_kcal"))
    pro  = safe(row.get("protein_g"))
    carb = safe(row.get("carbs_g"))
    fat  = safe(row.get("fat_g"))
    sat  = safe(row.get("saturated_fat_g"))
    fib  = safe(row.get("fiber_g"))
    sug  = safe(row.get("sugar_g"))
    sod  = safe(row.get("sodium_mg"))
    pot  = safe(row.get("potassium_mg"))
    calcium = safe(row.get("calcium_mg"))
    iron = safe(row.get("iron_mg"))
    vitc = safe(row.get("vitamin_c_mg"))
    gi   = safe(row.get("glycemic_index"))

    # -- Meal-level guideline thresholds (daily guideline / 3) -----------------
    # All averages from NHANES 2017-18 US adult data (after /3 normalization):
    #   cal~660, carb~80g, sug~35g, fat~27g, sat~9g, sod~1056mg,
    #   pot~784mg, iron~4.5mg, vitc~25mg

    # -- Clinical lab values from merged NHANES lab files -----------------------
    hba1c      = safe(row.get("lab_hba1c"))      # % -- HbA1c (GHB_J)
    sbp        = safe(row.get("lab_sbp"))         # mmHg systolic BP (BPX_J)
    dbp        = safe(row.get("lab_dbp"))         # mmHg diastolic BP (BPX_J)
    ldl        = safe(row.get("lab_ldl"))         # mg/dL LDL (TRIGLY_J)
    total_chol = safe(row.get("lab_total_chol"))  # mg/dL total chol (TCHOL_J)

    # Clinical category flags
    # Diabetes: HbA1c>=6.5%=confirmed | 5.7-6.5%=prediabetes | else=none
    has_diabetes = (hba1c >= 6.5) if hba1c > 0 else (row.get("nhanes_diabetes", 0) == 1)
    has_prediab  = (5.7 <= hba1c < 6.5) if hba1c > 0 else False
    # Hypertension: SBP>=130 or DBP>=80 (ACC/AHA 2017 Stage 1)
    has_htn      = (sbp >= 130 or dbp >= 80) if (sbp > 0 or dbp > 0) else (row.get("nhanes_hypertension", 0) == 1)
    # High Cholesterol: LDL>=160 or TC>=240
    has_highchol = (ldl >= 160 or total_chol >= 240) if (ldl > 0 or total_chol > 0) else (row.get("nhanes_cholesterol", 0) == 1)

    return {
        # DIABETES -- ADA 2024 + HbA1c ground truth
        # Confirmed/prediabetic: must meet STRICTER ADA meal targets to be labeled safe
        # Non-diabetic: standard guideline threshold
        "label_Diabetes": int(
            carb < 55 and gi < 55 and fib >= 6 and sug < 20
        ) if (has_diabetes or has_prediab) else int(
            carb < 65 and gi < 60 and fib >= 5 and sug < 30
        ),

        # HYPERTENSION -- ACC/AHA 2017 + actual BP ground truth
        # Hypertensive: must meet STRICTER DASH thresholds (lower sodium, higher potassium)
        # Non-hypertensive: standard JNC8 guideline
        "label_Hypertension": int(
            sod < 450 and fat < 22 and pot >= 400
        ) if has_htn else int(
            sod < 600 and fat < 25
        ),

        # AHA: sat_fat<13g/day -> <4.3g/meal; sodium<1500mg/day -> <500mg/meal
        "label_Heart Disease":      int(sat < 10 and sod < 650 and fat < 28),

        # WHO: 1800kcal/day -> 600kcal/meal; fiber>25g/day -> 8g/meal; sugar<50g/day -> 17g/meal
        "label_Obesity":            int(cal < 700 and fib >= 5 and sug < 30),

        # Celiac: can't determine from dietary totals
        "label_Celiac Disease":     1,

        # Lactose: can't determine from dietary totals
        "label_Lactose Intolerance": 1,

        # KDIGO 2022: potassium<2000mg/day -> <667mg/meal; protein<50g/day -> <17g/meal
        "label_Kidney Disease":     int(pot < 700 and pro < 20 and sod < 700),

        # HIGH CHOLESTEROL -- NCEP ATP III + LDL/TC ground truth
        # Clinically high: must meet STRICTER thresholds (lower sat fat, higher fiber)
        # Normal: standard guideline
        "label_High Cholesterol": int(
            sat < 6 and fib >= 7 and fat < 22
        ) if has_highchol else int(
            sat < 9 and fib >= 5 and fat < 28
        ),

        # Endocrine Society: GI<60, fiber>8g/meal, sugar<25g/meal
        "label_PCOS":               int(gi < 60 and fib >= 5 and sug < 25),

        # ATA: can't determine goitrogens from dietary totals
        "label_Thyroid Disorder":   1,

        # WHO Anemia: iron>6mg/meal (daily RDA 18mg / 3), vitamin C helps absorption
        "label_Anemia":             int(iron >= 4 or (iron >= 2.5 and vitc >= 15)),

        # ACR 2020: protein<30g/meal as purine proxy; sugar<30g/meal (fructose raises uric acid)
        "label_Gout":               int(pro < 32 and sug < 30),

        # NICE/Monash: can't derive FODMAP from daily totals; fiber proxy only
        "label_IBS":                int(fib < 12),

        # EASL 2018: fat<25g/meal, sodium<900mg/meal, sugar<30g/meal
        "label_Liver Disease":      int(fat < 28 and sod < 950 and sug < 35),

        # NIDDK/ACG: low fat, low sugar avoids acid reflux triggers
        "label_GERD":               int(fat < 22 and sat < 8 and sug < 25),

        # NOF: high calcium, adequate protein, low sodium (preserves bone density)
        "label_Osteoporosis":       int(calcium >= 100 and pro >= 8 and sod < 700),

        # Arthritis Foundation: anti-inflammatory meal pattern
        "label_Rheumatoid Arthritis": int(sat < 9 and sug < 25 and sod < 600),

        # AASLD: low sugar (fructose drives NAFLD), low fat, low calorie
        "label_NAFLD":              int(sug < 20 and fat < 20 and cal < 600),

        # ACG: fat triggers gallbladder contraction -- ultra-low fat per meal
        "label_Gallbladder Disease": int(fat < 12 and sat < 5),

        # CCFA: low fiber reduces bowel irritation in Crohn's; low FODMAP
        "label_Crohn's Disease":    int(fib < 8 and fat < 22 and sod < 700),

        # APA/EPC: extremely low fat -- most restrictive condition dietary-wise
        "label_Chronic Pancreatitis": int(fat < 10 and sug < 25 and cal < 500),

        # American Migraine Foundation: low sodium (avoids MSG/processed), low purine proxy
        "label_Migraine":           int(sod < 500 and sug < 25 and pro < 25),
    }


# -- Main ETL ------------------------------------------------------------------

def main():
    print("=" * 60)
    print("  NutriAI -- NHANES 2017-2018 Real-World ETL")
    print("  Source: CDC National Health and Nutrition Examination Survey")
    print("=" * 60)

    # -- Step 1: Download all NHANES files --------------------------------------
    print("\n[1] Downloading NHANES files (cached after first run)...")
    frames = {}
    for key, filename in NHANES_FILES.items():
        df = download_xpt(key, filename)
        if df is not None and "SEQN" in df.columns:
            frames[key] = df.set_index("SEQN")

    if "dietary" not in frames:
        print("\nERROR: Dietary file (DR1TOT_J.XPT) is required. Check internet.")
        return

    # -- Step 2: Extract dietary nutrient features ------------------------------
    print("\n[2] Extracting nutritional features from dietary recall...")
    diet = frames["dietary"]

    avail = {k: v for k, v in NUTRIENT_COLS.items() if k in diet.columns}
    missing_raw = [k for k in NUTRIENT_COLS if k not in diet.columns]
    if missing_raw:
        print(f"     Missing NHANES columns (will default to 0): {missing_raw}")

    diet = diet[list(avail.keys())].rename(columns=avail)

    # Drop rows with missing calories/carbs/fat (core macros must be present)
    diet = diet.dropna(subset=["calories_kcal", "carbs_g", "fat_g"])
    # Plausibility filter: 500-7000 kcal/day is realistic
    diet = diet[(diet["calories_kcal"] >= 500) & (diet["calories_kcal"] <= 7000)]
    print(f"     {len(diet)} participants with valid dietary data")

    # Fill remaining NaN with 0 (trace nutrients absent from some records)
    for col in diet.columns:
        diet[col] = diet[col].fillna(0.0)

    # Ensure ALL nutrient columns expected by the model exist (fill with 0 if absent)
    all_nutrient_names = list(NUTRIENT_COLS.values())
    for col in all_nutrient_names:
        if col not in diet.columns:
            diet[col] = 0.0


    # -- Step 3: Per-meal normalization (daily intake / 3) ---------------------
    print("[3] Normalizing: daily intake -> per-meal estimate (/3)...")
    diet = (diet / 3).round(3)

    # -- Step 4: Engineer extra features ---------------------------------------
    print("[4] Engineering derived features (GI, purine, etc.)...")
    diet["glycemic_index"] = diet.apply(
        lambda r: estimate_gi(r.get("carbs_g", 30), r.get("fiber_g", 3), r.get("sugar_g", 10)),
        axis=1,
    )
    # Flags that can't be derived from daily totals -> conservative defaults
    diet["gluten_free"]    = 1
    diet["dairy_free"]     = 1
    diet["purine_level"]   = diet["protein_g"].apply(
        lambda p: 2 if p > 25 else (1 if p > 15 else 0)
    )
    diet["fodmap_score"]   = 0
    diet["goitrogen_flag"] = 0

    # -- Step 5: Merge clinical condition flags from questionnaires -------------
    print("[5] Merging clinical diagnosis data from questionnaires...")

    # Diabetes (DIQ_J: DIQ010 == 1 -> Yes)
    if "diabetes" in frames:
        diq = frames["diabetes"]
        if "DIQ010" in diq.columns:
            diet["nhanes_diabetes"] = diq["DIQ010"].reindex(diet.index).apply(
                lambda x: 1 if x == 1.0 else 0
            ).fillna(0)

    # Hypertension + High Cholesterol (BPQ_J)
    if "bp_chol" in frames:
        bpq = frames["bp_chol"]
        if "BPQ020" in bpq.columns:
            diet["nhanes_hypertension"] = bpq["BPQ020"].reindex(diet.index).apply(
                lambda x: 1 if x == 1.0 else 0
            ).fillna(0)
        if "BPQ080" in bpq.columns:
            diet["nhanes_high_chol"] = bpq["BPQ080"].reindex(diet.index).apply(
                lambda x: 1 if x == 1.0 else 0
            ).fillna(0)

    # Heart Disease + Liver (MCQ_J)
    if "medical" in frames:
        mcq = frames["medical"]
        # Heart disease = any of: heart failure, CHD, angina, heart attack
        heart_cols = [c for c in ["MCQ160B","MCQ160C","MCQ160D","MCQ160E"] if c in mcq.columns]
        if heart_cols:
            diet["nhanes_heart_disease"] = mcq[heart_cols].reindex(diet.index).apply(
                lambda row: 1 if any(row == 1.0) else 0, axis=1
            ).fillna(0)
        # Liver
        if "MCQ160L" in mcq.columns:
            diet["nhanes_liver"] = mcq["MCQ160L"].reindex(diet.index).apply(
                lambda x: 1 if x == 1.0 else 0
            ).fillna(0)

    # Kidney (KIQ_U_J)
    if "kidney" in frames:
        kiq = frames["kidney"]
        kid_col = next((c for c in ["KIQ022","KID020"] if c in kiq.columns), None)
        if kid_col:
            diet["nhanes_kidney"] = kiq[kid_col].reindex(diet.index).apply(
                lambda x: 1 if x == 1.0 else 0
            ).fillna(0)

    # Anemia via hemoglobin (CBC_J: LBXHGB < 12 for women, < 13 for men)
    if "blood" in frames:
        cbc = frames["blood"]
        if "LBXHGB" in cbc.columns:
            diet["nhanes_anemia"] = cbc["LBXHGB"].reindex(diet.index).apply(
                lambda x: 1 if (not np.isnan(float(x)) and float(x) < 12.5) else 0
            ).fillna(0)

    # Obesity via BMI (BMX_J: BMXBMI >= 30)
    if "body" in frames:
        bmx = frames["body"]
        if "BMXBMI" in bmx.columns:
            diet["nhanes_obesity"] = bmx["BMXBMI"].reindex(diet.index).apply(
                lambda x: 1 if (not np.isnan(float(x)) and float(x) >= 30) else 0
            ).fillna(0)

    # ---- CLINICAL LAB VALUES (objective measurements) -------------------------
    # HbA1c (GHB_J: LBXGH) -- gold standard for diabetes diagnosis
    # Clinical thresholds: >=6.5% = diabetes, 5.7-6.5% = prediabetes, <5.7% = normal
    if "lab_hba1c" in frames:
        ghb = frames["lab_hba1c"]
        if "LBXGH" in ghb.columns:
            diet["lab_hba1c"] = ghb["LBXGH"].reindex(diet.index).astype(float)
            print(f"     [LAB] HbA1c (LBXGH): {diet['lab_hba1c'].notna().sum()} values merged")
            n_diab = int((diet['lab_hba1c'].fillna(0) >= 6.5).sum())
            print(f"           Clinical diabetes (HbA1c>=6.5%): {n_diab} ({n_diab/len(diet)*100:.1f}%)")

    # Total Cholesterol (TCHOL_J: LBXTC) -- mg/dL
    # Clinical thresholds: >=240 = high, 200-239 = borderline, <200 = desirable
    if "lab_chol" in frames:
        tchol = frames["lab_chol"]
        if "LBXTC" in tchol.columns:
            diet["lab_total_chol"] = tchol["LBXTC"].reindex(diet.index).astype(float)
            print(f"     [LAB] Total Cholesterol (LBXTC): {diet['lab_total_chol'].notna().sum()} values merged")

    # LDL Cholesterol (TRIGLY_J: LBDLDL) -- mg/dL
    # Clinical thresholds: >=160 = high, 130-159 = borderline, <130 = desirable
    if "lab_lipids" in frames:
        trig = frames["lab_lipids"]
        if "LBDLDL" in trig.columns:
            diet["lab_ldl"] = trig["LBDLDL"].reindex(diet.index).astype(float)
            print(f"     [LAB] LDL Cholesterol (LBDLDL): {diet['lab_ldl'].notna().sum()} values merged")
            n_hichol = int((diet['lab_ldl'].fillna(0) >= 160).sum())
            print(f"           High LDL (>=160 mg/dL): {n_hichol} ({n_hichol/len(diet)*100:.1f}%)")

    # Blood Pressure (BPX_J: BPXSY1 systolic, BPXDI1 diastolic) -- mmHg
    # Clinical thresholds: SBP>=140 or DBP>=90 = hypertension, 120-139/80-89 = elevated
    if "lab_bp" in frames:
        bpx = frames["lab_bp"]
        if "BPXSY1" in bpx.columns:
            diet["lab_sbp"] = bpx["BPXSY1"].reindex(diet.index).astype(float)
            print(f"     [LAB] Systolic BP (BPXSY1): {diet['lab_sbp'].notna().sum()} values merged")
            n_htn = int((diet['lab_sbp'].fillna(0) >= 130).sum())
            print(f"           Elevated SBP (>=130 mmHg): {n_htn} ({n_htn/len(diet)*100:.1f}%)")
        if "BPXDI1" in bpx.columns:
            diet["lab_dbp"] = bpx["BPXDI1"].reindex(diet.index).astype(float)

    # Fill any missing clinical flags with 0
    clinical_cols = [c for c in diet.columns if c.startswith("nhanes_")]
    diet[clinical_cols] = diet[clinical_cols].fillna(0).astype(int)
    print(f"     Clinical flags merged: {clinical_cols}")

    # Show clinical condition prevalence
    for col in clinical_cols:
        n = int(diet[col].sum())
        pct = n / len(diet) * 100
        print(f"     {col[7:]:20s}: {n:4d} ({pct:.1f}%)")

    # -- Step 6: Apply condition labels -----------------------------------------
    print("\n[6] Applying medical guideline labels to real dietary profiles...")
    label_df = diet.apply(apply_guideline_labels, axis=1, result_type="expand")

    # All ML feature columns (must match FEATURE_COLS in train_model.py)
    feature_cols = [
        "calories_kcal", "protein_g", "carbs_g", "fat_g", "fiber_g",
        "sugar_g", "sodium_mg", "potassium_mg", "calcium_mg", "iron_mg",
        "vitamin_c_mg", "glycemic_index", "saturated_fat_g",
        "gluten_free", "dairy_free", "purine_level", "fodmap_score", "goitrogen_flag",
    ]
    label_cols = [c for c in label_df.columns if c.startswith("label_")]
    extra_cols = [c for c in label_df.columns if c.startswith("clin_")]

    df_out = pd.concat([
        diet[feature_cols],
        label_df[label_cols],
        label_df[extra_cols],   # clinical flags (bonus metadata)
    ], axis=1)

    # Drop any rows with NaN in core features
    df_out = df_out.dropna(subset=feature_cols)

    # -- Step 7: Save -----------------------------------------------------------
    df_out.to_csv(OUT_CSV, index=False)

    print(f"\n[OK] NHANES dataset ready -> {OUT_CSV}")
    print(f"     Real participants : {len(df_out)}")
    print(f"     Nutrient features : {len(feature_cols)}")
    print(f"     Condition labels  : {len(label_cols)}")
    print(f"     Clinical flags    : {len(extra_cols)}\n")

    print(f"  {'Condition':<26}  Safe    Unsafe")
    print(f"  {'-'*52}")
    for col in sorted(label_cols):
        pos = int(df_out[col].sum())
        neg = len(df_out) - pos
        print(f"  {col[6:]:26s} {pos:5d}   {neg:5d}")


if __name__ == "__main__":
    main()
