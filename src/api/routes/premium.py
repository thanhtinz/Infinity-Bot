"""Premium billing routes: plans, subscriptions, payments, config, reminder scan."""
import logging
import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from src.database.config import get_db
from src.models.models import (
    PremiumPlan,
    GuildSubscription,
    SubscriptionPayment,
    SystemConfig,
    PremiumCoupon,
    CouponRedemption,
)
from src.api.deps import get_guild_id, require_auth, require_owner

logger = logging.getLogger(__name__)


# ── Premium feature cleanup ────────────────────────────────────────────────────
# Maps feature key → list of (model, field, reset_value) to clear when revoked.
# reset_value=None → NULL, reset_value=<other> → set to that default value.
_FEATURE_CLEANUP: dict[str, list[tuple]] = {}

def _cleanup_premium_features(guild_id: str, lost_features: set[str], db) -> None:
    """Clear guild data for features that are no longer accessible."""
    for feature in lost_features:
        if feature == "animated_gif":
            # Only null GIF URLs — keep non-gif URLs intact
            from sqlalchemy import select as _select
            for model_cls, field, _ in _FEATURE_CLEANUP.get(feature, []):
                rows = db.execute(_select(model_cls).where(model_cls.guild_id == guild_id)).scalars().all()
                for row in rows:
                    val = getattr(row, field, None)
                    if val and str(val).lower().endswith(".gif"):
                        setattr(row, field, None)
                        logger.info(f"Cleared {model_cls.__tablename__}.{field} (gif) for guild {guild_id} (feature 'animated_gif' revoked)")
            continue
        for model_cls, field, reset_val in _FEATURE_CLEANUP.get(feature, []):
            db.execute(
                update(model_cls)
                .where(model_cls.guild_id == guild_id)
                .values({field: reset_val})
            )
            logger.info(f"Cleared {model_cls.__tablename__}.{field}={reset_val!r} for guild {guild_id} (feature '{feature}' revoked)")
router = APIRouter()

# ── constants ─────────────────────────────────────────────────────────────────
VALID_INTERVALS = {"monthly", "quarterly", "yearly", "lifetime"}
VALID_STATUSES  = {"trial", "active", "past_due", "expired", "cancelled", "manual_review"}
VALID_PROVIDERS = {"payos", "paypal", "crypto", "manual"}
VALID_PAY_STATUS = {"pending", "paid", "failed", "refunded"}
MAX_STR = 500   # max length for free-form text fields


# ── helpers ───────────────────────────────────────────────────────────────────

def _get_config(db) -> SystemConfig:
    cfg = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not cfg:
        raise HTTPException(404, "SystemConfig not found")
    return cfg


def _parse_dt(value: Optional[str], field: str) -> Optional[datetime.datetime]:
    """Parse ISO datetime string → datetime, raise 400 on bad format."""
    if not value:
        return None
    try:
        return datetime.datetime.fromisoformat(value)
    except (ValueError, TypeError):
        raise HTTPException(400, f"Invalid datetime for '{field}': {value!r}")


def _validate_str(value: Optional[str], field: str, max_len: int = MAX_STR) -> Optional[str]:
    if value is None:
        return None
    v = str(value).strip()
    if len(v) > max_len:
        raise HTTPException(400, f"'{field}' exceeds max length of {max_len}")
    return v


