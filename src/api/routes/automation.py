"""Automation Engine API — IF/THEN rule CRUD + execution logs."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import datetime

from src.database.config import get_db
from src.models.models import AutomationRule, AutomationLog
from src.api.deps import get_guild_id, require_staff_perm

router = APIRouter(
    prefix="/api/automation",
    dependencies=[Depends(require_staff_perm("can_shop"))],
)

# ── Trigger & Action catalogs (for frontend dropdowns) ──────────────────────────

TRIGGER_TYPES = [
    {"value": "order_placed",     "label": "Order Placed"},
    {"value": "order_paid",       "label": "Order Paid"},
    {"value": "order_delivered",  "label": "Order Delivered"},
    {"value": "order_cancelled",  "label": "Order Cancelled"},
    {"value": "member_join",      "label": "Member Joined"},
    {"value": "member_leave",     "label": "Member Left"},
    {"value": "role_add",         "label": "Role Added to Member"},
    {"value": "role_remove",      "label": "Role Removed from Member"},
    {"value": "milestone_reached","label": "Spending Milestone Reached"},
    {"value": "low_stock",        "label": "Product Low Stock"},
    {"value": "flash_sale_start", "label": "Flash Sale Started"},
    {"value": "flash_sale_end",   "label": "Flash Sale Ended"},
    {"value": "staff_clockin",    "label": "Staff Clocked In"},
    {"value": "staff_clockout",   "label": "Staff Clocked Out"},
]

ACTION_TYPES = [
    {"value": "send_message",   "label": "Send Message to Channel"},
    {"value": "send_dm",        "label": "Send DM to User"},
    {"value": "add_role",       "label": "Add Role to Member"},
    {"value": "remove_role",    "label": "Remove Role from Member"},
    {"value": "create_order_log","label": "Add Order Log Entry"},
    {"value": "notify_staff",   "label": "Notify Staff Channel"},
    {"value": "apply_coupon",   "label": "Auto-Apply Coupon"},
    {"value": "webhook",        "label": "Send Webhook"},
]

CONDITION_OPERATORS = [
    {"value": "eq",         "label": "equals"},
    {"value": "neq",        "label": "not equals"},
    {"value": "gt",         "label": "greater than"},
    {"value": "lt",         "label": "less than"},
    {"value": "gte",        "label": "greater than or equal"},
    {"value": "lte",        "label": "less than or equal"},
    {"value": "contains",   "label": "contains"},
    {"value": "in",         "label": "is one of"},
]


# ── Schemas ─────────────────────────────────────────────────────────────────────

class RuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    enabled: bool = True
    trigger_type: str
    trigger_config: dict = {}
    conditions: list = []
    actions: list = []

class RuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    trigger_type: Optional[str] = None
    trigger_config: Optional[dict] = None
    conditions: Optional[list] = None
    actions: Optional[list] = None


# ── Catalog ──────────────────────────────────────────────────────────────────────

@router.get("/catalog")
def get_catalog():
    """Return trigger types, action types, and condition operators for UI dropdowns."""
    return {
        "trigger_types": TRIGGER_TYPES,
        "action_types": ACTION_TYPES,
        "condition_operators": CONDITION_OPERATORS,
    }


# ── Rules CRUD ───────────────────────────────────────────────────────────────────

@router.get("/rules")
def list_rules(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rules = db.execute(
        select(AutomationRule).where(AutomationRule.guild_id == guild_id)
        .order_by(AutomationRule.created_at.desc())
    ).scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "enabled": r.enabled,
            "trigger_type": r.trigger_type,
            "trigger_config": r.trigger_config,
            "conditions": r.conditions,
            "actions": r.actions,
            "run_count": r.run_count,
            "last_run_at": r.last_run_at.isoformat() if r.last_run_at else None,
            "created_at": r.created_at.isoformat(),
        }
        for r in rules
    ]


@router.post("/rules")
def create_rule(body: RuleCreate, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rule = AutomationRule(guild_id=guild_id, **body.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {"id": rule.id, "ok": True}


@router.patch("/rules/{rule_id}")
def update_rule(
    rule_id: int,
    body: RuleUpdate,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    rule = db.execute(
        select(AutomationRule).where(AutomationRule.id == rule_id, AutomationRule.guild_id == guild_id)
    ).scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(rule, k, v)
    rule.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.delete("/rules/{rule_id}")
def delete_rule(rule_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rule = db.execute(
        select(AutomationRule).where(AutomationRule.id == rule_id, AutomationRule.guild_id == guild_id)
    ).scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")
    db.delete(rule)
    db.commit()
    return {"ok": True}


@router.post("/rules/{rule_id}/toggle")
def toggle_rule(rule_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rule = db.execute(
        select(AutomationRule).where(AutomationRule.id == rule_id, AutomationRule.guild_id == guild_id)
    ).scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")
    rule.enabled = not rule.enabled
    db.commit()
    return {"enabled": rule.enabled}


# ── Execution Logs ───────────────────────────────────────────────────────────────

@router.get("/logs")
def list_logs(
    rule_id: Optional[int] = None,
    limit: int = 100,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    q = select(AutomationLog).where(AutomationLog.guild_id == guild_id)
    if rule_id:
        q = q.where(AutomationLog.rule_id == rule_id)
    logs = db.execute(q.order_by(AutomationLog.created_at.desc()).limit(limit)).scalars().all()
    return [
        {
            "id": lg.id,
            "rule_id": lg.rule_id,
            "trigger_data": lg.trigger_data,
            "actions_taken": lg.actions_taken,
            "success": lg.success,
            "error": lg.error,
            "created_at": lg.created_at.isoformat(),
        }
        for lg in logs
    ]
