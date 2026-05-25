from __future__ import annotations

import argparse

from app.supabase import get_service_supabase


def promote_manager(email: str) -> None:
    response = (
        get_service_supabase()
        .table("users")
        .update({"role": "MANAGER"})
        .eq("email", email)
        .execute()
    )
    if not response.data:
        raise SystemExit(f"No user found for email: {email}")

    print(f"Promoted {email} to MANAGER")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("email", help="User email to promote")
    args = parser.parse_args()
    promote_manager(args.email)


if __name__ == "__main__":
    main()
