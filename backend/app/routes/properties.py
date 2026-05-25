from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import AuthContext, get_auth_context
from app.models import PropertyStatus
from app.supabase import get_service_supabase
from app.users import get_current_user_record

router = APIRouter(prefix="/properties", tags=["properties"])


class PropertyCreate(BaseModel):
    name: str = Field(min_length=1)
    type: str = Field(min_length=1)
    location: str = Field(min_length=1)
    price: Decimal = Field(ge=0)
    status: PropertyStatus = PropertyStatus.ACTIVE
    bedrooms: int | None = Field(default=None, ge=0)
    bathrooms: int | None = Field(default=None, ge=0)
    sqft: int | None = Field(default=None, ge=0)
    parking: int | None = Field(default=None, ge=0)
    furnishing: str | None = None
    description: str | None = None


class PropertyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    type: str | None = Field(default=None, min_length=1)
    location: str | None = Field(default=None, min_length=1)
    price: Decimal | None = Field(default=None, ge=0)
    status: PropertyStatus | None = None
    bedrooms: int | None = Field(default=None, ge=0)
    bathrooms: int | None = Field(default=None, ge=0)
    sqft: int | None = Field(default=None, ge=0)
    parking: int | None = Field(default=None, ge=0)
    furnishing: str | None = None
    description: str | None = None


class ImageUploadCreate(BaseModel):
    file_name: str = Field(min_length=1)
    content_type: str = Field(pattern=r"^image/(jpeg|png|webp)$")
    is_cover: bool = False


class ImageCreate(BaseModel):
    storage_path: str = Field(min_length=1)
    is_cover: bool = False
    sort_order: int = Field(default=0, ge=0)


class ImageUpdate(BaseModel):
    is_cover: bool


def _property_query_for_user(auth: AuthContext, user: dict[str, Any]):
    query = (
        get_service_supabase()
        .table("properties")
        .select("*")
        .eq("team_id", auth.team_id)
    )
    if user["role"] != "MANAGER":
        query = query.eq("ren_id", user["id"])

    return query


def _get_accessible_property(
    *,
    property_id: UUID,
    auth: AuthContext,
    user: dict[str, Any],
) -> dict[str, Any]:
    response = (
        _property_query_for_user(auth, user)
        .eq("id", str(property_id))
        .single()
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found",
        )

    return response.data


@router.post("", status_code=status.HTTP_201_CREATED)
def create_property(
    payload: PropertyCreate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    user = get_current_user_record(auth)
    insert_payload = payload.model_dump(mode="json")
    insert_payload.update({"team_id": auth.team_id, "ren_id": user["id"]})
    response = (
        get_service_supabase().table("properties").insert(insert_payload).execute()
    )
    return response.data[0]


@router.get("")
def list_properties(
    q: str | None = None,
    type_filter: str | None = None,
    status_filter: PropertyStatus | None = None,
    price_min: Decimal | None = None,
    price_max: Decimal | None = None,
    auth: AuthContext = Depends(get_auth_context),
) -> list[dict[str, Any]]:
    user = get_current_user_record(auth)
    query = _property_query_for_user(auth, user).order("updated_at", desc=True)
    if q:
        query = query.or_(f"name.ilike.%{q}%,location.ilike.%{q}%")
    if type_filter:
        query = query.eq("type", type_filter)
    if status_filter:
        query = query.eq("status", status_filter.value)
    if price_min is not None:
        query = query.gte("price", str(price_min))
    if price_max is not None:
        query = query.lte("price", str(price_max))

    return query.execute().data


@router.get("/{property_id}")
def get_property(
    property_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    property_row = _get_accessible_property(
        property_id=property_id,
        auth=auth,
        user=user,
    )
    images = (
        supabase.table("property_images")
        .select("*")
        .eq("property_id", str(property_id))
        .order("sort_order")
        .execute()
    )

    return {**property_row, "images": images.data}


@router.patch("/{property_id}")
def update_property(
    property_id: UUID,
    payload: PropertyUpdate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    user = get_current_user_record(auth)
    _get_accessible_property(property_id=property_id, auth=auth, user=user)
    update_payload = payload.model_dump(exclude_unset=True, mode="json")
    if not update_payload:
        return _get_accessible_property(property_id=property_id, auth=auth, user=user)

    response = (
        get_service_supabase()
        .table("properties")
        .update(update_payload)
        .eq("id", str(property_id))
        .eq("team_id", auth.team_id)
        .execute()
    )
    return response.data[0]


@router.post("/{property_id}/images", status_code=status.HTTP_201_CREATED)
def create_image_upload(
    property_id: UUID,
    payload: ImageUploadCreate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    _get_accessible_property(property_id=property_id, auth=auth, user=user)
    storage_path = f"{auth.team_id}/{property_id}/{payload.file_name}"
    signed_upload = supabase.storage.from_("property-images").create_signed_upload_url(
        storage_path
    )

    return {
        "storage_path": storage_path,
        "signed_upload": signed_upload,
        "content_type": payload.content_type,
        "is_cover": payload.is_cover,
    }


@router.post("/{property_id}/images/complete", status_code=status.HTTP_201_CREATED)
def complete_image_upload(
    property_id: UUID,
    payload: ImageCreate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    _get_accessible_property(property_id=property_id, auth=auth, user=user)

    if payload.is_cover:
        (
            supabase.table("property_images")
            .update({"is_cover": False})
            .eq("property_id", str(property_id))
            .execute()
        )

    response = (
        supabase.table("property_images")
        .insert(
            {
                "property_id": str(property_id),
                "storage_path": payload.storage_path,
                "is_cover": payload.is_cover,
                "sort_order": payload.sort_order,
            }
        )
        .execute()
    )
    return response.data[0]


@router.patch("/{property_id}/images/{image_id}")
def update_property_image(
    property_id: UUID,
    image_id: UUID,
    payload: ImageUpdate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    _get_accessible_property(property_id=property_id, auth=auth, user=user)
    if payload.is_cover:
        (
            supabase.table("property_images")
            .update({"is_cover": False})
            .eq("property_id", str(property_id))
            .execute()
        )

    response = (
        supabase.table("property_images")
        .update({"is_cover": payload.is_cover})
        .eq("id", str(image_id))
        .eq("property_id", str(property_id))
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property image not found",
        )

    return response.data[0]


@router.delete("/{property_id}/images/{image_id}")
def delete_property_image(
    property_id: UUID,
    image_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, str]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    _get_accessible_property(property_id=property_id, auth=auth, user=user)
    images = (
        supabase.table("property_images")
        .select("id,is_cover")
        .eq("property_id", str(property_id))
        .execute()
        .data
    )
    image = next((item for item in images if item["id"] == str(image_id)), None)
    if image is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property image not found",
        )
    if len(images) == 1 or image["is_cover"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the only image or the current cover image",
        )

    supabase.table("property_images").delete().eq("id", str(image_id)).execute()
    return {"status": "deleted"}
