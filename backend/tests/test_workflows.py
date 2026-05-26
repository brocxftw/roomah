from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app import users as user_helpers
from app.auth import AuthContext
from app.models import (
    CampaignChannel,
    LeadStatus,
    ListingType,
    PropertyStatus,
    TimelineEventType,
)
from app.routes import campaigns as campaign_routes
from app.routes import dashboard as dashboard_routes
from app.routes import deals as deal_routes
from app.routes import leads as lead_routes
from app.routes import manager as manager_routes
from app.routes import properties as property_routes
from app.routes import users as user_routes
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

    def or_(self, expression: str) -> FakeQuery:
        self.filters.append(("or", "", expression))
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

    def maybe_single(self) -> FakeQuery:
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
            if operator == "or":
                rows = [row for row in rows if self._matches_or(row, value)]
            else:
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

    @staticmethod
    def _matches_or(row: dict[str, Any], expression: str) -> bool:
        for clause in expression.split(","):
            parts = clause.split(".ilike.")
            if len(parts) != 2:
                continue
            column, pattern = parts
            needle = pattern.strip("%").lower()
            if needle in str(row.get(column, "")).lower():
                return True
        return False


class FakeRpc:
    def __init__(
        self,
        supabase: FakeSupabase,
        function_name: str,
        params: dict[str, Any],
    ) -> None:
        self.supabase = supabase
        self.function_name = function_name
        self.params = params

    def execute(self) -> FakeResponse:
        if self.function_name != "apply_lead_campaign_attribution_counters":
            raise AssertionError(f"Unsupported RPC: {self.function_name}")

        from_campaign = self.params.get("p_from_campaign")
        to_campaign = self.params.get("p_to_campaign")
        if from_campaign and from_campaign != to_campaign:
            for campaign in self.supabase.tables["marketing_campaigns"]:
                if campaign["id"] == from_campaign:
                    campaign["leads_generated"] = max(
                        int(campaign["leads_generated"]) - 1,
                        0,
                    )
        if to_campaign and from_campaign != to_campaign:
            for campaign in self.supabase.tables["marketing_campaigns"]:
                if campaign["id"] == to_campaign:
                    campaign["leads_generated"] = int(campaign["leads_generated"]) + 1
        return FakeResponse(None)


class FakeSupabase:
    def __init__(self) -> None:
        self.counters: dict[str, int] = {}
        self.tables: dict[str, list[dict[str, Any]]] = {
            "teams": [
                {
                    "id": TEAM_ID,
                    "name": "Default Team",
                    "monthly_target_amount": None,
                }
            ],
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
            "marketing_campaigns": [],
            "timeline_events": [],
        }

    @staticmethod
    def user(user_id: str, email: str, role: str) -> dict[str, Any]:
        return {
            "id": user_id,
            "auth_user_id": f"auth-{user_id}",
            "team_id": TEAM_ID,
            "email": email,
            "role": role,
            "commission_rate": "0.02",
            "full_name": email.split("@", maxsplit=1)[0],
            "phone_number": None,
            "active_status": True,
            "monthly_target_amount": None,
        }

    def table(self, table_name: str) -> FakeQuery:
        return FakeQuery(self, table_name)

    def rpc(self, function_name: str, params: dict[str, Any]) -> FakeRpc:
        return FakeRpc(self, function_name, params)

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


def property_required_fields(**overrides: Any) -> dict[str, Any]:
    fields: dict[str, Any] = {
        "owner_name": "Owner One",
        "owner_email": "owner@example.com",
        "owner_phone": "60112223333",
        "address_line_1": "12 Jalan Kiara",
        "address_line_2": None,
        "city": "Mont Kiara",
        "state": "Kuala Lumpur",
        "postcode": "50480",
    }
    fields.update(overrides)
    return fields


def patch_supabase(monkeypatch: pytest.MonkeyPatch, supabase: FakeSupabase) -> None:
    modules = [
        campaign_routes,
        dashboard_routes,
        lead_routes,
        manager_routes,
        property_routes,
        viewing_routes,
        deal_routes,
        user_routes,
    ]
    for module in modules:
        monkeypatch.setattr(module, "get_service_supabase", lambda: supabase)
    monkeypatch.setattr(user_helpers, "get_service_supabase", lambda: supabase)

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
            **property_required_fields(),
            price=Decimal("500000"),
            listing_price=Decimal("500000"),
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
    assert supabase.tables["leads"][0]["status"] == "Won"
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
        payload=lead_routes.LeadUpdate(status=LeadStatus.CONTACTED),
        auth=auth,
    )

    assert revived["status"] == "Contacted"
    assert any(
        event["event_type"] == TimelineEventType.LEAD_STATUS_CHANGED.value
        and event["lead_id"] == other_lead["id"]
        and event["payload"] == {"from": "Lost", "to": "Contacted"}
        for event in supabase.tables["timeline_events"]
    )


