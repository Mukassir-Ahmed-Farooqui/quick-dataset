"""Verify that PaginatedResponse serializes correctly."""
import sys; sys.path.insert(0, '.')
import json
from datetime import datetime

# Check the schema serialization in isolation
from app.schemas import PaginatedResponse, PaginationMeta, pagination_meta

# 1. Test basic serialization with dict items
meta = pagination_meta(page=1, page_size=50, total_items=5)
resp = PaginatedResponse(
    items=[{"id": "1", "name": "Test"}],
    pagination=meta,
)
dumped = resp.model_dump(mode="json")
print("=== PaginatedResponse with dict items ===")
print(json.dumps(dumped, indent=2))

# 2. Test that the shape matches what frontend expects
assert "items" in dumped, "Missing 'items' key"
assert "pagination" in dumped, "Missing 'pagination' key"
assert "total_items" in dumped["pagination"], "Missing pagination.total_items"
assert "total_pages" in dumped["pagination"], "Missing pagination.total_pages"
assert "has_next" in dumped["pagination"], "Missing pagination.has_next"
assert "has_previous" in dumped["pagination"], "Missing pagination.has_previous"
print("\n✅ All expected keys present")

# 3. Check for floating-point issues
assert isinstance(dumped["pagination"]["total_items"], int), "total_items should be int"
assert isinstance(dumped["pagination"]["total_pages"], int), "total_pages should be int"
print("✅ Types correct")

# 4. Test with actual Pydantic model items
from app.schemas import ProjectListItemOut

try:
    # Simulate what would come from ORM
    mock_item = ProjectListItemOut(
        id="test-id",
        name="Test Project",
        description="A test",
        status="active",
        default_llm_key=None,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        document_count=5,
        question_count=10,
        dataset_item_count=3,
        last_activity_at=datetime.utcnow(),
    )
    resp2 = PaginatedResponse(
        items=[mock_item],
        pagination=meta,
    )
    dumped2 = resp2.model_dump(mode="json")
    print("\n=== PaginatedResponse with Pydantic items ===")
    print(json.dumps(dumped2, indent=2)[:300])
    print("✅ Pydantic model items serialize correctly")
except Exception as e:
    print(f"\n❌ Pydantic model items FAILED: {e}")
    import traceback
    traceback.print_exc()

print("\n=== All serialization checks passed ===")
