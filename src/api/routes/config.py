"""Config, Bot management, and feature routes."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
import os
import httpx
import discord
import logging

from src.database.config import get_db
from src.models.models import SystemConfig, ManagedEmoji
from src.schemas.schemas import SystemConfigBase, SystemConfigResponse, SystemConfigSafe
from src.bot.manager import start_bot, stop_bot

logger = logging.getLogger(__name__)

router = APIRouter()


def is_oauth_configured(config: SystemConfig | None) -> bool:
    return bool(
        (config and config.discord_client_id and config.discord_client_secret)
        or (os.environ.get("DISCORD_CLIENT_ID") and os.environ.get("DISCORD_CLIENT_SECRET"))
    )


def _resolve_public_url(config: SystemConfig | None, request: Request | None = None) -> str | None:
    """Resolve public_app_url: DB → env → auto-detect from request Origin/Referer."""
    if config and config.public_app_url:
        return config.public_app_url
    env_url = os.environ.get("PUBLIC_APP_URL")
    if env_url:
        return env_url
    # Auto-detect from request headers (works behind Cloudflare proxy)
    if request:
        origin = request.headers.get("origin")
        if origin and "localhost" not in origin:
            return origin.rstrip("/")
        referer = request.headers.get("referer")
        if referer and "localhost" not in referer:
            from urllib.parse import urlparse
            parsed = urlparse(referer)
            return f"{parsed.scheme}://{parsed.netloc}"
    return None


def get_config(db=Depends(get_db)):
    result = db.execute(select(SystemConfig).limit(1))
    config = result.scalars().first()
    if not config:
        config = SystemConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def get_config_for_guild(guild_id: str, db) -> SystemConfig:
    """Get per-guild config. Auto-creates with defaults if missing."""
    config = db.execute(
        select(SystemConfig).where(SystemConfig.guild_id == guild_id)
    ).scalars().first()
    if config:
        return config
    # Auto-create per-guild config with sensible defaults
    # Copy global fields (token, client_id/secret) from first row if available
    first = db.execute(select(SystemConfig).limit(1)).scalars().first()
    config = SystemConfig(guild_id=guild_id)
    if first:
        config.discord_token = first.discord_token
        config.discord_client_id = first.discord_client_id
        config.discord_client_secret = first.discord_client_secret
        config.public_app_url = first.public_app_url
        config.support_server_url = first.support_server_url
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


# ── Setup ─────────────────────────────────────────────────────────────────────

@router.get("/guilds")
async def get_bot_guilds(request: Request, db=Depends(get_db)):
    """Trả về danh sách guilds bot đang ở. Frontend dùng để populate guild selector."""
    from src.bot.manager import get_bot_client
    bot_client = get_bot_client()
    result = []
    if bot_client and bot_client.is_ready():
        for guild in bot_client.guilds:
            icon_url = str(guild.icon.url) if guild.icon else None
            member_count = guild.member_count or guild.approximate_member_count or len(guild.members) or 0
            result.append({
                "id": str(guild.id),
                "name": guild.name,
                "icon": icon_url,
                "member_count": member_count,
            })
            # Cache to DB for fallback
            cfg = db.execute(
                select(SystemConfig).where(SystemConfig.guild_id == str(guild.id))
            ).scalars().first()
            if cfg:
                cfg.guild_name = guild.name
                cfg.guild_icon = icon_url
                cfg.guild_member_count = member_count
        try:
            db.commit()
        except Exception:
            db.rollback()
    else:
        # Fallback: lấy từ DB SystemConfig rows
        configs = db.execute(select(SystemConfig).where(SystemConfig.guild_id.isnot(None))).scalars().all()
        for cfg in configs:
            if cfg.guild_id:
                result.append({
                    "id": cfg.guild_id,
                    "name": cfg.guild_name or f"Guild {cfg.guild_id}",
                    "icon": cfg.guild_icon or None,
                    "member_count": getattr(cfg, "guild_member_count", 0) or 0,
                })
    return result


@router.get("/setup/status")
def get_setup_status(request: Request, db=Depends(get_db)):
    result = db.execute(select(SystemConfig).limit(1))
    config = result.scalars().first()
    oauth_configured = is_oauth_configured(config)
    has_public_url = bool(_resolve_public_url(config, request))

    # Auto-save public_app_url if detected but missing in DB
    if not (config and config.public_app_url) and has_public_url:
        detected_url = _resolve_public_url(config, request)
        if detected_url and config:
            config.public_app_url = detected_url
            db.commit()
            logger.info(f"Auto-saved public_app_url: {detected_url}")

    # Auto-recover guild_id if missing but bot token exists
    if config and config.discord_token and not config.guild_id:
        try:
            r = httpx.get(
                "https://discord.com/api/users/@me/guilds",
                headers={"Authorization": f"Bot {config.discord_token}"},
                timeout=5,
            )
            if r.status_code == 200:
                guilds = r.json()
                if len(guilds) == 1:
                    config.guild_id = guilds[0]["id"]
                    db.commit()
                    logger.info("Auto-recovered guild_id: %s", config.guild_id)
        except Exception:
            logger.warning("Failed to auto-recover guild_id")

    return {
        "oauth_configured": oauth_configured and has_public_url,
        "has_discord_token": bool(config and config.discord_token),
        "has_guild_id": bool(config and config.guild_id),
        "has_admin_role_id": bool(config and config.admin_role_id),
    }


# ── Managed Emojis (for EmojiPicker) ──────────────────────────────────────────

@router.get("/managed-emojis")
def get_managed_emojis(request: Request, db=Depends(get_db)):
    """Return only emojis tracked in the managed_emojis table, filtered by guild."""
    guild_id = request.headers.get("X-Guild-ID")
    query = select(ManagedEmoji).order_by(ManagedEmoji.created_at.desc())
    if guild_id:
        query = query.where(ManagedEmoji.guild_id == guild_id)
    rows = db.execute(query).scalars().all()
    return [
        {
            "id": r.discord_id,
            "name": r.name,
            "animated": r.animated,
            "url": r.url,
            "usage": f"<{'a' if r.animated else ''}:{r.name}:{r.discord_id}>",
        }
        for r in rows
    ]


@router.post("/managed-emojis/sync")
async def sync_managed_emojis(request: Request, db=Depends(get_db)):
    """Import all current server emojis into managed_emojis table (per guild)."""
    guild_id = request.headers.get("X-Guild-ID")
    config = get_config_for_guild(guild_id, db) if guild_id else db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.discord_token:
        raise HTTPException(status_code=400, detail="Bot chưa cấu hình")
    target_guild = guild_id or config.guild_id
    if not target_guild:
        raise HTTPException(status_code=400, detail="Thiếu guild_id")
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{target_guild}/emojis",
            headers={"Authorization": f"Bot {config.discord_token}"}
        )
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail="Không thể lấy emoji từ server")
        server_emojis = res.json()

    added = 0
    for e in server_emojis:
        eid = str(e["id"])
        exists = db.execute(select(ManagedEmoji).where(ManagedEmoji.discord_id == eid)).scalars().first()
        if not exists:
            animated = e.get("animated", False)
            db.add(ManagedEmoji(
                discord_id=eid,
                name=e["name"],
                animated=animated,
                url=f"https://cdn.discordapp.com/emojis/{eid}.{'gif' if animated else 'png'}",
                guild_id=target_guild,
            ))
            added += 1
    if added:
        db.commit()
    return {"ok": True, "added": added, "total": len(server_emojis)}


@router.delete("/managed-emojis/{emoji_id}")
def remove_managed_emoji(emoji_id: str, db=Depends(get_db)):
    """Remove an emoji from managed list (doesn't delete from server)."""
    managed = db.execute(select(ManagedEmoji).where(ManagedEmoji.discord_id == emoji_id)).scalars().first()
    if not managed:
        raise HTTPException(status_code=404, detail="Emoji không có trong danh sách quản lý")
    db.delete(managed)
    db.commit()
    return {"ok": True}


# ── Stickers CRUD ─────────────────────────────────────────────────────────────

FORMAT_EXT = {1: "png", 2: "png", 3: "gif", 4: "json"}  # APNG uses .png extension

def _sticker_url(sticker_id: str, format_type: int) -> str:
    ext = FORMAT_EXT.get(format_type, "png")
    return f"https://media.discordapp.net/stickers/{sticker_id}.{ext}?size=320"


@router.get("/discord/stickers")
async def get_discord_stickers(request: Request, db=Depends(get_db)):
    guild_id = request.headers.get("X-Guild-ID")
    config = get_config_for_guild(guild_id, db) if guild_id else db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.discord_token:
        return []
    target_guild = guild_id or config.guild_id
    if not target_guild:
        return []
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{target_guild}/stickers",
            headers={"Authorization": f"Bot {config.discord_token}"},
        )
        if res.status_code != 200:
            return []
        stickers = res.json()
        return [
            {
                "id": s["id"],
                "name": s["name"],
                "description": s.get("description", ""),
                "tags": s.get("tags", ""),
                "format_type": s.get("format_type", 1),
                "url": _sticker_url(s["id"], s.get("format_type", 1)),
            }
            for s in stickers
        ]


