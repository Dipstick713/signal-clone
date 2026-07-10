"""FastAPI application entrypoint.

Wires up CORS, creates database tables on startup, and mounts routers.
For a real deployment we'd use Alembic migrations; for this assignment
`Base.metadata.create_all` is sufficient and keeps setup to a single command.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup. Models are imported for their side effect of
    # registering with Base.metadata (none yet in Phase 1).
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    """Liveness probe used by deploy platforms and the frontend."""
    return {"status": "ok", "service": settings.app_name}
