# src/bot/cogs/custom_commands.py
"""Custom commands — user-defined prefix commands managed from dashboard."""
import discord
import logging
import random
import re
import time as _time
from datetime import datetime, timezone
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import CustomCommand
from src.bot.base_cog import check_feature

logger = logging.getLogger(__name__)

COMMAND_PREFIX = "!"


def _build_vars(message: discord.Message) -> dict[str, str]:
    """Build variable substitution dict from a message context."""
    author = message.author
    guild = message.guild
    channel = message.channel
    now = datetime.now(timezone.utc)

    v: dict[str, str] = {
        # User
        "{user}": str(author),
        "{user.mention}": author.mention,
        "{user.id}": str(author.id),
        "{user.name}": author.display_name,
        "{user.avatar}": str(author.display_avatar.url) if author.display_avatar else "",
        "{user.joined}": "",
        "{user.created}": author.created_at.strftime("%d/%m/%Y") if author.created_at else "",
        # Server
        "{server}": guild.name if guild else "Server",
        "{server.id}": str(guild.id) if guild else "0",
        "{server.icon}": str(guild.icon.url) if guild and guild.icon else "",
        "{server.member_count}": str(guild.member_count) if guild else "0",
        "{server.boost_count}": str(guild.premium_subscription_count or 0) if guild else "0",
        "{server.boost_level}": str(guild.premium_tier) if guild else "0",
        # Channel
        "{channel}": channel.mention,
        "{channel.name}": getattr(channel, "name", "DM"),
        "{channel.id}": str(channel.id),
        # Time
        "{date}": now.strftime("%d/%m/%Y"),
        "{time}": now.strftime("%H:%M"),
    }

    # joined_at for Member
    if isinstance(author, discord.Member) and author.joined_at:
        v["{user.joined}"] = author.joined_at.strftime("%d/%m/%Y")

    return v


def _substitute(text: str, variables: dict[str, str]) -> str:
    """Replace variables in text, including {random:min:max}."""
    if not text:
        return text
    for token, val in variables.items():
        if token in text:
            text = text.replace(token, val)
    # Handle {random:min:max}
    def _rand_repl(m: re.Match) -> str:
        lo, hi = int(m.group(1)), int(m.group(2))
        return str(random.randint(lo, hi))
    text = re.sub(r"\{random:(\d+):(\d+)\}", _rand_repl, text)
    return text


def get_session():
    return SessionLocal()


class CustomCommandsCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        self._cooldowns: dict[str, float] = {}  # "user_id:cmd_name" -> last_used timestamp

    def _check_cooldown(self, user_id: int, cmd_name: str, cooldown: int) -> int:
        """Returns remaining seconds if on cooldown, else 0."""
        if cooldown <= 0:
            return 0
        key = f"{user_id}:{cmd_name}"
        now = _time.time()
        last = self._cooldowns.get(key, 0)
        elapsed = now - last
        if elapsed < cooldown:
            return int(cooldown - elapsed)
        self._cooldowns[key] = now
        return 0

    @discord.Cog.listener()
    async def on_message(self, message: discord.Message):
        if not check_feature(self): return
        if not message.guild or message.author.bot:
            return
        if not message.content.startswith(COMMAND_PREFIX):
            return

        raw_name = message.content[len(COMMAND_PREFIX):].split()[0].lower()
        if not raw_name:
            return

        session = get_session()
        try:
            # Fetch all enabled commands for guild
            cmds = session.execute(
                select(CustomCommand).where(
                    CustomCommand.guild_id == str(message.guild.id),
                    CustomCommand.enabled == True,
                )
            ).scalars().all()

            # Match by name or aliases
            cmd = None
            for c in cmds:
                if c.name == raw_name:
                    cmd = c
                    break
                aliases = c.aliases or []
                if raw_name in aliases:
                    cmd = c
                    break

            if not cmd:
                return

            # Check allowed channels (Allowed Channels overrides Ignored Channels)
            allowed_ch = [str(c) for c in (cmd.allowed_channels or [])]
            ignored_ch = [str(c) for c in (getattr(cmd, "ignored_channels", None) or [])]
            ch_id = str(message.channel.id)
            if allowed_ch and ch_id not in allowed_ch:
                return
            if ignored_ch and ch_id in ignored_ch:
                return

            # Check allowed/ignored roles
            if isinstance(message.author, discord.Member):
                member_role_ids = {str(r.id) for r in message.author.roles}
                allowed_roles = [str(r) for r in (getattr(cmd, "allowed_roles", None) or [])]
                ignored_roles = [str(r) for r in (getattr(cmd, "ignored_roles", None) or [])]
                if allowed_roles and not any(rid in member_role_ids for rid in allowed_roles):
                    return
                if ignored_roles and any(rid in member_role_ids for rid in ignored_roles):
                    return

            # Check required roles (legacy)
            if cmd.required_roles and isinstance(message.author, discord.Member):
                member_role_ids = {str(r.id) for r in message.author.roles}
                if not any(rid in member_role_ids for rid in cmd.required_roles):
                    return

            # Check required args
            required_args = getattr(cmd, "required_args", 0) or 0
            if required_args > 0:
                args = raw_content[len(raw_name):].split()
                if len(args) < required_args:
                    try:
                        notice = await message.channel.send(
                            f"❌ Lệnh `!{cmd.name}` cần ít nhất **{required_args}** argument(s)."
                        )
                        await notice.delete(delay=4)
                    except Exception:
                        pass
                    return

            # Check cooldown
            remaining = self._check_cooldown(message.author.id, cmd.name, cmd.cooldown or 0)
            if remaining > 0:
                try:
                    notice = await message.channel.send(
                        f"⏳ Chờ **{remaining}s** trước khi dùng lại `!{cmd.name}`.",
                    )
                    await notice.delete(delay=3)
                except Exception:
                    pass
                return

            # Delete trigger message
            if cmd.delete_trigger:
                try:
                    await message.delete()
                except Exception:
                    pass

            # Build variables
            variables = _build_vars(message)

            # Determine target channel
            response_channel_id = getattr(cmd, "response_channel_id", None)
            target_channel = message.channel
            if response_channel_id:
                ch = message.guild.get_channel(int(response_channel_id)) if message.guild else None
                if ch:
                    target_channel = ch

            # allowed_mentions based on no_everyone
            no_everyone = getattr(cmd, "no_everyone", False)
            allowed_mentions = discord.AllowedMentions(everyone=False, roles=False) if no_everyone else discord.AllowedMentions.all()

            # Silent mode: skip all responses
            if getattr(cmd, "silent", False):
                return

            # DM mode
            dm_mode = getattr(cmd, "dm_response", False)

            async def _send_response(resp_type: str, resp_text: str | None, resp_embed_data: dict | None):
                """Helper to send one response (text or embed)."""
                if resp_type == "embed" and resp_embed_data:
                    data = resp_embed_data
                    embed = discord.Embed(
                        title=_substitute(data.get("title", ""), variables),
                        description=_substitute(data.get("description", ""), variables),
                        color=int(data.get("color", "#5865F2").lstrip("#"), 16) if data.get("color") else 0x5865F2,
                    )
                    for field in data.get("fields", []):
                        embed.add_field(
                            name=_substitute(field.get("name", ""), variables),
                            value=_substitute(field.get("value", ""), variables),
                            inline=field.get("inline", False),
                        )
                    if data.get("footer"):
                        embed.set_footer(text=_substitute(data["footer"], variables))
                    if data.get("author"):
                        embed.set_author(name=_substitute(data["author"], variables))
                    if data.get("thumbnail_url"):
                        embed.set_thumbnail(url=_substitute(data["thumbnail_url"], variables))
                    if data.get("image_url"):
                        embed.set_image(url=_substitute(data["image_url"], variables))
                    if dm_mode:
                        return await message.author.send(embed=embed)
                    return await target_channel.send(embed=embed, allowed_mentions=allowed_mentions)
                else:
                    text = _substitute(resp_text or "", variables)
                    if text:
                        if dm_mode:
                            return await message.author.send(text)
                        return await target_channel.send(text, allowed_mentions=allowed_mentions)
                return None

            # Send primary response
            sent_message = await _send_response(
                cmd.response_type,
                cmd.response_text,
                cmd.response_embed,
            )

            # Send additional responses
            for extra in (getattr(cmd, "additional_responses", None) or []):
                await _send_response(
                    extra.get("type", "text"),
                    extra.get("content"),
                    extra.get("embed"),
                )

            # Auto react
            if sent_message and cmd.auto_react:
                try:
                    await sent_message.add_reaction(cmd.auto_react)
                except Exception:
                    pass

            # Delete after
            delete_after = getattr(cmd, "delete_after", 0) or 0
            if sent_message and delete_after > 0:
                try:
                    await sent_message.delete(delay=delete_after)
                except Exception:
                    pass

        finally:
            session.close()
