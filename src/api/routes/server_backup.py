"""Server Backup & Restore routes — full Discord structure + bot config + verified members."""
import json
import logging
import sys
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select, func, delete
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.api.deps import get_guild_id
from src.models.models import (
    ServerBackup, BackupSchedule, VerifiedMember,
    # Bot config tables for comprehensive backup
    AutoModConfig, ReactionRole,
    CustomCommand, ScheduledMessage, StickyMessage, EmbedTemplate,
    ButtonRole, SelectMenuRole,
    LoggingConfig,
    ModerationConfig, FeatureToggle,
    Product, Coupon,
    InviteTracking, GiveawayBanned,
)

logger = logging.getLogger(__name__)
router = APIRouter()

EXCLUDE_FIELDS = {"id", "_sa_instance_state"}

# All bot config tables to backup
BOT_CONFIG_TABLES = [
    ("automod_config", AutoModConfig),    ("reaction_roles", ReactionRole),
    ("custom_commands", CustomCommand),
    ("scheduled_messages", ScheduledMessage),
    ("sticky_messages", StickyMessage),
    ("embed_templates", EmbedTemplate),
    ("button_roles", ButtonRole),
    ("select_menu_roles", SelectMenuRole),
    ("logging_config", LoggingConfig),
    ("moderation_config", ModerationConfig),
    ("feature_toggles", FeatureToggle),
    ("products", Product),
    ("coupons", Coupon),
]


def _row_to_dict(row) -> dict:
    d = {}
    for c in row.__table__.columns:
        if c.name in EXCLUDE_FIELDS:
            continue
        v = getattr(row, c.name)
        if isinstance(v, datetime):
            v = v.isoformat()
        d[c.name] = v
    return d


def _backup_bot_config(db: Session, guild_id: str) -> dict:
    """Backup all bot config tables for a guild."""
    result = {}
    config_count = 0
    for table_name, model in BOT_CONFIG_TABLES:
        try:
            if hasattr(model, "guild_id"):
                rows = db.execute(
                    select(model).where(model.guild_id == guild_id)
                ).scalars().all()
            else:
                rows = db.execute(select(model)).scalars().all()
            data = [_row_to_dict(r) for r in rows]
            result[table_name] = data
            config_count += len(data)
        except Exception as e:
            logger.warning(f"Backup skip {table_name}: {e}")
            result[table_name] = []
    return result, config_count


def _backup_verified_members(db: Session, guild_id: str) -> list:
    """Backup verified members for a guild."""
    members = db.execute(
        select(VerifiedMember).where(VerifiedMember.guild_id == guild_id)
    ).scalars().all()
    return [_row_to_dict(m) for m in members]


