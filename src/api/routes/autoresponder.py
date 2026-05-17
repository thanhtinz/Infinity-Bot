"""Auto Responder CRUD routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from src.database.config import get_db
from src.api.deps import get_guild_id
from src.models.models import AutoResponder

router = APIRouter()


@router.get("/auto-responders")
def list_auto_responders(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rules = db.execute(
        select(AutoResponder).where(AutoResponder.guild_id == guild_id)
        .order_by(AutoResponder.priority.desc(), AutoResponder.created_at.desc())
    ).scalars().all()
    return [_serialize(r) for r in rules]


@router.post("/auto-responders")
def create_auto_responder(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    if not body.get("name") or not body.get("trigger_text"):
        raise HTTPException(400, "name and trigger_text are required")
    rule = AutoResponder(
        guild_id=guild_id,
        name=body["name"],
        trigger_type=body.get("trigger_type", "contains"),
        trigger_text=body["trigger_text"],
        ignore_case=body.get("ignore_case", True),
        response_type=body.get("response_type", "text"),
        response_text=body.get("response_text"),
        response_embed=body.get("response_embed"),
        reaction_emojis=body.get("reaction_emojis", []),
        reply_to_message=body.get("reply_to_message", True),
        delete_trigger=body.get("delete_trigger", False),
        send_dm=body.get("send_dm", False),
        cooldown=body.get("cooldown", 0),
        cooldown_type=body.get("cooldown_type", "per_user"),
        allowed_channels=body.get("allowed_channels", []),
        blocked_channels=body.get("blocked_channels", []),
        allowed_roles=body.get("allowed_roles", []),
        blocked_roles=body.get("blocked_roles", []),
        ignore_bots=body.get("ignore_bots", True),
        enabled=body.get("enabled", True),
        priority=body.get("priority", 0),
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _serialize(rule)


@router.put("/auto-responders/{rule_id}")
def update_auto_responder(rule_id: int, body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rule = db.execute(select(AutoResponder).where(AutoResponder.id == rule_id, AutoResponder.guild_id == guild_id)).scalars().first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    fields = [
        "name", "trigger_type", "trigger_text", "ignore_case",
        "response_type", "response_text", "response_embed",
        "reaction_emojis", "reply_to_message", "delete_trigger",
        "send_dm", "cooldown", "cooldown_type",
        "allowed_channels", "blocked_channels",
        "allowed_roles", "blocked_roles",
        "ignore_bots", "enabled", "priority",
    ]
    for f in fields:
        if f in body:
            setattr(rule, f, body[f])
    db.commit()
    db.refresh(rule)
    return _serialize(rule)


@router.put("/auto-responders/{rule_id}/toggle")
def toggle_auto_responder(rule_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rule = db.execute(select(AutoResponder).where(AutoResponder.id == rule_id, AutoResponder.guild_id == guild_id)).scalars().first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    rule.enabled = not rule.enabled
    db.commit()
    return {"id": rule.id, "enabled": rule.enabled}


@router.delete("/auto-responders/{rule_id}")
def delete_auto_responder(rule_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rule = db.execute(select(AutoResponder).where(AutoResponder.id == rule_id, AutoResponder.guild_id == guild_id)).scalars().first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    db.delete(rule)
    db.commit()
    return {"ok": True}


def _serialize(r: AutoResponder) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "trigger_type": r.trigger_type,
        "trigger_text": r.trigger_text,
        "ignore_case": r.ignore_case,
        "response_type": r.response_type,
        "response_text": r.response_text,
        "response_embed": r.response_embed,
        "reaction_emojis": r.reaction_emojis or [],
        "reply_to_message": r.reply_to_message,
        "delete_trigger": r.delete_trigger,
        "send_dm": r.send_dm,
        "cooldown": r.cooldown or 0,
        "cooldown_type": r.cooldown_type or "per_user",
        "allowed_channels": r.allowed_channels or [],
        "blocked_channels": r.blocked_channels or [],
        "allowed_roles": r.allowed_roles or [],
        "blocked_roles": r.blocked_roles or [],
        "ignore_bots": r.ignore_bots,
        "enabled": r.enabled,
        "priority": r.priority or 0,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }
