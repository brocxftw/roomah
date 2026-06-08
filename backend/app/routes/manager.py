from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

from app.auth import AuthContext, get_auth_context
from app.models import LeadStatus
from app.supabase import get_service_supabase
from app.users import get_current_user_record, require_manager

router = APIRouter(prefix="/manager", tags=["manager"])


class TeamTargetUpdate(BaseModel):
    monthly_target_amount: Decimal | None = Field(default=None, ge=0)


class CoachingNoteCreate(BaseModel):
    body: str = Field(min_length=1)

    @field_validator("body")
    @classmethod
    def validate_body(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("body is required")
        return trimmed


OPEN_LEAD_STATUSES = {
    LeadStatus.NEW.value,
    LeadStatus.CONTACTED.value,
    LeadStatus.QUALIFIED.value,
    LeadStatus.PROPOSAL.value,
    LeadStatus.NEGOTIATION.value,
    "Active",
    "Negotiating",
}
DEAL_STAGES = [
    "negotiation",
    "offer_made",
    "pending_contract",
    "final_approval",
    "closed_won",
    "closed_lost",
]
OPEN_DEAL_STAGES = set(DEAL_STAGES[:4])
STAGE_DEFAULT_PROBABILITIES = {
    "negotiation": Decimal("30"),
    "offer_made": Decimal("50"),
    "pending_contract": Decimal("70"),
    "final_approval": Decimal("85"),
    "closed_won": Decimal("100"),
    "closed_lost": Decimal("0"),
}


def _parse_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=UTC)
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _parse_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    parsed = _parse_datetime(value)
    return parsed.date() if parsed else None


def _decimal(value: Any, fallback: Decimal = Decimal("0")) -> Decimal:
    if value is None:
        return fallback
    return Decimal(str(value))


