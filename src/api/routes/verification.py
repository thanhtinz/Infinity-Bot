"""Verification System routes — config, verified members, stats."""
import asyncio
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.api.deps import get_guild_id
from src.models.models import VerificationConfig, VerifiedMember, GuildBot
from src.api import railway as _railway

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_or_create_config(db: Session, guild_id: str) -> VerificationConfig:
    cfg = db.execute(
        select(VerificationConfig).where(VerificationConfig.guild_id == guild_id)
    ).scalars().first()
    if not cfg:
        cfg = VerificationConfig(guild_id=guild_id)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


# ── Verification Config ──

@router.get("/verification/config")
def get_config(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    cfg = _get_or_create_config(db, guild_id)
    return {
        "enabled": cfg.enabled,
        "verified_role_id": cfg.verified_role_id or "",
        "unverified_role_id": cfg.unverified_role_id or "",
        "verify_channel_id": cfg.verify_channel_id or "",
        "log_channel_id": cfg.log_channel_id or "",
        "page_title": cfg.page_title or "",
        "page_description": cfg.page_description or "",
        "page_color": cfg.page_color or "#5865F2",
        "page_logo_url": cfg.page_logo_url or "",
        "page_background_url": cfg.page_background_url or "",
        "button_text": cfg.button_text or "Verify with Discord",
        "success_message": cfg.success_message or "",
        "captcha_enabled": cfg.captcha_enabled,
        "min_account_age_days": cfg.min_account_age_days or 0,
        "block_vpn": cfg.block_vpn,
        "kick_on_deauth": cfg.kick_on_deauth,
        "close_page_after_verify": cfg.close_page_after_verify,
        "page_footer_text": getattr(cfg, "page_footer_text", "") or "",
        "page_theme": getattr(cfg, "page_theme", "dark") or "dark",
        "custom_css": getattr(cfg, "custom_css", "") or "",
        "redirect_url": getattr(cfg, "redirect_url", "") or "",
        "terms_url": getattr(cfg, "terms_url", "") or "",
        # Advanced customization
        "banner_url": getattr(cfg, "banner_url", "") or "",
        "cursor_url": getattr(cfg, "cursor_url", "") or "",
        "font_family": getattr(cfg, "font_family", "Inter") or "Inter",
        "bg_effect": getattr(cfg, "bg_effect", "none") or "none",
        "bg_color": getattr(cfg, "bg_color", "#0b0d14") or "#0b0d14",
        "text_color": getattr(cfg, "text_color", "#ffffff") or "#ffffff",
        "btn_color": getattr(cfg, "btn_color", "#5865F2") or "#5865F2",
        "btn_border_color": getattr(cfg, "btn_border_color", "#5865F2") or "#5865F2",
        "card_border_color": getattr(cfg, "card_border_color", "#1a1d2e") or "#1a1d2e",
        "card_bg_color": getattr(cfg, "card_bg_color", "#1a1d2e") or "#1a1d2e",
        "card_opacity": getattr(cfg, "card_opacity", 95) if getattr(cfg, "card_opacity", None) is not None else 95,
        "typewriter_effect": getattr(cfg, "typewriter_effect", False),
        "glow_effect": getattr(cfg, "glow_effect", False),
        "tilt_effect": getattr(cfg, "tilt_effect", False),
        "bio_description": getattr(cfg, "bio_description", "") or "",
        "socials": getattr(cfg, "socials", {}) or {},
        # Protection
        "block_mobile": getattr(cfg, "block_mobile", False),
        "block_scammers": getattr(cfg, "block_scammers", False),
        "deny_alt_role": getattr(cfg, "deny_alt_role", False),
        "auto_ban_alts": getattr(cfg, "auto_ban_alts", False),
        "no_save_ip": getattr(cfg, "no_save_ip", False),
        # OAuth Permissions
        "guild_join_enabled": getattr(cfg, "guild_join_enabled", True),
        "force_all_permissions": getattr(cfg, "force_all_permissions", False),
        # Notifications
        "notify_success_role_id": getattr(cfg, "notify_success_role_id", "") or "",
        "notify_blocked_role_id": getattr(cfg, "notify_blocked_role_id", "") or "",
        # Gateway
        "gateway_guild_id": getattr(cfg, "gateway_guild_id", "") or "",
        # Passwords
        "verify_passwords": getattr(cfg, "verify_passwords", []) or [],
        # VPN config (per-guild)
        "vpn_api_key": getattr(cfg, "vpn_api_key", "") or "",
        "vpn_api_provider": getattr(cfg, "vpn_api_provider", "proxycheck") or "proxycheck",
        "custom_domain": getattr(cfg, "custom_domain", "") or "",
        "music_url": getattr(cfg, "music_url", "") or "",
        "pull_cooldown_hours": getattr(cfg, "pull_cooldown_hours", 10),
        "verify_slug": getattr(cfg, "verify_slug", "") or "",
        # Captcha
        "captcha_type": getattr(cfg, "captcha_type", "none") or "none",
        "captcha_difficulty": getattr(cfg, "captcha_difficulty", "medium") or "medium",
    }


@router.put("/verification/config")
async def update_config(body: dict, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    import re
    cfg = _get_or_create_config(db, guild_id)
    allowed = [
        "enabled", "verified_role_id", "unverified_role_id", "verify_channel_id",
        "log_channel_id", "page_title", "page_description", "page_color",
        "page_logo_url", "page_background_url", "button_text", "success_message",
        "captcha_enabled", "min_account_age_days", "block_vpn",
        "kick_on_deauth", "close_page_after_verify",
        "page_footer_text", "page_theme", "custom_css", "redirect_url", "terms_url",
        "banner_url", "cursor_url", "font_family", "bg_effect",
        "bg_color", "text_color", "btn_color", "btn_border_color",
        "card_border_color", "card_bg_color", "card_opacity",
        "typewriter_effect", "glow_effect", "tilt_effect",
        "bio_description", "socials",
        "block_mobile", "block_scammers", "deny_alt_role", "auto_ban_alts", "no_save_ip",
        "guild_join_enabled", "force_all_permissions",
        "notify_success_role_id", "notify_blocked_role_id",
        "gateway_guild_id", "verify_passwords",
        "vpn_api_key", "vpn_api_provider",
        "custom_domain",
        "music_url", "pull_cooldown_hours",
        "verify_slug",
        "captcha_type", "captcha_difficulty",
    ]

    # Validate + sanitize slug
    if "verify_slug" in body:
        raw_slug = (body.get("verify_slug") or "").strip().lower()
        if raw_slug:
            # Only alphanumeric + hyphens, 3-32 chars
            if not re.match(r'^[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]$', raw_slug):
                raise HTTPException(400, "Slug must be 3–32 chars, lowercase letters, numbers, hyphens only (no start/end with hyphen)")
            # Check uniqueness (exclude own guild)
            conflict = db.execute(
                select(VerificationConfig).where(
                    func.lower(VerificationConfig.verify_slug) == raw_slug,
                    VerificationConfig.guild_id != guild_id,
                )
            ).scalars().first()
            if conflict:
                raise HTTPException(409, "This slug is already taken. Please choose a different one.")
        body["verify_slug"] = raw_slug or None

    # Track custom_domain change for Railway API
    old_domain = (getattr(cfg, "custom_domain", "") or "").strip()
    new_domain = (body.get("custom_domain") or "").strip() if "custom_domain" in body else old_domain

    for field in allowed:
        if field in body:
            setattr(cfg, field, body[field])
    db.commit()

    # Sync domain changes with Railway (fire-and-forget, don't block response)
    if old_domain != new_domain and _railway.is_configured():
        async def _sync_domain():
            if old_domain:
                await _railway.remove_custom_domain(old_domain)
            if new_domain:
                await _railway.add_custom_domain(new_domain)
        asyncio.create_task(_sync_domain())

    return {"ok": True}


@router.get("/verification/domain-status")
async def domain_status(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    """Check custom domain DNS/verification status and return CNAME target."""
    cfg = _get_or_create_config(db, guild_id)
    domain = (getattr(cfg, "custom_domain", "") or "").strip()

    cname_target = await _railway.get_cname_target()

    if not domain:
        return {
            "domain": "",
            "status": "none",
            "cname_target": cname_target,
            "railway_configured": _railway.is_configured(),
        }

    if not _railway.is_configured():
        return {
            "domain": domain,
            "status": "unknown",
            "cname_target": cname_target,
            "railway_configured": False,
        }

    result = await _railway.check_domain_status(domain)
    return {
        "domain": domain,
        "status": result.get("status", "unknown"),
        "dns_records": result.get("dns_records"),
        "cname_target": cname_target,
        "railway_configured": True,
        "error": result.get("error"),
    }


@router.get("/verification/slug/check")
def check_slug(slug: str, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    """Check if a slug is available (not taken by another guild)."""
    import re
    slug = slug.strip().lower()
    if not re.match(r'^[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]$', slug):
        return {"available": False, "reason": "Invalid format"}
    conflict = db.execute(
        select(VerificationConfig).where(
            func.lower(VerificationConfig.verify_slug) == slug,
            VerificationConfig.guild_id != guild_id,
        )
    ).scalars().first()
    return {"available": conflict is None}


# ── Verified Members ──

@router.get("/verification/members")
def list_members(
    guild_id: str = Depends(get_guild_id),
    db: Session = Depends(get_db),
    page: int = 1,
    per_page: int = 50,
    search: str = "",
    blacklisted: bool | None = None,
):
    q = select(VerifiedMember).where(VerifiedMember.guild_id == guild_id)
    if search:
        q = q.where(
            VerifiedMember.username.ilike(f"%{search}%")
            | VerifiedMember.discord_id.ilike(f"%{search}%")
            | VerifiedMember.email.ilike(f"%{search}%")
            | VerifiedMember.ip_address.ilike(f"%{search}%")
        )
    if blacklisted is not None:
        q = q.where(VerifiedMember.is_blacklisted == blacklisted)

    total = db.execute(select(func.count()).select_from(q.subquery())).scalar() or 0
    members = db.execute(
        q.order_by(VerifiedMember.verified_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).scalars().all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "members": [
            {
                "id": m.id,
                "discord_id": m.discord_id,
                "username": m.username,
                "avatar": m.avatar,
                "email": m.email,
                "ip_address": m.ip_address,
                "roles": m.roles or [],
                "verified_at": m.verified_at.isoformat() if m.verified_at else None,
                "last_seen": m.last_seen.isoformat() if m.last_seen else None,
                "is_blacklisted": m.is_blacklisted,
                "risk_score": m.risk_score,
            }
            for m in members
        ],
    }


@router.get("/verification/members/{member_id}")
def get_member(member_id: int, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    m = db.execute(
        select(VerifiedMember).where(
            VerifiedMember.id == member_id, VerifiedMember.guild_id == guild_id
        )
    ).scalars().first()
    if not m:
        raise HTTPException(404, "Member not found")
    return {
        "id": m.id,
        "discord_id": m.discord_id,
        "username": m.username,
        "discriminator": m.discriminator,
        "avatar": m.avatar,
        "email": m.email,
        "ip_address": m.ip_address,
        "roles": m.roles or [],
        "verified_at": m.verified_at.isoformat() if m.verified_at else None,
        "last_seen": m.last_seen.isoformat() if m.last_seen else None,
        "is_blacklisted": m.is_blacklisted,
        "risk_score": m.risk_score,
        "metadata": m.metadata_ or {},
    }


@router.post("/verification/members/{member_id}/blacklist")
def toggle_blacklist(
    member_id: int,
    body: dict | None = None,
    guild_id: str = Depends(get_guild_id),
    db: Session = Depends(get_db),
):
    m = db.execute(
        select(VerifiedMember).where(
            VerifiedMember.id == member_id, VerifiedMember.guild_id == guild_id
        )
    ).scalars().first()
    if not m:
        raise HTTPException(404, "Member not found")
    opts = body or {}
    m.is_blacklisted = opts.get("blacklisted", not m.is_blacklisted)
    db.commit()
    return {"ok": True, "is_blacklisted": m.is_blacklisted}


@router.delete("/verification/members/{member_id}")
def delete_member(member_id: int, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    m = db.execute(
        select(VerifiedMember).where(
            VerifiedMember.id == member_id, VerifiedMember.guild_id == guild_id
        )
    ).scalars().first()
    if not m:
        raise HTTPException(404, "Member not found")
    db.delete(m)
    db.commit()
    return {"ok": True}


# ── Stats ──

@router.get("/verification/stats")
def get_stats(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    total = db.execute(
        select(func.count()).select_from(VerifiedMember)
        .where(VerifiedMember.guild_id == guild_id)
    ).scalar() or 0

    today = db.execute(
        select(func.count()).select_from(VerifiedMember)
        .where(VerifiedMember.guild_id == guild_id, VerifiedMember.verified_at >= today_start)
    ).scalar() or 0

    this_week = db.execute(
        select(func.count()).select_from(VerifiedMember)
        .where(VerifiedMember.guild_id == guild_id, VerifiedMember.verified_at >= week_start)
    ).scalar() or 0

    blacklisted = db.execute(
        select(func.count()).select_from(VerifiedMember)
        .where(VerifiedMember.guild_id == guild_id, VerifiedMember.is_blacklisted == True)
    ).scalar() or 0

    pullable = db.execute(
        select(func.count()).select_from(VerifiedMember)
        .where(
            VerifiedMember.guild_id == guild_id,
            VerifiedMember.is_blacklisted == False,
            VerifiedMember.access_token.isnot(None),
        )
    ).scalar() or 0

    return {
        "total": total,
        "today": today,
        "this_week": this_week,
        "blacklisted": blacklisted,
        "pullable": pullable,
        "deauthorized": total - pullable - blacklisted,
    }


# ── Delete Unauthorized ──

@router.post("/verification/delete-unauthorized")
def delete_unauthorized(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    """Delete members who have deauthorized (no valid access token)."""
    deauthed = db.execute(
        select(VerifiedMember).where(
            VerifiedMember.guild_id == guild_id,
            VerifiedMember.is_blacklisted == False,
            VerifiedMember.access_token.is_(None),
        )
    ).scalars().all()
    count = len(deauthed)
    for m in deauthed:
        db.delete(m)
    db.commit()
    return {"ok": True, "deleted": count}


# ── Member Transfer ──

@router.post("/verification/transfer")
def transfer_members(body: dict, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    """Transfer verified members from another guild to the current guild."""
    source_guild_id = body.get("source_guild_id")
    if not source_guild_id:
        raise HTTPException(400, "source_guild_id is required")
    if source_guild_id == guild_id:
        raise HTTPException(400, "Cannot transfer to the same guild")

    source_members = db.execute(
        select(VerifiedMember).where(
            VerifiedMember.guild_id == source_guild_id,
            VerifiedMember.is_blacklisted == False,
        )
    ).scalars().all()

    if not source_members:
        return {"ok": True, "transferred": 0, "skipped": 0}

    transferred = 0
    skipped = 0
    for member in source_members:
        existing = db.execute(
            select(VerifiedMember).where(
                VerifiedMember.guild_id == guild_id,
                VerifiedMember.discord_id == member.discord_id,
            )
        ).scalars().first()
        if existing:
            skipped += 1
            continue

        new_member = VerifiedMember(
            guild_id=guild_id,
            discord_id=member.discord_id,
            username=member.username,
            avatar=member.avatar,
            email=member.email,
            ip_address=member.ip_address,
            access_token=member.access_token,
            refresh_token=member.refresh_token,
            roles=[],
            is_blacklisted=False,
        )
        db.add(new_member)
        transferred += 1

    db.commit()
    return {"ok": True, "transferred": transferred, "skipped": skipped}


# ── Guild Bot (Multi-bot) ──

@router.get("/verification/guild-bot")
def get_guild_bot(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    """Get the custom bot config for this guild."""
    bot = db.execute(
        select(GuildBot).where(GuildBot.guild_id == guild_id)
    ).scalars().first()
    if not bot:
        return {
            "configured": False,
            "client_id": "",
            "bot_name": "",
            "bot_avatar_url": "",
            "status": "inactive",
            "error_message": "",
            "has_token": False,
            "has_secret": False,
        }
    return {
        "configured": True,
        "client_id": bot.client_id or "",
        "bot_name": bot.bot_name or "",
        "bot_avatar_url": bot.bot_avatar_url or "",
        "status": bot.status or "inactive",
        "error_message": bot.error_message or "",
        "has_token": bool(bot.bot_token),
        "has_secret": bool(bot.client_secret),
        "last_validated_at": bot.last_validated_at.isoformat() if bot.last_validated_at else None,
    }


@router.put("/verification/guild-bot")
def update_guild_bot(body: dict, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    """Create or update the custom bot for this guild."""
    bot = db.execute(
        select(GuildBot).where(GuildBot.guild_id == guild_id)
    ).scalars().first()
    if not bot:
        bot = GuildBot(guild_id=guild_id)
        db.add(bot)

    if "client_id" in body:
        bot.client_id = body["client_id"] or None
    if "bot_token" in body and body["bot_token"]:
        bot.bot_token = body["bot_token"]
    if "client_secret" in body and body["client_secret"]:
        bot.client_secret = body["client_secret"]
    if "bot_name" in body:
        bot.bot_name = body["bot_name"] or None
    if "bot_avatar_url" in body:
        bot.bot_avatar_url = body["bot_avatar_url"] or None

    bot.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/verification/guild-bot/validate")
def validate_guild_bot(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    """Validate the guild bot token by calling Discord API."""
    import httpx

    bot = db.execute(
        select(GuildBot).where(GuildBot.guild_id == guild_id)
    ).scalars().first()
    if not bot or not bot.bot_token:
        raise HTTPException(400, "No bot token configured")

    try:
        r = httpx.get(
            "https://discord.com/api/v10/users/@me",
            headers={"Authorization": f"Bot {bot.bot_token}"},
            timeout=10,
        )
        if r.status_code == 200:
            data = r.json()
            bot.bot_name = data.get("username", bot.bot_name)
            avatar = data.get("avatar")
            if avatar:
                bot.bot_avatar_url = f"https://cdn.discordapp.com/avatars/{data['id']}/{avatar}.png"
            bot.client_id = data.get("id", bot.client_id)
            bot.status = "active"
            bot.error_message = None
            bot.last_validated_at = datetime.utcnow()
            db.commit()
            return {"ok": True, "bot_name": bot.bot_name, "bot_avatar_url": bot.bot_avatar_url}
        else:
            bot.status = "error"
            bot.error_message = f"Discord API returned {r.status_code}"
            db.commit()
            raise HTTPException(400, f"Invalid token: {r.status_code}")
    except httpx.RequestError as e:
        bot.status = "error"
        bot.error_message = str(e)
        db.commit()
        raise HTTPException(500, f"Connection error: {e}")


@router.delete("/verification/guild-bot")
def delete_guild_bot(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    """Remove the custom bot for this guild (revert to main bot)."""
    bot = db.execute(
        select(GuildBot).where(GuildBot.guild_id == guild_id)
    ).scalars().first()
    if bot:
        db.delete(bot)
        db.commit()
    return {"ok": True}
