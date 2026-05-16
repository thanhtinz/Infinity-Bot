"""Public API — no auth required. Bot status, commands list, invite URL."""
import os
from fastapi import APIRouter, Depends
from src.api.routes.config import get_config
from src.database.config import get_db

router = APIRouter(prefix="/public")


@router.get("/invite")
def public_invite(db=Depends(get_db)):
    """Trả về invite URL của bot và link server support — không cần auth."""
    config = get_config(db)
    client_id = os.environ.get("DISCORD_CLIENT_ID") or config.discord_client_id
    invite_url = None
    if client_id:
        invite_url = f"https://discord.com/oauth2/authorize?client_id={client_id}&permissions=8&scope=bot%20applications.commands"
    return {"invite_url": invite_url, "support_url": config.support_server_url}


@router.get("/status")
async def public_status():
    """Trả về tình trạng bot công khai — không cần auth."""
    try:
        from src.bot.manager import bot as _bot
        if _bot and _bot.is_ready():
            user = _bot.user
            guild_count = len(_bot.guilds)
            member_count = sum(g.member_count or 0 for g in _bot.guilds)
            latency_ms = round(_bot.latency * 1000, 1)

            # Shard info
            shard_info = []
            if hasattr(_bot, "shards") and _bot.shards:
                for shard_id, shard in _bot.shards.items():
                    shard_info.append({
                        "id": shard_id,
                        "latency_ms": round(shard.latency * 1000, 1) if shard.latency and shard.latency == shard.latency else None,
                        "guild_count": sum(1 for g in _bot.guilds if g.shard_id == shard_id),
                    })
            else:
                shard_info = [{"id": 0, "latency_ms": latency_ms, "guild_count": guild_count}]

            return {
                "online": True,
                "username": user.name if user else None,
                "avatar_url": str(user.display_avatar.url) if user and user.display_avatar else None,
                "guild_count": guild_count,
                "member_count": member_count,
                "latency_ms": latency_ms,
                "shard_count": _bot.shard_count or 1,
                "shards": shard_info,
            }
    except Exception:
        pass

    return {
        "online": False,
        "username": None,
        "avatar_url": None,
        "guild_count": None,
        "member_count": None,
        "latency_ms": None,
        "shard_count": None,
        "shards": [],
    }


@router.get("/commands")
async def public_commands():
    """Danh sách slash commands theo category."""
    categories = [
        {
            "name": "🛒 Shop",
            "commands": [
                {"name": "/shop", "description": "View the product list"},
                {"name": "/mua", "description": "Purchase a product"},
                {"name": "/donhang", "description": "View your orders"},
                {"name": "/topshop", "description": "Top buyers leaderboard"},
            ],
        },
        {
            "name": "🎫 Ticket",
            "commands": [
                {"name": "/ticket", "description": "Open a support ticket"},
                {"name": "/close", "description": "Close the current ticket"},
                {"name": "/claim", "description": "Claim a ticket to handle"},
                {"name": "/transcript", "description": "Export ticket history"},
            ],
        },
        {
            "name": "🎉 Giveaway",
            "commands": [
                {"name": "/giveaway start", "description": "Create a new giveaway"},
                {"name": "/giveaway end", "description": "End a giveaway"},
                {"name": "/giveaway reroll", "description": "Reroll the winner"},
                {"name": "/giveaway list", "description": "View all giveaways"},
            ],
        },
        {
            "name": "🔨 Moderation",
            "commands": [
                {"name": "/ban", "description": "Ban a member from the server"},
                {"name": "/kick", "description": "Kick a member"},
                {"name": "/timeout", "description": "Timeout a member"},
                {"name": "/unban", "description": "Unban a member"},
                {"name": "/warn", "description": "Warn a member"},
            ],
        },
        {
            "name": "🎙️ TempVoice",
            "commands": [
                {"name": "/voice rename", "description": "Rename your voice channel"},
                {"name": "/voice limit", "description": "Set member limit"},
                {"name": "/voice lock", "description": "Lock the voice channel"},
                {"name": "/voice kick", "description": "Kick someone from the channel"},
            ],
        },
        {
            "name": "⚙️ Utilities",
            "commands": [
                {"name": "/embed", "description": "Create a custom embed"},
                {"name": "/sticky", "description": "Pin a sticky message"},
                {"name": "/invite", "description": "Invite stats"},
                {"name": "/prefix", "description": "Change bot prefix"},
            ],
        },
    ]
    return {"categories": categories}
