from collections import defaultdict
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.auth import AuthContext, get_auth_context
from app.models import LeadStatus
from app.supabase import get_service_supabase
from app.users import get_current_user_record, require_manager

router = APIRouter(prefix="/manager", tags=["manager"])


class TeamTargetUpdate(BaseModel):
    monthly_target_amount: Decimal | None = Field(default=None, ge=0)


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
