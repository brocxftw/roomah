from fastapi import APIRouter, Depends, Request

from app.auth import AuthContext, get_auth_context
from app.supabase import get_service_supabase

router = APIRouter(prefix="/auth", tags=["auth"])


def _derive_full_name(claims: dict[str, object], email: str) -> str:
    metadata = claims.get("user_metadata")
    if isinstance(metadata, dict):
        for key in ("full_name", "name"):
            value = metadata.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    local_part = email.split("@", 1)[0] if email else ""
    return local_part or "User"


@router.post("/sync-user")
def sync_user(
    request: Request,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, object]:
    email = str(
        auth.claims.get("email")
        or auth.claims.get("email_address")
        or auth.claims.get("primary_email_address")
        or ""
    )
    supabase = get_service_supabase()
    existing = (
        supabase.table("users")
        .select("*")
        .eq("auth_user_id", auth.auth_user_id)
        .maybe_single()
        .execute()
        .data
    )

    if existing is None:
        full_name = _derive_full_name(auth.claims, email)
        response = (
            supabase.table("users")
            .insert(
                {
                    "auth_user_id": auth.auth_user_id,
                    "team_id": auth.team_id,
                    "email": email,
                    "role": auth.role,
                    "full_name": full_name,
                    "active_status": True,
                }
            )
            .execute()
        )
        user = response.data[0] if response.data else None
    else:
        update_payload: dict[str, object] = {}
        if email and existing.get("email") != email:
            update_payload["email"] = email
        if existing.get("team_id") != auth.team_id:
            update_payload["team_id"] = auth.team_id
        if existing.get("role") != auth.role:
            update_payload["role"] = auth.role

        if update_payload:
            response = (
                supabase.table("users")
                .update(update_payload)
                .eq("auth_user_id", auth.auth_user_id)
                .execute()
            )
            user = response.data[0] if response.data else existing
        else:
            user = existing

    return {
        "user": user,
        "request_id": request.headers.get("x-request-id"),
    }
