from __future__ import annotations

import jwt
import pytest
from fastapi import FastAPI, HTTPException

from app.auth import AuthContext, SupabaseAuthMiddleware
from app.core.config import Settings

TEAM_ID = "00000000-0000-4000-8000-000000000001"
USER_ID = "00000000-0000-4000-8000-000000000002"
AUTH_USER_ID = "00000000-0000-4000-8000-000000000003"


def token_payload() -> dict[str, str]:
    return {
        "sub": AUTH_USER_ID,
        "team_id": TEAM_ID,
        "role": "REN",
        "user_id": USER_ID,
        "aud": "authenticated",
    }


def test_decodes_hs256_token_with_legacy_secret() -> None:
    secret = "test-secret-with-at-least-32-bytes"
    settings = Settings(
        supabase_url="https://example.supabase.co",
        supabase_jwt_secret=secret,
    )
    middleware = SupabaseAuthMiddleware(FastAPI(), settings=settings)
    token = jwt.encode(token_payload(), secret, algorithm="HS256")

    claims = middleware._decode_token(token)

    assert claims["sub"] == AUTH_USER_ID
    assert claims["team_id"] == TEAM_ID
    assert claims["role"] == "REN"
    assert claims["user_id"] == USER_ID


def test_decodes_rs256_token_with_supabase_jwks() -> None:
    from cryptography.hazmat.primitives.asymmetric import rsa

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = jwt.encode(token_payload(), private_key, algorithm="RS256")
    settings = Settings(supabase_url="https://example.supabase.co")
    middleware = SupabaseAuthMiddleware(FastAPI(), settings=settings)
    middleware.jwks_client = FakeJwksClient(private_key.public_key())

    claims = middleware._decode_token(token)

    assert claims["sub"] == AUTH_USER_ID
    assert claims["team_id"] == TEAM_ID
    assert claims["role"] == "REN"
    assert claims["user_id"] == USER_ID


class FakeJwksClient:
    def __init__(self, key: object) -> None:
        self.signing_key = FakeSigningKey(key)

    def get_signing_key_from_jwt(self, _token: str) -> FakeSigningKey:
        return self.signing_key


class FakeSigningKey:
    def __init__(self, key: object) -> None:
        self.key = key


class FakeResponse:
    def __init__(self, data: dict[str, object] | None) -> None:
        self.data = data


class FakeQuery:
    def __init__(self, row: dict[str, object] | None) -> None:
        self.row = row

    def table(self, _table_name: str) -> "FakeQuery":
        return self

    def select(self, _columns: str) -> "FakeQuery":
        return self

    def eq(self, _column: str, _value: object) -> "FakeQuery":
        return self

    def maybe_single(self) -> "FakeQuery":
        return self

    def execute(self) -> FakeResponse:
        return FakeResponse(self.row)


def test_deactivated_user_token_fails_auth_dependency(monkeypatch) -> None:
    settings = Settings(supabase_url="https://example.supabase.co")
    middleware = SupabaseAuthMiddleware(FastAPI(), settings=settings)
    monkeypatch.setattr(
        "app.supabase.get_service_supabase",
        lambda: FakeQuery({"id": USER_ID, "active_status": False}),
    )

    with pytest.raises(HTTPException) as exc_info:
        middleware._ensure_user_active(
            AuthContext(
                auth_user_id=AUTH_USER_ID,
                user_id=USER_ID,
                team_id=TEAM_ID,
                role="REN",
                claims={},
            )
        )

    assert exc_info.value.status_code == 401
