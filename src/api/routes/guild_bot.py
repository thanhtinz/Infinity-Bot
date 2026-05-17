"""Guild Bot routes — per-guild custom Discord bot configuration."""
import logging
import httpx
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.api.deps import get_guild_id
from src.models.models import GuildBot

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/guild-bot")
def get_guild_bot(db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Get the custom bot config for this guild."""
    bot = db.execute(
        select(GuildBot).where(GuildBot.guild_id == guild_id)
    ).scalars().first()
    if not bot:
        return {
            "configured": False,
            "client_id": None,
            "bot_name": None,
            "bot_avatar_url": None,
            "status": "inactive",
            "has_token": False,
            "has_secret": False,
            "error_message": None,
        }
    return {
        "configured": True,
        "client_id": bot.client_id,
        "bot_name": bot.bot_name,
        "bot_avatar_url": bot.bot_avatar_url,
        "status": bot.status,
        "has_token": bool(bot.bot_token),
        "has_secret": bool(bot.client_secret),
        "error_message": bot.error_message,
    }


@router.post("/guild-bot")
async def save_guild_bot(body: dict, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Create or update the custom bot for this guild."""
    bot = db.execute(
        select(GuildBot).where(GuildBot.guild_id == guild_id)
    ).scalars().first()

    if not bot:
        bot = GuildBot(guild_id=guild_id)
        db.add(bot)

    # Update fields (only if provided — don't erase existing values)
    if "client_id" in body:
        bot.client_id = body["client_id"] or None
    if "bot_token" in body and body["bot_token"]:
        bot.bot_token = body["bot_token"]
    if "client_secret" in body and body["client_secret"]:
        bot.client_secret = body["client_secret"]

    bot.updated_at = datetime.utcnow()

    # Validate token by fetching bot info from Discord
    if bot.bot_token:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(
                    "https://discord.com/api/v10/users/@me",
                    headers={"Authorization": f"Bot {bot.bot_token}"},
                    timeout=10,
                )
                if res.status_code == 200:
                    data = res.json()
                    bot.bot_name = data.get("username")
                    avatar = data.get("avatar")
                    if avatar:
                        bot.bot_avatar_url = f"https://cdn.discordapp.com/avatars/{data['id']}/{avatar}.png"
                    bot.status = "active"
                    bot.error_message = None
                    # Update client_id from token if not set
                    if not bot.client_id:
                        bot.client_id = data["id"]
                else:
                    bot.status = "error"
                    bot.error_message = f"Invalid token (HTTP {res.status_code})"
        except Exception as e:
            bot.status = "error"
            bot.error_message = str(e)[:200]
    else:
        bot.status = "inactive"

    db.commit()
    return {
        "ok": True,
        "client_id": bot.client_id,
        "bot_name": bot.bot_name,
        "bot_avatar_url": bot.bot_avatar_url,
        "status": bot.status,
        "error_message": bot.error_message,
    }


@router.delete("/guild-bot")
def delete_guild_bot(db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Remove the custom bot for this guild (revert to main bot)."""
    bot = db.execute(
        select(GuildBot).where(GuildBot.guild_id == guild_id)
    ).scalars().first()
    if bot:
        db.delete(bot)
        db.commit()
    return {"ok": True}
