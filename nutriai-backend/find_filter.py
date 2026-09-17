import sys
sys.stdout.reconfigure(encoding='utf-8')

with open("main.py", "rb") as f:
    raw = f.read()

lines = raw.split(b"\r\r\n")

# Print lines around the Asian filter (line 773-779 in our earlier count)
# Show what we need to replace
for i, line in enumerate(lines[717:840], 718):
    decoded = line.decode("utf-8", errors="replace")
    if any(kw in decoded for kw in ["Asian", "Western", "Indian", "Mediterranean",
                                     "South Asian", "International", "cuisine_pref ==",
                                     "CUISINE_KEYWORDS", "all_cuisines"]):
        print(f"{i}: {decoded}")
