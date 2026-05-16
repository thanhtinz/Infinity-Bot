"""Logging System routes."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from pydantic import BaseModel
from typing import Optional

from src.database.config import get_db
from src.api.deps import get_guild_id
from src.models.models import LoggingConfig, LogEntry

router = APIRouter()


class LoggingConfigUpdate(BaseModel):
    message_log_channel_id: Optional[str] = None
    voice_log_channel_id: Optional[str] = None
    mod_log_channel_id: Optional[str] = None
    member_log_channel_id: Optional[str] = None
    server_log_channel_id: Optional[str] = None
    ignored_channels: list[str] = []
    ignored_roles: list[str] = []


@router.get("/logging/config")
def get_logging_config(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cfg = db.execute(select(LoggingConfig).where(LoggingConfig.guild_id == guild_id)).scalars().first()
    if not cfg:
        return {
            "message_log_channel_id": None, "voice_log_channel_id": None,
            "mod_log_channel_id": None, "member_log_channel_id": None,
            "server_log_channel_id": None, "ignored_channels": [], "ignored_roles": [],
        }
    return {
        "message_log_channel_id": cfg.message_log_channel_id,
        "voice_log_channel_id": cfg.voice_log_channel_id,
        "mod_log_channel_id": cfg.mod_log_channel_id,
        "member_log_channel_id": cfg.member_log_channel_id,
        "server_log_channel_id": cfg.server_log_channel_id,
        "ignored_channels": cfg.ignored_channels or [],
        "ignored_roles": cfg.ignored_roles or [],
    }


@router.put("/logging/config")
def update_logging_config(data: LoggingConfigUpdate, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cfg = db.execute(select(LoggingConfig).where(LoggingConfig.guild_id == guild_id)).scalars().first()
    if not cfg:
        cfg = LoggingConfig(guild_id=guild_id)
        db.add(cfg)
    for k, v in data.model_dump().items():
        setattr(cfg, k, v)
    db.commit()
    return {"ok": True}


# ── Log Entries (viewer) ──────────────────────────────────────────────────────

@router.get("/logging/entries")
def get_log_entries(
    category: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    q = select(LogEntry).where(LogEntry.guild_id == guild_id)

    if category:
        q = q.where(LogEntry.category == category)
    if event_type:
        q = q.where(LogEntry.event_type == event_type)
    if search:
        q = q.where(
            LogEntry.description.ilike(f"%{search}%")
            | LogEntry.actor_name.ilike(f"%{search}%")
            | LogEntry.target_name.ilike(f"%{search}%")
        )

    # Count
    count_q = select(func.count()).select_from(q.subquery())
    total = db.execute(count_q).scalar() or 0

    # Fetch
    rows = db.execute(
        q.order_by(desc(LogEntry.created_at))
        .offset((page - 1) * limit)
        .limit(limit)
    ).scalars().all()

    return {
        "entries": [
            {
                "id": r.id,
                "event_type": r.event_type,
                "category": r.category,
                "actor_id": r.actor_id,
                "actor_name": r.actor_name,
                "actor_avatar": r.actor_avatar,
                "target_id": r.target_id,
                "target_name": r.target_name,
                "description": r.description,
                "details": r.details,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, (total + limit - 1) // limit),
    }


@router.get("/logging/stats")
def get_log_stats(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rows = db.execute(
        select(LogEntry.category, func.count())
        .where(LogEntry.guild_id == guild_id)
        .group_by(LogEntry.category)
    ).all()
    stats = {r[0]: r[1] for r in rows}
    total = sum(stats.values())
    return {"total": total, "by_category": stats}
