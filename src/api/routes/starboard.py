"""Starboard config routes."""
from fastapi import APIRouter, Depends
from sqlalchemy import select

from src.database.config import get_db
from src.api.deps import get_guild_id
from src.models.models import StarboardConfig

router = APIRouter()


@router.get("/starboard/config")
def get_starboard_config(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cfg = db.execute(
        select(StarboardConfig).where(StarboardConfig.guild_id == guild_id)
    ).scalars().first()
    if not cfg:
        return {
            "channel_id": None, "emoji": "⭐", "threshold": 3,
            "self_star": False, "ignored_channels": [], "enabled": True,
        }
    return {
        "id": cfg.id,
        "channel_id": cfg.channel_id,
        "emoji": cfg.emoji,
        "threshold": cfg.threshold,
        "self_star": cfg.self_star,
        "ignored_channels": cfg.ignored_channels or [],
        "enabled": cfg.enabled,
    }


@router.put("/starboard/config")
def update_starboard_config(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cfg = db.execute(
        select(StarboardConfig).where(StarboardConfig.guild_id == guild_id)
    ).scalars().first()
    if not cfg:
        cfg = StarboardConfig(guild_id=guild_id)
        db.add(cfg)

    for field in ["channel_id", "emoji", "threshold", "self_star", "ignored_channels", "enabled"]:
        if field in body:
            setattr(cfg, field, body[field])
    db.commit()
    return {"ok": True}
