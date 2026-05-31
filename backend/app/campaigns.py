from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client

from app.auth import AuthContext
from app.models import CampaignStatus


class CampaignCountersService:
    def __init__(self, supabase: Client) -> None:
        self.supabase = supabase

    def validate_campaign_for_attribution(
        self,
        *,
        campaign_id: UUID | str,
        auth: AuthContext,
        allow_completed: bool = False,
    ) -> dict[str, Any]:
        campaign = (
            self.supabase.table("marketing_campaigns")
            .select("id,team_id,name,channel,status")
            .eq("id", str(campaign_id))
            .eq("team_id", auth.team_id)
            .single()
            .execute()
            .data
        )
        if not campaign:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Campaign not found for this team",
            )
        if campaign["status"] == CampaignStatus.COMPLETED.value and not allow_completed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Completed campaigns cannot be assigned to new leads",
            )

        return campaign

    def apply_lead_campaign_attribution_counters(
        self,
        *,
        lead_id: UUID | str,
        from_campaign_id: UUID | str | None,
        to_campaign_id: UUID | str | None,
    ) -> None:
        if str(from_campaign_id or "") == str(to_campaign_id or ""):
            return

        self.supabase.rpc(
            "apply_lead_campaign_attribution_counters",
            {
                "p_lead_id": str(lead_id),
                "p_from_campaign": (
                    str(from_campaign_id) if from_campaign_id is not None else None
                ),
                "p_to_campaign": (
                    str(to_campaign_id) if to_campaign_id is not None else None
                ),
            },
        ).execute()

    def increment_conversion(self, campaign_id: UUID | str | None) -> None:
        if campaign_id is None:
            return

        campaign = (
            self.supabase.table("marketing_campaigns")
            .select("id,conversions")
            .eq("id", str(campaign_id))
            .single()
            .execute()
            .data
        )
        if not campaign:
            return

        self.supabase.table("marketing_campaigns").update(
            {"conversions": int(campaign["conversions"]) + 1}
        ).eq("id", str(campaign_id)).execute()

    def swap_conversion(
        self,
        *,
        from_campaign_id: UUID | str | None,
        to_campaign_id: UUID | str | None,
    ) -> None:
        if str(from_campaign_id or "") == str(to_campaign_id or ""):
            return

        if from_campaign_id is not None:
            from_campaign = (
                self.supabase.table("marketing_campaigns")
                .select("id,conversions")
                .eq("id", str(from_campaign_id))
                .single()
                .execute()
                .data
            )
            if from_campaign:
                self.supabase.table("marketing_campaigns").update(
                    {"conversions": max(int(from_campaign["conversions"]) - 1, 0)}
                ).eq("id", str(from_campaign_id)).execute()

        if to_campaign_id is not None:
            self.increment_conversion(to_campaign_id)
