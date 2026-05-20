"""Button Roles & Select Menu Roles CRUD routes."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from src.database.config import get_db
from src.api.deps import get_guild_id, require_staff_perm
from src.models.models import ButtonRole, SelectMenuRole

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/welcome", dependencies=[Depends(require_staff_perm("can_roles"))])


# ── helpers ──────────────────────────────────────────────────────────────────

def _br_dict(p: ButtonRole) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "channel_id": p.channel_id,
        "message_id": p.message_id,
        "buttons": p.buttons or [],
        "embed_title": p.embed_title,
        "embed_description": p.embed_description,
        "embed_color": p.embed_color,
        "embed_footer": p.embed_footer,
        "embed_image_url": p.embed_image_url,
        "embed_thumbnail_url": p.embed_thumbnail_url,
        "embed_fields": p.embed_fields or [],
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _sr_dict(p: SelectMenuRole) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "channel_id": p.channel_id,
        "message_id": p.message_id,
        "placeholder": p.placeholder,
        "options": p.options or [],
        "min_values": p.min_values,
        "max_values": p.max_values,
        "embed_title": p.embed_title,
        "embed_description": p.embed_description,
        "embed_color": p.embed_color,
        "embed_footer": p.embed_footer,
        "embed_image_url": p.embed_image_url,
        "embed_thumbnail_url": p.embed_thumbnail_url,
        "embed_fields": p.embed_fields or [],
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  BUTTON ROLES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/button-roles")
def list_button_roles(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    panels = db.execute(
        select(ButtonRole).where(ButtonRole.guild_id == guild_id)
        .order_by(ButtonRole.created_at.desc())
    ).scalars().all()
    return [_br_dict(p) for p in panels]


@router.post("/button-roles")
def create_button_role(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    panel = ButtonRole(
        guild_id=guild_id,
        name=body.get("name", "Button Role Panel"),
        embed_title=body.get("embed_title"),
        embed_description=body.get("embed_description"),
        embed_color=body.get("embed_color", "#5865F2"),
        embed_footer=body.get("embed_footer"),
        embed_image_url=body.get("embed_image_url"),
        embed_thumbnail_url=body.get("embed_thumbnail_url"),
        embed_fields=body.get("embed_fields", []),
        buttons=body.get("buttons", []),
    )
    db.add(panel)
    db.commit()
    db.refresh(panel)
    return {"ok": True, "id": panel.id}


@router.put("/button-roles/{panel_id}")
def update_button_role(panel_id: int, body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    panel = db.execute(
        select(ButtonRole).where(ButtonRole.id == panel_id, ButtonRole.guild_id == guild_id)
    ).scalars().first()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    for field in ["name", "embed_title", "embed_description", "embed_color",
                  "embed_footer", "embed_image_url", "embed_thumbnail_url",
                  "embed_fields", "buttons", "channel_id", "message_id"]:
        if field in body:
            setattr(panel, field, body[field])
    db.commit()
    return {"ok": True}


@router.delete("/button-roles/{panel_id}")
def delete_button_role(panel_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    panel = db.execute(
        select(ButtonRole).where(ButtonRole.id == panel_id, ButtonRole.guild_id == guild_id)
    ).scalars().first()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    db.delete(panel)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
#  SELECT MENU ROLES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/select-roles")
def list_select_roles(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    panels = db.execute(
        select(SelectMenuRole).where(SelectMenuRole.guild_id == guild_id)
        .order_by(SelectMenuRole.created_at.desc())
    ).scalars().all()
    return [_sr_dict(p) for p in panels]


@router.post("/select-roles")
def create_select_role(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    panel = SelectMenuRole(
        guild_id=guild_id,
        name=body.get("name", "Select Role Panel"),
        placeholder=body.get("placeholder", "Select role..."),
        min_values=body.get("min_values", 0),
        max_values=body.get("max_values", 1),
        embed_title=body.get("embed_title"),
        embed_description=body.get("embed_description"),
        embed_color=body.get("embed_color", "#5865F2"),
        embed_footer=body.get("embed_footer"),
        embed_image_url=body.get("embed_image_url"),
        embed_thumbnail_url=body.get("embed_thumbnail_url"),
        embed_fields=body.get("embed_fields", []),
        options=body.get("options", []),
    )
    db.add(panel)
    db.commit()
    db.refresh(panel)
    return {"ok": True, "id": panel.id}


@router.put("/select-roles/{panel_id}")
def update_select_role(panel_id: int, body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    panel = db.execute(
        select(SelectMenuRole).where(SelectMenuRole.id == panel_id, SelectMenuRole.guild_id == guild_id)
    ).scalars().first()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    for field in ["name", "placeholder", "min_values", "max_values",
                  "embed_title", "embed_description", "embed_color",
                  "embed_footer", "embed_image_url", "embed_thumbnail_url",
                  "embed_fields", "options", "channel_id", "message_id"]:
        if field in body:
            setattr(panel, field, body[field])
    db.commit()
    return {"ok": True}


@router.delete("/select-roles/{panel_id}")
def delete_select_role(panel_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    panel = db.execute(
        select(SelectMenuRole).where(SelectMenuRole.id == panel_id, SelectMenuRole.guild_id == guild_id)
    ).scalars().first()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    db.delete(panel)
    db.commit()
    return {"ok": True}
