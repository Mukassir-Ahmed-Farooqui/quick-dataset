import httpx, sys

BASE = 'http://127.0.0.1:8000/api/v1'
AUTH = f'{BASE}/auth'

# Login (user created earlier)
r = httpx.post(f'{AUTH}/login', json={
    'email': 'test_fix@test.com', 'password': 'TestPass123'
}, timeout=10)
if r.status_code != 200:
    r = httpx.post(f'{AUTH}/register', json={
        'username': 'test_fix2', 'email': 'test_fix2@test.com', 'password': 'TestPass123'
    }, timeout=10)
    r = httpx.post(f'{AUTH}/login', json={
        'email': 'test_fix2@test.com', 'password': 'TestPass123'
    }, timeout=10)

token = r.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# Create a project first
r = httpx.post(f'{BASE}/projects', headers=headers,
    json={'name': 'Test Project', 'description': 'For testing'}, timeout=10)
print(f'POST /projects: {r.status_code}')
if r.status_code == 201:
    project_id = r.json()['id']
    print(f'  Created project: {project_id}')
else:
    project_id = None

# Test projects list
r = httpx.get(f'{BASE}/projects', headers=headers, timeout=10)
print(f'\nGET /projects: {r.status_code}')
if r.status_code == 200:
    j = r.json()
    print(f'  keys: {list(j.keys())}')
    print(f'  items count: {len(j["items"])}')
    if j['items']:
        item = j['items'][0]
        print(f'  item keys: {list(item.keys())}')
        print(f'  has document_count: {"document_count" in item}')
        print(f'  has question_count: {"question_count" in item}')
        print(f'  has dataset_item_count: {"dataset_item_count" in item}')
        print(f'  has last_activity_at: {"last_activity_at" in item}')
        print(f'  has default_llm_key: {"default_llm_key" in item}')
else:
    print(f'  ERROR: {r.text[:300]}')

# Test providers list
r = httpx.get(f'{BASE}/providers', headers=headers, timeout=10)
print(f'\nGET /providers: {r.status_code}')
if r.status_code == 200:
    j = r.json()
    print(f'  keys: {list(j.keys())}')
    print(f'  items count: {len(j["items"])}')
    if j['items']:
        item = j['items'][0]
        print(f'  has masked_key: {"masked_key" in item}')
        print(f'  masked_key example: {item["masked_key"]}')
else:
    print(f'  ERROR: {r.text[:300]}')

# Test project detail (only if created)
if project_id:
    r = httpx.get(f'{BASE}/projects/{project_id}', headers=headers, timeout=10)
    print(f'\nGET /projects/{{id}}: {r.status_code}')
    if r.status_code == 200:
        j = r.json()
        print(f'  has pipeline_progress: {"pipeline_progress" in j}')
        if 'pipeline_progress' in j:
            pp = j['pipeline_progress']
            print(f'  documents={pp["documents"]} chunks={pp["chunks"]}')

print('\n=== ALL CHECKS PASSED ===')
