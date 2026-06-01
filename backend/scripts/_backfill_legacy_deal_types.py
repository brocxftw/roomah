"""Backfill ``deals.deal_type`` for legacy rows that pre-date the column.

The ``add_deal_pipeline_workflow`` migration introduced ``deal_type`` but
did not populate it for already-closed deals. Without a value the
pipeline UI defaults their filter chip to "(none)" instead of Sale/Rental.

For each closed deal with ``deal_type IS NULL`` we infer the type from the
associated property's ``listing_type``:

  * Sale  -> "Sale"
  * Rental -> "Rental"
  * Both  -> use the sale_price magnitude (rental commissions tend to be
            < RM 100k; sales are typically >> RM 100k)
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.supabase import get_service_supabase

TEAM_ID = "00000000-0000-4000-8000-000000000001"

# Below this we treat the deal as a rental (12-month rent equivalent).
RENTAL_CEILING = Decimal("180000")


def main() -> None:
    c = get_service_supabase()
    deals = (
        c.table("deals")
        .select("id, deal_type, property_id, sale_price")
        .eq("team_id", TEAM_ID)
        .is_("deal_type", None)
        .execute()
        .data
        or []
    )
    if not deals:
        print("No legacy deals to backfill.")
        return

    property_ids = sorted({d["property_id"] for d in deals if d.get("property_id")})
    properties = (
        c.table("properties")
        .select("id, listing_type")
        .in_("id", property_ids)
        .execute()
        .data
        or []
    )
    listing_by_id: dict[str, str] = {p["id"]: p["listing_type"] for p in properties}

    counts: dict[str, int] = {"Sale": 0, "Rental": 0, "skipped": 0}
    for deal in deals:
        listing = listing_by_id.get(deal["property_id"])
        if listing == "Sale":
            inferred = "Sale"
        elif listing == "Rental":
            inferred = "Rental"
        elif listing == "Both":
            price = Decimal(str(deal["sale_price"]))
            inferred = "Rental" if price < RENTAL_CEILING else "Sale"
        else:
            counts["skipped"] += 1
            continue
        c.table("deals").update({"deal_type": inferred}).eq("id", deal["id"]).execute()
        counts[inferred] += 1

    print(f"Backfilled deal_type on {len(deals) - counts['skipped']} legacy deals:")
    for key, value in counts.items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
