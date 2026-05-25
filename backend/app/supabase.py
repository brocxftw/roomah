from functools import lru_cache

from fastapi import HTTPException, status
from supabase import Client, create_client

from app.core.config import get_settings


def _require_supabase_url() -> str:
    settings = get_settings()
    if settings.supabase_url is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase URL is not configured",
        )

    return str(settings.supabase_url)


@lru_cache
def get_service_supabase() -> Client:
    settings = get_settings()
    if not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase service role key is not configured",
        )

    return create_client(_require_supabase_url(), settings.supabase_service_role_key)


def get_user_supabase(access_token: str) -> Client:
    settings = get_settings()
    if not settings.supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase anon key is not configured",
        )

    client = create_client(_require_supabase_url(), settings.supabase_anon_key)
    client.postgrest.auth(access_token)
    return client
