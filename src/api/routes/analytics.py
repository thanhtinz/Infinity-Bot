"""Analytics API — revenue, products, customer, staff metrics. All scoped per guild."""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, cast, Date
import datetime

from src.database.config import get_db
from src.models.models import Order, User, Product, OrderLog
from src.api.deps import get_guild_id, require_staff_perm

router = APIRouter(
    prefix="/api/analytics",
    dependencies=[Depends(require_staff_perm("can_shop"))],
)

PAID_STATUSES = ("PAID", "DELIVERED")


# ── Revenue ────────────────────────────────────────────────────────────────────

@router.get("/revenue")
def get_revenue(
    days: int = 30,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    """Daily revenue for the last N days, plus KPI totals."""
    since = datetime.datetime.utcnow() - datetime.timedelta(days=days)

    # Daily breakdown
    rows = db.execute(
        select(
            cast(Order.created_at, Date).label("day"),
            func.sum(Order.total_price).label("revenue"),
            func.count(Order.id).label("orders"),
        )
        .where(
            Order.guild_id == guild_id,
            Order.status.in_(PAID_STATUSES),
            Order.created_at >= since,
        )
        .group_by(cast(Order.created_at, Date))
        .order_by(cast(Order.created_at, Date))
    ).fetchall()

    daily = [
        {"date": str(r.day), "revenue": float(r.revenue or 0), "orders": int(r.orders)}
        for r in rows
    ]

    # KPI totals for period
    total_revenue = sum(d["revenue"] for d in daily)
    total_orders = sum(d["orders"] for d in daily)
    aov = total_revenue / total_orders if total_orders else 0

    # All-time totals
    all_time = db.execute(
        select(
            func.sum(Order.total_price).label("revenue"),
            func.count(Order.id).label("orders"),
        )
        .where(Order.guild_id == guild_id, Order.status.in_(PAID_STATUSES))
    ).first()

    return {
        "daily": daily,
        "period_revenue": total_revenue,
        "period_orders": total_orders,
        "period_aov": round(aov, 2),
        "all_time_revenue": float(all_time.revenue or 0),
        "all_time_orders": int(all_time.orders or 0),
        "days": days,
    }


# ── Products ───────────────────────────────────────────────────────────────────

@router.get("/products")
def get_product_analytics(
    days: int = 30,
    limit: int = 10,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    """Top products by revenue and order volume."""
    since = datetime.datetime.utcnow() - datetime.timedelta(days=days)

    rows = db.execute(
        select(
            Order.product_id,
            Product.name.label("product_name"),
            func.sum(Order.total_price).label("revenue"),
            func.sum(Order.quantity).label("units_sold"),
            func.count(Order.id).label("order_count"),
        )
        .join(Product, Order.product_id == Product.id, isouter=True)
        .where(
            Order.guild_id == guild_id,
            Order.status.in_(PAID_STATUSES),
            Order.created_at >= since,
        )
        .group_by(Order.product_id, Product.name)
        .order_by(func.sum(Order.total_price).desc())
        .limit(limit)
    ).fetchall()

    return [
        {
            "product_id": r.product_id,
            "product_name": r.product_name or f"Product #{r.product_id}",
            "revenue": float(r.revenue or 0),
            "units_sold": int(r.units_sold or 0),
            "order_count": int(r.order_count),
        }
        for r in rows
    ]


# ── Customers ──────────────────────────────────────────────────────────────────

@router.get("/customers")
def get_customer_analytics(
    days: int = 30,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    """Customer metrics: new vs returning buyers, repeat rate, top spenders."""
    since = datetime.datetime.utcnow() - datetime.timedelta(days=days)

    # All buyers in period
    period_orders = db.execute(
        select(Order.user_id, func.count(Order.id).label("order_count"),
               func.sum(Order.total_price).label("spent"))
        .where(Order.guild_id == guild_id, Order.status.in_(PAID_STATUSES),
               Order.created_at >= since)
        .group_by(Order.user_id)
    ).fetchall()

    total_buyers = len(period_orders)
    repeat_buyers = sum(1 for r in period_orders if r.order_count > 1)
    repeat_rate = round(repeat_buyers / total_buyers * 100, 1) if total_buyers else 0

    # All-time: buyers with >1 order (returning)
    all_orders_agg = db.execute(
        select(Order.user_id, func.count(Order.id).label("total_orders"))
        .where(Order.guild_id == guild_id, Order.status.in_(PAID_STATUSES))
        .group_by(Order.user_id)
    ).fetchall()
    all_time_buyers = len(all_orders_agg)
    all_time_repeat = sum(1 for r in all_orders_agg if r.total_orders > 1)

    # Top spenders in period
    top_spender_ids = sorted(period_orders, key=lambda r: r.spent or 0, reverse=True)[:10]
    user_ids = [r.user_id for r in top_spender_ids]
    users = {
        u.id: u for u in db.execute(
            select(User).where(User.id.in_(user_ids))
        ).scalars().all()
    } if user_ids else {}

    top_spenders = [
        {
            "user_id": r.user_id,
            "discord_id": users[r.user_id].discord_id if r.user_id in users else None,
            "username": users[r.user_id].username if r.user_id in users else "Unknown",
            "loyalty_tier": users[r.user_id].loyalty_tier if r.user_id in users else None,
            "spent": float(r.spent or 0),
            "order_count": int(r.order_count),
        }
        for r in top_spender_ids
    ]

    return {
        "period_buyers": total_buyers,
        "period_repeat_buyers": repeat_buyers,
        "period_repeat_rate": repeat_rate,
        "all_time_buyers": all_time_buyers,
        "all_time_repeat_buyers": all_time_repeat,
        "top_spenders": top_spenders,
        "days": days,
    }


# ── Flagged orders summary ─────────────────────────────────────────────────────

@router.get("/fraud")
def get_fraud_summary(
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    """Summary of flagged orders."""
    flagged = db.execute(
        select(Order)
        .where(Order.guild_id == guild_id, Order.flagged == True)
        .order_by(Order.created_at.desc())
        .limit(50)
    ).scalars().all()

    return [
        {
            "order_id": o.id,
            "flag_reason": o.flag_reason,
            "status": o.status,
            "total_price": float(o.total_price),
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "user_id": o.user_id,
        }
        for o in flagged
    ]
