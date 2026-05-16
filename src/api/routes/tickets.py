"""Ticket system routes: Config, Panels, Groups, Tickets, Blacklist, Notes, Forms, Teams, Feedback, Transcripts, Claiming."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
import datetime, logging

from src.database.config import get_db
from src.models.models import (
    Ticket, TicketPanel, TicketConfig, TicketBlacklist, TicketNote,
    TicketForm, TicketTeam, TicketFeedback, TicketTranscript,
    TicketFeedbackConfig, TicketClaimConfig, PanelButton, TicketPanelGroup,
)
from src.api.deps import get_guild_id

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Ticket Config ─────────────────────────────────────────────────────────────

@router.get("/ticket-config")
def get_ticket_config(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    tc = db.execute(select(TicketConfig).where(TicketConfig.guild_id == guild_id)).scalars().first()
    if not tc:
        return {"guild_id": guild_id, "category_id": None, "log_channel_id": None,
                "support_role_ids": [], "ticket_limit": 1, "cooldown_minutes": 0,
                "auto_close_hours": 0, "naming_format": "ticket-{number}",
                "open_message_title": None, "open_message_body": None,
                "close_message_title": None, "close_message_body": None,
                "claim_message_title": None, "claim_message_body": None}
    return {
        "id": tc.id, "guild_id": tc.guild_id, "category_id": tc.category_id,
        "log_channel_id": tc.log_channel_id, "support_role_ids": tc.support_role_ids or [],
        "ticket_limit": tc.ticket_limit, "cooldown_minutes": tc.cooldown_minutes,
        "auto_close_hours": tc.auto_close_hours, "naming_format": tc.naming_format,
        "open_message_title": tc.open_message_title, "open_message_body": tc.open_message_body,
        "close_message_title": tc.close_message_title, "close_message_body": tc.close_message_body,
        "claim_message_title": tc.claim_message_title, "claim_message_body": tc.claim_message_body,
    }


@router.put("/ticket-config")
def update_ticket_config(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    tc = db.execute(select(TicketConfig).where(TicketConfig.guild_id == guild_id)).scalars().first()
    if not tc:
        tc = TicketConfig(guild_id=guild_id)
        db.add(tc)
    for field in ["category_id", "log_channel_id", "support_role_ids",
                  "ticket_limit", "cooldown_minutes", "auto_close_hours", "naming_format",
                  "open_message_title", "open_message_body",
                  "close_message_title", "close_message_body",
                  "claim_message_title", "claim_message_body"]:
        if field in body:
            setattr(tc, field, body[field])
    db.commit()
    return {"ok": True}


# ── Ticket Panels ─────────────────────────────────────────────────────────────

@router.get("/ticket-panels")
def list_ticket_panels(db=Depends(get_db)):
    panels = db.execute(
        select(TicketPanel).options(joinedload(TicketPanel.buttons)).order_by(TicketPanel.created_at.desc())
    ).unique().scalars().all()
    result = []
    for p in panels:
        btns = sorted(p.buttons, key=lambda b: b.sort_order) if p.buttons else []
        if not btns and p.button_label:
            btns_data = [{"id": 0, "label": p.button_label, "emoji": p.button_emoji or "", "style": p.button_style or "primary", "category_id": p.category_id or "", "form_id": None, "sort_order": 0}]
        else:
            btns_data = [{"id": b.id, "label": b.label, "emoji": b.emoji or "", "style": b.style, "category_id": b.category_id or "", "form_id": b.form_id, "sort_order": b.sort_order} for b in btns]
        result.append({
            "id": p.id, "guild_id": p.guild_id, "name": p.name,
            "channel_id": p.channel_id, "message_id": p.message_id,
            "group_id": p.group_id,
            "title": p.title, "description": p.description, "color": p.color,
            "naming_format": p.naming_format,
            "open_message_title": p.open_message_title,
            "open_message_body": p.open_message_body,
            "close_message_title": p.close_message_title,
            "close_message_body": p.close_message_body,
            "claim_message_title": p.claim_message_title,
            "claim_message_body": p.claim_message_body,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "is_sent": bool(p.message_id),
            "buttons": btns_data,
        })
    return result


@router.post("/ticket-panels")
def create_ticket_panel(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    panel = TicketPanel(
        guild_id=guild_id,
        name=body.get("name", "Panel"),
        title=body.get("title", "Hỗ trợ"),
        description=body.get("description", "Nhấn nút bên dưới để tạo ticket hỗ trợ."),
        color=body.get("color", "#5865F2"),
        group_id=body.get("group_id"),
        naming_format=body.get("naming_format"),
        open_message_title=body.get("open_message_title"),
        open_message_body=body.get("open_message_body"),
        close_message_title=body.get("close_message_title"),
        close_message_body=body.get("close_message_body"),
        claim_message_title=body.get("claim_message_title"),
        claim_message_body=body.get("claim_message_body"),
    )
    db.add(panel)
    db.flush()
    for idx, btn_data in enumerate(body.get("buttons", [])):
        btn = PanelButton(
            panel_id=panel.id,
            label=btn_data.get("label", "Tạo Ticket"),
            emoji=btn_data.get("emoji"),
            style=btn_data.get("style", "primary"),
            category_id=btn_data.get("category_id"),
            form_id=btn_data.get("form_id"),
            sort_order=idx,
        )
        db.add(btn)
    db.commit()
    db.refresh(panel)
    return {"ok": True, "id": panel.id}


@router.put("/ticket-panels/{panel_id}")
def update_ticket_panel(panel_id: int, body: dict, db=Depends(get_db)):
    panel = db.get(TicketPanel, panel_id)
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    for field in ["name", "title", "description", "color", "channel_id", "group_id",
                   "naming_format", "open_message_title", "open_message_body",
                   "close_message_title", "close_message_body",
                   "claim_message_title", "claim_message_body"]:
        if field in body:
            setattr(panel, field, body[field])
    if "buttons" in body:
        for old_btn in list(panel.buttons):
            db.delete(old_btn)
        db.flush()
        for idx, btn_data in enumerate(body["buttons"]):
            btn = PanelButton(
                panel_id=panel.id,
                label=btn_data.get("label", "Tạo Ticket"),
                emoji=btn_data.get("emoji"),
                style=btn_data.get("style", "primary"),
                category_id=btn_data.get("category_id"),
                form_id=btn_data.get("form_id"),
                sort_order=idx,
            )
            db.add(btn)
    db.commit()
    return {"ok": True}


@router.delete("/ticket-panels/{panel_id}")
def delete_ticket_panel(panel_id: int, db=Depends(get_db)):
    panel = db.get(TicketPanel, panel_id)
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    if panel.message_id and panel.channel_id:
        try:
            from src.bot.manager import bot as _bot
            import asyncio as _asyncio
            if _bot and _bot.loop:
                async def _del():
                    try:
                        ch = await _bot.fetch_channel(int(panel.channel_id))
                        msg = await ch.fetch_message(int(panel.message_id))
                        await msg.delete()
                    except Exception:
                        pass
                _asyncio.run_coroutine_threadsafe(_del(), _bot.loop)
        except Exception:
            pass
    db.delete(panel)
    db.commit()
    return {"ok": True}


# ── Ticket Panel Groups ──────────────────────────────────────────────────────

@router.get("/ticket-panel-groups")
def list_ticket_panel_groups(db=Depends(get_db)):
    groups = db.execute(
        select(TicketPanelGroup)
        .options(joinedload(TicketPanelGroup.panels).joinedload(TicketPanel.buttons))
        .order_by(TicketPanelGroup.created_at.desc())
    ).unique().scalars().all()
    result = []
    for g in groups:
        panel_ids = [p.id for p in g.panels] if g.panels else []
        result.append({
            "id": g.id, "guild_id": g.guild_id, "name": g.name,
            "channel_id": g.channel_id, "message_id": g.message_id,
            "title": g.title, "description": g.description, "color": g.color,
            "created_at": g.created_at.isoformat() if g.created_at else None,
            "is_sent": bool(g.message_id),
            "panel_ids": panel_ids,
        })
    return result


@router.post("/ticket-panel-groups")
def create_ticket_panel_group(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    group = TicketPanelGroup(
        guild_id=guild_id,
        name=body.get("name", "Multi Panel"),
        title=body.get("title", "Hỗ trợ"),
        description=body.get("description", ""),
        color=body.get("color", "#5865F2"),
        channel_id=body.get("channel_id"),
    )
    db.add(group)
    db.flush()
    for pid in body.get("panel_ids", []):
        panel = db.get(TicketPanel, pid)
        if panel:
            panel.group_id = group.id
    db.commit()
    db.refresh(group)
    return {"ok": True, "id": group.id}


@router.put("/ticket-panel-groups/{group_id}")
def update_ticket_panel_group(group_id: int, body: dict, db=Depends(get_db)):
    group = db.get(TicketPanelGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    for field in ["name", "title", "description", "color", "channel_id"]:
        if field in body:
            setattr(group, field, body[field])
    if "panel_ids" in body:
        old_panels = db.execute(
            select(TicketPanel).where(TicketPanel.group_id == group_id)
        ).scalars().all()
        for p in old_panels:
            p.group_id = None
        for pid in body["panel_ids"]:
            panel = db.get(TicketPanel, pid)
            if panel:
                panel.group_id = group_id
    db.commit()
    return {"ok": True}


@router.delete("/ticket-panel-groups/{group_id}")
def delete_ticket_panel_group(group_id: int, db=Depends(get_db)):
    group = db.get(TicketPanelGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    panels = db.execute(
        select(TicketPanel).where(TicketPanel.group_id == group_id)
    ).scalars().all()
    for p in panels:
        p.group_id = None
    db.delete(group)
    db.commit()
    return {"ok": True}


# ── Ticket Panel Resolved Config ──────────────────────────────────────────────

@router.get("/ticket-panels/{panel_id}/resolved-config")
def get_panel_resolved_config(panel_id: int, db=Depends(get_db)):
    panel = db.get(TicketPanel, panel_id)
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    cfg = db.execute(select(TicketConfig).limit(1)).scalars().first()
    def resolve(panel_val, global_val, default=""):
        return panel_val if panel_val is not None else (global_val if global_val is not None else default)
    return {
        "naming_format": resolve(panel.naming_format, cfg.naming_format if cfg else None, "ticket-{number}"),
        "open_message_title": resolve(panel.open_message_title, cfg.open_message_title if cfg else None),
        "open_message_body": resolve(panel.open_message_body, cfg.open_message_body if cfg else None),
        "close_message_title": resolve(panel.close_message_title, cfg.close_message_title if cfg else None),
        "close_message_body": resolve(panel.close_message_body, cfg.close_message_body if cfg else None),
        "claim_message_title": resolve(panel.claim_message_title, cfg.claim_message_title if cfg else None),
        "claim_message_body": resolve(panel.claim_message_body, cfg.claim_message_body if cfg else None),
        "source": {
            "naming_format": "panel" if panel.naming_format is not None else "global",
            "open_message_title": "panel" if panel.open_message_title is not None else "global",
            "open_message_body": "panel" if panel.open_message_body is not None else "global",
            "close_message_title": "panel" if panel.close_message_title is not None else "global",
            "close_message_body": "panel" if panel.close_message_body is not None else "global",
            "claim_message_title": "panel" if panel.claim_message_title is not None else "global",
            "claim_message_body": "panel" if panel.claim_message_body is not None else "global",
        }
    }


# ── Tickets ───────────────────────────────────────────────────────────────────

@router.get("/tickets")
def list_tickets(status: str = None, db=Depends(get_db)):
    q = select(Ticket).order_by(Ticket.created_at.desc())
    if status:
        q = q.where(Ticket.status == status)
    tickets = db.execute(q).scalars().all()
    return [{
        "id": t.id, "guild_id": t.guild_id, "channel_id": t.channel_id,
        "creator_id": t.creator_id, "claimed_by": t.claimed_by,
        "status": t.status, "priority": t.priority, "subject": t.subject,
        "close_reason": t.close_reason, "members": t.members or [],
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "closed_at": t.closed_at.isoformat() if t.closed_at else None,
    } for t in tickets]


@router.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: int, db=Depends(get_db)):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    notes = db.execute(
        select(TicketNote).where(TicketNote.ticket_id == ticket_id).order_by(TicketNote.created_at)
    ).scalars().all()
    return {
        "id": t.id, "guild_id": t.guild_id, "channel_id": t.channel_id,
        "creator_id": t.creator_id, "claimed_by": t.claimed_by,
        "status": t.status, "priority": t.priority, "subject": t.subject,
        "close_reason": t.close_reason, "members": t.members or [],
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "closed_at": t.closed_at.isoformat() if t.closed_at else None,
        "notes": [{"id": n.id, "author_id": n.author_id, "content": n.content,
                   "created_at": n.created_at.isoformat()} for n in notes],
    }


@router.put("/tickets/{ticket_id}")
def update_ticket(ticket_id: int, body: dict, db=Depends(get_db)):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    for field in ["status", "priority", "claimed_by", "close_reason", "subject"]:
        if field in body:
            setattr(t, field, body[field])
    if body.get("status") == "closed" and not t.closed_at:
        t.closed_at = datetime.datetime.utcnow()
    elif body.get("status") == "open":
        t.closed_at = None
    db.commit()
    return {"ok": True}


@router.post("/tickets/{ticket_id}/unclaim")
def unclaim_ticket(ticket_id: int, db=Depends(get_db)):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404)
    t.claimed_by = None
    db.commit()
    return {"ok": True}


# ── Ticket Blacklist ──────────────────────────────────────────────────────────

@router.get("/ticket-blacklist")
def list_ticket_blacklist(db=Depends(get_db)):
    items = db.execute(select(TicketBlacklist).order_by(TicketBlacklist.created_at.desc())).scalars().all()
    return [{
        "id": b.id, "guild_id": b.guild_id, "discord_id": b.discord_id,
        "reason": b.reason, "added_by": b.added_by,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    } for b in items]


@router.post("/ticket-blacklist")
def add_ticket_blacklist(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    bl = TicketBlacklist(
        guild_id=guild_id,
        discord_id=body.get("discord_id", ""),
        reason=body.get("reason"),
        added_by=body.get("added_by"),
    )
    db.add(bl)
    db.commit()
    db.refresh(bl)
    return {"ok": True, "id": bl.id}


@router.delete("/ticket-blacklist/{bl_id}")
def remove_ticket_blacklist(bl_id: int, db=Depends(get_db)):
    bl = db.get(TicketBlacklist, bl_id)
    if not bl:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(bl)
    db.commit()
    return {"ok": True}


# ── Ticket Notes ──────────────────────────────────────────────────────────────

@router.get("/ticket-notes/{ticket_id}")
def get_ticket_notes(ticket_id: int, db=Depends(get_db)):
    notes = db.execute(
        select(TicketNote).where(TicketNote.ticket_id == ticket_id).order_by(TicketNote.created_at)
    ).scalars().all()
    return [{"id": n.id, "ticket_id": n.ticket_id, "author_id": n.author_id,
             "content": n.content, "created_at": n.created_at.isoformat()} for n in notes]


@router.post("/ticket-notes")
def add_ticket_note(body: dict, db=Depends(get_db)):
    note = TicketNote(
        ticket_id=body.get("ticket_id"),
        author_id=body.get("author_id", "dashboard"),
        content=body.get("content", ""),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return {"ok": True, "id": note.id}


@router.delete("/ticket-notes/{note_id}")
def delete_ticket_note(note_id: int, db=Depends(get_db)):
    note = db.get(TicketNote, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(note)
    db.commit()
    return {"ok": True}


# ── Ticket Stats ──────────────────────────────────────────────────────────────

@router.get("/ticket-stats")
def ticket_stats(db=Depends(get_db)):
    tickets = db.execute(select(Ticket)).scalars().all()
    open_t = [t for t in tickets if t.status == "open"]
    closed_t = [t for t in tickets if t.status == "closed"]
    close_times = []
    for t in closed_t:
        if t.created_at and t.closed_at:
            delta = (t.closed_at - t.created_at).total_seconds() / 3600
            close_times.append(delta)
    avg_close = round(sum(close_times) / len(close_times), 1) if close_times else 0
    priority_counts = {}
    for t in open_t:
        priority_counts[t.priority] = priority_counts.get(t.priority, 0) + 1
    return {
        "total": len(tickets),
        "open": len(open_t),
        "closed": len(closed_t),
        "avg_close_hours": avg_close,
        "by_priority": priority_counts,
        "panels": db.execute(select(TicketPanel)).scalars().all().__len__(),
    }


# ── Ticket Forms ──────────────────────────────────────────────────────────────

@router.get("/ticket-forms")
def list_ticket_forms(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    return db.execute(select(TicketForm).where(TicketForm.guild_id == guild_id)).scalars().all()


@router.post("/ticket-forms")
def create_ticket_form(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    form = TicketForm(
        guild_id=guild_id,
        name=body.get("name", "Form mặc định"),
        panel_id=body.get("panel_id"),
        questions=body.get("questions", []),
    )
    db.add(form)
    db.commit()
    db.refresh(form)
    return form


@router.put("/ticket-forms/{form_id}")
def update_ticket_form(form_id: int, body: dict, db=Depends(get_db)):
    form = db.get(TicketForm, form_id)
    if not form:
        raise HTTPException(404)
    for k, v in body.items():
        if hasattr(form, k):
            setattr(form, k, v)
    db.commit()
    db.refresh(form)
    return form


@router.delete("/ticket-forms/{form_id}")
def delete_ticket_form(form_id: int, db=Depends(get_db)):
    form = db.get(TicketForm, form_id)
    if not form:
        raise HTTPException(404)
    db.delete(form)
    db.commit()
    return {"status": "deleted"}


# ── Ticket Teams ──────────────────────────────────────────────────────────────

@router.get("/ticket-teams")
def list_ticket_teams(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    return db.execute(select(TicketTeam).where(TicketTeam.guild_id == guild_id)).scalars().all()


@router.post("/ticket-teams")
def create_ticket_team(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    team = TicketTeam(
        guild_id=guild_id,
        name=body.get("name", "Team mới"),
        description=body.get("description"),
        role_ids=body.get("role_ids", []),
        panel_ids=body.get("panel_ids", []),
        color=body.get("color", "#5865F2"),
    )
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


@router.put("/ticket-teams/{team_id}")
def update_ticket_team(team_id: int, body: dict, db=Depends(get_db)):
    team = db.get(TicketTeam, team_id)
    if not team:
        raise HTTPException(404)
    for k, v in body.items():
        if hasattr(team, k):
            setattr(team, k, v)
    db.commit()
    db.refresh(team)
    return team


@router.delete("/ticket-teams/{team_id}")
def delete_ticket_team(team_id: int, db=Depends(get_db)):
    team = db.get(TicketTeam, team_id)
    if not team:
        raise HTTPException(404)
    db.delete(team)
    db.commit()
    return {"status": "deleted"}


# ── Ticket Feedback ───────────────────────────────────────────────────────────

@router.get("/ticket-feedback")
def list_ticket_feedback(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rows = db.execute(select(TicketFeedback).where(TicketFeedback.guild_id == guild_id).order_by(TicketFeedback.created_at.desc())).scalars().all()
    total = len(rows)
    avg_rating = round(sum(r.rating for r in rows) / total, 2) if total else 0
    by_rating = {str(i): sum(1 for r in rows if r.rating == i) for i in range(1, 6)}
    return {"items": rows, "total": total, "avg_rating": avg_rating, "by_rating": by_rating}


@router.post("/ticket-feedback")
def submit_ticket_feedback(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    fb = TicketFeedback(
        ticket_id=body["ticket_id"],
        guild_id=guild_id,
        user_id=body.get("user_id", "dashboard"),
        rating=body["rating"],
        comment=body.get("comment"),
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return fb


# ── Ticket Transcripts ───────────────────────────────────────────────────────

@router.get("/ticket-transcripts")
def list_ticket_transcripts(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    return db.execute(select(TicketTranscript).where(TicketTranscript.guild_id == guild_id).order_by(TicketTranscript.created_at.desc())).scalars().all()


@router.get("/ticket-transcripts/{ticket_id}")
def get_ticket_transcript(ticket_id: int, db=Depends(get_db)):
    t = db.execute(select(TicketTranscript).where(TicketTranscript.ticket_id == ticket_id)).scalars().first()
    if not t:
        raise HTTPException(404, "Transcript not found")
    return t


# ── Ticket Feedback Config ───────────────────────────────────────────────────

@router.get("/ticket-feedback/stats")
def feedback_stats(db=Depends(get_db)):
    fb = db.execute(select(TicketFeedback)).scalars().all()
    if not fb:
        return {"avg_rating": 0.0, "total": 0}
    return {"avg_rating": round(sum(f.rating for f in fb) / len(fb), 1), "total": len(fb)}


@router.get("/ticket-feedback-config")
def get_feedback_config(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cfg = db.execute(select(TicketFeedbackConfig).where(TicketFeedbackConfig.guild_id == guild_id)).scalars().first()
    if not cfg:
        return {"enabled": False, "channel_id": None}
    return {"enabled": cfg.enabled, "channel_id": cfg.channel_id}


@router.post("/ticket-feedback-config")
def save_feedback_config(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cfg = db.execute(select(TicketFeedbackConfig).where(TicketFeedbackConfig.guild_id == guild_id)).scalars().first()
    if not cfg:
        cfg = TicketFeedbackConfig(guild_id=guild_id)
        db.add(cfg)
    cfg.enabled = body.get("enabled", False)
    cfg.channel_id = body.get("channel_id")
    db.commit()
    return {"ok": True}


# ── Ticket Claim Config ──────────────────────────────────────────────────────

@router.get("/ticket-claim-config")
def get_claim_config(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cfg = db.execute(select(TicketClaimConfig).where(TicketClaimConfig.guild_id == guild_id)).scalars().first()
    if not cfg:
        return {"enabled": True, "exclusive": False, "notify": True, "notify_channel_id": None}
    return {"enabled": cfg.enabled, "exclusive": cfg.exclusive,
            "notify": cfg.notify, "notify_channel_id": cfg.notify_channel_id}


@router.post("/ticket-claim-config")
def save_claim_config(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cfg = db.execute(select(TicketClaimConfig).where(TicketClaimConfig.guild_id == guild_id)).scalars().first()
    if not cfg:
        cfg = TicketClaimConfig(guild_id=guild_id)
        db.add(cfg)
    for k in ["enabled", "exclusive", "notify", "notify_channel_id"]:
        if k in body:
            setattr(cfg, k, body[k])
    db.commit()
    return {"ok": True}


# ── Ticket Messages ──────────────────────────────────────────────────────────

@router.get("/ticket-messages/{ticket_id}")
def get_ticket_messages(ticket_id: int, db=Depends(get_db)):
    tr = db.execute(select(TicketTranscript).where(TicketTranscript.ticket_id == ticket_id)).scalars().first()
    if not tr:
        return []
    return []
