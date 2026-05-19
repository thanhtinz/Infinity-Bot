"""Community routes: Users Manager, Invites, Giveaways, Warnings, Feedback, Sticky."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, case
import logging

from src.database.config import get_db
from src.api.deps import get_guild_id, require_staff_perm
from src.models.models import (
    SystemConfig, User, Order, Product, BannedShopUser,
    InviteTracking, Giveaway, GiveawayEntry, Warning, Feedback, StickyMessage,
)

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(require_staff_perm("can_community"))])


# ── Users Manager ─────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    users = db.execute(select(User).where(User.guild_id == guild_id).order_by(User.total_spent.desc())).scalars().all()
    banned_ids = {
        b.discord_id for b in db.execute(select(BannedShopUser).where(BannedShopUser.guild_id == guild_id)).scalars().all()
    }
    result = []
    for u in users:
        order_count = db.execute(
            select(func.count()).where(Order.user_id == u.id)
        ).scalar() or 0
        result.append({
            "id": u.id,
            "discord_id": u.discord_id,
            "username": u.username,
            "total_spent": u.total_spent or 0,
            "order_count": order_count,
            "is_banned": u.discord_id in banned_ids,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })
    return result


@router.get("/users/{user_id}/orders")
def get_user_orders(user_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Not found")
    orders = db.execute(
        select(Order).where(Order.user_id == user_id, Order.guild_id == guild_id).order_by(Order.created_at.desc()).limit(20)
    ).scalars().all()
    result = []
    for o in orders:
        product = db.get(Product, o.product_id) if o.product_id else None
        result.append({
            "id": o.id,
            "product_name": product.name if product else "?",
            "package_name": o.package_name,
            "quantity": o.quantity,
            "total_price": o.total_price,
            "status": o.status,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        })
    return result


@router.post("/users/{user_id}/ban")
def ban_user(user_id: int, body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Not found")
    existing = db.execute(select(BannedShopUser).where(BannedShopUser.discord_id == user.discord_id, BannedShopUser.guild_id == guild_id)).scalars().first()
    if not existing:
        ban = BannedShopUser(
            guild_id=guild_id,
            discord_id=user.discord_id,
            reason=body.get("reason", ""),
            banned_by=body.get("banned_by", "admin"),
        )
        db.add(ban)
        db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/unban")
def unban_user(user_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Not found")
    ban = db.execute(select(BannedShopUser).where(BannedShopUser.discord_id == user.discord_id, BannedShopUser.guild_id == guild_id)).scalars().first()
    if ban:
        db.delete(ban)
        db.commit()
    return {"ok": True}


# ── Invite Tracking ───────────────────────────────────────────────────────────

@router.get("/invites")
def list_invites(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rows = db.execute(
        select(
            InviteTracking.inviter_id,
            func.count().label("total"),
            func.sum(case((InviteTracking.left == False, 1), else_=0)).label("active"),
            func.sum(case((InviteTracking.left == True, 1), else_=0)).label("left"),
            func.sum(case((InviteTracking.is_fake == True, 1), else_=0)).label("fake"),
        ).where(InviteTracking.guild_id == guild_id).group_by(InviteTracking.inviter_id).order_by(func.count().desc())
    ).all()
    return [
        {
            "inviter_id": r.inviter_id,
            "total": r.total,
            "active": r.active or 0,
            "left": r.left or 0,
            "fake": r.fake or 0,
        }
        for r in rows
    ]


@router.get("/invites/leaderboard")
def invites_leaderboard(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    return list_invites(db=db, guild_id=guild_id)


@router.get("/invites/log")
def invites_log(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rows = db.execute(
        select(InviteTracking).where(InviteTracking.guild_id == guild_id).order_by(InviteTracking.joined_at.desc()).limit(100)
    ).scalars().all()
    return [
        {
            "id": r.id,
            "inviter_id": r.inviter_id,
            "invitee_id": r.invitee_id,
            "invite_code": r.invite_code,
            "joined_at": r.joined_at.isoformat() if r.joined_at else None,
            "left": r.left,
            "is_fake": r.is_fake,
        }
        for r in rows
    ]


# ── Giveaways Manager ────────────────────────────────────────────────────────

@router.get("/giveaways")
def list_giveaways(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rows = db.execute(
        select(Giveaway).where(Giveaway.guild_id == guild_id).order_by(Giveaway.created_at.desc()).limit(50)
    ).scalars().all()
    result = []
    for g in rows:
        entry_count = db.execute(
            select(func.count()).where(GiveawayEntry.giveaway_id == g.id)
        ).scalar() or 0
        result.append({
            "id": g.id,
            "title": g.title,
            "prize": g.prize,
            "winners_count": g.winners_count,
            "ends_at": g.ends_at.isoformat() if g.ends_at else None,
            "ended": g.ended,
            "host_id": g.host_id,
            "entry_count": entry_count,
            "channel_id": g.channel_id,
            "created_at": g.created_at.isoformat() if g.created_at else None,
        })
    return result


@router.delete("/giveaways/{giveaway_id}")
def delete_giveaway(giveaway_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    g = db.execute(select(Giveaway).where(Giveaway.id == giveaway_id, Giveaway.guild_id == guild_id)).scalars().first()
    if not g:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(g)
    db.commit()
    return {"ok": True}


# ── Warnings ──────────────────────────────────────────────────────────────────

@router.get("/warnings")
def list_warnings(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rows = db.execute(
        select(Warning).where(Warning.guild_id == guild_id).order_by(Warning.created_at.desc()).limit(200)
    ).scalars().all()
    return [
        {
            "id": r.id, "discord_id": r.discord_id, "guild_id": r.guild_id,
            "reason": r.reason, "moderator_id": r.moderator_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.delete("/warnings/{warning_id}")
def delete_warning(warning_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    w = db.execute(select(Warning).where(Warning.id == warning_id, Warning.guild_id == guild_id)).scalars().first()
    if not w:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(w)
    db.commit()
    return {"ok": True}


# ── Feedback ──────────────────────────────────────────────────────────────────

@router.get("/feedback")
def list_feedback(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rows = db.execute(
        select(Feedback).where(Feedback.guild_id == guild_id).order_by(Feedback.created_at.desc()).limit(200)
    ).scalars().all()
    result = []
    for r in rows:
        user = db.get(User, r.user_id) if r.user_id else None
        product = db.get(Product, r.product_id) if r.product_id else None
        result.append({
            "id": r.id,
            "user_discord_id": user.discord_id if user else None,
            "username": user.username if user else "Unknown",
            "product_id": r.product_id,
            "product_name": product.name if product else None,
            "stars": r.stars,
            "content": r.content,
            "discord_message_id": r.discord_message_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return result


@router.delete("/feedback/{feedback_id}")
async def delete_feedback(feedback_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    fb = db.execute(select(Feedback).where(Feedback.id == feedback_id, Feedback.guild_id == guild_id)).scalars().first()
    if not fb:
        raise HTTPException(status_code=404, detail="Not found")
    if fb.discord_message_id:
        try:
            from src.bot.manager import bot
            config = db.execute(select(SystemConfig).where(SystemConfig.guild_id == guild_id)).scalars().first()
            feedback_channel_id = config.feedback_channel_id if config else None
            if bot and feedback_channel_id:
                ch = bot.get_channel(int(feedback_channel_id))
                if not ch:
                    ch = await bot.fetch_channel(int(feedback_channel_id))
                if ch:
                    try:
                        msg = await ch.fetch_message(int(fb.discord_message_id))
                        await msg.delete()
                    except Exception:
                        pass
        except Exception as e:
            logger.error(f"delete feedback discord msg error: {e}")
    db.delete(fb)
    db.commit()
    return {"ok": True}


# ── Sticky Messages ──────────────────────────────────────────────────────────

@router.get("/sticky")
def list_stickies(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    stickies = db.execute(select(StickyMessage).where(StickyMessage.guild_id == guild_id).order_by(StickyMessage.created_at.desc())).scalars().all()
    out = []
    for s in stickies:
        out.append({
            "id": s.id,
            "guild_id": s.guild_id,
            "channel_id": s.channel_id,
            "content": s.content,
            "embed_enabled": s.embed_enabled,
            "embed_title": s.embed_title,
            "embed_description": s.embed_description,
            "embed_color": s.embed_color,
            "embed_footer": s.embed_footer,
            "embed_image_url": s.embed_image_url,
            "embed_thumbnail_url": s.embed_thumbnail_url,
            "message_count_trigger": s.message_count_trigger,
            "interval_minutes": s.interval_minutes,
            "is_enabled": s.is_enabled,
            "is_pinned": s.is_pinned,
            "resend_count": s.resend_count or 0,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "last_sent": s.last_sent.isoformat() if s.last_sent else None,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
        })
    return out


@router.post("/sticky")
def create_sticky(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    channel_id = str(body.get("channel_id", "")).strip()
    if not channel_id:
        raise HTTPException(status_code=400, detail="channel_id required")

    existing = db.execute(select(StickyMessage).where(StickyMessage.channel_id == channel_id)).scalars().first()

    if existing:
        for field in ["content", "embed_enabled", "embed_title", "embed_description",
                      "embed_color", "embed_footer", "embed_image_url", "embed_thumbnail_url",
                      "message_count_trigger", "interval_minutes", "is_enabled", "is_pinned"]:
            if field in body:
                setattr(existing, field, body[field])
        db.commit()
        return {"ok": True, "id": existing.id}
    else:
        sticky = StickyMessage(
            guild_id=guild_id,
            channel_id=channel_id,
            content=body.get("content"),
            embed_enabled=body.get("embed_enabled", False),
            embed_title=body.get("embed_title"),
            embed_description=body.get("embed_description"),
            embed_color=body.get("embed_color", "#5865F2"),
            embed_footer=body.get("embed_footer"),
            embed_image_url=body.get("embed_image_url"),
            embed_thumbnail_url=body.get("embed_thumbnail_url"),
            message_count_trigger=body.get("message_count_trigger", 1),
            interval_minutes=body.get("interval_minutes", 0),
            is_enabled=body.get("is_enabled", True),
            is_pinned=body.get("is_pinned", False),
        )
        db.add(sticky)
        db.commit()
        db.refresh(sticky)
        return {"ok": True, "id": sticky.id}


@router.put("/sticky/{sticky_id}")
def update_sticky(sticky_id: int, body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    sticky = db.execute(select(StickyMessage).where(StickyMessage.id == sticky_id, StickyMessage.guild_id == guild_id)).scalars().first()
    if not sticky:
        raise HTTPException(status_code=404, detail="Sticky not found")
    for field in ["content", "embed_enabled", "embed_title", "embed_description",
                  "embed_color", "embed_footer", "embed_image_url", "embed_thumbnail_url",
                  "message_count_trigger", "interval_minutes", "is_enabled", "is_pinned"]:
        if field in body:
            setattr(sticky, field, body[field])
    db.commit()
    return {"ok": True}


@router.delete("/sticky/{sticky_id}")
def delete_sticky(sticky_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    sticky = db.execute(select(StickyMessage).where(StickyMessage.id == sticky_id, StickyMessage.guild_id == guild_id)).scalars().first()
    if not sticky:
        raise HTTPException(status_code=404, detail="Sticky not found")
    try:
        from src.bot.manager import bot as _bot
        import asyncio as _asyncio
        if _bot and sticky.last_message_id:
            async def _del():
                try:
                    ch = await _bot.fetch_channel(int(sticky.channel_id))
                    msg = await ch.fetch_message(int(sticky.last_message_id))
                    await msg.delete()
                except Exception:
                    pass
            if _bot.loop:
                _asyncio.run_coroutine_threadsafe(_del(), _bot.loop)
    except Exception:
        pass
    db.delete(sticky)
    db.commit()
    return {"ok": True}


@router.post("/sticky/{sticky_id}/resend")
def resend_sticky(sticky_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    sticky = db.execute(select(StickyMessage).where(StickyMessage.id == sticky_id, StickyMessage.guild_id == guild_id)).scalars().first()
    if not sticky:
        raise HTTPException(status_code=404, detail="Sticky not found")
    try:
        from src.bot.manager import bot as _bot
        from src.bot.cogs.sticky import _do_resend
        import asyncio as _asyncio
        if _bot and _bot.loop:
            future = _asyncio.run_coroutine_threadsafe(_do_resend(_bot, sticky, db), _bot.loop)
            future.result(timeout=5)
            return {"ok": True}
        return {"ok": False, "detail": "Bot không online"}
    except Exception as e:
        logger.error(f"resend_sticky error: {e}")
        return {"ok": False, "detail": str(e)}


@router.get("/sticky/stats")
def sticky_stats(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    stickies = db.execute(select(StickyMessage).where(StickyMessage.guild_id == guild_id)).scalars().all()
    return {
        "total": len(stickies),
        "active": sum(1 for s in stickies if s.is_enabled),
        "total_resends": sum(s.resend_count or 0 for s in stickies),
        "embed_count": sum(1 for s in stickies if s.embed_enabled),
        "pinned_count": sum(1 for s in stickies if s.is_pinned),
    }
