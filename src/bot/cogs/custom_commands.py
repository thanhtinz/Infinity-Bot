# src/bot/cogs/custom_commands.py
"""Custom commands — user-defined triggers + actions managed from dashboard."""
import asyncio
import discord
import logging
import random
import re
import time as _time
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import CustomCommand
from src.bot.base_cog import check_feature

logger = logging.getLogger(__name__)

COMMAND_PREFIX = "!"

# ── Variable builders ─────────────────────────────────────────────────────────

def _server_vars(guild: discord.Guild | None) -> dict[str, str]:
    now = datetime.now(timezone.utc)
    return {
        "{server}": guild.name if guild else "Server",
        "{server.id}": str(guild.id) if guild else "0",
        "{server.icon}": str(guild.icon.url) if guild and guild.icon else "",
        "{server.member_count}": str(guild.member_count) if guild else "0",
        "{server.boost_count}": str(guild.premium_subscription_count or 0) if guild else "0",
        "{server.boost_level}": str(guild.premium_tier) if guild else "0",
        "{date}": now.strftime("%d/%m/%Y"),
        "{time}": now.strftime("%H:%M"),
        "{datetime}": now.strftime("%d/%m/%Y %H:%M"),
    }


def _member_vars(member: discord.Member | discord.User | None, prefix: str = "user") -> dict[str, str]:
    if not member:
        return {}
    v = {
        f"{{{prefix}}}": str(member),
        f"{{{prefix}.mention}}": member.mention,
        f"{{{prefix}.id}}": str(member.id),
        f"{{{prefix}.name}}": member.display_name,
        f"{{{prefix}.avatar}}": str(member.display_avatar.url) if member.display_avatar else "",
        f"{{{prefix}.created}}": member.created_at.strftime("%d/%m/%Y") if member.created_at else "",
        f"{{{prefix}.joined}}": "",
    }
    if isinstance(member, discord.Member) and member.joined_at:
        v[f"{{{prefix}.joined}}"] = member.joined_at.strftime("%d/%m/%Y")
        v[f"{{{prefix}.top_role}}"] = member.top_role.mention if member.top_role else ""
        v[f"{{{prefix}.roles}}"] = " ".join(r.mention for r in member.roles[1:]) or ""
    return v


def _channel_vars(channel, prefix: str = "channel") -> dict[str, str]:
    if not channel:
        return {}
    return {
        f"{{{prefix}}}": channel.mention if hasattr(channel, "mention") else str(channel),
        f"{{{prefix}.name}}": getattr(channel, "name", str(channel)),
        f"{{{prefix}.id}}": str(channel.id),
    }


def _role_vars(role: discord.Role | None) -> dict[str, str]:
    if not role:
        return {}
    return {
        "{role}": role.mention,
        "{role.id}": str(role.id),
        "{role.name}": role.name,
    }


def _build_vars(message: discord.Message) -> dict[str, str]:
    """Build variable dict from a message (prefix/keyword triggers)."""
    v: dict[str, str] = {}
    v.update(_server_vars(message.guild))
    v.update(_member_vars(message.author))
    v.update(_channel_vars(message.channel))
    v["{message.content}"] = message.content
    # Args: split after the command token
    parts = message.content.split()
    args = parts[1:] if len(parts) > 1 else []
    v["{args}"] = " ".join(args)
    for i, a in enumerate(args, 1):
        v[f"${i}"] = a
    if args:
        v["$1+"] = " ".join(args)
    return v


def _substitute(text: str, variables: dict[str, str]) -> str:
    """Replace variables in text, including {random:min:max}."""
    if not text:
        return text
    for token, val in variables.items():
        if token in text:
            text = text.replace(token, val)

    def _rand_repl(m: re.Match) -> str:
        lo, hi = int(m.group(1)), int(m.group(2))
        return str(random.randint(lo, hi))

    text = re.sub(r"\{random:(\d+):(\d+)\}", _rand_repl, text)
    return text


def get_session():
    return SessionLocal()


# ── Trigger matching helpers ──────────────────────────────────────────────────

def _matches_keyword(cmd: CustomCommand, content: str) -> bool:
    cfg = cmd.trigger_config or {}
    keyword = cfg.get("keyword", "")
    if not keyword:
        return False
    match_type = cfg.get("match_type", "contains")
    c = content.lower() if cfg.get("case_insensitive", True) else content
    k = keyword.lower() if cfg.get("case_insensitive", True) else keyword
    if match_type == "exact":
        return c == k
    if match_type == "startswith":
        return c.startswith(k)
    if match_type == "endswith":
        return c.endswith(k)
    if match_type == "regex":
        try:
            return bool(re.search(keyword, content, re.IGNORECASE if cfg.get("case_insensitive", True) else 0))
        except re.error:
            return False
    # default: contains
    return k in c


def _channel_filter_ok(cmd: CustomCommand, channel_id: str) -> bool:
    cfg = cmd.trigger_config or {}
    cf = [str(c) for c in (cfg.get("channel_filter") or [])]
    return (not cf) or (channel_id in cf)


def _role_filter_ok(cmd: CustomCommand, member: discord.Member | None) -> bool:
    if not member:
        return True
    cfg = cmd.trigger_config or {}
    rf = [str(r) for r in (cfg.get("role_filter") or [])]
    if not rf:
        return True
    member_role_ids = {str(r.id) for r in member.roles}
    return any(rid in member_role_ids for rid in rf)


# ── Fetch guild commands (cached per event for performance) ───────────────────

def _fetch_guild_commands(session, guild_id: str, event_trigger: str) -> list[CustomCommand]:
    return session.execute(
        select(CustomCommand).where(
            CustomCommand.guild_id == guild_id,
            CustomCommand.enabled == True,
            CustomCommand.event_trigger == event_trigger,
        )
    ).scalars().all()


# ── Response sending ──────────────────────────────────────────────────────────

