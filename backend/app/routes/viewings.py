from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator

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
    interest_level: int = Field(ge=1, le=5)
    notes: str | None = None


class ViewingInterestUpdate(BaseModel):
    interest_level: int = Field(ge=1, le=5)
    notes: str | None = None


class ViewingUpdate(BaseModel):
    assigned_ren_id: UUID


class ViewingReschedule(BaseModel):
    scheduled_at: datetime


class ViewingCancel(BaseModel):
    cancellation_reason: Literal[
        "lead_cancelled",
        "agent_cancelled",
        "no_show",
        "other",
    ]
    cancellation_notes: str | None = None


class ViewingFollowUpUpdate(BaseModel):
    follow_up_at: datetime | None = None
    follow_up_status: Literal["pending", "done", "cancelled"] | None = None

    @model_validator(mode="after")
    def validate_follow_up_update(self) -> "ViewingFollowUpUpdate":
        if self.follow_up_status == "pending" and self.follow_up_at is None:
            raise ValueError("follow_up_at is required for pending follow-ups")
        return self


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


def _records_by_id(
    *,
    table_name: str,
    record_ids: set[str],
    auth: AuthContext,
) -> dict[str, dict[str, Any]]:
    if not record_ids:
        return {}

    rows = (
        get_service_supabase()
        .table(table_name)
        .select("*")
        .eq("team_id", auth.team_id)
        .in_("id", sorted(record_ids))
        .execute()
        .data
    )
    return {row["id"]: row for row in rows}


def _converted_deals_by_viewing(
    *,
    viewings: list[dict[str, Any]],
    auth: AuthContext,
) -> dict[str, dict[str, Any]]:
    lead_ids = {viewing["lead_id"] for viewing in viewings if viewing.get("lead_id")}
    if not lead_ids:
        return {}

    deals = (
        get_service_supabase()
        .table("deals")
        .select("*")
        .eq("team_id", auth.team_id)
        .in_("lead_id", sorted(lead_ids))
        .execute()
        .data
    )
    deals_by_pair = {
        (deal["lead_id"], deal["property_id"]): deal
        for deal in deals
        if deal.get("lead_id") and deal.get("property_id")
    }
    return {
        viewing["id"]: deals_by_pair.get((viewing["lead_id"], viewing["property_id"]))
        for viewing in viewings
    }


def _lead_summary(lead: dict[str, Any] | None) -> dict[str, Any] | None:
    if not lead:
        return None
    return {
        "id": lead["id"],
        "name": lead.get("name"),
        "phone": lead.get("phone"),
        "email": lead.get("email"),
        "status": lead.get("status"),
        "preferred_property_type": lead.get("preferred_property_type"),
        "preferred_location": lead.get("preferred_location"),
        "budget_min": lead.get("budget_min"),
        "budget_max": lead.get("budget_max"),
    }


def _property_summary(property_row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not property_row:
        return None
    return {
        "id": property_row["id"],
        "name": property_row.get("name"),
        "type": property_row.get("type"),
        "listing_type": property_row.get("listing_type"),
        "status": property_row.get("status"),
        "city": property_row.get("city"),
        "state": property_row.get("state"),
        "postcode": property_row.get("postcode"),
        "listing_price": property_row.get("listing_price"),
        "expected_rental": property_row.get("expected_rental"),
    }


def _deal_summary(deal: dict[str, Any] | None) -> dict[str, Any] | None:
    if not deal:
        return None
    return {
        "id": deal["id"],
        "sale_price": deal.get("sale_price"),
        "commission_total": deal.get("commission_total"),
        "closed_at": deal.get("closed_at"),
        "created_at": deal.get("created_at"),
    }


def _enrich_viewings(
    *,
    viewings: list[dict[str, Any]],
    auth: AuthContext,
) -> list[dict[str, Any]]:
    lead_refs = _records_by_id(
        table_name="leads",
        record_ids={viewing["lead_id"] for viewing in viewings if viewing.get("lead_id")},
        auth=auth,
    )
    property_refs = _records_by_id(
        table_name="properties",
        record_ids={
            viewing["property_id"] for viewing in viewings if viewing.get("property_id")
        },
        auth=auth,
    )
    assigned_refs = get_team_user_references(
        auth,
        {
            viewing["assigned_ren_id"]
            for viewing in viewings
            if viewing.get("assigned_ren_id")
        },
    )
    converted_deals = _converted_deals_by_viewing(viewings=viewings, auth=auth)
    return [
        {
            **viewing,
            "lead": _lead_summary(lead_refs.get(viewing.get("lead_id"))),
            "property": _property_summary(property_refs.get(viewing.get("property_id"))),
            "assigned_ren": assigned_refs.get(viewing.get("assigned_ren_id")),
            "converted_deal": _deal_summary(converted_deals.get(viewing["id"])),
        }
        for viewing in viewings
    ]


def _matches_workspace_filters(
    viewing: dict[str, Any],
    *,
    q: str | None,
    property_type: str | None,
) -> bool:
    if property_type and viewing.get("property", {}).get("type") != property_type:
        return False
    if not q:
        return True
    needle = q.lower()
    haystack = " ".join(
        str(value or "")
        for value in (
            viewing.get("lead", {}).get("name"),
            viewing.get("lead", {}).get("phone"),
            viewing.get("lead", {}).get("email"),
            viewing.get("property", {}).get("name"),
            viewing.get("property", {}).get("type"),
            viewing.get("property", {}).get("city"),
            viewing.get("property", {}).get("state"),
            viewing.get("assigned_ren", {}).get("full_name"),
            viewing.get("assigned_ren", {}).get("email"),
        )
    ).lower()
    return needle in haystack


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
    q: str | None = None,
    status_filter: str | None = None,
    assigned_ren_id: UUID | None = None,
    property_type: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    follow_up_status: str | None = None,
    auth: AuthContext = Depends(get_auth_context),
) -> list[dict[str, Any]]:
    user = get_current_user_record(auth)
    query = _viewing_query_for_user(auth, user)
    if status_filter:
        query = query.eq("status", status_filter)
    if assigned_ren_id and user["role"] == "MANAGER":
        query = query.eq("assigned_ren_id", str(assigned_ren_id))
    if date_from:
        query = query.gte("scheduled_at", date_from.isoformat())
    if date_to:
        query = query.lte("scheduled_at", date_to.isoformat())
    if follow_up_status:
        query = query.eq("follow_up_status", follow_up_status)

    viewings = query.order("scheduled_at").execute().data
    enriched = _enrich_viewings(viewings=viewings, auth=auth)
    return [
        viewing
        for viewing in enriched
        if _matches_workspace_filters(
            viewing,
            q=q,
            property_type=property_type,
        )
    ]


