import httpx
base = 'http://127.0.0.1:8000/api/v1/auth'
api = 'http://127.0.0.1:8000/api/v1'
r = httpx.post(f'{base}/login', json={'email':'test_fix@test.com','password':'TestPass123'}, timeout=10)
t = r.json()['access_token']
h = {'Authorization': f'Bearer {t}'}
r = httpx.get(f'{api}/projects', headers=h, timeout=10)
pid = r.json()['items'][0]['id'] if r.json()['items'] else None
if pid:
    for path in [f'/projects/{pid}/documents', f'/projects/{pid}/chunks', f'/projects/{pid}/ga-pairs']:
        r = httpx.get(f'{api}{path}', headers=h, timeout=10)
        print(f'GET {path}: {r.status_code}', 'OK' if r.status_code == 200 else f'FAIL: {r.text[:100]}')
