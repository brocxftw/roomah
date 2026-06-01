import logging
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.auth import AuthContext, get_auth_context
from app.campaigns import CampaignCountersService
from app.models import LeadStatus, ListingType, TimelineEventType, validate_https_url
from app.supabase import get_service_supabase
from app.timeline import emit_timeline_event
from app.users import get_current_user_record, get_team_user_references

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/deals", tags=["deals"])

DealStage = Literal[
    "negotiation",
    "offer_made",
    "pending_contract",
    "final_approval",
    "closed_won",
    "closed_lost",
]
OpenDealStage = Literal[
    "negotiation",
    "offer_made",
    "pending_contract",
    "final_approval",
]
LostReason = Literal[
    "budget",
    "financing_denied",
    "chose_competitor",
    "property_issue",
    "lead_unresponsive",
    "agent_decision",
    "other",
]
DocumentKind = Literal[
    "offer",
    "contract",
    "loan",
    "tenancy",
    "receipt",
    "supporting",
    "other",
]

OPEN_DEAL_STAGES = {
    "negotiation",
    "offer_made",
    "pending_contract",
    "final_approval",
}
TERMINAL_DEAL_STAGES = {"closed_won", "closed_lost"}
STAGE_DEFAULT_PROBABILITIES = {
    "negotiation": Decimal("30"),
    "offer_made": Decimal("50"),
    "pending_contract": Decimal("70"),
    "final_approval": Decimal("85"),
    "closed_won": Decimal("100"),
    "closed_lost": Decimal("0"),
}


class DealCreate(BaseModel):
    lead_id: UUID
    property_id: UUID
    sale_price: Decimal = Field(ge=0)
    deal_type: ListingType | None = None
    agency_fee: Decimal | None = Field(default=None, ge=0)
    lawyer_fees: Decimal | None = Field(default=None, ge=0)
    commission_override: Decimal | None = Field(default=None, ge=0)
    expected_close_date: date | None = None
    probability_override: Decimal | None = Field(default=None, ge=0, le=100)
    notes: str | None = None
    origin_viewing_id: UUID | None = None


class DealWin(BaseModel):
    sale_price: Decimal = Field(ge=0)
    deal_type: ListingType | None = None
    agency_fee: Decimal | None = Field(default=None, ge=0)
    lawyer_fees: Decimal | None = Field(default=None, ge=0)
    commission_override: Decimal | None = Field(default=None, ge=0)


class DealLose(BaseModel):
    lost_reason: LostReason
    lost_notes: str | None = None


class DealStageUpdate(BaseModel):
    stage: DealStage


class DealReopen(BaseModel):
    stage: OpenDealStage = "negotiation"


class DealUpdate(BaseModel):
    sale_price: Decimal | None = Field(default=None, ge=0)
    agency_fee: Decimal | None = Field(default=None, ge=0)
    lawyer_fees: Decimal | None = Field(default=None, ge=0)
    commission_override: Decimal | None = Field(default=None, ge=0)
    expected_close_date: date | None = None
    probability_override: Decimal | None = Field(default=None, ge=0, le=100)
    notes: str | None = None


class DealDocumentCreate(BaseModel):
    label: str = Field(min_length=1)
    url: str
    kind: DocumentKind | None = None

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        normalized = validate_https_url(value)
        if normalized is None:
            raise ValueError("url is required")
        return normalized


def _decimal(value: Any, fallback: Decimal = Decimal("0")) -> Decimal:
    if value is None:
        return fallback
    return Decimal(str(value))


def _money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))


def _effective_commission(deal: dict[str, Any]) -> Decimal:
    if deal.get("commission_override") is not None:
        return _decimal(deal["commission_override"])
    return _decimal(deal.get("commission_total"))


def _effective_probability(deal: dict[str, Any]) -> Decimal:
    if deal.get("probability_override") is not None:
        return _decimal(deal["probability_override"])
    return STAGE_DEFAULT_PROBABILITIES.get(
        deal.get("stage") or "closed_won",
        Decimal("0"),
    )