@router.post("/discord/stickers")
async def upload_discord_sticker(request: Request, db=Depends(get_db)):
    guild_id = request.headers.get("X-Guild-ID")
    config = get_config_for_guild(guild_id, db) if guild_id else db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.discord_token:
        raise HTTPException(status_code=400, detail="Bot chưa cấu hình")
    target_guild = guild_id or config.guild_id
    if not target_guild:
        raise HTTPException(status_code=400, detail="Thiếu guild_id")
    body = await request.json()
    name = body.get("name", "").strip()
    description = body.get("description", "").strip() or "\u200b"
    tags = body.get("tags", "").strip() or name
    file_b64 = body.get("file_base64", "")  # data:image/png;base64,...
    if not name or not file_b64:
        raise HTTPException(status_code=400, detail="Thiếu name hoặc file")

    # Parse data URI → bytes
    import base64 as b64mod
    if "," in file_b64:
        header, data = file_b64.split(",", 1)
    else:
        data = file_b64
        header = ""
    file_bytes = b64mod.b64decode(data)

    # Determine content type
    if "gif" in header:
        content_type = "image/gif"
        filename = f"{name}.gif"
    elif "apng" in header or "png" in header:
        content_type = "image/png"
        filename = f"{name}.png"
    else:
        content_type = "image/png"
        filename = f"{name}.png"

    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"https://discord.com/api/guilds/{target_guild}/stickers",
            headers={"Authorization": f"Bot {config.discord_token}"},
            data={"name": name, "description": description, "tags": tags},
            files={"file": (filename, file_bytes, content_type)},
        )
        if res.status_code not in (200, 201):
            detail = res.json().get("message", "Lỗi upload sticker")
            raise HTTPException(status_code=400, detail=detail)
        s = res.json()
        return {
            "id": s["id"],
            "name": s["name"],
            "description": s.get("description", ""),
            "tags": s.get("tags", ""),
            "format_type": s.get("format_type", 1),
            "url": _sticker_url(s["id"], s.get("format_type", 1)),
        }


