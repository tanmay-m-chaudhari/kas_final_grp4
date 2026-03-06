from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.api.routes.documents import router as documents_router
from app.core.config import get_settings
from app.core.redis_client import close_redis

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_redis()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.include_router(documents_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": settings.app_name}