def _commission_payload(
    *,
    sale_price: Decimal,
    commission_rate: Decimal,
    agency_fee: Decimal,
    lawyer_fees: Decimal,
    commission_override: Decimal | None,
) -> dict[str, Any]:
    commission_total = sale_price * commission_rate - agency_fee - lawyer_fees
    return {
        "sale_price": str(sale_price),
        "commission_rate": str(commission_rate),
        "agency_fee": str(agency_fee),
        "lawyer_fees": str(lawyer_fees),
        "commission_total": _money(commission_total),
        "commission_override": (
            _money(commission_override) if commission_override is not None else None
        ),
    }


def _deal_query_for_user(auth: AuthContext, user: dict[str, Any]):
    query = get_service_supabase().table("deals").select("*").eq("team_id", auth.team_id)
    if user["role"] != "MANAGER":
        query = query.eq("ren_id", user["id"])
    return query


def _get_accessible_deal(
    *,
    deal_id: UUID,
    auth: AuthContext,
    user: dict[str, Any],
) -> dict[str, Any]:
    response = _deal_query_for_user(auth, user).eq("id", str(deal_id)).single().execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deal not found",
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


def _lead_summary(lead: dict[str, Any] | None) -> dict[str, Any] | None:
    if not lead:
        return None
    return {
        "id": lead["id"],
        "name": lead.get("name"),
        "phone": lead.get("phone"),
        "email": lead.get("email"),
        "status": lead.get("status"),
        "budget_min": lead.get("budget_min"),
        "budget_max": lead.get("budget_max"),
        "preferred_property_type": lead.get("preferred_property_type"),
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


def _viewing_summary(viewing: dict[str, Any] | None) -> dict[str, Any] | None:
    if not viewing:
        return None
    return {
        "id": viewing["id"],
        "scheduled_at": viewing.get("scheduled_at"),
        "status": viewing.get("status"),
        "interest_level": viewing.get("interest_level"),
        "notes": viewing.get("notes"),
        "completed_at": viewing.get("completed_at"),
    }


def _deal_documents_by_deal(
    *,
    deal_ids: set[str],
    auth: AuthContext,
) -> dict[str, list[dict[str, Any]]]:
    if not deal_ids:
        return {}
    rows = (
        get_service_supabase()
        .table("deal_documents")
        .select("*")
        .eq("team_id", auth.team_id)
        .in_("deal_id", sorted(deal_ids))
        .execute()
        .data
    )
    grouped: dict[str, list[dict[str, Any]]] = {deal_id: [] for deal_id in deal_ids}
    for row in rows:
        grouped.setdefault(row["deal_id"], []).append(row)
    return grouped


def _safe_deal_documents_by_deal(
    *,
    deal_ids: set[str],
    auth: AuthContext,
) -> dict[str, list[dict[str, Any]]]:
    """Fetch deal documents but tolerate the table being absent.

    The `deal_documents` table is created by the
    ``202606011351_add_deal_pipeline_workflow`` migration. Until that has
    been applied to the target Supabase project, PostgREST returns
    ``PGRST205`` for any query against the missing table. Treating that as
    an empty result lets the rest of the deals workspace continue working
    while the operator finishes their migration push.
    """

    if not deal_ids:
        return {deal_id: [] for deal_id in deal_ids}
    try:
        return _deal_documents_by_deal(deal_ids=deal_ids, auth=auth)
    except Exception as exc:  # noqa: BLE001 - postgrest raises APIError
        code = getattr(exc, "code", None) or (
            exc.args[0].get("code") if exc.args and isinstance(exc.args[0], dict) else None
        )
        if code == "PGRST205":
            logger.warning(
                "deal_documents table is missing; returning empty document lists. "
                "Apply the latest Supabase migrations to enable deal documents."
            )
            return {deal_id: [] for deal_id in deal_ids}
        raise


def _timeline_by_lead(
    *,
    lead_ids: set[str],
    auth: AuthContext,
) -> dict[str, list[dict[str, Any]]]:
    if not lead_ids:
        return {}
    rows = (
        get_service_supabase()
        .table("timeline_events")
        .select("*")
        .eq("team_id", auth.team_id)
        .in_("lead_id", sorted(lead_ids))
        .execute()
        .data
    )
    grouped: dict[str, list[dict[str, Any]]] = {lead_id: [] for lead_id in lead_ids}
    for row in rows:
        grouped.setdefault(row["lead_id"], []).append(row)
    return grouped


def _enrich_deals(
    *,
    deals: list[dict[str, Any]],
    auth: AuthContext,
    include_documents: bool = False,
    include_timeline: bool = False,
) -> list[dict[str, Any]]:
    lead_refs = _records_by_id(
        table_name="leads",
        record_ids={deal["lead_id"] for deal in deals if deal.get("lead_id")},
        auth=auth,
    )
    property_refs = _records_by_id(
        table_name="properties",
        record_ids={deal["property_id"] for deal in deals if deal.get("property_id")},
        auth=auth,
    )
    viewing_refs = _records_by_id(
        table_name="viewings",
        record_ids={
            deal["origin_viewing_id"]
            for deal in deals
            if deal.get("origin_viewing_id")
        },
        auth=auth,
    )
    owner_refs = get_team_user_references(
        auth,
        {deal["ren_id"] for deal in deals if deal.get("ren_id")},
    )
    documents_by_deal = _safe_deal_documents_by_deal(
        deal_ids={deal["id"] for deal in deals},
        auth=auth,
    )
    timeline_by_lead = (
        _timeline_by_lead(
            lead_ids={deal["lead_id"] for deal in deals if deal.get("lead_id")},
            auth=auth,
        )
        if include_timeline
        else {}
    )
    enriched: list[dict[str, Any]] = []
    for deal in deals:
        documents = documents_by_deal.get(deal["id"], [])
        effective_probability = _effective_probability(deal)
        enriched_deal = {
            **deal,
            "stage": deal.get("stage") or "closed_won",
            "lead": _lead_summary(lead_refs.get(deal.get("lead_id"))),
            "property": _property_summary(property_refs.get(deal.get("property_id"))),
            "ren": owner_refs.get(deal.get("ren_id")),
            "owner": owner_refs.get(deal.get("ren_id")),
            "origin_viewing": _viewing_summary(
                viewing_refs.get(deal.get("origin_viewing_id"))
            ),
            "effective_probability": float(effective_probability),
            "projected_commission": _money(_effective_commission(deal)),
            "document_count": len(documents),
        }
        if include_documents:
            enriched_deal["documents"] = documents
        if include_timeline:
            timeline = timeline_by_lead.get(deal.get("lead_id"), [])
            deal_id = deal["id"]
            origin_viewing_id = deal.get("origin_viewing_id")
            enriched_deal["timeline"] = [
                event
                for event in timeline
                if event.get("payload", {}).get("deal_id") == deal_id
                or (
                    origin_viewing_id
                    and event.get("payload", {}).get("viewing_id") == origin_viewing_id
                )
            ]
        enriched.append(enriched_deal)
    return enriched


def _matches_workspace_filters(
    deal: dict[str, Any],
    *,
    q: str | None,
    property_type: str | None,
) -> bool:
    if property_type and deal.get("property", {}).get("type") != property_type:
        return False
    if not q:
        return True
    needle = q.lower()
    haystack = " ".join(
        str(value or "")
        for value in (
            deal.get("lead", {}).get("name"),
            deal.get("lead", {}).get("phone"),
            deal.get("lead", {}).get("email"),
            deal.get("property", {}).get("name"),
            deal.get("property", {}).get("type"),
            deal.get("property", {}).get("city"),
            deal.get("owner", {}).get("full_name"),
            deal.get("owner", {}).get("email"),
        )
    ).lower()
    return needle in haystack


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


def _validate_no_active_origin_deal(origin_viewing_id: UUID | None, auth: AuthContext) -> None:
    if origin_viewing_id is None:
        return
    existing = (
        get_service_supabase()
        .table("deals")
        .select("id,stage")
        .eq("team_id", auth.team_id)
        .eq("origin_viewing_id", str(origin_viewing_id))
        .neq("stage", "closed_lost")
        .execute()
        .data
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Viewing already has an active deal",
        )


def _get_lead_or_404(lead_id: UUID, auth: AuthContext) -> dict[str, Any]:
    lead = (
        get_service_supabase()
        .table("leads")
        .select("*")
        .eq("id", str(lead_id))
        .eq("team_id", auth.team_id)
        .single()
        .execute()
        .data
    )
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


def _get_property_or_404(property_id: UUID, auth: AuthContext) -> dict[str, Any]:
    property_row = (
        get_service_supabase()
        .table("properties")
        .select("*")
        .eq("id", str(property_id))
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
    return property_row


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


def _owner_for_deal(deal: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
    owner = (
        get_service_supabase()
        .table("users")
        .select("*")
        .eq("id", deal["ren_id"])
        .eq("team_id", auth.team_id)
        .single()
        .execute()
        .data
    )
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deal owner not found",
        )
    return owner


def _default_fees(auth: AuthContext) -> tuple[Decimal, Decimal]:
    config = (
        get_service_supabase()
        .table("team_config")
        .select("*")
        .eq("team_id", auth.team_id)
        .single()
        .execute()
        .data
    )
    return (
        Decimal(str(config["default_agency_fee"])),
        Decimal(str(config["default_lawyer_fees"])),
    )


def _run_won_cascade(
    *,
    supabase: Any,
    auth: AuthContext,
    deal: dict[str, Any],
    lead: dict[str, Any],
    deal_type: str,
    sale_price: Decimal,
    commission_total: str,
    created_by: str,
) -> None:
    CampaignCountersService(supabase).increment_conversion(lead.get("campaign_id"))
    supabase.table("leads").update({"status": LeadStatus.WON.value}).eq(
        "id", deal["lead_id"]
    ).execute()
    supabase.table("properties").update({"status": "Inactive"}).eq(
        "id", deal["property_id"]
    ).execute()
    other_links = (
        supabase.table("lead_properties")
        .select("lead_id")
        .eq("property_id", deal["property_id"])
        .eq("status", "active")
        .neq("lead_id", deal["lead_id"])
        .execute()
        .data
    )
    other_lead_ids = [link["lead_id"] for link in other_links]
    if other_lead_ids:
        (
            supabase.table("lead_properties")
            .update({"status": "inactive"})
            .eq("property_id", deal["property_id"])
            .eq("status", "active")
            .neq("lead_id", deal["lead_id"])
            .execute()
        )
        supabase.table("leads").update({"status": LeadStatus.LOST.value}).in_(
            "id", other_lead_ids
        ).execute()
    emit_timeline_event(
        supabase=supabase,
        auth=auth,
        lead_id=UUID(deal["lead_id"]),
        event_type=TimelineEventType.DEAL_WON,
        payload={
            "deal_id": deal["id"],
            "property_id": deal["property_id"],
            "deal_type": deal_type,
            "sale_price": str(sale_price),
            "commission_total": commission_total,
        },
        created_by=created_by,
    )
    emit_timeline_event(
        supabase=supabase,
        auth=auth,
        lead_id=UUID(deal["lead_id"]),
        event_type=TimelineEventType.DEAL_CLOSED,
        payload={
            "deal_id": deal["id"],
            "property_id": deal["property_id"],
            "deal_type": deal_type,
            "sale_price": str(sale_price),
            "commission_total": commission_total,
        },
        created_by=created_by,
    )
    emit_timeline_event(
        supabase=supabase,
        auth=auth,
        lead_id=UUID(deal["lead_id"]),
        event_type=TimelineEventType.LEAD_STATUS_CHANGED,
        payload={"from": lead["status"], "to": LeadStatus.WON.value},
        created_by=created_by,
    )
    for lead_id in other_lead_ids:
        emit_timeline_event(
            supabase=supabase,
            auth=auth,
            lead_id=UUID(lead_id),
            event_type=TimelineEventType.PROPERTY_UNLINKED,
            payload={"property_id": deal["property_id"]},
            created_by=created_by,
        )
        emit_timeline_event(
            supabase=supabase,
            auth=auth,
            lead_id=UUID(lead_id),
            event_type=TimelineEventType.LEAD_STATUS_CHANGED,
            payload={"from": LeadStatus.CONTACTED.value, "to": LeadStatus.LOST.value},
            created_by=created_by,
        )


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
    _validate_no_active_origin_deal(payload.origin_viewing_id, auth)
    lead = _get_lead_or_404(payload.lead_id, auth)
    _validate_active_link(payload.lead_id, payload.property_id)
    property_row = _get_property_or_404(payload.property_id, auth)
    deal_type = _validate_deal_type(property_row, payload.deal_type)
    agency_fee, lawyer_fees = _default_fees(auth)
    agency_fee = payload.agency_fee or agency_fee
    lawyer_fees = payload.lawyer_fees or lawyer_fees
    commission_payload = _commission_payload(
        sale_price=payload.sale_price,
        commission_rate=Decimal(str(user["commission_rate"])),
        agency_fee=agency_fee,
        lawyer_fees=lawyer_fees,
        commission_override=payload.commission_override,
    )
    insert_payload = {
        "team_id": auth.team_id,
        "lead_id": str(payload.lead_id),
        "property_id": str(payload.property_id),
        "ren_id": user["id"],
        "stage": "negotiation",
        "deal_type": deal_type,
        "expected_close_date": (
            payload.expected_close_date.isoformat()
            if payload.expected_close_date
            else None
        ),
        "probability_override": (
            str(payload.probability_override)
            if payload.probability_override is not None
            else None
        ),
        "notes": payload.notes,
        "origin_viewing_id": (
            str(payload.origin_viewing_id) if payload.origin_viewing_id else None
        ),
        "closed_at": None,
        "value_updated_at": datetime.now(UTC).isoformat(),
        **commission_payload,
    }
    deal = supabase.table("deals").insert(insert_payload).execute().data[0]
    emit_timeline_event(
        supabase=supabase,
        auth=auth,
        lead_id=payload.lead_id,
        event_type=TimelineEventType.DEAL_CREATED,
        payload={
            "deal_id": deal["id"],
            "property_id": str(payload.property_id),
            "origin_viewing_id": insert_payload["origin_viewing_id"],
            "stage": "negotiation",
        },
        created_by=user["id"],
    )
    return _enrich_deals(deals=[deal], auth=auth)[0]


@router.get("")
def list_deals(
    q: str | None = None,
    owner_id: UUID | None = None,
    stage: DealStage | None = None,
    property_type: str | None = None,
    expected_close_from: date | None = None,
    expected_close_to: date | None = None,
    deal_type: ListingType | None = None,
    auth: AuthContext = Depends(get_auth_context),
) -> list[dict[str, Any]]:
    user = get_current_user_record(auth)
    query = _deal_query_for_user(auth, user)
    if owner_id and user["role"] == "MANAGER":
        query = query.eq("ren_id", str(owner_id))
    if stage:
        query = query.eq("stage", stage)
    if expected_close_from:
        query = query.gte("expected_close_date", expected_close_from.isoformat())
    if expected_close_to:
        query = query.lte("expected_close_date", expected_close_to.isoformat())
    if deal_type:
        query = query.eq("deal_type", deal_type.value)
    deals = query.order("created_at", desc=True).execute().data
    enriched = _enrich_deals(deals=deals, auth=auth)
    return [
        deal
        for deal in enriched
        if _matches_workspace_filters(deal, q=q, property_type=property_type)
    ]


@router.get("/{deal_id}")
def get_deal(
    deal_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    user = get_current_user_record(auth)
    deal = _get_accessible_deal(deal_id=deal_id, auth=auth, user=user)
    return _enrich_deals(
        deals=[deal],
        auth=auth,
        include_documents=True,
        include_timeline=True,
    )[0]


@router.patch("/{deal_id}/stage")
def update_deal_stage(
    deal_id: UUID,
    payload: DealStageUpdate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    if payload.stage in TERMINAL_DEAL_STAGES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Use win or lose workflow for terminal stages",
        )
    user = get_current_user_record(auth)
    deal = _get_accessible_deal(deal_id=deal_id, auth=auth, user=user)
    previous_stage = deal.get("stage") or "closed_won"
    updated = (
        get_service_supabase()
        .table("deals")
        .update({"stage": payload.stage})
        .eq("id", str(deal_id))
        .eq("team_id", auth.team_id)
        .execute()
        .data[0]
    )
    emit_timeline_event(
        supabase=get_service_supabase(),
        auth=auth,
        lead_id=UUID(deal["lead_id"]),
        event_type=TimelineEventType.DEAL_STAGE_CHANGED,
        payload={
            "deal_id": str(deal_id),
            "from": previous_stage,
            "to": payload.stage,
        },
        created_by=user["id"],
    )
    return _enrich_deals(deals=[updated], auth=auth)[0]


@router.patch("/{deal_id}")
def update_deal(
    deal_id: UUID,
    payload: DealUpdate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    user = get_current_user_record(auth)
    deal = _get_accessible_deal(deal_id=deal_id, auth=auth, user=user)
    update_payload = payload.model_dump(exclude_unset=True)
    for key in ("sale_price", "agency_fee", "lawyer_fees", "commission_override"):
        if key in update_payload and update_payload[key] is not None:
            update_payload[key] = str(update_payload[key])
    if update_payload.get("expected_close_date") is not None:
        update_payload["expected_close_date"] = update_payload[
            "expected_close_date"
        ].isoformat()
    if update_payload.get("probability_override") is not None:
        update_payload["probability_override"] = str(update_payload["probability_override"])
    if any(
        key in update_payload
        for key in ("sale_price", "agency_fee", "lawyer_fees", "commission_override")
    ):
        sale_price = _decimal(update_payload.get("sale_price"), _decimal(deal["sale_price"]))
        agency_fee = _decimal(update_payload.get("agency_fee"), _decimal(deal["agency_fee"]))
        lawyer_fees = _decimal(
            update_payload.get("lawyer_fees"),
            _decimal(deal["lawyer_fees"]),
        )
        commission_override = (
            _decimal(update_payload["commission_override"])
            if "commission_override" in update_payload
            and update_payload["commission_override"] is not None
            else (
                _decimal(deal["commission_override"])
                if deal.get("commission_override") is not None
                else None
            )
        )
        update_payload.update(
            _commission_payload(
                sale_price=sale_price,
                commission_rate=_decimal(deal["commission_rate"]),
                agency_fee=agency_fee,
                lawyer_fees=lawyer_fees,
                commission_override=commission_override,
            )
        )
        update_payload["value_updated_at"] = datetime.now(UTC).isoformat()
    updated = (
        get_service_supabase()
        .table("deals")
        .update(update_payload)
        .eq("id", str(deal_id))
        .eq("team_id", auth.team_id)
        .execute()
        .data[0]
    )
    if "notes" in update_payload:
        emit_timeline_event(
            supabase=get_service_supabase(),
            auth=auth,
            lead_id=UUID(deal["lead_id"]),
            event_type=TimelineEventType.DEAL_NOTE_UPDATED,
            payload={"deal_id": str(deal_id)},
            created_by=user["id"],
        )
    return _enrich_deals(deals=[updated], auth=auth)[0]


@router.post("/{deal_id}/win")
def win_deal(
    deal_id: UUID,
    payload: DealWin,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    deal = _get_accessible_deal(deal_id=deal_id, auth=auth, user=user)
    owner = _owner_for_deal(deal, auth)
    lead = _get_lead_or_404(UUID(deal["lead_id"]), auth)
    property_row = _get_property_or_404(UUID(deal["property_id"]), auth)
    deal_type = _validate_deal_type(property_row, payload.deal_type)
    default_agency_fee, default_lawyer_fees = _default_fees(auth)
    agency_fee = payload.agency_fee or default_agency_fee
    lawyer_fees = payload.lawyer_fees or default_lawyer_fees
    commission_payload = _commission_payload(
        sale_price=payload.sale_price,
        commission_rate=Decimal(str(owner["commission_rate"])),
        agency_fee=agency_fee,
        lawyer_fees=lawyer_fees,
        commission_override=payload.commission_override,
    )
    update_payload = {
        **commission_payload,
        "stage": "closed_won",
        "deal_type": deal_type,
        "closed_at": datetime.now(UTC).isoformat(),
        "lost_reason": None,
        "lost_notes": None,
        "lost_at": None,
        "value_updated_at": datetime.now(UTC).isoformat(),
    }
    updated = (
        supabase.table("deals")
        .update(update_payload)
        .eq("id", str(deal_id))
        .eq("team_id", auth.team_id)
        .execute()
        .data[0]
    )
    _run_won_cascade(
        supabase=supabase,
        auth=auth,
        deal=updated,
        lead=lead,
        deal_type=deal_type,
        sale_price=payload.sale_price,
        commission_total=commission_payload["commission_total"],
        created_by=user["id"],
    )
    return _enrich_deals(deals=[updated], auth=auth)[0]


@router.post("/{deal_id}/lose")
def lose_deal(
    deal_id: UUID,
    payload: DealLose,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    deal = _get_accessible_deal(deal_id=deal_id, auth=auth, user=user)
    lost_at = datetime.now(UTC)
    updated = (
        supabase.table("deals")
        .update(
            {
                "stage": "closed_lost",
                "lost_reason": payload.lost_reason,
                "lost_notes": payload.lost_notes,
                "lost_at": lost_at.isoformat(),
            }
        )
        .eq("id", str(deal_id))
        .eq("team_id", auth.team_id)
        .execute()
        .data[0]
    )
    won_property_deals = (
        supabase.table("deals")
        .select("id")
        .eq("team_id", auth.team_id)
        .eq("property_id", deal["property_id"])
        .eq("stage", "closed_won")
        .execute()
        .data
    )
    if not won_property_deals:
        supabase.table("properties").update({"status": "Active"}).eq(
            "id", deal["property_id"]
        ).execute()
    emit_timeline_event(
        supabase=supabase,
        auth=auth,
        lead_id=UUID(deal["lead_id"]),
        event_type=TimelineEventType.DEAL_LOST,
        payload={
            "deal_id": str(deal_id),
            "lost_reason": payload.lost_reason,
            "lost_notes": payload.lost_notes,
        },
        created_by=user["id"],
    )
    return _enrich_deals(deals=[updated], auth=auth)[0]


# Lead status that a deal in each open stage implies. Used when reopening a
# closed deal so the lead reflects the active pipeline state again.
OPEN_STAGE_LEAD_STATUS: dict[str, str] = {
    "negotiation": LeadStatus.NEGOTIATION.value,
    "offer_made": LeadStatus.NEGOTIATION.value,
    "pending_contract": LeadStatus.PROPOSAL.value,
    "final_approval": LeadStatus.PROPOSAL.value,
}


def _run_reopen_cascade(
    *,
    supabase: Any,
    auth: AuthContext,
    deal: dict[str, Any],
    previous_stage: str,
    lead: dict[str, Any],
    target_stage: str,
    created_by: str,
) -> None:
    """Reverse the side-effects of a prior win/lose so the deal is open again."""

    if previous_stage == "closed_won":
        CampaignCountersService(supabase).decrement_conversion(
            lead.get("campaign_id")
        )

        target_lead_status = OPEN_STAGE_LEAD_STATUS.get(
            target_stage, LeadStatus.NEGOTIATION.value
        )
        if lead["status"] == LeadStatus.WON.value:
            supabase.table("leads").update({"status": target_lead_status}).eq(
                "id", deal["lead_id"]
            ).execute()
            emit_timeline_event(
                supabase=supabase,
                auth=auth,
                lead_id=UUID(deal["lead_id"]),
                event_type=TimelineEventType.LEAD_STATUS_CHANGED,
                payload={
                    "from": LeadStatus.WON.value,
                    "to": target_lead_status,
                },
                created_by=created_by,
            )

        # If no OTHER closed_won deal exists for this property, flip it back
        # to Active so it's available in the pipeline again. Competing leads
        # that were cascaded to Lost are intentionally left untouched: that
        # mutation is lossy and the operator can re-link / re-qualify them
        # explicitly if needed.
        other_won = (
            supabase.table("deals")
            .select("id")
            .eq("team_id", auth.team_id)
            .eq("property_id", deal["property_id"])
            .eq("stage", "closed_won")
            .neq("id", deal["id"])
            .execute()
            .data
            or []
        )
        if not other_won:
            supabase.table("properties").update({"status": "Active"}).eq(
                "id", deal["property_id"]
            ).execute()


@router.post("/{deal_id}/reopen")
def reopen_deal(
    deal_id: UUID,
    payload: DealReopen,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    """Move a terminal deal back to an open pipeline stage.

    Mirrors the inverse of ``win_deal`` / ``lose_deal``:

    * For a ``closed_won`` source we decrement the campaign conversion
      counter, revert the lead's status (Won -> Negotiation/Proposal), and
      re-activate the property if no other closed_won deal still owns it.
    * For a ``closed_lost`` source there is no cascade to undo - we simply
      drop the ``lost_reason`` / ``lost_notes`` / ``lost_at`` payload.

    Competing leads that were cascaded to Lost during a previous win are
    NOT auto-reactivated: that state change is lossy and should be
    corrected by the operator explicitly.
    """
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    deal = _get_accessible_deal(deal_id=deal_id, auth=auth, user=user)
    previous_stage = deal.get("stage") or "closed_won"
    if previous_stage not in TERMINAL_DEAL_STAGES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only closed deals can be reopened",
        )
    lead = _get_lead_or_404(UUID(deal["lead_id"]), auth)
    updated = (
        supabase.table("deals")
        .update(
            {
                "stage": payload.stage,
                "closed_at": None,
                "lost_reason": None,
                "lost_notes": None,
                "lost_at": None,
                "value_updated_at": datetime.now(UTC).isoformat(),
            }
        )
        .eq("id", str(deal_id))
        .eq("team_id", auth.team_id)
        .execute()
        .data[0]
    )
    _run_reopen_cascade(
        supabase=supabase,
        auth=auth,
        deal=updated,
        previous_stage=previous_stage,
        lead=lead,
        target_stage=payload.stage,
        created_by=user["id"],
    )
    emit_timeline_event(
        supabase=supabase,
        auth=auth,
        lead_id=UUID(deal["lead_id"]),
        event_type=TimelineEventType.DEAL_STAGE_CHANGED,
        payload={
            "deal_id": str(deal_id),
            "from": previous_stage,
            "to": payload.stage,
            "reopened": True,
        },
        created_by=user["id"],
    )
    return _enrich_deals(deals=[updated], auth=auth)[0]


@router.get("/{deal_id}/documents")
def list_deal_documents(
    deal_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
) -> list[dict[str, Any]]:
    user = get_current_user_record(auth)
    _get_accessible_deal(deal_id=deal_id, auth=auth, user=user)
    return (
        get_service_supabase()
        .table("deal_documents")
        .select("*")
        .eq("team_id", auth.team_id)
        .eq("deal_id", str(deal_id))
        .order("created_at", desc=True)
        .execute()
        .data
    )


@router.post("/{deal_id}/documents", status_code=status.HTTP_201_CREATED)
def create_deal_document(
    deal_id: UUID,
    payload: DealDocumentCreate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    user = get_current_user_record(auth)
    deal = _get_accessible_deal(deal_id=deal_id, auth=auth, user=user)
    document = (
        get_service_supabase()
        .table("deal_documents")
        .insert(
            {
                "team_id": auth.team_id,
                "deal_id": str(deal_id),
                "label": payload.label.strip(),
                "url": payload.url,
                "kind": payload.kind,
                "created_by": user["id"],
            }
        )
        .execute()
        .data[0]
    )
    emit_timeline_event(
        supabase=get_service_supabase(),
        auth=auth,
        lead_id=UUID(deal["lead_id"]),
        event_type=TimelineEventType.DEAL_DOCUMENT_ADDED,
        payload={"deal_id": str(deal_id), "document_id": document["id"]},
        created_by=user["id"],
    )
    return document


@router.delete("/{deal_id}/documents/{document_id}")
def delete_deal_document(
    deal_id: UUID,
    document_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, bool]:
    user = get_current_user_record(auth)
    deal = _get_accessible_deal(deal_id=deal_id, auth=auth, user=user)
    deleted = (
        get_service_supabase()
        .table("deal_documents")
        .delete()
        .eq("team_id", auth.team_id)
        .eq("deal_id", str(deal_id))
        .eq("id", str(document_id))
        .execute()
        .data
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    emit_timeline_event(
        supabase=get_service_supabase(),
        auth=auth,
        lead_id=UUID(deal["lead_id"]),
        event_type=TimelineEventType.DEAL_DOCUMENT_REMOVED,
        payload={"deal_id": str(deal_id), "document_id": str(document_id)},
        created_by=user["id"],
    )
    return {"deleted": True}