def test_campaign_attribution_counters_and_deal_conversion(monkeypatch) -> None:
    supabase = FakeSupabase()
    auth = auth_context(REN_ID, "REN")
    patch_supabase(monkeypatch, supabase)
    campaign = campaign_routes.create_campaign(
        payload=campaign_routes.MarketingCampaignCreate(
            name="Facebook Leads",
            channel=CampaignChannel.FACEBOOK,
            campaign_start_date=datetime.now(UTC).date(),
        ),
        auth=auth,
    )
    supabase.table("marketing_campaigns").update({"status": "Active"}).eq(
        "id",
        campaign["id"],
    ).execute()

    lead = lead_routes.create_lead(
        payload=lead_routes.LeadCreate(
            name="Campaign Buyer",
            phone="60123456789",
            email="campaign@example.com",
            campaign_id=campaign["id"],
        ),
        auth=auth,
    )
    property_row = property_routes.create_property(
        payload=property_routes.PropertyCreate(
            name="Campaign Condo",
            type="Condo",
            **property_required_fields(),
            listing_type=ListingType.SALE,
            listing_price=Decimal("500000"),
        ),
        auth=auth,
    )
    lead_routes.link_property(
        lead_id=lead["id"],
        payload=lead_routes.LeadPropertyLinkCreate(property_id=property_row["id"]),
        auth=auth,
    )
    deal_routes.create_deal(
        payload=deal_routes.DealCreate(
            lead_id=lead["id"],
            property_id=property_row["id"],
            sale_price=Decimal("500000"),
        ),
        auth=auth,
    )

    campaign_after = supabase.tables["marketing_campaigns"][0]
    assert campaign_after["leads_generated"] == 1
    assert campaign_after["conversions"] == 1
    assert any(
        event["event_type"] == TimelineEventType.LEAD_CAMPAIGN_ATTRIBUTED.value
        and event["lead_id"] == lead["id"]
        for event in supabase.tables["timeline_events"]
    )