async def _send_response(
    resp_type: str,
    resp_text: str | None,
    resp_embed_data: dict | None,
    variables: dict[str, str],
    target_channel,
    target_member: discord.Member | discord.User | None,
    dm_mode: bool,
    no_everyone: bool,
) -> discord.Message | None:
    allowed_mentions = discord.AllowedMentions(everyone=False, roles=False) if no_everyone else discord.AllowedMentions.all()

    if resp_type == "embed" and resp_embed_data:
        data = resp_embed_data
        color_val = data.get("color", 0x5865F2)
        if isinstance(color_val, str):
            color_val = int(color_val.lstrip("#"), 16) if color_val.startswith("#") else int(color_val, 16)
        embed = discord.Embed(
            title=_substitute(data.get("title") or "", variables),
            description=_substitute(data.get("description") or "", variables),
            color=color_val,
        )
        for field in data.get("fields") or []:
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
        if dm_mode and target_member:
            return await target_member.send(embed=embed)
        return await target_channel.send(embed=embed, allowed_mentions=allowed_mentions)
    else:
        text = _substitute(resp_text or "", variables)
        if text:
            if dm_mode and target_member:
                return await target_member.send(text)
            return await target_channel.send(text, allowed_mentions=allowed_mentions)
    return None


# ── System actions executor ───────────────────────────────────────────────────

async def _execute_actions(
    actions: list,
    variables: dict[str, str],
    guild: discord.Guild,
    member: discord.Member | discord.User | None,
    channel,
    message: discord.Message | None,
):
    """Execute system actions sequentially, all guild-scoped."""
    for action in (actions or []):
        action_type = action.get("type", "")
        cfg = action.get("config", {})
        try:
            # ── Role Actions ──────────────────────────────────────────────
            if action_type in ("add_role", "remove_role", "toggle_role") and isinstance(member, discord.Member):
                role_id = cfg.get("role_id", "")
                role = guild.get_role(int(role_id)) if role_id else None
                if not role:
                    continue
                has_role = role in member.roles
                if action_type == "add_role" and not has_role:
                    await member.add_roles(role, reason="Custom command action")
                elif action_type == "remove_role" and has_role:
                    await member.remove_roles(role, reason="Custom command action")
                elif action_type == "toggle_role":
                    if has_role:
                        await member.remove_roles(role, reason="Custom command action")
                    else:
                        await member.add_roles(role, reason="Custom command action")

            elif action_type == "add_roles" and isinstance(member, discord.Member):
                for rid in (cfg.get("role_ids") or []):
                    role = guild.get_role(int(rid))
                    if role and role not in member.roles:
                        await member.add_roles(role, reason="Custom command action")

            elif action_type == "remove_roles" and isinstance(member, discord.Member):
                for rid in (cfg.get("role_ids") or []):
                    role = guild.get_role(int(rid))
                    if role and role in member.roles:
                        await member.remove_roles(role, reason="Custom command action")

            # ── Moderation Actions ────────────────────────────────────────
            elif action_type == "warn" and isinstance(member, discord.Member):
                reason = _substitute(cfg.get("reason", "Custom command warn"), variables)
                try:
                    await member.send(f"⚠️ You have been warned in **{guild.name}**: {reason}")
                except Exception:
                    pass

            elif action_type == "kick" and isinstance(member, discord.Member):
                reason = _substitute(cfg.get("reason", "Custom command kick"), variables)
                await member.kick(reason=reason)

            elif action_type == "ban" and isinstance(member, discord.Member):
                reason = _substitute(cfg.get("reason", "Custom command ban"), variables)
                delete_days = int(cfg.get("delete_days", 0))
                await member.ban(reason=reason, delete_message_days=delete_days)

            elif action_type == "unban":
                user_id_str = _substitute(cfg.get("user_id", variables.get("{user.id}", "")), variables)
                if user_id_str:
                    try:
                        user = await guild._state.get_user(int(user_id_str)) or discord.Object(id=int(user_id_str))
                        await guild.unban(user, reason="Custom command action")
                    except Exception:
                        pass

            elif action_type == "timeout" and isinstance(member, discord.Member):
                seconds = int(cfg.get("duration_seconds", 60))
                reason = _substitute(cfg.get("reason", "Custom command timeout"), variables)
                until = datetime.now(timezone.utc) + timedelta(seconds=seconds)
                await member.timeout(until, reason=reason)

            elif action_type == "remove_timeout" and isinstance(member, discord.Member):
                await member.timeout(None, reason="Custom command action")

            elif action_type == "softban" and isinstance(member, discord.Member):
                reason = _substitute(cfg.get("reason", "Custom command softban"), variables)
                delete_days = int(cfg.get("delete_days", 1))
                await member.ban(reason=reason, delete_message_days=delete_days)
                await guild.unban(member, reason="Softban — immediate unban")

            # ── Member Actions ────────────────────────────────────────────
            elif action_type == "set_nickname" and isinstance(member, discord.Member):
                nick = _substitute(cfg.get("nickname", ""), variables)
                await member.edit(nick=nick[:32] if nick else nick)

            elif action_type == "reset_nickname" and isinstance(member, discord.Member):
                await member.edit(nick=None)

            elif action_type == "send_dm" and member:
                content = _substitute(cfg.get("content", ""), variables)
                if content:
                    await member.send(content)

            # ── Channel Actions ───────────────────────────────────────────
            elif action_type == "send_to_channel":
                ch_id = cfg.get("channel_id", "")
                dest = guild.get_channel(int(ch_id)) if ch_id else channel
                content = _substitute(cfg.get("content", ""), variables)
                if dest and content:
                    await dest.send(content)

            elif action_type == "delete_message" and message:
                try:
                    await message.delete()
                except Exception:
                    pass

            elif action_type == "pin_message" and message:
                try:
                    await message.pin()
                except Exception:
                    pass

            elif action_type == "unpin_message":
                msg_id = cfg.get("message_id", "")
                if msg_id and channel:
                    try:
                        msg = await channel.fetch_message(int(msg_id))
                        await msg.unpin()
                    except Exception:
                        pass

            elif action_type in ("lock_channel", "unlock_channel"):
                ch_id = cfg.get("channel_id", "")
                target_ch = guild.get_channel(int(ch_id)) if ch_id else channel
                if target_ch and isinstance(target_ch, discord.TextChannel):
                    overwrite = target_ch.overwrites_for(guild.default_role)
                    overwrite.send_messages = (False if action_type == "lock_channel" else True)
                    await target_ch.set_permissions(guild.default_role, overwrite=overwrite, reason="Custom command action")

            elif action_type == "slowmode":
                ch_id = cfg.get("channel_id", "")
                target_ch = guild.get_channel(int(ch_id)) if ch_id else channel
                seconds = int(cfg.get("seconds", 0))
                if target_ch and isinstance(target_ch, discord.TextChannel):
                    await target_ch.edit(slowmode_delay=seconds)

            # ── Thread Actions ────────────────────────────────────────────
            elif action_type == "create_thread":
                ch_id = cfg.get("channel_id", "")
                target_ch = guild.get_channel(int(ch_id)) if ch_id else channel
                name = _substitute(cfg.get("name", "Thread"), variables)[:100]
                if target_ch and isinstance(target_ch, discord.TextChannel):
                    await target_ch.create_thread(name=name)

            elif action_type == "lock_thread":
                if channel and isinstance(channel, discord.Thread):
                    await channel.edit(locked=True)

            elif action_type == "archive_thread":
                if channel and isinstance(channel, discord.Thread):
                    await channel.edit(archived=True)

            # ── Reaction Actions ──────────────────────────────────────────
            elif action_type == "add_reaction" and message:
                emoji = cfg.get("emoji", "")
                if emoji:
                    try:
                        await message.add_reaction(emoji)
                    except Exception:
                        pass

            elif action_type == "remove_reaction" and message:
                emoji = cfg.get("emoji", "")
                user_id_str = cfg.get("user_id", "")
                if emoji:
                    try:
                        target_user = (
                            guild.get_member(int(user_id_str)) if user_id_str else member
                        )
                        if target_user:
                            await message.remove_reaction(emoji, target_user)
                    except Exception:
                        pass


            # ── System Actions ────────────────────────────────────────────
            elif action_type == "wait":
                seconds = min(float(cfg.get("seconds", 1)), 10.0)
                await asyncio.sleep(seconds)

            elif action_type == "set_variable":
                name = cfg.get("name", "")
                value = _substitute(cfg.get("value", ""), variables)
                if name:
                    variables[f"{{{name}}}"] = value

        except Exception as e:
            logger.warning(f"[CustomCommands] action '{action_type}' error: {e}")


