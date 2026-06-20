from fastapi import FastAPI
from app.core.config import settings
from app.api import auth, providers, projects, documents, chunks

app = FastAPI(title=settings.PROJECT_NAME)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(providers.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(chunks.router, prefix="/api/v1")

@app.get("/health")
def health_check():
    return {"status": "ok"}
