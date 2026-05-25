from collections.abc import Mapping
from typing import Any
from uuid import UUID

from supabase import Client

from app.auth import AuthContext
from app.models import TimelineEventSource, TimelineEventType


def emit_timeline_event(
    *,
    supabase: Client,
    auth: AuthContext,
    lead_id: UUID | str,
    event_type: TimelineEventType,
    source: TimelineEventSource = TimelineEventSource.SYSTEM,
    payload: Mapping[str, Any] | None = None,
    created_by: UUID | str | None = None,
) -> dict[str, Any] | None:
    response = (
        supabase.table("timeline_events")
        .insert(
            {
                "team_id": auth.team_id,
                "lead_id": str(lead_id),
                "event_type": event_type.value,
                "source": source.value,
                "payload": dict(payload or {}),
                "created_by": str(created_by) if created_by else auth.user_id,
            }
        )
        .execute()
    )

    return response.data[0] if response.data else None
