from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import AuthContext, get_auth_context
from app.models import TimelineEventType
from app.supabase import get_service_supabase
from app.timeline import emit_timeline_event
from app.users import get_current_user_record, get_team_user_references, require_manager

router = APIRouter(prefix="/viewings", tags=["viewings"])


class ViewingCreate(BaseModel):
    lead_id: UUID
    property_id: UUID
    assigned_ren_id: UUID
    scheduled_at: datetime


class ViewingComplete(BaseModel):
    interest_level: int = Field(ge=1, le=3)
    notes: str | None = None


class ViewingUpdate(BaseModel):
    assigned_ren_id: UUID


def _viewing_query_for_user(auth: AuthContext, user: dict[str, Any]):
    query = (
        get_service_supabase().table("viewings").select("*").eq("team_id", auth.team_id)
    )
    if user["role"] != "MANAGER":
        query = query.eq("assigned_ren_id", user["id"])

    return query


def _get_accessible_viewing(
    *,
    viewing_id: UUID,
    auth: AuthContext,
    user: dict[str, Any],
) -> dict[str, Any]:
    response = (
        _viewing_query_for_user(auth, user).eq("id", str(viewing_id)).single().execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Viewing not found",
        )

    return response.data


@router.post("", status_code=status.HTTP_201_CREATED)
def create_viewing(
    payload: ViewingCreate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    if user["role"] != "MANAGER" and str(payload.assigned_ren_id) != user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="REN can only assign viewings to themselves",
        )

    response = (
        supabase.table("viewings")
        .insert(
            {
                "team_id": auth.team_id,
                "lead_id": str(payload.lead_id),
                "property_id": str(payload.property_id),
                "assigned_ren_id": str(payload.assigned_ren_id),
                "scheduled_at": payload.scheduled_at.isoformat(),
                "status": "scheduled",
            }
        )
        .execute()
    )
    viewing = response.data[0]
    emit_timeline_event(
        supabase=supabase,
        auth=auth,
        lead_id=payload.lead_id,
        event_type=TimelineEventType.VIEWING_SCHEDULED,
        payload={
            "viewing_id": viewing["id"],
            "property_id": str(payload.property_id),
            "scheduled_at": payload.scheduled_at.isoformat(),
            "assigned_ren_id": str(payload.assigned_ren_id),
        },
        created_by=user["id"],
    )

    return viewing


@router.get("")
def list_viewings(
    auth: AuthContext = Depends(get_auth_context),
) -> list[dict[str, Any]]:
    user = get_current_user_record(auth)
    viewings = _viewing_query_for_user(auth, user).order("scheduled_at").execute().data
    assigned_refs = get_team_user_references(
        auth,
        {
            viewing["assigned_ren_id"]
            for viewing in viewings
            if viewing.get("assigned_ren_id")
        },
    )
    return [
        {
            **viewing,
            "assigned_ren": assigned_refs.get(viewing["assigned_ren_id"]),
        }
        for viewing in viewings
    ]


@router.post("/{viewing_id}/complete")
def complete_viewing(
    viewing_id: UUID,
    payload: ViewingComplete,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    viewing = _get_accessible_viewing(viewing_id=viewing_id, auth=auth, user=user)
    completed_at = datetime.now(UTC)
    suggested_follow_up_at = completed_at + timedelta(days=2)
    response = (
        supabase.table("viewings")
        .update(
            {
                "status": "completed",
                "interest_level": payload.interest_level,
                "notes": payload.notes,
                "completed_at": completed_at.isoformat(),
            }
        )
        .eq("id", str(viewing_id))
        .execute()
    )
    updated = response.data[0]
    emit_timeline_event(
        supabase=supabase,
        auth=auth,
        lead_id=viewing["lead_id"],
        event_type=TimelineEventType.VIEWING_COMPLETED,
        payload={
            "viewing_id": str(viewing_id),
            "interest_level": payload.interest_level,
            "notes": payload.notes,
        },
        created_by=user["id"],
    )

    return {
        **updated,
        "suggested_follow_up_at": suggested_follow_up_at.isoformat(),
    }


@router.patch("/{viewing_id}")
def update_viewing(
    viewing_id: UUID,
    payload: ViewingUpdate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    require_manager(user)
    viewing = _get_accessible_viewing(viewing_id=viewing_id, auth=auth, user=user)
    response = (
        supabase.table("viewings")
        .update({"assigned_ren_id": str(payload.assigned_ren_id)})
        .eq("id", str(viewing_id))
        .eq("team_id", auth.team_id)
        .execute()
    )
    updated = response.data[0]
    emit_timeline_event(
        supabase=supabase,
        auth=auth,
        lead_id=viewing["lead_id"],
        event_type=TimelineEventType.VIEWING_REASSIGNED,
        payload={
            "viewing_id": str(viewing_id),
            "from_ren_id": viewing["assigned_ren_id"],
            "to_ren_id": str(payload.assigned_ren_id),
        },
        created_by=user["id"],
    )

    return updated


@router.patch("/{viewing_id}/reassign")
def reassign_viewing(
    viewing_id: UUID,
    payload: ViewingUpdate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    return update_viewing(viewing_id=viewing_id, payload=payload, auth=auth)
