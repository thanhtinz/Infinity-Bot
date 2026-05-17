"""Firewall rules + logs API — per-guild blocklist/allowlist system."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.api.dependencies import get_guild_id
from src.models.models import FirewallRule, FirewallLog

router = APIRouter(prefix="/api/firewall", tags=["firewall"])


# ── Rules CRUD ────────────────────────────────────────────────────────────

@router.get("/rules")
def list_rules(
    rule_type: str | None = None,
    target_type: str | None = None,
    db: Session = Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    q = select(FirewallRule).where(FirewallRule.guild_id == guild_id)
    if rule_type:
        q = q.where(FirewallRule.rule_type == rule_type)
    if target_type:
        q = q.where(FirewallRule.target_type == target_type)
    q = q.order_by(FirewallRule.created_at.desc())
    rules = db.execute(q).scalars().all()
    return [
        {
            "id": r.id,
            "rule_type": r.rule_type,
            "target_type": r.target_type,
            "target_value": r.target_value,
            "reason": r.reason,
            "created_by": r.created_by,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rules
    ]


@router.post("/rules")
def create_rule(body: dict, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rule_type = body.get("rule_type", "block")
    target_type = body.get("target_type")
    target_value = body.get("target_value")
    if not target_type or not target_value:
        raise HTTPException(400, "target_type and target_value are required")
    if rule_type not in ("block", "allow"):
        raise HTTPException(400, "rule_type must be 'block' or 'allow'")
    if target_type not in ("user_id", "ip", "country", "email_domain", "asn"):
        raise HTTPException(400, "Invalid target_type")

    rule = FirewallRule(
        guild_id=guild_id,
        rule_type=rule_type,
        target_type=target_type,
        target_value=target_value.strip(),
        reason=body.get("reason"),
        created_by=body.get("created_by"),
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {"id": rule.id, "ok": True}


@router.delete("/rules/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rule = db.execute(
        select(FirewallRule).where(FirewallRule.id == rule_id, FirewallRule.guild_id == guild_id)
    ).scalars().first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    db.delete(rule)
    db.commit()
    return {"ok": True}


@router.delete("/rules")
def bulk_delete_rules(body: dict, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    ids = body.get("ids", [])
    if not ids:
        raise HTTPException(400, "ids required")
    for rule_id in ids:
        rule = db.execute(
            select(FirewallRule).where(FirewallRule.id == rule_id, FirewallRule.guild_id == guild_id)
        ).scalars().first()
        if rule:
            db.delete(rule)
    db.commit()
    return {"ok": True, "deleted": len(ids)}


# ── Logs ──────────────────────────────────────────────────────────────────

@router.get("/logs")
def list_logs(
    blocked_by: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    q = select(FirewallLog).where(FirewallLog.guild_id == guild_id)
    if blocked_by:
        q = q.where(FirewallLog.blocked_by == blocked_by)
    q = q.order_by(FirewallLog.created_at.desc()).limit(limit).offset(offset)
    logs = db.execute(q).scalars().all()
    return [
        {
            "id": l.id,
            "discord_id": l.discord_id,
            "username": l.username,
            "avatar_url": l.avatar_url,
            "ip_address": l.ip_address,
            "country": l.country,
            "blocked_by": l.blocked_by,
            "rule_id": l.rule_id,
            "details": l.details,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]


@router.get("/stats")
def firewall_stats(db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    now = datetime.utcnow()
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)

    total_rules = db.execute(
        select(func.count(FirewallRule.id)).where(FirewallRule.guild_id == guild_id)
    ).scalar() or 0

    blocks_24h = db.execute(
        select(func.count(FirewallLog.id)).where(
            and_(FirewallLog.guild_id == guild_id, FirewallLog.created_at >= day_ago)
        )
    ).scalar() or 0

    blocks_week = db.execute(
        select(func.count(FirewallLog.id)).where(
            and_(FirewallLog.guild_id == guild_id, FirewallLog.created_at >= week_ago)
        )
    ).scalar() or 0

    # Breakdown by type (last 24h)
    breakdown_rows = db.execute(
        select(FirewallLog.blocked_by, func.count(FirewallLog.id)).where(
            and_(FirewallLog.guild_id == guild_id, FirewallLog.created_at >= day_ago)
        ).group_by(FirewallLog.blocked_by)
    ).all()
    breakdown = {row[0]: row[1] for row in breakdown_rows}

    return {
        "total_rules": total_rules,
        "blocks_24h": blocks_24h,
        "blocks_week": blocks_week,
        "breakdown": breakdown,
    }