def test_lost_cascade_does_not_touch_other_lead_campaign_counters(
    monkeypatch,
) -> None:
    supabase = FakeSupabase()
    auth = auth_context(REN_ID, "REN")
    patch_supabase(monkeypatch, supabase)
    closing_campaign = campaign_routes.create_campaign(
        payload=campaign_routes.MarketingCampaignCreate(
            name="Closing Campaign",
            channel=CampaignChannel.GOOGLE,
            campaign_start_date=datetime.now(UTC).date(),
        ),
        auth=auth,
    )
    other_campaign = campaign_routes.create_campaign(
        payload=campaign_routes.MarketingCampaignCreate(
            name="Other Campaign",
            channel=CampaignChannel.FACEBOOK,
            campaign_start_date=datetime.now(UTC).date(),
        ),
        auth=auth,
    )
    for campaign in supabase.tables["marketing_campaigns"]:
        campaign["status"] = "Active"

    closing_lead, property_row, _viewing = create_lead_property_link_viewing(
        supabase,
        auth,
    )
    lead_routes.update_lead(
        lead_id=closing_lead["id"],
        payload=lead_routes.LeadUpdate(campaign_id=closing_campaign["id"]),
        auth=auth,
    )
    other_lead = lead_routes.create_lead(
        payload=lead_routes.LeadCreate(
            name="Other Campaign Lead",
            phone="60987654321",
            email="othercampaign@example.com",
            campaign_id=other_campaign["id"],
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

    campaigns_by_id = {
        campaign["id"]: campaign for campaign in supabase.tables["marketing_campaigns"]
    }
    assert campaigns_by_id[closing_campaign["id"]]["conversions"] == 1
    assert campaigns_by_id[other_campaign["id"]]["leads_generated"] == 1
    assert campaigns_by_id[other_campaign["id"]]["conversions"] == 0


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


def test_sale_property_requires_listing_price() -> None:
    with pytest.raises(ValueError, match="listing_price is required"):
        property_routes.PropertyCreate(
            name="Sale Condo",
            type="Condo",
            **property_required_fields(),
            listing_type=ListingType.SALE,
        )


def test_property_creation_requires_owner_details() -> None:
    with pytest.raises(ValueError, match="owner_name"):
        property_routes.PropertyCreate(
            name="Ownerless Condo",
            type="Condo",
            address_line_1="12 Jalan Kiara",
            city="Mont Kiara",
            state="Kuala Lumpur",
            postcode="50480",
            listing_price=Decimal("500000"),
        )


def test_property_creation_requires_structured_address() -> None:
    with pytest.raises(ValueError, match="address_line_1"):
        property_routes.PropertyCreate(
            name="Addressless Condo",
            type="Condo",
            owner_name="Owner One",
            owner_email="owner@example.com",
            owner_phone="60112223333",
            listing_price=Decimal("500000"),
        )


def test_property_rejects_legacy_location_only_payload() -> None:
    with pytest.raises(ValueError, match="location"):
        property_routes.PropertyCreate(
            name="Legacy Condo",
            type="Condo",
            location="KL",  # type: ignore[call-arg]
            listing_price=Decimal("500000"),
        )

    with pytest.raises(ValueError, match="location"):
        property_routes.PropertyUpdate(location="KL")  # type: ignore[call-arg]


def test_rental_property_requires_expected_rental() -> None:
    with pytest.raises(ValueError, match="expected_rental is required"):
        property_routes.PropertyCreate(
            name="Rental Condo",
            type="Condo",
            **property_required_fields(),
            listing_type=ListingType.RENTAL,
        )


def test_both_property_requires_both_prices() -> None:
    with pytest.raises(ValueError, match="expected_rental is required"):
        property_routes.PropertyCreate(
            name="Dual Listing",
            type="Condo",
            **property_required_fields(),
            listing_type=ListingType.BOTH,
            listing_price=Decimal("500000"),
        )


def test_sale_property_rejects_expected_rental() -> None:
    with pytest.raises(ValueError, match="expected_rental is not allowed"):
        property_routes.PropertyCreate(
            name="Bad Sale Condo",
            type="Condo",
            **property_required_fields(),
            listing_type=ListingType.SALE,
            listing_price=Decimal("500000"),
            expected_rental=Decimal("2500"),
        )


def test_property_listing_type_filter(monkeypatch) -> None:
    supabase = FakeSupabase()
    auth = auth_context(REN_ID, "REN")
    patch_supabase(monkeypatch, supabase)
    property_routes.create_property(
        payload=property_routes.PropertyCreate(
            name="Rental Condo",
            type="Condo",
            **property_required_fields(city="Bangsar", postcode="59100"),
            listing_type=ListingType.RENTAL,
            expected_rental=Decimal("2500"),
        ),
        auth=auth,
    )
    property_routes.create_property(
        payload=property_routes.PropertyCreate(
            name="Sale Condo",
            type="Condo",
            **property_required_fields(city="Mont Kiara", postcode="50480"),
            listing_type=ListingType.SALE,
            listing_price=Decimal("500000"),
        ),
        auth=auth,
    )

    rentals = property_routes.list_properties(listing_type="Rental", auth=auth)

    assert [property_row["name"] for property_row in rentals] == ["Rental Condo"]


def test_property_search_matches_owner_and_structured_address(monkeypatch) -> None:
    supabase = FakeSupabase()
    auth = auth_context(REN_ID, "REN")
    patch_supabase(monkeypatch, supabase)
    property_routes.create_property(
        payload=property_routes.PropertyCreate(
            name="Skyline Residence",
            type="Condo",
            **property_required_fields(
                owner_name="Sarah Landlord",
                owner_email="sarah@example.com",
                owner_phone="60177778888",
                city="Mont Kiara",
                state="Kuala Lumpur",
                postcode="50480",
            ),
            listing_type=ListingType.SALE,
            listing_price=Decimal("500000"),
        ),
        auth=auth,
    )
    property_routes.create_property(
        payload=property_routes.PropertyCreate(
            name="Subang Rental",
            type="Condo",
            **property_required_fields(
                owner_name="Other Owner",
                owner_email="other@example.com",
                owner_phone="60199990000",
                city="Subang Jaya",
                state="Selangor",
                postcode="47500",
            ),
            listing_type=ListingType.RENTAL,
            expected_rental=Decimal("2200"),
        ),
        auth=auth,
    )

    owner_matches = property_routes.list_properties(q="sarah", auth=auth)
    postcode_matches = property_routes.list_properties(q="50480", auth=auth)
    city_matches = property_routes.list_properties(city="Mont Kiara", auth=auth)
    state_matches = property_routes.list_properties(state="Selangor", auth=auth)

    assert [property_row["name"] for property_row in owner_matches] == [
        "Skyline Residence"
    ]
    assert [property_row["name"] for property_row in postcode_matches] == [
        "Skyline Residence"
    ]
    assert [property_row["name"] for property_row in city_matches] == [
        "Skyline Residence"
    ]
    assert [property_row["name"] for property_row in state_matches] == ["Subang Rental"]


def test_linking_mismatched_listing_type_returns_warning(monkeypatch) -> None:
    supabase = FakeSupabase()
    auth = auth_context(REN_ID, "REN")
    patch_supabase(monkeypatch, supabase)
    lead = lead_routes.create_lead(
        payload=lead_routes.LeadCreate(
            name="Buyer",
            phone="60123456789",
            email="buyer@example.com",
            preferred_property_type="buy",
        ),
        auth=auth,
    )
    property_row = property_routes.create_property(
        payload=property_routes.PropertyCreate(
            name="Rental Condo",
            type="Condo",
            **property_required_fields(),
            listing_type=ListingType.RENTAL,
            expected_rental=Decimal("2500"),
        ),
        auth=auth,
    )

    linked = lead_routes.link_property(
        lead_id=lead["id"],
        payload=lead_routes.LeadPropertyLinkCreate(property_id=property_row["id"]),
        auth=auth,
    )

    assert linked["warnings"]


def test_deactivated_ren_cannot_close_deal(monkeypatch) -> None:
    supabase = FakeSupabase()
    auth = auth_context(REN_ID, "REN")
    patch_supabase(monkeypatch, supabase)
    lead, property_row, _viewing = create_lead_property_link_viewing(supabase, auth)
    supabase.tables["users"][0]["active_status"] = False

    with pytest.raises(HTTPException) as exc_info:
        deal_routes.create_deal(
            payload=deal_routes.DealCreate(
                lead_id=lead["id"],
                property_id=property_row["id"],
                sale_price=Decimal("500000"),
            ),
            auth=auth,
        )

    assert exc_info.value.status_code == 401


def test_rental_deal_persists_submitted_sale_price(monkeypatch) -> None:
    supabase = FakeSupabase()
    auth = auth_context(REN_ID, "REN")
    patch_supabase(monkeypatch, supabase)
    lead = lead_routes.create_lead(
        payload=lead_routes.LeadCreate(
            name="Tenant",
            phone="60123456789",
            email="tenant@example.com",
            preferred_property_type="rental",
        ),
        auth=auth,
    )
    property_row = property_routes.create_property(
        payload=property_routes.PropertyCreate(
            name="Rental Condo",
            type="Condo",
            **property_required_fields(),
            listing_type=ListingType.RENTAL,
            expected_rental=Decimal("2500"),
        ),
        auth=auth,
    )
    lead_routes.link_property(
        lead_id=lead["id"],
        payload=lead_routes.LeadPropertyLinkCreate(property_id=property_row["id"]),
        auth=auth,
    )

    deal = deal_routes.create_deal(
        payload=deal_routes.DealCreate(
            lead_id=lead["id"],
            property_id=property_row["id"],
            deal_type=ListingType.RENTAL,
            sale_price=Decimal("2500"),
        ),
        auth=auth,
    )

    assert deal["sale_price"] == "2500"


def test_ren_cannot_patch_restricted_user_fields(monkeypatch) -> None:
    supabase = FakeSupabase()
    auth = auth_context(REN_ID, "REN")
    patch_supabase(monkeypatch, supabase)

    with pytest.raises(HTTPException) as exc_info:
        user_routes.update_me(
            payload=user_routes.UserSelfUpdate(active_status=False),
            auth=auth,
        )

    assert exc_info.value.status_code == 403


def test_manager_can_patch_team_member_identity_and_status(monkeypatch) -> None:
    supabase = FakeSupabase()
    auth = auth_context(MANAGER_ID, "MANAGER")
    patch_supabase(monkeypatch, supabase)

    updated = user_routes.update_user(
        user_id=REN_ID,
        payload=user_routes.UserAdminUpdate(
            full_name="Alice Tan",
            phone_number="+60123456789",
            active_status=False,
        ),
        auth=auth,
    )

    assert updated["full_name"] == "Alice Tan"
    assert updated["phone_number"] == "+60123456789"
    assert updated["active_status"] is False


def test_ren_can_patch_monthly_target_and_dashboard_uses_personal_scope(
    monkeypatch,
) -> None:
    supabase = FakeSupabase()
    auth = auth_context(REN_ID, "REN")
    patch_supabase(monkeypatch, supabase)

    updated = user_routes.update_me(
        payload=user_routes.UserSelfUpdate(monthly_target_amount=Decimal("500000")),
        auth=auth,
    )
    dashboard = dashboard_routes.get_dashboard(auth=auth)

    assert updated["monthly_target_amount"] == "500000"
    assert dashboard["target_progress"]["scope"] == "personal"
    assert dashboard["target_progress"]["target_amount"] == "500000"


def test_dashboard_returns_six_stage_pipeline_funnel_with_values(
    monkeypatch,
) -> None:
    supabase = FakeSupabase()
    auth = auth_context(REN_ID, "REN")
    patch_supabase(monkeypatch, supabase)
    now = datetime.now(UTC).isoformat()
    lead_statuses = [
        "New",
        "Contacted",
        "Qualified",
        "Proposal",
        "Negotiation",
        "Won",
        "Won",
    ]
    for index, status_value in enumerate(lead_statuses, start=1):
        lead_id = f"lead-{index}"
        property_id = f"property-{index}"
        supabase.tables["leads"].append(
            {
                "id": lead_id,
                "team_id": TEAM_ID,
                "ren_id": REN_ID,
                "name": f"Lead {index}",
                "phone": f"6010000000{index}",
                "email": f"lead{index}@example.com",
                "status": status_value,
                "created_at": now,
                "updated_at": now,
                "last_interaction_at": now,
                "campaign_id": None,
            }
        )
        supabase.tables["properties"].append(
            {
                "id": property_id,
                "team_id": TEAM_ID,
                "ren_id": REN_ID,
                "status": "Active",
                "listing_price": "100000",
                "price": "90000",
            }
        )
        supabase.tables["lead_properties"].append(
            {
                "lead_id": lead_id,
                "property_id": property_id,
                "status": "active",
                "created_at": now,
            }
        )
        if status_value == "Won":
            supabase.tables["deals"].append(
                {
                    "id": f"deal-{index}",
                    "team_id": TEAM_ID,
                    "lead_id": lead_id,
                    "property_id": property_id,
                    "ren_id": REN_ID,
                    "sale_price": "500000",
                    "commission_rate": "0.02",
                    "agency_fee": "1000",
                    "lawyer_fees": "2000",
                    "commission_total": "7000",
                    "commission_override": None,
                    "closed_at": now,
                    "created_at": now,
                }
            )

    dashboard = dashboard_routes.get_dashboard(auth=auth)
    stages = {stage["stage"]: stage for stage in dashboard["funnel"]}

    assert list(stages) == [
        "New",
        "Contacted",
        "Qualified",
        "Proposal",
        "Negotiation",
        "Won",
    ]
    assert stages["New"]["count"] == 1
    assert stages["New"]["value"] == "100000"
    assert stages["Won"]["count"] == 2
    assert stages["Won"]["value"] == "1000000"
    assert dashboard["pipeline_conversion_denominator"] == 5
    assert dashboard["pipeline_conversion_rate"] == 0.4


def test_manager_can_patch_team_target_and_dashboard_uses_team_scope(
    monkeypatch,
) -> None:
    supabase = FakeSupabase()
    auth = auth_context(MANAGER_ID, "MANAGER")
    patch_supabase(monkeypatch, supabase)

    updated = manager_routes.update_team_target(
        payload=manager_routes.TeamTargetUpdate(
            monthly_target_amount=Decimal("1500000")
        ),
        auth=auth,
    )
    dashboard = dashboard_routes.get_dashboard(auth=auth)

    assert updated["monthly_target_amount"] == "1500000"
    assert dashboard["target_progress"]["scope"] == "team"
    assert dashboard["target_progress"]["target_amount"] == "1500000"
    assert dashboard["personal_progress"] is not None
    assert dashboard["personal_progress"]["scope"] == "personal"
    funnel_stages = {stage["stage"] for stage in dashboard["funnel"]}
    assert funnel_stages == {
        "New",
        "Contacted",
        "Qualified",
        "Proposal",
        "Negotiation",
        "Won",
    }
    assert dashboard["pipeline_conversion_rate"] is None
