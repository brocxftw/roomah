from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends

from app.auth import AuthContext, get_auth_context
from app.supabase import get_service_supabase
from app.users import get_current_user_record

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    now = datetime.now(UTC)
    two_days_ago = now - timedelta(days=2)
    seven_days_from_now = now + timedelta(days=7)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    lead_base = supabase.table("leads").select("*").eq("team_id", auth.team_id)
    property_base = supabase.table("properties").select("*").eq("team_id", auth.team_id)
    viewing_base = supabase.table("viewings").select("*").eq("team_id", auth.team_id)
    deal_base = supabase.table("deals").select("*").eq("team_id", auth.team_id)

    if user["role"] != "MANAGER":
        lead_base = lead_base.eq("ren_id", user["id"])
        property_base = property_base.eq("ren_id", user["id"])
        viewing_base = viewing_base.eq("assigned_ren_id", user["id"])
        deal_base = deal_base.eq("ren_id", user["id"])

    follow_ups_due = (
        lead_base.in_("status", ["Active", "Negotiating"])
        .lte("last_interaction_at", two_days_ago.isoformat())
        .order("last_interaction_at")
        .execute()
        .data
    )
    upcoming_viewings = (
        viewing_base.eq("status", "scheduled")
        .gte("scheduled_at", now.isoformat())
        .lte("scheduled_at", seven_days_from_now.isoformat())
        .order("scheduled_at")
        .execute()
        .data
    )
    deals_closing_soon = (
        supabase.table("leads")
        .select("*")
        .eq("team_id", auth.team_id)
        .eq("status", "Negotiating")
        .order("last_interaction_at", desc=True)
        .execute()
        .data
    )
    if user["role"] != "MANAGER":
        deals_closing_soon = [
            lead for lead in deals_closing_soon if lead["ren_id"] == user["id"]
        ]

    active_leads = (
        supabase.table("leads")
        .select("id")
        .eq("team_id", auth.team_id)
        .in_("status", ["Active", "Negotiating"])
        .execute()
        .data
    )
    properties_listed = property_base.eq("status", "Active").execute().data
    monthly_deals = (
        deal_base.gte("closed_at", month_start.isoformat())
        .order("closed_at", desc=True)
        .execute()
        .data
    )
    monthly_commission = sum(
        Decimal(str(deal.get("commission_override") or deal["commission_total"]))
        for deal in monthly_deals
    )
    attributed_leads_query = (
        supabase.table("leads")
        .select("id,campaign_id,ren_id,created_at")
        .eq("team_id", auth.team_id)
        .gte("created_at", month_start.isoformat())
    )
    if user["role"] != "MANAGER":
        attributed_leads_query = attributed_leads_query.eq("ren_id", user["id"])
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

    return {
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
