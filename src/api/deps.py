"""Shared FastAPI dependencies."""
import os
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import select

import jwt

from src.database.config import get_db

JWT_SECRET = os.environ.get("JWT_SECRET_KEY") or os.environ.get("GEMINI_WORKSHOP_API_KEY")
if not JWT_SECRET:
    # Will match the random secret generated in auth.py only within same process import
    # In practice GEMINI_WORKSHOP_API_KEY is always set in Workshop environment
    import secrets as _secrets
    JWT_SECRET = _secrets.token_hex(32)


def get_guild_id(request: Request) -> str:
    """Lấy guild_id từ header X-Guild-ID. Bắt buộc với mọi route multi-guild."""
    guild_id = request.headers.get("X-Guild-ID")
    if not guild_id:
        raise HTTPException(status_code=400, detail="Missing X-Guild-ID header")
    return guild_id


def _decode_session(request: Request) -> dict:
    """Decode dashboard_session cookie → payload dict.  Raises 401 on missing/invalid."""
    token = request.cookies.get("dashboard_session")
    if not token:
        raise HTTPException(status_code=401, detail="Not logged in")
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session")


def require_auth(request: Request) -> dict:
    """Dependency: any logged-in user.  Returns JWT payload."""
    return _decode_session(request)


def require_owner(request: Request) -> dict:
    """Dependency: must be bot owner (is_owner=True in JWT).  Returns JWT payload."""
    payload = _decode_session(request)
    if not payload.get("is_owner"):
        raise HTTPException(status_code=403, detail="Owner access required")
    return payload


def require_staff_perm(perm_field: str):
    """
    Factory: returns a FastAPI dependency that checks staff permission.
    Owner always passes. Non-owner must have a StaffPermission row with
    `perm_field=True` for at least one of their Discord roles.

    Usage:
        @router.get("/something", dependencies=[Depends(require_staff_perm("can_shop"))])
    """
    def _dep(
        request: Request,
        db=Depends(get_db),
        guild_id: str = Depends(get_guild_id),
    ):
        from src.models.models import StaffPermission

        payload = _decode_session(request)

        # Owner bypasses all permission checks
        if payload.get("is_owner"):
            return payload

        # Get caller's Discord role IDs from request header
        # Frontend sends X-Member-Roles: "role1,role2,..."
        raw_roles = request.headers.get("X-Member-Roles", "")
        member_role_ids = [r.strip() for r in raw_roles.split(",") if r.strip()]

        if not member_role_ids:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Check if any of the member's roles has the required permission
        perms = db.execute(
            select(StaffPermission).where(
                StaffPermission.guild_id == guild_id,
                StaffPermission.role_id.in_(member_role_ids),
            )
        ).scalars().all()

        for sp in perms:
            if getattr(sp, perm_field, False):
                return payload

        raise HTTPException(status_code=403, detail="Insufficient permissions")

    return _dep
