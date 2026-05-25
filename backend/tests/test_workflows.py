from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.auth import AuthContext
from app.models import LeadStatus, PropertyStatus, TimelineEventType
from app.routes import deals as deal_routes
from app.routes import leads as lead_routes
from app.routes import properties as property_routes
from app.routes import viewings as viewing_routes

TEAM_ID = "00000000-0000-4000-8000-000000000001"
REN_ID = "00000000-0000-4000-8000-000000000002"
MANAGER_ID = "00000000-0000-4000-8000-000000000003"
OTHER_REN_ID = "00000000-0000-4000-8000-000000000004"


class FakeResponse:
    def __init__(self, data: Any) -> None:
        self.data = data


class FakeQuery:
    def __init__(self, supabase: FakeSupabase, table_name: str) -> None:
        self.supabase = supabase
        self.table_name = table_name
        self.filters: list[tuple[str, str, Any]] = []
        self.single_result = False
        self.insert_payload: dict[str, Any] | None = None
        self.update_payload: dict[str, Any] | None = None
        self.upsert_payload: dict[str, Any] | None = None

    def select(self, _columns: str) -> FakeQuery:
        return self

    def eq(self, column: str, value: Any) -> FakeQuery:
        self.filters.append(("eq", column, value))
        return self

    def neq(self, column: str, value: Any) -> FakeQuery:
        self.filters.append(("neq", column, value))
        return self

    def in_(self, column: str, values: list[Any]) -> FakeQuery:
        self.filters.append(("in", column, values))
        return self

    def gte(self, column: str, value: Any) -> FakeQuery:
        self.filters.append(("gte", column, value))
        return self

    def lte(self, column: str, value: Any) -> FakeQuery:
        self.filters.append(("lte", column, value))
        return self

    def lt(self, column: str, value: Any) -> FakeQuery:
        self.filters.append(("lt", column, value))
        return self

    def order(self, _column: str, desc: bool = False) -> FakeQuery:
        return self

    def limit(self, _count: int) -> FakeQuery:
        return self

    def single(self) -> FakeQuery:
        self.single_result = True
        return self

    def insert(self, payload: dict[str, Any]) -> FakeQuery:
        self.insert_payload = payload
        return self

    def update(self, payload: dict[str, Any]) -> FakeQuery:
        self.update_payload = payload
        return self

    def upsert(self, payload: dict[str, Any], **_kwargs: Any) -> FakeQuery:
        self.upsert_payload = payload
        return self

    def execute(self) -> FakeResponse:
        if self.insert_payload is not None:
            return self._execute_insert(self.insert_payload)
        if self.upsert_payload is not None:
            return self._execute_upsert(self.upsert_payload)
        if self.update_payload is not None:
            return self._execute_update(self.update_payload)

        rows = self._filtered_rows()
        if self.single_result:
            return FakeResponse(rows[0].copy() if rows else None)
        return FakeResponse([row.copy() for row in rows])

    def _execute_insert(self, payload: dict[str, Any]) -> FakeResponse:
        row = payload.copy()
        row.setdefault("id", self.supabase.next_id(self.table_name))
        row.setdefault("created_at", datetime.now(UTC).isoformat())
        if self.table_name == "deals":
            row.setdefault("closed_at", datetime.now(UTC).isoformat())
        if self.table_name == "timeline_events":
            self._advance_lead_interaction(row)
        self.supabase.tables[self.table_name].append(row)
        return FakeResponse([row.copy()])

    def _execute_upsert(self, payload: dict[str, Any]) -> FakeResponse:
        if self.table_name == "lead_properties":
            for row in self.supabase.tables[self.table_name]:
                if (
                    row["lead_id"] == payload["lead_id"]
                    and row["property_id"] == payload["property_id"]
                ):
                    row.update(payload)
                    return FakeResponse([row.copy()])
        return self._execute_insert(payload)

    def _execute_update(self, payload: dict[str, Any]) -> FakeResponse:
        updated: list[dict[str, Any]] = []
        for row in self._filtered_rows():
            row.update(payload)
            updated.append(row.copy())
        return FakeResponse(updated)

    def _filtered_rows(self) -> list[dict[str, Any]]:
        rows = self.supabase.tables[self.table_name]
        for operator, column, value in self.filters:
            rows = [
                row
                for row in rows
                if self._matches(row.get(column), operator=operator, value=value)
            ]
        return rows

    def _advance_lead_interaction(self, event: dict[str, Any]) -> None:
        for lead in self.supabase.tables["leads"]:
            if lead["id"] == event["lead_id"]:
                lead["last_interaction_at"] = event["created_at"]

    @staticmethod
    def _matches(actual: Any, *, operator: str, value: Any) -> bool:
        if operator == "eq":
            return actual == value
        if operator == "neq":
            return actual != value
        if operator == "in":
            return actual in value
        if operator == "gte":
            return str(actual) >= str(value)
        if operator == "lte":
            return str(actual) <= str(value)
        if operator == "lt":
            return str(actual) < str(value)
        raise AssertionError(f"Unsupported operator: {operator}")


