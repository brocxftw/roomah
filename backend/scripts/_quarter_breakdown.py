from collections import Counter
from datetime import datetime, timezone

from app.supabase import get_service_supabase

TEAM_ID = "00000000-0000-4000-8000-000000000001"


def quarter_of(iso: str) -> str:
    d = datetime.fromisoformat(iso.replace("Z", "+00:00")).date()
    if d >= datetime(2026, 4, 1, tzinfo=timezone.utc).date():
        return "Q2 2026"
    if d >= datetime(2026, 1, 1, tzinfo=timezone.utc).date():
        return "Q1 2026"
    if d >= datetime(2025, 10, 1, tzinfo=timezone.utc).date():
        return "Q4 2025"
    if d >= datetime(2025, 7, 1, tzinfo=timezone.utc).date():
        return "Q3 2025"
    return "pre-Q3 2025"


def main() -> None:
    c = get_service_supabase()
    props = (
        c.table("properties").select("id, status, created_at").eq("team_id", TEAM_ID).execute().data
        or []
    )
    leads = (
        c.table("leads").select("id, status, created_at").eq("team_id", TEAM_ID).execute().data
        or []
    )
    deals = (
        c.table("deals").select("id, closed_at").eq("team_id", TEAM_ID).execute().data
        or []
    )

    by_q_pstatus = Counter((quarter_of(p["created_at"]), p["status"]) for p in props)
    by_q_lstatus = Counter((quarter_of(l["created_at"]), l["status"]) for l in leads)
    deals_by_q = Counter(quarter_of(d["closed_at"]) for d in deals)

    print("PROPERTIES by quarter / status:")
    quarters = ("pre-Q3 2025", "Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026")
    for q in quarters:
        active = by_q_pstatus[(q, "Active")]
        pending = by_q_pstatus[(q, "Pending")]
        inactive = by_q_pstatus[(q, "Inactive")]
        total = active + pending + inactive
        print(
            f"  {q:<12} total={total:<3} Active={active:<3} "
            f"Pending={pending:<3} Inactive={inactive}"
        )

    print("\nLEADS by quarter (eligible = non Won/Lost):")
    for q in quarters:
        total = sum(c for (qq, _), c in by_q_lstatus.items() if qq == q)
        eligible = sum(
            c for (qq, s), c in by_q_lstatus.items() if qq == q and s not in ("Won", "Lost")
        )
        won = sum(c for (qq, s), c in by_q_lstatus.items() if qq == q and s == "Won")
        lost = sum(c for (qq, s), c in by_q_lstatus.items() if qq == q and s == "Lost")
        print(
            f"  {q:<12} total={total:<3} eligible={eligible:<3} "
            f"Won={won:<2} Lost={lost}"
        )

    print("\nDEALS by closed_at quarter:")
    for q in quarters:
        print(f"  {q:<12} {deals_by_q[q]}")


if __name__ == "__main__":
    main()
