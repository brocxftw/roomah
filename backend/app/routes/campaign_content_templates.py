from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.auth import AuthContext, get_auth_context
from app.models import (
    CampaignContentTemplateCreate,
    CampaignContentTemplateUpdate,
)
from app.supabase import get_service_supabase
from app.users import get_current_user_record

router = APIRouter(prefix="/campaign-content-templates", tags=["campaign-content-templates"])


def _is_visible_template(template: dict[str, Any], user: dict[str, Any]) -> bool:
    if template.get("is_starter"):
        return True
    return template.get("team_id") == user["team_id"] and template.get("created_by") == user["id"]


def _get_visible_template(
    *,
    template_id: UUID,
    user: dict[str, Any],
) -> dict[str, Any]:
    template = (
        get_service_supabase()
        .table("campaign_content_templates")
        .select("*")
        .eq("id", str(template_id))
        .single()
        .execute()
        .data
    )
    if not template or not _is_visible_template(template, user):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign content template not found",
        )
    return template


def _ensure_owned_private_template(template: dict[str, Any], user: dict[str, Any]) -> None:
    if template.get("is_starter"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Starter templates are read-only",
        )
    if template.get("team_id") != user["team_id"] or template.get("created_by") != user["id"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign content template not found",
        )


@router.get("")
def list_templates(
    auth: AuthContext = Depends(get_auth_context),
) -> list[dict[str, Any]]:
    user = get_current_user_record(auth)
    templates = (
        get_service_supabase()
        .table("campaign_content_templates")
        .select("*")
        .order("created_at", desc=False)
        .execute()
        .data
    )
    return [template for template in templates if _is_visible_template(template, user)]


@router.get("/{template_id}")
def get_template(
    template_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    user = get_current_user_record(auth)
    return _get_visible_template(template_id=template_id, user=user)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_template(
    payload: CampaignContentTemplateCreate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    user = get_current_user_record(auth)
    insert_payload = payload.model_dump(mode="json")
    insert_payload.update(
        {
            "team_id": auth.team_id,
            "created_by": user["id"],
            "is_starter": False,
        }
    )
    return (
        get_service_supabase()
        .table("campaign_content_templates")
        .insert(insert_payload)
        .execute()
        .data[0]
    )


@router.patch("/{template_id}")
def update_template(
    template_id: UUID,
    payload: CampaignContentTemplateUpdate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    user = get_current_user_record(auth)
    template = _get_visible_template(template_id=template_id, user=user)
    _ensure_owned_private_template(template, user)
    update_payload = payload.model_dump(exclude_unset=True, mode="json")
    if not update_payload:
        return template
    return (
        get_service_supabase()
        .table("campaign_content_templates")
        .update(update_payload)
        .eq("id", str(template_id))
        .execute()
        .data[0]
    )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
) -> Response:
    user = get_current_user_record(auth)
    template = _get_visible_template(template_id=template_id, user=user)
    _ensure_owned_private_template(template, user)
    get_service_supabase().table("campaign_content_templates").delete().eq(
        "id",
        str(template_id),
    ).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

