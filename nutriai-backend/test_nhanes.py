import requests, io, pandas as pd

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'}

# Try multiple potential URL patterns
urls_to_try = [
    'https://wwwn.cdc.gov/Nchs/Nhanes/2017-2018/DR1TOT_J.XPT',
    'https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/DR1TOT_J.XPT',
    'https://ftp.cdc.gov/pub/health_statistics/nchs/nhanes/2017-2018/DR1TOT_J.XPT',
    'https://www.cdc.gov/nchs/nhanes/2017-2018/DR1TOT_J.XPT',
]

session = requests.Session()
session.headers.update(headers)

# First visit root page to pick up session cookies
try:
    session.get('https://wwwn.cdc.gov/Nchs/Nhanes/', timeout=15)
    print('Session cookie picked up')
except:
    pass

for url in urls_to_try:
    try:
        r = session.get(url, timeout=60, allow_redirects=True)
        ct = r.headers.get('content-type','')
        print(f'\n{url}')
        print(f'  -> {r.status_code} | {ct} | {len(r.content)//1024} KB')
        if 'html' not in ct.lower() and len(r.content) > 50000:
            print('  -> Looks like binary data! Trying to parse...')
            df = pd.read_sas(io.BytesIO(r.content), format='xport')
            print(f'  -> SUCCESS: {len(df)} rows, {len(df.columns)} cols')
            print(f'  -> Sample cols: {list(df.columns[:8])}')
            break
        else:
            print(f'  -> HTML response (not XPT)')
    except Exception as e:
        print(f'  -> ERROR: {e}')