# ── List backups ──
@router.get("/server-backup")
def list_backups(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    backups = db.execute(
        select(ServerBackup)
        .where(ServerBackup.guild_id == guild_id)
        .order_by(ServerBackup.created_at.desc())
    ).scalars().all()
    return [
        {
            "id": b.id,
            "backup_type": b.backup_type,
            "status": b.status,
            "channel_count": b.channel_count,
            "role_count": b.role_count,
            "member_count": b.member_count,
            "config_count": b.config_count,
            "message_count": b.message_count,
            "size_bytes": b.size_bytes,
            "error": b.error,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }
        for b in backups
    ]


# ── Create backup ──
@router.post("/server-backup")
def create_backup(
    body: dict | None = None,
    guild_id: str = Depends(get_guild_id),
    db: Session = Depends(get_db),
):
    """Create a comprehensive backup.
    Body options:
      include_bot_config: bool (default true)
      include_verified_members: bool (default true)
      include_messages: bool (default true)
      message_limit: int (default 100)
    Note: Discord structure backup happens via bot cog (needs bot token).
    This endpoint backs up bot config + verified members from DB.
    Discord structure is added by the bot cog when triggered.
    """
    opts = body or {}
    include_bot_config = opts.get("include_bot_config", True)
    include_members = opts.get("include_verified_members", True)

    data = {"discord": None, "bot_config": None, "verified_members": None}
    config_count = 0
    member_count = 0

    if include_bot_config:
        data["bot_config"], config_count = _backup_bot_config(db, guild_id)

    if include_members:
        members = _backup_verified_members(db, guild_id)
        data["verified_members"] = members
        member_count = len(members)

    size_bytes = len(json.dumps(data, default=str).encode())

    backup = ServerBackup(
        guild_id=guild_id,
        backup_type="manual",
        status="completed",  # Discord part pending if bot adds it
        data=data,
        config_count=config_count,
        member_count=member_count,
        size_bytes=size_bytes,
    )
    db.add(backup)
    db.commit()
    db.refresh(backup)

    return {
        "id": backup.id,
        "status": backup.status,
        "config_count": config_count,
        "member_count": member_count,
        "size_bytes": size_bytes,
    }


# ── Get backup detail ──
@router.get("/server-backup/{backup_id}")
def get_backup(backup_id: int, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    b = db.execute(
        select(ServerBackup)
        .where(ServerBackup.id == backup_id, ServerBackup.guild_id == guild_id)
    ).scalars().first()
    if not b:
        raise HTTPException(404, "Backup not found")
    return {
        "id": b.id,
        "backup_type": b.backup_type,
        "status": b.status,
        "data": b.data,
        "channel_count": b.channel_count,
        "role_count": b.role_count,
        "member_count": b.member_count,
        "config_count": b.config_count,
        "message_count": b.message_count,
        "size_bytes": b.size_bytes,
        "error": b.error,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


# ── Download backup as JSON ──
@router.get("/server-backup/{backup_id}/download")
def download_backup(backup_id: int, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    b = db.execute(
        select(ServerBackup)
        .where(ServerBackup.id == backup_id, ServerBackup.guild_id == guild_id)
    ).scalars().first()
    if not b:
        raise HTTPException(404, "Backup not found")
    from fastapi.responses import JSONResponse
    return JSONResponse(
        content=b.data,
        headers={"Content-Disposition": f'attachment; filename="backup_{b.id}_{b.created_at.strftime("%Y%m%d")}.json"'},
    )


# ── Delete backup ──
@router.delete("/server-backup/{backup_id}")
def delete_backup(backup_id: int, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    b = db.execute(
        select(ServerBackup)
        .where(ServerBackup.id == backup_id, ServerBackup.guild_id == guild_id)
    ).scalars().first()
    if not b:
        raise HTTPException(404, "Backup not found")
    db.delete(b)
    db.commit()
    return {"ok": True}


# ── Restore from backup ──
@router.post("/server-backup/{backup_id}/restore")
def restore_backup(
    backup_id: int,
    body: dict | None = None,
    guild_id: str = Depends(get_guild_id),
    db: Session = Depends(get_db),
):
    """Restore from backup.
    Body options:
      restore_bot_config: bool (default true)
      restore_verified_members: bool (default true)
      restore_discord: bool (default false) — requires bot, handled by cog
    """
    b = db.execute(
        select(ServerBackup)
        .where(ServerBackup.id == backup_id, ServerBackup.guild_id == guild_id)
    ).scalars().first()
    if not b:
        raise HTTPException(404, "Backup not found")

    opts = body or {}
    restored = {}
    errors = {}

    # Restore bot config
    if opts.get("restore_bot_config", True) and b.data and b.data.get("bot_config"):
        for table_name, model in BOT_CONFIG_TABLES:
            if table_name not in b.data["bot_config"]:
                continue
            rows_data = b.data["bot_config"][table_name]
            if not isinstance(rows_data, list):
                continue
            try:
                # Delete existing rows for this guild
                if hasattr(model, "guild_id"):
                    db.execute(
                        delete(model).where(model.guild_id == guild_id)
                    )
                else:
                    db.execute(delete(model))
                db.flush()

                count = 0
                for row_dict in rows_data:
                    valid_cols = {c.name for c in model.__table__.columns} - {"id"}
                    clean = {}
                    for k, v in row_dict.items():
                        if k in valid_cols:
                            col = model.__table__.columns.get(k)
                            if col is not None and hasattr(col.type, "python_type"):
                                try:
                                    if col.type.python_type == datetime and isinstance(v, str):
                                        v = datetime.fromisoformat(v)
                                except Exception:
                                    pass
                            clean[k] = v
                    obj = model(**clean)
                    db.add(obj)
                    count += 1
                restored[table_name] = count
            except Exception as e:
                logger.error(f"Restore error {table_name}: {e}")
                errors[table_name] = str(e)
                db.rollback()

    # Restore verified members
    if opts.get("restore_verified_members", True) and b.data and b.data.get("verified_members"):
        try:
            members_data = b.data["verified_members"]
            db.execute(delete(VerifiedMember).where(VerifiedMember.guild_id == guild_id))
            db.flush()
            count = 0
            for m in members_data:
                valid_cols = {c.name for c in VerifiedMember.__table__.columns} - {"id"}
                clean = {k: v for k, v in m.items() if k in valid_cols}
                obj = VerifiedMember(**clean)
                db.add(obj)
                count += 1
            restored["verified_members"] = count
        except Exception as e:
            logger.error(f"Restore verified members error: {e}")
            errors["verified_members"] = str(e)

    db.commit()
    return {"ok": True, "restored": restored, "errors": errors}


# ── Schedule config ──
@router.get("/server-backup/schedule")
def get_schedule(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    s = db.execute(
        select(BackupSchedule).where(BackupSchedule.guild_id == guild_id)
    ).scalars().first()
    if not s:
        return {
            "enabled": False, "interval_hours": 24, "max_backups": 5,
            "include_messages": True, "message_limit": 100,
            "include_bot_config": True, "include_verified_members": True,
            "last_backup_at": None, "next_backup_at": None,
        }
    return {
        "enabled": s.enabled,
        "interval_hours": s.interval_hours,
        "max_backups": s.max_backups,
        "include_messages": s.include_messages,
        "message_limit": s.message_limit,
        "include_bot_config": s.include_bot_config,
        "include_verified_members": s.include_verified_members,
        "last_backup_at": s.last_backup_at.isoformat() if s.last_backup_at else None,
        "next_backup_at": s.next_backup_at.isoformat() if s.next_backup_at else None,
    }


@router.put("/server-backup/schedule")
def update_schedule(body: dict, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    s = db.execute(
        select(BackupSchedule).where(BackupSchedule.guild_id == guild_id)
    ).scalars().first()
    if not s:
        s = BackupSchedule(guild_id=guild_id)
        db.add(s)

    for field in ["enabled", "interval_hours", "max_backups", "include_messages",
                  "message_limit", "include_bot_config", "include_verified_members"]:
        if field in body:
            setattr(s, field, body[field])

    # Calculate next backup time
    if s.enabled:
        from datetime import timedelta
        s.next_backup_at = datetime.utcnow() + timedelta(hours=s.interval_hours)

    db.commit()
    return {"ok": True}
