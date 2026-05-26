from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends

from app.auth import AuthContext, get_auth_context
from app.models import LeadStatus
from app.supabase import get_service_supabase
from app.users import get_current_user_record

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

PIPELINE_STAGES = [
    LeadStatus.NEW.value,
    LeadStatus.CONTACTED.value,
    LeadStatus.QUALIFIED.value,
    LeadStatus.PROPOSAL.value,
    LeadStatus.NEGOTIATION.value,
    LeadStatus.WON.value,
]
IN_FLIGHT_LEAD_STATUSES = [
    LeadStatus.NEW.value,
    LeadStatus.CONTACTED.value,
    LeadStatus.QUALIFIED.value,
    LeadStatus.PROPOSAL.value,
    LeadStatus.NEGOTIATION.value,
]
CONVERSION_DENOMINATOR_STATUSES = [
    LeadStatus.QUALIFIED.value,
    LeadStatus.PROPOSAL.value,
    LeadStatus.NEGOTIATION.value,
    LeadStatus.WON.value,
]


def _date_range_start(now: datetime, date_range: str) -> datetime:
    if date_range == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if date_range == "week":
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return start_of_day - timedelta(days=start_of_day.weekday())
    if date_range == "quarter":
        quarter_month = ((now.month - 1) // 3) * 3 + 1
        return now.replace(
            month=quarter_month,
            day=1,
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _sum_commission(deals: list[dict[str, Any]]) -> Decimal:
    return sum(
        Decimal(str(deal.get("commission_override") or deal["commission_total"]))
        for deal in deals
    )


def _decimal_from_row(row: dict[str, Any], *keys: str) -> Decimal:
    for key in keys:
        value = row.get(key)
        if value is not None:
            return Decimal(str(value))
    return Decimal("0")


@router.get("")
def get_dashboard(
    date_range: str = "month",
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    now = datetime.now(UTC)
    two_days_ago = now - timedelta(days=2)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    range_start = _date_range_start(now, date_range)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start = today_start + timedelta(days=1)
    seven_days_from_now = now + timedelta(days=7)

    def lead_query(select: str = "*"):
        query = supabase.table("leads").select(select).eq("team_id", auth.team_id)
        if user["role"] != "MANAGER":
            query = query.eq("ren_id", user["id"])
        return query

    def property_query(select: str = "*"):
        query = supabase.table("properties").select(select).eq("team_id", auth.team_id)
        if user["role"] != "MANAGER":
            query = query.eq("ren_id", user["id"])
        return query

    def viewing_query(select: str = "*"):
        query = supabase.table("viewings").select(select).eq("team_id", auth.team_id)
        if user["role"] != "MANAGER":
            query = query.eq("assigned_ren_id", user["id"])
        return query

    def deal_query(select: str = "*"):
        query = supabase.table("deals").select(select).eq("team_id", auth.team_id)
        if user["role"] != "MANAGER":
            query = query.eq("ren_id", user["id"])
        return query

    follow_ups_due = (
        lead_query()
        .in_("status", IN_FLIGHT_LEAD_STATUSES)
        .lte("last_interaction_at", two_days_ago.isoformat())
        .order("last_interaction_at")
        .execute()
        .data
    )
    upcoming_viewings = (
        viewing_query()
        .eq("status", "scheduled")
        .gte("scheduled_at", now.isoformat())
        .lte("scheduled_at", seven_days_from_now.isoformat())
        .order("scheduled_at")
        .execute()
        .data
    )
    deals_closing_soon = (
        lead_query()
        .eq("status", LeadStatus.NEGOTIATION.value)
        .order("last_interaction_at", desc=True)
        .execute()
        .data
    )
    today_agenda = (
        viewing_query()
        .eq("status", "scheduled")
        .gte("scheduled_at", today_start.isoformat())
        .lt("scheduled_at", tomorrow_start.isoformat())
        .order("scheduled_at")
        .execute()
        .data
    )

    active_leads = (
        lead_query("id")
        .in_("status", IN_FLIGHT_LEAD_STATUSES)
        .execute()
        .data
    )
    funnel_leads = lead_query("id,status").in_("status", PIPELINE_STAGES).execute().data
    funnel_counts = {stage: 0 for stage in PIPELINE_STAGES}
    funnel_values = {stage: Decimal("0") for stage in PIPELINE_STAGES}
    for funnel_lead in funnel_leads:
        funnel_status = funnel_lead.get("status")
        if funnel_status in funnel_counts:
            funnel_counts[funnel_status] += 1

    funnel_lead_ids = [lead["id"] for lead in funnel_leads]
    lead_to_property_id: dict[str, str] = {}
    if funnel_lead_ids:
        lead_property_links = (
            supabase.table("lead_properties")
            .select("lead_id,property_id,status,created_at")
            .in_("lead_id", funnel_lead_ids)
            .eq("status", "active")
            .execute()
            .data
        )
        for link in sorted(
            lead_property_links,
            key=lambda row: str(row.get("created_at") or ""),
        ):
            lead_to_property_id[link["lead_id"]] = link["property_id"]

    property_ids = sorted(set(lead_to_property_id.values()))
    properties_by_id: dict[str, dict[str, Any]] = {}
    if property_ids:
        properties = (
            supabase.table("properties")
            .select("id,listing_price,price")
            .eq("team_id", auth.team_id)
            .in_("id", property_ids)
            .execute()
            .data
        )
        properties_by_id = {property_row["id"]: property_row for property_row in properties}

    won_lead_ids = [
        lead["id"]
        for lead in funnel_leads
        if lead.get("status") == LeadStatus.WON.value
    ]
    deal_values_by_lead: dict[str, Decimal] = {}
    if won_lead_ids:
        won_deals = (
            deal_query("lead_id,sale_price,commission_total,commission_override")
            .in_("lead_id", won_lead_ids)
            .execute()
            .data
        )
        for deal in won_deals:
            deal_values_by_lead[deal["lead_id"]] = _decimal_from_row(
                deal,
                "sale_price",
                "commission_override",
                "commission_total",
            )

    for lead in funnel_leads:
        status_value = lead.get("status")
        if status_value not in funnel_values:
            continue
        if status_value == LeadStatus.WON.value:
            funnel_values[status_value] += deal_values_by_lead.get(
                lead["id"],
                Decimal("0"),
            )
            continue
        property_row = properties_by_id.get(lead_to_property_id.get(lead["id"], ""))
        if property_row:
            funnel_values[status_value] += _decimal_from_row(
                property_row,
                "listing_price",
                "price",
            )

    conversion_denominator = sum(
        funnel_counts[stage] for stage in CONVERSION_DENOMINATOR_STATUSES
    )
    pipeline_conversion_rate = (
        None
        if conversion_denominator < 5
        else funnel_counts[LeadStatus.WON.value] / conversion_denominator
    )
    properties_listed = property_query().eq("status", "Active").execute().data
    monthly_deals = (
        deal_query()
        .gte("closed_at", month_start.isoformat())
        .order("closed_at", desc=True)
        .execute()
        .data
    )
    monthly_commission = _sum_commission(monthly_deals)
    range_deals = (
        deal_query()
        .gte("closed_at", range_start.isoformat())
        .order("closed_at", desc=True)
        .execute()
        .data
    )
    range_commission = _sum_commission(range_deals)
    attributed_leads_query = (
        lead_query("id,campaign_id,ren_id,created_at")
        .gte("created_at", month_start.isoformat())
    )
    attributed_leads = [
        lead
        for lead in attributed_leads_query.execute().data
        if lead.get("campaign_id")
    ]
    attributed_lead_ids = {lead["id"] for lead in attributed_leads}
    attributed_deals = [
        deal for deal in monthly_deals if deal["lead_id"] in attributed_lead_ids
    ]
    campaign_conversion_rate_month = (
        None if not attributed_leads else len(attributed_deals) / len(attributed_leads)
    )
    leads_by_campaign: dict[str, list[dict[str, Any]]] = {}
    for lead in attributed_leads:
        leads_by_campaign.setdefault(lead["campaign_id"], []).append(lead)

    conversions_by_campaign: dict[str, int] = {}
    lead_to_campaign = {lead["id"]: lead["campaign_id"] for lead in attributed_leads}
    for deal in attributed_deals:
        campaign_id = lead_to_campaign.get(deal["lead_id"])
        if campaign_id:
            conversions_by_campaign[campaign_id] = (
                conversions_by_campaign.get(campaign_id, 0) + 1
            )

    top_performing_campaign = None
    if conversions_by_campaign:
        top_campaign_id = max(
            conversions_by_campaign,
            key=lambda campaign_id: (
                conversions_by_campaign[campaign_id]
                / max(len(leads_by_campaign.get(campaign_id, [])), 1),
                conversions_by_campaign[campaign_id],
            ),
        )
        campaign = (
            supabase.table("marketing_campaigns")
            .select("id,name,channel")
            .eq("id", top_campaign_id)
            .eq("team_id", auth.team_id)
            .single()
            .execute()
            .data
        )
        if campaign:
            top_performing_campaign = {
                **campaign,
                "leads_generated": len(leads_by_campaign[top_campaign_id]),
                "conversions": conversions_by_campaign[top_campaign_id],
            }
    target_scope = "team" if user["role"] == "MANAGER" else "personal"
    target_amount = user.get("monthly_target_amount")
    if target_scope == "team":
        team = (
            supabase.table("teams")
            .select("*")
            .eq("id", auth.team_id)
            .single()
            .execute()
            .data
        )
        target_amount = (team or {}).get("monthly_target_amount")

    target_decimal = Decimal(str(target_amount)) if target_amount is not None else None
    target_progress_ratio = (
        None
        if target_decimal in (None, Decimal("0"))
        else float(range_commission / target_decimal)
    )
    personal_progress = None
    if target_scope == "team":
        personal_range_deals = (
            supabase.table("deals")
            .select("*")
            .eq("team_id", auth.team_id)
            .eq("ren_id", user["id"])
            .gte("closed_at", range_start.isoformat())
            .execute()
            .data
        )
        personal_amount = _sum_commission(personal_range_deals)
        personal_target = user.get("monthly_target_amount")
        personal_decimal = (
            Decimal(str(personal_target)) if personal_target is not None else None
        )
        personal_ratio = (
            None
            if personal_decimal in (None, Decimal("0"))
            else float(personal_amount / personal_decimal)
        )
        personal_progress = {
            "scope": "personal",
            "target_amount": (
                str(personal_decimal) if personal_decimal is not None else None
            ),
            "current_amount": str(personal_amount),
            "progress_ratio": personal_ratio,
            "date_range": date_range,
        }

    recent_activity = (
        supabase.table("timeline_events")
        .select("*")
        .eq("team_id", auth.team_id)
        .gte("created_at", range_start.isoformat())
        .order("created_at", desc=True)
        .limit(5)
        .execute()
        .data
    )

    return {
        "user": {
            "full_name": user["full_name"],
            "role": user["role"],
        },
        "date_range": date_range,
        "priority_counts": {
            "overdue_follow_ups": len(follow_ups_due),
            "viewings_today": len(today_agenda),
            "deals_due": len(deals_closing_soon),
        },
        "today_agenda": today_agenda,
        "target_progress": {
            "scope": target_scope,
            "target_amount": str(target_decimal) if target_decimal is not None else None,
            "current_amount": str(range_commission),
            "progress_ratio": target_progress_ratio,
            "date_range": date_range,
        },
        "personal_progress": personal_progress,
        "funnel": [
            {
                "stage": stage,
                "count": funnel_counts[stage],
                "value": str(funnel_values[stage]),
            }
            for stage in PIPELINE_STAGES
        ],
        "pipeline_conversion_rate": pipeline_conversion_rate,
        "pipeline_conversion_denominator": conversion_denominator,
        "recent_activity": recent_activity,
        "tasks": {
            "follow_ups_due": follow_ups_due,
            "upcoming_viewings": upcoming_viewings,
            "deals_closing_soon": deals_closing_soon,
        },
        "kpis": {
            "active_leads": len(active_leads),
            "properties_listed": len(properties_listed),
            "deals_closed": len(monthly_deals),
            "monthly_commission": str(monthly_commission),
            "follow_ups_due": len(follow_ups_due),
            "campaign_conversion_rate_month": campaign_conversion_rate_month,
            "top_performing_campaign_month": top_performing_campaign,
        },
    }
