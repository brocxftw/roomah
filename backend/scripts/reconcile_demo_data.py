"""Reconcile demo data so deals / leads / properties / campaigns agree.

A handful of inconsistencies can creep into the demo project over time:

  * leads flipped to ``Won`` via ad-hoc SQL with no matching ``deals`` row
  * properties closed in a deal whose other ``lead_properties`` links were
    never inactivated (so multiple leads still appear "active" on a sold
    property)
  * ``marketing_campaigns.conversions`` drifting from the authoritative
    ``deals x leads.campaign_id`` count

This script reconciles each of those, with timeline events emitted for any
status changes so the audit history stays plausible. It only writes when
something is actually inconsistent; safe to re-run.

Usage::

    python -m scripts.reconcile_demo_data
    python -m scripts.reconcile_demo_data --dry-run
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from datetime import UTC, datetime
from typing import Any

from app.core.config import get_settings
from app.supabase import get_service_supabase


def _emit_event(
    supabase: Any,
    *,
    team_id: str,
    lead_id: str,
    event_type: str,
    payload: dict[str, Any],
    created_by: str | None,
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


def _reconcile_orphan_won_leads(
    supabase: Any,
    *,
    team_id: str,
    leads: list[dict[str, Any]],
    deal_lead_ids: set[str],
    manager_id: str | None,
    dry_run: bool,
) -> int:
    orphan_won = [
        lead
        for lead in leads
        if lead["status"] == "Won" and lead["id"] not in deal_lead_ids
    ]
    if not orphan_won:
        return 0

    now = datetime.now(UTC)
    print(
        f"  orphan Won leads without a deal: {len(orphan_won)} "
        "-> demoting to Negotiation"
    )
    if dry_run:
        return len(orphan_won)

    supabase.table("leads").update({"status": "Negotiation"}).in_(
        "id", [lead["id"] for lead in orphan_won]
    ).execute()
    for lead in orphan_won:
        _emit_event(
            supabase,
            team_id=team_id,
            lead_id=lead["id"],
            event_type="lead_status_changed",
            payload={
                "from": "Won",
                "to": "Negotiation",
                "reason": "reconciled - no matching deal record",
            },
            created_by=manager_id,
            created_at=now,
        )
    return len(orphan_won)


def _reconcile_property_link_orphans(
    supabase: Any,
    *,
    team_id: str,
    deals: list[dict[str, Any]],
    links: list[dict[str, Any]],
    leads_by_id: dict[str, dict[str, Any]],
    manager_id: str | None,
    dry_run: bool,
) -> int:
    fixes = 0
    for deal in deals:
        property_id = deal["property_id"]
        winning_lead_id = deal["lead_id"]
        orphan_links = [
            link
            for link in links
            if link["property_id"] == property_id
            and link["status"] == "active"
            and link["lead_id"] != winning_lead_id
        ]
        if not orphan_links:
            continue

        print(
            f"  property {property_id}: {len(orphan_links)} orphan active "
            "links to deactivate (and move losing leads -> Lost)"
        )
        fixes += len(orphan_links)
        if dry_run:
            continue

        closed_at = datetime.fromisoformat(
            deal["closed_at"].replace("Z", "+00:00")
        )
        loser_ids = [link["lead_id"] for link in orphan_links]

        supabase.table("lead_properties").update({"status": "inactive"}).eq(
            "property_id", property_id
        ).eq("status", "active").neq("lead_id", winning_lead_id).execute()

        for loser_id in loser_ids:
            loser = leads_by_id.get(loser_id)
            if loser is None:
                continue
            previous_status = loser["status"]
            if previous_status not in ("Won", "Lost"):
                supabase.table("leads").update({"status": "Lost"}).eq(
                    "id", loser_id
                ).execute()
                _emit_event(
                    supabase,
                    team_id=team_id,
                    lead_id=loser_id,
                    event_type="lead_status_changed",
                    payload={
                        "from": previous_status,
                        "to": "Lost",
                        "reason": "reconciled - property closed under another lead",
                    },
                    created_by=manager_id,
                    created_at=closed_at,
                )
            _emit_event(
                supabase,
                team_id=team_id,
                lead_id=loser_id,
                event_type="property_unlinked",
                payload={
                    "property_id": property_id,
                    "reason": "reconciled - property closed under another lead",
                },
                created_by=manager_id,
                created_at=closed_at,
            )
    return fixes


def _reconcile_campaign_conversions(
    supabase: Any,
    *,
    team_id: str,
    deals: list[dict[str, Any]],
    leads_by_id: dict[str, dict[str, Any]],
    campaigns: list[dict[str, Any]],
    dry_run: bool,
) -> int:
    expected: Counter[str] = Counter()
    for deal in deals:
        lead = leads_by_id.get(deal["lead_id"])
        if lead and lead.get("campaign_id"):
            expected[lead["campaign_id"]] += 1

    fixes = 0
    for campaign in campaigns:
        want = expected.get(campaign["id"], 0)
        have = int(campaign["conversions"])
        if want == have:
            continue

        print(
            f"  campaign {campaign['name']!r}: "
            f"conversions {have} -> {want}"
        )
        fixes += 1
        if dry_run:
            continue
        supabase.table("marketing_campaigns").update({"conversions": want}).eq(
            "id", campaign["id"]
        ).execute()
    return fixes


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the plan without writing.",
    )
    args = parser.parse_args(argv)

    supabase = get_service_supabase()
    team_id = get_settings().default_team_id

    leads = (
        supabase.table("leads")
        .select("id, status, campaign_id, name")
        .eq("team_id", team_id)
        .execute()
        .data
        or []
    )
    leads_by_id = {lead["id"]: lead for lead in leads}
    deals = (
        supabase.table("deals")
        .select("id, lead_id, property_id, closed_at")
        .eq("team_id", team_id)
        .execute()
        .data
        or []
    )
    deal_lead_ids = {deal["lead_id"] for deal in deals}
    links = (
        supabase.table("lead_properties")
        .select("lead_id, property_id, status")
        .execute()
        .data
        or []
    )
    campaigns = (
        supabase.table("marketing_campaigns")
        .select("id, name, conversions")
        .eq("team_id", team_id)
        .execute()
        .data
        or []
    )
    users = (
        supabase.table("users")
        .select("id, role")
        .eq("team_id", team_id)
        .eq("active_status", True)
        .execute()
        .data
        or []
    )
    manager_id = next((u["id"] for u in users if u["role"] == "MANAGER"), None)

    print(f"reconciling team={team_id} (dry-run={args.dry_run})")

    total_fixes = 0
    total_fixes += _reconcile_orphan_won_leads(
        supabase,
        team_id=team_id,
        leads=leads,
        deal_lead_ids=deal_lead_ids,
        manager_id=manager_id,
        dry_run=args.dry_run,
    )
    total_fixes += _reconcile_property_link_orphans(
        supabase,
        team_id=team_id,
        deals=deals,
        links=links,
        leads_by_id=leads_by_id,
        manager_id=manager_id,
        dry_run=args.dry_run,
    )
    total_fixes += _reconcile_campaign_conversions(
        supabase,
        team_id=team_id,
        deals=deals,
        leads_by_id=leads_by_id,
        campaigns=campaigns,
        dry_run=args.dry_run,
    )

    if total_fixes == 0:
        print("no fixes needed.")
    elif args.dry_run:
        print(f"would apply {total_fixes} fixes (re-run without --dry-run).")
    else:
        print(f"applied {total_fixes} fixes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