def _decimal_text(value: Decimal) -> str:
    text = format(value.quantize(Decimal("0.01")), "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def _sum_commission(deals: list[dict[str, Any]]) -> Decimal:
    return sum(
        (
            _decimal(deal.get("commission_override") or deal.get("commission_total"))
            for deal in deals
        ),
        Decimal("0"),
    )


def _effective_probability(deal: dict[str, Any]) -> Decimal:
    if deal.get("probability_override") is not None:
        return _decimal(deal["probability_override"])
    return STAGE_DEFAULT_PROBABILITIES.get(deal.get("stage") or "closed_won", Decimal("0"))


def _month_start(value: datetime) -> datetime:
    return value.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _add_months(value: datetime, months: int) -> datetime:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return value.replace(year=year, month=month, day=1)


def _week_start(value: datetime) -> datetime:
    start_of_day = value.replace(hour=0, minute=0, second=0, microsecond=0)
    return start_of_day - timedelta(days=start_of_day.weekday())


def _pct_delta(current: Decimal, previous: Decimal) -> float | None:
    if previous == 0:
        return None
    return float((current - previous) / previous)


def _date_in_range(value: Any, start: datetime, end: datetime) -> bool:
    parsed = _parse_datetime(value)
    return parsed is not None and start <= parsed < end


def _author_payload(user: dict[str, Any] | None) -> dict[str, Any] | None:
    if not user:
        return None
    return {
        "id": user["id"],
        "full_name": user.get("full_name") or user.get("email"),
        "email": user.get("email"),
    }


def _team_user_or_404(auth: AuthContext, user_id: UUID | str) -> dict[str, Any]:
    user = (
        get_service_supabase()
        .table("users")
        .select("*")
        .eq("team_id", auth.team_id)
        .eq("id", str(user_id))
        .maybe_single()
        .execute()
        .data
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found",
        )
    return user


def _enrich_note(
    note: dict[str, Any],
    users_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    return {
        **note,
        "author": _author_payload(users_by_id.get(note.get("manager_id"))),
    }


@router.get("/workspace")
def get_manager_workspace(
    selected_ren_id: UUID | None = Query(default=None, alias="ren"),
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    require_manager(user)
    now = datetime.now(UTC)
    month_start = _month_start(now)
    next_month_start = _add_months(month_start, 1)
    previous_month_start = _add_months(month_start, -1)
    previous_month_end = month_start
    trailing_30_start = now - timedelta(days=30)
    previous_30_start = now - timedelta(days=60)
    follow_up_cutoff = now - timedelta(days=2)
    viewings_cutoff = now + timedelta(days=7)
    closing_cutoff = now.date() + timedelta(days=14)

    users = (
        supabase.table("users")
        .select("*")
        .eq("team_id", auth.team_id)
        .execute()
        .data
    )
    users_by_id = {team_user["id"]: team_user for team_user in users}
    ren_users = sorted(
        [team_user for team_user in users if team_user.get("role") == "REN"],
        key=lambda row: str(row.get("full_name") or row.get("email") or ""),
    )
    leads = (
        supabase.table("leads")
        .select("*")
        .eq("team_id", auth.team_id)
        .execute()
        .data
    )
    viewings = (
        supabase.table("viewings")
        .select("*")
        .eq("team_id", auth.team_id)
        .execute()
        .data
    )
    deals = (
        supabase.table("deals")
        .select("*")
        .eq("team_id", auth.team_id)
        .execute()
        .data
    )
    notes = (
        supabase.table("coaching_notes")
        .select("*")
        .eq("team_id", auth.team_id)
        .execute()
        .data
    )
    team = (
        supabase.table("teams")
        .select("*")
        .eq("id", auth.team_id)
        .maybe_single()
        .execute()
        .data
    )

    current_won_deals = [
        deal
        for deal in deals
        if (deal.get("stage") or "closed_won") == "closed_won"
        and _date_in_range(deal.get("closed_at"), month_start, next_month_start)
    ]
    previous_won_deals = [
        deal
        for deal in deals
        if (deal.get("stage") or "closed_won") == "closed_won"
        and _date_in_range(deal.get("closed_at"), previous_month_start, previous_month_end)
    ]
    open_deals = [
        deal
        for deal in deals
        if (deal.get("stage") or "closed_won") in OPEN_DEAL_STAGES
    ]
    open_pipeline_value = sum(_decimal(deal.get("sale_price")) for deal in open_deals)
    weighted_pipeline_value = sum(
        _decimal(deal.get("sale_price")) * (_effective_probability(deal) / Decimal("100"))
        for deal in open_deals
    )
    current_commission = _sum_commission(current_won_deals)
    previous_commission = _sum_commission(previous_won_deals)
    current_revenue = sum(_decimal(deal.get("sale_price")) for deal in current_won_deals)
    previous_revenue = sum(_decimal(deal.get("sale_price")) for deal in previous_won_deals)

    recent_leads = [
        lead for lead in leads if _date_in_range(lead.get("created_at"), trailing_30_start, now)
    ]
    previous_recent_leads = [
        lead
        for lead in leads
        if _date_in_range(lead.get("created_at"), previous_30_start, trailing_30_start)
    ]
    recent_lead_ids = {lead["id"] for lead in recent_leads}
    previous_recent_lead_ids = {lead["id"] for lead in previous_recent_leads}
    recent_won_leads = {
        deal["lead_id"]
        for deal in deals
        if (deal.get("stage") or "closed_won") == "closed_won"
        and deal.get("lead_id") in recent_lead_ids
    }
    previous_won_leads = {
        deal["lead_id"]
        for deal in deals
        if (deal.get("stage") or "closed_won") == "closed_won"
        and deal.get("lead_id") in previous_recent_lead_ids
    }
    current_conversion = (
        None if not recent_leads else Decimal(len(recent_won_leads)) / Decimal(len(recent_leads))
    )
    previous_conversion = (
        None
        if not previous_recent_leads
        else Decimal(len(previous_won_leads)) / Decimal(len(previous_recent_leads))
    )
    target_amount = _decimal((team or {}).get("monthly_target_amount"), Decimal("0"))
    target_progress = None if target_amount == 0 else float(current_commission / target_amount)

    follow_ups_due = [
        lead
        for lead in leads
        if lead.get("status") in OPEN_LEAD_STATUSES
        and (
            parsed := _parse_datetime(lead.get("last_interaction_at"))
        ) is not None
        and parsed <= follow_up_cutoff
    ]
    upcoming_viewings = [
        viewing
        for viewing in viewings
        if viewing.get("status") == "scheduled"
        and (
            parsed := _parse_datetime(viewing.get("scheduled_at"))
        ) is not None
        and now <= parsed <= viewings_cutoff
    ]
    deals_closing_soon = [
        deal
        for deal in open_deals
        if (
            expected_close_date := _parse_date(deal.get("expected_close_date"))
        ) is not None
        and now.date() <= expected_close_date <= closing_cutoff
    ]

    analytics = {
        "pipeline_distribution": _pipeline_distribution(deals),
        "performance_trend": _weekly_closed_won_series(deals, now),
        "commission_trend": _monthly_commission_series(deals, now),
    }
    team_performance = [
        _team_performance_row(ren, leads, viewings, deals, now)
        for ren in ren_users
    ]

    selected_member = None
    if selected_ren_id is not None:
        selected_user = users_by_id.get(str(selected_ren_id))
        selected_member = (
            _selected_member_payload(selected_user, leads, viewings, deals, notes, users_by_id, now)
            if selected_user
            else {"ren_id": str(selected_ren_id), "not_found": True}
        )

    return {
        "kpis": {
            "closed_won_mtd": {
                "count": len(current_won_deals),
                "value": _decimal_text(current_revenue),
                "change": _pct_delta(current_revenue, previous_revenue),
            },
            "commission_mtd": {
                "value": _decimal_text(current_commission),
                "change": _pct_delta(current_commission, previous_commission),
            },
            "active_pipeline_value": {
                "value": _decimal_text(open_pipeline_value),
                "weighted_value": _decimal_text(weighted_pipeline_value),
            },
            "team_conversion": {
                "value": float(current_conversion) if current_conversion is not None else None,
                "change": (
                    None
                    if current_conversion is None or previous_conversion in (None, Decimal("0"))
                    else float((current_conversion - previous_conversion) / previous_conversion)
                ),
            },
            "target_attainment": {
                "target_amount": _decimal_text(target_amount) if target_amount else None,
                "current_amount": _decimal_text(current_commission),
                "progress_ratio": target_progress,
            },
        },
        "analytics": analytics,
        "team_performance": team_performance,
        "alerts": {
            "follow_ups_due": {
                "count": len(follow_ups_due),
                "href": "/app/leads?status=overdue",
            },
            "upcoming_viewings": {
                "count": len(upcoming_viewings),
                "href": "/app/viewings",
            },
            "deals_closing_soon": {
                "count": len(deals_closing_soon),
                "href": "/app/deals?closing=soon",
            },
        },
        "selected_member": selected_member,
    }


def _pipeline_distribution(deals: list[dict[str, Any]]) -> list[dict[str, Any]]:
    stage_counts = {stage: 0 for stage in DEAL_STAGES}
    for deal in deals:
        stage = deal.get("stage") or "closed_won"
        if stage in stage_counts:
            stage_counts[stage] += 1
    return [{"stage": stage, "count": stage_counts[stage]} for stage in DEAL_STAGES]


def _weekly_closed_won_series(
    deals: list[dict[str, Any]],
    now: datetime,
    *,
    ren_id: str | None = None,
) -> list[dict[str, Any]]:
    first_week = _week_start(now) - timedelta(weeks=11)
    buckets = [
        {"period": (first_week + timedelta(weeks=index)).date().isoformat(), "count": 0}
        for index in range(12)
    ]
    for deal in deals:
        if ren_id is not None and deal.get("ren_id") != ren_id:
            continue
        if (deal.get("stage") or "closed_won") != "closed_won":
            continue
        closed_at = _parse_datetime(deal.get("closed_at"))
        if closed_at is None:
            continue
        index = (_week_start(closed_at) - first_week).days // 7
        if 0 <= index < len(buckets):
            buckets[index]["count"] += 1
    return buckets


def _monthly_commission_series(
    deals: list[dict[str, Any]],
    now: datetime,
    *,
    ren_id: str | None = None,
) -> list[dict[str, Any]]:
    first_month = _add_months(_month_start(now), -5)
    buckets = [
        {
            "period": _add_months(first_month, index).date().isoformat(),
            "commission": "0",
        }
        for index in range(6)
    ]
    bucket_totals = [Decimal("0") for _ in range(6)]
    for deal in deals:
        if ren_id is not None and deal.get("ren_id") != ren_id:
            continue
        if (deal.get("stage") or "closed_won") != "closed_won":
            continue
        closed_at = _parse_datetime(deal.get("closed_at"))
        if closed_at is None:
            continue
        index = (closed_at.year - first_month.year) * 12 + closed_at.month - first_month.month
        if 0 <= index < len(bucket_totals):
            bucket_totals[index] += _decimal(
                deal.get("commission_override") or deal.get("commission_total")
            )
    for index, total in enumerate(bucket_totals):
        buckets[index]["commission"] = _decimal_text(total)
    return buckets


def _team_performance_row(
    ren: dict[str, Any],
    leads: list[dict[str, Any]],
    viewings: list[dict[str, Any]],
    deals: list[dict[str, Any]],
    now: datetime,
) -> dict[str, Any]:
    ren_id = ren["id"]
    month_start = _month_start(now)
    next_month_start = _add_months(month_start, 1)
    ren_leads = [lead for lead in leads if lead.get("ren_id") == ren_id]
    active_pipeline = sum(1 for lead in ren_leads if lead.get("status") in OPEN_LEAD_STATUSES)
    ren_viewings = [viewing for viewing in viewings if viewing.get("assigned_ren_id") == ren_id]
    completed_viewings = sum(1 for viewing in ren_viewings if viewing.get("status") == "completed")
    upcoming_viewings = sum(
        1
        for viewing in ren_viewings
        if viewing.get("status") == "scheduled"
        and (parsed := _parse_datetime(viewing.get("scheduled_at"))) is not None
        and parsed >= now
    )
    current_won_deals = [
        deal
        for deal in deals
        if deal.get("ren_id") == ren_id
        and (deal.get("stage") or "closed_won") == "closed_won"
        and _date_in_range(deal.get("closed_at"), month_start, next_month_start)
    ]
    won_lead_ids = {deal.get("lead_id") for deal in current_won_deals}
    conversion_rate = None if not ren_leads else len(won_lead_ids) / len(ren_leads)
    commission = _sum_commission(current_won_deals)
    return {
        "ren_id": ren_id,
        "name": ren.get("full_name") or ren.get("email"),
        "email": ren.get("email"),
        "phone_number": ren.get("phone_number"),
        "role": ren.get("role"),
        "active_status": ren.get("active_status"),
        "avatar_initials": _initials(ren.get("full_name") or ren.get("email") or ""),
        "active_pipeline": active_pipeline,
        "activity": {
            "completed_viewings": completed_viewings,
            "upcoming_viewings": upcoming_viewings,
            "closed_won_mtd": len(current_won_deals),
        },
        "financial": {
            "commission_mtd": _decimal_text(commission),
            "conversion_rate": conversion_rate,
        },
        "trend": _monthly_commission_series(deals, now, ren_id=ren_id),
    }


def _selected_member_payload(
    selected_user: dict[str, Any],
    leads: list[dict[str, Any]],
    viewings: list[dict[str, Any]],
    deals: list[dict[str, Any]],
    notes: list[dict[str, Any]],
    users_by_id: dict[str, dict[str, Any]],
    now: datetime,
) -> dict[str, Any]:
    ren_id = selected_user["id"]
    row = _team_performance_row(selected_user, leads, viewings, deals, now)
    month_start = _month_start(now)
    next_month_start = _add_months(month_start, 1)
    ren_deals = [deal for deal in deals if deal.get("ren_id") == ren_id]
    current_won_deals = [
        deal
        for deal in ren_deals
        if (deal.get("stage") or "closed_won") == "closed_won"
        and _date_in_range(deal.get("closed_at"), month_start, next_month_start)
    ]
    current_commission = _sum_commission(current_won_deals)
    target_amount = _decimal(selected_user.get("monthly_target_amount"), Decimal("0"))
    member_notes = sorted(
        [note for note in notes if note.get("ren_id") == ren_id],
        key=lambda note: str(note.get("created_at") or ""),
        reverse=True,
    )
    return {
        "ren_id": ren_id,
        "name": selected_user.get("full_name") or selected_user.get("email"),
        "avatar_initials": _initials(
            selected_user.get("full_name") or selected_user.get("email") or ""
        ),
        "status": "active" if selected_user.get("active_status") else "inactive",
        "contact": {
            "full_name": selected_user.get("full_name"),
            "email": selected_user.get("email"),
            "phone_number": selected_user.get("phone_number"),
            "active_status": selected_user.get("active_status"),
        },
        "commission_configuration": {
            "commission_rate": str(selected_user.get("commission_rate")),
            "monthly_target_amount": (
                str(selected_user.get("monthly_target_amount"))
                if selected_user.get("monthly_target_amount") is not None
                else None
            ),
        },
        "targets": {
            "target_amount": _decimal_text(target_amount) if target_amount else None,
            "current_amount": _decimal_text(current_commission),
            "progress_ratio": (
                None if target_amount == 0 else float(current_commission / target_amount)
            ),
        },
        "performance": {
            **row,
            "pipeline_distribution": _pipeline_distribution(ren_deals),
            "performance_trend": _weekly_closed_won_series(deals, now, ren_id=ren_id),
            "commission_trend": _monthly_commission_series(deals, now, ren_id=ren_id),
        },
        "notes": [_enrich_note(note, users_by_id) for note in member_notes],
    }


def _initials(value: str) -> str:
    parts = [part for part in value.replace("@", " ").replace(".", " ").split() if part]
    return "".join(part[0].upper() for part in parts[:2]) or "?"


@router.get("/dashboard")
def get_manager_dashboard(
    auth: AuthContext = Depends(get_auth_context),
) -> list[dict[str, Any]]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    require_manager(user)
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    previous_month_start = (month_start - timedelta(days=1)).replace(day=1)

    users = (
        supabase.table("users")
        .select("id,email,role,full_name,phone_number,active_status")
        .eq("team_id", auth.team_id)
        .execute()
        .data
    )
    leads = (
        supabase.table("leads")
        .select("id,ren_id,status")
        .eq("team_id", auth.team_id)
        .execute()
        .data
    )
    viewings = (
        supabase.table("viewings")
        .select("id,assigned_ren_id,scheduled_at")
        .eq("team_id", auth.team_id)
        .gte("scheduled_at", month_start.isoformat())
        .execute()
        .data
    )
    current_deals = (
        supabase.table("deals")
        .select("ren_id,commission_total,commission_override")
        .eq("team_id", auth.team_id)
        .gte("closed_at", month_start.isoformat())
        .execute()
        .data
    )
    previous_deals = (
        supabase.table("deals")
        .select("ren_id,commission_total,commission_override")
        .eq("team_id", auth.team_id)
        .gte("closed_at", previous_month_start.isoformat())
        .lt("closed_at", month_start.isoformat())
        .execute()
        .data
    )

    pipeline: dict[str, dict[str, int]] = defaultdict(
        lambda: {
            LeadStatus.NEW.value: 0,
            LeadStatus.CONTACTED.value: 0,
            LeadStatus.QUALIFIED.value: 0,
            LeadStatus.PROPOSAL.value: 0,
            LeadStatus.NEGOTIATION.value: 0,
            LeadStatus.WON.value: 0,
            LeadStatus.LOST.value: 0,
        }
    )
    for lead in leads:
        pipeline[lead["ren_id"]][lead["status"]] += 1

    viewing_counts: dict[str, int] = defaultdict(int)
    for viewing in viewings:
        viewing_counts[viewing["assigned_ren_id"]] += 1

    def commission_by_ren(deals: list[dict[str, Any]]) -> dict[str, Decimal]:
        totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
        for deal in deals:
            value = Decimal(
                str(deal.get("commission_override") or deal["commission_total"])
            )
            totals[deal["ren_id"]] += value
        return totals

    current_commission = commission_by_ren(current_deals)
    previous_commission = commission_by_ren(previous_deals)

    return [
        {
            "ren_id": ren["id"],
            "ren_name": ren["full_name"],
            "ren_email": ren["email"],
            "ren_phone_number": ren.get("phone_number"),
            "ren_active_status": ren["active_status"],
            "active_leads": sum(
                pipeline[ren["id"]][status]
                for status in [
                    LeadStatus.NEW.value,
                    LeadStatus.CONTACTED.value,
                    LeadStatus.QUALIFIED.value,
                    LeadStatus.PROPOSAL.value,
                    LeadStatus.NEGOTIATION.value,
                ]
            ),
            "pipeline": pipeline[ren["id"]],
            "viewing_count": viewing_counts[ren["id"]],
            "commission": str(current_commission[ren["id"]]),
            "monthly_trend": str(
                current_commission[ren["id"]] - previous_commission[ren["id"]]
            ),
        }
        for ren in users
    ]


@router.patch("/team-target")
def update_team_target(
    payload: TeamTargetUpdate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    require_manager(user)
    response = (
        supabase.table("teams")
        .update(payload.model_dump(mode="json"))
        .eq("id", auth.team_id)
        .execute()
    )
    return response.data[0]


@router.get("/campaigns")
def get_manager_campaigns(
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, list[dict[str, Any]]]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    require_manager(user)
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    campaigns = (
        supabase.table("marketing_campaigns")
        .select("*")
        .eq("team_id", auth.team_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    leads = (
        supabase.table("leads")
        .select("id,campaign_id,created_at")
        .eq("team_id", auth.team_id)
        .execute()
        .data
    )
    campaign_leads_month: dict[str, int] = defaultdict(int)
    lead_campaign: dict[str, str] = {}
    for lead in leads:
        campaign_id = lead.get("campaign_id")
        if not campaign_id:
            continue
        lead_campaign[lead["id"]] = campaign_id
        created_at = datetime.fromisoformat(lead["created_at"].replace("Z", "+00:00"))
        if created_at >= month_start:
            campaign_leads_month[campaign_id] += 1

    deals = (
        supabase.table("deals")
        .select("id,lead_id,closed_at")
        .eq("team_id", auth.team_id)
        .execute()
        .data
    )
    campaign_conversions_month: dict[str, int] = defaultdict(int)
    for deal in deals:
        campaign_id = lead_campaign.get(deal["lead_id"])
        if not campaign_id:
            continue
        closed_at = datetime.fromisoformat(deal["closed_at"].replace("Z", "+00:00"))
        if closed_at >= month_start:
            campaign_conversions_month[campaign_id] += 1

    campaign_rows = [
        {
            **campaign,
            "ad_spending_month": campaign["ad_spending"],
            "leads_generated_month": campaign_leads_month[campaign["id"]],
            "conversions_month": campaign_conversions_month[campaign["id"]],
        }
        for campaign in campaigns
    ]

    channel_rollups: dict[str, dict[str, Any]] = {}
    for row in campaign_rows:
        rollup = channel_rollups.setdefault(
            row["channel"],
            {
                "channel": row["channel"],
                "ad_spending": Decimal("0"),
                "leads_generated": 0,
                "conversions": 0,
            },
        )
        rollup["ad_spending"] += Decimal(str(row["ad_spending"]))
        rollup["leads_generated"] += int(row["leads_generated"])
        rollup["conversions"] += int(row["conversions"])

    return {
        "campaigns": campaign_rows,
        "channel_rollups": [
            {**rollup, "ad_spending": str(rollup["ad_spending"])}
            for rollup in channel_rollups.values()
        ],
    }


@router.get("/team/{ren_id}/notes")
def list_coaching_notes(
    ren_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
) -> list[dict[str, Any]]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    require_manager(user)
    _team_user_or_404(auth, ren_id)
    notes = (
        supabase.table("coaching_notes")
        .select("*")
        .eq("team_id", auth.team_id)
        .eq("ren_id", str(ren_id))
        .order("created_at", desc=True)
        .execute()
        .data
    )
    users = (
        supabase.table("users")
        .select("id,email,full_name")
        .eq("team_id", auth.team_id)
        .execute()
        .data
    )
    users_by_id = {team_user["id"]: team_user for team_user in users}
    return [
        _enrich_note(note, users_by_id)
        for note in sorted(
            notes,
            key=lambda note: str(note.get("created_at") or ""),
            reverse=True,
        )
    ]


@router.post("/team/{ren_id}/notes")
def create_coaching_note(
    ren_id: UUID,
    payload: CoachingNoteCreate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    require_manager(user)
    _team_user_or_404(auth, ren_id)
    response = (
        supabase.table("coaching_notes")
        .insert(
            {
                "team_id": auth.team_id,
                "ren_id": str(ren_id),
                "manager_id": auth.user_id,
                "body": payload.body,
            }
        )
        .execute()
    )
    return _enrich_note(response.data[0], {auth.user_id: user})


@router.delete("/team/{ren_id}/notes/{note_id}")
def delete_coaching_note(
    ren_id: UUID,
    note_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, bool]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    require_manager(user)
    _team_user_or_404(auth, ren_id)
    response = (
        supabase.table("coaching_notes")
        .delete()
        .eq("team_id", auth.team_id)
        .eq("ren_id", str(ren_id))
        .eq("id", str(note_id))
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coaching note not found",
        )
    return {"deleted": True}
