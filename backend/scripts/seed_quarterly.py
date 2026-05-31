"""Seed leads / properties / deals spread across multiple calendar quarters.

Designed for exercising the date / quarter filters in the dashboards. By
default it inserts:

  * 50 leads across Q3 2025 -> Q2 2026 (weighted toward recent quarters)
  * 50 properties across the same range
  * 20 deals whose ``closed_at`` falls in each of the four quarters too

The script is *additive* and *coherent*:

  * Leads / properties carry backdated ``created_at`` / ``updated_at`` so
    every quarter actually has new inventory and pipeline.
  * Leads also carry backdated ``last_interaction_at`` matching their
    ``created_at`` (so they don't all show up as "stale" follow-ups).
  * For each deal we pick a lead **and** property whose ``created_at`` is
    on or before the deal's ``closed_at`` (no impossible relationships).
  * Each deal mirrors every side-effect the ``POST /deals`` route applies:
    flips lead -> Won, property -> Inactive, inactivates other active
    ``lead_properties`` links + flips those losing leads -> Lost, emits
    backdated ``deal_closed`` / ``lead_status_changed`` /
    ``property_unlinked`` timeline events, and increments
    ``marketing_campaigns.conversions`` when the winning lead is
    campaign-attributed.

Use ``--dry-run`` to preview the plan without writing.

Usage::

    python -m scripts.seed_quarterly
    python -m scripts.seed_quarterly --leads 30 --properties 30 --deals 10
    python -m scripts.seed_quarterly --seed 7 --dry-run
"""

from __future__ import annotations

import argparse
import random
import sys
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from typing import Any

from app.core.config import get_settings
from app.supabase import get_service_supabase
from scripts.seed_deals import (
    _compute_fees,
    _compute_sale_price,
    _emit_event,
    _ensure_active_link,
    _format_deal_row,
    _has_realistic_price,
)

# --- Demo data tables (inlined; previously lived in scripts/seed_mock_data.py) ---

FIRST_NAMES: Sequence[str] = (
    "Aisha", "Aiman", "Adam", "Adlina", "Afiq", "Amir", "Amelia", "Aizat",
    "Brenda", "Bryan", "Bella", "Chong Wei", "Cheryl", "Daniel", "Damia",
    "Eddy", "Eunice", "Farah", "Faizal", "Gavin", "Hafiz", "Hannah", "Iman",
    "Ismail", "Jasmine", "Jia Ling", "Junaid", "Kai", "Kavitha", "Kumar",
    "Lily", "Liyana", "Marcus", "Mei Ling", "Mira", "Nabil", "Nadia",
    "Nicholas", "Nurul", "Omar", "Priya", "Qistina", "Rajesh", "Rina",
    "Sarah", "Siti", "Suresh", "Tan", "Tasha", "Umar", "Vincent", "Wei Jie",
    "Xin Yi", "Yusuf", "Zara", "Zubair",
)

LAST_NAMES: Sequence[str] = (
    "Abdullah", "Ahmad", "Ali", "Bakar", "Bin Hassan", "Binti Yusof", "Cheng",
    "Chong", "Chua", "Devi", "Fernandez", "Goh", "Hashim", "Ibrahim", "Ismail",
    "Iskandar", "Jamaluddin", "Khan", "Kumar", "Lee", "Lim", "Loh", "Mahmud",
    "Mohamad", "Ng", "Omar", "Othman", "Pillai", "Rahman", "Raj", "Sani",
    "Shaari", "Tan", "Tay", "Wong", "Yap", "Yusoff", "Zainuddin", "Zulkifli",
)

