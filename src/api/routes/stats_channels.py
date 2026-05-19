"""Stats Channels API routes."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.models.models import StatsChannel
from src.api.deps import get_guild_id, require_staff_perm

router = APIRouter(prefix="/stats-channels", tags=["stats_channels"], dependencies=[Depends(require_staff_perm("can_utilities"))])

STAT_TYPES = ["members", "online", "boosts", "roles", "channels", "avg_rating"]


class StatsCreate(BaseModel):
    channel_id: str
    stat_type: str
    format_template: str = "{value}"


class StatsUpdate(BaseModel):
    stat_type: str | None = None
    format_template: str | None = None


@router.get("")
def list_stats_channels(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    rows = db.execute(
        select(StatsChannel).where(StatsChannel.guild_id == guild_id).order_by(StatsChannel.created_at.desc())
    ).scalars().all()
    return [
        {"id": s.id, "channel_id": s.channel_id, "stat_type": s.stat_type,
         "format_template": s.format_template,
         "created_at": s.created_at.isoformat() if s.created_at else None}
        for s in rows
    ]


@router.get("/types")
def get_stat_types():
    return STAT_TYPES


@router.post("")
def create_stats_channel(body: StatsCreate, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    if body.stat_type not in STAT_TYPES:
        return {"error": f"Invalid stat_type. Must be one of: {STAT_TYPES}"}
    s = StatsChannel(guild_id=guild_id, **body.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id, "status": "created"}


@router.patch("/{sid}")
def update_stats_channel(sid: int, body: StatsUpdate, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    s = db.execute(select(StatsChannel).where(StatsChannel.id == sid, StatsChannel.guild_id == guild_id)).scalars().first()
    if not s:
        return {"error": "not found"}
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    db.commit()
    return {"status": "updated"}


@router.delete("/{sid}")
def delete_stats_channel(sid: int, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    s = db.execute(select(StatsChannel).where(StatsChannel.id == sid, StatsChannel.guild_id == guild_id)).scalars().first()
    if s:
        db.delete(s)
        db.commit()
    return {"status": "deleted"}
