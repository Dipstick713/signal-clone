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
from app.routers import auth, conversations, users, ws

# Import models so they register with Base.metadata before create_all.
import app.models  # noqa: F401,E402


@asynccontextmanager
async def lifespan(app: FastAPI):
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

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(conversations.router)
app.include_router(ws.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    """Liveness probe used by deploy platforms and the frontend."""
    return {"status": "ok", "service": settings.app_name}
