"""TempVoice API routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
import httpx
import os
import logging

from src.database.config import get_db
from src.api.deps import get_guild_id
from src.models.models import TempVoiceConfig, TempVoiceRoom, LogEntry, SystemConfig

logger = logging.getLogger(__name__)
router = APIRouter()

_DEFAULT_BUTTONS = [
    "name", "limit", "privacy", "trust", "untrust",
    "invite", "kick", "region", "block", "unblock",
    "claim", "transfer", "delete",
]

def _cfg_dict(cfg: TempVoiceConfig) -> dict:
    return {
        "enabled": cfg.enabled,
        "join_channel_id": cfg.join_channel_id,
        "category_id": cfg.category_id,
        "interface_channel_id": cfg.interface_channel_id,
        "voice_buttons": cfg.voice_buttons or _DEFAULT_BUTTONS,
        "default_user_limit": cfg.default_user_limit or 0,
        "default_bitrate": cfg.default_bitrate or 64000,
        "naming_format": cfg.naming_format or "{user}'s Channel",
        "default_visibility": cfg.default_visibility or "public",
        "auto_delete_seconds": cfg.auto_delete_seconds or 0,
        "inactive_cleanup_minutes": cfg.inactive_cleanup_minutes or 0,
        "max_rooms_per_user": cfg.max_rooms_per_user or 0,
        "max_rooms_per_guild": cfg.max_rooms_per_guild or 0,
        "rename_cooldown_seconds": cfg.rename_cooldown_seconds or 0,
        "allow_rename": cfg.allow_rename if cfg.allow_rename is not None else True,
        "allow_limit": cfg.allow_limit if cfg.allow_limit is not None else True,
        "allow_lock": cfg.allow_lock if cfg.allow_lock is not None else True,
        "allow_hide": cfg.allow_hide if cfg.allow_hide is not None else True,
        "allow_invite": cfg.allow_invite if cfg.allow_invite is not None else True,
        "allow_kick": cfg.allow_kick if cfg.allow_kick is not None else True,
        "allow_transfer": cfg.allow_transfer if cfg.allow_transfer is not None else True,
        "allow_claim": cfg.allow_claim if cfg.allow_claim is not None else True,
        "bypass_role_ids": cfg.bypass_role_ids or [],
        "blacklist_role_ids": cfg.blacklist_role_ids or [],
    }

def _default_cfg() -> dict:
    return {
        "enabled": False, "join_channel_id": None, "category_id": None,
        "interface_channel_id": None, "voice_buttons": _DEFAULT_BUTTONS,
        "default_user_limit": 0, "default_bitrate": 64000,
        "naming_format": "{user}'s Channel", "default_visibility": "public",
        "auto_delete_seconds": 0, "inactive_cleanup_minutes": 0,
        "max_rooms_per_user": 0, "max_rooms_per_guild": 0,
        "rename_cooldown_seconds": 0,
        "allow_rename": True, "allow_limit": True, "allow_lock": True,
        "allow_hide": True, "allow_invite": True, "allow_kick": True,
        "allow_transfer": True, "allow_claim": True,
        "bypass_role_ids": [], "blacklist_role_ids": [],
    }


# ── Config ────────────────────────────────────────────────

@router.get("/tempvoice/config")
def get_tempvoice(guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    cfg = db.execute(
        select(TempVoiceConfig).where(TempVoiceConfig.guild_id == guild_id)
    ).scalars().first()
    if not cfg:
        return _default_cfg()
    return _cfg_dict(cfg)


@router.post("/tempvoice/config")
def save_tempvoice(body: dict, guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    cfg = db.execute(
        select(TempVoiceConfig).where(TempVoiceConfig.guild_id == guild_id)
    ).scalars().first()
    if not cfg:
        cfg = TempVoiceConfig(guild_id=guild_id)
        db.add(cfg)
    for field in [
        "enabled", "join_channel_id", "category_id", "interface_channel_id",
        "default_user_limit", "default_bitrate", "naming_format", "default_visibility",
        "auto_delete_seconds", "inactive_cleanup_minutes", "max_rooms_per_user",
        "max_rooms_per_guild", "rename_cooldown_seconds",
        "allow_rename", "allow_limit", "allow_lock", "allow_hide",
        "allow_invite", "allow_kick", "allow_transfer", "allow_claim",
        "bypass_role_ids", "blacklist_role_ids", "voice_buttons",
    ]:
        if field in body:
            val = body[field]
            if field in ("join_channel_id", "category_id", "interface_channel_id") and not val:
                val = None
            setattr(cfg, field, val)
    db.commit()
    return {"ok": True}


# ── Rooms ─────────────────────────────────────────────────

@router.get("/tempvoice/rooms")
def get_rooms(guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    rooms = db.execute(
        select(TempVoiceRoom).where(TempVoiceRoom.guild_id == guild_id)
        .order_by(TempVoiceRoom.created_at.desc())
    ).scalars().all()
    return [
        {
            "id": r.id,
            "channel_id": r.channel_id,
            "owner_id": r.owner_id,
            "room_name": r.room_name,
            "peak_members": r.peak_members or 0,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rooms
    ]


async def _discord_delete_channel(bot_token: str, channel_id: str):
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"https://discord.com/api/v10/channels/{channel_id}",
            headers={"Authorization": f"Bot {bot_token}"},
        )
        resp.raise_for_status()


async def _discord_patch_channel(bot_token: str, channel_id: str, payload: dict):
    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"https://discord.com/api/v10/channels/{channel_id}",
            headers={"Authorization": f"Bot {bot_token}"},
            json=payload,
        )
        resp.raise_for_status()


def _get_bot_token(db) -> str:
    system = db.execute(select(SystemConfig).limit(1)).scalars().first()
    token = (system.bot_token if system else None) or os.environ.get("DISCORD_BOT_TOKEN", "")
    if not token:
        raise HTTPException(status_code=503, detail="Bot token not configured")
    return token


@router.post("/tempvoice/rooms/cleanup")
async def cleanup_rooms(guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    rooms = db.execute(
        select(TempVoiceRoom).where(TempVoiceRoom.guild_id == guild_id)
    ).scalars().all()
    token = _get_bot_token(db)
    deleted = 0
    for r in rooms:
        try:
            await _discord_delete_channel(token, r.channel_id)
            db.delete(r)
            deleted += 1
        except Exception as e:
            logger.warning(f"cleanup room {r.channel_id}: {e}")
    db.commit()
    return {"deleted": deleted}


@router.post("/tempvoice/rooms/{room_id}/delete")
async def delete_room(room_id: int, guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    room = db.get(TempVoiceRoom, room_id)
    if not room or room.guild_id != guild_id:
        raise HTTPException(status_code=404, detail="Room not found")
    token = _get_bot_token(db)
    try:
        await _discord_delete_channel(token, room.channel_id)
    except Exception as e:
        logger.warning(f"delete room channel {room.channel_id}: {e}")
    db.delete(room)
    db.commit()
    return {"ok": True}


@router.post("/tempvoice/rooms/{room_id}/rename")
async def rename_room(room_id: int, body: dict, guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    room = db.get(TempVoiceRoom, room_id)
    if not room or room.guild_id != guild_id:
        raise HTTPException(status_code=404, detail="Room not found")
    name = (body.get("name") or "").strip()[:100]
    if not name:
        raise HTTPException(status_code=400, detail="Name required")
    token = _get_bot_token(db)
    await _discord_patch_channel(token, room.channel_id, {"name": name})
    room.room_name = name
    db.commit()
    return {"ok": True}


@router.post("/tempvoice/rooms/{room_id}/transfer")
def transfer_room(room_id: int, body: dict, guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    room = db.get(TempVoiceRoom, room_id)
    if not room or room.guild_id != guild_id:
        raise HTTPException(status_code=404, detail="Room not found")
    new_owner = body.get("owner_id", "").strip()
    if not new_owner:
        raise HTTPException(status_code=400, detail="owner_id required")
    room.owner_id = new_owner
    db.commit()
    return {"ok": True}


# ── Stats ─────────────────────────────────────────────────

@router.get("/tempvoice/stats")
def get_stats(guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    active_rooms = db.execute(
        select(func.count()).select_from(TempVoiceRoom).where(TempVoiceRoom.guild_id == guild_id)
    ).scalar() or 0

    total_events = db.execute(
        select(func.count()).select_from(LogEntry).where(
            LogEntry.guild_id == guild_id,
            LogEntry.category == "voice",
        )
    ).scalar() or 0

    recent_logs = db.execute(
        select(LogEntry).where(
            LogEntry.guild_id == guild_id,
            LogEntry.category == "voice",
        ).order_by(LogEntry.id.desc()).limit(50)
    ).scalars().all()

    logs = [
        {
            "id": e.id,
            "event_type": e.event_type,
            "actor_name": e.actor_name,
            "actor_avatar": e.actor_avatar,
            "target_name": e.target_name,
            "description": e.description,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in recent_logs
    ]

    return {
        "active_rooms": active_rooms,
        "total_events": total_events,
        "recent_logs": logs,
    }
