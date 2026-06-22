"""Verify chunks API returns correct data per-document."""
import httpx
api = 'http://127.0.0.1:8000/api/v1'
r = httpx.post(f'{api}/auth/login', json={'email':'test_fix@test.com','password':'TestPass123'}, timeout=10)
t = r.json()['access_token']
h = {'Authorization': f'Bearer {t}'}

# Get first project
r = httpx.get(f'{api}/projects', headers=h, timeout=10)
projects = r.json()['items']
if not projects:
    print('No projects found')
    exit(0)
pid = projects[0]['id']
print(f'Project: {pid}')

# Get documents
r = httpx.get(f'{api}/projects/{pid}/documents', headers=h, timeout=10)
docs = r.json()['items']
print(f'Documents: {len(docs)}')

# Get project detail for chunk count
r = httpx.get(f'{api}/projects/{pid}', headers=h, timeout=10)
prog = r.json().get('pipeline_progress', {})
print(f'Pipeline chunks: {prog.get("chunks", "?")}')

# Get project-wide chunks
r = httpx.get(f'{api}/projects/{pid}/chunks', headers=h, params={'page': 1, 'page_size': 5}, timeout=10)
cj = r.json()
print(f'Project-wide chunks: total={cj["pagination"]["total_items"]}')

# Get per-document chunks
for d in docs:
    did = d['id']
    r = httpx.get(f'{api}/projects/{pid}/chunks', headers=h, params={'document_id': did, 'page': 1, 'page_size': 5}, timeout=10)
    if r.status_code == 200:
        cj = r.json()
        print(f'  Doc "{d["filename"]}": {cj["pagination"]["total_items"]} chunks')
    else:
        print(f'  Doc "{d["filename"]}": ERROR {r.status_code} {r.text[:100]}')
