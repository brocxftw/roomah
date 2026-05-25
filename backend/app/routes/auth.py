from fastapi import APIRouter, Depends, Request

from app.auth import AuthContext, get_auth_context
from app.supabase import get_service_supabase

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/sync-user")
def sync_user(
    request: Request,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, object]:
    email = (
        auth.claims.get("email")
        or auth.claims.get("email_address")
        or auth.claims.get("primary_email_address")
        or ""
    )
    supabase = get_service_supabase()
    response = (
        supabase.table("users")
        .upsert(
            {
                "auth_user_id": auth.auth_user_id,
                "team_id": auth.team_id,
                "email": str(email),
                "role": auth.role,
            },
            on_conflict="auth_user_id",
        )
        .execute()
    )

    return {
        "user": response.data[0] if response.data else None,
        "request_id": request.headers.get("x-request-id"),
    }
