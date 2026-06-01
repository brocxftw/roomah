"""Snapshot of the new deal pipeline shape in the database."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime
from typing import Any

from app.supabase import get_service_supabase

TEAM_ID = "00000000-0000-4000-8000-000000000001"


def _has_table(c: Any, name: str) -> bool:
    try:
        c.table(name).select("id").limit(1).execute()
    except Exception as exc:  # noqa: BLE001
        code = getattr(exc, "code", None) or (
            exc.args[0].get("code") if exc.args and isinstance(exc.args[0], dict) else None
        )
        if code == "PGRST205":
            return False
        raise
    return True


def main() -> None:
    c = get_service_supabase()

    deal_docs_present = _has_table(c, "deal_documents")
    print(f"deal_documents table present: {deal_docs_present}")

    deals = (
        c.table("deals")
        .select(
            "id, stage, deal_type, expected_close_date, probability_override, "
            "lost_reason, lost_at, origin_viewing_id, value_updated_at, "
            "closed_at, created_at, ren_id, lead_id, property_id, "
            "sale_price, commission_total, notes"
        )
        .eq("team_id", TEAM_ID)
        .execute()
        .data
        or []
    )
    print(f"deals: {len(deals)}")
    print("  by stage           :", Counter(d.get("stage") for d in deals))
    print("  by deal_type       :", Counter(d.get("deal_type") for d in deals))
    print(
        "  with expected_close_date :",
        sum(1 for d in deals if d.get("expected_close_date")),
    )
    print(
        "  with probability_override:",
        sum(1 for d in deals if d.get("probability_override") is not None),
    )
    print(
        "  with origin_viewing_id   :",
        sum(1 for d in deals if d.get("origin_viewing_id")),
    )
    print(
        "  with notes               :",
        sum(1 for d in deals if d.get("notes")),
    )
    print("  by lost_reason     :", Counter(d.get("lost_reason") for d in deals))

    sample = next(
        (d for d in deals if d.get("stage") and d.get("stage") != "closed_won"),
        None,
    )
    if sample:
        print("  sample open deal:")
        for key, value in sample.items():
            print(f"    {key} = {value}")
    sample_lost = next((d for d in deals if d.get("stage") == "closed_lost"), None)
    print(f"  has closed_lost deal sample: {sample_lost is not None}")

    if deal_docs_present:
        docs = (
            c.table("deal_documents")
            .select("id, deal_id, kind, label")
            .eq("team_id", TEAM_ID)
            .execute()
            .data
            or []
        )
        print(f"deal_documents: {len(docs)}")
        print("  by kind:", Counter(d.get("kind") for d in docs))


if __name__ == "__main__":
    main()