class FakeSupabase:
    def __init__(self) -> None:
        self.counters: dict[str, int] = {}
        self.tables: dict[str, list[dict[str, Any]]] = {
            "users": [
                self.user(REN_ID, "ren@example.com", "REN"),
                self.user(MANAGER_ID, "manager@example.com", "MANAGER"),
                self.user(OTHER_REN_ID, "other@example.com", "REN"),
            ],
            "team_config": [
                {
                    "team_id": TEAM_ID,
                    "default_agency_fee": "1000",
                    "default_lawyer_fees": "2000",
                }
            ],
            "leads": [],
            "properties": [],
            "lead_properties": [],
            "viewings": [],
            "deals": [],
            "timeline_events": [],
        }

    @staticmethod
    def user(user_id: str, email: str, role: str) -> dict[str, Any]:
        return {
            "id": user_id,
            "team_id": TEAM_ID,
            "email": email,
            "role": role,
            "commission_rate": "0.02",
        }

    def table(self, table_name: str) -> FakeQuery:
        return FakeQuery(self, table_name)

    def next_id(self, table_name: str) -> str:
        self.counters[table_name] = self.counters.get(table_name, 0) + 1
        return str(uuid4())


def auth_context(user_id: str, role: str) -> AuthContext:
    return AuthContext(
        auth_user_id=f"auth-{user_id}",
        user_id=user_id,
        team_id=TEAM_ID,
        role=role,  # type: ignore[arg-type]
        claims={},
    )


def patch_supabase(monkeypatch: pytest.MonkeyPatch, supabase: FakeSupabase) -> None:
    modules = [lead_routes, property_routes, viewing_routes, deal_routes]
    for module in modules:
        monkeypatch.setattr(module, "get_service_supabase", lambda: supabase)

    def current_user(auth: AuthContext) -> dict[str, Any]:
        return next(
            user for user in supabase.tables["users"] if user["id"] == auth.user_id
        )

    for module in modules:
        monkeypatch.setattr(module, "get_current_user_record", current_user)


