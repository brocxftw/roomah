from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field, model_validator

from app.auth import AuthContext, get_auth_context
from app.models import LeadStatus, TimelineEventSource, TimelineEventType
from app.supabase import get_service_supabase
from app.timeline import emit_timeline_event
from app.users import get_current_user_record, require_manager

router = APIRouter(prefix="/leads", tags=["leads"])


class LeadCreate(BaseModel):
    name: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    email: EmailStr
    budget_min: Decimal | None = Field(default=None, ge=0)
    budget_max: Decimal | None = Field(default=None, ge=0)
    preferred_location: str | None = None
    preferred_property_type: str | None = None

    @model_validator(mode="after")
    def validate_budget_range(self) -> "LeadCreate":
        if (
            self.budget_min is not None
            and self.budget_max is not None
            and self.budget_min > self.budget_max
        ):
            raise ValueError("budget_min must be less than or equal to budget_max")

        return self


class LeadUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    phone: str | None = Field(default=None, min_length=1)
    email: EmailStr | None = None
    budget_min: Decimal | None = Field(default=None, ge=0)
    budget_max: Decimal | None = Field(default=None, ge=0)
    preferred_location: str | None = None
    preferred_property_type: str | None = None
    status: LeadStatus | None = None


class LeadPropertyLinkCreate(BaseModel):
    property_id: UUID


class LeadReassign(BaseModel):
    ren_id: UUID


class ManualTimelineEventCreate(BaseModel):
    event_type: TimelineEventType
    note: str = Field(min_length=1)

    @model_validator(mode="after")
    def validate_manual_event_type(self) -> "ManualTimelineEventCreate":
        if self.event_type not in {
            TimelineEventType.MANUAL_CALL,
            TimelineEventType.MANUAL_NOTE,
            TimelineEventType.MANUAL_CALLBACK,
        }:
            raise ValueError("event_type must be a manual timeline event")

        return self


def _lead_query_for_user(auth: AuthContext, user: dict[str, Any]):
    query = (
        get_service_supabase().table("leads").select("*").eq("team_id", auth.team_id)
    )
    if user["role"] != "MANAGER":
        query = query.eq("ren_id", user["id"])

    return query


def _get_accessible_lead(
    *,
    lead_id: UUID,
    auth: AuthContext,
    user: dict[str, Any],
) -> dict[str, Any]:
    response = (
        _lead_query_for_user(auth, user).eq("id", str(lead_id)).single().execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )

    return response.data