@router.delete("/discord/stickers/{sticker_id}")
async def delete_discord_sticker(sticker_id: str, request: Request, db=Depends(get_db)):
    guild_id = request.headers.get("X-Guild-ID")
    config = get_config_for_guild(guild_id, db) if guild_id else db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.discord_token:
        raise HTTPException(status_code=400, detail="Bot chưa cấu hình")
    target_guild = guild_id or config.guild_id
    if not target_guild:
        raise HTTPException(status_code=400, detail="Thiếu guild_id")
    async with httpx.AsyncClient() as client:
        res = await client.delete(
            f"https://discord.com/api/guilds/{target_guild}/stickers/{sticker_id}",
            headers={"Authorization": f"Bot {config.discord_token}"},
        )
        if res.status_code not in (200, 204):
            raise HTTPException(status_code=400, detail="Xóa sticker thất bại")
    return {"ok": True}


# ── System Config CRUD ────────────────────────────────────────────────────────

def _config_to_safe(config) -> SystemConfigSafe:
    """Convert SystemConfig ORM object to safe response (no secrets exposed)."""
    return SystemConfigSafe(
        id=config.id,
        bot_status=config.bot_status or "offline",
        discord_client_id=config.discord_client_id,
        public_app_url=config.public_app_url,
        support_server_url=config.support_server_url,
        payos_client_id=config.payos_client_id,
        guild_id=config.guild_id,
        admin_role_id=config.admin_role_id,
        don_hang_channel_id=config.don_hang_channel_id,
        feedback_channel_id=config.feedback_channel_id,
        coupon_channel_id=config.coupon_channel_id,
        bang_gia_channel_id=config.bang_gia_channel_id,
        welcome_channel_id=config.welcome_channel_id,
        command_prefix=config.command_prefix or "!",
        has_discord_token=bool(config.discord_token),
        has_discord_client_secret=bool(config.discord_client_secret),
        has_payos_api_key=bool(config.payos_api_key),
        has_payos_checksum_key=bool(config.payos_checksum_key),
        bot_invisible=bool(config.bot_invisible),
        language=config.language or "en",
        currency=getattr(config, "currency", None) or "USD",
        currency_symbol=getattr(config, "currency_symbol", None) or "$",
        payment_methods=getattr(config, "payment_methods", None) or [],
        has_paypal_client_id=bool(getattr(config, "paypal_client_id", None)),
        has_paypal_client_secret=bool(getattr(config, "paypal_client_secret", None)),
        paypal_mode=getattr(config, "paypal_mode", None) or "sandbox",
        has_crypto_api_key=bool(getattr(config, "crypto_api_key", None)),
        crypto_provider=getattr(config, "crypto_provider", None) or "nowpayments",
        manual_qr_image_id=getattr(config, "manual_qr_image_id", None),
        manual_bank_name=getattr(config, "manual_bank_name", None),
        manual_account_holder=getattr(config, "manual_account_holder", None),
        manual_account_number=getattr(config, "manual_account_number", None),
        manual_instructions=getattr(config, "manual_instructions", None),
        flash_sale_channel_id=getattr(config, "flash_sale_channel_id", None),
        spending_leaderboard_channel_id=getattr(config, "spending_leaderboard_channel_id", None),
        spending_leaderboard_schedule=getattr(config, "spending_leaderboard_schedule", None),
        spending_leaderboard_time=getattr(config, "spending_leaderboard_time", None),
        inventory_low_stock_threshold=getattr(config, "inventory_low_stock_threshold", None) or 5,
    )


