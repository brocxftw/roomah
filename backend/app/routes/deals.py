from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import AuthContext, get_auth_context
from app.campaigns import CampaignCountersService
from app.models import ListingType, TimelineEventType
from app.supabase import get_service_supabase
from app.timeline import emit_timeline_event
from app.users import get_current_user_record, get_team_user_references

router = APIRouter(prefix="/deals", tags=["deals"])


class DealCreate(BaseModel):
    lead_id: UUID
    property_id: UUID
    sale_price: Decimal = Field(ge=0)
    deal_type: ListingType | None = None
    agency_fee: Decimal | None = Field(default=None, ge=0)
    lawyer_fees: Decimal | None = Field(default=None, ge=0)
    commission_override: Decimal | None = None


def _validate_active_link(lead_id: UUID, property_id: UUID) -> None:
    response = (
        get_service_supabase()
        .table("lead_properties")
        .select("*")
        .eq("lead_id", str(lead_id))
        .eq("property_id", str(property_id))
        .eq("status", "active")
        .single()
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Property is not actively linked to the lead",
        )


def _validate_deal_type(
    property_row: dict[str, Any], deal_type: ListingType | None
) -> str:
    listing_type = ListingType(property_row["listing_type"])
    if listing_type == ListingType.SALE:
        if deal_type == ListingType.RENTAL:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Sale-only properties cannot close as Rental deals",
            )
        return ListingType.SALE.value
    if listing_type == ListingType.RENTAL:
        if deal_type == ListingType.SALE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Rental-only properties cannot close as Sale deals",
            )
        return ListingType.RENTAL.value

    if deal_type is None:
        return ListingType.SALE.value
    if deal_type not in {ListingType.SALE, ListingType.RENTAL}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Both listings must close as either Sale or Rental",
        )
    return deal_type.value


@router.post("", status_code=status.HTTP_201_CREATED)
def create_deal(
    payload: DealCreate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    if user.get("active_status") is False:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Assigned REN is deactivated",
        )
    lead = (
        supabase.table("leads")
        .select("id,campaign_id")
        .eq("id", str(payload.lead_id))
        .eq("team_id", auth.team_id)
        .single()
        .execute()
        .data
    )
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )

    _validate_active_link(payload.lead_id, payload.property_id)
    property_row = (
        supabase.table("properties")
        .select("id,listing_type,listing_price,expected_rental")
        .eq("id", str(payload.property_id))
        .eq("team_id", auth.team_id)
        .single()
        .execute()
        .data
    )
    if not property_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found",
        )
    deal_type = _validate_deal_type(property_row, payload.deal_type)

    config = (
        supabase.table("team_config")
        .select("*")
        .eq("team_id", auth.team_id)
        .single()
        .execute()
        .data
    )
    commission_rate = Decimal(str(user["commission_rate"]))
    agency_fee = payload.agency_fee or Decimal(str(config["default_agency_fee"]))
    lawyer_fees = payload.lawyer_fees or Decimal(str(config["default_lawyer_fees"]))
    commission_total = payload.sale_price * commission_rate - agency_fee - lawyer_fees

    deal = (
        supabase.table("deals")
        .insert(
            {
                "team_id": auth.team_id,
                "lead_id": str(payload.lead_id),
                "property_id": str(payload.property_id),
                "ren_id": user["id"],
                "sale_price": str(payload.sale_price),
                "commission_rate": str(commission_rate),
                "agency_fee": str(agency_fee),
                "lawyer_fees": str(lawyer_fees),
                "commission_total": str(commission_total),
                "commission_override": (
                    str(payload.commission_override)
                    if payload.commission_override is not None
                    else None
                ),
            }
        )
        .execute()
        .data[0]
    )
    CampaignCountersService(supabase).increment_conversion(lead.get("campaign_id"))

    supabase.table("leads").update({"status": "Closed"}).eq(
        "id", str(payload.lead_id)
    ).execute()
    supabase.table("properties").update({"status": "Inactive"}).eq(
        "id", str(payload.property_id)
    ).execute()

    other_links = (
        supabase.table("lead_properties")
        .select("lead_id")
        .eq("property_id", str(payload.property_id))
        .eq("status", "active")
        .neq("lead_id", str(payload.lead_id))
        .execute()
        .data
    )
    other_lead_ids = [link["lead_id"] for link in other_links]
    if other_lead_ids:
        (
            supabase.table("lead_properties")
            .update({"status": "inactive"})
            .eq("property_id", str(payload.property_id))
            .eq("status", "active")
            .neq("lead_id", str(payload.lead_id))
            .execute()
        )
        supabase.table("leads").update({"status": "Lost"}).in_(
            "id", other_lead_ids
        ).execute()

    emit_timeline_event(
        supabase=supabase,
        auth=auth,
        lead_id=payload.lead_id,
        event_type=TimelineEventType.DEAL_CLOSED,
        payload={
            "deal_id": deal["id"],
            "property_id": str(payload.property_id),
            "deal_type": deal_type,
            "sale_price": str(payload.sale_price),
            "commission_total": str(commission_total),
        },
        created_by=user["id"],
    )
    emit_timeline_event(
        supabase=supabase,
        auth=auth,
        lead_id=payload.lead_id,
        event_type=TimelineEventType.LEAD_STATUS_CHANGED,
        payload={"from": "Negotiating", "to": "Closed"},
        created_by=user["id"],
    )
    for lead_id in other_lead_ids:
        emit_timeline_event(
            supabase=supabase,
            auth=auth,
            lead_id=lead_id,
            event_type=TimelineEventType.PROPERTY_UNLINKED,
            payload={"property_id": str(payload.property_id)},
            created_by=user["id"],
        )
        emit_timeline_event(
            supabase=supabase,
            auth=auth,
            lead_id=lead_id,
            event_type=TimelineEventType.LEAD_STATUS_CHANGED,
            payload={"from": "Active", "to": "Lost"},
            created_by=user["id"],
        )

    return deal


@router.get("")
def list_deals(
    auth: AuthContext = Depends(get_auth_context),
) -> list[dict[str, Any]]:
    user = get_current_user_record(auth)
    query = (
        get_service_supabase()
        .table("deals")
        .select("*")
        .eq("team_id", auth.team_id)
        .order("closed_at", desc=True)
    )
    if user["role"] != "MANAGER":
        query = query.eq("ren_id", user["id"])

    deals = query.execute().data
    ren_refs = get_team_user_references(
        auth,
        {deal["ren_id"] for deal in deals if deal.get("ren_id")},
    )
    return [{**deal, "ren": ren_refs.get(deal["ren_id"])} for deal in deals]
