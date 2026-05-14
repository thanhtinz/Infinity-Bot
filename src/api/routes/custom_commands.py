"""Custom Commands CRUD routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from src.database.config import get_db
from src.models.models import CustomCommand, SystemConfig

router = APIRouter()


def _get_guild_id(db) -> str:
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    return config.guild_id if config else ""


@router.get("/custom-commands")
def list_custom_commands(db=Depends(get_db)):
    guild_id = _get_guild_id(db)
    cmds = db.execute(
        select(CustomCommand).where(CustomCommand.guild_id == guild_id)
        .order_by(CustomCommand.created_at.desc())
    ).scalars().all()
    return [
        {
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
            "aliases": c.aliases or [],
            "cooldown": c.cooldown or 0,
            "allowed_channels": c.allowed_channels or [],
            "delete_trigger": c.delete_trigger or False,
            "auto_react": c.auto_react,
        }
        for c in cmds
    ]


@router.post("/custom-commands")
def create_custom_command(body: dict, db=Depends(get_db)):
    guild_id = _get_guild_id(db)
    # Check duplicate name
    existing = db.execute(
        select(CustomCommand).where(
            CustomCommand.guild_id == guild_id,
            CustomCommand.name == body.get("name", "").strip().lower(),
        )
    ).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Command name đã tồn tại")

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
    )
    db.add(cmd)
    db.commit()
    db.refresh(cmd)
    return {"ok": True, "id": cmd.id}


@router.put("/custom-commands/{cmd_id}")
def update_custom_command(cmd_id: int, body: dict, db=Depends(get_db)):
    cmd = db.get(CustomCommand, cmd_id)
    if not cmd:
        raise HTTPException(status_code=404, detail="Command not found")

    for field in ["name", "description", "response_type", "response_text",
                  "response_embed", "ephemeral", "required_roles", "enabled",
                  "aliases", "cooldown", "allowed_channels", "delete_trigger", "auto_react"]:
        if field in body:
            val = body[field]
            if field == "name":
                val = val.strip().lower()
            setattr(cmd, field, val)
    db.commit()
    return {"ok": True}


@router.delete("/custom-commands/{cmd_id}")
def delete_custom_command(cmd_id: int, db=Depends(get_db)):
    cmd = db.get(CustomCommand, cmd_id)
    if not cmd:
        raise HTTPException(status_code=404, detail="Command not found")
    db.delete(cmd)
    db.commit()
    return {"ok": True}