@router.get("/config", response_model=SystemConfigSafe)
def read_config(request: Request, db=Depends(get_db)):
    guild_id = request.headers.get("X-Guild-ID")
    config = get_config_for_guild(guild_id, db) if guild_id else get_config(db)
    return _config_to_safe(config)


@router.post("/config", response_model=SystemConfigSafe)
def update_config(config_in: SystemConfigBase, request: Request, db=Depends(get_db)):
    guild_id = request.headers.get("X-Guild-ID")
    if guild_id:
        config = db.execute(
            select(SystemConfig).where(SystemConfig.guild_id == guild_id)
        ).scalars().first()
        if not config:
            config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    else:
        config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config:
        config = SystemConfig(**config_in.model_dump(exclude_none=True))
        db.add(config)
    else:
        for key, value in config_in.model_dump(exclude_unset=True).items():
            if value is not None:
                setattr(config, key, value)
    db.commit()
    db.refresh(config)
    # Invalidate language cache if language might have changed
    from src.bot.i18n import invalidate_lang_cache
    invalidate_lang_cache(config.guild_id)
    return _config_to_safe(config)


# ── Bot management ────────────────────────────────────────────────────────────

@router.post("/bot/start")
async def api_start_bot():
    success = await start_bot()
    if not success:
        raise HTTPException(status_code=400, detail="Failed to start bot. Check token.")
    return {"message": "Bot starting..."}


