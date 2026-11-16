"""Shared pytest setup.

- Make the ``app`` package importable when tests are run from the repo root
  (``python -m pytest backend/tests``).
- Provide safe test settings before ``app`` is imported: a valid Fernet key
  (``app.core.crypto`` builds its cipher at import time) and an in-memory
  database URL, so tests never need a real .env or Postgres.
"""
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

os.environ.setdefault("ENCRYPTION_SECRET_KEY", "dGVzdC1rZXktdGVzdC1rZXktdGVzdC1rZXktMTIzNDU=")
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret")

# app.core.crypto builds a Fernet cipher at import time; give tests a valid key.
os.environ.setdefault("ENCRYPTION_SECRET_KEY", "x2bJ0b4yJm0jzKxL0hV6m3c3pS0n9uQ2YkqB0V8t3aE=")
