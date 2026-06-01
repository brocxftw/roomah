"""Seed mock deals that exercise the new deal pipeline workspace.

The ``202606011351_add_deal_pipeline_workflow`` migration introduced a
six-stage pipeline (``negotiation`` -> ``offer_made`` -> ``pending_contract``
-> ``final_approval`` -> ``closed_won`` / ``closed_lost``) along with
``deal_documents`` and a handful of new fields (``deal_type``,
``expected_close_date``, ``probability_override``, ``notes``,
``origin_viewing_id``, ``lost_reason`` / ``lost_notes`` / ``lost_at``,
``value_updated_at``).

This script fabricates a configurable spread of deals across every stage so
the new "Deal Pipeline Workspace" UI (Kanban, drawer, table, filters,
KPIs) has realistic mock data to render. It mirrors the side-effects of
the live FastAPI routes:

* ``POST /deals``                  - emits ``deal_created`` event
* ``PATCH /deals/{id}/stage``      - emits ``deal_stage_changed`` for each
                                     intermediate hop, so the drawer's
                                     timeline tab lights up
* ``POST /deals/{id}/win``         - runs the full ``_run_won_cascade``
                                     (lead -> Won, property -> Inactive,
                                     other leads -> Lost, campaign counters
                                     bumped, timeline events emitted)
* ``POST /deals/{id}/lose``        - emits ``deal_lost`` event and (when
                                     no other ``closed_won`` deal exists)
                                     re-Activates the property
* ``POST /deals/{id}/documents``   - inserts mock contracts/loan letters
                                     and emits ``deal_document_added``

It also dials in a healthy mix of ``deal_type`` (Sale/Rental that respects
``properties.listing_type``), optional ``expected_close_date`` /
``probability_override`` / ``notes``, plus ``origin_viewing_id`` linked to
real completed viewings (respecting the
``_validate_no_active_origin_deal`` rule).

Re-running is purely additive. Use ``--dry-run`` to preview the plan.

Usage::

    python -m scripts.seed_deal_pipeline
    python -m scripts.seed_deal_pipeline --count 30 --seed 42
    python -m scripts.seed_deal_pipeline --dry-run
"""

from __future__ import annotations

import argparse
import random
from collections import Counter
from collections.abc import Sequence
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from uuid import uuid4

from app.core.config import get_settings
from app.supabase import get_service_supabase

# Default per-stage counts. Sum -> total deals. Negotiation gets the most
# cards so the Kanban hero column never looks empty.
DEFAULT_STAGE_WEIGHTS: Sequence[tuple[str, int]] = (
    ("negotiation", 6),
    ("offer_made", 5),
    ("pending_contract", 5),
    ("final_approval", 4),
    ("closed_won", 5),
    ("closed_lost", 5),
)

OPEN_STAGES = ("negotiation", "offer_made", "pending_contract", "final_approval")
STAGE_ORDER = (
    "negotiation",
    "offer_made",
    "pending_contract",
    "final_approval",
    "closed_won",
    "closed_lost",
)

LEAD_STATUS_FOR_STAGE: dict[str, str | None] = {
    "negotiation": "Negotiation",
    "offer_made": "Negotiation",
    "pending_contract": "Proposal",
    "final_approval": "Proposal",
    "closed_won": "Won",
    "closed_lost": None,  # keep lead's current status
}

STAGE_DEFAULT_PROBABILITY: dict[str, Decimal] = {
    "negotiation": Decimal("30"),
    "offer_made": Decimal("50"),
    "pending_contract": Decimal("70"),
    "final_approval": Decimal("85"),
    "closed_won": Decimal("100"),
    "closed_lost": Decimal("0"),
}

LOST_REASON_POOL: Sequence[str] = (
    "budget",
    "financing_denied",
    "chose_competitor",
    "property_issue",
    "lead_unresponsive",
    "agent_decision",
    "other",
)

LOST_NOTES_BY_REASON: dict[str, list[str]] = {
    "budget": [
        "Lead's revised budget came in 8% below asking; couldn't bridge the gap.",
        "Buyer flagged budget concerns after viewing similar units in the area.",
    ],
    "financing_denied": [
        "Bank rejected loan application - debt service ratio too high.",
        "Maybank pre-approval fell through during final underwriting.",
    ],
    "chose_competitor": [
        "Buyer signed on a similar unit at the next condo over.",
        "Lead booked a Mont Kiara serviced apartment listed by another agency.",
    ],
    "property_issue": [
        "Strata inspection flagged water seepage in master bath.",
        "Owner wouldn't sign off on agreed renovation allowance.",
    ],
    "lead_unresponsive": [
        "Three follow-up calls + WhatsApps over 10 days with no reply.",
        "Lead went radio silent after the second offer counter.",
    ],
    "agent_decision": [
        "REN flagged lead as time-waster after repeated reschedules.",
        "Closed manually - lead clearly not serious about the timeline.",
    ],
    "other": [
        "Buyer relocated overseas before closing.",
        "Owner withdrew the listing while still negotiating.",
    ],
}

