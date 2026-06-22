import sys; sys.path.insert(0,'.')
import httpx

auth_base = 'http://127.0.0.1:8000/api/v1/auth'
api_base = 'http://127.0.0.1:8000/api/v1'

# Register a test user
r = httpx.post(f'{auth_base}/register', json={
    'username':'pagtest3','email':'pagtest3@test.com','password':'TestPass123'
}, timeout=10)
print(f'Register: {r.status_code}')
# Login to get token
r = httpx.post(f'{auth_base}/login', json={
    'email':'pagtest3@test.com','password':'TestPass123'
}, timeout=10)
print(f'Login: {r.status_code}')
token = r.json()['access_token']

headers = {'Authorization': f'Bearer {token}'}

# Test projects
r = httpx.get(f'{api_base}/projects', headers=headers, timeout=10)
print(f'\nGET /projects => {r.status_code}')
if r.status_code == 200:
    data = r.json()
    print(f'  keys: {list(data.keys())}')
    print(f'  items count: {len(data.get("items", []))}')
    print(f'  pagination: {data.get("pagination", "MISSING!")}')
    if 'pagination' in data:
        p = data['pagination']
        print(f'  total_items={p["total_items"]}, total_pages={p["total_pages"]}')
else:
    print(f'  body: {r.text[:600]}')

# Test providers
r = httpx.get(f'{api_base}/providers', headers=headers, timeout=10)
print(f'\nGET /providers => {r.status_code}')
if r.status_code == 200:
    data = r.json()
    print(f'  keys: {list(data.keys())}')
    print(f'  items count: {len(data.get("items", []))}')
    print(f'  pagination: {data.get("pagination", "MISSING!")}')
else:
    print(f'  body: {r.text[:600]}')
