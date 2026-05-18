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

    # Display-name overrides for Vietnamese bot command names
    DISPLAY_NAMES: dict[str, str] = {
        "san_pham":        "product",
        "tao_don":         "create_order",
        "tao_don_custom":  "create_custom_order",
        "bang_gia":        "price_list",
        "bxh":             "leaderboard",
    }

    category_labels = {
        "interaction": "Interactions",
        "expression":  "Expressions",
        "fun":         "Fun",
        "shop":        "Shop",
        "info":        "Info",
        "level":       "Levels",
        "giveaway":    "Giveaways",
        "misc":        "Misc",
        "sticky":      "Sticky",
        "moderator":   "Moderation",
        "modtools":    "Mod Tools",
        "role":        "Roles",
        "other":       "Other",
        "channel_admin": "Channel Admin",
        "invites":     "Invites",
        "voice":       "Temp Voice",
        "utility":     "Utility",
    }

    categories = []
    total = 0
    for cat in HELP_CATEGORIES:
        cat_key = cat.get("key")
        commands = []
        for cmd in cat.get("commands", []):
            total += 1
            raw_name = cmd["name"]
            display = DISPLAY_NAMES.get(raw_name, raw_name)
            # If the name was remapped, also rewrite the usage string
            raw_usage = cmd.get("usage") or f"`/{raw_name}`"
            if raw_name in DISPLAY_NAMES:
                display_usage = raw_usage.replace(f"/{raw_name}", f"/{display}")
            else:
                display_usage = raw_usage
            commands.append({
                "name": f"/{display}",
                "description": cmd.get("desc", f"Run the /{display} command."),
                "usage": display_usage,
                "admin": bool(cmd.get("admin")),
            })
        categories.append({
            "key": cat_key,
            "name": category_labels.get(cat_key, cat.get("name", "Commands")),
            "commands": commands,
            "count": len(commands),
        })
    return {"categories": categories, "total": total}
