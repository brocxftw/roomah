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
        },
    }
