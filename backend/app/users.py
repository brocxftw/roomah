from typing import Any

from fastapi import HTTPException, status

from app.auth import AuthContext
from app.supabase import get_service_supabase


def get_current_user_record(auth: AuthContext) -> dict[str, Any]:
    response = (
        get_service_supabase()
        .table("users")
        .select("*")
        .eq("auth_user_id", auth.auth_user_id)
        .single()
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user has not been synced",
        )

    return response.data


def require_manager(user: dict[str, Any]) -> None:
    if user.get("role") != "MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager role required",
        )
