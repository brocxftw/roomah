"""Seed mock closed deals across multiple time horizons.

In ROOMAH a "transaction" is a row in the ``deals`` table. This script
fabricates a configurable number of those rows (default 20), spread across
four reporting buckets that the dashboards filter on:

    * ``today``       - closed within the last 24h
    * ``week``        - closed in the prior 1-6 days
    * ``month``       - closed in the prior 7-29 days
    * ``quarter``     - closed in the prior 30-60 days (still inside Q2 demo)

For each generated deal the script reproduces the same side-effects the
real ``POST /deals`` route applies so the demo data stays coherent across
every related table:

    * picks an ``Active`` property + an eligible lead (preferring already
      ``lead_properties``-linked pairs, otherwise upserting a fresh active
      link with a backdated ``created_at``)
    * inserts the deal with realistic ``sale_price``, fees, REN commission
      total, and a backdated ``closed_at`` / ``created_at``
    * flips the winning lead to ``Won`` and the property to ``Inactive``
    * inactivates every other active link on that property and flips those
      "losing" leads to ``Lost``
    * emits the matching ``deal_closed`` + ``lead_status_changed`` (and
      ``property_unlinked`` for losers) timeline events with the same
      backdated ``created_at``
    * bumps ``marketing_campaigns.conversions`` for any campaign-attributed
      lead - matching ``CampaignCountersService.increment_conversion``

Re-running is purely additive. Use ``--dry-run`` to preview the plan
without writing anything.

Usage::

    python -m scripts.seed_deals
    python -m scripts.seed_deals --count 10 --seed 7
    python -m scripts.seed_deals --dry-run
"""

from __future__ import annotations

import argparse
import random
import sys
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from app.core.config import get_settings
from app.supabase import get_service_supabase

# Per-bucket counts. Must sum to the user-supplied --count via auto-scaling.
DEFAULT_BUCKET_WEIGHTS: Sequence[tuple[str, int]] = (
    ("today", 3),
    ("week", 5),
    ("month", 6),
    ("quarter", 6),
)


def _bucket_offset(bucket: str, rng: random.Random) -> timedelta:
    """Return a backdated offset for the given reporting bucket."""
    if bucket == "today":
        # 0 - 22 hours ago, with a non-trivial intra-day minute spread
        return timedelta(
            hours=rng.randint(0, 22),
            minutes=rng.randint(0, 59),
        )
    if bucket == "week":
        # 1 - 6 days ago (anywhere in this calendar week, not today)
        return timedelta(
            days=rng.randint(1, 6),
            hours=rng.randint(0, 23),
            minutes=rng.randint(0, 59),
        )
    if bucket == "month":
        # 7 - 29 days ago (this month but not this week)
        return timedelta(
            days=rng.randint(7, 29),
            hours=rng.randint(0, 23),
        )
    if bucket == "quarter":
        # 30 - 60 days ago (older than a month but still in Q2 demo)
        return timedelta(
            days=rng.randint(30, 60),
            hours=rng.randint(0, 23),
        )
    raise ValueError(f"unknown bucket: {bucket}")


def _scale_bucket_plan(total: int) -> list[str]:
    """Distribute ``total`` deals across reporting buckets proportionally."""
    weight_total = sum(weight for _, weight in DEFAULT_BUCKET_WEIGHTS)
    plan: list[str] = []
    remaining = total
    for index, (bucket, weight) in enumerate(DEFAULT_BUCKET_WEIGHTS):
        if index == len(DEFAULT_BUCKET_WEIGHTS) - 1:
            count = remaining
        else:
            count = round(total * weight / weight_total)
            count = max(0, min(count, remaining))
        plan.extend([bucket] * count)
        remaining -= count
    return plan


def _quantize_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _round_to(value: int, step: int) -> int:
    return (value // step) * step


# Below these floors the property is treated as test / placeholder data and is
# skipped, otherwise the deal numbers come out unrealistic on the dashboards.
MIN_SALE_LISTING_PRICE = Decimal("180000")
MIN_EXPECTED_RENTAL = Decimal("900")


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
        # Buyers in this market typically offer 92-101% of asking.
        ratio = Decimal(str(rng.uniform(0.92, 1.01)))
        return _quantize_money(anchor * ratio), "Sale"

    if listing_type == "Rental":
        monthly = (
            Decimal(str(expected_rental))
            if expected_rental is not None
            else Decimal(str(rng.randint(2_000, 6_000)))
        )
        # In MY, rental commission is usually 1 month rent; record annual
        # rental value as the "sale price" so the per-deal commission math
        # produces a meaningful number on the dashboards.
        return _quantize_money(monthly * Decimal(12)), "Rental"

    # listing_type == "Both": decide based on what data is present, then
    # randomly bias slightly towards sale (drives bigger demo numbers).
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
    # Fallback - shouldn't really happen with our seed data.
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
    """Return (agency_fee, lawyer_fees) - small admin fees per real-world use.

    Fees are capped so the REN's ``commission_total`` stays at >= 50% of
    gross. Without the cap, tiny rental deals can produce negative
    commissions which look broken on the dashboards.
    """
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


def _ensure_active_link(
    supabase: Any,
    *,
    lead_id: str,
    property_id: str,
    closed_at: datetime,
) -> None:
    """Make sure ``lead_properties`` has an active row for this pair."""
    existing = (
        supabase.table("lead_properties")
        .select("lead_id, status, created_at")
        .eq("lead_id", lead_id)
        .eq("property_id", property_id)
        .execute()
        .data
        or []
    )
    # Link should be created BEFORE the deal closes - subtract a few days.
    link_created_at = (closed_at - timedelta(days=3, hours=2)).isoformat()
    if not existing:
        supabase.table("lead_properties").insert(
            {
                "lead_id": lead_id,
                "property_id": property_id,
                "status": "active",
                "created_at": link_created_at,
            }
        ).execute()
        return

    row = existing[0]
    if row["status"] != "active":
        supabase.table("lead_properties").update({"status": "active"}).eq(
            "lead_id", lead_id
        ).eq("property_id", property_id).execute()


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


def _pick_winning_lead(
    *,
    property_id: str,
    active_links: dict[str, list[dict[str, Any]]],
    eligible_leads: list[dict[str, Any]],
    used_leads: set[str],
    rng: random.Random,
) -> dict[str, Any] | None:
    """Choose the lead that will close on the given property."""
    # Prefer pre-existing active links so we don't fabricate links unnecessarily.
    for link in active_links.get(property_id, []):
        lead_id = link["lead_id"]
        if lead_id in used_leads:
            continue
        lead = next((l for l in eligible_leads if l["id"] == lead_id), None)
        if lead is not None:
            return lead

    # Otherwise pick any eligible lead we haven't already used.
    pool = [lead for lead in eligible_leads if lead["id"] not in used_leads]
    if not pool:
        return None
    return rng.choice(pool)


def _format_deal_row(
    *,
    team_id: str,
    lead_id: str,
    property_id: str,
    ren_id: str,
    sale_price: Decimal,
    commission_rate: Decimal,
    agency_fee: Decimal,
    lawyer_fees: Decimal,
    closed_at: datetime,
) -> dict[str, Any]:
    commission_total = _quantize_money(
        sale_price * commission_rate - agency_fee - lawyer_fees
    )
    return {
        "team_id": team_id,
        "lead_id": lead_id,
        "property_id": property_id,
        "ren_id": ren_id,
        "sale_price": str(sale_price),
        "commission_rate": str(commission_rate),
        "agency_fee": str(agency_fee),
        "lawyer_fees": str(lawyer_fees),
        "commission_total": str(commission_total),
        "commission_override": None,
        "closed_at": closed_at.isoformat(),
        "created_at": closed_at.isoformat(),
    }


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
    properties = [
        property_row for property_row in properties if _has_realistic_price(property_row)
    ]

    leads = (
        supabase.table("leads")
        .select("id, status, campaign_id, name")
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
    active_links_by_property: dict[str, list[dict[str, Any]]] = {}
    for link in links:
        active_links_by_property.setdefault(link["property_id"], []).append(link)

    return {
        "rens": rens,
        "properties": properties,
        "eligible_leads": eligible_leads,
        "active_links_by_property": active_links_by_property,
    }


def _commit_deal(
    supabase: Any,
    *,
    team_id: str,
    deal_row: dict[str, Any],
    deal_type: str,
    lead: dict[str, Any],
    ren_id: str,
    closed_at: datetime,
    active_links_by_property: dict[str, list[dict[str, Any]]],
    eligible_lead_ids: set[str],
) -> dict[str, Any]:
    """Insert the deal and replay every side effect the route applies."""
    property_id = deal_row["property_id"]
    lead_id = deal_row["lead_id"]

    _ensure_active_link(
        supabase,
        lead_id=lead_id,
        property_id=property_id,
        closed_at=closed_at,
    )

    deal = supabase.table("deals").insert(deal_row).execute().data[0]

    # Increment campaign conversions on the winning lead (route uses
    # CampaignCountersService.increment_conversion).
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
    losing_leads_changed: list[dict[str, str]] = []
    if other_lead_ids:
        supabase.table("lead_properties").update({"status": "inactive"}).eq(
            "property_id", property_id
        ).eq("status", "active").neq("lead_id", lead_id).execute()
        losing_status_before = (
            supabase.table("leads")
            .select("id, status")
            .in_("id", other_lead_ids)
            .execute()
            .data
            or []
        )
        losing_leads_changed = [
            {"id": row["id"], "from": row["status"]}
            for row in losing_status_before
            if row["status"] not in ("Won", "Lost")
        ]
        change_ids = [row["id"] for row in losing_leads_changed]
        if change_ids:
            supabase.table("leads").update({"status": "Lost"}).in_(
                "id", change_ids
            ).execute()

    # Backdated timeline events for the winning lead.
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
    for losing in losing_leads_changed:
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

    # Keep in-memory caches in sync so the next iteration sees the change.
    if property_id in active_links_by_property:
        del active_links_by_property[property_id]
    eligible_lead_ids.discard(lead_id)
    for losing in losing_leads_changed:
        eligible_lead_ids.discard(losing["id"])

    return {
        "deal": deal,
        "lead": lead,
        "losing_lead_ids": [row["id"] for row in losing_leads_changed],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=20)
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
    rens = world["rens"]
    properties = world["properties"]
    eligible_leads = world["eligible_leads"]
    active_links_by_property = world["active_links_by_property"]

    if not rens:
        raise SystemExit(
            f"Team {team_id} has no active RENs with commission_rate > 0; "
            "seed users first (scripts.seed_team_extras)."
        )
    if len(properties) < args.count:
        raise SystemExit(
            f"Need {args.count} Active properties to back the deals but only "
            f"{len(properties)} are available. Free some up or seed more."
        )
    if len(eligible_leads) < args.count:
        raise SystemExit(
            f"Need {args.count} non-Won/Lost leads to back the deals but only "
            f"{len(eligible_leads)} are available."
        )

    rng.shuffle(properties)
    plan_buckets = _scale_bucket_plan(args.count)
    selected_properties = properties[: args.count]

    eligible_lead_ids = {lead["id"] for lead in eligible_leads}
    used_leads: set[str] = set()
    planned: list[dict[str, Any]] = []

    for bucket, property_row in zip(plan_buckets, selected_properties, strict=True):
        lead = _pick_winning_lead(
            property_id=property_row["id"],
            active_links=active_links_by_property,
            eligible_leads=[l for l in eligible_leads if l["id"] in eligible_lead_ids],
            used_leads=used_leads,
            rng=rng,
        )
        if lead is None:
            raise SystemExit(
                "Ran out of eligible leads while planning deals; "
                "lower --count or seed more leads."
            )
        used_leads.add(lead["id"])
        eligible_lead_ids.discard(lead["id"])

        ren = rng.choice(rens)
        sale_price, deal_type = _compute_sale_price(property_row, rng)
        commission_rate = Decimal(str(ren["commission_rate"]))
        agency_fee, lawyer_fees = _compute_fees(
            sale_price, deal_type, commission_rate, rng
        )
        closed_at = now - _bucket_offset(bucket, rng)
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
        planned.append(
            {
                "bucket": bucket,
                "deal_row": deal_row,
                "deal_type": deal_type,
                "lead": lead,
                "property": property_row,
                "ren": ren,
                "closed_at": closed_at,
            }
        )

    print(
        f"Planning {len(planned)} deals across buckets: "
        + ", ".join(f"{bucket}={plan_buckets.count(bucket)}" for bucket in dict.fromkeys(plan_buckets))
    )

    if args.dry_run:
        print("(dry-run - no writes)")
        for entry in planned:
            print(
                f"  [{entry['bucket']:<7}] {entry['closed_at'].date()} "
                f"{entry['deal_type']:<6} RM{float(entry['deal_row']['sale_price']):>11,.0f} "
                f"commission=RM{float(entry['deal_row']['commission_total']):>9,.2f} "
                f"ren={entry['ren']['full_name']} "
                f"lead={entry['lead']['name']} "
                f"property={entry['property']['name']}"
            )
        return 0

    total_commission = Decimal("0")
    losing_lead_count = 0
    inserted = 0
    for entry in planned:
        result = _commit_deal(
            supabase,
            team_id=team_id,
            deal_row=entry["deal_row"],
            deal_type=entry["deal_type"],
            lead=entry["lead"],
            ren_id=entry["ren"]["id"],
            closed_at=entry["closed_at"],
            active_links_by_property=active_links_by_property,
            eligible_lead_ids=eligible_lead_ids,
        )
        inserted += 1
        losing_lead_count += len(result["losing_lead_ids"])
        total_commission += Decimal(entry["deal_row"]["commission_total"])
        print(
            f"  [{entry['bucket']:<7}] {entry['closed_at'].date()} "
            f"{entry['deal_type']:<6} RM{float(entry['deal_row']['sale_price']):>11,.0f} "
            f"commission=RM{float(entry['deal_row']['commission_total']):>9,.2f} "
            f"ren={entry['ren']['full_name']:<18} "
            f"lead={entry['lead']['name']}"
        )

    print()
    print(
        f"inserted {inserted} deals, total commission "
        f"RM{float(total_commission):,.2f}, "
        f"{losing_lead_count} other leads moved to Lost."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
