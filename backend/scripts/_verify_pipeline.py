"""Audit the deal pipeline after seeding.

Verifies:
  * stage distribution + KPI-shaped totals (open value vs won value)
  * deal_documents counts by kind + per-stage coverage
  * timeline events emitted for the new deal lifecycle
  * temporal sanity (closed_at present iff closed_won, lost_at iff
    closed_lost, value_updated_at is never null, etc.)
  * lead/property cascade integrity (won deals -> Inactive property +
    Won lead, no orphan won leads, no double-active links on the same
    property)
"""

from __future__ import annotations

from collections import Counter, defaultdict
from decimal import Decimal
from typing import Any

from app.supabase import get_service_supabase

TEAM_ID = "00000000-0000-4000-8000-000000000001"

OPEN_STAGES = {"negotiation", "offer_made", "pending_contract", "final_approval"}


def _decimal(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def main() -> None:
    c = get_service_supabase()

    deals = (
        c.table("deals")
        .select(
            "id, stage, deal_type, sale_price, commission_total, "
            "commission_override, probability_override, expected_close_date, "
            "notes, origin_viewing_id, value_updated_at, closed_at, lost_at, "
            "lost_reason, lost_notes, created_at, lead_id, property_id, ren_id"
        )
        .eq("team_id", TEAM_ID)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    docs = (
        c.table("deal_documents")
        .select("id, deal_id, kind, label, url, created_at")
        .eq("team_id", TEAM_ID)
        .execute()
        .data
        or []
    )
    leads = (
        c.table("leads")
        .select("id, status, campaign_id, name")
        .eq("team_id", TEAM_ID)
        .execute()
        .data
        or []
    )
    properties = (
        c.table("properties")
        .select("id, name, status")
        .eq("team_id", TEAM_ID)
        .execute()
        .data
        or []
    )
    links = (
        c.table("lead_properties")
        .select("lead_id, property_id, status")
        .eq("status", "active")
        .execute()
        .data
        or []
    )
    events = (
        c.table("timeline_events")
        .select("id, event_type, lead_id, payload, created_at")
        .eq("team_id", TEAM_ID)
        .in_(
            "event_type",
            [
                "deal_created",
                "deal_stage_changed",
                "deal_won",
                "deal_lost",
                "deal_closed",
                "deal_document_added",
                "deal_note_updated",
            ],
        )
        .execute()
        .data
        or []
    )

    issues: list[str] = []

    by_stage = Counter(d["stage"] for d in deals)
    print(f"Deals: {len(deals)}")
    print(f"  by stage: {dict(by_stage)}")
    by_type = Counter(d.get("deal_type") for d in deals)
    print(f"  by deal_type: {dict(by_type)}")

    open_value = sum(
        _decimal(d["sale_price"]) for d in deals if d["stage"] in OPEN_STAGES
    )
    won_value = sum(
        _decimal(d["sale_price"]) for d in deals if d["stage"] == "closed_won"
    )
    won_commission = sum(
        _decimal(d.get("commission_override") or d.get("commission_total"))
        for d in deals
        if d["stage"] == "closed_won"
    )
    open_commission = sum(
        _decimal(d.get("commission_override") or d.get("commission_total"))
        for d in deals
        if d["stage"] in OPEN_STAGES
    )
    print(
        f"  KPI value -> open: RM{open_value:,.2f} | "
        f"won: RM{won_value:,.2f}"
    )
    print(
        f"  KPI commission -> open: RM{open_commission:,.2f} | "
        f"won: RM{won_commission:,.2f}"
    )

    with_exp = sum(1 for d in deals if d.get("expected_close_date"))
    with_prob = sum(1 for d in deals if d.get("probability_override") is not None)
    with_notes = sum(1 for d in deals if d.get("notes"))
    with_viewing = sum(1 for d in deals if d.get("origin_viewing_id"))
    print(
        f"  enrichment -> expected_close: {with_exp}, probability_override: "
        f"{with_prob}, notes: {with_notes}, origin_viewing: {with_viewing}"
    )

    for d in deals:
        if d["stage"] == "closed_won":
            if not d.get("closed_at"):
                issues.append(f"deal {d['id']}: closed_won without closed_at")
            if d.get("lost_reason"):
                issues.append(f"deal {d['id']}: closed_won has lost_reason")
        elif d["stage"] == "closed_lost":
            if not d.get("lost_reason"):
                issues.append(f"deal {d['id']}: closed_lost missing lost_reason")
            if not d.get("lost_at"):
                issues.append(f"deal {d['id']}: closed_lost missing lost_at")
        else:
            if d.get("closed_at"):
                issues.append(
                    f"deal {d['id']}: open stage {d['stage']} has closed_at"
                )
        if d.get("value_updated_at") is None:
            issues.append(f"deal {d['id']}: missing value_updated_at")

    print(f"\nDeal documents: {len(docs)}")
    print(f"  by kind: {dict(Counter(d.get('kind') for d in docs))}")
    docs_by_stage: dict[str, int] = defaultdict(int)
    deals_by_id = {d["id"]: d for d in deals}
    for doc in docs:
        stage = deals_by_id.get(doc["deal_id"], {}).get("stage", "?")
        docs_by_stage[stage] += 1
    print(f"  by stage: {dict(docs_by_stage)}")
    bad_urls = [d for d in docs if not (d.get("url") or "").startswith("http")]
    if bad_urls:
        issues.append(f"{len(bad_urls)} docs have non-http(s) urls")

    print(f"\nNew-lifecycle timeline events: {len(events)}")
    print(f"  by event_type: {dict(Counter(e['event_type'] for e in events))}")

    won_lead_ids = {d["lead_id"] for d in deals if d["stage"] == "closed_won"}
    leads_by_id = {l["id"]: l for l in leads}
    for lid in won_lead_ids:
        lead = leads_by_id.get(lid)
        if not lead or lead["status"] != "Won":
            issues.append(f"lead {lid}: expected Won status, got {lead and lead['status']}")
    won_property_ids = {d["property_id"] for d in deals if d["stage"] == "closed_won"}
    props_by_id = {p["id"]: p for p in properties}
    for pid in won_property_ids:
        prop = props_by_id.get(pid)
        if not prop or prop["status"] != "Inactive":
            issues.append(
                f"property {pid}: expected Inactive after closed_won, got "
                f"{prop and prop['status']}"
            )

    # The route only inactivates *other* leads' links on a won property; the
    # winning lead's own active link is intentionally preserved so the
    # historical "sold to X" relationship stays queryable. So the only
    # acceptable active link on a won property is the winner's.
    active_by_prop: dict[str, set[str]] = defaultdict(set)
    for link in links:
        active_by_prop[link["property_id"]].add(link["lead_id"])
    won_lead_by_prop = {
        d["property_id"]: d["lead_id"] for d in deals if d["stage"] == "closed_won"
    }
    for pid in won_property_ids:
        active_leads = active_by_prop.get(pid, set())
        expected = {won_lead_by_prop.get(pid)} - {None}
        extras = active_leads - expected
        if extras:
            issues.append(
                f"property {pid}: active links for non-winners after closed_won: "
                f"{extras}"
            )

    orphan_wons = [
        l
        for l in leads
        if l["status"] == "Won"
        and not any(d["lead_id"] == l["id"] and d["stage"] == "closed_won" for d in deals)
    ]
    if orphan_wons:
        issues.append(
            f"{len(orphan_wons)} leads marked Won without a closed_won deal"
        )

    pipeline_total = sum(by_stage.values())
    if pipeline_total != len(deals):
        issues.append(
            f"stage histogram total {pipeline_total} != total deals {len(deals)}"
        )

    if issues:
        print("\nFound issues:")
        for issue in issues:
            print(f"  - {issue}")
    else:
        print("\nAll pipeline checks passed.")


if __name__ == "__main__":
    main()