@router.get("/{viewing_id}")
def get_viewing(
    viewing_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    user = get_current_user_record(auth)
    viewing = _get_accessible_viewing(viewing_id=viewing_id, auth=auth, user=user)
    return _enrich_viewings(viewings=[viewing], auth=auth)[0]


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
                "follow_up_at": suggested_follow_up_at.isoformat(),
                "follow_up_status": "pending",
            }
        )
        .eq("id", str(viewing_id))
        .eq("team_id", auth.team_id)
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


@router.patch("/{viewing_id}/reschedule")
def reschedule_viewing(
    viewing_id: UUID,
    payload: ViewingReschedule,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    user = get_current_user_record(auth)
    _get_accessible_viewing(viewing_id=viewing_id, auth=auth, user=user)
    response = (
        get_service_supabase()
        .table("viewings")
        .update({"scheduled_at": payload.scheduled_at.isoformat()})
        .eq("id", str(viewing_id))
        .eq("team_id", auth.team_id)
        .execute()
    )
    return response.data[0]


@router.post("/{viewing_id}/cancel")
def cancel_viewing(
    viewing_id: UUID,
    payload: ViewingCancel,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    user = get_current_user_record(auth)
    _get_accessible_viewing(viewing_id=viewing_id, auth=auth, user=user)
    response = (
        get_service_supabase()
        .table("viewings")
        .update(
            {
                "status": "cancelled",
                "cancellation_reason": payload.cancellation_reason,
                "cancellation_notes": payload.cancellation_notes,
                "cancelled_at": datetime.now(UTC).isoformat(),
            }
        )
        .eq("id", str(viewing_id))
        .eq("team_id", auth.team_id)
        .execute()
    )
    return response.data[0]


@router.patch("/{viewing_id}/interest")
def update_viewing_interest(
    viewing_id: UUID,
    payload: ViewingInterestUpdate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    user = get_current_user_record(auth)
    _get_accessible_viewing(viewing_id=viewing_id, auth=auth, user=user)
    update_payload: dict[str, Any] = {"interest_level": payload.interest_level}
    if payload.notes is not None:
        update_payload["notes"] = payload.notes
    response = (
        get_service_supabase()
        .table("viewings")
        .update(update_payload)
        .eq("id", str(viewing_id))
        .eq("team_id", auth.team_id)
        .execute()
    )
    return response.data[0]


@router.patch("/{viewing_id}/follow-up")
def update_viewing_follow_up(
    viewing_id: UUID,
    payload: ViewingFollowUpUpdate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    user = get_current_user_record(auth)
    viewing = _get_accessible_viewing(viewing_id=viewing_id, auth=auth, user=user)
    update_payload: dict[str, Any] = {}
    if payload.follow_up_at is not None:
        update_payload["follow_up_at"] = payload.follow_up_at.isoformat()
    if payload.follow_up_status is not None:
        update_payload["follow_up_status"] = payload.follow_up_status
    next_status = update_payload.get("follow_up_status", viewing.get("follow_up_status"))
    next_date = update_payload.get("follow_up_at", viewing.get("follow_up_at"))
    if next_status == "pending" and not next_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="follow_up_at is required for pending follow-ups",
        )
    response = (
        get_service_supabase()
        .table("viewings")
        .update(update_payload)
        .eq("id", str(viewing_id))
        .eq("team_id", auth.team_id)
        .execute()
    )
    return response.data[0]


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
