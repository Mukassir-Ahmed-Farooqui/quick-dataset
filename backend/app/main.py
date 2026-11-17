from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.api import auth, providers, projects, documents, chunks, tasks, ga_pairs, questions, prompts, search, dataset_items, exports

from app.services.llm.http_client import close_http_clients


def _ensure_schema() -> None:
    """Add user_llm_keys.selected_model if the DB predates the model picker,
    so a forgotten `alembic upgrade head` can't take the Providers page down."""
    import logging
    from sqlalchemy import inspect, text
    from app.core.database import engine

    log = logging.getLogger(__name__)
    try:
        insp = inspect(engine)
        if "user_llm_keys" not in insp.get_table_names():
            return
        cols = {c["name"] for c in insp.get_columns("user_llm_keys")}
        if "selected_model" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE user_llm_keys ADD COLUMN selected_model VARCHAR(255)"))
            log.warning("Added missing column user_llm_keys.selected_model; run `alembic upgrade head` to sync.")
    except Exception as exc:  # never block startup on this
        log.error("Schema check failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _ensure_schema()
    yield
    # Close the pooled httpx clients shared by the LLM providers.
    await close_http_clients()


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(providers.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(chunks.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(ga_pairs.router, prefix="/api/v1")
app.include_router(questions.router, prefix="/api/v1")
app.include_router(prompts.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(dataset_items.router, prefix="/api/v1")
app.include_router(exports.router, prefix="/api/v1")

@app.get("/")
def root():
    return {
        "name": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "health": "/health",
        "api": "/api/v1",
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}
