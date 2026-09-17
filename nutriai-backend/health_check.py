import ml_engine

clf = None
for name in dir(ml_engine):
    obj = getattr(ml_engine, name)
    if isinstance(obj, type) and 'classifier' in name.lower():
        clf = obj()
        break

print('=== NutriAI Engine Health Check ===')
print(f'Model type  : {clf._model_type}')
print(f'Conditions  : {len(clf.conditions)}')
print()

sample = {
    'calories_kcal': 480, 'protein_g': 28, 'carbs_g': 52, 'fat_g': 14,
    'fiber_g': 8, 'sugar_g': 6, 'sodium_mg': 380, 'potassium_mg': 620,
    'calcium_mg': 180, 'iron_mg': 4.5, 'vitamin_c_mg': 22,
    'glycemic_index': 48, 'saturated_fat_g': 4, 'gluten_free': 1,
    'dairy_free': 0, 'purine_level': 0, 'fodmap_score': 0, 'goitrogen_flag': 0
}

results = {cond: clf.predict(sample, cond) for cond in clf.conditions}


safe_count = sum(1 for r in results.values() if r['safe'])
print(f'Sample meal (480kcal, 52g carb, 8g fiber, 380mg sodium, 14g fat):')
print(f'  Safe for {safe_count}/{len(results)} conditions')
print()
print(f'  {"Condition":<26}  Safe    Confidence')
print(f'  {"-"*52}')
for cond, r in results.items():
    icon = '[OK]  ' if r['safe'] else '[WARN]'
    conf = r.get('confidence', 0)
    print(f'  {icon} {cond:<24}  {"YES" if r["safe"] else "NO ":<5}  {conf:.1f}%')

