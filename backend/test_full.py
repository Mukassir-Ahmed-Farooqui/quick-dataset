import httpx, sys

base = 'http://127.0.0.1:8000/api/v1'
auth_base = f'{base}/auth'

# Login
r = httpx.post(f'{auth_base}/login', json={'email':'test_fix@test.com','password':'TestPass123'}, timeout=10)
if r.status_code != 200:
    r = httpx.post(f'{auth_base}/register', json={'username':'test_fix','email':'test_fix@test.com','password':'TestPass123'}, timeout=10)
    r = httpx.post(f'{auth_base}/login', json={'email':'test_fix@test.com','password':'TestPass123'}, timeout=10)

t = r.json()['access_token']
h = {'Authorization': f'Bearer {t}'}

# Test endpoints
for path in ['/projects', '/providers']:
    r = httpx.get(f'{base}{path}', headers=h, timeout=10)
    print(f'GET {path}: {r.status_code}')
    if r.status_code == 200:
        j = r.json()
        print(f'  keys: {list(j.keys())}')
        if 'pagination' in j:
            p = j['pagination']
            print(f'  pagination: page={p["page"]} total={p["total_items"]} pages={p["total_pages"]}')
        if 'items' in j:
            print(f'  items count: {len(j["items"])}')
    else:
        print(f'  ERROR: {r.text[:200]}')
