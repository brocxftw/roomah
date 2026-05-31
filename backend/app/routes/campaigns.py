from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import AuthContext, get_auth_context
from app.models import (
    CampaignChannel,
    CampaignStatus,
    MarketingCampaignCreate,
    MarketingCampaignUpdate,
)
from app.supabase import get_service_supabase
from app.users import get_current_user_record, get_team_user_references, require_manager

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

METRIC_FIELDS = {"ad_spending", "impressions", "clicks"}


def _get_campaign(
    *,
    campaign_id: UUID,
    auth: AuthContext,
) -> dict[str, Any]:
    campaign = (
        get_service_supabase()
        .table("marketing_campaigns")
        .select("*")
        .eq("id", str(campaign_id))
        .eq("team_id", auth.team_id)
        .single()
        .execute()
        .data
    )
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )

    return campaign


def _ensure_campaign_write_access(
    *,
    campaign: dict[str, Any],
    user: dict[str, Any],
) -> None:
    if user["role"] == "MANAGER":
        return
    if campaign["created_by"] != user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Campaign can only be edited by its creator or a manager",
        )


def _ensure_metric_write_access(
    *,
    campaign: dict[str, Any],
    user: dict[str, Any],
    update_payload: dict[str, Any],
) -> None:
    if not (METRIC_FIELDS & update_payload.keys()):
        return
    if user["role"] == "MANAGER":
        return
    if campaign["status"] != CampaignStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers can edit spend metrics on non-Draft campaigns",
        )


def _validate_metric_update(
    *,
    campaign: dict[str, Any],
    update_payload: dict[str, Any],
) -> None:
    impressions = int(update_payload.get("impressions", campaign["impressions"]))
    clicks = int(update_payload.get("clicks", campaign["clicks"]))
    if clicks > impressions:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="clicks must be less than or equal to impressions",
        )


@router.post("", status_code=status.HTTP_201_CREATED)
def create_campaign(
    payload: MarketingCampaignCreate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    user = get_current_user_record(auth)
    insert_payload = payload.model_dump(mode="json")
    insert_payload.update(
        {
            "team_id": auth.team_id,
            "created_by": user["id"],
            "status": CampaignStatus.DRAFT.value,
            "leads_generated": 0,
            "conversions": 0,
        }
    )

    return (
        get_service_supabase()
        .table("marketing_campaigns")
        .insert(insert_payload)
        .execute()
        .data[0]
    )


@router.get("")
def list_campaigns(
    status_filter: CampaignStatus | None = None,
    channel: CampaignChannel | None = None,
    include_completed: bool = False,
    include_draft: bool = False,
    q: str | None = None,
    auth: AuthContext = Depends(get_auth_context),
) -> list[dict[str, Any]]:
    user = get_current_user_record(auth)
    query = (
        get_service_supabase()
        .table("marketing_campaigns")
        .select("*")
        .eq("team_id", auth.team_id)
        .order("created_at", desc=True)
    )
    if status_filter is not None:
        query = query.eq("status", status_filter.value)
    if channel is not None:
        query = query.eq("channel", channel.value)
    if q:
        query = query.ilike("name", f"%{q}%")

    campaigns = query.execute().data
    if not include_completed and status_filter is None:
        campaigns = [
            campaign
            for campaign in campaigns
            if campaign["status"] != CampaignStatus.COMPLETED.value
        ]
    if not include_draft and status_filter is None:
        campaigns = [
            campaign
            for campaign in campaigns
            if campaign["status"] != CampaignStatus.DRAFT.value
            or campaign["created_by"] == user["id"]
        ]

    return campaigns


@router.get("/{campaign_id}")
def get_campaign(
    campaign_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    campaign = _get_campaign(campaign_id=campaign_id, auth=auth)
    leads = (
        get_service_supabase()
        .table("leads")
        .select("id,name,status,ren_id")
        .eq("team_id", auth.team_id)
        .eq("campaign_id", str(campaign_id))
        .execute()
        .data
    )
    ren_refs = get_team_user_references(
        auth,
        {lead["ren_id"] for lead in leads if lead.get("ren_id")},
    )
    return {
        **campaign,
        "attributed_leads": [
            {**lead, "ren": ren_refs.get(lead["ren_id"])} for lead in leads
        ],
    }


@router.patch("/{campaign_id}")
def update_campaign(
    campaign_id: UUID,
    payload: MarketingCampaignUpdate,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    supabase = get_service_supabase()
    user = get_current_user_record(auth)
    campaign = _get_campaign(campaign_id=campaign_id, auth=auth)
    _ensure_campaign_write_access(campaign=campaign, user=user)

    update_payload = payload.model_dump(exclude_unset=True, mode="json")
    if not update_payload:
        return campaign
    _ensure_metric_write_access(
        campaign=campaign,
        user=user,
        update_payload=update_payload,
    )
    _validate_metric_update(campaign=campaign, update_payload=update_payload)
    if update_payload.get("status") == CampaignStatus.COMPLETED.value:
        require_manager(user)

    return (
        supabase.table("marketing_campaigns")
        .update(update_payload)
        .eq("id", str(campaign_id))
        .eq("team_id", auth.team_id)
        .execute()
        .data[0]
    )


@router.post("/{campaign_id}/complete")
def complete_campaign(
    campaign_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    user = get_current_user_record(auth)
    require_manager(user)
    _get_campaign(campaign_id=campaign_id, auth=auth)

    return (
        get_service_supabase()
        .table("marketing_campaigns")
        .update({"status": CampaignStatus.COMPLETED.value})
        .eq("id", str(campaign_id))
        .eq("team_id", auth.team_id)
        .execute()
        .data[0]
    )


@router.post("/{campaign_id}/reactivate")
def reactivate_campaign(
    campaign_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    user = get_current_user_record(auth)
    require_manager(user)
    _get_campaign(campaign_id=campaign_id, auth=auth)

    return (
        get_service_supabase()
        .table("marketing_campaigns")
        .update({"status": CampaignStatus.ACTIVE.value})
        .eq("id", str(campaign_id))
        .eq("team_id", auth.team_id)
        .execute()
        .data[0]
    )


@router.post("/{campaign_id}/recompute-metrics")
def recompute_campaign_metrics(
    campaign_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    user = get_current_user_record(auth)
    require_manager(user)
    _get_campaign(campaign_id=campaign_id, auth=auth)
    supabase = get_service_supabase()

    leads = (
        supabase.table("leads")
        .select("id")
        .eq("team_id", auth.team_id)
        .eq("campaign_id", str(campaign_id))
        .execute()
        .data
    )
    lead_ids = [lead["id"] for lead in leads]
    conversions = 0
    if lead_ids:
        conversions = len(
            supabase.table("deals")
            .select("id")
            .eq("team_id", auth.team_id)
            .in_("lead_id", lead_ids)
            .execute()
            .data
        )

    return (
        supabase.table("marketing_campaigns")
        .update({"leads_generated": len(leads), "conversions": conversions})
        .eq("id", str(campaign_id))
        .eq("team_id", auth.team_id)
        .execute()
        .data[0]
    )