NOTES_POOL_OPEN: Sequence[str] = (
    "Buyer asked for 3-week extension on Earnest Deposit; awaiting confirmation.",
    "Owner open to a RM5,000 furniture allowance if SPA signed this week.",
    "Lawyer on standby - SPA drafting kicks off once OTP cleared.",
    "Lead has parallel offer pending on a Mont Kiara unit; needs decision by Fri.",
    "Bank pre-approval valid for 60 days; closing on track for end of month.",
    "Loan margin negotiation in progress - targeting 90% MOF.",
    "Owner requesting strata fees to be netted out of sale price.",
    "Vacant possession by 30 days post-completion; agreed verbally.",
    "Booking form signed; 2% earnest deposit cleared into client account.",
    "Final walkthrough scheduled before signing; lead requested fresh paint.",
)

NOTES_POOL_WON: Sequence[str] = (
    "SPA executed; keys handed over on the same day.",
    "Owner agreed to absorb half the legal fees as a closing sweetener.",
    "Bank loan disbursed early; commission released in full.",
    "Tenancy commenced; security deposit of 2 months held in trust.",
)

DOCUMENT_KIND_POOL: Sequence[str] = (
    "offer",
    "contract",
    "loan",
    "tenancy",
    "receipt",
    "supporting",
)

DOCUMENT_LABEL_BY_KIND: dict[str, list[str]] = {
    "offer": [
        "Letter of Offer (signed)",
        "Booking Form & Offer Acceptance",
        "Counter-offer Cover Note",
    ],
    "contract": [
        "Sale & Purchase Agreement",
        "Tenancy Agreement (final)",
        "Variation Agreement",
    ],
    "loan": [
        "Loan Offer Letter - Maybank",
        "Loan Offer Letter - CIMB",
        "MOF & Tenure Confirmation",
    ],
    "tenancy": [
        "Inventory List (signed)",
        "Stamp Duty Receipt - LHDN",
        "Letter of Vacant Possession",
    ],
    "receipt": [
        "Earnest Deposit Receipt",
        "Booking Fee Receipt",
        "Commission Receipt",
    ],
    "supporting": [
        "Strata Title Search",
        "Land Office Title Extract",
        "MyKad Copy (redacted)",
    ],
    "other": [
        "Site Inspection Photos",
        "Buyer Pre-qualification Memo",
    ],
}

MIN_SALE_LISTING_PRICE = Decimal("180000")
MIN_EXPECTED_RENTAL = Decimal("900")


def _scale_plan(total: int) -> list[str]:
    """Distribute ``total`` deals across stages, mirroring DEFAULT_STAGE_WEIGHTS."""
    weight_total = sum(weight for _, weight in DEFAULT_STAGE_WEIGHTS)
    plan: list[str] = []
    remaining = total
    for index, (stage, weight) in enumerate(DEFAULT_STAGE_WEIGHTS):
        if index == len(DEFAULT_STAGE_WEIGHTS) - 1:
            count = remaining
        else:
            count = round(total * weight / weight_total)
            count = max(0, min(count, remaining))
        plan.extend([stage] * count)
        remaining -= count
    return plan


