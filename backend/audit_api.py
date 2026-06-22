"""Phase 2: API Consistency Audit — compare API responses against DB counts."""
import sys; sys.path.insert(0, '.')
import httpx

API = 'http://127.0.0.1:8000/api/v1'

# Login
r = httpx.post(f'{API}/auth/login',
    json={'email': 'test_fix@test.com', 'password': 'TestPass123'}, timeout=10)
if r.status_code != 200:
    r = httpx.post(f'{API}/auth/register',
        json={'username': 'audit_user', 'email': 'audit@test.com', 'password': 'TestPass123'}, timeout=10)
    r = httpx.post(f'{API}/auth/login',
        json={'email': 'audit@test.com', 'password': 'TestPass123'}, timeout=10)

token = r.json()['access_token']
h = {'Authorization': f'Bearer {token}'}

# Get all projects
r = httpx.get(f'{API}/projects', headers=h, timeout=10)
projects = r.json()['items']
print(f'Projects in API: {len(projects)}')

for p in projects:
    pid = p['id']
    print(f'\n=== Project: {p["name"]} ({pid[:8]}...) ===')

    # Project detail (has pipeline_progress.chunks)
    r = httpx.get(f'{API}/projects/{pid}', headers=h, timeout=10)
    if r.status_code == 200:
        pp = r.json().get('pipeline_progress', {})
        print(f'  pipeline_progress.chunks: {pp.get("chunks", "?")}')
    else:
        print(f'  GET /projects/{{id}}: {r.status_code} {r.text[:100]}')

    # Documents list
    r = httpx.get(f'{API}/projects/{pid}/documents', headers=h, params={'page': 1, 'page_size': 50}, timeout=10)
    if r.status_code == 200:
        docs = r.json()
        doc_total = docs['pagination']['total_items']
        print(f'  Documents API: total={doc_total}, returned={len(docs["items"])}')
        for d in docs['items']:
            did = d['id']
            # Chunks per document
            rc = httpx.get(f'{API}/projects/{pid}/chunks', headers=h,
                params={'document_id': did, 'page': 1, 'page_size': 10}, timeout=10)
            if rc.status_code == 200:
                cj = rc.json()
                print(f'    {d["filename"]}: {cj["pagination"]["total_items"]} chunks')
    else:
        print(f'  GET /documents: {r.status_code} {r.text[:100]}')

    # Project-wide chunks
    r = httpx.get(f'{API}/projects/{pid}/chunks', headers=h,
        params={'page': 1, 'page_size': 10}, timeout=10)
    if r.status_code == 200:
        cj = r.json()
        print(f'  Total chunks (API): {cj["pagination"]["total_items"]}')
