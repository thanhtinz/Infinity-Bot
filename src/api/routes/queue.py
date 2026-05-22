"""Smart Queue / Support Ticket API — full ticket lifecycle, SLA, assignment."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
import datetime

from src.database.config import get_db
from src.models.models import QueueConfig, SupportTicket, TicketMessage, StaffProfile
from src.api.deps import get_guild_id, require_staff_perm

router = APIRouter(
    prefix="/api/queue",
    dependencies=[Depends(require_staff_perm("can_shop"))],
)

OPEN_STATUSES = ("open", "claimed", "in_progress", "pending")


# ── Schemas ────────────────────────────────────────────────────────────────────

class ConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    category_id: Optional[str] = None
    support_role_id: Optional[str] = None
    log_channel_id: Optional[str] = None
    sla_response_minutes: Optional[int] = None
    sla_resolve_minutes: Optional[int] = None
    max_open_per_user: Optional[int] = None
    close_on_resolve: Optional[bool] = None
    transcript_channel_id: Optional[str] = None
    welcome_message: Optional[str] = None

class TicketCreate(BaseModel):
    subject: Optional[str] = None
    creator_discord_id: str
    creator_name: Optional[str] = None
    priority: str = "normal"
    category: Optional[str] = None
    channel_id: Optional[str] = None
    tags: list = []

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    assigned_staff_id: Optional[int] = None
    internal_note: Optional[str] = None
    tags: Optional[list] = None
    rating: Optional[int] = None

class MessageCreate(BaseModel):
    discord_id: str
    username: Optional[str] = None
    content: str
    is_staff: bool = False
    is_internal: bool = False


# ── Config ─────────────────────────────────────────────────────────────────────

@router.get("/config")
def get_config(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cfg = db.execute(
        select(QueueConfig).where(QueueConfig.guild_id == guild_id)
    ).scalar_one_or_none()
    if not cfg:
        return {
            "enabled": False, "category_id": None, "support_role_id": None,
            "log_channel_id": None, "sla_response_minutes": 30,
            "sla_resolve_minutes": 1440, "max_open_per_user": 1,
            "close_on_resolve": False, "transcript_channel_id": None,
            "welcome_message": None,
        }
    return {
        "enabled": cfg.enabled, "category_id": cfg.category_id,
        "support_role_id": cfg.support_role_id, "log_channel_id": cfg.log_channel_id,
        "sla_response_minutes": cfg.sla_response_minutes,
        "sla_resolve_minutes": cfg.sla_resolve_minutes,
        "max_open_per_user": cfg.max_open_per_user,
        "close_on_resolve": cfg.close_on_resolve,
        "transcript_channel_id": cfg.transcript_channel_id,
        "welcome_message": cfg.welcome_message,
    }


@router.patch("/config")
def update_config(body: ConfigUpdate, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cfg = db.execute(
        select(QueueConfig).where(QueueConfig.guild_id == guild_id)
    ).scalar_one_or_none()
    if not cfg:
        cfg = QueueConfig(guild_id=guild_id)
        db.add(cfg)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(cfg, k, v)
    cfg.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"ok": True}


# ── Tickets ────────────────────────────────────────────────────────────────────

@router.get("/tickets")
def list_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_staff_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    q = select(SupportTicket).where(SupportTicket.guild_id == guild_id)
    if status:
        q = q.where(SupportTicket.status == status)
    if priority:
        q = q.where(SupportTicket.priority == priority)
    if assigned_staff_id is not None:
        q = q.where(SupportTicket.assigned_staff_id == assigned_staff_id)
    tickets = db.execute(
        q.order_by(SupportTicket.created_at.desc()).limit(limit).offset(offset)
    ).scalars().all()

    # Pre-fetch staff profiles for display
    staff_map: dict[int, str] = {}
    staff_ids = {t.assigned_staff_id for t in tickets if t.assigned_staff_id}
    if staff_ids:
        profiles = db.execute(
            select(StaffProfile).where(StaffProfile.id.in_(staff_ids))
        ).scalars().all()
        staff_map = {p.id: (p.display_name or p.discord_id) for p in profiles}

    now = datetime.datetime.utcnow()
    result = []
    for t in tickets:
        # Calculate SLA elapsed
        elapsed_minutes = int((now - t.created_at).total_seconds() / 60)
        result.append({
            "id": t.id,
            "ticket_number": t.ticket_number,
            "subject": t.subject,
            "status": t.status,
            "priority": t.priority,
            "category": t.category,
            "creator_discord_id": t.creator_discord_id,
            "creator_name": t.creator_name,
            "assigned_staff_id": t.assigned_staff_id,
            "assigned_staff_name": staff_map.get(t.assigned_staff_id),
            "channel_id": t.channel_id,
            "first_response_at": t.first_response_at.isoformat() if t.first_response_at else None,
            "resolved_at": t.resolved_at.isoformat() if t.resolved_at else None,
            "closed_at": t.closed_at.isoformat() if t.closed_at else None,
            "sla_response_breached": t.sla_response_breached,
            "sla_resolve_breached": t.sla_resolve_breached,
            "tags": t.tags or [],
            "internal_note": t.internal_note,
            "rating": t.rating,
            "elapsed_minutes": elapsed_minutes,
            "created_at": t.created_at.isoformat(),
            "updated_at": t.updated_at.isoformat(),
        })
    return result


@router.post("/tickets")
def create_ticket(body: TicketCreate, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    # Auto-increment ticket number per guild
    max_num = db.execute(
        select(func.max(SupportTicket.ticket_number)).where(SupportTicket.guild_id == guild_id)
    ).scalar() or 0
    ticket = SupportTicket(
        guild_id=guild_id,
        ticket_number=max_num + 1,
        subject=body.subject,
        creator_discord_id=body.creator_discord_id,
        creator_name=body.creator_name,
        priority=body.priority,
        category=body.category,
        channel_id=body.channel_id,
        tags=body.tags,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return {"id": ticket.id, "ticket_number": ticket.ticket_number, "ok": True}


@router.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    ticket = db.execute(
        select(SupportTicket).where(SupportTicket.id == ticket_id, SupportTicket.guild_id == guild_id)
    ).scalar_one_or_none()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    messages = db.execute(
        select(TicketMessage).where(TicketMessage.ticket_id == ticket_id)
        .order_by(TicketMessage.created_at)
    ).scalars().all()
    staff_name = None
    if ticket.assigned_staff_id:
        p = db.execute(select(StaffProfile).where(StaffProfile.id == ticket.assigned_staff_id)).scalar_one_or_none()
        if p:
            staff_name = p.display_name or p.discord_id
    return {
        "id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "subject": ticket.subject,
        "status": ticket.status,
        "priority": ticket.priority,
        "category": ticket.category,
        "creator_discord_id": ticket.creator_discord_id,
        "creator_name": ticket.creator_name,
        "assigned_staff_id": ticket.assigned_staff_id,
        "assigned_staff_name": staff_name,
        "channel_id": ticket.channel_id,
        "first_response_at": ticket.first_response_at.isoformat() if ticket.first_response_at else None,
        "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None,
        "closed_at": ticket.closed_at.isoformat() if ticket.closed_at else None,
        "sla_response_breached": ticket.sla_response_breached,
        "sla_resolve_breached": ticket.sla_resolve_breached,
        "tags": ticket.tags or [],
        "internal_note": ticket.internal_note,
        "rating": ticket.rating,
        "created_at": ticket.created_at.isoformat(),
        "messages": [
            {
                "id": m.id,
                "discord_id": m.discord_id,
                "username": m.username,
                "content": m.content,
                "is_staff": m.is_staff,
                "is_internal": m.is_internal,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }


@router.patch("/tickets/{ticket_id}")
def update_ticket(
    ticket_id: int,
    body: TicketUpdate,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    ticket = db.execute(
        select(SupportTicket).where(SupportTicket.id == ticket_id, SupportTicket.guild_id == guild_id)
    ).scalar_one_or_none()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    data = body.model_dump(exclude_none=True)
    now = datetime.datetime.utcnow()
    # Status transitions
    new_status = data.get("status")
    if new_status in ("resolved",) and not ticket.resolved_at:
        ticket.resolved_at = now
    if new_status in ("closed",) and not ticket.closed_at:
        ticket.closed_at = now
    for k, v in data.items():
        setattr(ticket, k, v)
    ticket.updated_at = now
    db.commit()
    return {"ok": True}


@router.post("/tickets/{ticket_id}/claim")
def claim_ticket(
    ticket_id: int,
    staff_id: int,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    ticket = db.execute(
        select(SupportTicket).where(SupportTicket.id == ticket_id, SupportTicket.guild_id == guild_id)
    ).scalar_one_or_none()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    ticket.assigned_staff_id = staff_id
    ticket.status = "claimed"
    ticket.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/tickets/{ticket_id}/messages")
def add_message(
    ticket_id: int,
    body: MessageCreate,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    ticket = db.execute(
        select(SupportTicket).where(SupportTicket.id == ticket_id, SupportTicket.guild_id == guild_id)
    ).scalar_one_or_none()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    msg = TicketMessage(
        guild_id=guild_id,
        ticket_id=ticket_id,
        discord_id=body.discord_id,
        username=body.username,
        content=body.content,
        is_staff=body.is_staff,
        is_internal=body.is_internal,
    )
    db.add(msg)
    # Track first staff response for SLA
    if body.is_staff and not ticket.first_response_at:
        ticket.first_response_at = datetime.datetime.utcnow()
        ticket.status = "in_progress"
    ticket.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"id": msg.id, "ok": True}


# ── SLA Check (called by bot worker) ─────────────────────────────────────────

@router.post("/sla-check")
def run_sla_check(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Mark tickets that have breached SLA. Called by bot worker loop."""
    cfg = db.execute(
        select(QueueConfig).where(QueueConfig.guild_id == guild_id)
    ).scalar_one_or_none()
    if not cfg:
        return {"breached": 0}
    now = datetime.datetime.utcnow()
    open_tickets = db.execute(
        select(SupportTicket).where(
            SupportTicket.guild_id == guild_id,
            SupportTicket.status.in_(OPEN_STATUSES),
        )
    ).scalars().all()
    breached = 0
    for t in open_tickets:
        elapsed = (now - t.created_at).total_seconds() / 60
        if not t.sla_response_breached and not t.first_response_at:
            if elapsed > cfg.sla_response_minutes:
                t.sla_response_breached = True
                breached += 1
        if not t.sla_resolve_breached and t.status not in ("resolved", "closed"):
            if elapsed > cfg.sla_resolve_minutes:
                t.sla_resolve_breached = True
                breached += 1
    if breached:
        db.commit()
    return {"breached": breached}


# ── Stats ──────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    all_tickets = db.execute(
        select(SupportTicket).where(SupportTicket.guild_id == guild_id)
    ).scalars().all()
    open_count = sum(1 for t in all_tickets if t.status in OPEN_STATUSES)
    breached_count = sum(1 for t in all_tickets if t.sla_response_breached or t.sla_resolve_breached)
    resolved = [t for t in all_tickets if t.resolved_at]
    avg_resolve_min = 0.0
    if resolved:
        times = [(t.resolved_at - t.created_at).total_seconds() / 60 for t in resolved]
        avg_resolve_min = sum(times) / len(times)
    avg_rating = 0.0
    rated = [t for t in all_tickets if t.rating]
    if rated:
        avg_rating = sum(t.rating for t in rated) / len(rated)
    return {
        "total": len(all_tickets),
        "open": open_count,
        "resolved": len(resolved),
        "sla_breached": breached_count,
        "avg_resolve_minutes": round(avg_resolve_min, 1),
        "avg_rating": round(avg_rating, 2),
    }
