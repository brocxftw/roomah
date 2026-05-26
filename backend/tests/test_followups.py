from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from app.auth import AuthContext
from app.models import TimelineEventType
from app.routes import dashboard as dashboard_routes
from app.routes import leads as lead_routes

TEAM_ID = "00000000-0000-4000-8000-000000000001"
USER_ID = "00000000-0000-4000-8000-000000000002"
AUTH_USER_ID = "00000000-0000-4000-8000-000000000003"
LEAD_ID = "00000000-0000-4000-8000-000000000010"


class FakeResponse:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class FakeQuery:
    def __init__(self, supabase: FakeSupabase, table_name: str) -> None:
        self.supabase = supabase
        self.table_name = table_name
        self.filters: list[tuple[str, str, Any]] = []
        self.order_by: tuple[str, bool] | None = None
        self.limit_count: int | None = None
        self.single_result = False
        self.insert_payload: dict[str, Any] | None = None

    def select(self, _columns: str) -> FakeQuery:
        return self

    def eq(self, column: str, value: Any) -> FakeQuery:
        self.filters.append(("eq", column, value))
        return self

    def in_(self, column: str, values: list[Any]) -> FakeQuery:
        self.filters.append(("in", column, values))
        return self

    def lte(self, column: str, value: Any) -> FakeQuery:
        self.filters.append(("lte", column, value))
        return self

    def lt(self, column: str, value: Any) -> FakeQuery:
        self.filters.append(("lt", column, value))
        return self

    def gte(self, column: str, value: Any) -> FakeQuery:
        self.filters.append(("gte", column, value))
        return self

    def order(self, column: str, desc: bool = False) -> FakeQuery:
        self.order_by = (column, desc)
        return self

    def limit(self, count: int) -> FakeQuery:
        self.limit_count = count
        return self

    def single(self) -> FakeQuery:
        self.single_result = True
        return self

    def insert(self, payload: dict[str, Any]) -> FakeQuery:
        self.insert_payload = payload
        return self

    def execute(self) -> FakeResponse:
        if self.insert_payload is not None:
            return self._execute_insert()

        rows = [row.copy() for row in self.supabase.tables[self.table_name]]
        for operator, column, value in self.filters:
            rows = [
                row
                for row in rows
                if self._matches(row.get(column), operator=operator, value=value)
            ]

        if self.order_by:
            column, desc = self.order_by
            rows.sort(key=lambda row: row[column], reverse=desc)

        if self.limit_count is not None:
            rows = rows[: self.limit_count]

        if self.single_result:
            return FakeResponse(rows[:1])

        return FakeResponse(rows)

    def _execute_insert(self) -> FakeResponse:
        assert self.insert_payload is not None
        now = datetime.now(UTC).isoformat()
        row = {
            "id": f"event-{len(self.supabase.tables[self.table_name]) + 1}",
            **self.insert_payload,
            "created_at": now,
        }
        self.supabase.tables[self.table_name].append(row)

        if self.table_name == "timeline_events":
            lead_id = row["lead_id"]
            for lead in self.supabase.tables["leads"]:
                if lead["id"] == lead_id:
                    lead["last_interaction_at"] = now

        return FakeResponse([row])

    @staticmethod
    def _matches(actual: Any, *, operator: str, value: Any) -> bool:
        if operator == "eq":
            return actual == value
        if operator == "in":
            return actual in value
        if operator == "lte":
            return str(actual) <= str(value)
        if operator == "lt":
            return str(actual) < str(value)
        if operator == "gte":
            return str(actual) >= str(value)
        raise AssertionError(f"Unsupported operator: {operator}")


class FakeSupabase:
    def __init__(self) -> None:
        old_interaction = (datetime.now(UTC) - timedelta(days=3)).isoformat()
        self.tables: dict[str, list[dict[str, Any]]] = {
            "leads": [
                {
                    "id": LEAD_ID,
                    "team_id": TEAM_ID,
                    "ren_id": USER_ID,
                    "name": "Due Lead",
                    "status": "Contacted",
                    "last_interaction_at": old_interaction,
                }
            ],
            "properties": [],
            "lead_properties": [],
            "viewings": [],
            "deals": [],
            "timeline_events": [],
        }

    def table(self, table_name: str) -> FakeQuery:
        return FakeQuery(self, table_name)


def test_manual_timeline_event_clears_followup_due(monkeypatch) -> None:
    supabase = FakeSupabase()
    auth = AuthContext(
        auth_user_id=AUTH_USER_ID,
        user_id=USER_ID,
        team_id=TEAM_ID,
        role="REN",
        claims={},
    )
    user = {
        "id": USER_ID,
        "role": "REN",
        "team_id": TEAM_ID,
        "full_name": "Follow Up REN",
        "monthly_target_amount": None,
    }

    monkeypatch.setattr(dashboard_routes, "get_service_supabase", lambda: supabase)
    monkeypatch.setattr(dashboard_routes, "get_current_user_record", lambda _auth: user)
    monkeypatch.setattr(lead_routes, "get_service_supabase", lambda: supabase)
    monkeypatch.setattr(lead_routes, "get_current_user_record", lambda _auth: user)

    before = dashboard_routes.get_dashboard(auth=auth)
    assert [lead["id"] for lead in before["tasks"]["follow_ups_due"]] == [LEAD_ID]

    lead_routes.log_manual_timeline_event(
        lead_id=LEAD_ID,
        payload=lead_routes.ManualTimelineEventCreate(
            event_type=TimelineEventType.MANUAL_CALL,
            note="Called customer",
        ),
        auth=auth,
    )

    after = dashboard_routes.get_dashboard(auth=auth)
    assert after["tasks"]["follow_ups_due"] == []
    assert after["kpis"]["follow_ups_due"] == 0
