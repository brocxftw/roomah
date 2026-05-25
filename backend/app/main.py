import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import SupabaseAuthMiddleware
from app.core.config import get_settings
from app.routes.auth import router as auth_router
from app.routes.dashboard import router as dashboard_router
from app.routes.deals import router as deals_router
from app.routes.leads import router as leads_router
from app.routes.manager import router as manager_router
from app.routes.properties import router as properties_router
from app.routes.viewings import router as viewings_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(title="ROOMAH API", version="0.1.0")
settings = get_settings()

app.add_middleware(SupabaseAuthMiddleware, settings=settings)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(deals_router)
app.include_router(leads_router)
app.include_router(manager_router)
app.include_router(properties_router)
app.include_router(viewings_router)


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
