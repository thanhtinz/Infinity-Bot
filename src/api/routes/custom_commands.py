"""Custom Commands CRUD routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from src.database.config import get_db
from src.api.deps import get_guild_id, require_staff_perm
from src.models.models import CustomCommand

router = APIRouter(dependencies=[Depends(require_staff_perm("can_utilities"))])

_PHASE3_FIELDS = [
    "silent", "dm_response", "no_everyone",
    "allowed_roles", "ignored_roles", "ignored_channels",
    "response_channel_id", "delete_after", "required_args",
    "additional_responses",
]

_PHASE4_FIELDS = ["event_trigger", "trigger_config", "actions"]


def _serialize(c: CustomCommand) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "response_type": c.response_type,
        "response_text": c.response_text,
        "response_embed": c.response_embed,
        "ephemeral": c.ephemeral,
        "required_roles": c.required_roles or [],
        "enabled": c.enabled,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        # Phase 2
        "aliases": c.aliases or [],
        "cooldown": c.cooldown or 0,
        "allowed_channels": c.allowed_channels or [],
        "delete_trigger": c.delete_trigger or False,
        "auto_react": c.auto_react,
        # Phase 3
        "silent": getattr(c, "silent", False) or False,
        "dm_response": getattr(c, "dm_response", False) or False,
        "no_everyone": getattr(c, "no_everyone", False) or False,
        "allowed_roles": getattr(c, "allowed_roles", None) or [],
        "ignored_roles": getattr(c, "ignored_roles", None) or [],
        "ignored_channels": getattr(c, "ignored_channels", None) or [],
        "response_channel_id": getattr(c, "response_channel_id", None),
        "delete_after": getattr(c, "delete_after", 0) or 0,
        "required_args": getattr(c, "required_args", 0) or 0,
        "additional_responses": getattr(c, "additional_responses", None) or [],
        # Phase 4
        "event_trigger": getattr(c, "event_trigger", "prefix_command") or "prefix_command",
        "trigger_config": getattr(c, "trigger_config", None) or {},
        "actions": getattr(c, "actions", None) or [],
    }


@router.get("/custom-commands")
def list_custom_commands(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cmds = db.execute(
        select(CustomCommand).where(CustomCommand.guild_id == guild_id)
        .order_by(CustomCommand.created_at.desc())
    ).scalars().all()
    return [_serialize(c) for c in cmds]


@router.post("/custom-commands")
def create_custom_command(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    incoming_trigger = body.get("event_trigger", "prefix_command")
    existing = db.execute(
        select(CustomCommand).where(
            CustomCommand.guild_id == guild_id,
            CustomCommand.name == body.get("name", "").strip().lower(),
            CustomCommand.event_trigger == incoming_trigger,
        )
    ).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Command name đã tồn tại với cùng trigger")

    cmd = CustomCommand(
        guild_id=guild_id,
        name=body.get("name", "").strip().lower(),
        description=body.get("description"),
        response_type=body.get("response_type", "text"),
        response_text=body.get("response_text"),
        response_embed=body.get("response_embed"),
        ephemeral=body.get("ephemeral", False),
        required_roles=body.get("required_roles", []),
        enabled=body.get("enabled", True),
        aliases=body.get("aliases", []),
        cooldown=body.get("cooldown", 0),
        allowed_channels=body.get("allowed_channels", []),
        delete_trigger=body.get("delete_trigger", False),
        auto_react=body.get("auto_react"),
        silent=body.get("silent", False),
        dm_response=body.get("dm_response", False),
        no_everyone=body.get("no_everyone", False),
        allowed_roles=body.get("allowed_roles", []),
        ignored_roles=body.get("ignored_roles", []),
        ignored_channels=body.get("ignored_channels", []),
        response_channel_id=body.get("response_channel_id"),
        delete_after=body.get("delete_after", 0),
        required_args=body.get("required_args", 0),
        additional_responses=body.get("additional_responses", []),
        event_trigger=body.get("event_trigger", "prefix_command"),
        trigger_config=body.get("trigger_config", {}),
        actions=body.get("actions", []),
    )
    db.add(cmd)
    db.commit()
    db.refresh(cmd)
    return {"ok": True, "id": cmd.id}


@router.put("/custom-commands/{cmd_id}")
def update_custom_command(cmd_id: int, body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cmd = db.execute(select(CustomCommand).where(CustomCommand.id == cmd_id, CustomCommand.guild_id == guild_id)).scalars().first()
    if not cmd:
        raise HTTPException(status_code=404, detail="Command not found")

    all_fields = [
        "name", "description", "response_type", "response_text",
        "response_embed", "ephemeral", "required_roles", "enabled",
        "aliases", "cooldown", "allowed_channels", "delete_trigger", "auto_react",
    ] + _PHASE3_FIELDS + _PHASE4_FIELDS

    for field in all_fields:
        if field in body:
            val = body[field]
            if field == "name":
                val = val.strip().lower()
            setattr(cmd, field, val)
    db.commit()
    return {"ok": True}


@router.delete("/custom-commands/{cmd_id}")
def delete_custom_command(cmd_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cmd = db.execute(select(CustomCommand).where(CustomCommand.id == cmd_id, CustomCommand.guild_id == guild_id)).scalars().first()
    if not cmd:
        raise HTTPException(status_code=404, detail="Command not found")
    db.delete(cmd)
    db.commit()
    return {"ok": True}
