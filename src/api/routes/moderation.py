"""API routes for extended moderation: cases, notes, config, active moderations, stats."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from src.api.deps import get_db, get_guild_id, require_staff_perm
from src.models.models import (
    ModerationCase, ModerationNote, ModerationConfig, RolePersist, TempRole,
)
from typing import Optional
import datetime

router = APIRouter(dependencies=[Depends(require_staff_perm("can_moderation"))])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ModConfigUpdate(BaseModel):
    mute_role_id: Optional[str] = None
    mod_log_channel_id: Optional[str] = None
    lockdown_channels: Optional[list] = None
    ignored_users: Optional[list] = None
    ignored_roles: Optional[list] = None
    ignored_channels: Optional[list] = None
    dm_on_action: Optional[bool] = None
    show_mod_in_dm: Optional[bool] = None
    auto_dehoist: Optional[bool] = None


class NoteCreate(BaseModel):
    target_id: str
    content: str


class NoteUpdate(BaseModel):
    content: str


# ── Moderation Config ─────────────────────────────────────────────────────────

@router.get("/moderation/config")
def get_mod_config(guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    cfg = db.execute(select(ModerationConfig).where(ModerationConfig.guild_id == guild_id)).scalars().first()
    if not cfg:
        return {
            "mute_role_id": None, "mod_log_channel_id": None,
            "lockdown_channels": [], "ignored_users": [], "ignored_roles": [],
            "ignored_channels": [], "dm_on_action": True, "show_mod_in_dm": False,
            "auto_dehoist": False,
        }
    return {
        "mute_role_id": cfg.mute_role_id,
        "mod_log_channel_id": cfg.mod_log_channel_id,
        "lockdown_channels": cfg.lockdown_channels or [],
        "ignored_users": cfg.ignored_users or [],
        "ignored_roles": cfg.ignored_roles or [],
        "ignored_channels": cfg.ignored_channels or [],
        "dm_on_action": cfg.dm_on_action if cfg.dm_on_action is not None else True,
        "show_mod_in_dm": cfg.show_mod_in_dm or False,
        "auto_dehoist": cfg.auto_dehoist or False,
    }


@router.put("/moderation/config")
def update_mod_config(body: ModConfigUpdate, guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    cfg = db.execute(select(ModerationConfig).where(ModerationConfig.guild_id == guild_id)).scalars().first()
    if not cfg:
        cfg = ModerationConfig(guild_id=guild_id)
        db.add(cfg)
    data = body.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(cfg, k, v)
    db.commit()
    return {"ok": True}


# ── Moderation Cases ──────────────────────────────────────────────────────────

@router.get("/moderation/cases")
def list_cases(
    guild_id: str = Depends(get_guild_id),
    db=Depends(get_db),
    target_id: str | None = None,
    action: str | None = None,
    limit: int = 50,
):
    q = select(ModerationCase).where(ModerationCase.guild_id == guild_id)
    if target_id:
        q = q.where(ModerationCase.target_id == target_id)
    if action:
        q = q.where(ModerationCase.action == action)
    q = q.order_by(ModerationCase.created_at.desc()).limit(min(limit, 200))
    rows = db.execute(q).scalars().all()
    return [
        {
            "id": r.id, "case_number": r.case_number, "action": r.action,
            "target_id": r.target_id, "target_name": r.target_name,
            "moderator_id": r.moderator_id, "moderator_name": r.moderator_name,
            "reason": r.reason, "duration": r.duration, "active": r.active,
            "role_id": r.role_id,
            "expires_at": r.expires_at.isoformat() if r.expires_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/moderation/cases/{case_number}")
def get_case(case_number: int, guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    c = db.execute(
        select(ModerationCase).where(ModerationCase.guild_id == guild_id, ModerationCase.case_number == case_number)
    ).scalars().first()
    if not c:
        raise HTTPException(404, "Case not found")
    return {
        "id": c.id, "case_number": c.case_number, "action": c.action,
        "target_id": c.target_id, "target_name": c.target_name,
        "moderator_id": c.moderator_id, "moderator_name": c.moderator_name,
        "reason": c.reason, "duration": c.duration, "active": c.active,
        "role_id": c.role_id,
        "expires_at": c.expires_at.isoformat() if c.expires_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.delete("/moderation/cases/{case_id}")
def delete_case(case_id: int, guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    c = db.get(ModerationCase, case_id)
    if not c or c.guild_id != guild_id:
        raise HTTPException(404, "Case not found")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ── Active Moderations ────────────────────────────────────────────────────────

@router.get("/moderation/active")
def list_active(guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    now = datetime.datetime.utcnow()
    rows = db.execute(
        select(ModerationCase)
        .where(
            ModerationCase.guild_id == guild_id,
            ModerationCase.active == True,
            ModerationCase.expires_at > now,
        )
        .order_by(ModerationCase.expires_at)
        .limit(50)
    ).scalars().all()
    return [
        {
            "id": r.id, "case_number": r.case_number, "action": r.action,
            "target_id": r.target_id, "target_name": r.target_name,
            "reason": r.reason, "duration": r.duration,
            "expires_at": r.expires_at.isoformat() if r.expires_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


# ── Moderation Notes ──────────────────────────────────────────────────────────

@router.get("/moderation/notes")
def list_notes(
    guild_id: str = Depends(get_guild_id),
    db=Depends(get_db),
    target_id: str | None = None,
):
    q = select(ModerationNote).where(ModerationNote.guild_id == guild_id)
    if target_id:
        q = q.where(ModerationNote.target_id == target_id)
    q = q.order_by(ModerationNote.created_at.desc()).limit(200)
    rows = db.execute(q).scalars().all()
    return [
        {
            "id": r.id, "target_id": r.target_id, "author_id": r.author_id,
            "content": r.content,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/moderation/notes")
def create_note(body: NoteCreate, guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    n = ModerationNote(guild_id=guild_id, target_id=body.target_id, author_id="dashboard", content=body.content)
    db.add(n)
    db.commit()
    db.refresh(n)
    return {"id": n.id}


@router.put("/moderation/notes/{note_id}")
def update_note(note_id: int, body: NoteUpdate, guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    n = db.get(ModerationNote, note_id)
    if not n or n.guild_id != guild_id:
        raise HTTPException(404, "Note not found")
    n.content = body.content
    db.commit()
    return {"ok": True}


@router.delete("/moderation/notes/{note_id}")
def delete_note(note_id: int, guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    n = db.get(ModerationNote, note_id)
    if not n or n.guild_id != guild_id:
        raise HTTPException(404, "Note not found")
    db.delete(n)
    db.commit()
    return {"ok": True}


# ── Mod Stats (aggregated) ───────────────────────────────────────────────────

@router.get("/moderation/stats")
def mod_stats(guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    total = db.execute(
        select(func.count(ModerationCase.id)).where(ModerationCase.guild_id == guild_id)
    ).scalar() or 0
    by_action = db.execute(
        select(ModerationCase.action, func.count(ModerationCase.id))
        .where(ModerationCase.guild_id == guild_id)
        .group_by(ModerationCase.action)
    ).all()
    now = datetime.datetime.utcnow()
    active_count = db.execute(
        select(func.count(ModerationCase.id))
        .where(ModerationCase.guild_id == guild_id, ModerationCase.active == True, ModerationCase.expires_at > now)
    ).scalar() or 0
    note_count = db.execute(
        select(func.count(ModerationNote.id)).where(ModerationNote.guild_id == guild_id)
    ).scalar() or 0
    return {
        "total_cases": total,
        "active_moderations": active_count,
        "total_notes": note_count,
        "by_action": {a: c for a, c in by_action},
    }


# ── Role Persist ──────────────────────────────────────────────────────────────

@router.get("/moderation/rolepersist")
def list_rolepersist(guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    rows = db.execute(select(RolePersist).where(RolePersist.guild_id == guild_id)).scalars().all()
    return [
        {"id": r.id, "target_id": r.target_id, "role_id": r.role_id, "assigned_by": r.assigned_by,
         "created_at": r.created_at.isoformat() if r.created_at else None}
        for r in rows
    ]


@router.delete("/moderation/rolepersist/{rp_id}")
def delete_rolepersist(rp_id: int, guild_id: str = Depends(get_guild_id), db=Depends(get_db)):
    rp = db.get(RolePersist, rp_id)
    if not rp or rp.guild_id != guild_id:
        raise HTTPException(404)
    db.delete(rp)
    db.commit()
    return {"ok": True}
