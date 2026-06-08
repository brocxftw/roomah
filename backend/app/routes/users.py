from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.auth import AuthContext, get_auth_context
from app.models import UserRole
from app.supabase import get_service_supabase
from app.users import get_current_user_record, require_manager

router = APIRouter(prefix="/users", tags=["users"])

AVATAR_BUCKET = "avatars"
AVATAR_MIME_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


class AvatarUploadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content_type: str


class UserSelfUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, min_length=1)
    phone_number: str | None = None
    avatar_url: str | None = None
    active_status: bool | None = None
    role: UserRole | None = None
    team_id: UUID | None = None
    email: EmailStr | None = None
    commission_rate: Decimal | None = Field(default=None, ge=0)
    monthly_target_amount: Decimal | None = Field(default=None, ge=0)
    notification_preferences: dict[str, Any] | None = None
    session_timeout_minutes: int | None = Field(default=None, ge=0)


class UserAdminUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, min_length=1)
    phone_number: str | None = None
    active_status: bool | None = None
    commission_rate: Decimal | None = Field(default=None, ge=0)
    monthly_target_amount: Decimal | None = Field(default=None, ge=0)


def _user_query(auth: AuthContext):
    return get_service_supabase().table("users").select("*").eq("team_id", auth.team_id)


def _get_team_user(auth: AuthContext, user_id: UUID) -> dict[str, Any]:
    response = _user_query(auth).eq("id", str(user_id)).maybe_single().execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return response.data


@router.get("/me")
def get_me(auth: AuthContext = Depends(get_auth_context)) -> dict[str, Any]:
    return get_current_user_record(auth)


@router.patch("/me")
def update_me(
    payload: UserSelfUpdate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    forbidden_fields = {
        "active_status",
        "role",
        "team_id",
        "email",
    }
    requested_forbidden_fields = forbidden_fields.intersection(payload.model_fields_set)
    if requested_forbidden_fields:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Cannot update restricted field(s): "
                f"{', '.join(sorted(requested_forbidden_fields))}"
            ),
        )

    update_payload = payload.model_dump(
        include={
            "full_name",
            "phone_number",
            "avatar_url",
            "commission_rate",
            "monthly_target_amount",
            "notification_preferences",
            "session_timeout_minutes",
        },
        exclude_unset=True,
        mode="json",
    )
    if not update_payload:
        return get_current_user_record(auth)

    response = (
        get_service_supabase()
        .table("users")
        .update(update_payload)
        .eq("auth_user_id", auth.auth_user_id)
        .eq("team_id", auth.team_id)
        .execute()
    )
    return response.data[0]


@router.post("/me/avatar/upload-url")
def create_avatar_upload_url(
    payload: AvatarUploadRequest,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    extension = AVATAR_MIME_EXTENSIONS.get(payload.content_type)
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image type. Use JPG, PNG, or WebP.",
        )

    storage = get_service_supabase().storage.from_(AVATAR_BUCKET)
    object_path = f"{auth.auth_user_id}/{uuid4().hex}.{extension}"
    signed = storage.create_signed_upload_url(object_path)
    token = (
        signed.get("token")
        if isinstance(signed, dict)
        else getattr(signed, "token", None)
    )
    public_url = storage.get_public_url(object_path)

    return {
        "storage_path": object_path,
        "token": token,
        "public_url": public_url,
    }


@router.get("")
def list_users(auth: AuthContext = Depends(get_auth_context)) -> list[dict[str, Any]]:
    user = get_current_user_record(auth)
    require_manager(user)
    return _user_query(auth).order("full_name").execute().data


@router.patch("/{user_id}")
def update_user(
    user_id: UUID,
    payload: UserAdminUpdate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    current_user = get_current_user_record(auth)
    require_manager(current_user)
    _get_team_user(auth, user_id)

    update_payload = payload.model_dump(exclude_unset=True, mode="json")
    if not update_payload:
        return _get_team_user(auth, user_id)

    response = (
        get_service_supabase()
        .table("users")
        .update(update_payload)
        .eq("id", str(user_id))
        .eq("team_id", auth.team_id)
        .execute()
    )
    return response.data[0]
