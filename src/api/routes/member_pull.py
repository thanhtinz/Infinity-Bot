"""Member Pull routes — start/stop pulling, progress, history."""
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.api.deps import get_guild_id
from src.models.models import MemberPull, VerificationConfig, VerifiedMember

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/member-pull/source-guilds")
def get_source_guilds(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    """Return distinct guilds that have pullable members (valid token, not blacklisted)."""
    now = datetime.utcnow()
    rows = db.execute(
        select(
            VerifiedMember.guild_id,
            VerifiedMember.source_guild_name,
            func.count(VerifiedMember.id).label("member_count"),
        )
        .where(
            VerifiedMember.is_blacklisted == False,
            VerifiedMember.access_token.isnot(None),
            # Token not expired
            (VerifiedMember.token_expires_at.is_(None)) |
            (VerifiedMember.token_expires_at > now),
        )
        .group_by(VerifiedMember.guild_id, VerifiedMember.source_guild_name)
        .order_by(func.count(VerifiedMember.id).desc())
    ).all()
    return [
        {
            "guild_id": r.guild_id,
            "name": r.source_guild_name or r.guild_id,
            "member_count": r.member_count,
        }
        for r in rows
    ]


@router.post("/member-pull/start")
def start_pull(
    body: dict | None = None,
    guild_id: str = Depends(get_guild_id),
    db: Session = Depends(get_db),
):
    """Start a member pull operation. Actual pulling done by bot cog."""
    # Check for active pull
    active = db.execute(
        select(MemberPull).where(
            MemberPull.guild_id == guild_id,
            MemberPull.status.in_(["pending", "in_progress"]),
        )
    ).scalars().first()
    if active:
        raise HTTPException(400, "A pull is already in progress")

    # Check cooldown
    vcfg = db.execute(
        select(VerificationConfig).where(VerificationConfig.guild_id == guild_id)
    ).scalars().first()
    cooldown_hours = getattr(vcfg, "pull_cooldown_hours", 10) if vcfg else 10
    if cooldown_hours and cooldown_hours > 0:
        last_pull = db.execute(
            select(MemberPull).where(
                MemberPull.guild_id == guild_id,
                MemberPull.status == "completed",
            ).order_by(MemberPull.id.desc()).limit(1)
        ).scalars().first()
        if last_pull and last_pull.completed_at:
            cooldown_end = last_pull.completed_at + timedelta(hours=cooldown_hours)
            if datetime.utcnow() < cooldown_end:
                remaining = (cooldown_end - datetime.utcnow()).total_seconds() / 3600
                raise HTTPException(400, f"Pull cooldown active. Try again in {remaining:.1f} hours.")

    opts = body or {}
    target_guild_id = opts.get("target_guild_id") or guild_id

    # Check pullable members exist in source guild
    pullable_count = db.execute(
        select(func.count(VerifiedMember.id)).where(
            VerifiedMember.guild_id == target_guild_id,
            VerifiedMember.is_blacklisted == False,
            VerifiedMember.access_token.isnot(None),
            (VerifiedMember.token_expires_at.is_(None)) |
            (VerifiedMember.token_expires_at > datetime.utcnow()),
        )
    ).scalar() or 0

    if pullable_count == 0:
        raise HTTPException(400, "No pullable members found in the selected server. Members must have verified via OAuth2 with a valid token.")

    pull = MemberPull(
        guild_id=guild_id,
        status="pending",
        restore_roles=opts.get("restore_roles", True),
        join_delay_seconds=max(0, opts.get("join_delay_seconds", 0)),
        target_guild_id=target_guild_id if target_guild_id != guild_id else None,
        role_ids=opts.get("role_ids") or [],
    )
    db.add(pull)
    db.commit()
    db.refresh(pull)

    return {"id": pull.id, "status": pull.status}


@router.get("/member-pull/status")
def get_pull_status(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    """Get status of the active pull."""
    pull = db.execute(
        select(MemberPull)
        .where(MemberPull.guild_id == guild_id)
        .order_by(MemberPull.id.desc())
        .limit(1)
    ).scalars().first()
    if not pull:
        return {"active": False}
    return {
        "active": pull.status in ("pending", "in_progress"),
        "id": pull.id,
        "status": pull.status,
        "total_members": pull.total_members,
        "pulled_members": pull.pulled_members,
        "failed_members": pull.failed_members,
        "restore_roles": pull.restore_roles,
        "started_at": pull.started_at.isoformat() if pull.started_at else None,
        "completed_at": pull.completed_at.isoformat() if pull.completed_at else None,
        "log": (pull.log or [])[-50:],  # last 50 entries
    }


@router.post("/member-pull/stop")
def stop_pull(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    """Stop the active pull."""
    pull = db.execute(
        select(MemberPull).where(
            MemberPull.guild_id == guild_id,
            MemberPull.status.in_(["pending", "in_progress"]),
        )
    ).scalars().first()
    if not pull:
        raise HTTPException(404, "No active pull")
    pull.status = "failed"
    pull.error = "Stopped by user"
    pull.completed_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.get("/member-pull/history")
def pull_history(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    pulls = db.execute(
        select(MemberPull)
        .where(MemberPull.guild_id == guild_id)
        .order_by(MemberPull.id.desc())
        .limit(20)
    ).scalars().all()
    return [
        {
            "id": p.id,
            "status": p.status,
            "total_members": p.total_members,
            "pulled_members": p.pulled_members,
            "failed_members": p.failed_members,
            "restore_roles": p.restore_roles,
            "started_at": p.started_at.isoformat() if p.started_at else None,
            "completed_at": p.completed_at.isoformat() if p.completed_at else None,
            "error": p.error,
        }
        for p in pulls
    ]