def _plan_dict(p: PremiumPlan) -> dict:
    return {
        "id": p.id,
        "code": p.code,
        "name": p.name,
        "description": p.description,
        "price": p.price,
        "currency": p.currency,
        "interval": p.interval,
        "active": p.active,
        "is_public": p.is_public,
        "sort_order": p.sort_order,
        "badge_text": p.badge_text,
        "color": p.color,
        "features": p.features or {},
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _sub_dict(s: GuildSubscription) -> dict:
    return {
        "id": s.id,
        "guild_id": s.guild_id,
        "plan_id": s.plan_id,
        "plan": _plan_dict(s.plan) if s.plan else None,
        "status": s.status,
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "current_period_start": s.current_period_start.isoformat() if s.current_period_start else None,
        "current_period_end": s.current_period_end.isoformat() if s.current_period_end else None,
        "cancel_at_period_end": s.cancel_at_period_end,
        "auto_renew": s.auto_renew,
        "renewal_reminder_days": s.renewal_reminder_days,
        "last_reminder_at": s.last_reminder_at.isoformat() if s.last_reminder_at else None,
        "payment_provider": s.payment_provider,
        "notes": s.notes,
        "created_by": s.created_by,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def _payment_dict(p: SubscriptionPayment) -> dict:
    return {
        "id": p.id,
        "guild_id": p.guild_id,
        "subscription_id": p.subscription_id,
        "plan_id": p.plan_id,
        "plan": _plan_dict(p.plan) if p.plan else None,
        "amount": p.amount,
        "currency": p.currency,
        "payment_method": p.payment_method,
        "status": p.status,
        "provider_payment_id": p.provider_payment_id,
        "period_start": p.period_start.isoformat() if p.period_start else None,
        "period_end": p.period_end.isoformat() if p.period_end else None,
        "notes": p.notes,
        "paid_at": p.paid_at.isoformat() if p.paid_at else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


# ── Premium Payment Config ─────────────────────────────────────────────────────

@router.get("/premium/config")
def get_premium_config(
    db=Depends(get_db),
    _user=Depends(require_auth),      # any logged-in user can read config
):
    cfg = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not cfg:
        return {}
    return {
        "currency": cfg.currency,
        "currency_symbol": cfg.currency_symbol,
        "payment_methods": cfg.payment_methods or [],
        "paypal_client_id": cfg.paypal_client_id,
        "paypal_client_secret": cfg.paypal_client_secret,
        "paypal_mode": cfg.paypal_mode or "live",
        "manual_bank_name": cfg.manual_bank_name,
        "manual_account_holder": cfg.manual_account_holder,
        "manual_account_number": cfg.manual_account_number,
        "manual_qr_image_id": cfg.manual_qr_image_id,
        "premium_payment_instructions": cfg.premium_payment_instructions,
        "premium_default_renewal_days": cfg.premium_default_renewal_days or 7,
        "premium_renewal_channel_id": cfg.premium_renewal_channel_id,
    }


@router.post("/premium/config")
def save_premium_config(
    body: dict,
    db=Depends(get_db),
    _owner=Depends(require_owner),    # OWNER ONLY
):
    cfg = _get_config(db)
    allowed_str = {
        "premium_payment_instructions",
        "premium_renewal_channel_id",
        "manual_bank_name",
        "manual_account_holder",
        "manual_account_number",
        "paypal_client_id",
        "paypal_client_secret",
        "currency",
        "currency_symbol",
        "paypal_mode",
    }
    for key, val in body.items():
        if key == "premium_default_renewal_days":
            days = int(val) if val is not None else 7
            if days < 0 or days > 365:
                raise HTTPException(400, "premium_default_renewal_days must be 0–365")
            cfg.premium_default_renewal_days = days
        elif key == "payment_methods":
            if isinstance(val, list):
                cfg.payment_methods = val
        elif key in allowed_str:
            setattr(cfg, key, _validate_str(val, key, max_len=2000) if val is not None else None)
    db.commit()
    return {"ok": True}


# ── Plans CRUD ─────────────────────────────────────────────────────────────────

@router.get("/premium/plans")
def list_plans(
    db=Depends(get_db),
    _owner=Depends(require_owner),
):
    rows = db.execute(select(PremiumPlan).order_by(PremiumPlan.sort_order, PremiumPlan.id)).scalars().all()
    return [_plan_dict(p) for p in rows]


@router.get("/premium/plans/public")
def list_public_plans(db=Depends(get_db)):
    """Public — no auth required. Only active + public plans."""
    rows = db.execute(
        select(PremiumPlan)
        .where(PremiumPlan.active == True, PremiumPlan.is_public == True)
        .order_by(PremiumPlan.sort_order, PremiumPlan.id)
    ).scalars().all()
    return [_plan_dict(p) for p in rows]


@router.post("/premium/plans")
def create_plan(
    body: dict,
    db=Depends(get_db),
    _owner=Depends(require_owner),
):
    code = _validate_str(body.get("code"), "code", 64)
    name = _validate_str(body.get("name"), "name", 128)
    if not code or not name:
        raise HTTPException(400, "code and name are required")

    interval = body.get("interval", "monthly")
    if interval not in VALID_INTERVALS:
        raise HTTPException(400, f"interval must be one of {VALID_INTERVALS}")

    price = body.get("price", 0.0)
    if not isinstance(price, (int, float)) or price < 0:
        raise HTTPException(400, "price must be a non-negative number")

    existing = db.execute(select(PremiumPlan).where(PremiumPlan.code == code)).scalars().first()
    if existing:
        raise HTTPException(400, f"Plan code '{code}' already exists")

    plan = PremiumPlan(
        code=code,
        name=name,
        description=_validate_str(body.get("description"), "description", 1000),
        price=float(price),
        currency=_validate_str(body.get("currency", "VND"), "currency", 8),
        interval=interval,
        active=bool(body.get("active", True)),
        is_public=bool(body.get("is_public", True)),
        sort_order=int(body.get("sort_order", 0)),
        badge_text=_validate_str(body.get("badge_text"), "badge_text", 32),
        color=_validate_str(body.get("color", "#6366f1"), "color", 16),
        features=body.get("features") if isinstance(body.get("features"), dict) else {},
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _plan_dict(plan)


@router.put("/premium/plans/{plan_id}")
def update_plan(
    plan_id: int,
    body: dict,
    db=Depends(get_db),
    _owner=Depends(require_owner),
):
    plan = db.execute(select(PremiumPlan).where(PremiumPlan.id == plan_id)).scalars().first()
    if not plan:
        raise HTTPException(404, "Plan not found")

    if "interval" in body and body["interval"] not in VALID_INTERVALS:
        raise HTTPException(400, f"interval must be one of {VALID_INTERVALS}")
    if "price" in body:
        p = body["price"]
        if not isinstance(p, (int, float)) or p < 0:
            raise HTTPException(400, "price must be a non-negative number")
        plan.price = float(p)

    str_fields = {"name": 128, "description": 1000, "currency": 8, "badge_text": 32, "color": 16}
    for field, maxlen in str_fields.items():
        if field in body:
            setattr(plan, field, _validate_str(body[field], field, maxlen))

    for field in {"interval", "active", "is_public", "sort_order"}:
        if field in body:
            setattr(plan, field, body[field])

    if "features" in body:
        plan.features = body["features"] if isinstance(body["features"], dict) else {}

    plan.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(plan)
    return _plan_dict(plan)


@router.delete("/premium/plans/{plan_id}")
def archive_plan(
    plan_id: int,
    db=Depends(get_db),
    _owner=Depends(require_owner),
):
    """Soft-delete: mark inactive."""
    plan = db.execute(select(PremiumPlan).where(PremiumPlan.id == plan_id)).scalars().first()
    if not plan:
        raise HTTPException(404, "Plan not found")
    plan.active = False
    plan.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"ok": True}


# ── Subscriptions ──────────────────────────────────────────────────────────────

@router.get("/premium/subscriptions")
def list_all_subscriptions(
    db=Depends(get_db),
    _owner=Depends(require_owner),
):
    rows = db.execute(
        select(GuildSubscription)
        .options(joinedload(GuildSubscription.plan))
        .order_by(GuildSubscription.current_period_end)
    ).scalars().all()
    return [_sub_dict(s) for s in rows]


@router.get("/premium/subscriptions/guild")
def get_guild_subscription(
    guild_id: str = Depends(get_guild_id),
    db=Depends(get_db),
    _user=Depends(require_auth),
):
    """Active subscription for the requesting guild."""
    sub = db.execute(
        select(GuildSubscription)
        .options(joinedload(GuildSubscription.plan))
        .where(
            GuildSubscription.guild_id == guild_id,
            GuildSubscription.status.in_(["active", "trial", "past_due"]),
        )
        .order_by(GuildSubscription.current_period_end.desc())
        .limit(1)
    ).scalars().first()
    return _sub_dict(sub) if sub else None


@router.post("/premium/subscriptions")
def create_subscription(
    body: dict,
    db=Depends(get_db),
    _owner=Depends(require_owner),
):
    """Owner creates a manual subscription for a guild."""
    guild_id = _validate_str(body.get("guild_id"), "guild_id", 32)
    if not guild_id:
        raise HTTPException(400, "guild_id is required")

    plan_id = body.get("plan_id")
    if not isinstance(plan_id, int):
        raise HTTPException(400, "plan_id must be an integer")

    status = body.get("status", "active")
    if status not in VALID_STATUSES:
        raise HTTPException(400, f"status must be one of {VALID_STATUSES}")

    provider = body.get("payment_provider", "manual")
    if provider not in VALID_PROVIDERS:
        raise HTTPException(400, f"payment_provider must be one of {VALID_PROVIDERS}")

    plan = db.execute(select(PremiumPlan).where(PremiumPlan.id == plan_id)).scalars().first()
    if not plan:
        raise HTTPException(404, "Plan not found")

    renewal_days = int(body.get("renewal_reminder_days", 7))
    if not 0 <= renewal_days <= 365:
        raise HTTPException(400, "renewal_reminder_days must be 0–365")

    now = datetime.datetime.utcnow()
    period_end = _parse_dt(body.get("current_period_end"), "current_period_end")
    if period_end is None:
        delta_map = {"monthly": 30, "quarterly": 90, "yearly": 365, "lifetime": 36500}
        period_end = now + datetime.timedelta(days=delta_map.get(plan.interval, 30))

    sub = GuildSubscription(
        guild_id=guild_id,
        plan_id=plan_id,
        status=status,
        started_at=now,
        current_period_start=now,
        current_period_end=period_end,
        auto_renew=bool(body.get("auto_renew", True)),
        renewal_reminder_days=renewal_days,
        payment_provider=provider,
        notes=_validate_str(body.get("notes"), "notes", 1000),
        created_by=_validate_str(body.get("created_by"), "created_by", 64),
    )
    db.add(sub)

    # Record initial payment if amount provided
    if body.get("amount") is not None:
        amount = body["amount"]
        if not isinstance(amount, (int, float)) or amount < 0:
            raise HTTPException(400, "amount must be a non-negative number")
        payment = SubscriptionPayment(
            guild_id=guild_id,
            subscription_id=None,   # set after flush
            plan_id=plan_id,
            amount=float(amount),
            currency=_validate_str(body.get("currency", plan.currency), "currency", 8),
            payment_method=provider,
            status="paid",
            notes=_validate_str(body.get("notes"), "notes", 1000),
            paid_at=now,
            period_start=now,
            period_end=period_end,
        )
        db.add(payment)

    try:
        db.flush()
        # link payment to subscription now that sub.id exists
        if body.get("amount") is not None:
            payment.subscription_id = sub.id
        db.commit()
    except IntegrityError as e:
        db.rollback()
        logger.warning("create_subscription integrity error: %s", e)
        raise HTTPException(400, "Database constraint error — check plan_id and guild_id")

    db.refresh(sub)
    # eagerly load plan for _sub_dict
    _ = sub.plan
    return _sub_dict(sub)


@router.put("/premium/subscriptions/{sub_id}")
def update_subscription(
    sub_id: int,
    body: dict,
    db=Depends(get_db),
    _owner=Depends(require_owner),
):
    sub = db.execute(
        select(GuildSubscription).options(joinedload(GuildSubscription.plan))
        .where(GuildSubscription.id == sub_id)
    ).scalars().first()
    if not sub:
        raise HTTPException(404, "Subscription not found")

    if "status" in body and body["status"] not in VALID_STATUSES:
        raise HTTPException(400, f"status must be one of {VALID_STATUSES}")
    if "payment_provider" in body and body["payment_provider"] not in VALID_PROVIDERS:
        raise HTTPException(400, f"payment_provider must be one of {VALID_PROVIDERS}")
    if "renewal_reminder_days" in body:
        d = int(body["renewal_reminder_days"])
        if not 0 <= d <= 365:
            raise HTTPException(400, "renewal_reminder_days must be 0–365")
        sub.renewal_reminder_days = d

    for field in {"status", "auto_renew", "cancel_at_period_end", "payment_provider"}:
        if field in body:
            setattr(sub, field, body[field])

    if "notes" in body:
        sub.notes = _validate_str(body["notes"], "notes", 1000)
    if "current_period_end" in body:
        sub.current_period_end = _parse_dt(body["current_period_end"], "current_period_end")

    sub.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(sub)
    return _sub_dict(sub)


@router.post("/premium/subscriptions/{sub_id}/extend")
def extend_subscription(
    sub_id: int,
    body: dict,
    db=Depends(get_db),
    _owner=Depends(require_owner),
):
    """Owner: extend current_period_end by N days (must be ≥ 1)."""
    sub = db.execute(
        select(GuildSubscription).options(joinedload(GuildSubscription.plan))
        .where(GuildSubscription.id == sub_id)
    ).scalars().first()
    if not sub:
        raise HTTPException(404, "Subscription not found")

    days = int(body.get("days", 30))
    if days < 1 or days > 3650:
        raise HTTPException(400, "days must be between 1 and 3650")

    base = sub.current_period_end or datetime.datetime.utcnow()
    sub.current_period_end = base + datetime.timedelta(days=days)
    sub.status = "active"
    sub.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(sub)
    return _sub_dict(sub)


@router.post("/premium/subscriptions/{sub_id}/cancel")
def cancel_subscription(
    sub_id: int,
    body: dict,
    db=Depends(get_db),
    _owner=Depends(require_owner),
):
    sub = db.execute(
        select(GuildSubscription).options(joinedload(GuildSubscription.plan))
        .where(GuildSubscription.id == sub_id)
    ).scalars().first()
    if not sub:
        raise HTTPException(404, "Subscription not found")

    if body.get("immediately", False):
        sub.status = "cancelled"
        # Revoke premium features immediately — clear associated data
        if sub.plan and sub.plan.features:
            lost = set(sub.plan.features.keys())
            _cleanup_premium_features(sub.guild_id, lost, db)
    else:
        sub.cancel_at_period_end = True

    sub.auto_renew = False
    sub.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(sub)
    return _sub_dict(sub)


# ── Payments ───────────────────────────────────────────────────────────────────

@router.get("/premium/payments")
def list_all_payments(
    db=Depends(get_db),
    _owner=Depends(require_owner),
):
    rows = db.execute(
        select(SubscriptionPayment)
        .options(joinedload(SubscriptionPayment.plan))
        .order_by(SubscriptionPayment.created_at.desc())
    ).scalars().all()
    return [_payment_dict(p) for p in rows]


@router.get("/premium/payments/guild")
def get_guild_payments(
    guild_id: str = Depends(get_guild_id),
    db=Depends(get_db),
    _user=Depends(require_auth),
):
    rows = db.execute(
        select(SubscriptionPayment)
        .options(joinedload(SubscriptionPayment.plan))
        .where(SubscriptionPayment.guild_id == guild_id)
        .order_by(SubscriptionPayment.created_at.desc())
    ).scalars().all()
    return [_payment_dict(p) for p in rows]


@router.post("/premium/payments")
def record_payment(
    body: dict,
    db=Depends(get_db),
    _owner=Depends(require_owner),
):
    guild_id = _validate_str(body.get("guild_id"), "guild_id", 32)
    if not guild_id:
        raise HTTPException(400, "guild_id is required")

    amount = body.get("amount")
    if amount is None or not isinstance(amount, (int, float)) or amount < 0:
        raise HTTPException(400, "amount must be a non-negative number")

    method = body.get("payment_method", "manual")
    if method not in VALID_PROVIDERS:
        raise HTTPException(400, f"payment_method must be one of {VALID_PROVIDERS}")

    status = body.get("status", "paid")
    if status not in VALID_PAY_STATUS:
        raise HTTPException(400, f"status must be one of {VALID_PAY_STATUS}")

    now = datetime.datetime.utcnow()
    payment = SubscriptionPayment(
        guild_id=guild_id,
        subscription_id=body.get("subscription_id"),
        plan_id=body.get("plan_id"),
        amount=float(amount),
        currency=_validate_str(body.get("currency", "VND"), "currency", 8),
        payment_method=method,
        status=status,
        provider_payment_id=_validate_str(body.get("provider_payment_id"), "provider_payment_id", 128),
        period_start=_parse_dt(body.get("period_start"), "period_start"),
        period_end=_parse_dt(body.get("period_end"), "period_end"),
        notes=_validate_str(body.get("notes"), "notes", 1000),
        paid_at=now if status == "paid" else None,
    )
    db.add(payment)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        logger.warning("record_payment integrity error: %s", e)
        raise HTTPException(400, "Database constraint error — check subscription_id and plan_id")
    db.refresh(payment)
    return _payment_dict(payment)


@router.put("/premium/payments/{payment_id}")
def update_payment(
    payment_id: int,
    body: dict,
    db=Depends(get_db),
    _owner=Depends(require_owner),
):
    payment = db.execute(
        select(SubscriptionPayment).where(SubscriptionPayment.id == payment_id)
    ).scalars().first()
    if not payment:
        raise HTTPException(404, "Payment not found")

    if "status" in body:
        if body["status"] not in VALID_PAY_STATUS:
            raise HTTPException(400, f"status must be one of {VALID_PAY_STATUS}")
        payment.status = body["status"]
        if body["status"] == "paid" and not payment.paid_at:
            payment.paid_at = datetime.datetime.utcnow()

    if "notes" in body:
        payment.notes = _validate_str(body["notes"], "notes", 1000)
    if "provider_payment_id" in body:
        payment.provider_payment_id = _validate_str(body["provider_payment_id"], "provider_payment_id", 128)

    db.commit()
    db.refresh(payment)
    return _payment_dict(payment)


# ── Feature entitlements ───────────────────────────────────────────────────────

@router.get("/premium/entitlements")
def get_entitlements(
    request: Request,
    guild_id: str = Depends(get_guild_id),
    db=Depends(get_db),
    user=Depends(require_auth),
):
    """Return merged feature flags for the guild's active subscription.
    Bot owner always gets full access regardless of subscription state.
    """
    is_owner = bool(user.get("is_owner"))

    sub = db.execute(
        select(GuildSubscription)
        .options(joinedload(GuildSubscription.plan))
        .where(
            GuildSubscription.guild_id == guild_id,
            GuildSubscription.status.in_(["active", "trial"]),
        )
        .order_by(GuildSubscription.current_period_end.desc())
        .limit(1)
    ).scalars().first()

    if is_owner:
        # Owner bypasses: return active plan info if exists, else synthetic full-access
        if sub and sub.plan:
            return {
                "plan": _plan_dict(sub.plan),
                "status": sub.status,
                "features": sub.plan.features or {},
                "expires_at": sub.current_period_end.isoformat() if sub.current_period_end else None,
                "is_owner": True,
                "has_access": True,
            }
        return {
            "plan": None,
            "features": {},
            "status": "owner_bypass",
            "is_owner": True,
            "has_access": True,
        }

    if not sub or not sub.plan:
        return {"plan": None, "features": {}, "status": "free", "is_owner": False, "has_access": False}

    return {
        "plan": _plan_dict(sub.plan),
        "status": sub.status,
        "features": sub.plan.features or {},
        "expires_at": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "is_owner": False,
        "has_access": True,
    }


# ── Renewal reminder scan ──────────────────────────────────────────────────────

@router.post("/premium/reminders/scan")
def scan_renewal_reminders(
    db=Depends(get_db),
    _owner=Depends(require_owner),
):
    """
    Mark subscriptions approaching expiry and return those needing reminders.
    Uses a date-level dedup: only one reminder per subscription per calendar day.
    """
    now = datetime.datetime.utcnow()
    today = now.date()
    due: list[dict] = []

    subs = db.execute(
        select(GuildSubscription)
        .options(joinedload(GuildSubscription.plan))
        .where(GuildSubscription.status.in_(["active", "trial"]))
    ).scalars().all()

    for sub in subs:
        if not sub.current_period_end:
            continue

        days_left = (sub.current_period_end - now).days

        if days_left < 0:
            # Just expired — revoke premium features and clear associated data
            sub.status = "expired"
            sub.updated_at = now
            if sub.plan and sub.plan.features:
                lost = set(sub.plan.features.keys())
                _cleanup_premium_features(sub.guild_id, lost, db)
        elif days_left <= sub.renewal_reminder_days:
            # Dedup: skip if already reminded today
            last = sub.last_reminder_at
            already_today = last is not None and last.date() == today
            if not already_today:
                sub.last_reminder_at = now
                sub.updated_at = now
                due.append({**_sub_dict(sub), "days_left": days_left})

    db.commit()
    return {"scanned": len(subs), "reminders_due": due}


# ── Coupon helpers ─────────────────────────────────────────────────────────────

import re as _re

_COUPON_RE = _re.compile(r'^[A-Z0-9_\-]{3,32}$')


def _coupon_dict(c: PremiumCoupon) -> dict:
    return {
        "id": c.id,
        "code": c.code,
        "plan_id": c.plan_id,
        "plan_name": c.plan.name if c.plan else None,
        "plan_color": c.plan.color if c.plan else None,
        "duration_days": c.duration_days,
        "max_uses": c.max_uses,
        "used_count": c.used_count,
        "expires_at": c.expires_at.isoformat() if c.expires_at else None,
        "active": c.active,
        "note": c.note,
        "created_by": c.created_by,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _redemption_dict(r: CouponRedemption) -> dict:
    return {
        "id": r.id,
        "coupon_id": r.coupon_id,
        "guild_id": r.guild_id,
        "redeemed_by": r.redeemed_by,
        "subscription_id": r.subscription_id,
        "redeemed_at": r.redeemed_at.isoformat() if r.redeemed_at else None,
    }


# ── Coupon CRUD (owner) ────────────────────────────────────────────────────────

@router.post("/premium/coupons")
async def create_coupon(request: Request, db=Depends(get_db), _owner=Depends(require_owner)):
    body = await request.json()

    raw_code = _validate_str(body.get("code"), "code", 32)
    if not raw_code:
        raise HTTPException(400, "code is required")
    code = raw_code.upper().strip()
    if not _COUPON_RE.match(code):
        raise HTTPException(400, "code must be 3-32 alphanumeric chars (A-Z 0-9 _ -)")

    plan_id = body.get("plan_id")
    if not plan_id:
        raise HTTPException(400, "plan_id is required")
    plan = db.get(PremiumPlan, int(plan_id))
    if not plan:
        raise HTTPException(404, "Plan not found")

    duration_days = body.get("duration_days")
    if not duration_days or not (1 <= int(duration_days) <= 3650):
        raise HTTPException(400, "duration_days must be 1–3650")

    max_uses = int(body.get("max_uses", 1))
    if max_uses < 0:
        raise HTTPException(400, "max_uses must be >= 0")

    coupon = PremiumCoupon(
        code=code,
        plan_id=int(plan_id),
        duration_days=int(duration_days),
        max_uses=max_uses,
        expires_at=_parse_dt(body.get("expires_at"), "expires_at"),
        note=_validate_str(body.get("note"), "note"),
        created_by=_owner.get("user_id"),
    )
    db.add(coupon)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, f"Coupon code '{code}' already exists")
    db.refresh(coupon)
    coupon = db.execute(
        select(PremiumCoupon).options(joinedload(PremiumCoupon.plan)).where(PremiumCoupon.id == coupon.id)
    ).scalars().first()
    return _coupon_dict(coupon)


@router.get("/premium/coupons")
def list_coupons(db=Depends(get_db), _owner=Depends(require_owner)):
    coupons = db.execute(
        select(PremiumCoupon).options(joinedload(PremiumCoupon.plan)).order_by(PremiumCoupon.created_at.desc())
    ).scalars().all()
    return [_coupon_dict(c) for c in coupons]


@router.get("/premium/coupons/{coupon_id}")
def get_coupon(coupon_id: int, db=Depends(get_db), _owner=Depends(require_owner)):
    coupon = db.execute(
        select(PremiumCoupon).options(joinedload(PremiumCoupon.plan)).where(PremiumCoupon.id == coupon_id)
    ).scalars().first()
    if not coupon:
        raise HTTPException(404, "Coupon not found")
    redemptions = db.execute(
        select(CouponRedemption).where(CouponRedemption.coupon_id == coupon_id).order_by(CouponRedemption.redeemed_at.desc())
    ).scalars().all()
    return {**_coupon_dict(coupon), "redemptions": [_redemption_dict(r) for r in redemptions]}


@router.put("/premium/coupons/{coupon_id}")
async def update_coupon(coupon_id: int, request: Request, db=Depends(get_db), _owner=Depends(require_owner)):
    coupon = db.get(PremiumCoupon, coupon_id)
    if not coupon:
        raise HTTPException(404, "Coupon not found")
    body = await request.json()
    now = datetime.datetime.utcnow()

    if "max_uses" in body:
        v = int(body["max_uses"])
        if v < 0:
            raise HTTPException(400, "max_uses must be >= 0")
        coupon.max_uses = v
    if "duration_days" in body:
        v = int(body["duration_days"])
        if not (1 <= v <= 3650):
            raise HTTPException(400, "duration_days must be 1–3650")
        coupon.duration_days = v
    if "expires_at" in body:
        coupon.expires_at = _parse_dt(body["expires_at"], "expires_at")
    if "note" in body:
        coupon.note = _validate_str(body["note"], "note")
    if "active" in body:
        coupon.active = bool(body["active"])

    db.commit()
    coupon = db.execute(
        select(PremiumCoupon).options(joinedload(PremiumCoupon.plan)).where(PremiumCoupon.id == coupon_id)
    ).scalars().first()
    return _coupon_dict(coupon)


@router.delete("/premium/coupons/{coupon_id}")
def deactivate_coupon(coupon_id: int, db=Depends(get_db), _owner=Depends(require_owner)):
    coupon = db.get(PremiumCoupon, coupon_id)
    if not coupon:
        raise HTTPException(404, "Coupon not found")
    coupon.active = False
    db.commit()
    return {"ok": True}


# ── Coupon redemption (guild) ──────────────────────────────────────────────────

@router.post("/premium/coupons/redeem")
async def redeem_coupon(request: Request, db=Depends(get_db), _user=Depends(require_auth)):
    guild_id = get_guild_id(request)
    body = await request.json()
    raw_code = (body.get("code") or "").strip().upper()
    if not raw_code:
        raise HTTPException(400, "code is required")

    # 1. Find coupon
    coupon = db.execute(
        select(PremiumCoupon).options(joinedload(PremiumCoupon.plan)).where(PremiumCoupon.code == raw_code)
    ).scalars().first()
    if not coupon:
        raise HTTPException(404, "Mã coupon không tồn tại")

    # 2. Validate
    now = datetime.datetime.utcnow()
    if not coupon.active:
        raise HTTPException(400, "Mã coupon đã bị vô hiệu hóa")
    if coupon.expires_at and coupon.expires_at < now:
        raise HTTPException(400, "Mã coupon đã hết hạn")
    if coupon.max_uses > 0 and coupon.used_count >= coupon.max_uses:
        raise HTTPException(400, "Mã coupon đã hết lượt sử dụng")

    # 3. Check guild hasn't used this coupon before
    existing_redemption = db.execute(
        select(CouponRedemption).where(
            CouponRedemption.coupon_id == coupon.id,
            CouponRedemption.guild_id == guild_id,
        )
    ).scalars().first()
    if existing_redemption:
        raise HTTPException(400, "Server này đã sử dụng mã coupon này rồi")

    # 4. Find or create subscription
    existing_sub = db.execute(
        select(GuildSubscription).where(
            GuildSubscription.guild_id == guild_id,
            GuildSubscription.status.in_(["active", "trial"]),
        ).order_by(GuildSubscription.id.desc())
    ).scalars().first()

    period_end = (
        max(existing_sub.current_period_end or now, now) + datetime.timedelta(days=coupon.duration_days)
        if existing_sub
        else now + datetime.timedelta(days=coupon.duration_days)
    )

    if existing_sub:
        existing_sub.plan_id = coupon.plan_id
        existing_sub.current_period_end = period_end
        existing_sub.status = "active"
        existing_sub.updated_at = now
        sub = existing_sub
    else:
        sub = GuildSubscription(
            guild_id=guild_id,
            plan_id=coupon.plan_id,
            status="active",
            started_at=now,
            current_period_start=now,
            current_period_end=period_end,
            payment_provider="coupon",
            created_by=_user.get("user_id"),
        )
        db.add(sub)
        db.flush()

    # 5. Record redemption
    redemption = CouponRedemption(
        coupon_id=coupon.id,
        guild_id=guild_id,
        redeemed_by=_user.get("user_id"),
        subscription_id=sub.id,
    )
    db.add(redemption)

    # 6. Increment used_count
    coupon.used_count += 1

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Lỗi khi kích hoạt coupon, vui lòng thử lại")

    db.refresh(sub)
    return {
        "ok": True,
        "days_granted": coupon.duration_days,
        "plan_name": coupon.plan.name if coupon.plan else None,
        "period_end": period_end.isoformat(),
        "subscription": _sub_dict(sub),
    }
