"""Coherence audit for the demo data after seeding deals."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from app.supabase import get_service_supabase

TEAM_ID = "00000000-0000-4000-8000-000000000001"


def _bucket(closed_at: str, now: datetime) -> str:
    when = datetime.fromisoformat(closed_at.replace("Z", "+00:00"))
    age = now - when
    if age < timedelta(days=1):
        return "today"
    if age < timedelta(days=7):
        return "week"
    if age < timedelta(days=30):
        return "month"
    if age < timedelta(days=92):
        return "quarter"
    return "older"


def main() -> None:
    c = get_service_supabase()
    now = datetime.now(UTC)

    deals = (
        c.table("deals")
        .select("id, lead_id, property_id, ren_id, sale_price, commission_total, closed_at")
        .eq("team_id", TEAM_ID)
        .order("closed_at", desc=True)
        .execute()
        .data
        or []
    )
    leads = (
        c.table("leads")
        .select("id, status, campaign_id")
        .eq("team_id", TEAM_ID)
        .execute()
        .data
        or []
    )
    leads_by_id = {l["id"]: l for l in leads}
    props = (
        c.table("properties")
        .select("id, status, name")
        .eq("team_id", TEAM_ID)
        .execute()
        .data
        or []
    )
    props_by_id = {p["id"]: p for p in props}
    links = (
        c.table("lead_properties")
        .select("lead_id, property_id, status")
        .execute()
        .data
        or []
    )
    events = (
        c.table("timeline_events")
        .select("event_type, lead_id, payload, created_at")
        .eq("team_id", TEAM_ID)
        .execute()
        .data
        or []
    )
    campaigns = (
        c.table("marketing_campaigns")
        .select("id, name, conversions, leads_generated")
        .eq("team_id", TEAM_ID)
        .execute()
        .data
        or []
    )
    users = (
        c.table("users")
        .select("id, full_name, role")
        .eq("team_id", TEAM_ID)
        .execute()
        .data
        or []
    )
    user_name = {u["id"]: u["full_name"] for u in users}

    print(f"TEAM: {TEAM_ID}")
    print(f"  users={len(users)} properties={len(props)} leads={len(leads)} deals={len(deals)}")
    print(
        f"  lead_properties={len(links)} timeline_events={len(events)} "
        f"campaigns={len(campaigns)}"
    )

    print("\nDEAL BUCKETS (vs now):")
    deal_buckets = Counter(_bucket(d["closed_at"], now) for d in deals)
    for k in ("today", "week", "month", "quarter", "older"):
        print(f"  {k:<8} {deal_buckets[k]}")

    print("\nDEAL TOTALS:")
    total_sale = sum(Decimal(str(d["sale_price"])) for d in deals)
    total_comm = sum(Decimal(str(d["commission_total"])) for d in deals)
    print(f"  total sale volume     RM {float(total_sale):>14,.2f}")
    print(f"  total ren commission  RM {float(total_comm):>14,.2f}")

    print("\nCOMMISSION BY REN:")
    by_ren: dict[str, Decimal] = {}
    deals_by_ren: Counter[str] = Counter()
    for d in deals:
        by_ren[d["ren_id"]] = by_ren.get(d["ren_id"], Decimal("0")) + Decimal(
            str(d["commission_total"])
        )
        deals_by_ren[d["ren_id"]] += 1
    for ren_id, total in sorted(by_ren.items(), key=lambda kv: -kv[1]):
        print(
            f"  {user_name.get(ren_id, ren_id):<25} "
            f"deals={deals_by_ren[ren_id]:<2} "
            f"commission=RM {float(total):>11,.2f}"
        )

    print("\nLEAD STATUSES:")
    for status, count in sorted(Counter(l["status"] for l in leads).items()):
        print(f"  {status:<14} {count}")

    print("\nPROPERTY STATUSES:")
    for status, count in sorted(Counter(p["status"] for p in props).items()):
        print(f"  {status:<14} {count}")

    print("\nCAMPAIGNS:")
    for cm in campaigns:
        print(
            f"  {cm['name']:<48} "
            f"leads_generated={cm['leads_generated']:<2} "
            f"conversions={cm['conversions']}"
        )

    print("\nTIMELINE EVENTS by type:")
    for k, v in sorted(Counter(e["event_type"] for e in events).items()):
        print(f"  {k:<28} {v}")

    print("\n--- COHERENCE CHECKS ---")
    issues: list[str] = []

    deal_lead_ids = {d["lead_id"] for d in deals}
    deal_property_ids = {d["property_id"] for d in deals}

    for d in deals:
        lead = leads_by_id.get(d["lead_id"])
        if not lead:
            issues.append(f"deal {d['id']} references missing lead {d['lead_id']}")
            continue
        if lead["status"] != "Won":
            issues.append(
                f"deal {d['id']} lead is status {lead['status']!r} (expected Won)"
            )

    for d in deals:
        prop = props_by_id.get(d["property_id"])
        if not prop:
            issues.append(f"deal {d['id']} references missing property {d['property_id']}")
            continue
        if prop["status"] != "Inactive":
            issues.append(
                f"deal {d['id']} property {prop['name']} is status "
                f"{prop['status']!r} (expected Inactive)"
            )

    won_leads = {l["id"] for l in leads if l["status"] == "Won"}
    orphan_won = won_leads - deal_lead_ids
    if orphan_won:
        issues.append(
            f"{len(orphan_won)} leads in status Won without a matching deal "
            f"(example: {next(iter(orphan_won))})"
        )

    deal_closed_events = sum(1 for e in events if e["event_type"] == "deal_closed")
    if deal_closed_events != len(deals):
        issues.append(
            f"deal_closed timeline events ({deal_closed_events}) != deals "
            f"({len(deals)})"
        )

    for d in deals:
        active_link = next(
            (
                link
                for link in links
                if link["lead_id"] == d["lead_id"]
                and link["property_id"] == d["property_id"]
                and link["status"] == "active"
            ),
            None,
        )
        if active_link is None:
            issues.append(
                f"deal {d['id']} has no active lead_property link for "
                f"({d['lead_id']}, {d['property_id']})"
            )

    for prop_id in deal_property_ids:
        other_active = [
            link
            for link in links
            if link["property_id"] == prop_id and link["status"] == "active"
        ]
        if len(other_active) > 1:
            issues.append(
                f"property {prop_id} has {len(other_active)} active links "
                "(should be exactly 1)"
            )

    expected_conversions: Counter[str] = Counter()
    for d in deals:
        lead = leads_by_id.get(d["lead_id"])
        if lead and lead.get("campaign_id"):
            expected_conversions[lead["campaign_id"]] += 1
    for cm in campaigns:
        expected = expected_conversions.get(cm["id"], 0)
        if cm["conversions"] < expected:
            issues.append(
                f"campaign {cm['name']!r} has conversions={cm['conversions']} "
                f"but >= {expected} deals attribute to it"
            )

    if not issues:
        print("  all checks passed")
    else:
        for issue in issues:
            print(f"  ! {issue}")


if __name__ == "__main__":
    main()