@router.post("", status_code=status.HTTP_201_CREATED)
def create_lead(
    payload: LeadCreate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    insert_payload = payload.model_dump(mode="json")
    insert_payload.update(
        {
            "team_id": auth.team_id,
            "ren_id": user["id"],
            "status": LeadStatus.ACTIVE.value,
        }
    )
    response = supabase.table("leads").insert(insert_payload).execute()
    lead = response.data[0]

    emit_timeline_event(
        supabase=supabase,
        auth=auth,
        lead_id=lead["id"],
        event_type=TimelineEventType.LEAD_CREATED,
        payload={"lead_id": lead["id"]},
        created_by=user["id"],
    )

    return lead


@router.get("")
def list_leads(
    q: str | None = None,
    status_filter: LeadStatus | None = None,
    auth: AuthContext = Depends(get_auth_context),
) -> list[dict[str, Any]]:
    user = get_current_user_record(auth)
    query = _lead_query_for_user(auth, user).order("updated_at", desc=True)
    if status_filter is not None:
        query = query.eq("status", status_filter.value)
    if q:
        query = query.or_(f"name.ilike.%{q}%,phone.ilike.%{q}%,email.ilike.%{q}%")

    response = query.execute()
    return response.data


@router.get("/{lead_id}")
def get_lead(
    lead_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    lead = _get_accessible_lead(lead_id=lead_id, auth=auth, user=user)

    links = (
        supabase.table("lead_properties")
        .select("status, created_at, properties(*)")
        .eq("lead_id", str(lead_id))
        .execute()
    )
    timeline = (
        supabase.table("timeline_events")
        .select("*")
        .eq("lead_id", str(lead_id))
        .order("created_at", desc=True)
        .limit(25)
        .execute()
    )

    return {
        **lead,
        "linked_properties": links.data,
        "timeline": timeline.data,
    }


@router.get("/{lead_id}/timeline")
def get_lead_timeline(
    lead_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
) -> list[dict[str, Any]]:
    user = get_current_user_record(auth)
    _get_accessible_lead(lead_id=lead_id, auth=auth, user=user)
    response = (
        get_service_supabase()
        .table("timeline_events")
        .select("*")
        .eq("lead_id", str(lead_id))
        .order("created_at", desc=True)
        .execute()
    )

    return response.data


@router.patch("/{lead_id}")
def update_lead(
    lead_id: UUID,
    payload: LeadUpdate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    lead = _get_accessible_lead(lead_id=lead_id, auth=auth, user=user)
    update_payload = payload.model_dump(exclude_unset=True, mode="json")
    if not update_payload:
        return lead

    if "ren_id" in update_payload and user["role"] != "MANAGER":
        require_manager(user)

    response = (
        supabase.table("leads")
        .update(update_payload)
        .eq("id", str(lead_id))
        .eq("team_id", auth.team_id)
        .execute()
    )
    updated_lead = response.data[0]

    if "status" in update_payload and update_payload["status"] != lead["status"]:
        emit_timeline_event(
            supabase=supabase,
            auth=auth,
            lead_id=lead_id,
            event_type=TimelineEventType.LEAD_STATUS_CHANGED,
            source=TimelineEventSource.USER,
            payload={"from": lead["status"], "to": update_payload["status"]},
            created_by=user["id"],
        )

    return updated_lead


@router.patch("/{lead_id}/reassign")
def reassign_lead(
    lead_id: UUID,
    payload: LeadReassign,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    require_manager(user)
    lead = _get_accessible_lead(lead_id=lead_id, auth=auth, user=user)

    target = (
        supabase.table("users")
        .select("id")
        .eq("id", str(payload.ren_id))
        .eq("team_id", auth.team_id)
        .single()
        .execute()
    )
    if not target.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target REN not found",
        )

    response = (
        supabase.table("leads")
        .update({"ren_id": str(payload.ren_id)})
        .eq("id", str(lead_id))
        .eq("team_id", auth.team_id)
        .execute()
    )
    updated = response.data[0]
    emit_timeline_event(
        supabase=supabase,
        auth=auth,
        lead_id=lead_id,
        event_type=TimelineEventType.LEAD_REASSIGNED,
        payload={"from_ren_id": lead["ren_id"], "to_ren_id": str(payload.ren_id)},
        created_by=user["id"],
    )

    return updated


@router.post("/{lead_id}/links", status_code=status.HTTP_201_CREATED)
def link_property(
    lead_id: UUID,
    payload: LeadPropertyLinkCreate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    _get_accessible_lead(lead_id=lead_id, auth=auth, user=user)

    property_response = (
        supabase.table("properties")
        .select("id")
        .eq("id", str(payload.property_id))
        .eq("team_id", auth.team_id)
        .single()
        .execute()
    )
    if not property_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found",
        )

    response = (
        supabase.table("lead_properties")
        .upsert(
            {
                "lead_id": str(lead_id),
                "property_id": str(payload.property_id),
                "status": "active",
            },
            on_conflict="lead_id,property_id",
        )
        .execute()
    )
    link = response.data[0]

    emit_timeline_event(
        supabase=supabase,
        auth=auth,
        lead_id=lead_id,
        event_type=TimelineEventType.PROPERTY_LINKED,
        payload={"property_id": str(payload.property_id)},
        created_by=user["id"],
    )

    return link


@router.delete("/{lead_id}/links/{property_id}")
def unlink_property(
    lead_id: UUID,
    property_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    _get_accessible_lead(lead_id=lead_id, auth=auth, user=user)

    response = (
        supabase.table("lead_properties")
        .update({"status": "inactive"})
        .eq("lead_id", str(lead_id))
        .eq("property_id", str(property_id))
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead-property link not found",
        )

    emit_timeline_event(
        supabase=supabase,
        auth=auth,
        lead_id=lead_id,
        event_type=TimelineEventType.PROPERTY_UNLINKED,
        payload={
            "property_id": str(property_id),
            "request_id": request.headers.get("x-request-id"),
        },
        created_by=user["id"],
    )

    return response.data[0]


@router.post("/{lead_id}/timeline", status_code=status.HTTP_201_CREATED)
def log_manual_timeline_event(
    lead_id: UUID,
    payload: ManualTimelineEventCreate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any] | None:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    _get_accessible_lead(lead_id=lead_id, auth=auth, user=user)

    return emit_timeline_event(
        supabase=supabase,
        auth=auth,
        lead_id=lead_id,
        event_type=payload.event_type,
        source=TimelineEventSource.USER,
        payload={"note": payload.note},
        created_by=user["id"],
    )
