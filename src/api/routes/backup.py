"""Backup & Restore routes."""
import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select

from src.database.config import get_db
from src.models.models import (
    SystemConfig, AutoModConfig, StarboardConfig, ReactionRole,
    CustomCommand, ScheduledMessage, StickyMessage, EmbedTemplate,
    WelcomeConfig, AutoRoleConfig, ButtonRole, SelectMenuRole,
    LoggingConfig, TicketConfig, TicketPanel,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Tables to backup (model, key field for filtering)
BACKUP_TABLES = [
    ("automod_config", AutoModConfig),
    ("starboard_config", StarboardConfig),
    ("reaction_roles", ReactionRole),
    ("custom_commands", CustomCommand),
    ("scheduled_messages", ScheduledMessage),
    ("sticky_messages", StickyMessage),
    ("embed_templates", EmbedTemplate),
    ("welcome_config", WelcomeConfig),
    ("auto_role_config", AutoRoleConfig),
    ("button_roles", ButtonRole),
    ("select_menu_roles", SelectMenuRole),
    ("logging_config", LoggingConfig),
    ("ticket_configs", TicketConfig),
    ("ticket_panels", TicketPanel),
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
def create_backup(db=Depends(get_db)):
    """Export all config tables to JSON."""
    backup = {"version": 1, "created_at": datetime.utcnow().isoformat(), "data": {}}

    for table_name, model in BACKUP_TABLES:
        try:
            rows = db.execute(select(model)).scalars().all()
            backup["data"][table_name] = [_row_to_dict(r) for r in rows]
        except Exception as e:
            logger.warning(f"Backup skip {table_name}: {e}")
            backup["data"][table_name] = []

    return JSONResponse(
        content=json.loads(json.dumps(backup, default=_serialize)),
        headers={
            "Content-Disposition": f'attachment; filename="backup_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.json"'
        },
    )


@router.post("/restore")
def restore_backup(body: dict, db=Depends(get_db)):
    """Restore configs from backup JSON."""
    data = body.get("data")
    if not data or not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Invalid backup format")

    restored = {}
    errors = {}

    for table_name, model in BACKUP_TABLES:
        if table_name not in data:
            continue
        rows_data = data[table_name]
        if not isinstance(rows_data, list):
            continue

        try:
            # Delete existing rows
            existing = db.execute(select(model)).scalars().all()
            for row in existing:
                db.delete(row)
            db.flush()

            # Insert new rows
            count = 0
            for row_dict in rows_data:
                # Clean the dict — remove any fields not in the model
                valid_cols = {c.name for c in model.__table__.columns} - {"id"}
                clean = {}
                for k, v in row_dict.items():
                    if k in valid_cols:
                        # Convert datetime strings back
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
            # Re-attempt remaining tables
            continue

    db.commit()
    return {"ok": True, "restored": restored, "errors": errors}


@router.get("/backup/preview")
def preview_backup(db=Depends(get_db)):
    """Quick summary of what would be backed up."""
    summary = {}
    for table_name, model in BACKUP_TABLES:
        try:
            from sqlalchemy import func
            count = db.execute(select(func.count()).select_from(model)).scalar() or 0
            summary[table_name] = count
        except Exception:
            summary[table_name] = 0
    return summary
