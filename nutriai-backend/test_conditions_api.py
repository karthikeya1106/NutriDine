import requests, json
r = requests.get('http://localhost:8000/api/conditions')
print(f"Status: {r.status_code}")
print(json.dumps(r.json(), indent=2)[:500])
