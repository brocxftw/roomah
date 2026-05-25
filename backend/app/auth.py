from dataclasses import dataclass
from typing import Any, Literal, cast

import jwt
from fastapi import HTTPException, Request, status
from jwt import PyJWKClient
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from app.core.config import Settings

Role = Literal["REN", "MANAGER"]


@dataclass(frozen=True)
class AuthContext:
    auth_user_id: str
    user_id: str
    team_id: str
    role: Role
    claims: dict[str, object]


class SupabaseAuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings: Settings) -> None:  # type: ignore[no-untyped-def]
        super().__init__(app)
        self.settings = settings
        self.jwks_client = (
            PyJWKClient(self._jwks_url()) if self.settings.supabase_url else None
        )

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        if request.method == "OPTIONS" or request.url.path == "/health":
            return await call_next(request)

        try:
            request.state.auth = self._verify_request(request)
        except HTTPException as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail},
                headers=getattr(exc, "headers", None),
            )

        return await call_next(request)

    def _verify_request(self, request: Request) -> AuthContext:
        authorization = request.headers.get("authorization")
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing bearer token",
            )

        token = authorization.split(" ", 1)[1]
        claims = self._decode_token(token)

        auth_user_id = str(claims.get("sub") or "")
        team_id = str(claims.get("team_id") or "")
        role = str(claims.get("role") or "")
        user_id = claims.get("user_id")

        if not auth_user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing required ROOMAH claims",
            )

        if request.url.path == "/auth/sync-user":
            team_id = team_id or self.settings.default_team_id
            role = role if role in {"REN", "MANAGER"} else "REN"
            user_id = str(user_id or "00000000-0000-0000-0000-000000000000")
        elif not team_id or role not in {"REN", "MANAGER"} or not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing required ROOMAH claims",
            )

        auth_context = AuthContext(
            auth_user_id=auth_user_id,
            user_id=str(user_id),
            team_id=team_id,
            role=role,  # type: ignore[arg-type]
            claims=claims,
        )
        self._ensure_user_active(
            auth_context, allow_unsynced=request.url.path == "/auth/sync-user"
        )
        return auth_context

    def _ensure_user_active(
        self,
        auth_context: AuthContext,
        *,
        allow_unsynced: bool = False,
    ) -> None:
        from app.supabase import get_service_supabase

        query = (
            get_service_supabase()
            .table("users")
            .select("id,active_status")
            .eq("auth_user_id", auth_context.auth_user_id)
        )
        if auth_context.user_id != "00000000-0000-0000-0000-000000000000":
            query = query.eq("id", auth_context.user_id)

        response = query.maybe_single().execute()
        if not response.data:
            if allow_unsynced:
                return
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current user has not been synced",
            )

        if response.data.get("active_status") is False:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account has been deactivated",
            )

    def _decode_token(self, token: str) -> dict[str, object]:
        try:
            algorithm = str(jwt.get_unverified_header(token).get("alg") or "")
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid bearer token",
            ) from exc

        decode_kwargs: dict[str, Any] = {}
        if self.settings.supabase_jwt_audience:
            decode_kwargs["audience"] = self.settings.supabase_jwt_audience
        else:
            decode_kwargs["options"] = {"verify_aud": False}

        try:
            if algorithm == "HS256":
                claims = self._decode_hs256_token(token, decode_kwargs)
            else:
                claims = self._decode_jwks_token(token, decode_kwargs)
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid bearer token",
            ) from exc

        return cast(dict[str, object], claims)

    def _decode_hs256_token(
        self,
        token: str,
        decode_kwargs: dict[str, Any],
    ) -> dict[str, Any]:
        if not self.settings.supabase_jwt_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase JWT secret is not configured",
            )

        return jwt.decode(
            token,
            self.settings.supabase_jwt_secret,
            algorithms=["HS256"],
            **decode_kwargs,
        )

    def _decode_jwks_token(
        self,
        token: str,
        decode_kwargs: dict[str, Any],
    ) -> dict[str, Any]:
        if self.jwks_client is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase URL is not configured",
            )

        signing_key = self.jwks_client.get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            signing_key,
            algorithms=["ES256", "RS256"],
            **decode_kwargs,
        )

    def _jwks_url(self) -> str:
        supabase_url = str(self.settings.supabase_url).rstrip("/")
        return f"{supabase_url}/auth/v1/.well-known/jwks.json"


def get_auth_context(request: Request) -> AuthContext:
    auth_context = getattr(request.state, "auth", None)
    if not isinstance(auth_context, AuthContext):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication context not found",
        )

    return auth_context
