import sys
sys.path.insert(0, '.')

# Step 1: Check parsed text size
md_path = r'storage/58431c57-c3ef-438c-940c-cdf65d6a400d/ES_LAB_REPORT (1).pdf.md'
with open(md_path, 'r', encoding='utf-8') as f:
    text = f.read()

print("=== STEP 1: Parsed text ===")
print(f"Characters : {len(text):,}")
print(f"Words      : {len(text.split()):,}")
print(f"Lines      : {text.count(chr(10)):,}")
print(f"First 300 chars:")
print(text[:300])
print()

# Step 2: Chunk with size=500 (UI default)
from app.services.chunking import chunk_document, preview_chunks

chunks_500 = chunk_document(text, strategy='recursive', chunk_size=500, chunk_overlap=100)
print("=== STEP 2: chunk_size=500, overlap=100 (UI default) ===")
print(f"Total chunks generated: {len(chunks_500)}")
if chunks_500:
    lengths = [len(c['content']) for c in chunks_500]
    print(f"Avg chunk length : {sum(lengths)//len(lengths)} chars")
    print(f"Min / Max        : {min(lengths)} / {max(lengths)} chars")
print()

# Step 3: Chunk with size=1000 (backend schema default)
chunks_1000 = chunk_document(text, strategy='recursive', chunk_size=1000, chunk_overlap=100)
print("=== STEP 3: chunk_size=1000, overlap=100 (backend default) ===")
print(f"Total chunks generated: {len(chunks_1000)}")
print()

# Step 4: Preview
preview = preview_chunks(text, strategy='recursive', chunk_size=500, chunk_overlap=100)
print("=== STEP 4: Preview endpoint result ===")
print(f"estimated_total_chunks : {preview['estimated_total_chunks']}")
print(f"sample_chunks returned : {len(preview['sample_chunks'])}")
print()

# Step 5: Check the task total_count bug
print("=== STEP 5: Task total_count analysis ===")
print("In generate_chunks(), task is created with:")
print("  total_count = len(data.document_ids)  <-- COUNTS DOCUMENTS, NOT CHUNKS")
print("And complete_task() is called with:")
print("  completed_count = total_created        <-- actual chunk count")
print("So task.total_count will ALWAYS equal number of documents (e.g. 1)")
print("But task.completed_count will equal actual chunks generated.")
print()

# Step 6: Check the frontend's chunk list call
print("=== STEP 6: Frontend pagination analysis ===")
print("chunksApi.list() calls: /chunks?page=1&page_size=20")
print("Backend list_chunks() response includes:")
print("  items: [first 20 chunks]")
print("  total: <real total from DB>")
print("Frontend useChunks() calls with default page=1, no document_id filter")
print("ChunksPage renders: chunks.length (which is items.length = 20 max)")
print("But shows total from: chunksData?.total  -- NOT displayed anywhere!")
print("UI ONLY shows: '{chunks.length} chunks' = 20, never the real total")
print()

print("=== ROOT CAUSES IDENTIFIED ===")
print("1. PARSING: PDF parser likely lost text (21.5KB md from 3113KB pdf = 99.3% loss)")
print("2. TASK COUNT: task.total_count = num_documents (1), not num_chunks")
print("3. FRONTEND: ChunksPage shows chunks.length (page items) not chunksData.total")
print("4. NO DOCUMENT FILTER: useChunks has no documentId, shows ALL project chunks mixed")
