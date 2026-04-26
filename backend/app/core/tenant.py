"""
Tenant context & middleware for multi-company isolation.

The current company_id is propagated via:
  - the JWT payload (claim "company_id")
  - request.state.company_id (set by TenantMiddleware)
  - get_current_company_id() FastAPI dependency

Domain queries should ALWAYS filter by company_id retrieved via the dependency.
For tighter isolation on PostgreSQL, set `app.current_company` session var so
RLS policies can apply (see migration: companies + RLS).
"""

from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.security import decode_access_token


class TenantMiddleware(BaseHTTPMiddleware):
    """Extract company_id from JWT and store on request.state.

    Tolerant: if no token, no company → routes that need it will 401 via the
    dependency. Auth/health endpoints work without a company context.
    """

    async def dispatch(self, request: Request, call_next):
        request.state.company_id = None
        request.state.user_role = None

        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
            payload = decode_access_token(token)
            if payload:
                request.state.company_id = payload.get("company_id")
                request.state.user_role = payload.get("role")

        return await call_next(request)


def get_current_company_id(request: Request) -> str:
    """FastAPI dependency: ensures the request has a valid company context."""
    cid: Optional[str] = getattr(request.state, "company_id", None)
    if not cid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Aucune société sélectionnée. Connectez-vous puis sélectionnez une société.",
        )
    return cid


def get_optional_company_id(request: Request) -> Optional[str]:
    """Dependency variant that returns None instead of raising."""
    return getattr(request.state, "company_id", None)
