# src/bot/cogs/autoresponder.py
"""Auto Responder — keyword/regex triggered auto-replies managed from dashboard."""
import discord
import fnmatch
import logging
import re
import time as _time
from datetime import datetime, timezone
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import AutoResponder
from src.bot.base_cog import check_feature

logger = logging.getLogger(__name__)

# Cache rules for 30 seconds to avoid DB hits on every message
_cache: dict[str, tuple[float, list]] = {}  # guild_id -> (timestamp, rules)
CACHE_TTL = 30


def _get_session():
    return SessionLocal()


def _build_vars(message: discord.Message) -> dict[str, str]:
    """Build variable substitution dict from message context."""
    author = message.author
    guild = message.guild
    channel = message.channel
    now = datetime.now(timezone.utc)

    v: dict[str, str] = {
        "{user}": str(author),
        "{user.mention}": author.mention,
        "{user.id}": str(author.id),
        "{user.name}": author.display_name,
        "{user.avatar}": str(author.display_avatar.url) if author.display_avatar else "",
        "{user.created}": author.created_at.strftime("%d/%m/%Y") if author.created_at else "",
        "{server}": guild.name if guild else "Server",
        "{server.id}": str(guild.id) if guild else "0",
        "{server.icon}": str(guild.icon.url) if guild and guild.icon else "",
        "{server.member_count}": str(guild.member_count) if guild else "0",
        "{channel}": channel.mention,
        "{channel.name}": getattr(channel, "name", "DM"),
        "{channel.id}": str(channel.id),
        "{date}": now.strftime("%d/%m/%Y"),
        "{time}": now.strftime("%H:%M"),
        "{message}": message.content,
    }
    if isinstance(author, discord.Member) and author.joined_at:
        v["{user.joined}"] = author.joined_at.strftime("%d/%m/%Y")
    else:
        v["{user.joined}"] = ""
    return v


def _substitute(text: str, variables: dict[str, str]) -> str:
    """Replace variables in text, including {random:min:max}."""
    if not text:
        return text
    for key, val in variables.items():
        text = text.replace(key, val)
    # Handle {random:min:max}
    import random
    def _rand_repl(m):
        lo, hi = int(m.group(1)), int(m.group(2))
        return str(random.randint(lo, hi))
    text = re.sub(r"\{random:(\d+):(\d+)\}", _rand_repl, text)
    return text


def _match_trigger(content: str, trigger_text: str, trigger_type: str, ignore_case: bool) -> bool:
    """Check if message content matches the trigger."""
    c = content.lower() if ignore_case else content
    t = trigger_text.lower() if ignore_case else trigger_text

    if trigger_type == "exact":
        return c == t
    elif trigger_type == "contains":
        return t in c
    elif trigger_type == "startswith":
        return c.startswith(t)
    elif trigger_type == "endswith":
        return c.endswith(t)
    elif trigger_type == "wildcard":
        return fnmatch.fnmatch(c, t)
    elif trigger_type == "regex":
        try:
            flags = re.IGNORECASE if ignore_case else 0
            return bool(re.search(trigger_text, content, flags))
        except re.error:
            return False
    return False


def _load_rules(guild_id: str) -> list:
    """Load rules from DB with caching."""
    now = _time.time()
    cached = _cache.get(guild_id)
    if cached and (now - cached[0]) < CACHE_TTL:
        return cached[1]

    session = _get_session()
    try:
        rules = session.execute(
            select(AutoResponder).where(
                AutoResponder.guild_id == guild_id,
                AutoResponder.enabled == True,
            ).order_by(AutoResponder.priority.desc())
        ).scalars().all()
        # Detach from session by copying attrs
        result = []
        for r in rules:
            result.append({
                "trigger_type": r.trigger_type,
                "trigger_text": r.trigger_text,
                "ignore_case": r.ignore_case,
                "response_type": r.response_type or "text",
                "response_text": r.response_text,
                "response_embed": r.response_embed,
                "reaction_emojis": r.reaction_emojis or [],
                "reply_to_message": r.reply_to_message,
                "delete_trigger": r.delete_trigger,
                "send_dm": r.send_dm,
                "cooldown": r.cooldown or 0,
                "cooldown_type": r.cooldown_type or "per_user",
                "allowed_channels": r.allowed_channels or [],
                "blocked_channels": r.blocked_channels or [],
                "allowed_roles": r.allowed_roles or [],
                "blocked_roles": r.blocked_roles or [],
                "ignore_bots": r.ignore_bots,
                "name": r.name,
                "id": r.id,
            })
        _cache[guild_id] = (now, result)
        return result
    finally:
        session.close()


class AutoResponderCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        self._cooldowns: dict[str, float] = {}  # key -> last_used timestamp

    def _check_cooldown(self, key: str, cooldown: int) -> int:
        if cooldown <= 0:
            return 0
        now = _time.time()
        last = self._cooldowns.get(key, 0)
        elapsed = now - last
        if elapsed < cooldown:
            return int(cooldown - elapsed)
        self._cooldowns[key] = now
        return 0

    def _cooldown_key(self, rule: dict, message: discord.Message) -> str:
        rule_id = rule["id"]
        ct = rule["cooldown_type"]
        if ct == "per_channel":
            return f"ar:{rule_id}:ch:{message.channel.id}"
        elif ct == "global":
            return f"ar:{rule_id}:global"
        else:  # per_user
            return f"ar:{rule_id}:u:{message.author.id}"

    @discord.Cog.listener()
    async def on_message(self, message: discord.Message):
        if not check_feature(self):
            return
        if not message.guild:
            return
        if not message.content:
            return

        guild_id = str(message.guild.id)
        rules = _load_rules(guild_id)
        if not rules:
            return

        for rule in rules:
            # Ignore bots check
            if rule["ignore_bots"] and message.author.bot:
                continue

            # Channel filters
            ch_id = str(message.channel.id)
            allowed = rule["allowed_channels"]
            blocked = rule["blocked_channels"]
            if allowed and ch_id not in allowed:
                continue
            if blocked and ch_id in blocked:
                continue

            # Role filters
            if isinstance(message.author, discord.Member):
                member_role_ids = {str(r.id) for r in message.author.roles}
                allowed_roles = rule["allowed_roles"]
                blocked_roles = rule["blocked_roles"]
                if allowed_roles and not any(rid in member_role_ids for rid in allowed_roles):
                    continue
                if blocked_roles and any(rid in member_role_ids for rid in blocked_roles):
                    continue

            # Match trigger
            if not _match_trigger(message.content, rule["trigger_text"], rule["trigger_type"], rule["ignore_case"]):
                continue

            # Cooldown
            cd_key = self._cooldown_key(rule, message)
            remaining = self._check_cooldown(cd_key, rule["cooldown"])
            if remaining > 0:
                continue  # silently skip on cooldown

            # --- Matched! Execute response ---
            variables = _build_vars(message)

            try:
                resp_type = rule["response_type"]

                # Delete trigger
                if rule["delete_trigger"]:
                    try:
                        await message.delete()
                    except Exception:
                        pass

                # Add reactions
                if "react" in resp_type:
                    for emoji in rule["reaction_emojis"]:
                        try:
                            await message.add_reaction(emoji)
                        except Exception:
                            pass

                # Build text/embed response
                send_text = None
                send_embed = None

                if "text" in resp_type and rule["response_text"]:
                    send_text = _substitute(rule["response_text"], variables)

                if "embed" in resp_type and rule["response_embed"]:
                    edata = rule["response_embed"]
                    embed = discord.Embed(
                        title=_substitute(edata.get("title", ""), variables),
                        description=_substitute(edata.get("description", ""), variables),
                        color=int(edata["color"].lstrip("#"), 16) if edata.get("color") else 0x5865F2,
                    )
                    if edata.get("footer"):
                        embed.set_footer(text=_substitute(edata["footer"], variables))
                    if edata.get("thumbnail_url"):
                        embed.set_thumbnail(url=_substitute(edata["thumbnail_url"], variables))
                    if edata.get("image_url"):
                        embed.set_image(url=_substitute(edata["image_url"], variables))
                    if edata.get("author_name"):
                        embed.set_author(
                            name=_substitute(edata["author_name"], variables),
                            icon_url=_substitute(edata.get("author_icon_url", ""), variables) or discord.Embed.Empty,
                        )
                    for field in edata.get("fields", []):
                        embed.add_field(
                            name=_substitute(field.get("name", ""), variables),
                            value=_substitute(field.get("value", ""), variables),
                            inline=field.get("inline", False),
                        )
                    send_embed = embed

                # Send response
                if send_text or send_embed:
                    if rule["send_dm"]:
                        try:
                            await message.author.send(content=send_text, embed=send_embed)
                        except Exception:
                            pass
                    elif rule["reply_to_message"]:
                        await message.reply(content=send_text, embed=send_embed, mention_author=False)
                    else:
                        await message.channel.send(content=send_text, embed=send_embed)

            except Exception as e:
                logger.error(f"AutoResponder error (rule={rule['name']}): {e}")

            # Only match first rule (highest priority)
            break
