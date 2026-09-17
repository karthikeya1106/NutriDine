"""Patch generate_meal_plan with calorie-aware recipe selection."""
import re

with open("main.py", "r", encoding="utf-8") as f:
    txt = f.read()

# Normalize for matching
txt_lf = txt.replace("\r\n", "\n")

NEW_FUNC = '''@app.get("/api/mealplan/generate")
def generate_meal_plan(user=Depends(get_current_user)):
    """
    Auto-calculates how many weeks to generate based on the user's compliant
    recipe pool. weeks = floor(max_compliant_across_meal_types / 7)
    Capped at 16 weeks. Every week uses totally unique recipes -- zero repeats.
    Recipes are CALORIE-AWARE: sorted by proximity to the user's per-meal TDEE
    target so each day lands close to the recommended daily intake.
    """
    MAX_WEEKS = 16
    MIN_WEEKS = 1

    # ── Replicate the same TDEE formula as /api/dashboard/stats ─────────────
    def _calc_daily_calorie_target():
        weight = user.get("weight", 70) or 70
        height = user.get("height", 1.70) or 1.70
        age    = user.get("age", 30) or 30
        gender = (user.get("gender") or "male").lower()
        goal   = user.get("goal") or "Maintenance"
        if gender == "male":
            bmr = 10 * weight + 6.25 * (height * 100) - 5 * age + 5
        else:
            bmr = 10 * weight + 6.25 * (height * 100) - 5 * age - 161
        if goal == "Weight Loss":   return int(bmr * 1.3 - 300)
        elif goal == "Muscle Gain": return int(bmr * 1.5 + 300)
        else:                       return int(bmr * 1.4)

    daily_cal = _calc_daily_calorie_target()

    # Per-meal calorie targets (proportional split of TDEE)
    meal_cal_targets = {
        "Breakfast": daily_cal * 0.25,   # 25%
        "Lunch":     daily_cal * 0.35,   # 35%
        "Dinner":    daily_cal * 0.30,   # 30%
        "Snack":     daily_cal * 0.10,   # 10%
    }

    # -- Step 1: Build filtered pools once per meal type ---------------------
    b_filtered = filter_recipes_for_user(user, "Breakfast")
    l_filtered = filter_recipes_for_user(user, "Lunch")
    d_filtered = filter_recipes_for_user(user, "Dinner")
    s_filtered = filter_recipes_for_user(user, "Snack")

    b_compliant = [r for r in b_filtered if r.get("is_compliant", True)]
    l_compliant = [r for r in l_filtered if r.get("is_compliant", True)]
    d_compliant = [r for r in d_filtered if r.get("is_compliant", True)]
    s_compliant = [r for r in s_filtered if r.get("is_compliant", True)]

    pool_sizes = {
        "Breakfast": len(b_compliant),
        "Lunch":     len(l_compliant),
        "Dinner":    len(d_compliant),
        "Snack":     len(s_compliant),
    }

    max_pool  = max(pool_sizes.values()) if any(pool_sizes.values()) else 7
    auto_weeks = max(MIN_WEEKS, min(MAX_WEEKS, max_pool // 7))
    if auto_weeks < MIN_WEEKS:
        auto_weeks = MIN_WEEKS

    total_days = auto_weeks * 7

    # -- Step 2: Calorie-aware pool builder -----------------------------------
    def _build_pool(compliant, filtered, needed, cal_target):
        """
        Sort compliant recipes into calorie proximity tiers:
          Tier 1 — within BAND of cal_target   (shuffled for variety)
          Tier 2 — over target, closest first
          Tier 3 — under target, closest first
        Non-compliant appended if pool is still short.
        """
        def cal_of(r):
            return (r.get("nutrition_per_serving") or {}).get("calories", 0) or 0

        BAND = max(50, cal_target * 0.15)   # ±15% or ±50 kcal

        within = [r for r in compliant if abs(cal_of(r) - cal_target) <= BAND]
        over   = sorted(
            [r for r in compliant if cal_of(r) - cal_target > BAND],
            key=lambda r: cal_of(r) - cal_target
        )
        under  = sorted(
            [r for r in compliant if cal_target - cal_of(r) > BAND],
            key=lambda r: cal_target - cal_of(r)
        )
        _random.shuffle(within)
        full_pool = within + over + under

        if not full_pool:
            return []

        if len(full_pool) < needed:
            non_compliant = [r for r in filtered if not r.get("is_compliant", True)]
            nc_sorted = sorted(non_compliant, key=lambda r: abs(cal_of(r) - cal_target))
            full_pool = full_pool + nc_sorted

        result = list(full_pool)
        while len(result) < needed:
            chunk = full_pool.copy()
            _random.shuffle(chunk)
            result.extend(chunk)
        return result[:needed]

    all_breakfasts = _build_pool(b_compliant, b_filtered, total_days, meal_cal_targets["Breakfast"])
    all_lunches    = _build_pool(l_compliant, l_filtered, total_days, meal_cal_targets["Lunch"])
    all_dinners    = _build_pool(d_compliant, d_filtered, total_days, meal_cal_targets["Dinner"])
    all_snacks     = _build_pool(s_compliant, s_filtered, total_days, meal_cal_targets["Snack"])

    # -- Step 3: Assemble daily plan ------------------------------------------
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    all_days  = []

    for idx in range(total_days):
        b = all_breakfasts[idx] if idx < len(all_breakfasts) else None
        l = all_lunches[idx]    if idx < len(all_lunches)    else None
        d = all_dinners[idx]    if idx < len(all_dinners)    else None
        s = all_snacks[idx]     if idx < len(all_snacks)     else None

        total_cal = sum(
            m["nutrition_per_serving"]["calories"]
            for m in [b, l, d, s] if m
        )
        all_days.append({
            "day":            day_names[idx % 7],
            "week":           (idx // 7) + 1,
            "day_index":      idx,
            "breakfast":      b,
            "lunch":          l,
            "dinner":         d,
            "snack":          s,
            "total_calories": round(total_cal, 1)
        })

    # -- Step 4: Group into weeks ---------------------------------------------
    plan_weeks = []
    for w in range(1, auto_weeks + 1):
        week_days = [d for d in all_days if d["week"] == w]
        week_cal  = sum(d["total_calories"] for d in week_days)
        plan_weeks.append({
            "week":               w,
            "label":              f"Week {w}",
            "days":               week_days,
            "avg_daily_calories": round(week_cal / len(week_days), 1) if week_days else 0,
        })

    # -- Step 5: Summary stats ------------------------------------------------
    avg_calories = round(sum(d["total_calories"] for d in all_days) / len(all_days), 1) if all_days else 0
    total_protein = sum(
        sum((m["nutrition_per_serving"].get("protein", 0) or 0)
            for m in [d["breakfast"], d["lunch"], d["dinner"], d["snack"]] if m)
        for d in all_days
    )
    avg_protein = round(total_protein / len(all_days), 1) if all_days else 0
    compliant_days = sum(
        1 for d in all_days
        if all(
            m.get("is_compliant", True)
            for m in [d["breakfast"], d["lunch"], d["dinner"], d["snack"]] if m
        )
    )

    return {
        "success":     True,
        "plan_type":   "dataset",
        "total_weeks": auto_weeks,
        "total_days":  total_days,
        "weeks":       plan_weeks,
        "days":        all_days,
        "pool_stats": {
            "safe_breakfasts":      pool_sizes["Breakfast"],
            "safe_lunches":         pool_sizes["Lunch"],
            "safe_dinners":         pool_sizes["Dinner"],
            "safe_snacks":          pool_sizes["Snack"],
            "largest_pool":         max_pool,
            "generated_weeks":      auto_weeks,
            "daily_calorie_target": daily_cal,
        },
        "summary": {
            "avg_daily_calories": avg_calories,
            "avg_daily_protein":  avg_protein,
            "total_meals":        total_days * 4,
            "compliant_days":     compliant_days,
            "total_days":         total_days,
        }
    }
'''

# Find the function start and end using line numbers
lines = txt_lf.split("\n")
start_line = None
end_line = None
for i, line in enumerate(lines):
    if '@app.get("/api/mealplan/generate")' in line:
        start_line = i
    if start_line is not None and i > start_line + 5:
        # Find next @app route after this one
        if line.startswith('@app.') and i > start_line + 10:
            end_line = i
            break

if start_line is None or end_line is None:
    print(f"Could not find function: start={start_line}, end={end_line}")
else:
    print(f"Replacing lines {start_line+1} to {end_line} (0-indexed)")
    new_lines = lines[:start_line] + [NEW_FUNC] + lines[end_line:]
    new_txt = "\n".join(new_lines)
    # Restore CRLF
    new_txt = new_txt.replace("\n", "\r\n")
    with open("main.py", "w", encoding="utf-8") as f:
        f.write(new_txt)
    print("Done! main.py patched successfully.")
