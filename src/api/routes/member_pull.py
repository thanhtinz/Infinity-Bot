"""Member Pull routes — start/stop pulling, progress, history."""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.api.deps import get_guild_id
from src.models.models import MemberPull

logger = logging.getLogger(__name__)
router = APIRouter()


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

    opts = body or {}
    pull = MemberPull(
        guild_id=guild_id,
        status="pending",
        restore_roles=opts.get("restore_roles", True),
        join_delay_seconds=max(1, opts.get("join_delay_seconds", 1)),
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
