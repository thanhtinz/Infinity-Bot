"""Customer CRM API — per-guild user profiles, notes, tags, blacklist."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
import datetime

from src.database.config import get_db
from src.models.models import User, Order
from src.api.deps import get_guild_id, require_staff_perm

router = APIRouter(
    prefix="/api/crm",
    dependencies=[Depends(require_staff_perm("can_shop"))],
)

PAID_STATUSES = ("PAID", "DELIVERED")


def _user_dict(user: User, total_spent: float, order_count: int) -> dict:
    return {
        "id": user.id,
        "discord_id": user.discord_id,
        "username": user.username,
        "total_spent": total_spent,
        "order_count": order_count,
        "loyalty_tier": user.loyalty_tier,
        "tier_updated_at": user.tier_updated_at.isoformat() if user.tier_updated_at else None,
        "reputation_score": user.reputation_score or 0,
        "dispute_count": user.dispute_count or 0,
        "chargeback_count": user.chargeback_count or 0,
        "tags": user.tags or [],
        "internal_notes": user.internal_notes,
        "blacklisted": user.blacklisted or False,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.get("/customers")
def list_customers(
    search: str = "",
    tier: str = "",
    blacklisted: str = "",
    page: int = 1,
    per_page: int = 50,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    """List all customers with CRM data. Filters: search, tier, blacklisted."""
    # Get all users who have at least one order in this guild
    spend_rows = db.execute(
        select(
            Order.user_id,
            func.sum(Order.total_price).label("total_spent"),
            func.count(Order.id).label("order_count"),
        )
        .where(Order.guild_id == guild_id, Order.status.in_(PAID_STATUSES))
        .group_by(Order.user_id)
    ).fetchall()

    spend_map = {r.user_id: (float(r.total_spent or 0), int(r.order_count)) for r in spend_rows}
    user_ids = list(spend_map.keys())

    if not user_ids:
        return {"customers": [], "total": 0}

    query = select(User).where(User.id.in_(user_ids))

    if search:
        query = query.where(User.username.ilike(f"%{search}%") | User.discord_id.ilike(f"%{search}%"))
    if tier:
        query = query.where(User.loyalty_tier == tier)
    if blacklisted == "true":
        query = query.where(User.blacklisted == True)
    elif blacklisted == "false":
        query = query.where((User.blacklisted == False) | User.blacklisted.is_(None))

    users = db.execute(query).scalars().all()

    # Sort by total spent desc
    users_sorted = sorted(users, key=lambda u: spend_map.get(u.id, (0, 0))[0], reverse=True)

    total = len(users_sorted)
    start = (page - 1) * per_page
    page_users = users_sorted[start: start + per_page]

    return {
        "customers": [
            _user_dict(u, *spend_map.get(u.id, (0, 0))) for u in page_users
        ],
        "total": total,
    }


@router.get("/customers/{discord_id}")
def get_customer(
    discord_id: str,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    """Full profile for one customer."""
    user = db.execute(select(User).where(User.discord_id == discord_id)).scalars().first()
    if not user:
        raise HTTPException(404, "User not found")

    spend = db.execute(
        select(func.sum(Order.total_price), func.count(Order.id))
        .where(Order.user_id == user.id, Order.guild_id == guild_id, Order.status.in_(PAID_STATUSES))
    ).first()
    total_spent = float(spend[0] or 0)
    order_count = int(spend[1] or 0)

    # Last 20 orders for this guild
    orders = db.execute(
        select(Order)
        .where(Order.user_id == user.id, Order.guild_id == guild_id)
        .order_by(Order.created_at.desc())
        .limit(20)
    ).scalars().all()

    return {
        **_user_dict(user, total_spent, order_count),
        "recent_orders": [
            {
                "id": o.id,
                "status": o.status,
                "total_price": float(o.total_price),
                "package_name": o.package_name,
                "payment_method": o.payment_method,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orders
        ],
    }


@router.patch("/customers/{discord_id}")
def update_customer(
    discord_id: str,
    body: dict,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    """Update CRM fields: internal_notes, tags, blacklisted, reputation_score, dispute_count, chargeback_count."""
    user = db.execute(select(User).where(User.discord_id == discord_id)).scalars().first()
    if not user:
        raise HTTPException(404, "User not found")

    allowed = {"internal_notes", "tags", "blacklisted", "reputation_score", "dispute_count", "chargeback_count"}
    for field in allowed:
        if field in body:
            setattr(user, field, body[field])

    db.commit()
    return {"ok": True}
