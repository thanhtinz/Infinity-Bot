"""Config, Discord API, Bot management routes."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
import os
import httpx
import discord
import logging

from src.database.config import get_db
from src.models.models import SystemConfig
from src.schemas.schemas import SystemConfigBase, SystemConfigResponse
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


# ── Setup ─────────────────────────────────────────────────────────────────────

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


# ── Discord API proxy ────────────────────────────────────────────────────────

@router.get("/discord/guilds")
async def get_discord_guilds(db=Depends(get_db)):
    result = db.execute(select(SystemConfig).limit(1))
    config = result.scalars().first()
    if not config or not config.discord_token:
        raise HTTPException(status_code=400, detail="Bot token chưa được cấu hình")
    async with httpx.AsyncClient() as client:
        res = await client.get(
            "https://discord.com/api/users/@me/guilds",
            headers={"Authorization": f"Bot {config.discord_token}"}
        )
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail="Không thể lấy danh sách server")
        return res.json()


@router.get("/discord/channels")
async def get_discord_channels(guild_id: str = None, db=Depends(get_db)):
    result = db.execute(select(SystemConfig).limit(1))
    config = result.scalars().first()
    if not config or not config.discord_token:
        return []
    target_guild = guild_id or config.guild_id
    if not target_guild:
        return []
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{target_guild}/channels",
            headers={"Authorization": f"Bot {config.discord_token}"}
        )
        if res.status_code != 200:
            return []
        channels = res.json()
        return [{"id": c["id"], "name": c["name"]} for c in channels if c.get("type") == 0]


@router.get("/discord/channels/all")
async def get_discord_all_channels(guild_id: str = None, db=Depends(get_db)):
    result = db.execute(select(SystemConfig).limit(1))
    config = result.scalars().first()
    if not config or not config.discord_token:
        return []
    target_guild = guild_id or config.guild_id
    if not target_guild:
        return []
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{target_guild}/channels",
            headers={"Authorization": f"Bot {config.discord_token}"}
        )
        if res.status_code != 200:
            return []
        channels = res.json()
        return [{"id": c["id"], "name": c["name"], "type": c.get("type", 0), "parent_id": c.get("parent_id"), "position": c.get("position", 0)} for c in channels]


@router.get("/discord/roles")
async def get_discord_roles(guild_id: str = None, db=Depends(get_db)):
    result = db.execute(select(SystemConfig).limit(1))
    config = result.scalars().first()
    if not config or not config.discord_token:
        return []
    target_guild = guild_id or config.guild_id
    if not target_guild:
        return []
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{target_guild}/roles",
            headers={"Authorization": f"Bot {config.discord_token}"}
        )
        if res.status_code != 200:
            return []
        roles = res.json()
        return [{"id": r["id"], "name": r["name"], "color": r.get("color", 0)} for r in roles if r.get("name") != "@everyone"]


@router.get("/discord/emojis")
async def get_discord_emojis(guild_id: str = None, db=Depends(get_db)):
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.discord_token:
        return []
    target_guild = guild_id or config.guild_id
    if not target_guild:
        return []
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{target_guild}/emojis",
            headers={"Authorization": f"Bot {config.discord_token}"}
        )
        if res.status_code != 200:
            return []
        emojis = res.json()
        return [
            {
                "id": e["id"],
                "name": e["name"],
                "animated": e.get("animated", False),
                "url": f"https://cdn.discordapp.com/emojis/{e['id']}.{'gif' if e.get('animated') else 'png'}",
                "usage": f"<{'a' if e.get('animated') else ''}:{e['name']}:{e['id']}>",
            }
            for e in emojis
        ]


@router.post("/discord/emojis")
async def upload_discord_emoji(body: dict, db=Depends(get_db)):
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.discord_token:
        raise HTTPException(status_code=400, detail="Bot chưa cấu hình")
    target_guild = config.guild_id
    if not target_guild:
        raise HTTPException(status_code=400, detail="Chưa chọn server")
    emoji_name = body.get("name", "").strip()
    image_b64 = body.get("image_base64", "")
    if not emoji_name or not image_b64:
        raise HTTPException(status_code=400, detail="Thiếu name hoặc image_base64")
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"https://discord.com/api/guilds/{target_guild}/emojis",
            headers={"Authorization": f"Bot {config.discord_token}", "Content-Type": "application/json"},
            json={"name": emoji_name, "image": image_b64},
        )
        if res.status_code not in (200, 201):
            detail = res.json().get("message", "Lỗi upload emoji")
            raise HTTPException(status_code=400, detail=detail)
        e = res.json()
        return {
            "id": e["id"],
            "name": e["name"],
            "animated": e.get("animated", False),
            "url": f"https://cdn.discordapp.com/emojis/{e['id']}.{'gif' if e.get('animated') else 'png'}",
            "usage": f"<{'a' if e.get('animated') else ''}:{e['name']}:{e['id']}>",
        }


@router.delete("/discord/emojis/{emoji_id}")
async def delete_discord_emoji(emoji_id: str, db=Depends(get_db)):
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.discord_token:
        raise HTTPException(status_code=400, detail="Bot chưa cấu hình")
    target_guild = config.guild_id
    async with httpx.AsyncClient() as client:
        res = await client.delete(
            f"https://discord.com/api/guilds/{target_guild}/emojis/{emoji_id}",
            headers={"Authorization": f"Bot {config.discord_token}"},
        )
        if res.status_code not in (200, 204):
            raise HTTPException(status_code=400, detail="Xóa emoji thất bại")
    return {"ok": True}


# ── System Config CRUD ────────────────────────────────────────────────────────

@router.get("/config", response_model=SystemConfigResponse)
def read_config(config: SystemConfig = Depends(get_config)):
    return config


@router.post("/config", response_model=SystemConfigResponse)
def update_config(config_in: SystemConfigBase, db=Depends(get_db)):
    result = db.execute(select(SystemConfig).limit(1))
    config = result.scalars().first()
    if not config:
        config = SystemConfig(**config_in.model_dump(exclude_none=True))
        db.add(config)
    else:
        for key, value in config_in.model_dump().items():
            if value is not None and value != "":
                setattr(config, key, value)
    db.commit()
    db.refresh(config)
    return config


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
