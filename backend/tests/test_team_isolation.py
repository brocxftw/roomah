from __future__ import annotations

from typing import Any
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.auth import AuthContext
from app.routes import leads as lead_routes
from tests.test_workflows import FakeSupabase, patch_supabase

TEAM_A = "00000000-0000-4000-8000-0000000000aa"
TEAM_B = "00000000-0000-4000-8000-0000000000bb"
REN_A = "00000000-0000-4000-8000-0000000000a1"
REN_B = "00000000-0000-4000-8000-0000000000b1"


def auth_for(team_id: str, user_id: str) -> AuthContext:
    return AuthContext(
        auth_user_id=f"auth-{user_id}",
        user_id=user_id,
        team_id=team_id,
        role="REN",
        claims={},
    )


def make_user(user_id: str, team_id: str, email: str) -> dict[str, Any]:
    return {
        "id": user_id,
        "team_id": team_id,
        "email": email,
        "role": "REN",
        "commission_rate": "0.02",
    }


def test_lead_listing_filters_by_jwt_team_id(monkeypatch) -> None:
    supabase = FakeSupabase()
    supabase.tables["users"].extend(
        [
            make_user(REN_A, TEAM_A, "ren_a@example.com"),
            make_user(REN_B, TEAM_B, "ren_b@example.com"),
        ]
    )
    patch_supabase(monkeypatch, supabase)

    auth_a = auth_for(TEAM_A, REN_A)
    auth_b = auth_for(TEAM_B, REN_B)

    lead_a = lead_routes.create_lead(
        payload=lead_routes.LeadCreate(
            name="Team A Buyer",
            phone="60100000001",
            email="a@example.com",
        ),
        auth=auth_a,
    )
    lead_b = lead_routes.create_lead(
        payload=lead_routes.LeadCreate(
            name="Team B Buyer",
            phone="60100000002",
            email="b@example.com",
        ),
        auth=auth_b,
    )

    listed_for_a = [lead["id"] for lead in lead_routes.list_leads(auth=auth_a)]
    listed_for_b = [lead["id"] for lead in lead_routes.list_leads(auth=auth_b)]

    assert listed_for_a == [lead_a["id"]]
    assert listed_for_b == [lead_b["id"]]


def test_lead_detail_blocks_access_across_teams(monkeypatch) -> None:
    supabase = FakeSupabase()
    supabase.tables["users"].extend(
        [
            make_user(REN_A, TEAM_A, "ren_a@example.com"),
            make_user(REN_B, TEAM_B, "ren_b@example.com"),
        ]
    )
    patch_supabase(monkeypatch, supabase)

    auth_a = auth_for(TEAM_A, REN_A)
    auth_b = auth_for(TEAM_B, REN_B)

    lead_a = lead_routes.create_lead(
        payload=lead_routes.LeadCreate(
            name="Team A Buyer",
            phone="60100000003",
            email="a2@example.com",
        ),
        auth=auth_a,
    )

    with pytest.raises(HTTPException) as exc_info:
        lead_routes.get_lead(lead_id=UUID(lead_a["id"]), auth=auth_b)

    assert exc_info.value.status_code == 404
