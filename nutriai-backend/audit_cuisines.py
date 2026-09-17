import sys, json
sys.stdout.reconfigure(encoding='utf-8')

with open("data/recipes.json", "rb") as f:
    try:
        recipes = json.load(f)
    except:
        # might be jsonl
        f.seek(0)
        content = f.read().decode("utf-8", errors="replace")
        recipes = [json.loads(l) for l in content.splitlines() if l.strip()]

# Get unique cuisine values
cuisines = sorted(set(r.get("cuisine", "Unknown") for r in recipes))
print(f"Total recipes: {len(recipes)}")
print(f"\nUnique cuisine values ({len(cuisines)}):")
for c in cuisines:
    count = sum(1 for r in recipes if r.get("cuisine") == c)
    print(f"  {count:4d}  {c}")