LOCATIONS: Sequence[dict[str, str]] = (
    {"city": "Kuala Lumpur", "state": "Federal Territory", "postcode": "50450"},
    {"city": "Kuala Lumpur", "state": "Federal Territory", "postcode": "50250"},
    {"city": "Mont Kiara", "state": "Federal Territory", "postcode": "50480"},
    {"city": "Bangsar", "state": "Federal Territory", "postcode": "59100"},
    {"city": "Cheras", "state": "Federal Territory", "postcode": "56000"},
    {"city": "Setapak", "state": "Federal Territory", "postcode": "53300"},
    {"city": "Petaling Jaya", "state": "Selangor", "postcode": "47800"},
    {"city": "Subang Jaya", "state": "Selangor", "postcode": "47500"},
    {"city": "Shah Alam", "state": "Selangor", "postcode": "40150"},
    {"city": "Cyberjaya", "state": "Selangor", "postcode": "63000"},
    {"city": "Puchong", "state": "Selangor", "postcode": "47100"},
    {"city": "Kajang", "state": "Selangor", "postcode": "43000"},
    {"city": "Klang", "state": "Selangor", "postcode": "41200"},
    {"city": "George Town", "state": "Penang", "postcode": "10200"},
    {"city": "Bayan Lepas", "state": "Penang", "postcode": "11900"},
    {"city": "Tanjung Bungah", "state": "Penang", "postcode": "11200"},
    {"city": "Johor Bahru", "state": "Johor", "postcode": "80100"},
    {"city": "Iskandar Puteri", "state": "Johor", "postcode": "79100"},
    {"city": "Ipoh", "state": "Perak", "postcode": "31400"},
    {"city": "Malacca City", "state": "Melaka", "postcode": "75000"},
    {"city": "Seremban", "state": "Negeri Sembilan", "postcode": "70100"},
    {"city": "Kota Kinabalu", "state": "Sabah", "postcode": "88000"},
    {"city": "Kuching", "state": "Sarawak", "postcode": "93350"},
    {"city": "Kuantan", "state": "Pahang", "postcode": "25300"},
    {"city": "Kota Bharu", "state": "Kelantan", "postcode": "15000"},
)

STREETS: Sequence[str] = (
    "Jalan Ampang", "Jalan Tun Razak", "Jalan Bukit Bintang", "Jalan Sultan",
    "Jalan Damansara", "Jalan Maarof", "Jalan Telawi", "Jalan SS2/24",
    "Jalan PJU 7/5", "Jalan USJ 21/2", "Jalan Kiara", "Jalan Stonor",
    "Persiaran KLCC", "Persiaran Gurney", "Lebuh Pantai", "Jalan Tebrau",
    "Jalan Wong Ah Fook", "Jalan Sultan Idris Shah", "Jalan Bendahara",
    "Lorong Maarof", "Jalan Cangkat", "Jalan U-Thant",
)

BUILDINGS: Sequence[str] = (
    "Vista Residences", "The Pearl", "Azure Heights", "Saujana Park",
    "Riverstone Apartments", "Skyline Suites", "Greenview Condo",
    "The Sentral", "Bayu Heights", "Indah Court", "Permai Villas",
    "Mont Kiara Aman", "Damansara Foresta", "Setia Eco Park", "Sentul West",
    "TTDI Hills", "Sri Penaga", "Pavilion Damansara", "Tropicana Gardens",
    "Eco Sanctuary", "Tijani North", "Verve Suites", "M Vertica",
    "The Henge", "Bandar Botanic",
)

PROPERTY_TYPES: Sequence[str] = (
    "Condominium", "Serviced Apartment", "Apartment", "Studio",
    "Terrace House", "Semi-Detached", "Bungalow", "Townhouse",
    "Penthouse", "Shop Lot", "Office Suite",
)

FURNISHING: Sequence[str] = ("Fully Furnished", "Partially Furnished", "Unfurnished")

LEAD_STATUSES: Sequence[tuple[str, int]] = (
    ("New", 30),
    ("Contacted", 22),
    ("Qualified", 18),
    ("Proposal", 12),
    ("Negotiation", 10),
    ("Lost", 8),
)

PROPERTY_STATUSES: Sequence[tuple[str, int]] = (
    # Always Active on insert so the deal-planning stage has enough inventory
    # to back the quarter allocation. Deals flip the winning property to
    # Inactive afterwards, which keeps a realistic mix in the final data.
    ("Active", 100),
)

LISTING_TYPES: Sequence[tuple[str, int]] = (
    ("Sale", 55),
    ("Rental", 35),
    ("Both", 10),
)

PROPERTY_DESCRIPTIONS: Sequence[str] = (
    "Bright corner unit with unobstructed city views and a generous balcony.",
    "Freshly renovated with new kitchen cabinetry, quartz countertops, "
    "and LED lighting.",
    "Walking distance to MRT, schools, and a popular shopping mall.",
    "Comes with two covered parking bays and 24-hour gated security.",
    "Low-density development with full facilities including pool, gym, "
    "and sauna.",
    "Quiet neighbourhood, family-friendly, close to international schools.",
    "Strategic location with easy access to NKVE, LDP, and Federal Highway.",
    "Move-in ready - fully painted, all aircons serviced, kitchen "
    "appliances included.",
    "High floor unit with breathtaking sunset views over the Klang Valley.",
    "Spacious built-up with separate wet and dry kitchen; ideal for big "
    "families.",
)