# ── Core execute logic ────────────────────────────────────────────────────────

async def _execute_command(
    cmd: CustomCommand,
    variables: dict[str, str],
    channel,
    member: discord.Member | discord.User | None,
    message: discord.Message | None,
    guild: discord.Guild,
):
    """Send all responses then run all actions for a matched command."""
    no_everyone = getattr(cmd, "no_everyone", False)
    dm_mode = getattr(cmd, "dm_response", False)
    delete_after = getattr(cmd, "delete_after", 0) or 0
    target_channel = channel

    if getattr(cmd, "response_channel_id", None):
        override = guild.get_channel(int(cmd.response_channel_id))
        if override:
            target_channel = override

    # Delete trigger message
    if getattr(cmd, "delete_trigger", False) and message:
        try:
            await message.delete()
        except Exception:
            pass

    sent_message = None

    if not getattr(cmd, "silent", False):
        sent_message = await _send_response(
            cmd.response_type,
            cmd.response_text,
            cmd.response_embed,
            variables,
            target_channel,
            member,
            dm_mode,
            no_everyone,
        )

        for extra in (getattr(cmd, "additional_responses", None) or []):
            await _send_response(
                extra.get("type", "text"),
                extra.get("content"),
                extra.get("embed"),
                variables,
                target_channel,
                member,
                dm_mode,
                no_everyone,
            )

    # Auto react
    if sent_message and getattr(cmd, "auto_react", None):
        try:
            await sent_message.add_reaction(cmd.auto_react)
        except Exception:
            pass

    # Delete after
    if sent_message and delete_after > 0:
        try:
            await sent_message.delete(delay=delete_after)
        except Exception:
            pass

    # System actions
    await _execute_actions(
        cmd.actions or [],
        variables,
        guild,
        member,
        target_channel,
        message,
    )


# ── Cog ───────────────────────────────────────────────────────────────────────

class CustomCommandsCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        self._cooldowns: dict[str, float] = {}

    def _check_cooldown(self, user_id: int, cmd_name: str, cooldown: int) -> int:
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

    def _perms_ok(self, cmd: CustomCommand, member: discord.Member | None) -> bool:
        """Check allowed/ignored roles and required_roles."""
        if not member:
            return True
        member_role_ids = {str(r.id) for r in member.roles}
        allowed_roles = [str(r) for r in (getattr(cmd, "allowed_roles", None) or [])]
        ignored_roles = [str(r) for r in (getattr(cmd, "ignored_roles", None) or [])]
        if allowed_roles and not any(rid in member_role_ids for rid in allowed_roles):
            return False
        if ignored_roles and any(rid in member_role_ids for rid in ignored_roles):
            return False
        required = [str(r) for r in (cmd.required_roles or [])]
        if required and not any(rid in member_role_ids for rid in required):
            return False
        return True

    async def _run_matching(
        self,
        event_trigger: str,
        guild: discord.Guild,
        variables: dict[str, str],
        channel,
        member: discord.Member | discord.User | None,
        message: discord.Message | None = None,
        extra_filter=None,  # optional callable(cmd) -> bool
    ):
        """Fetch and execute all matching commands for a given event in a guild."""
        session = get_session()
        try:
            cmds = _fetch_guild_commands(session, str(guild.id), event_trigger)
            for cmd in cmds:
                if extra_filter and not extra_filter(cmd):
                    continue
                if not _channel_filter_ok(cmd, str(channel.id) if channel else ""):
                    continue
                if isinstance(member, discord.Member) and not _role_filter_ok(cmd, member):
                    continue
                if not self._perms_ok(cmd, member if isinstance(member, discord.Member) else None):
                    continue
                # Cooldown only applies to member-initiated triggers
                if member and not getattr(member, "bot", False):
                    remaining = self._check_cooldown(member.id, cmd.name, cmd.cooldown or 0)
                    if remaining > 0:
                        continue
                try:
                    await _execute_command(cmd, dict(variables), channel, member, message, guild)
                except Exception as e:
                    logger.warning(f"[CustomCommands] execute error for '{cmd.name}': {e}")
        finally:
            session.close()

    # ── MESSAGE (prefix_command + keyword) ───────────────────────────────────

    @discord.Cog.listener()
    async def on_message(self, message: discord.Message):
        if not check_feature(self):
            return
        if not message.guild or message.author.bot:
            return

        variables = _build_vars(message)
        guild = message.guild

        # ── prefix_command ────────────────────────────────────────────────
        if message.content.startswith(COMMAND_PREFIX):
            raw_name = message.content[len(COMMAND_PREFIX):].split()[0].lower()
            if raw_name:
                session = get_session()
                try:
                    cmds = _fetch_guild_commands(session, str(guild.id), "prefix_command")
                    cmd = None
                    for c in cmds:
                        if c.name == raw_name or raw_name in (c.aliases or []):
                            cmd = c
                            break
                    if cmd:
                        allowed_ch = [str(c) for c in (cmd.allowed_channels or [])]
                        ignored_ch = [str(c) for c in (getattr(cmd, "ignored_channels", None) or [])]
                        ch_id = str(message.channel.id)
                        if allowed_ch and ch_id not in allowed_ch:
                            pass
                        elif ignored_ch and ch_id in ignored_ch:
                            pass
                        elif not self._perms_ok(cmd, message.author if isinstance(message.author, discord.Member) else None):
                            pass
                        else:
                            required_args = getattr(cmd, "required_args", 0) or 0
                            parts = message.content.split()
                            args = parts[1:]
                            if required_args > 0 and len(args) < required_args:
                                try:
                                    n = await message.channel.send(
                                        f"❌ Command `!{cmd.name}` requires at least **{required_args}** argument(s)."
                                    )
                                    await n.delete(delay=4)
                                except Exception:
                                    pass
                            else:
                                remaining = self._check_cooldown(message.author.id, cmd.name, cmd.cooldown or 0)
                                if remaining > 0:
                                    try:
                                        n = await message.channel.send(f"⏳ Wait **{remaining}s** before using `!{cmd.name}` again.")
                                        await n.delete(delay=3)
                                    except Exception:
                                        pass
                                else:
                                    await _execute_command(cmd, variables, message.channel, message.author, message, guild)
                finally:
                    session.close()

        # ── keyword ───────────────────────────────────────────────────────
        session = get_session()
        try:
            kwcmds = _fetch_guild_commands(session, str(guild.id), "keyword")
            for cmd in kwcmds:
                if not _matches_keyword(cmd, message.content):
                    continue
                if not _channel_filter_ok(cmd, str(message.channel.id)):
                    continue
                if not self._perms_ok(cmd, message.author if isinstance(message.author, discord.Member) else None):
                    continue
                remaining = self._check_cooldown(message.author.id, cmd.name, cmd.cooldown or 0)
                if remaining > 0:
                    continue
                try:
                    await _execute_command(cmd, dict(variables), message.channel, message.author, message, guild)
                except Exception as e:
                    logger.warning(f"[CustomCommands] keyword error: {e}")
        finally:
            session.close()

    # ── MEMBER events ─────────────────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        if not check_feature(self):
            return
        v = {**_server_vars(member.guild), **_member_vars(member)}
        await self._run_matching("member_join", member.guild, v, member.guild.system_channel, member)

    @discord.Cog.listener()
    async def on_member_remove(self, member: discord.Member):
        if not check_feature(self):
            return
        v = {**_server_vars(member.guild), **_member_vars(member)}
        await self._run_matching("member_leave", member.guild, v, member.guild.system_channel, member)

    @discord.Cog.listener()
    async def on_member_ban(self, guild: discord.Guild, user: discord.User):
        if not check_feature(self):
            return
        v = {**_server_vars(guild), **_member_vars(user)}
        await self._run_matching("member_ban", guild, v, guild.system_channel, user)

    @discord.Cog.listener()
    async def on_member_unban(self, guild: discord.Guild, user: discord.User):
        if not check_feature(self):
            return
        v = {**_server_vars(guild), **_member_vars(user)}
        await self._run_matching("member_unban", guild, v, guild.system_channel, user)

    @discord.Cog.listener()
    async def on_member_update(self, before: discord.Member, after: discord.Member):
        if not check_feature(self):
            return
        guild = after.guild
        v = {**_server_vars(guild), **_member_vars(after)}

        # roles added/removed
        added = set(after.roles) - set(before.roles)
        removed = set(before.roles) - set(after.roles)
        for role in added:
            rv = {**v, **_role_vars(role)}
            await self._run_matching("member_role_add", guild, rv, guild.system_channel, after)
        for role in removed:
            rv = {**v, **_role_vars(role)}
            await self._run_matching("member_role_remove", guild, rv, guild.system_channel, after)

        # nickname change
        if before.nick != after.nick:
            nv = {**v, "{old_nickname}": before.nick or "", "{new_nickname}": after.nick or ""}
            await self._run_matching("member_nick_change", guild, nv, guild.system_channel, after)

        # screening pass (pending=True → False)
        if getattr(before, "pending", False) and not getattr(after, "pending", False):
            await self._run_matching("member_screening_pass", guild, v, guild.system_channel, after)

        # boost
        if before.premium_since is None and after.premium_since is not None:
            await self._run_matching("member_boost", guild, v, guild.system_channel, after)
        elif before.premium_since is not None and after.premium_since is None:
            await self._run_matching("member_unboost", guild, v, guild.system_channel, after)

        # generic member_update
        await self._run_matching("member_update", guild, v, guild.system_channel, after)

    @discord.Cog.listener()
    async def on_presence_update(self, before: discord.Member, after: discord.Member):
        if not check_feature(self):
            return
        if before.status == after.status:
            return
        guild = after.guild
        v = {**_server_vars(guild), **_member_vars(after), "{status}": str(after.status)}
        cfg_filter = lambda cmd: (cmd.trigger_config or {}).get("status", "") in ("", str(after.status))
        await self._run_matching("member_status_change", guild, v, guild.system_channel, after, extra_filter=cfg_filter)

    # ── GUILD events ──────────────────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_guild_update(self, before: discord.Guild, after: discord.Guild):
        if not check_feature(self):
            return
        v = _server_vars(after)

        if before.premium_tier < after.premium_tier:
            await self._run_matching("boost_level_up", after, {**v, "{old_tier}": str(before.premium_tier), "{new_tier}": str(after.premium_tier)}, after.system_channel, None)
        elif before.premium_tier > after.premium_tier:
            await self._run_matching("boost_level_down", after, {**v, "{old_tier}": str(before.premium_tier), "{new_tier}": str(after.premium_tier)}, after.system_channel, None)

        if before.features != after.features:
            await self._run_matching("guild_features_update", after, v, after.system_channel, None)
        if before.owner_id != after.owner_id:
            await self._run_matching("guild_owner_change", after, {**v, "{old_owner.id}": str(before.owner_id), "{new_owner.id}": str(after.owner_id)}, after.system_channel, None)
        if "PARTNERED" not in before.features and "PARTNERED" in after.features:
            await self._run_matching("guild_partnered", after, v, after.system_channel, None)
        elif "PARTNERED" in before.features and "PARTNERED" not in after.features:
            await self._run_matching("guild_unpartnered", after, v, after.system_channel, None)
        if before.name != after.name:
            await self._run_matching("guild_name_change", after, {**v, "{old_name}": before.name, "{new_name}": after.name}, after.system_channel, None)
        if before.afk_channel != after.afk_channel:
            trigger = "guild_afk_set" if after.afk_channel else "guild_afk_remove"
            await self._run_matching(trigger, after, v, after.system_channel, None)
        if (before.banner is None) != (after.banner is None):
            trigger = "guild_banner_add" if after.banner else "guild_banner_remove"
            await self._run_matching(trigger, after, v, after.system_channel, None)

        await self._run_matching("guild_update", after, v, after.system_channel, None)

    @discord.Cog.listener()
    async def on_guild_join(self, guild: discord.Guild):
        if not check_feature(self):
            return
        v = _server_vars(guild)
        await self._run_matching("bot_join_guild", guild, v, guild.system_channel, None)

    @discord.Cog.listener()
    async def on_guild_remove(self, guild: discord.Guild):
        # Not checking feature since guild may be unavailable
        pass

    @discord.Cog.listener()
    async def on_ready(self):
        pass  # bot_ready trigger not practical for custom commands

    # ── CHANNEL events ────────────────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_guild_channel_create(self, channel):
        if not check_feature(self):
            return
        guild = channel.guild
        v = {**_server_vars(guild), **_channel_vars(channel)}
        await self._run_matching("channel_create", guild, v, channel, None)

    @discord.Cog.listener()
    async def on_guild_channel_delete(self, channel):
        if not check_feature(self):
            return
        guild = channel.guild
        v = {**_server_vars(guild), **_channel_vars(channel)}
        await self._run_matching("channel_delete", guild, v, guild.system_channel, None)

    @discord.Cog.listener()
    async def on_guild_channel_update(self, before, after):
        if not check_feature(self):
            return
        guild = after.guild
        v = {**_server_vars(guild), **_channel_vars(after)}
        await self._run_matching("channel_update", guild, v, after, None)
        if getattr(before, "overwrites", None) != getattr(after, "overwrites", None):
            await self._run_matching("channel_perms_update", guild, v, after, None)
        if getattr(before, "topic", None) != getattr(after, "topic", None):
            await self._run_matching("channel_topic_update", guild, {**v, "{old_topic}": before.topic or "", "{new_topic}": after.topic or ""}, after, None)

    @discord.Cog.listener()
    async def on_guild_channel_pins_update(self, channel, last_pin):
        if not check_feature(self):
            return
        guild = channel.guild
        v = {**_server_vars(guild), **_channel_vars(channel)}
        await self._run_matching("channel_pins_update", guild, v, channel, None)
        await self._run_matching("message_pin", guild, v, channel, None)

    # ── INVITE events ─────────────────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_invite_create(self, invite: discord.Invite):
        if not check_feature(self):
            return
        guild = invite.guild
        if not guild:
            return
        v = {**_server_vars(guild), "{invite.code}": invite.code, "{invite.url}": invite.url or "", "{invite.uses}": "0", "{invite.max_uses}": str(invite.max_uses or 0)}
        if invite.inviter:
            v.update(_member_vars(invite.inviter))
        await self._run_matching("invite_create", guild, v, guild.system_channel, invite.inviter)

    @discord.Cog.listener()
    async def on_invite_delete(self, invite: discord.Invite):
        if not check_feature(self):
            return
        guild = invite.guild
        if not guild:
            return
        v = {**_server_vars(guild), "{invite.code}": invite.code}
        await self._run_matching("invite_delete", guild, v, guild.system_channel, None)

    # ── MESSAGE events ────────────────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_raw_message_delete(self, payload: discord.RawMessageDeleteEvent):
        if not check_feature(self):
            return
        guild = self.bot.get_guild(payload.guild_id) if payload.guild_id else None
        if not guild:
            return
        channel = guild.get_channel(payload.channel_id)
        msg = payload.cached_message
        v = {
            **_server_vars(guild),
            "{message.content}": msg.content if msg else "",
            "{message.author}": str(msg.author) if msg else "",
            "{message.author.mention}": msg.author.mention if msg else "",
            "{message.author.id}": str(msg.author.id) if msg else "",
            **_channel_vars(channel),
        }
        await self._run_matching("message_delete", guild, v, channel, msg.author if msg else None)

    @discord.Cog.listener()
    async def on_raw_message_edit(self, payload: discord.RawMessageUpdateEvent):
        if not check_feature(self):
            return
        guild = self.bot.get_guild(payload.guild_id) if payload.guild_id else None
        if not guild:
            return
        channel = guild.get_channel(payload.channel_id)
        msg = payload.cached_message
        v = {
            **_server_vars(guild),
            "{message.content}": msg.content if msg else "",
            "{message.author}": str(msg.author) if msg else "",
            "{message.author.mention}": msg.author.mention if msg else "",
            "{message.author.id}": str(msg.author.id) if msg else "",
            **_channel_vars(channel),
        }
        await self._run_matching("message_edit", guild, v, channel, msg.author if msg else None)

    @discord.Cog.listener()
    async def on_typing(self, channel, user, when):
        if not check_feature(self):
            return
        guild = getattr(channel, "guild", None)
        if not guild:
            return
        v = {**_server_vars(guild), **_member_vars(user), **_channel_vars(channel)}
        await self._run_matching("typing_start", guild, v, channel, user)

    # ── REACTION events ───────────────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_raw_reaction_add(self, payload: discord.RawReactionActionEvent):
        if not check_feature(self):
            return
        guild = self.bot.get_guild(payload.guild_id) if payload.guild_id else None
        if not guild:
            return
        member = guild.get_member(payload.user_id)
        if member and member.bot:
            return
        channel = guild.get_channel(payload.channel_id)
        emoji_str = str(payload.emoji)
        v = {
            **_server_vars(guild),
            **_member_vars(member),
            **_channel_vars(channel),
            "{emoji}": emoji_str,
            "{message.id}": str(payload.message_id),
        }
        def _emoji_filter(cmd):
            cfg_emoji = (cmd.trigger_config or {}).get("emoji", "")
            return not cfg_emoji or cfg_emoji == emoji_str
        await self._run_matching("reaction_add", guild, v, channel, member, extra_filter=_emoji_filter)

    @discord.Cog.listener()
    async def on_raw_reaction_remove(self, payload: discord.RawReactionActionEvent):
        if not check_feature(self):
            return
        guild = self.bot.get_guild(payload.guild_id) if payload.guild_id else None
        if not guild:
            return
        member = guild.get_member(payload.user_id)
        channel = guild.get_channel(payload.channel_id)
        emoji_str = str(payload.emoji)
        v = {
            **_server_vars(guild),
            **_member_vars(member),
            **_channel_vars(channel),
            "{emoji}": emoji_str,
            "{message.id}": str(payload.message_id),
        }
        def _emoji_filter(cmd):
            cfg_emoji = (cmd.trigger_config or {}).get("emoji", "")
            return not cfg_emoji or cfg_emoji == emoji_str
        await self._run_matching("reaction_remove", guild, v, channel, member, extra_filter=_emoji_filter)

    @discord.Cog.listener()
    async def on_raw_reaction_clear(self, payload: discord.RawReactionClearEvent):
        if not check_feature(self):
            return
        guild = self.bot.get_guild(payload.guild_id) if payload.guild_id else None
        if not guild:
            return
        channel = guild.get_channel(payload.channel_id)
        v = {**_server_vars(guild), **_channel_vars(channel), "{message.id}": str(payload.message_id)}
        await self._run_matching("reaction_clear", guild, v, channel, None)

    @discord.Cog.listener()
    async def on_raw_reaction_clear_emoji(self, payload: discord.RawReactionClearEmojiEvent):
        if not check_feature(self):
            return
        guild = self.bot.get_guild(payload.guild_id) if payload.guild_id else None
        if not guild:
            return
        channel = guild.get_channel(payload.channel_id)
        v = {**_server_vars(guild), **_channel_vars(channel), "{emoji}": str(payload.emoji), "{message.id}": str(payload.message_id)}
        await self._run_matching("reaction_clear_emoji", guild, v, channel, None)

    # ── ROLE events ───────────────────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_guild_role_create(self, role: discord.Role):
        if not check_feature(self):
            return
        v = {**_server_vars(role.guild), **_role_vars(role)}
        await self._run_matching("role_create", role.guild, v, role.guild.system_channel, None)

    @discord.Cog.listener()
    async def on_guild_role_delete(self, role: discord.Role):
        if not check_feature(self):
            return
        v = {**_server_vars(role.guild), **_role_vars(role)}
        await self._run_matching("role_delete", role.guild, v, role.guild.system_channel, None)

    @discord.Cog.listener()
    async def on_guild_role_update(self, before: discord.Role, after: discord.Role):
        if not check_feature(self):
            return
        v = {**_server_vars(after.guild), **_role_vars(after), "{old_name}": before.name}
        await self._run_matching("role_update", after.guild, v, after.guild.system_channel, None)

    # ── VOICE events ──────────────────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_voice_state_update(self, member: discord.Member, before: discord.VoiceState, after: discord.VoiceState):
        if not check_feature(self):
            return
        guild = member.guild
        v = {**_server_vars(guild), **_member_vars(member)}
        old_ch = before.channel
        new_ch = after.channel

        if old_ch is None and new_ch is not None:
            cv = {**v, **_channel_vars(new_ch)}
            await self._run_matching("voice_join", guild, cv, new_ch, member)
        elif old_ch is not None and new_ch is None:
            cv = {**v, **_channel_vars(old_ch), "{old_channel}": old_ch.mention, "{old_channel.name}": old_ch.name}
            await self._run_matching("voice_leave", guild, cv, old_ch, member)
        elif old_ch and new_ch and old_ch != new_ch:
            cv = {**v, **_channel_vars(new_ch), "{old_channel}": old_ch.mention, "{old_channel.name}": old_ch.name}
            await self._run_matching("voice_switch", guild, cv, new_ch, member)

        # stream / camera / deaf / mute transitions
        if not before.self_stream and after.self_stream:
            await self._run_matching("voice_stream_start", guild, {**v, **_channel_vars(after.channel)}, after.channel, member)
        elif before.self_stream and not after.self_stream:
            await self._run_matching("voice_stream_stop", guild, {**v, **_channel_vars(after.channel)}, after.channel, member)

        if not before.self_video and after.self_video:
            await self._run_matching("voice_camera_on", guild, {**v, **_channel_vars(after.channel)}, after.channel, member)
        elif before.self_video and not after.self_video:
            await self._run_matching("voice_camera_off", guild, {**v, **_channel_vars(after.channel)}, after.channel, member)

        if not before.self_mute and after.self_mute:
            await self._run_matching("voice_self_mute", guild, {**v, **_channel_vars(after.channel)}, after.channel, member)
        if not before.self_deaf and after.self_deaf:
            await self._run_matching("voice_self_deafen", guild, {**v, **_channel_vars(after.channel)}, after.channel, member)
        if not before.mute and after.mute:
            await self._run_matching("voice_server_mute", guild, {**v, **_channel_vars(after.channel)}, after.channel, member)
        if not before.deaf and after.deaf:
            await self._run_matching("voice_server_deafen", guild, {**v, **_channel_vars(after.channel)}, after.channel, member)

    # ── THREAD events ─────────────────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_thread_create(self, thread: discord.Thread):
        if not check_feature(self):
            return
        guild = thread.guild
        v = {**_server_vars(guild), "{thread.name}": thread.name, "{thread.id}": str(thread.id), "{thread.parent}": thread.parent.mention if thread.parent else ""}
        await self._run_matching("thread_create", guild, v, thread, None)

    @discord.Cog.listener()
    async def on_thread_delete(self, thread: discord.Thread):
        if not check_feature(self):
            return
        guild = thread.guild
        v = {**_server_vars(guild), "{thread.name}": thread.name, "{thread.id}": str(thread.id)}
        await self._run_matching("thread_delete", guild, v, guild.system_channel, None)

    @discord.Cog.listener()
    async def on_thread_update(self, before: discord.Thread, after: discord.Thread):
        if not check_feature(self):
            return
        guild = after.guild
        v = {**_server_vars(guild), "{thread.name}": after.name, "{thread.id}": str(after.id)}
        await self._run_matching("thread_update", guild, v, after, None)

    @discord.Cog.listener()
    async def on_thread_members_update(self, thread: discord.Thread, added, removed):
        if not check_feature(self):
            return
        guild = thread.guild
        v = {**_server_vars(guild), "{thread.name}": thread.name, "{thread.id}": str(thread.id)}
        await self._run_matching("thread_members_update", guild, v, thread, None)

    # ── SCHEDULED EVENT events ────────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_scheduled_event_create(self, event: discord.ScheduledEvent):
        if not check_feature(self):
            return
        guild = event.guild
        v = {**_server_vars(guild), "{event.name}": event.name, "{event.id}": str(event.id), "{event.description}": event.description or "", "{event.channel}": event.channel.mention if event.channel else ""}
        await self._run_matching("scheduled_event_create", guild, v, guild.system_channel, None)

    @discord.Cog.listener()
    async def on_scheduled_event_delete(self, event: discord.ScheduledEvent):
        if not check_feature(self):
            return
        guild = event.guild
        v = {**_server_vars(guild), "{event.name}": event.name, "{event.id}": str(event.id)}
        await self._run_matching("scheduled_event_delete", guild, v, guild.system_channel, None)

    @discord.Cog.listener()
    async def on_scheduled_event_update(self, before: discord.ScheduledEvent, after: discord.ScheduledEvent):
        if not check_feature(self):
            return
        guild = after.guild
        v = {**_server_vars(guild), "{event.name}": after.name, "{event.id}": str(after.id)}
        await self._run_matching("scheduled_event_update", guild, v, guild.system_channel, None)

    @discord.Cog.listener()
    async def on_scheduled_event_user_add(self, event: discord.ScheduledEvent, user: discord.User):
        if not check_feature(self):
            return
        guild = event.guild
        member = guild.get_member(user.id) if guild else None
        v = {**_server_vars(guild), "{event.name}": event.name, "{event.id}": str(event.id), **_member_vars(member or user)}
        await self._run_matching("scheduled_event_user_add", guild, v, guild.system_channel, member or user)

    @discord.Cog.listener()
    async def on_scheduled_event_user_remove(self, event: discord.ScheduledEvent, user: discord.User):
        if not check_feature(self):
            return
        guild = event.guild
        member = guild.get_member(user.id) if guild else None
        v = {**_server_vars(guild), "{event.name}": event.name, "{event.id}": str(event.id), **_member_vars(member or user)}
        await self._run_matching("scheduled_event_user_remove", guild, v, guild.system_channel, member or user)

    # ── STAGE events ──────────────────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_stage_instance_create(self, stage: discord.StageInstance):
        if not check_feature(self):
            return
        guild = stage.guild
        ch = guild.get_channel(stage.channel_id) if guild else None
        v = {**_server_vars(guild), "{stage.topic}": stage.topic, "{stage.id}": str(stage.id), **_channel_vars(ch)}
        await self._run_matching("stage_create", guild, v, ch, None)

    @discord.Cog.listener()
    async def on_stage_instance_delete(self, stage: discord.StageInstance):
        if not check_feature(self):
            return
        guild = stage.guild
        v = {**_server_vars(guild), "{stage.topic}": stage.topic, "{stage.id}": str(stage.id)}
        await self._run_matching("stage_delete", guild, v, guild.system_channel if guild else None, None)

    @discord.Cog.listener()
    async def on_stage_instance_update(self, before: discord.StageInstance, after: discord.StageInstance):
        if not check_feature(self):
            return
        guild = after.guild
        v = {**_server_vars(guild), "{stage.topic}": after.topic, "{stage.id}": str(after.id)}
        await self._run_matching("stage_update", guild, v, guild.system_channel if guild else None, None)

    # ── AUTOMOD events ────────────────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_automod_action(self, execution: discord.AutoModActionExecution):
        if not check_feature(self):
            return
        guild = self.bot.get_guild(execution.guild_id)
        if not guild:
            return
        member = guild.get_member(execution.user_id)
        channel = guild.get_channel(execution.channel_id) if execution.channel_id else guild.system_channel
        v = {**_server_vars(guild), **_member_vars(member), **_channel_vars(channel), "{automod.content}": execution.content or "", "{automod.rule_id}": str(execution.rule_id)}
        await self._run_matching("automod_action", guild, v, channel, member)

    @discord.Cog.listener()
    async def on_automod_rule_create(self, rule: discord.AutoModRule):
        if not check_feature(self):
            return
        guild = rule.guild
        v = {**_server_vars(guild), "{rule.name}": rule.name, "{rule.id}": str(rule.id)}
        await self._run_matching("automod_rule_create", guild, v, guild.system_channel, None)

    @discord.Cog.listener()
    async def on_automod_rule_delete(self, rule: discord.AutoModRule):
        if not check_feature(self):
            return
        guild = rule.guild
        v = {**_server_vars(guild), "{rule.name}": rule.name, "{rule.id}": str(rule.id)}
        await self._run_matching("automod_rule_delete", guild, v, guild.system_channel, None)

    @discord.Cog.listener()
    async def on_automod_rule_update(self, rule: discord.AutoModRule):
        if not check_feature(self):
            return
        guild = rule.guild
        v = {**_server_vars(guild), "{rule.name}": rule.name, "{rule.id}": str(rule.id)}
        await self._run_matching("automod_rule_update", guild, v, guild.system_channel, None)

    # ── STICKER events ────────────────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_guild_stickers_update(self, guild: discord.Guild, before, after):
        if not check_feature(self):
            return
        v = _server_vars(guild)
        before_ids = {s.id for s in before}
        after_ids = {s.id for s in after}
        if after_ids - before_ids:
            await self._run_matching("sticker_create", guild, v, guild.system_channel, None)
        if before_ids - after_ids:
            await self._run_matching("sticker_delete", guild, v, guild.system_channel, None)
        if before_ids & after_ids:
            await self._run_matching("sticker_update", guild, v, guild.system_channel, None)

    # ── INTEGRATION / AUDIT events ────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_guild_integrations_update(self, guild: discord.Guild):
        if not check_feature(self):
            return
        v = _server_vars(guild)
        await self._run_matching("guild_integrations_update", guild, v, guild.system_channel, None)

    @discord.Cog.listener()
    async def on_audit_log_entry_create(self, entry: discord.AuditLogEntry):
        if not check_feature(self):
            return
        guild = entry.guild
        v = {**_server_vars(guild), "{action}": str(entry.action), "{target}": str(entry.target) if entry.target else "", "{moderator}": str(entry.user) if entry.user else "", "{reason}": entry.reason or ""}
        def _action_filter(cmd):
            cfg_action = (cmd.trigger_config or {}).get("action_type", "")
            return not cfg_action or cfg_action == str(entry.action)
        if entry.user and not entry.user.bot:
            await self._run_matching("audit_log_entry", guild, v, guild.system_channel, entry.user, extra_filter=_action_filter)

    # ── POLL events ───────────────────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_poll_vote_add(self, member, answer):
        if not check_feature(self):
            return
        guild = getattr(member, "guild", None)
        if not guild:
            return
        poll = getattr(answer, "poll", None)
        v = {**_server_vars(guild), **_member_vars(member), "{poll.question}": str(getattr(poll, "question", "")), "{answer.text}": str(getattr(answer, "text", ""))}
        await self._run_matching("poll_vote_add", guild, v, guild.system_channel, member)

    @discord.Cog.listener()
    async def on_poll_vote_remove(self, member, answer):
        if not check_feature(self):
            return
        guild = getattr(member, "guild", None)
        if not guild:
            return
        poll = getattr(answer, "poll", None)
        v = {**_server_vars(guild), **_member_vars(member), "{poll.question}": str(getattr(poll, "question", "")), "{answer.text}": str(getattr(answer, "text", ""))}
        await self._run_matching("poll_vote_remove", guild, v, guild.system_channel, member)

    # ── APP CMD PERMS ─────────────────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_application_command_permissions_update(self, permissions):
        if not check_feature(self):
            return
        guild = self.bot.get_guild(permissions.guild_id) if hasattr(permissions, "guild_id") else None
        if not guild:
            return
        v = _server_vars(guild)
        await self._run_matching("app_cmd_perms_update", guild, v, guild.system_channel, None)


def setup(bot: discord.Bot):
    bot.add_cog(CustomCommandsCog(bot))
