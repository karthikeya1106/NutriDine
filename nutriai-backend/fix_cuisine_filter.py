"""
Add International fallback padding for cuisines with small pools (e.g. Asian).
When the compliant pool for a meal type is very small, we pad it with
International/American recipes so the plan can still generate meaningful weeks.
"""

with open("main.py", "rb") as f:
    raw = f.read()

OLD = (
    b'    b_filtered = filter_recipes_for_user(user, "Breakfast")\r\r\n'
    b'    l_filtered = filter_recipes_for_user(user, "Lunch")\r\r\n'
    b'    d_filtered = filter_recipes_for_user(user, "Dinner")\r\r\n'
    b'    s_filtered = filter_recipes_for_user(user, "Snack")\r\r\n'
    b'\r\r\n'
    b'    b_compliant = [r for r in b_filtered if r.get("is_compliant", True)]\r\r\n'
    b'    l_compliant = [r for r in l_filtered if r.get("is_compliant", True)]\r\r\n'
    b'    d_compliant = [r for r in d_filtered if r.get("is_compliant", True)]\r\r\n'
    b'    s_compliant = [r for r in s_filtered if r.get("is_compliant", True)]\r\r\n'
    b'\r\r\n'
    b'    pool_sizes = {\r\r\n'
    b'        "Breakfast": len(b_compliant),\r\r\n'
    b'        "Lunch":     len(l_compliant),\r\r\n'
    b'        "Dinner":    len(d_compliant),\r\r\n'
    b'        "Snack":     len(s_compliant),\r\r\n'
    b'    }\r\r\n'
)

NEW = (
    b'    b_filtered = filter_recipes_for_user(user, "Breakfast")\r\r\n'
    b'    l_filtered = filter_recipes_for_user(user, "Lunch")\r\r\n'
    b'    d_filtered = filter_recipes_for_user(user, "Dinner")\r\r\n'
    b'    s_filtered = filter_recipes_for_user(user, "Snack")\r\r\n'
    b'\r\r\n'
    b'    # -- Small-pool fallback: pad with International recipes when cuisine has few options --\r\r\n'
    b'    # e.g. "Asian" only has ~26 total recipes in DB; without this the plan is nearly empty.\r\r\n'
    b'    FALLBACK_THRESHOLD = 14  # if any meal type pool < this, pad from International\r\r\n'
    b'    def _pad_with_international(primary_pool, meal_type_str):\r\r\n'
    b'        if len(primary_pool) >= FALLBACK_THRESHOLD:\r\r\n'
    b'            return primary_pool  # big enough, no padding needed\r\r\n'
    b'        intl = filter_recipes_for_user(user, meal_type_str, all_cuisines=True)\r\r\n'
    b'        existing_ids = {r["id"] for r in primary_pool}\r\r\n'
    b'        extras = [r for r in intl if r["id"] not in existing_ids]\r\r\n'
    b'        return primary_pool + extras\r\r\n'
    b'\r\r\n'
    b'    b_filtered = _pad_with_international(b_filtered, "Breakfast")\r\r\n'
    b'    l_filtered = _pad_with_international(l_filtered, "Lunch")\r\r\n'
    b'    d_filtered = _pad_with_international(d_filtered, "Dinner")\r\r\n'
    b'    s_filtered = _pad_with_international(s_filtered, "Snack")\r\r\n'
    b'\r\r\n'
    b'    b_compliant = [r for r in b_filtered if r.get("is_compliant", True)]\r\r\n'
    b'    l_compliant = [r for r in l_filtered if r.get("is_compliant", True)]\r\r\n'
    b'    d_compliant = [r for r in d_filtered if r.get("is_compliant", True)]\r\r\n'
    b'    s_compliant = [r for r in s_filtered if r.get("is_compliant", True)]\r\r\n'
    b'\r\r\n'
    b'    pool_sizes = {\r\r\n'
    b'        "Breakfast": len(b_compliant),\r\r\n'
    b'        "Lunch":     len(l_compliant),\r\r\n'
    b'        "Dinner":    len(d_compliant),\r\r\n'
    b'        "Snack":     len(s_compliant),\r\r\n'
    b'    }\r\r\n'
)

if OLD in raw:
    new_raw = raw.replace(OLD, NEW, 1)
    with open("main.py", "wb") as f:
        f.write(new_raw)
    print("SUCCESS: international fallback added")
else:
    print("ERROR: block not found. Showing raw bytes at target area...")
    lines = raw.split(b"\r\r\n")
    for i, line in enumerate(lines[1289:1308], 1290):
        print(repr(line))
