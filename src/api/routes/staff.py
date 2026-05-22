"""Staff Management API — profiles, shifts, commission rules & logs."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
import datetime

from src.database.config import get_db
from src.models.models import StaffProfile, StaffShift, CommissionRule, CommissionLog
from src.api.deps import get_guild_id, require_staff_perm

router = APIRouter(
    prefix="/api/staff",
    dependencies=[Depends(require_staff_perm("can_shop"))],
)


# ── Schemas ────────────────────────────────────────────────────────────────────

class ProfileCreate(BaseModel):
    discord_id: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role_title: Optional[str] = None
    commission_rate: float = 0.0
    notes: Optional[str] = None

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    role_title: Optional[str] = None
    commission_rate: Optional[float] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

class RuleCreate(BaseModel):
    name: str
    rule_type: str = "flat_rate"
    rate: float
    min_order_value: float = 0.0
    category_id: Optional[int] = None
    active: bool = True
    priority: int = 0

class MarkPaidBody(BaseModel):
    log_ids: list[int]
    note: Optional[str] = None


# ── Staff Profiles ─────────────────────────────────────────────────────────────

@router.get("/profiles")
def list_profiles(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rows = db.execute(
        select(StaffProfile).where(StaffProfile.guild_id == guild_id)
        .order_by(StaffProfile.display_name)
    ).scalars().all()
    result = []
    for p in rows:
        # Current shift (clocked in but not out)
        active_shift = db.execute(
            select(StaffShift)
            .where(StaffShift.staff_id == p.id, StaffShift.clock_out.is_(None))
            .order_by(StaffShift.clock_in.desc())
            .limit(1)
        ).scalar_one_or_none()
        result.append({
            "id": p.id,
            "discord_id": p.discord_id,
            "display_name": p.display_name,
            "avatar_url": p.avatar_url,
            "role_title": p.role_title,
            "commission_rate": p.commission_rate,
            "total_orders_handled": p.total_orders_handled,
            "total_commission_earned": p.total_commission_earned,
            "total_hours_worked": p.total_hours_worked,
            "is_active": p.is_active,
            "notes": p.notes,
            "clocked_in": active_shift is not None,
            "clock_in_at": active_shift.clock_in.isoformat() if active_shift else None,
            "created_at": p.created_at.isoformat(),
        })
    return result


@router.post("/profiles")
def create_profile(body: ProfileCreate, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    existing = db.execute(
        select(StaffProfile).where(
            StaffProfile.guild_id == guild_id,
            StaffProfile.discord_id == body.discord_id,
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "Staff profile already exists for this Discord user")
    profile = StaffProfile(
        guild_id=guild_id,
        discord_id=body.discord_id,
        display_name=body.display_name,
        avatar_url=body.avatar_url,
        role_title=body.role_title,
        commission_rate=body.commission_rate,
        notes=body.notes,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return {"id": profile.id, "ok": True}


@router.patch("/profiles/{profile_id}")
def update_profile(
    profile_id: int,
    body: ProfileUpdate,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    profile = db.execute(
        select(StaffProfile).where(StaffProfile.id == profile_id, StaffProfile.guild_id == guild_id)
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(profile, k, v)
    profile.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.delete("/profiles/{profile_id}")
def delete_profile(profile_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    profile = db.execute(
        select(StaffProfile).where(StaffProfile.id == profile_id, StaffProfile.guild_id == guild_id)
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")
    db.delete(profile)
    db.commit()
    return {"ok": True}


# ── Shifts ─────────────────────────────────────────────────────────────────────

@router.get("/profiles/{profile_id}/shifts")
def list_shifts(
    profile_id: int,
    limit: int = 50,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    shifts = db.execute(
        select(StaffShift)
        .where(StaffShift.staff_id == profile_id, StaffShift.guild_id == guild_id)
        .order_by(StaffShift.clock_in.desc())
        .limit(limit)
    ).scalars().all()
    return [
        {
            "id": s.id,
            "clock_in": s.clock_in.isoformat(),
            "clock_out": s.clock_out.isoformat() if s.clock_out else None,
            "duration_minutes": s.duration_minutes,
            "note": s.note,
        }
        for s in shifts
    ]


@router.post("/profiles/{profile_id}/clockin")
def clock_in(
    profile_id: int,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    profile = db.execute(
        select(StaffProfile).where(StaffProfile.id == profile_id, StaffProfile.guild_id == guild_id)
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")
    # Check if already clocked in
    active = db.execute(
        select(StaffShift).where(StaffShift.staff_id == profile_id, StaffShift.clock_out.is_(None))
    ).scalar_one_or_none()
    if active:
        raise HTTPException(400, "Already clocked in")
    shift = StaffShift(
        guild_id=guild_id,
        staff_id=profile_id,
        clock_in=datetime.datetime.utcnow(),
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return {"id": shift.id, "clock_in": shift.clock_in.isoformat()}


@router.post("/profiles/{profile_id}/clockout")
def clock_out(
    profile_id: int,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    active = db.execute(
        select(StaffShift).where(
            StaffShift.staff_id == profile_id,
            StaffShift.guild_id == guild_id,
            StaffShift.clock_out.is_(None),
        )
    ).scalar_one_or_none()
    if not active:
        raise HTTPException(400, "Not currently clocked in")
    now = datetime.datetime.utcnow()
    active.clock_out = now
    diff = now - active.clock_in
    active.duration_minutes = int(diff.total_seconds() / 60)
    # Update profile total
    profile = db.execute(
        select(StaffProfile).where(StaffProfile.id == profile_id)
    ).scalar_one_or_none()
    if profile:
        profile.total_hours_worked = (profile.total_hours_worked or 0) + diff.total_seconds() / 3600
    db.commit()
    return {"duration_minutes": active.duration_minutes}


# ── Commission Rules ───────────────────────────────────────────────────────────

@router.get("/commission-rules")
def list_rules(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rules = db.execute(
        select(CommissionRule).where(CommissionRule.guild_id == guild_id)
        .order_by(CommissionRule.priority.desc())
    ).scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "rule_type": r.rule_type,
            "rate": r.rate,
            "min_order_value": r.min_order_value,
            "category_id": r.category_id,
            "active": r.active,
            "priority": r.priority,
        }
        for r in rules
    ]


@router.post("/commission-rules")
def create_rule(body: RuleCreate, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rule = CommissionRule(guild_id=guild_id, **body.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {"id": rule.id, "ok": True}


@router.patch("/commission-rules/{rule_id}")
def update_rule(
    rule_id: int,
    body: RuleCreate,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    rule = db.execute(
        select(CommissionRule).where(CommissionRule.id == rule_id, CommissionRule.guild_id == guild_id)
    ).scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")
    for k, v in body.model_dump().items():
        setattr(rule, k, v)
    db.commit()
    return {"ok": True}


@router.delete("/commission-rules/{rule_id}")
def delete_rule(rule_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rule = db.execute(
        select(CommissionRule).where(CommissionRule.id == rule_id, CommissionRule.guild_id == guild_id)
    ).scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")
    db.delete(rule)
    db.commit()
    return {"ok": True}


# ── Commission Logs ────────────────────────────────────────────────────────────

@router.get("/commission-logs")
def list_commission_logs(
    paid: Optional[bool] = None,
    limit: int = 100,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    q = select(CommissionLog).where(CommissionLog.guild_id == guild_id)
    if paid is not None:
        q = q.where(CommissionLog.paid == paid)
    logs = db.execute(q.order_by(CommissionLog.created_at.desc()).limit(limit)).scalars().all()
    return [
        {
            "id": lg.id,
            "staff_id": lg.staff_id,
            "order_id": lg.order_id,
            "order_value": lg.order_value,
            "commission_rate": lg.commission_rate,
            "commission_amount": lg.commission_amount,
            "paid": lg.paid,
            "paid_at": lg.paid_at.isoformat() if lg.paid_at else None,
            "note": lg.note,
            "created_at": lg.created_at.isoformat(),
        }
        for lg in logs
    ]


@router.post("/commission-logs/mark-paid")
def mark_commissions_paid(
    body: MarkPaidBody,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    logs = db.execute(
        select(CommissionLog).where(
            CommissionLog.guild_id == guild_id,
            CommissionLog.id.in_(body.log_ids),
        )
    ).scalars().all()
    now = datetime.datetime.utcnow()
    for lg in logs:
        lg.paid = True
        lg.paid_at = now
        if body.note:
            lg.note = body.note
    db.commit()
    return {"updated": len(logs)}


# ── Summary ────────────────────────────────────────────────────────────────────

@router.get("/summary")
def staff_summary(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Overall staff KPIs for dashboard overview."""
    profiles = db.execute(
        select(StaffProfile).where(StaffProfile.guild_id == guild_id, StaffProfile.is_active == True)
    ).scalars().all()

    total_staff = len(profiles)
    clocked_in = 0
    for p in profiles:
        active = db.execute(
            select(StaffShift).where(StaffShift.staff_id == p.id, StaffShift.clock_out.is_(None))
        ).scalar_one_or_none()
        if active:
            clocked_in += 1

    total_commission_unpaid = db.execute(
        select(func.sum(CommissionLog.commission_amount)).where(
            CommissionLog.guild_id == guild_id,
            CommissionLog.paid == False,
        )
    ).scalar() or 0.0

    return {
        "total_staff": total_staff,
        "clocked_in": clocked_in,
        "total_commission_unpaid": total_commission_unpaid,
    }
