"""Welcome & Auto Role routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from src.database.config import get_db
from src.models.models import WelcomeConfig, AutoRoleConfig, ButtonRole, SelectMenuRole, SystemConfig

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class WelcomeConfigUpdate(BaseModel):
    welcome_enabled: bool = False
    welcome_channel_id: Optional[str] = None
    welcome_message: Optional[str] = None
    welcome_embed_enabled: bool = True
    welcome_dm_enabled: bool = False
    welcome_dm_message: Optional[str] = None
    goodbye_enabled: bool = False
    goodbye_channel_id: Optional[str] = None
    goodbye_message: Optional[str] = None
    goodbye_embed_enabled: bool = True
    auto_nickname_template: Optional[str] = None

class AutoRoleUpdate(BaseModel):
    join_roles: list[str] = []
    bot_roles: list[str] = []

class ButtonRoleCreate(BaseModel):
    name: str = "Button Role Panel"
    buttons: list[dict] = []
    embed_title: Optional[str] = None
    embed_description: Optional[str] = None
    embed_color: str = "#5865F2"

class SelectMenuRoleCreate(BaseModel):
    name: str = "Select Role Panel"
    placeholder: str = "Chọn role..."
    options: list[dict] = []
    min_values: int = 0
    max_values: int = 1
    embed_title: Optional[str] = None
    embed_description: Optional[str] = None
    embed_color: str = "#5865F2"


# ── Welcome Config ────────────────────────────────────────────────────────────

def _get_guild_id(db) -> str:
    cfg = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not cfg or not cfg.guild_id:
        raise HTTPException(400, "Guild ID chưa được cấu hình")
    return cfg.guild_id

@router.get("/welcome/config")
def get_welcome_config(db=Depends(get_db)):
    gid = _get_guild_id(db)
    cfg = db.execute(select(WelcomeConfig).where(WelcomeConfig.guild_id == gid)).scalars().first()
    if not cfg:
        return {
            "welcome_enabled": False, "welcome_channel_id": None, "welcome_message": None,
            "welcome_embed_enabled": True, "welcome_dm_enabled": False, "welcome_dm_message": None,
            "goodbye_enabled": False, "goodbye_channel_id": None, "goodbye_message": None,
            "goodbye_embed_enabled": True, "auto_nickname_template": None,
        }
    return {
        "welcome_enabled": cfg.welcome_enabled,
        "welcome_channel_id": cfg.welcome_channel_id,
        "welcome_message": cfg.welcome_message,
        "welcome_embed_enabled": cfg.welcome_embed_enabled,
        "welcome_dm_enabled": cfg.welcome_dm_enabled,
        "welcome_dm_message": cfg.welcome_dm_message,
        "goodbye_enabled": cfg.goodbye_enabled,
        "goodbye_channel_id": cfg.goodbye_channel_id,
        "goodbye_message": cfg.goodbye_message,
        "goodbye_embed_enabled": cfg.goodbye_embed_enabled,
        "auto_nickname_template": cfg.auto_nickname_template,
    }

@router.put("/welcome/config")
def update_welcome_config(data: WelcomeConfigUpdate, db=Depends(get_db)):
    gid = _get_guild_id(db)
    cfg = db.execute(select(WelcomeConfig).where(WelcomeConfig.guild_id == gid)).scalars().first()
    if not cfg:
        cfg = WelcomeConfig(guild_id=gid)
        db.add(cfg)
    for k, v in data.model_dump().items():
        setattr(cfg, k, v)
    db.commit()
    return {"ok": True}


# ── Auto Role ─────────────────────────────────────────────────────────────────

@router.get("/welcome/autorole")
def get_autorole(db=Depends(get_db)):
    gid = _get_guild_id(db)
    cfg = db.execute(select(AutoRoleConfig).where(AutoRoleConfig.guild_id == gid)).scalars().first()
    if not cfg:
        return {"join_roles": [], "bot_roles": []}
    return {"join_roles": cfg.join_roles or [], "bot_roles": cfg.bot_roles or []}

@router.put("/welcome/autorole")
def update_autorole(data: AutoRoleUpdate, db=Depends(get_db)):
    gid = _get_guild_id(db)
    cfg = db.execute(select(AutoRoleConfig).where(AutoRoleConfig.guild_id == gid)).scalars().first()
    if not cfg:
        cfg = AutoRoleConfig(guild_id=gid)
        db.add(cfg)
    cfg.join_roles = data.join_roles
    cfg.bot_roles = data.bot_roles
    db.commit()
    return {"ok": True}


# ── Button Roles ──────────────────────────────────────────────────────────────

@router.get("/welcome/button-roles")
def list_button_roles(db=Depends(get_db)):
    gid = _get_guild_id(db)
    panels = db.execute(select(ButtonRole).where(ButtonRole.guild_id == gid).order_by(ButtonRole.id.desc())).scalars().all()
    return [
        {
            "id": p.id, "name": p.name, "buttons": p.buttons or [],
            "channel_id": p.channel_id, "message_id": p.message_id,
            "embed_title": p.embed_title, "embed_description": p.embed_description,
            "embed_color": p.embed_color, "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in panels
    ]

@router.post("/welcome/button-roles")
def create_button_role(data: ButtonRoleCreate, db=Depends(get_db)):
    gid = _get_guild_id(db)
    panel = ButtonRole(guild_id=gid, **data.model_dump())
    db.add(panel)
    db.commit()
    db.refresh(panel)
    return {"id": panel.id}

@router.put("/welcome/button-roles/{panel_id}")
def update_button_role(panel_id: int, data: ButtonRoleCreate, db=Depends(get_db)):
    panel = db.get(ButtonRole, panel_id)
    if not panel:
        raise HTTPException(404)
    for k, v in data.model_dump().items():
        setattr(panel, k, v)
    db.commit()
    return {"ok": True}

@router.delete("/welcome/button-roles/{panel_id}")
def delete_button_role(panel_id: int, db=Depends(get_db)):
    panel = db.get(ButtonRole, panel_id)
    if not panel:
        raise HTTPException(404)
    db.delete(panel)
    db.commit()
    return {"ok": True}


# ── Select Menu Roles ─────────────────────────────────────────────────────────

@router.get("/welcome/select-roles")
def list_select_roles(db=Depends(get_db)):
    gid = _get_guild_id(db)
    panels = db.execute(select(SelectMenuRole).where(SelectMenuRole.guild_id == gid).order_by(SelectMenuRole.id.desc())).scalars().all()
    return [
        {
            "id": p.id, "name": p.name, "placeholder": p.placeholder,
            "options": p.options or [], "min_values": p.min_values, "max_values": p.max_values,
            "channel_id": p.channel_id, "message_id": p.message_id,
            "embed_title": p.embed_title, "embed_description": p.embed_description,
            "embed_color": p.embed_color, "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in panels
    ]

@router.post("/welcome/select-roles")
def create_select_role(data: SelectMenuRoleCreate, db=Depends(get_db)):
    gid = _get_guild_id(db)
    panel = SelectMenuRole(guild_id=gid, **data.model_dump())
    db.add(panel)
    db.commit()
    db.refresh(panel)
    return {"id": panel.id}

@router.put("/welcome/select-roles/{panel_id}")
def update_select_role(panel_id: int, data: SelectMenuRoleCreate, db=Depends(get_db)):
    panel = db.get(SelectMenuRole, panel_id)
    if not panel:
        raise HTTPException(404)
    for k, v in data.model_dump().items():
        setattr(panel, k, v)
    db.commit()
    return {"ok": True}

@router.delete("/welcome/select-roles/{panel_id}")
def delete_select_role(panel_id: int, db=Depends(get_db)):
    panel = db.get(SelectMenuRole, panel_id)
    if not panel:
        raise HTTPException(404)
    db.delete(panel)
    db.commit()
    return {"ok": True}