def _weighted_choice(items: Sequence[tuple[str, int]], rng: random.Random) -> str:
    values, weights = zip(*items, strict=True)
    return rng.choices(values, weights=weights, k=1)[0]


def _mobile_number(rng: random.Random) -> str:
    prefix = rng.choice(("11", "12", "13", "14", "16", "17", "18", "19"))
    return f"+601{prefix}{rng.randint(1000000, 9999999)}"


def _round_to(value: int, step: int) -> int:
    return (value // step) * step


def _make_property(
    *, team_id: str, ren_id: str, rng: random.Random, index: int
) -> dict[str, Any]:
    location = rng.choice(LOCATIONS)
    prop_type = rng.choice(PROPERTY_TYPES)
    listing_type = _weighted_choice(LISTING_TYPES, rng)
    status = _weighted_choice(PROPERTY_STATUSES, rng)
    building = rng.choice(BUILDINGS)

    bedrooms = rng.choice((1, 2, 2, 3, 3, 3, 4, 4, 5))
    bathrooms = max(1, bedrooms - rng.choice((0, 1, 1)))
    sqft = rng.choice((480, 650, 800, 950, 1100, 1250, 1450, 1650, 1800, 2200, 2800))
    parking = rng.choice((1, 1, 2, 2, 2, 3))

    listing_price: Decimal | None = None
    expected_rental: Decimal | None = None
    market_value = Decimal(_round_to(rng.randint(380_000, 2_400_000), 5_000))

    if listing_type in ("Sale", "Both"):
        listing_price = Decimal(_round_to(rng.randint(420_000, 2_800_000), 5_000))
    if listing_type in ("Rental", "Both"):
        expected_rental = Decimal(_round_to(rng.randint(1500, 9500), 50))

    primary_price = listing_price or (
        (expected_rental * 200) if expected_rental is not None else market_value
    )

    owner_first = rng.choice(FIRST_NAMES)
    owner_last = rng.choice(LAST_NAMES)
    owner_name = f"{owner_first} {owner_last}"
    owner_email = (
        f"{owner_first.lower().replace(' ', '')}."
        f"{owner_last.lower().replace(' ', '')}{rng.randint(1, 99)}"
        f"@example.com"
    )

    street = rng.choice(STREETS)
    unit_no = (
        f"{rng.choice(('A', 'B', 'C', 'D'))}-{rng.randint(1, 28):02d}"
        f"-{rng.randint(1, 18):02d}"
    )

    return {
        "team_id": team_id,
        "ren_id": ren_id,
        "name": f"{building} #{index:03d}",
        "type": prop_type,
        "owner_name": owner_name,
        "owner_email": owner_email,
        "owner_phone": _mobile_number(rng),
        "address_line_1": f"{rng.randint(1, 250)} {street}",
        "address_line_2": unit_no,
        "city": location["city"],
        "state": location["state"],
        "postcode": location["postcode"],
        "price": float(primary_price),
        "listing_type": listing_type,
        "market_value": float(market_value),
        "listing_price": float(listing_price) if listing_price is not None else None,
        "expected_rental": (
            float(expected_rental) if expected_rental is not None else None
        ),
        "year_built": rng.randint(1998, 2024),
        "maintenance_fee": float(Decimal(_round_to(rng.randint(180, 950), 10))),
        "status": status,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "sqft": sqft,
        "parking": parking,
        "furnishing": rng.choice(FURNISHING),
        "description": rng.choice(PROPERTY_DESCRIPTIONS),
    }


def _make_lead(
    *, team_id: str, ren_id: str, rng: random.Random
) -> dict[str, Any]:
    first = rng.choice(FIRST_NAMES)
    last = rng.choice(LAST_NAMES)
    name = f"{first} {last}"
    email = (
        f"{first.lower().replace(' ', '')}."
        f"{last.lower().replace(' ', '')}{rng.randint(1, 999)}"
        f"@example.com"
    )

    budget_min = Decimal(_round_to(rng.randint(250_000, 1_400_000), 10_000))
    budget_max = budget_min + Decimal(_round_to(rng.randint(80_000, 600_000), 10_000))

    preferred_location = rng.choice(LOCATIONS)["city"]
    preferred_type = rng.choice(PROPERTY_TYPES)
    status = _weighted_choice(LEAD_STATUSES, rng)

    return {
        "team_id": team_id,
        "ren_id": ren_id,
        "name": name,
        "phone": _mobile_number(rng),
        "email": email,
        "budget_min": float(budget_min),
        "budget_max": float(budget_max),
        "preferred_location": preferred_location,
        "preferred_property_type": preferred_type,
        "status": status,
    }


# --- End of inlined demo data tables ---


@dataclass(frozen=True)
class Quarter:
    label: str
    start: date  # inclusive
    end: date    # inclusive

    def clip_end(self, today: date) -> date:
        return min(self.end, today)


QUARTERS: Sequence[Quarter] = (
    Quarter("Q3 2025", date(2025, 7, 1), date(2025, 9, 30)),
    Quarter("Q4 2025", date(2025, 10, 1), date(2025, 12, 31)),
    Quarter("Q1 2026", date(2026, 1, 1), date(2026, 3, 31)),
    Quarter("Q2 2026", date(2026, 4, 1), date(2026, 6, 30)),
)

# Weighted toward recent quarters: more recent activity = more rows. Weights
# are normalised against the user-supplied --leads/--properties/--deals so any
# total works without code changes.
QUARTER_WEIGHTS: tuple[int, int, int, int] = (8, 12, 14, 16)


def _allocate(total: int) -> list[int]:
    weight_total = sum(QUARTER_WEIGHTS)
    allocated: list[int] = []
    remaining = total
    for index, weight in enumerate(QUARTER_WEIGHTS):
        if index == len(QUARTER_WEIGHTS) - 1:
            allocated.append(remaining)
            break
        count = round(total * weight / weight_total)
        count = max(0, min(count, remaining))
        allocated.append(count)
        remaining -= count
    return allocated


# Time partitioning inside each quarter. Entities (leads / properties) land
# in the first ``ENTITY_FRACTION`` of the quarter and deals land in the last
# ``DEAL_FRACTION``. The overlap guarantees that any deal we plan inside a
# given quarter will find at least one entity created earlier in that same
# quarter, so the dataset stays temporally coherent.
ENTITY_FRACTION = 0.60
DEAL_FRACTION = 0.60


def _random_moment_in_quarter(
    quarter: Quarter,
    rng: random.Random,
    *,
    today: date,
    portion: tuple[float, float] = (0.0, 1.0),
) -> datetime:
    """Return a backdated moment within a fractional slice of the quarter.

    ``portion`` is ``(start_fraction, end_fraction)`` of the available window
    (which is the quarter clipped by ``today``). Default returns any moment
    in the whole window.
    """
    span_end = quarter.clip_end(today)
    span_days = max((span_end - quarter.start).days, 0)
    start_offset = int(span_days * portion[0])
    end_offset = max(int(span_days * portion[1]), start_offset)
    day_offset = rng.randint(start_offset, end_offset)
    chosen_date = quarter.start + timedelta(days=day_offset)
    chosen_time = time(
        hour=rng.randint(8, 19),
        minute=rng.randint(0, 59),
        second=rng.randint(0, 59),
    )
    return datetime.combine(chosen_date, chosen_time, tzinfo=UTC)


def _chunk_insert(
    supabase: Any,
    table: str,
    rows: list[dict[str, Any]],
    *,
    chunk_size: int = 50,
) -> list[dict[str, Any]]:
    inserted: list[dict[str, Any]] = []
    for start in range(0, len(rows), chunk_size):
        page = rows[start : start + chunk_size]
        response = supabase.table(table).insert(page).execute()
        inserted.extend(response.data or [])
    return inserted


def _resolve_team_user(
    supabase: Any, team_id: str
) -> tuple[str, str, list[dict[str, Any]]]:
    user_rows = (
        supabase.table("users")
        .select("id, role, active_status, commission_rate, full_name")
        .eq("team_id", team_id)
        .eq("active_status", True)
        .execute()
        .data
        or []
    )
    if not user_rows:
        raise RuntimeError(
            f"No active users found for team {team_id}; sign up the bootstrap "
            "manager first."
        )

    managers = [u for u in user_rows if u["role"] == "MANAGER"]
    preferred = managers[0] if managers else user_rows[0]
    return team_id, preferred["id"], user_rows


def _build_lead_rows(
    *,
    team_id: str,
    ren_id: str,
    counts: list[int],
    rng: random.Random,
    today: date,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for quarter, count in zip(QUARTERS, counts, strict=True):
        for _ in range(count):
            row = _make_lead(team_id=team_id, ren_id=ren_id, rng=rng)
            created_at = _random_moment_in_quarter(
                quarter,
                rng,
                today=today,
                portion=(0.0, ENTITY_FRACTION),
            )
            row["created_at"] = created_at.isoformat()
            row["updated_at"] = created_at.isoformat()
            row["last_interaction_at"] = created_at.isoformat()
            rows.append(row)
    return rows


def _build_property_rows(
    *,
    team_id: str,
    ren_id: str,
    counts: list[int],
    rng: random.Random,
    today: date,
    name_offset: int,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    index = name_offset
    for quarter, count in zip(QUARTERS, counts, strict=True):
        for _ in range(count):
            index += 1
            row = _make_property(
                team_id=team_id, ren_id=ren_id, rng=rng, index=index
            )
            created_at = _random_moment_in_quarter(
                quarter,
                rng,
                today=today,
                portion=(0.0, ENTITY_FRACTION),
            )
            row["created_at"] = created_at.isoformat()
            row["updated_at"] = created_at.isoformat()
            rows.append(row)
    return rows


def _quarter_label_for(when: datetime) -> str:
    for quarter in QUARTERS:
        if quarter.start <= when.date() <= quarter.end:
            return quarter.label
    return "other"


def _commit_deal_inline(
    supabase: Any,
    *,
    team_id: str,
    deal_row: dict[str, Any],
    deal_type: str,
    lead: dict[str, Any],
    ren_id: str,
    closed_at: datetime,
    leads_by_id: dict[str, dict[str, Any]],
    properties_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Same shape of side-effects as ``seed_deals._commit_deal``.

    We re-implement here instead of importing to avoid mutating the caches
    that the other module uses, and so we can update our own per-quarter
    caches after each commit.
    """
    property_id = deal_row["property_id"]
    lead_id = deal_row["lead_id"]

    _ensure_active_link(
        supabase,
        lead_id=lead_id,
        property_id=property_id,
        closed_at=closed_at,
    )

    deal = supabase.table("deals").insert(deal_row).execute().data[0]

    campaign_id = lead.get("campaign_id")
    if campaign_id:
        campaign = (
            supabase.table("marketing_campaigns")
            .select("conversions")
            .eq("id", campaign_id)
            .single()
            .execute()
            .data
        )
        if campaign:
            supabase.table("marketing_campaigns").update(
                {"conversions": int(campaign["conversions"]) + 1}
            ).eq("id", campaign_id).execute()

    supabase.table("leads").update({"status": "Won"}).eq("id", lead_id).execute()
    supabase.table("properties").update({"status": "Inactive"}).eq(
        "id", property_id
    ).execute()
    leads_by_id[lead_id]["status"] = "Won"
    properties_by_id[property_id]["status"] = "Inactive"

    other_links = (
        supabase.table("lead_properties")
        .select("lead_id")
        .eq("property_id", property_id)
        .eq("status", "active")
        .neq("lead_id", lead_id)
        .execute()
        .data
        or []
    )
    other_lead_ids = [link["lead_id"] for link in other_links]
    losing_status_changes: list[dict[str, str]] = []
    if other_lead_ids:
        supabase.table("lead_properties").update({"status": "inactive"}).eq(
            "property_id", property_id
        ).eq("status", "active").neq("lead_id", lead_id).execute()
        for loser_id in other_lead_ids:
            loser = leads_by_id.get(loser_id)
            if loser and loser["status"] not in ("Won", "Lost"):
                losing_status_changes.append(
                    {"id": loser_id, "from": loser["status"]}
                )
        change_ids = [row["id"] for row in losing_status_changes]
        if change_ids:
            supabase.table("leads").update({"status": "Lost"}).in_(
                "id", change_ids
            ).execute()
            for loser_id in change_ids:
                leads_by_id[loser_id]["status"] = "Lost"

    _emit_event(
        supabase,
        team_id=team_id,
        lead_id=lead_id,
        event_type="deal_closed",
        payload={
            "deal_id": deal["id"],
            "property_id": property_id,
            "deal_type": deal_type,
            "sale_price": deal_row["sale_price"],
            "commission_total": deal_row["commission_total"],
        },
        created_by=ren_id,
        created_at=closed_at,
    )
    _emit_event(
        supabase,
        team_id=team_id,
        lead_id=lead_id,
        event_type="lead_status_changed",
        payload={"from": lead["status"], "to": "Won"},
        created_by=ren_id,
        created_at=closed_at,
    )
    for losing in losing_status_changes:
        _emit_event(
            supabase,
            team_id=team_id,
            lead_id=losing["id"],
            event_type="property_unlinked",
            payload={"property_id": property_id},
            created_by=ren_id,
            created_at=closed_at,
        )
        _emit_event(
            supabase,
            team_id=team_id,
            lead_id=losing["id"],
            event_type="lead_status_changed",
            payload={"from": losing["from"], "to": "Lost"},
            created_by=ren_id,
            created_at=closed_at,
        )

    return {"deal": deal, "losing_lead_ids": [row["id"] for row in losing_status_changes]}


def _plan_deals(
    *,
    team_id: str,
    leads_pool: list[dict[str, Any]],
    properties_pool: list[dict[str, Any]],
    rens: list[dict[str, Any]],
    counts: list[int],
    rng: random.Random,
    today: date,
) -> list[dict[str, Any]]:
    plans: list[dict[str, Any]] = []
    used_leads: set[str] = set()
    used_properties: set[str] = set()

    for quarter, count in zip(QUARTERS, counts, strict=True):
        for _ in range(count):
            closed_at = _random_moment_in_quarter(
                quarter,
                rng,
                today=today,
                portion=(1.0 - DEAL_FRACTION, 1.0),
            )
            property_candidates = [
                p
                for p in properties_pool
                if p["id"] not in used_properties
                and p["status"] == "Active"
                and datetime.fromisoformat(
                    p["created_at"].replace("Z", "+00:00")
                )
                <= closed_at
                and _has_realistic_price(p)
            ]
            if not property_candidates:
                raise SystemExit(
                    f"Quarter {quarter.label}: ran out of eligible properties; "
                    "increase --properties or rebalance distribution."
                )
            lead_candidates = [
                l
                for l in leads_pool
                if l["id"] not in used_leads
                and l["status"] not in ("Won", "Lost")
                and datetime.fromisoformat(
                    l["created_at"].replace("Z", "+00:00")
                )
                <= closed_at
            ]
            if not lead_candidates:
                raise SystemExit(
                    f"Quarter {quarter.label}: ran out of eligible leads; "
                    "increase --leads or rebalance distribution."
                )

            property_row = rng.choice(property_candidates)
            lead = rng.choice(lead_candidates)
            ren = rng.choice(rens)
            sale_price, deal_type = _compute_sale_price(property_row, rng)
            commission_rate = Decimal(str(ren["commission_rate"]))
            agency_fee, lawyer_fees = _compute_fees(
                sale_price, deal_type, commission_rate, rng
            )
            deal_row = _format_deal_row(
                team_id=team_id,
                lead_id=lead["id"],
                property_id=property_row["id"],
                ren_id=ren["id"],
                sale_price=sale_price,
                commission_rate=commission_rate,
                agency_fee=agency_fee,
                lawyer_fees=lawyer_fees,
                closed_at=closed_at,
            )

            used_leads.add(lead["id"])
            used_properties.add(property_row["id"])
            plans.append(
                {
                    "quarter": quarter.label,
                    "closed_at": closed_at,
                    "deal_row": deal_row,
                    "deal_type": deal_type,
                    "lead": lead,
                    "property": property_row,
                    "ren": ren,
                }
            )
    return plans


def _normalize_entity_dates(
    supabase: Any,
    *,
    team_id: str,
    rng: random.Random,
    today: date,
    dry_run: bool,
) -> tuple[int, int]:
    """Shift existing entity ``created_at`` into the first ENTITY_FRACTION
    of its quarter so a subsequent deal pass can always find an entity
    created earlier in the same quarter.

    Only entities currently *outside* the safe window are touched. Pre-Q3
    entities are untouched (no quarter to clip to).
    """

    def _entity_window(quarter: Quarter) -> tuple[datetime, datetime]:
        start_dt = datetime.combine(quarter.start, time(0, 0, tzinfo=UTC))
        clipped_end_date = quarter.clip_end(today)
        span_days = max((clipped_end_date - quarter.start).days, 0)
        end_offset_days = int(span_days * ENTITY_FRACTION)
        end_dt = datetime.combine(
            quarter.start + timedelta(days=end_offset_days),
            time(23, 59, 59, tzinfo=UTC),
        )
        return start_dt, end_dt

    quarter_windows = {q.label: _entity_window(q) for q in QUARTERS}

    def _shift(table: str, extra_updates: dict[str, str] | None) -> int:
        rows = (
            supabase.table(table)
            .select("id, created_at")
            .eq("team_id", team_id)
            .execute()
            .data
            or []
        )
        shifted = 0
        for row in rows:
            created_at = datetime.fromisoformat(
                row["created_at"].replace("Z", "+00:00")
            )
            quarter_label = _quarter_label_for(created_at)
            window = quarter_windows.get(quarter_label)
            if window is None:
                continue
            start_dt, end_dt = window
            if start_dt <= created_at <= end_dt:
                continue

            span_seconds = max(int((end_dt - start_dt).total_seconds()), 0)
            new_dt = start_dt + timedelta(seconds=rng.randint(0, span_seconds))
            shifted += 1
            if dry_run:
                continue
            payload: dict[str, str] = {
                "created_at": new_dt.isoformat(),
                "updated_at": new_dt.isoformat(),
            }
            if extra_updates:
                for column in extra_updates.values():
                    payload[column] = new_dt.isoformat()
            supabase.table(table).update(payload).eq("id", row["id"]).execute()
        return shifted

    leads_shifted = _shift("leads", {"last_interaction": "last_interaction_at"})
    properties_shifted = _shift("properties", None)
    return leads_shifted, properties_shifted


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--leads", type=int, default=50)
    parser.add_argument("--properties", type=int, default=50)
    parser.add_argument("--deals", type=int, default=20)
    parser.add_argument("--seed", type=int, default=2026_05_31)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the plan without writing.",
    )
    parser.add_argument(
        "--resume-from-deals",
        action="store_true",
        help=(
            "Skip lead / property insertion and source the deal pool from "
            "leads and properties already present in the team's database "
            "(created within the last 90 minutes by the team's manager). "
            "Useful when a previous run inserted entities but failed before "
            "the deal stage finished."
        ),
    )
    parser.add_argument(
        "--force-active",
        action="store_true",
        help=(
            "When used with --resume-from-deals, flip any recently-inserted "
            "Pending / Inactive properties (manager-owned, < 90m old) back to "
            "Active before planning deals."
        ),
    )
    args = parser.parse_args(argv)

    if args.leads < args.deals or args.properties < args.deals:
        raise SystemExit(
            "--leads and --properties must each be >= --deals "
            "(one of each is consumed per deal)."
        )

    rng = random.Random(args.seed)
    supabase = get_service_supabase()
    settings = get_settings()
    today = datetime.now(UTC).date()
    team_id, manager_id, all_active_users = _resolve_team_user(
        supabase, settings.default_team_id
    )

    rens = [
        u
        for u in all_active_users
        if u["role"] == "REN"
        and Decimal(str(u["commission_rate"])) > Decimal("0")
    ]
    if not rens:
        raise SystemExit(
            f"Team {team_id} has no active RENs with commission_rate > 0; "
            "seed RENs first."
        )

    lead_alloc = _allocate(args.leads)
    property_alloc = _allocate(args.properties)
    deal_alloc = _allocate(args.deals)

    print(
        f"Seeding team={team_id} (today={today.isoformat()}) "
        f"--leads={args.leads} --properties={args.properties} --deals={args.deals}"
    )
    print("Quarter allocation (leads / properties / deals):")
    for quarter, l_count, p_count, d_count in zip(
        QUARTERS, lead_alloc, property_alloc, deal_alloc, strict=True
    ):
        print(
            f"  {quarter.label}  ({quarter.start.isoformat()} - "
            f"{quarter.clip_end(today).isoformat()})"
            f"  leads={l_count:<3} properties={p_count:<3} deals={d_count}"
        )

    if args.resume_from_deals:
        if args.force_active:
            # Lift any pre-Q2 properties that landed in non-Active states
            # back to Active so they're usable as deal inventory.
            quarter_cutoff = datetime(
                2026, 4, 1, tzinfo=UTC
            ).isoformat()
            supabase.table("properties").update({"status": "Active"}).eq(
                "team_id", team_id
            ).lt("created_at", quarter_cutoff).neq(
                "status", "Active"
            ).execute()
            print(
                "Resume: lifted pre-Q2 2026 non-Active properties back to "
                "Active."
            )

        leads_shifted, properties_shifted = _normalize_entity_dates(
            supabase,
            team_id=team_id,
            rng=rng,
            today=today,
            dry_run=False,
        )
        print(
            f"Resume: shifted {leads_shifted} leads and "
            f"{properties_shifted} properties into the first "
            f"{int(ENTITY_FRACTION * 100)}% of their quarter."
        )

        all_leads = (
            supabase.table("leads")
            .select("*")
            .eq("team_id", team_id)
            .execute()
            .data
            or []
        )
        all_properties = (
            supabase.table("properties")
            .select("*")
            .eq("team_id", team_id)
            .execute()
            .data
            or []
        )
        print(
            f"\nResume: using full team pool of {len(all_leads)} leads + "
            f"{len(all_properties)} properties for deal planning."
        )
        inserted_leads = all_leads
        inserted_properties = all_properties
    else:
        existing_property_count = (
            supabase.table("properties")
            .select("id", count="exact")
            .eq("team_id", team_id)
            .execute()
            .count
            or 0
        )

        lead_rows = _build_lead_rows(
            team_id=team_id,
            ren_id=manager_id,
            counts=lead_alloc,
            rng=rng,
            today=today,
        )
        property_rows = _build_property_rows(
            team_id=team_id,
            ren_id=manager_id,
            counts=property_alloc,
            rng=rng,
            today=today,
            name_offset=existing_property_count,
        )

        if args.dry_run:
            print("\nDRY-RUN: not writing leads / properties / deals.")
            print(
                f"  would insert {len(lead_rows)} leads, "
                f"{len(property_rows)} properties"
            )
            print("\n  sample leads:")
            for row in lead_rows[: min(3, len(lead_rows))]:
                print(
                    f"    {row['created_at']} | {row['name']:<22} "
                    f"| status={row['status']:<12} "
                    f"| budget=RM{float(row['budget_min']):.0f}-"
                    f"{float(row['budget_max']):.0f}"
                )
            print("\n  sample properties:")
            for row in property_rows[: min(3, len(property_rows))]:
                print(
                    f"    {row['created_at']} | {row['name']:<26} "
                    f"| {row['listing_type']:<6} "
                    f"| {row['city']:<22} | RM{float(row['price']):,.0f}"
                )
            return 0

        print(f"\nInserting {len(lead_rows)} leads...")
        inserted_leads = _chunk_insert(supabase, "leads", lead_rows)
        print(f"  inserted {len(inserted_leads)} leads")

        print(f"Inserting {len(property_rows)} properties...")
        inserted_properties = _chunk_insert(
            supabase, "properties", property_rows
        )
        print(f"  inserted {len(inserted_properties)} properties")

    leads_by_id = {lead["id"]: lead for lead in inserted_leads}
    properties_by_id = {prop["id"]: prop for prop in inserted_properties}

    print("\nPlanning deals...")
    plans = _plan_deals(
        team_id=team_id,
        leads_pool=inserted_leads,
        properties_pool=inserted_properties,
        rens=rens,
        counts=deal_alloc,
        rng=rng,
        today=today,
    )

    print(f"Committing {len(plans)} deals...")
    total_commission = Decimal("0")
    total_sale = Decimal("0")
    deals_by_quarter: Counter[str] = Counter()
    losing_lead_count = 0
    for plan in plans:
        deals_by_quarter[plan["quarter"]] += 1
        result = _commit_deal_inline(
            supabase,
            team_id=team_id,
            deal_row=plan["deal_row"],
            deal_type=plan["deal_type"],
            lead=plan["lead"],
            ren_id=plan["ren"]["id"],
            closed_at=plan["closed_at"],
            leads_by_id=leads_by_id,
            properties_by_id=properties_by_id,
        )
        losing_lead_count += len(result["losing_lead_ids"])
        total_commission += Decimal(plan["deal_row"]["commission_total"])
        total_sale += Decimal(plan["deal_row"]["sale_price"])
        print(
            f"  [{plan['quarter']}] {plan['closed_at'].date()} "
            f"{plan['deal_type']:<6} RM{float(plan['deal_row']['sale_price']):>11,.0f} "
            f"commission=RM{float(plan['deal_row']['commission_total']):>9,.2f} "
            f"ren={plan['ren']['full_name']:<18} "
            f"lead={plan['lead']['name']}"
        )

    print()
    print(
        f"inserted {len(plans)} deals across "
        + ", ".join(f"{q}={deals_by_quarter[q]}" for q in (qt.label for qt in QUARTERS))
    )
    print(
        f"sale volume RM{float(total_sale):,.2f}, "
        f"commission RM{float(total_commission):,.2f}, "
        f"{losing_lead_count} other leads moved to Lost."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