@router.post("/bot/stop")
async def api_stop_bot():
    await stop_bot()
    return {"message": "Bot stopped."}


@router.post("/bot/restart")
async def api_restart_bot():
    await stop_bot()
    success = await start_bot()
    if not success:
        raise HTTPException(status_code=400, detail="Failed to start bot.")
    return {"message": "Bot restarting..."}


@router.post("/bot/sync-commands")
async def api_sync_commands():
    from src.bot.manager import bot as _bot
    if _bot is None or not _bot.is_ready():
        raise HTTPException(status_code=400, detail="Bot is not running")
    try:
        # Purge stale global commands
        await _bot.http.bulk_upsert_global_commands(_bot.user.id, [])
        # Sync current commands to all guilds
        await _bot.sync_commands()
        synced = len(_bot.pending_application_commands)
        return {"message": f"Synced {synced} commands to {len(_bot.guilds)} guilds"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bot/info")
async def api_bot_info():
    from src.bot.manager import bot as _bot, bot_start_time
    import datetime as _dt

    if _bot is None or not _bot.is_ready():
        return {
            "online": False, "username": None, "discriminator": None,
            "avatar_url": None, "bot_id": None, "latency_ms": None,
            "guild_count": None, "member_count": None, "uptime_seconds": None,
        }
    guilds = _bot.guilds
    member_count = sum(g.member_count or 0 for g in guilds)
    uptime_s = None
    if bot_start_time:
        uptime_s = int((_dt.datetime.utcnow() - bot_start_time).total_seconds())
    user = _bot.user
    avatar_url = str(user.display_avatar.url) if user and user.display_avatar else None

    # Shard info
    shard_info = []
    if hasattr(_bot, "shards") and _bot.shards:
        for shard_id, shard in _bot.shards.items():
            lat = shard.latency
            shard_info.append({
                "id": shard_id,
                "latency_ms": round(lat * 1000, 1) if lat and lat == lat else None,
                "guild_count": sum(1 for g in guilds if g.shard_id == shard_id),
            })
    else:
        shard_info = [{"id": 0, "latency_ms": round(_bot.latency * 1000, 1), "guild_count": len(guilds)}]

    return {
        "online": True,
        "username": user.name if user else None,
        "discriminator": user.discriminator if user else None,
        "avatar_url": avatar_url,
        "bot_id": str(user.id) if user else None,
        "latency_ms": round(_bot.latency * 1000, 1),
        "guild_count": len(guilds),
        "member_count": member_count,
        "uptime_seconds": uptime_s,
        "shard_count": _bot.shard_count or 1,
        "shards": shard_info,
    }


@router.post("/bot/profile")
async def api_update_bot_profile(body: dict):
    from src.bot.manager import bot as _bot
    import base64 as _b64
    import httpx as _httpx

    if _bot is None or not _bot.is_ready() or not _bot.user:
        raise HTTPException(status_code=400, detail="Bot chưa online")
    payload: dict = {}
    if "username" in body and body["username"]:
        payload["username"] = body["username"]
    if "avatar_url" in body and body["avatar_url"]:
        try:
            async with _httpx.AsyncClient() as client:
                r = await client.get(body["avatar_url"], timeout=10)
                r.raise_for_status()
                mime = r.headers.get("content-type", "image/png").split(";")[0]
                data = _b64.b64encode(r.content).decode()
                payload["avatar"] = f"data:{mime};base64,{data}"
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Không tải được avatar: {e}")
    if "avatar_base64" in body and body["avatar_base64"]:
        payload["avatar"] = body["avatar_base64"]
    if not payload:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật")
    try:
        await _bot.user.edit(**payload)
    except discord.HTTPException as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@router.post("/bot/presence")
async def api_update_presence(body: dict):
    from src.bot.manager import bot as _bot

    if _bot is None or not _bot.is_ready():
        raise HTTPException(status_code=400, detail="Bot chưa online")
    status_map = {
        "online": discord.Status.online,
        "idle": discord.Status.idle,
        "dnd": discord.Status.do_not_disturb,
        "invisible": discord.Status.invisible,
    }
    status = status_map.get(body.get("status", "online"), discord.Status.online)
    activity = None
    activity_type = body.get("activity_type", "")
    activity_name = body.get("activity_name", "")
    if activity_name:
        if activity_type == "playing":
            activity = discord.Game(name=activity_name)
        elif activity_type == "watching":
            activity = discord.Activity(type=discord.ActivityType.watching, name=activity_name)
        elif activity_type == "listening":
            activity = discord.Activity(type=discord.ActivityType.listening, name=activity_name)
        elif activity_type == "competing":
            activity = discord.Activity(type=discord.ActivityType.competing, name=activity_name)
        elif activity_type == "streaming":
            activity = discord.Streaming(name=activity_name, url=body.get("stream_url", "https://twitch.tv/discord"))
    try:
        await _bot.change_presence(status=status, activity=activity)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@router.get("/bot/emojis")
async def api_list_emojis(db=Depends(get_db)):
    import httpx as _httpx
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.discord_token:
        return []
    async with _httpx.AsyncClient() as client:
        r = await client.get("https://discord.com/api/oauth2/@me",
            headers={"Authorization": f"Bot {config.discord_token}"})
        if not r.is_success:
            return []
        app_id = r.json().get("application", {}).get("id")
        if not app_id:
            return []
        r2 = await client.get(f"https://discord.com/api/applications/{app_id}/emojis",
            headers={"Authorization": f"Bot {config.discord_token}"})
        if not r2.is_success:
            return []
        data = r2.json()
        emojis = data.get("items", data) if isinstance(data, dict) else data
        return [{"id": str(e["id"]), "name": e["name"], "animated": e.get("animated", False),
                 "url": f"https://cdn.discordapp.com/emojis/{e['id']}.{'gif' if e.get('animated') else 'png'}"}
                for e in (emojis or [])]


@router.post("/bot/emojis")
async def api_upload_emoji(body: dict, db=Depends(get_db)):
    import httpx as _httpx
    name = body.get("name", "").strip()
    image_data = body.get("image")
    if not name or not image_data:
        raise HTTPException(status_code=400, detail="Cần name và image")
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.discord_token:
        raise HTTPException(status_code=400, detail="Chưa cấu hình Bot Token")
    async with _httpx.AsyncClient() as client:
        r = await client.get("https://discord.com/api/oauth2/@me",
            headers={"Authorization": f"Bot {config.discord_token}"})
        if not r.is_success:
            raise HTTPException(status_code=400, detail="Không lấy được app ID")
        app_id = r.json().get("application", {}).get("id")
        r2 = await client.post(f"https://discord.com/api/applications/{app_id}/emojis",
            headers={"Authorization": f"Bot {config.discord_token}"},
            json={"name": name, "image": image_data})
        if not r2.is_success:
            raise HTTPException(status_code=400, detail=str(r2.text[:200]))
        e = r2.json()
        return {"ok": True, "id": str(e["id"]), "name": e["name"], "animated": e.get("animated", False),
                "url": f"https://cdn.discordapp.com/emojis/{e['id']}.{'gif' if e.get('animated') else 'png'}"}


@router.delete("/bot/emojis/{emoji_id}")
async def api_delete_emoji(emoji_id: str, db=Depends(get_db)):
    import httpx as _httpx
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.discord_token:
        raise HTTPException(status_code=400, detail="Chưa cấu hình Bot Token")
    async with _httpx.AsyncClient() as client:
        r = await client.get("https://discord.com/api/oauth2/@me",
            headers={"Authorization": f"Bot {config.discord_token}"})
        app_id = r.json().get("application", {}).get("id") if r.is_success else None
        if not app_id:
            raise HTTPException(status_code=400, detail="Không lấy được app ID")
        r2 = await client.delete(f"https://discord.com/api/applications/{app_id}/emojis/{emoji_id}",
            headers={"Authorization": f"Bot {config.discord_token}"})
        if r2.status_code not in (200, 204):
            raise HTTPException(status_code=400, detail="Xóa thất bại")
        return {"ok": True}