def _round_to(value: int, step: int) -> int:
    return (value // step) * step


def _quantize_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _has_realistic_price(property_row: dict[str, Any]) -> bool:
    listing_type = property_row["listing_type"]
    listing_price = property_row.get("listing_price")
    expected_rental = property_row.get("expected_rental")
    sale_ok = (
        listing_price is not None
        and Decimal(str(listing_price)) >= MIN_SALE_LISTING_PRICE
    )
    rental_ok = (
        expected_rental is not None
        and Decimal(str(expected_rental)) >= MIN_EXPECTED_RENTAL
    )
    if listing_type == "Sale":
        return sale_ok
    if listing_type == "Rental":
        return rental_ok
    return sale_ok or rental_ok


def _compute_sale_price(
    property_row: dict[str, Any], rng: random.Random
) -> tuple[Decimal, str]:
    """Return (sale_price, deal_type) for a property, mirroring the route."""
    listing_type = property_row["listing_type"]
    listing_price = property_row.get("listing_price")
    expected_rental = property_row.get("expected_rental")

    if listing_type == "Sale":
        anchor = (
            Decimal(str(listing_price))
            if listing_price is not None
            else Decimal(str(property_row.get("market_value") or 600_000))
        )
        ratio = Decimal(str(rng.uniform(0.92, 1.01)))
        return _quantize_money(anchor * ratio), "Sale"

    if listing_type == "Rental":
        monthly = (
            Decimal(str(expected_rental))
            if expected_rental is not None
            else Decimal(str(rng.randint(2_000, 6_000)))
        )
        return _quantize_money(monthly * Decimal(12)), "Rental"

    can_sell = listing_price is not None
    can_rent = expected_rental is not None
    if can_sell and (not can_rent or rng.random() < 0.65):
        ratio = Decimal(str(rng.uniform(0.92, 1.01)))
        return _quantize_money(Decimal(str(listing_price)) * ratio), "Sale"
    if can_rent:
        return (
            _quantize_money(Decimal(str(expected_rental)) * Decimal(12)),
            "Rental",
        )
    return (
        Decimal(str(_round_to(rng.randint(420_000, 1_400_000), 5_000))),
        "Sale",
    )


def _compute_fees(
    sale_price: Decimal,
    deal_type: str,
    commission_rate: Decimal,
    rng: random.Random,
) -> tuple[Decimal, Decimal]:
    if deal_type == "Rental":
        agency_fee = Decimal(rng.choice((150, 200, 250, 300)))
        lawyer_fees = Decimal(rng.choice((0, 250, 350, 500)))
    else:
        sale_price_int = int(sale_price)
        agency_fee = Decimal(_round_to(rng.randint(300, 1_500), 50))
        lawyer_fees = Decimal(
            _round_to(int(sale_price_int * rng.uniform(0.003, 0.008)), 50)
        )
    gross = sale_price * commission_rate
    cap = (gross * Decimal("0.25")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    if cap < Decimal("0"):
        cap = Decimal("0")
    return min(agency_fee, cap), min(lawyer_fees, cap)


def _commission_total(
    sale_price: Decimal,
    commission_rate: Decimal,
    agency_fee: Decimal,
    lawyer_fees: Decimal,
) -> Decimal:
    return _quantize_money(
        sale_price * commission_rate - agency_fee - lawyer_fees
    )


def _stage_dwell(stage: str, rng: random.Random) -> int:
    """Days a deal typically sits in a given stage before progressing."""
    if stage == "negotiation":
        return rng.randint(2, 6)
    if stage == "offer_made":
        return rng.randint(3, 8)
    if stage == "pending_contract":
        return rng.randint(4, 10)
    if stage == "final_approval":
        return rng.randint(2, 7)
    return 0


def _backdated_created_at(stage: str, rng: random.Random, now: datetime) -> datetime:
    """Pick a realistic ``created_at`` so the kanban shows aged + fresh cards."""
    if stage == "negotiation":
        days_ago = rng.randint(0, 6)
    elif stage == "offer_made":
        days_ago = rng.randint(4, 14)
    elif stage == "pending_contract":
        days_ago = rng.randint(8, 22)
    elif stage == "final_approval":
        days_ago = rng.randint(14, 30)
    elif stage == "closed_won":
        days_ago = rng.randint(1, 25)
    elif stage == "closed_lost":
        days_ago = rng.randint(2, 28)
    else:
        days_ago = rng.randint(0, 14)
    return now - timedelta(
        days=days_ago,
        hours=rng.randint(0, 23),
        minutes=rng.randint(0, 59),
    )


def _expected_close_date(
    stage: str, now: datetime, rng: random.Random, created_at: datetime
) -> date | None:
    """Most open deals carry an expected close date in the near future."""
    if stage == "closed_won":
        return created_at.date() + timedelta(days=rng.randint(7, 21))
    if stage == "closed_lost":
        return None
    if rng.random() < 0.85:
        days_ahead = {
            "negotiation": rng.randint(14, 35),
            "offer_made": rng.randint(10, 25),
            "pending_contract": rng.randint(7, 18),
            "final_approval": rng.randint(3, 12),
        }[stage]
        return now.date() + timedelta(days=days_ahead)
    return None


def _ensure_active_link(
    supabase: Any,
    *,
    lead_id: str,
    property_id: str,
    link_created_at: datetime,
    active_links_by_property: dict[str, list[dict[str, Any]]],
    active_pairs: set[tuple[str, str]],
) -> None:
    """Make sure ``lead_properties`` has an active row for this pair."""
    pair = (lead_id, property_id)
    if pair in active_pairs:
        return
    existing = (
        supabase.table("lead_properties")
        .select("lead_id, status")
        .eq("lead_id", lead_id)
        .eq("property_id", property_id)
        .execute()
        .data
        or []
    )
    if not existing:
        supabase.table("lead_properties").insert(
            {
                "lead_id": lead_id,
                "property_id": property_id,
                "status": "active",
                "created_at": link_created_at.isoformat(),
            }
        ).execute()
    elif existing[0]["status"] != "active":
        supabase.table("lead_properties").update({"status": "active"}).eq(
            "lead_id", lead_id
        ).eq("property_id", property_id).execute()
    active_pairs.add(pair)
    active_links_by_property.setdefault(property_id, [])
    if not any(link["lead_id"] == lead_id for link in active_links_by_property[property_id]):
        active_links_by_property[property_id].append(
            {"lead_id": lead_id, "property_id": property_id, "status": "active"}
        )


def _emit_event(
    supabase: Any,
    *,
    team_id: str,
    lead_id: str,
    event_type: str,
    payload: dict[str, Any],
    created_by: str,
    created_at: datetime,
) -> None:
    supabase.table("timeline_events").insert(
        {
            "team_id": team_id,
            "lead_id": lead_id,
            "event_type": event_type,
            "source": "system",
            "payload": payload,
            "created_by": created_by,
            "created_at": created_at.isoformat(),
        }
    ).execute()


def _fetch_world(supabase: Any, *, team_id: str) -> dict[str, Any]:
    rens = (
        supabase.table("users")
        .select("id, full_name, role, commission_rate, active_status")
        .eq("team_id", team_id)
        .eq("active_status", True)
        .eq("role", "REN")
        .execute()
        .data
        or []
    )
    rens = [
        ren for ren in rens if Decimal(str(ren["commission_rate"])) > Decimal("0")
    ]

    properties = (
        supabase.table("properties")
        .select(
            "id, name, status, listing_type, listing_price, expected_rental, "
            "market_value"
        )
        .eq("team_id", team_id)
        .eq("status", "Active")
        .execute()
        .data
        or []
    )
    properties = [p for p in properties if _has_realistic_price(p)]

    leads = (
        supabase.table("leads")
        .select("id, status, campaign_id, name, ren_id")
        .eq("team_id", team_id)
        .execute()
        .data
        or []
    )
    eligible_leads = [lead for lead in leads if lead["status"] not in ("Won", "Lost")]

    links = (
        supabase.table("lead_properties")
        .select("lead_id, property_id, status")
        .eq("status", "active")
        .execute()
        .data
        or []
    )
    active_pairs: set[tuple[str, str]] = {
        (link["lead_id"], link["property_id"]) for link in links
    }
    active_links_by_property: dict[str, list[dict[str, Any]]] = {}
    for link in links:
        active_links_by_property.setdefault(link["property_id"], []).append(link)

    # viewings that COULD seed origin_viewing_id - completed only, and not
    # already attached to any non-lost deal.
    viewings = (
        supabase.table("viewings")
        .select("id, lead_id, property_id, status, scheduled_at, completed_at")
        .eq("team_id", team_id)
        .eq("status", "completed")
        .execute()
        .data
        or []
    )
    used_viewing_ids: set[str] = {
        row["origin_viewing_id"]
        for row in (
            supabase.table("deals")
            .select("origin_viewing_id, stage")
            .eq("team_id", team_id)
            .execute()
            .data
            or []
        )
        if row.get("origin_viewing_id") and row.get("stage") != "closed_lost"
    }
    viewing_by_pair: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for v in viewings:
        if v["id"] in used_viewing_ids:
            continue
        viewing_by_pair.setdefault((v["lead_id"], v["property_id"]), []).append(v)

    return {
        "rens": rens,
        "properties": properties,
        "eligible_leads": eligible_leads,
        "active_links_by_property": active_links_by_property,
        "active_pairs": active_pairs,
        "viewing_by_pair": viewing_by_pair,
        "used_viewing_ids": used_viewing_ids,
    }


def _allocate_pair(
    *,
    stage: str,
    rng: random.Random,
    properties: list[dict[str, Any]],
    eligible_leads: list[dict[str, Any]],
    active_links_by_property: dict[str, list[dict[str, Any]]],
    consumed_properties: set[str],
    used_leads_global: set[str],
    open_pairs_used: set[tuple[str, str]],
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """Pick a (property, lead) for this stage.

    closed_won permanently consumes the property; open and closed_lost
    deals can share a property (multiple agents competing) but never the
    same (lead, property) pair twice.
    """
    if stage == "closed_won":
        pool = [p for p in properties if p["id"] not in consumed_properties]
        rng.shuffle(pool)
        for property_row in pool:
            for link in active_links_by_property.get(property_row["id"], []):
                lead = next(
                    (l for l in eligible_leads if l["id"] == link["lead_id"]),
                    None,
                )
                if lead and lead["id"] not in used_leads_global:
                    return property_row, lead
            lead_pool = [l for l in eligible_leads if l["id"] not in used_leads_global]
            if lead_pool:
                return property_row, rng.choice(lead_pool)
        return None

    pool = [p for p in properties if p["id"] not in consumed_properties]
    rng.shuffle(pool)
    for property_row in pool:
        for link in active_links_by_property.get(property_row["id"], []):
            pair = (link["lead_id"], property_row["id"])
            if pair in open_pairs_used:
                continue
            lead = next(
                (l for l in eligible_leads if l["id"] == link["lead_id"]),
                None,
            )
            if lead and lead["id"] not in used_leads_global:
                return property_row, lead
        lead_pool = [
            l
            for l in eligible_leads
            if l["id"] not in used_leads_global
            and (l["id"], property_row["id"]) not in open_pairs_used
        ]
        if lead_pool:
            return property_row, rng.choice(lead_pool)
    return None


def _maybe_origin_viewing(
    *,
    rng: random.Random,
    lead_id: str,
    property_id: str,
    viewing_by_pair: dict[tuple[str, str], list[dict[str, Any]]],
    used_viewing_ids: set[str],
    chance: float = 0.45,
) -> str | None:
    """Optionally attribute the deal to a completed viewing."""
    if rng.random() > chance:
        return None
    candidates = [
        v
        for v in viewing_by_pair.get((lead_id, property_id), [])
        if v["id"] not in used_viewing_ids
    ]
    if not candidates:
        return None
    chosen = rng.choice(candidates)
    used_viewing_ids.add(chosen["id"])
    return chosen["id"]


def _plan_documents(
    *,
    stage: str,
    deal_type: str,
    rng: random.Random,
) -> list[dict[str, Any]]:
    """Decide which documents to attach for a given stage."""
    chance = {
        "negotiation": 0.30,
        "offer_made": 0.65,
        "pending_contract": 0.85,
        "final_approval": 0.95,
        "closed_won": 0.95,
        "closed_lost": 0.40,
    }[stage]
    if rng.random() > chance:
        return []

    kinds_by_stage: dict[str, list[str]] = {
        "negotiation": ["supporting"],
        "offer_made": ["offer", "supporting"],
        "pending_contract": ["offer", "receipt"],
        "final_approval": ["offer", "receipt", "loan"],
        "closed_won": ["offer", "contract", "receipt", "loan", "tenancy"],
        "closed_lost": ["offer", "supporting"],
    }
    kinds = list(kinds_by_stage[stage])
    if deal_type == "Rental":
        kinds = [k for k in kinds if k != "loan"]
        if stage in ("final_approval", "closed_won") and "tenancy" not in kinds:
            kinds.append("tenancy")
    else:
        kinds = [k for k in kinds if k != "tenancy"]
        if stage in ("final_approval", "closed_won") and "contract" not in kinds:
            kinds.append("contract")

    if not kinds:
        kinds = ["supporting"]

    desired = min(len(kinds), rng.randint(1, 3))
    chosen = rng.sample(kinds, desired)
    plan: list[dict[str, Any]] = []
    for kind in chosen:
        label = rng.choice(DOCUMENT_LABEL_BY_KIND[kind])
        plan.append(
            {
                "kind": kind,
                "label": label,
                # Stable demo URL pattern; passes the
                # `url ~* '^https?://[^[:space:]]+$'` constraint.
                "url": f"https://demo.roomah.app/documents/{kind}/{uuid4().hex}.pdf",
            }
        )
    return plan


def _format_stage_label(stage: str) -> str:
    return stage.replace("_", " ").title()


def _build_deal_row(
    *,
    team_id: str,
    lead_id: str,
    property_id: str,
    ren_id: str,
    stage: str,
    deal_type: str,
    sale_price: Decimal,
    commission_rate: Decimal,
    agency_fee: Decimal,
    lawyer_fees: Decimal,
    expected_close_date: date | None,
    probability_override: Decimal | None,
    notes: str | None,
    origin_viewing_id: str | None,
    closed_at: datetime | None,
    lost_reason: str | None,
    lost_notes: str | None,
    lost_at: datetime | None,
    created_at: datetime,
    value_updated_at: datetime,
) -> dict[str, Any]:
    commission_total = _commission_total(
        sale_price, commission_rate, agency_fee, lawyer_fees
    )
    return {
        "team_id": team_id,
        "lead_id": lead_id,
        "property_id": property_id,
        "ren_id": ren_id,
        "stage": stage,
        "deal_type": deal_type,
        "sale_price": str(sale_price),
        "commission_rate": str(commission_rate),
        "agency_fee": str(agency_fee),
        "lawyer_fees": str(lawyer_fees),
        "commission_total": str(commission_total),
        "commission_override": None,
        "expected_close_date": (
            expected_close_date.isoformat() if expected_close_date else None
        ),
        "probability_override": (
            str(probability_override) if probability_override is not None else None
        ),
        "notes": notes,
        "origin_viewing_id": origin_viewing_id,
        "lost_reason": lost_reason,
        "lost_notes": lost_notes,
        "lost_at": lost_at.isoformat() if lost_at else None,
        "closed_at": closed_at.isoformat() if closed_at else None,
        "value_updated_at": value_updated_at.isoformat(),
        "created_at": created_at.isoformat(),
    }


def _emit_stage_progression(
    supabase: Any,
    *,
    team_id: str,
    deal: dict[str, Any],
    lead_id: str,
    ren_id: str,
    final_stage: str,
    created_at: datetime,
    rng: random.Random,
) -> None:
    """Emit ``deal_created`` + a chain of ``deal_stage_changed`` events."""
    _emit_event(
        supabase,
        team_id=team_id,
        lead_id=lead_id,
        event_type="deal_created",
        payload={
            "deal_id": deal["id"],
            "property_id": deal["property_id"],
            "origin_viewing_id": deal.get("origin_viewing_id"),
            "stage": "negotiation",
        },
        created_by=ren_id,
        created_at=created_at,
    )
    if final_stage == "negotiation":
        return

    cursor = created_at
    target_index = STAGE_ORDER.index(final_stage)
    for i in range(target_index):
        from_stage = STAGE_ORDER[i]
        to_stage = STAGE_ORDER[i + 1]
        cursor = cursor + timedelta(
            days=max(1, _stage_dwell(from_stage, rng)),
            hours=rng.randint(0, 6),
        )
        _emit_event(
            supabase,
            team_id=team_id,
            lead_id=lead_id,
            event_type="deal_stage_changed",
            payload={
                "deal_id": deal["id"],
                "from": from_stage,
                "to": to_stage,
            },
            created_by=ren_id,
            created_at=cursor,
        )


def _insert_documents(
    supabase: Any,
    *,
    team_id: str,
    deal: dict[str, Any],
    lead_id: str,
    ren_id: str,
    documents: list[dict[str, Any]],
    base_at: datetime,
    rng: random.Random,
) -> int:
    if not documents:
        return 0
    inserted = 0
    for offset, doc in enumerate(documents):
        when = base_at + timedelta(hours=offset * 2 + rng.randint(0, 8))
        row = (
            supabase.table("deal_documents")
            .insert(
                {
                    "team_id": team_id,
                    "deal_id": deal["id"],
                    "label": doc["label"],
                    "url": doc["url"],
                    "kind": doc["kind"],
                    "created_by": ren_id,
                    "created_at": when.isoformat(),
                }
            )
            .execute()
            .data[0]
        )
        _emit_event(
            supabase,
            team_id=team_id,
            lead_id=lead_id,
            event_type="deal_document_added",
            payload={"deal_id": deal["id"], "document_id": row["id"]},
            created_by=ren_id,
            created_at=when,
        )
        inserted += 1
    return inserted


def _run_won_cascade(
    supabase: Any,
    *,
    team_id: str,
    deal: dict[str, Any],
    lead: dict[str, Any],
    deal_type: str,
    sale_price: Decimal,
    commission_total: str,
    closed_at: datetime,
    ren_id: str,
    active_links_by_property: dict[str, list[dict[str, Any]]],
    eligible_lead_ids: set[str],
) -> list[str]:
    lead_id = deal["lead_id"]
    property_id = deal["property_id"]

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
    losing_ids: list[str] = []
    if other_lead_ids:
        supabase.table("lead_properties").update({"status": "inactive"}).eq(
            "property_id", property_id
        ).eq("status", "active").neq("lead_id", lead_id).execute()
        before_rows = (
            supabase.table("leads")
            .select("id, status")
            .in_("id", other_lead_ids)
            .execute()
            .data
            or []
        )
        losing = [
            row for row in before_rows if row["status"] not in ("Won", "Lost")
        ]
        losing_ids = [row["id"] for row in losing]
        if losing_ids:
            supabase.table("leads").update({"status": "Lost"}).in_(
                "id", losing_ids
            ).execute()
        for row in losing:
            _emit_event(
                supabase,
                team_id=team_id,
                lead_id=row["id"],
                event_type="property_unlinked",
                payload={"property_id": property_id},
                created_by=ren_id,
                created_at=closed_at,
            )
            _emit_event(
                supabase,
                team_id=team_id,
                lead_id=row["id"],
                event_type="lead_status_changed",
                payload={"from": row["status"], "to": "Lost"},
                created_by=ren_id,
                created_at=closed_at,
            )

    _emit_event(
        supabase,
        team_id=team_id,
        lead_id=lead_id,
        event_type="deal_won",
        payload={
            "deal_id": deal["id"],
            "property_id": property_id,
            "deal_type": deal_type,
            "sale_price": str(sale_price),
            "commission_total": commission_total,
        },
        created_by=ren_id,
        created_at=closed_at,
    )
    _emit_event(
        supabase,
        team_id=team_id,
        lead_id=lead_id,
        event_type="deal_closed",
        payload={
            "deal_id": deal["id"],
            "property_id": property_id,
            "deal_type": deal_type,
            "sale_price": str(sale_price),
            "commission_total": commission_total,
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

    active_links_by_property.pop(property_id, None)
    eligible_lead_ids.discard(lead_id)
    for lid in losing_ids:
        eligible_lead_ids.discard(lid)
    return losing_ids


def _print_plan(plan_rows: list[dict[str, Any]]) -> None:
    by_stage = Counter(row["stage"] for row in plan_rows)
    by_type = Counter(row["deal_type"] for row in plan_rows)
    with_docs = sum(1 for row in plan_rows if row["doc_count"])
    with_viewing = sum(1 for row in plan_rows if row["origin_viewing_id"])
    with_exp = sum(1 for row in plan_rows if row["expected_close_date"])
    with_prob = sum(1 for row in plan_rows if row["probability_override"])
    with_notes = sum(1 for row in plan_rows if row["notes"])

    print(f"\nPlanned {len(plan_rows)} deals")
    print(f"  by stage: {dict(by_stage)}")
    print(f"  by type : {dict(by_type)}")
    print(
        f"  enrichment: docs={with_docs}, origin_viewing={with_viewing}, "
        f"expected_close={with_exp}, prob_override={with_prob}, notes={with_notes}"
    )
    print()
    header = (
        f"{'#':<3} {'stage':<17} {'type':<7} {'sale price':>14}  "
        f"{'lead':<28} {'property':<32} docs viewing"
    )
    print(header)
    print("-" * len(header))
    for idx, row in enumerate(plan_rows, 1):
        print(
            f"{idx:<3} {row['stage']:<17} {row['deal_type']:<7} "
            f"{row['sale_price']:>14}  "
            f"{(row['lead_name'] or '-')[:28]:<28} "
            f"{(row['property_name'] or '-')[:32]:<32} "
            f"{row['doc_count']:>3}  "
            f"{'Y' if row['origin_viewing_id'] else '-'}"
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=30)
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the plan without writing to the database.",
    )
    args = parser.parse_args(argv)
    if args.count <= 0:
        raise SystemExit("--count must be positive")

    rng = random.Random(args.seed)
    supabase = get_service_supabase()
    settings = get_settings()
    team_id = settings.default_team_id
    now = datetime.now(UTC)

    world = _fetch_world(supabase, team_id=team_id)
    rens: list[dict[str, Any]] = world["rens"]
    properties: list[dict[str, Any]] = list(world["properties"])
    eligible_leads: list[dict[str, Any]] = list(world["eligible_leads"])
    active_links_by_property: dict[str, list[dict[str, Any]]] = world[
        "active_links_by_property"
    ]
    active_pairs: set[tuple[str, str]] = world["active_pairs"]
    viewing_by_pair = world["viewing_by_pair"]
    used_viewing_ids: set[str] = world["used_viewing_ids"]

    if not rens:
        raise SystemExit(
            f"Team {team_id} has no active RENs with commission_rate > 0; "
            "seed users first."
        )
    if not properties:
        raise SystemExit(
            f"Team {team_id} has no Active properties with realistic prices."
        )
    if not eligible_leads:
        raise SystemExit(
            f"Team {team_id} has no non-Won/Lost leads to back the deals."
        )

    plan_stages = _scale_plan(args.count)
    rng.shuffle(plan_stages)
    consumed_properties: set[str] = set()
    used_leads_global: set[str] = set()
    open_pairs_used: set[tuple[str, str]] = set()
    eligible_lead_ids = {lead["id"] for lead in eligible_leads}

    plan_rows: list[dict[str, Any]] = []
    insert_rows: list[dict[str, Any]] = []
    for stage in plan_stages:
        allocation = _allocate_pair(
            stage=stage,
            rng=rng,
            properties=properties,
            eligible_leads=eligible_leads,
            active_links_by_property=active_links_by_property,
            consumed_properties=consumed_properties,
            used_leads_global=used_leads_global,
            open_pairs_used=open_pairs_used,
        )
        if allocation is None:
            print(
                f"  ! skipped a {stage} card - no eligible "
                "(property, lead) pair left; consider raising --count "
                "after freeing inventory."
            )
            continue
        property_row, lead = allocation
        ren = rng.choice(rens)
        commission_rate = Decimal(str(ren["commission_rate"]))
        sale_price, deal_type = _compute_sale_price(property_row, rng)
        agency_fee, lawyer_fees = _compute_fees(
            sale_price, deal_type, commission_rate, rng
        )
        created_at = _backdated_created_at(stage, rng, now)
        if stage == "closed_won":
            closed_at = created_at + timedelta(
                days=rng.randint(0, 4), hours=rng.randint(0, 12)
            )
            if closed_at > now:
                closed_at = now - timedelta(hours=1)
        else:
            closed_at = None
        if stage == "closed_lost":
            lost_at = created_at + timedelta(
                days=rng.randint(1, 6), hours=rng.randint(0, 12)
            )
            if lost_at > now:
                lost_at = now - timedelta(hours=1)
            lost_reason = rng.choice(LOST_REASON_POOL)
            lost_notes = rng.choice(LOST_NOTES_BY_REASON[lost_reason])
        else:
            lost_at = None
            lost_reason = None
            lost_notes = None

        notes: str | None
        if stage in ("closed_won", "closed_lost"):
            notes = rng.choice(NOTES_POOL_WON) if stage == "closed_won" else None
            if rng.random() < 0.4 and stage == "closed_won":
                notes = None
        else:
            notes = rng.choice(NOTES_POOL_OPEN) if rng.random() < 0.7 else None

        probability_override: Decimal | None
        if stage in ("closed_won", "closed_lost"):
            probability_override = None
        elif rng.random() < 0.35:
            base = STAGE_DEFAULT_PROBABILITY[stage]
            adj = Decimal(str(rng.choice((-15, -10, -5, 5, 10, 15))))
            probability_override = max(
                Decimal("0"), min(Decimal("100"), base + adj)
            )
        else:
            probability_override = None

        expected_close = _expected_close_date(stage, now, rng, created_at)
        origin_viewing_id = _maybe_origin_viewing(
            rng=rng,
            lead_id=lead["id"],
            property_id=property_row["id"],
            viewing_by_pair=viewing_by_pair,
            used_viewing_ids=used_viewing_ids,
            chance=0.45 if stage in ("offer_made", "pending_contract", "final_approval", "closed_won") else 0.25,
        )
        documents = _plan_documents(stage=stage, deal_type=deal_type, rng=rng)
        value_updated_at = closed_at or lost_at or (
            created_at + timedelta(days=rng.randint(0, 5))
        )
        if value_updated_at > now:
            value_updated_at = now

        # Cache eagerly so subsequent allocations don't re-pick this pair.
        used_leads_global.add(lead["id"])
        open_pairs_used.add((lead["id"], property_row["id"]))
        if stage == "closed_won":
            consumed_properties.add(property_row["id"])

        deal_row = _build_deal_row(
            team_id=team_id,
            lead_id=lead["id"],
            property_id=property_row["id"],
            ren_id=ren["id"],
            stage=stage,
            deal_type=deal_type,
            sale_price=sale_price,
            commission_rate=commission_rate,
            agency_fee=agency_fee,
            lawyer_fees=lawyer_fees,
            expected_close_date=expected_close,
            probability_override=probability_override,
            notes=notes,
            origin_viewing_id=origin_viewing_id,
            closed_at=closed_at,
            lost_reason=lost_reason,
            lost_notes=lost_notes,
            lost_at=lost_at,
            created_at=created_at,
            value_updated_at=value_updated_at,
        )
        insert_rows.append(
            {
                "deal_row": deal_row,
                "lead": lead,
                "property": property_row,
                "ren": ren,
                "documents": documents,
                "stage": stage,
                "deal_type": deal_type,
                "sale_price": sale_price,
                "commission_rate": commission_rate,
                "agency_fee": agency_fee,
                "lawyer_fees": lawyer_fees,
                "closed_at": closed_at,
                "lost_at": lost_at,
                "created_at": created_at,
                "origin_viewing_id": origin_viewing_id,
            }
        )
        plan_rows.append(
            {
                "stage": stage,
                "deal_type": deal_type,
                "sale_price": str(sale_price),
                "lead_name": lead.get("name"),
                "property_name": property_row.get("name"),
                "doc_count": len(documents),
                "origin_viewing_id": origin_viewing_id,
                "expected_close_date": expected_close,
                "probability_override": probability_override,
                "notes": notes,
            }
        )

    _print_plan(plan_rows)

    if args.dry_run:
        print("\nDry run - no writes performed.")
        return 0
    if not insert_rows:
        print("\nNothing to insert.")
        return 0

    print("\nWriting to the database...")
    inserted_deals = 0
    inserted_docs = 0
    total_stage_events = 0
    cascade_losers = 0

    for entry in insert_rows:
        deal_row = entry["deal_row"]
        lead = entry["lead"]
        property_row = entry["property"]
        ren = entry["ren"]
        documents = entry["documents"]
        stage = entry["stage"]
        created_at = entry["created_at"]
        closed_at = entry["closed_at"]
        lost_at = entry["lost_at"]
        link_created_at = created_at - timedelta(days=2, hours=rng.randint(0, 12))

        _ensure_active_link(
            supabase,
            lead_id=lead["id"],
            property_id=property_row["id"],
            link_created_at=link_created_at,
            active_links_by_property=active_links_by_property,
            active_pairs=active_pairs,
        )
        deal = supabase.table("deals").insert(deal_row).execute().data[0]
        inserted_deals += 1

        # Bump the lead's status if the new pipeline stage implies progress.
        target_status = LEAD_STATUS_FOR_STAGE[stage]
        if (
            target_status
            and stage in OPEN_STAGES
            and lead["status"] != target_status
            and lead["status"] not in ("Won", "Lost")
        ):
            supabase.table("leads").update({"status": target_status}).eq(
                "id", lead["id"]
            ).execute()
            _emit_event(
                supabase,
                team_id=team_id,
                lead_id=lead["id"],
                event_type="lead_status_changed",
                payload={"from": lead["status"], "to": target_status},
                created_by=ren["id"],
                created_at=created_at + timedelta(minutes=5),
            )

        _emit_stage_progression(
            supabase,
            team_id=team_id,
            deal=deal,
            lead_id=lead["id"],
            ren_id=ren["id"],
            final_stage=stage,
            created_at=created_at,
            rng=rng,
        )
        total_stage_events += max(0, STAGE_ORDER.index(stage))

        if stage == "closed_won":
            losers = _run_won_cascade(
                supabase,
                team_id=team_id,
                deal=deal,
                lead=lead,
                deal_type=entry["deal_type"],
                sale_price=entry["sale_price"],
                commission_total=str(
                    _commission_total(
                        entry["sale_price"],
                        entry["commission_rate"],
                        entry["agency_fee"],
                        entry["lawyer_fees"],
                    )
                ),
                closed_at=closed_at or datetime.now(UTC),
                ren_id=ren["id"],
                active_links_by_property=active_links_by_property,
                eligible_lead_ids=eligible_lead_ids,
            )
            cascade_losers += len(losers)
        elif stage == "closed_lost":
            won_for_property = (
                supabase.table("deals")
                .select("id")
                .eq("team_id", team_id)
                .eq("property_id", property_row["id"])
                .eq("stage", "closed_won")
                .execute()
                .data
                or []
            )
            if not won_for_property:
                supabase.table("properties").update({"status": "Active"}).eq(
                    "id", property_row["id"]
                ).execute()
            _emit_event(
                supabase,
                team_id=team_id,
                lead_id=lead["id"],
                event_type="deal_lost",
                payload={
                    "deal_id": deal["id"],
                    "lost_reason": deal_row["lost_reason"],
                    "lost_notes": deal_row["lost_notes"],
                },
                created_by=ren["id"],
                created_at=lost_at or datetime.now(UTC),
            )

        if documents:
            doc_base = (
                closed_at
                or lost_at
                or (created_at + timedelta(days=rng.randint(0, 3)))
            )
            if doc_base > datetime.now(UTC):
                doc_base = datetime.now(UTC) - timedelta(hours=1)
            inserted_docs += _insert_documents(
                supabase,
                team_id=team_id,
                deal=deal,
                lead_id=lead["id"],
                ren_id=ren["id"],
                documents=documents,
                base_at=doc_base,
                rng=rng,
            )

    print(
        f"\nInserted {inserted_deals} deals "
        f"({Counter(r['stage'] for r in plan_rows)}), "
        f"{inserted_docs} deal documents, "
        f"{total_stage_events} stage-change events, "
        f"{cascade_losers} cascaded losing leads."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
