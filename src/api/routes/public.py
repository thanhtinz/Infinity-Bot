"""Public API — no auth required. Bot status, commands list, invite URL."""
import datetime
import os
import resource
from fastapi import APIRouter, Depends
from src.api.routes.config import get_config
from src.database.config import get_db

router = APIRouter(prefix="/public")


@router.get("/invite")
def public_invite(db=Depends(get_db)):
    """Return invite URL and support server URL without auth."""
    config = get_config(db)
    client_id = os.environ.get("DISCORD_CLIENT_ID") or config.discord_client_id
    invite_url = None
    if client_id:
        invite_url = f"https://discord.com/oauth2/authorize?client_id={client_id}&permissions=8&scope=bot%20applications.commands"
    return {"invite_url": invite_url, "support_url": config.support_server_url}

def _format_uptime(started_at) -> str | None:
    if not started_at:
        return None
    delta = datetime.datetime.utcnow() - started_at
    total_seconds = max(0, int(delta.total_seconds()))
    days, rem = divmod(total_seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, _ = divmod(rem, 60)
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours or days:
        parts.append(f"{hours}h")
    parts.append(f"{minutes}m")
    return " ".join(parts)


def _memory_mb() -> float | None:
    try:
        usage = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        # Linux reports KB, macOS reports bytes. Sandbox is Linux, keep fallback safe.
        mb = usage / 1024 if usage > 10_000_000 else usage / 1024
        return round(mb, 2)
    except Exception:
        return None



@router.get("/status")
async def public_status():
    """Return public bot status without auth."""
    try:
        from src.bot.manager import bot as _bot, bot_start_time
        if _bot and _bot.is_ready():
            user = _bot.user
            guild_count = len(_bot.guilds)
            member_count = sum(g.member_count or 0 for g in _bot.guilds)
            latency_ms = round(_bot.latency * 1000, 2)
            now = datetime.datetime.utcnow()

            # Shard info
            shard_info = []
            if hasattr(_bot, "shards") and _bot.shards:
                for shard_id, shard in sorted(_bot.shards.items()):
                    shard_guilds = [g for g in _bot.guilds if g.shard_id == shard_id]
                    shard_info.append({
                        "id": shard_id,
                        "latency_ms": round(shard.latency * 1000, 2) if shard.latency and shard.latency == shard.latency else None,
                        "guild_count": len(shard_guilds),
                    })
            else:
                shard_info = [{"id": 0, "latency_ms": latency_ms, "guild_count": guild_count}]

            cluster_count = max(1, int(os.environ.get("CLUSTER_COUNT", "1") or "1"))
            shards_per_cluster = max(1, (len(shard_info) + cluster_count - 1) // cluster_count)
            clusters = []
            for cluster_id in range(cluster_count):
                start = cluster_id * shards_per_cluster
                cluster_shards = shard_info[start:start + shards_per_cluster]
                if not cluster_shards and cluster_id > 0:
                    continue
                cluster_guilds = sum(s.get("guild_count") or 0 for s in cluster_shards)
                latencies = [s["latency_ms"] for s in cluster_shards if s.get("latency_ms") is not None]
                clusters.append({
                    "id": cluster_id,
                    "shards": [s["id"] for s in cluster_shards],
                    "servers": cluster_guilds,
                    "cached_users": member_count if cluster_count == 1 else None,
                    "latency_ms": round(sum(latencies) / len(latencies), 2) if latencies else latency_ms,
                    "uptime": _format_uptime(bot_start_time),
                    "mem_usage_mb": _memory_mb(),
                    "last_updated_at": now.isoformat() + "Z",
                    "last_updated_seconds": 0,
                })

            return {
                "online": True,
                "username": user.name if user else None,
                "avatar_url": str(user.display_avatar.url) if user and user.display_avatar else None,
                "guild_count": guild_count,
                "member_count": member_count,
                "latency_ms": latency_ms,
                "uptime": _format_uptime(bot_start_time),
                "mem_usage_mb": _memory_mb(),
                "last_updated_at": now.isoformat() + "Z",
                "shard_count": _bot.shard_count or len(shard_info) or 1,
                "cluster_count": len(clusters),
                "shards": shard_info,
                "clusters": clusters,
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
        "uptime": None,
        "mem_usage_mb": None,
        "last_updated_at": None,
        "shard_count": None,
        "cluster_count": 0,
        "shards": [],
        "clusters": [],
    }


@router.get("/commands")
async def public_commands():
    """Full public slash-command catalog for the landing page."""
    from src.bot.cogs.help_cog import HELP_CATEGORIES

    category_labels = {
        "fun": "Fun",
        "info": "Info",
        "level": "Level",
        "manager": "Manager",
        "misc": "Misc",
        "moderator": "Moderator",
        "role": "Role",
        "tempvoice": "TempVoice",
        "other": "Other",
    }

    command_descriptions = {
        "san_pham": "Browse products and product details.",
        "orders": "View your orders or a specific order.",
        "feedback": "Leave product feedback.",
        "support": "Contact server support.",
        "bxh": "View the shop leaderboard.",
        "tao_don": "Create an order for a member.",
        "tao_don_custom": "Create a custom order with a custom name.",
        "bang_gia": "Send the product price list to a channel.",
        "level rank": "View your rank card and XP.",
        "level leaderboard": "View the server XP leaderboard.",
        "level background": "Choose a personal rank-card background.",
        "giveaway": "Create a new giveaway.",
        "giveaway_list": "View active giveaways.",
        "giveaway_reroll": "Reroll a giveaway winner.",
        "giveaway_end": "End a giveaway early.",
        "giveaway_ban": "Ban a member from giveaways.",
        "giveaway_unban": "Unban a member from giveaways.",
        "ticket create": "Create a support ticket.",
        "ticket close": "Close the current ticket.",
        "ticket reopen": "Reopen a closed ticket.",
        "ticket claim": "Claim a ticket as staff.",
        "ticket unclaim": "Release a claimed ticket.",
        "ticket add": "Add a member to a ticket.",
        "ticket remove": "Remove a member from a ticket.",
        "ticket transcript": "Export a ticket transcript.",
        "ticket notes": "View or add ticket notes.",
        "ticket history": "View ticket history.",
        "ticket stats": "View ticket statistics.",
        "ticket blacklist": "Block a member from creating tickets.",
        "panel send": "Send a ticket panel to a channel.",
        "warn": "Warn a member.",
        "unwarn": "Remove a warning.",
        "warnings": "View warning history.",
        "kick": "Kick a member.",
        "ban": "Ban a member.",
        "unban": "Unban a user by ID.",
        "snipe": "View the most recently deleted message.",
        "editsnipe": "View the most recently edited message.",
        "purge": "Bulk delete messages in a channel.",
        "nuke": "Clone and reset a channel.",
        "lock": "Lock a channel.",
        "unlock": "Unlock a channel.",
        "hide_channel": "Hide a channel from regular members.",
        "show_channel": "Show a hidden channel.",
        "block_channel": "Block a member or role from a channel.",
        "unblock_channel": "Unblock a member or role from a channel.",
        "slowmode": "Set channel slowmode.",
        "image_only": "Allow only images and videos in a channel.",
        "announce": "Send an announcement embed.",
        "move_message": "Move a message to another channel.",
        "clear_reactions": "Clear reactions from a message.",
        "pin_message": "Pin a message by link.",
        "unpin_message": "Unpin a message by link.",
        "role_add": "Add a role to a member.",
        "role_remove": "Remove a role from a member.",
        "nick": "Change or clear a member nickname.",
        "invites me": "View your invite stats.",
        "invites info": "View invite stats for a member.",
        "invites leaderboard": "View the invite leaderboard.",
        "invites fake": "Mark a member's invites as fake.",
        "room rename": "Rename your voice room.",
        "room limit": "Set the room member limit.",
        "room lock": "Lock your voice room.",
        "room unlock": "Unlock your voice room.",
        "room hide": "Hide your voice room.",
        "room unhide": "Show your voice room.",
        "room private": "Make your voice room private.",
        "room public": "Make your voice room public.",
        "room permit": "Permit a member to join.",
        "room reject": "Reject a member from joining.",
        "room boot": "Boot a member from the room.",
        "room mute": "Mute a member in the room.",
        "room transfer": "Transfer room ownership.",
        "room claim": "Claim ownership when the owner leaves.",
        "room bitrate": "Change room bitrate.",
        "room panel": "Send the room control panel again.",
        "afk": "Set your AFK status.",
        "avatar": "View a member avatar.",
        "banner": "View a member banner.",
        "userinfo": "View member information.",
        "serverinfo": "View server information.",
        "poll": "Create a quick poll.",
        "qr": "Generate a QR code from text or a link.",
        "setprefix": "Set the interaction command prefix.",
    }

    interaction_descriptions = {
        "hug": "Hug another member.",
        "pat": "Pat another member.",
        "kiss": "Kiss another member.",
        "slap": "Slap another member.",
        "punch": "Punch another member.",
        "wave": "Wave at another member.",
        "cuddle": "Cuddle another member.",
        "poke": "Poke another member.",
        "tickle": "Tickle another member.",
        "bite": "Bite another member.",
        "lick": "Lick another member.",
        "wink": "Wink at another member.",
        "stare": "Stare at another member.",
        "brofist": "Brofist another member.",
        "handhold": "Hold hands with another member.",
        "nuzzle": "Nuzzle another member.",
        "smack": "Smack another member.",
        "airkiss": "Send an air kiss.",
        "angrystare": "Give an angry stare.",
        "pinch": "Pinch another member.",
        "nom": "Nom another member.",
        "peek": "Peek at another member.",
    }

    expression_descriptions = {
        name: f"Post a {name} expression."
        for name in [
            "blush", "cry", "dance", "laugh", "smile", "happy", "sad", "sleep", "yawn",
            "shrug", "facepalm", "clap", "celebrate", "thumbsup", "sorry", "confused",
            "nervous", "scared", "surprised", "cool", "love", "run", "shy", "smug", "yay",
        ]
    }

    categories = []
    total = 0
    for cat in HELP_CATEGORIES:
        cat_key = cat.get("key")
        commands = []
        for cmd in cat.get("commands", []):
            total += 1
            name = cmd["name"]
            description = (
                command_descriptions.get(name)
                or interaction_descriptions.get(name)
                or expression_descriptions.get(name)
                or cmd.get("desc")
                or f"Run the /{name} command."
            )
            commands.append({
                "name": f"/{name}",
                "description": description,
                "usage": cmd.get("usage", f"`/{name}`"),
                "admin": bool(cmd.get("admin")),
            })
        categories.append({
            "key": cat_key,
            "name": category_labels.get(cat_key, "Commands"),
            "commands": commands,
            "count": len(commands),
        })
    return {"categories": categories, "total": total}
