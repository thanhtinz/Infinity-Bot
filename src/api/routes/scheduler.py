"""Scheduled Messages CRUD routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from datetime import datetime

from src.database.config import get_db
from src.models.models import ScheduledMessage, SystemConfig

router = APIRouter()


def _get_guild_id(db) -> str:
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    return config.guild_id if config else ""


@router.get("/scheduled-messages")
def list_scheduled_messages(db=Depends(get_db)):
    guild_id = _get_guild_id(db)
    msgs = db.execute(
        select(ScheduledMessage).where(ScheduledMessage.guild_id == guild_id)
        .order_by(ScheduledMessage.send_at.desc())
    ).scalars().all()
    return [
        {
            "id": m.id,
            "channel_id": m.channel_id,
            "content": m.content,
            "embed_data": m.embed_data,
            "send_at": m.send_at.isoformat() if m.send_at else None,
            "repeat_type": m.repeat_type,
            "sent": m.sent,
            "last_sent_at": m.last_sent_at.isoformat() if m.last_sent_at else None,
            "enabled": m.enabled,
            "created_by": m.created_by,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in msgs
    ]


@router.post("/scheduled-messages")
def create_scheduled_message(body: dict, db=Depends(get_db)):
    guild_id = _get_guild_id(db)
    send_at_str = body.get("send_at")
    if not send_at_str:
        raise HTTPException(status_code=400, detail="send_at required")

    try:
        send_at = datetime.fromisoformat(send_at_str.replace("Z", "+00:00")).replace(tzinfo=None)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid send_at format")

    msg = ScheduledMessage(
        guild_id=guild_id,
        channel_id=body.get("channel_id", ""),
        content=body.get("content"),
        embed_data=body.get("embed_data"),
        send_at=send_at,
        repeat_type=body.get("repeat_type", "none"),
        enabled=body.get("enabled", True),
        created_by=body.get("created_by"),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {"ok": True, "id": msg.id}


@router.put("/scheduled-messages/{msg_id}")
def update_scheduled_message(msg_id: int, body: dict, db=Depends(get_db)):
    msg = db.get(ScheduledMessage, msg_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    for field in ["channel_id", "content", "embed_data", "repeat_type", "enabled"]:
        if field in body:
            setattr(msg, field, body[field])

    if "send_at" in body:
        try:
            msg.send_at = datetime.fromisoformat(body["send_at"].replace("Z", "+00:00")).replace(tzinfo=None)
            msg.sent = False  # Reset sent flag when rescheduling
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="Invalid send_at format")

    db.commit()
    return {"ok": True}


@router.delete("/scheduled-messages/{msg_id}")
def delete_scheduled_message(msg_id: int, db=Depends(get_db)):
    msg = db.get(ScheduledMessage, msg_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    db.delete(msg)
    db.commit()
    return {"ok": True}
