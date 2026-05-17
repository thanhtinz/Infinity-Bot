"""Backup & Restore routes — scoped per guild."""
import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select

from src.database.config import get_db
from src.api.deps import get_guild_id
from src.models.models import (
    SystemConfig, AutoModConfig, StarboardConfig, ReactionRole,
    CustomCommand, ScheduledMessage, StickyMessage, EmbedTemplate,
    WelcomeConfig, AutoRoleConfig, ButtonRole, SelectMenuRole,
    LoggingConfig, TicketConfig, TicketPanel,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Tables to backup (table_name, model, has_guild_id)
BACKUP_TABLES = [
    ("automod_config", AutoModConfig, True),
    ("starboard_config", StarboardConfig, True),
    ("reaction_roles", ReactionRole, True),
    ("custom_commands", CustomCommand, True),
    ("scheduled_messages", ScheduledMessage, True),
    ("sticky_messages", StickyMessage, True),
    ("embed_templates", EmbedTemplate, True),
    ("welcome_config", WelcomeConfig, True),
    ("auto_role_config", AutoRoleConfig, True),
    ("button_roles", ButtonRole, True),
    ("select_menu_roles", SelectMenuRole, True),
    ("logging_config", LoggingConfig, True),
    ("ticket_configs", TicketConfig, True),
    ("ticket_panels", TicketPanel, True),
]

# Fields to exclude from export (internal IDs, etc.)
EXCLUDE_FIELDS = {"id", "_sa_instance_state"}


def _row_to_dict(row) -> dict:
    return {
        c.name: getattr(row, c.name)
        for c in row.__table__.columns
        if c.name not in EXCLUDE_FIELDS
    }


def _serialize(obj):
    """JSON serializer for datetime etc."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    return str(obj)


@router.get("/backup")
def create_backup(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Export all config tables to JSON — scoped to guild."""
    backup = {"version": 1, "guild_id": guild_id, "created_at": datetime.utcnow().isoformat(), "data": {}}

    for table_name, model, has_gid in BACKUP_TABLES:
        try:
            q = select(model)
            if has_gid and hasattr(model, "guild_id"):
                q = q.where(model.guild_id == guild_id)
            rows = db.execute(q).scalars().all()
            backup["data"][table_name] = [_row_to_dict(r) for r in rows]
        except Exception as e:
            logger.warning(f"Backup skip {table_name}: {e}")
            backup["data"][table_name] = []

    return JSONResponse(
        content=json.loads(json.dumps(backup, default=_serialize)),
        headers={
            "Content-Disposition": f'attachment; filename="backup_{guild_id}_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.json"'
        },
    )


@router.post("/restore")
def restore_backup(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Restore configs from backup JSON — scoped to guild."""
    data = body.get("data")
    if not data or not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Invalid backup format")

    restored = {}
    errors = {}

    for table_name, model, has_gid in BACKUP_TABLES:
        if table_name not in data:
            continue
        rows_data = data[table_name]
        if not isinstance(rows_data, list):
            continue

        try:
            # Delete existing rows for THIS guild only
            q = select(model)
            if has_gid and hasattr(model, "guild_id"):
                q = q.where(model.guild_id == guild_id)
            existing = db.execute(q).scalars().all()
            for row in existing:
                db.delete(row)
            db.flush()

            # Insert new rows
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

                # Ensure guild_id is set correctly
                if has_gid and "guild_id" in valid_cols:
                    clean["guild_id"] = guild_id

                obj = model(**clean)
                db.add(obj)
                count += 1

            restored[table_name] = count
        except Exception as e:
            logger.error(f"Restore error {table_name}: {e}")
            errors[table_name] = str(e)
            db.rollback()
            continue

    db.commit()
    return {"ok": True, "restored": restored, "errors": errors}


@router.get("/backup/preview")
def preview_backup(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Quick summary of what would be backed up — scoped to guild."""
    from sqlalchemy import func
    summary = {}
    for table_name, model, has_gid in BACKUP_TABLES:
        try:
            q = select(func.count()).select_from(model)
            if has_gid and hasattr(model, "guild_id"):
                q = q.where(model.guild_id == guild_id)
            count = db.execute(q).scalar() or 0
            summary[table_name] = count
        except Exception:
            summary[table_name] = 0
    return summary
