"""Logging System routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from src.database.config import get_db
from src.models.models import LoggingConfig, SystemConfig

router = APIRouter()


class LoggingConfigUpdate(BaseModel):
    message_log_channel_id: Optional[str] = None
    voice_log_channel_id: Optional[str] = None
    mod_log_channel_id: Optional[str] = None
    member_log_channel_id: Optional[str] = None
    server_log_channel_id: Optional[str] = None
    ignored_channels: list[str] = []
    ignored_roles: list[str] = []


def _get_guild_id(db) -> str:
    cfg = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not cfg or not cfg.guild_id:
        raise HTTPException(400, "Guild ID chưa được cấu hình")
    return cfg.guild_id


@router.get("/logging/config")
def get_logging_config(db=Depends(get_db)):
    gid = _get_guild_id(db)
    cfg = db.execute(select(LoggingConfig).where(LoggingConfig.guild_id == gid)).scalars().first()
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
def update_logging_config(data: LoggingConfigUpdate, db=Depends(get_db)):
    gid = _get_guild_id(db)
    cfg = db.execute(select(LoggingConfig).where(LoggingConfig.guild_id == gid)).scalars().first()
    if not cfg:
        cfg = LoggingConfig(guild_id=gid)
        db.add(cfg)
    for k, v in data.model_dump().items():
        setattr(cfg, k, v)
    db.commit()
    return {"ok": True}