def create_lead_property_link_viewing(
    supabase: FakeSupabase,
    auth: AuthContext,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    lead = lead_routes.create_lead(
        payload=lead_routes.LeadCreate(
            name="Buyer One",
            phone="60123456789",
            email="buyer@example.com",
            budget_min=Decimal("450000"),
            budget_max=Decimal("550000"),
            preferred_location="KL",
            preferred_property_type="Condo",
        ),
        auth=auth,
    )
    property_row = property_routes.create_property(
        payload=property_routes.PropertyCreate(
            name="KL Condo",
            type="Condo",
            location="KL",
            price=Decimal("500000"),
            status=PropertyStatus.ACTIVE,
        ),
        auth=auth,
    )
    lead_routes.link_property(
        lead_id=lead["id"],
        payload=lead_routes.LeadPropertyLinkCreate(property_id=property_row["id"]),
        auth=auth,
    )
    viewing = viewing_routes.create_viewing(
        payload=viewing_routes.ViewingCreate(
            lead_id=lead["id"],
            property_id=property_row["id"],
            assigned_ren_id=REN_ID,
            scheduled_at=datetime.now(UTC) - timedelta(hours=1),
        ),
        auth=auth,
    )
    return lead, property_row, viewing


def test_full_happy_path_cascades_and_writes_timeline(monkeypatch) -> None:
    supabase = FakeSupabase()
    auth = auth_context(REN_ID, "REN")
    patch_supabase(monkeypatch, supabase)

    lead, property_row, viewing = create_lead_property_link_viewing(supabase, auth)
    completed = viewing_routes.complete_viewing(
        viewing_id=viewing["id"],
        payload=viewing_routes.ViewingComplete(
            interest_level=3,
            notes="Very interested",
        ),
        auth=auth,
    )
    deal = deal_routes.create_deal(
        payload=deal_routes.DealCreate(
            lead_id=lead["id"],
            property_id=property_row["id"],
            sale_price=Decimal("500000"),
        ),
        auth=auth,
    )

    assert completed["status"] == "completed"
    assert deal["commission_total"] == "7000.00"
    assert supabase.tables["leads"][0]["status"] == "Closed"
    assert supabase.tables["properties"][0]["status"] == "Inactive"
    assert {event["event_type"] for event in supabase.tables["timeline_events"]} >= {
        TimelineEventType.LEAD_CREATED.value,
        TimelineEventType.PROPERTY_LINKED.value,
        TimelineEventType.VIEWING_SCHEDULED.value,
        TimelineEventType.VIEWING_COMPLETED.value,
        TimelineEventType.DEAL_CLOSED.value,
        TimelineEventType.LEAD_STATUS_CHANGED.value,
    }


def test_property_cascade_marks_other_leads_lost_and_revive_is_allowed(
    monkeypatch,
) -> None:
    supabase = FakeSupabase()
    auth = auth_context(REN_ID, "REN")
    patch_supabase(monkeypatch, supabase)

    closing_lead, property_row, _viewing = create_lead_property_link_viewing(
        supabase,
        auth,
    )
    other_lead = lead_routes.create_lead(
        payload=lead_routes.LeadCreate(
            name="Buyer Two",
            phone="60987654321",
            email="buyer2@example.com",
        ),
        auth=auth,
    )
    lead_routes.link_property(
        lead_id=other_lead["id"],
        payload=lead_routes.LeadPropertyLinkCreate(property_id=property_row["id"]),
        auth=auth,
    )

    deal_routes.create_deal(
        payload=deal_routes.DealCreate(
            lead_id=closing_lead["id"],
            property_id=property_row["id"],
            sale_price=Decimal("500000"),
        ),
        auth=auth,
    )

    assert (
        next(
            lead for lead in supabase.tables["leads"] if lead["id"] == other_lead["id"]
        )["status"]
        == "Lost"
    )
    assert (
        next(
            link
            for link in supabase.tables["lead_properties"]
            if link["lead_id"] == other_lead["id"]
        )["status"]
        == "inactive"
    )

    revived = lead_routes.update_lead(
        lead_id=other_lead["id"],
        payload=lead_routes.LeadUpdate(status=LeadStatus.ACTIVE),
        auth=auth,
    )

    assert revived["status"] == "Active"
    assert any(
        event["event_type"] == TimelineEventType.LEAD_STATUS_CHANGED.value
        and event["lead_id"] == other_lead["id"]
        and event["payload"] == {"from": "Lost", "to": "Active"}
        for event in supabase.tables["timeline_events"]
    )


def test_manager_can_reassign_lead_and_ren_cannot(monkeypatch) -> None:
    supabase = FakeSupabase()
    patch_supabase(monkeypatch, supabase)
    ren_auth = auth_context(REN_ID, "REN")
    manager_auth = auth_context(MANAGER_ID, "MANAGER")
    lead = lead_routes.create_lead(
        payload=lead_routes.LeadCreate(
            name="Assignable Lead",
            phone="60111111111",
            email="assign@example.com",
        ),
        auth=ren_auth,
    )

    with pytest.raises(HTTPException) as exc_info:
        lead_routes.reassign_lead(
            lead_id=lead["id"],
            payload=lead_routes.LeadReassign(ren_id=OTHER_REN_ID),
            auth=ren_auth,
        )
    assert exc_info.value.status_code == 403

    updated = lead_routes.reassign_lead(
        lead_id=lead["id"],
        payload=lead_routes.LeadReassign(ren_id=OTHER_REN_ID),
        auth=manager_auth,
    )

    assert updated["ren_id"] == OTHER_REN_ID
    assert any(
        event["event_type"] == TimelineEventType.LEAD_REASSIGNED.value
        and event["payload"] == {"from_ren_id": REN_ID, "to_ren_id": OTHER_REN_ID}
        for event in supabase.tables["timeline_events"]
    )
