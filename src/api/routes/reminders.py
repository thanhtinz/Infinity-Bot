"""Reminders & Todo API routes."""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.models.models import Reminder, TodoItem
from src.api.deps import get_guild_id, require_staff_perm

router = APIRouter(prefix="/reminders", tags=["reminders"], dependencies=[Depends(require_staff_perm("can_reminders"))])


@router.get("")
def list_reminders(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Reminder).where(Reminder.guild_id == guild_id, Reminder.completed == False)
        .order_by(Reminder.remind_at.asc()).limit(100)
    ).scalars().all()
    return [
        {"id": r.id, "user_id": r.user_id, "channel_id": r.channel_id,
         "message": r.message, "remind_at": r.remind_at.isoformat() if r.remind_at else None,
         "recurring": r.recurring, "created_at": r.created_at.isoformat() if r.created_at else None}
        for r in rows
    ]


@router.get("/stats")
def reminder_stats(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    active = db.execute(select(func.count(Reminder.id)).where(Reminder.guild_id == guild_id, Reminder.completed == False)).scalar() or 0
    completed = db.execute(select(func.count(Reminder.id)).where(Reminder.guild_id == guild_id, Reminder.completed == True)).scalar() or 0
    todos = db.execute(select(func.count(TodoItem.id)).where(TodoItem.guild_id == guild_id, TodoItem.done == False)).scalar() or 0
    return {"active_reminders": active, "completed_reminders": completed, "active_todos": todos}


@router.delete("/{rid}")
def delete_reminder(rid: int, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    r = db.execute(select(Reminder).where(Reminder.id == rid, Reminder.guild_id == guild_id)).scalars().first()
    if r:
        db.delete(r)
        db.commit()
    return {"status": "deleted"}
