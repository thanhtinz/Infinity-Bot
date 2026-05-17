"""Verification System routes — config, verified members, stats."""
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.api.deps import get_guild_id
from src.models.models import VerificationConfig, VerifiedMember

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_or_create_config(db: Session, guild_id: str) -> VerificationConfig:
    cfg = db.execute(
        select(VerificationConfig).where(VerificationConfig.guild_id == guild_id)
    ).scalars().first()
    if not cfg:
        cfg = VerificationConfig(guild_id=guild_id)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


# ── Verification Config ──

@router.get("/verification/config")
def get_config(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    cfg = _get_or_create_config(db, guild_id)
    return {
        "enabled": cfg.enabled,
        "verified_role_id": cfg.verified_role_id,
        "unverified_role_id": cfg.unverified_role_id,
        "verify_channel_id": cfg.verify_channel_id,
        "log_channel_id": cfg.log_channel_id,
        "page_title": cfg.page_title,
        "page_description": cfg.page_description,
        "page_color": cfg.page_color,
        "page_logo_url": cfg.page_logo_url,
        "page_background_url": cfg.page_background_url,
        "button_text": cfg.button_text,
        "success_message": cfg.success_message,
        "captcha_enabled": cfg.captcha_enabled,
        "min_account_age_days": cfg.min_account_age_days,
        "block_vpn": cfg.block_vpn,
        "kick_on_deauth": cfg.kick_on_deauth,
        "close_page_after_verify": cfg.close_page_after_verify,
    }


@router.put("/verification/config")
def update_config(body: dict, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    cfg = _get_or_create_config(db, guild_id)
    allowed = [
        "enabled", "verified_role_id", "unverified_role_id", "verify_channel_id",
        "log_channel_id", "page_title", "page_description", "page_color",
        "page_logo_url", "page_background_url", "button_text", "success_message",
        "captcha_enabled", "min_account_age_days", "block_vpn",
        "kick_on_deauth", "close_page_after_verify",
    ]
    for field in allowed:
        if field in body:
            setattr(cfg, field, body[field])
    db.commit()
    return {"ok": True}


# ── Verified Members ──

@router.get("/verification/members")
def list_members(
    guild_id: str = Depends(get_guild_id),
    db: Session = Depends(get_db),
    page: int = 1,
    per_page: int = 50,
    search: str = "",
    blacklisted: bool | None = None,
):
    q = select(VerifiedMember).where(VerifiedMember.guild_id == guild_id)
    if search:
        q = q.where(
            VerifiedMember.username.ilike(f"%{search}%")
            | VerifiedMember.discord_id.ilike(f"%{search}%")
            | VerifiedMember.email.ilike(f"%{search}%")
            | VerifiedMember.ip_address.ilike(f"%{search}%")
        )
    if blacklisted is not None:
        q = q.where(VerifiedMember.is_blacklisted == blacklisted)

    total = db.execute(select(func.count()).select_from(q.subquery())).scalar() or 0
    members = db.execute(
        q.order_by(VerifiedMember.verified_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).scalars().all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "members": [
            {
                "id": m.id,
                "discord_id": m.discord_id,
                "username": m.username,
                "avatar": m.avatar,
                "email": m.email,
                "ip_address": m.ip_address,
                "roles": m.roles or [],
                "verified_at": m.verified_at.isoformat() if m.verified_at else None,
                "last_seen": m.last_seen.isoformat() if m.last_seen else None,
                "is_blacklisted": m.is_blacklisted,
                "risk_score": m.risk_score,
            }
            for m in members
        ],
    }


@router.get("/verification/members/{member_id}")
def get_member(member_id: int, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    m = db.execute(
        select(VerifiedMember).where(
            VerifiedMember.id == member_id, VerifiedMember.guild_id == guild_id
        )
    ).scalars().first()
    if not m:
        raise HTTPException(404, "Member not found")
    return {
        "id": m.id,
        "discord_id": m.discord_id,
        "username": m.username,
        "discriminator": m.discriminator,
        "avatar": m.avatar,
        "email": m.email,
        "ip_address": m.ip_address,
        "roles": m.roles or [],
        "verified_at": m.verified_at.isoformat() if m.verified_at else None,
        "last_seen": m.last_seen.isoformat() if m.last_seen else None,
        "is_blacklisted": m.is_blacklisted,
        "risk_score": m.risk_score,
        "metadata": m.metadata_ or {},
    }


@router.post("/verification/members/{member_id}/blacklist")
def toggle_blacklist(
    member_id: int,
    body: dict | None = None,
    guild_id: str = Depends(get_guild_id),
    db: Session = Depends(get_db),
):
    m = db.execute(
        select(VerifiedMember).where(
            VerifiedMember.id == member_id, VerifiedMember.guild_id == guild_id
        )
    ).scalars().first()
    if not m:
        raise HTTPException(404, "Member not found")
    opts = body or {}
    m.is_blacklisted = opts.get("blacklisted", not m.is_blacklisted)
    db.commit()
    return {"ok": True, "is_blacklisted": m.is_blacklisted}


@router.delete("/verification/members/{member_id}")
def delete_member(member_id: int, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    m = db.execute(
        select(VerifiedMember).where(
            VerifiedMember.id == member_id, VerifiedMember.guild_id == guild_id
        )
    ).scalars().first()
    if not m:
        raise HTTPException(404, "Member not found")
    db.delete(m)
    db.commit()
    return {"ok": True}


# ── Stats ──

@router.get("/verification/stats")
def get_stats(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    total = db.execute(
        select(func.count()).select_from(VerifiedMember)
        .where(VerifiedMember.guild_id == guild_id)
    ).scalar() or 0

    today = db.execute(
        select(func.count()).select_from(VerifiedMember)
        .where(VerifiedMember.guild_id == guild_id, VerifiedMember.verified_at >= today_start)
    ).scalar() or 0

    this_week = db.execute(
        select(func.count()).select_from(VerifiedMember)
        .where(VerifiedMember.guild_id == guild_id, VerifiedMember.verified_at >= week_start)
    ).scalar() or 0

    blacklisted = db.execute(
        select(func.count()).select_from(VerifiedMember)
        .where(VerifiedMember.guild_id == guild_id, VerifiedMember.is_blacklisted == True)
    ).scalar() or 0

    pullable = db.execute(
        select(func.count()).select_from(VerifiedMember)
        .where(
            VerifiedMember.guild_id == guild_id,
            VerifiedMember.is_blacklisted == False,
            VerifiedMember.access_token.isnot(None),
        )
    ).scalar() or 0

    return {
        "total": total,
        "today": today,
        "this_week": this_week,
        "blacklisted": blacklisted,
        "pullable": pullable,
    }
