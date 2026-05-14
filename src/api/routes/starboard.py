"""Starboard config routes."""
from fastapi import APIRouter, Depends
from sqlalchemy import select

from src.database.config import get_db
from src.models.models import StarboardConfig, SystemConfig

router = APIRouter()


def _get_guild_id(db) -> str:
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    return config.guild_id if config else ""


@router.get("/starboard/config")
def get_starboard_config(db=Depends(get_db)):
    guild_id = _get_guild_id(db)
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
def update_starboard_config(body: dict, db=Depends(get_db)):
    guild_id = _get_guild_id(db)
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
