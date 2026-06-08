import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.auth import SupabaseAuthMiddleware
from app.core.config import Settings, get_settings
from app.routes.auth import router as auth_router
from app.routes.campaign_content_templates import router as campaign_templates_router
from app.routes.campaigns import router as campaigns_router
from app.routes.dashboard import router as dashboard_router
from app.routes.deals import router as deals_router
from app.routes.leads import router as leads_router
from app.routes.manager import router as manager_router
from app.routes.properties import router as properties_router
from app.routes.users import router as users_router
from app.routes.viewings import router as viewings_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

logger = logging.getLogger(__name__)

app = FastAPI(title="ROOMAH API", version="0.1.0")
settings = get_settings()


def _split_origins(value: str) -> list[str]:
    return [origin.strip() for origin in value.split(",") if origin.strip()]


def _cors_kwargs(settings: Settings) -> dict[str, object]:
    frontend_origins = _split_origins(settings.frontend_origin)
    # Common local development origins to avoid CORS errors when the dev server
    # binds to 127.0.0.1 or an alternative port. Production should rely on the
    # explicit value of FRONTEND_ORIGIN.
    local_dev_origins = {
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    }
    frontend_origin_regex = settings.frontend_origin_regex
    if frontend_origin_regex is not None:
        frontend_origin_regex = frontend_origin_regex.strip() or None
    return {
        "allow_origins": sorted(set(frontend_origins) | local_dev_origins),
        "allow_origin_regex": frontend_origin_regex,
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }


app.add_middleware(SupabaseAuthMiddleware, settings=settings)
app.add_middleware(
    CORSMiddleware,
    **_cors_kwargs(settings),
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Convert unhandled exceptions into JSON responses.

    This runs inside FastAPI's exception middleware, so the resulting
    response is still wrapped by CORSMiddleware on the way out. Without
    this handler, Starlette's outermost ServerErrorMiddleware would build
    the 500 response above CORS, dropping ``Access-Control-Allow-Origin``
    and surfacing as a CORS error in the browser instead of the real
    server-side failure.
    """
    logger.exception(
        "Unhandled exception while processing %s %s",
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


app.include_router(auth_router)
app.include_router(campaign_templates_router)
app.include_router(campaigns_router)
app.include_router(dashboard_router)
app.include_router(deals_router)
app.include_router(leads_router)
app.include_router(manager_router)
app.include_router(properties_router)
app.include_router(users_router)
app.include_router(viewings_router)


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
