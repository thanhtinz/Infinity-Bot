# src/bot/cogs/logging_cog.py
"""Logging system — message/voice/member/server events → configurable log channels + DB."""
import discord
import datetime
import logging
from collections import defaultdict
from discord.ext import commands
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import LoggingConfig, LogEntry
from src.bot.embed_utils import build_embed
from src.bot.base_cog import check_feature

logger = logging.getLogger(__name__)

# Map event_type → category
EVENT_CATEGORY = {
    "log_message_delete": "message",
    "log_message_edit": "message",
    "log_message_bulk_delete": "message",
    "log_voice_join": "voice",
    "log_voice_leave": "voice",
    "log_voice_move": "voice",
    "log_member_join": "member",
    "log_member_leave": "member",
    "log_nickname_change": "member",
    "log_role_update": "member",
    "log_channel_create": "server",
    "log_channel_delete": "server",
}


def _save_log(
    db,
    guild_id: str,
    event_type: str,
    actor: discord.Member | discord.User | None = None,
    target_id: str | None = None,
    target_name: str | None = None,
    description: str | None = None,
    details: dict | None = None,
):
    """Save a log entry to DB."""
    entry = LogEntry(
        guild_id=guild_id,
        event_type=event_type,
        category=EVENT_CATEGORY.get(event_type, "other"),
        actor_id=str(actor.id) if actor else None,
        actor_name=str(actor) if actor else None,
        actor_avatar=actor.display_avatar.url if actor else None,
        target_id=target_id,
        target_name=target_name,
        description=description,
        details=details,
    )
    db.add(entry)
    db.commit()


class LoggingCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        self.snipe_cache: dict[int, dict] = defaultdict(dict)

    def _get_config(self, guild_id: str) -> LoggingConfig | None:
        db = SessionLocal()
        try:
            return db.execute(
                select(LoggingConfig).where(LoggingConfig.guild_id == guild_id)
            ).scalars().first()
        finally:
            db.close()

    def _is_ignored(self, cfg: LoggingConfig, channel_id: str = None, role_ids: list[str] = None) -> bool:
        if channel_id and channel_id in (cfg.ignored_channels or []):
            return True
        if role_ids:
            for rid in role_ids:
                if rid in (cfg.ignored_roles or []):
                    return True
        return False

    async def _send_log(self, guild: discord.Guild, channel_id: str | None, embed: discord.Embed):
        if not channel_id:
            return
        try:
            ch = guild.get_channel(int(channel_id))
            if not ch:
                ch = await guild.fetch_channel(int(channel_id))
            if ch:
                await ch.send(embed=embed)
        except Exception as e:
            logger.error(f"Log send error: {e}")

    # ── Message Events ────────────────────────────────────────────────────

    @commands.Cog.listener()
    async def on_message_delete(self, message: discord.Message):
        if not check_feature(self): return
        if not message.guild or message.author.bot:
            return
        self.snipe_cache[message.channel.id]["deleted"] = message

        cfg = self._get_config(str(message.guild.id))
        if not cfg:
            return
        if self._is_ignored(cfg, str(message.channel.id)):
            return

        content = (message.content or "*(empty)*")[:1024]
        db = SessionLocal()
        try:
            _save_log(db, str(message.guild.id), "log_message_delete",
                       actor=message.author,
                       target_id=str(message.channel.id),
                       target_name=f"#{message.channel.name}",
                       description=f"Delete messages in #{message.channel.name}",
                       details={"content": content})

            if cfg.message_log_channel_id:
                embed = build_embed("log_message_delete", db, vars={
                    "user": str(message.author), "user.mention": message.author.mention,
                    "user.id": str(message.author.id),
                    "channel": message.channel.mention, "channel.name": message.channel.name,
                    "content": content,
                })
                await self._send_log(message.guild, cfg.message_log_channel_id, embed)
        finally:
            db.close()

    @commands.Cog.listener()
    async def on_message_edit(self, before: discord.Message, after: discord.Message):
        if not check_feature(self): return
        if not before.guild or before.author.bot:
            return
        if before.content == after.content:
            return
        self.snipe_cache[before.channel.id]["edited"] = (before, after)

        cfg = self._get_config(str(before.guild.id))
        if not cfg:
            return
        if self._is_ignored(cfg, str(before.channel.id)):
            return

        before_content = (before.content or "*(empty)*")[:1024]
        after_content = (after.content or "*(empty)*")[:1024]
        db = SessionLocal()
        try:
            _save_log(db, str(before.guild.id), "log_message_edit",
                       actor=before.author,
                       target_id=str(before.channel.id),
                       target_name=f"#{before.channel.name}",
                       description=f"Edit messages in #{before.channel.name}",
                       details={"before": before_content, "after": after_content, "url": after.jump_url})

            if cfg.message_log_channel_id:
                embed = build_embed("log_message_edit", db, vars={
                    "user": str(before.author), "user.mention": before.author.mention,
                    "channel": before.channel.mention,
                    "before": before_content,
                    "after": after_content,
                    "message.url": after.jump_url,
                })
                await self._send_log(before.guild, cfg.message_log_channel_id, embed)
        finally:
            db.close()

    @commands.Cog.listener()
    async def on_bulk_message_delete(self, messages: list[discord.Message]):
        if not check_feature(self): return
        if not messages or not messages[0].guild:
            return
        cfg = self._get_config(str(messages[0].guild.id))
        if not cfg:
            return

        db = SessionLocal()
        try:
            _save_log(db, str(messages[0].guild.id), "log_message_bulk_delete",
                       target_id=str(messages[0].channel.id),
                       target_name=f"#{messages[0].channel.name}",
                       description=f"Bulk deleted {len(messages)} messages in #{messages[0].channel.name}",
                       details={"count": len(messages)})

            if cfg.message_log_channel_id:
                embed = build_embed("log_message_bulk_delete", db, vars={
                    "count": str(len(messages)),
                    "channel": messages[0].channel.mention,
                })
                await self._send_log(messages[0].guild, cfg.message_log_channel_id, embed)
        finally:
            db.close()

    # ── Voice Events ──────────────────────────────────────────────────────

    @commands.Cog.listener()
    async def on_voice_state_update(
        self,
        member: discord.Member,
        before: discord.VoiceState,
        after: discord.VoiceState,
    ):
        if not check_feature(self): return
        if member.bot:
            return
        cfg = self._get_config(str(member.guild.id))
        if not cfg:
            return

        db = SessionLocal()
        try:
            vars_base = {
                "user": str(member), "user.mention": member.mention,
                "user.id": str(member.id),
            }
            event_type = None
            desc = None
            details = {}

            if before.channel is None and after.channel is not None:
                event_type = "log_voice_join"
                desc = f"Join voice {after.channel.name}"
                details = {"channel": after.channel.name}
                embed = build_embed("log_voice_join", db, vars={**vars_base, "channel": after.channel.mention})
            elif before.channel is not None and after.channel is None:
                event_type = "log_voice_leave"
                desc = f"Leave voice {before.channel.name}"
                details = {"channel": before.channel.name}
                embed = build_embed("log_voice_leave", db, vars={**vars_base, "channel": before.channel.mention})
            elif before.channel != after.channel:
                event_type = "log_voice_move"
                desc = f"Moved voice {before.channel.name} → {after.channel.name}"
                details = {"from": before.channel.name, "to": after.channel.name}
                embed = build_embed("log_voice_move", db, vars={
                    **vars_base, "from": before.channel.mention, "to": after.channel.mention,
                })
            else:
                return

            _save_log(db, str(member.guild.id), event_type,
                       actor=member, description=desc, details=details)

            if cfg.voice_log_channel_id:
                await self._send_log(member.guild, cfg.voice_log_channel_id, embed)
        finally:
            db.close()

    # ── Member Events ─────────────────────────────────────────────────────

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        if not check_feature(self): return
        cfg = self._get_config(str(member.guild.id))
        if not cfg:
            return
        db = SessionLocal()
        try:
            _save_log(db, str(member.guild.id), "log_member_join",
                       actor=member,
                       description=f"{member} joined the server",
                       details={"member_count": member.guild.member_count})

            if cfg.member_log_channel_id:
                embed = build_embed("log_member_join", db, vars={
                    "user": str(member), "user.mention": member.mention,
                    "user.id": str(member.id),
                    "account_age": f"<t:{int(member.created_at.timestamp())}:R>",
                    "member_count": str(member.guild.member_count),
                })
                await self._send_log(member.guild, cfg.member_log_channel_id, embed)
        finally:
            db.close()

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member):
        if not check_feature(self): return
        cfg = self._get_config(str(member.guild.id))
        if not cfg:
            return
        db = SessionLocal()
        try:
            roles = ", ".join(r.name for r in member.roles[1:]) or "None"
            _save_log(db, str(member.guild.id), "log_member_leave",
                       actor=member,
                       description=f"{member} left the server",
                       details={"roles": roles, "member_count": member.guild.member_count})

            if cfg.member_log_channel_id:
                roles_mention = ", ".join(r.mention for r in member.roles[1:]) or "None"
                embed = build_embed("log_member_leave", db, vars={
                    "user": str(member), "user.mention": member.mention,
                    "user.id": str(member.id),
                    "roles": roles_mention,
                    "member_count": str(member.guild.member_count),
                })
                await self._send_log(member.guild, cfg.member_log_channel_id, embed)
        finally:
            db.close()

    # ── Member Update (nickname, roles) ───────────────────────────────────

    @commands.Cog.listener()
    async def on_member_update(self, before: discord.Member, after: discord.Member):
        if not check_feature(self): return
        if before.bot:
            return
        cfg = self._get_config(str(before.guild.id))
        if not cfg:
            return

        db = SessionLocal()
        try:
            # Nickname change
            if before.nick != after.nick:
                old_nick = before.nick or before.name
                new_nick = after.nick or after.name
                _save_log(db, str(before.guild.id), "log_nickname_change",
                           actor=after,
                           description=f"Change nick: {old_nick} → {new_nick}",
                           details={"before": old_nick, "after": new_nick})

                if cfg.member_log_channel_id:
                    embed = build_embed("log_nickname_change", db, vars={
                        "user": str(after), "user.mention": after.mention,
                        "before": old_nick, "after": new_nick,
                    })
                    await self._send_log(before.guild, cfg.member_log_channel_id, embed)

            # Role change
            if before.roles != after.roles:
                added = set(after.roles) - set(before.roles)
                removed = set(before.roles) - set(after.roles)
                if added or removed:
                    parts = []
                    if added:
                        parts.append(f"➕ {', '.join(r.name for r in added)}")
                    if removed:
                        parts.append(f"➖ {', '.join(r.name for r in removed)}")
                    _save_log(db, str(before.guild.id), "log_role_update",
                               actor=after,
                               description=f"Role changes: {'; '.join(parts)}",
                               details={"added": [r.name for r in added], "removed": [r.name for r in removed]})

                    if cfg.member_log_channel_id:
                        parts_mention = []
                        if added:
                            parts_mention.append(f"➕ {', '.join(r.mention for r in added)}")
                        if removed:
                            parts_mention.append(f"➖ {', '.join(r.mention for r in removed)}")
                        embed = build_embed("log_role_update", db, vars={
                            "user": str(after), "user.mention": after.mention,
                            "changes": "\n".join(parts_mention),
                        })
                        await self._send_log(before.guild, cfg.member_log_channel_id, embed)
        finally:
            db.close()

    # ── Channel Events ────────────────────────────────────────────────────

    @commands.Cog.listener()
    async def on_guild_channel_create(self, channel: discord.abc.GuildChannel):
        if not check_feature(self): return
        cfg = self._get_config(str(channel.guild.id))
        if not cfg:
            return
        db = SessionLocal()
        try:
            _save_log(db, str(channel.guild.id), "log_channel_create",
                       target_id=str(channel.id),
                       target_name=f"#{channel.name}",
                       description=f"Channel created #{channel.name} ({channel.type})",
                       details={"type": str(channel.type)})

            if cfg.server_log_channel_id:
                embed = build_embed("log_channel_create", db, vars={
                    "channel": channel.mention, "channel.name": channel.name,
                    "type": str(channel.type),
                })
                await self._send_log(channel.guild, cfg.server_log_channel_id, embed)
        finally:
            db.close()

    @commands.Cog.listener()
    async def on_guild_channel_delete(self, channel: discord.abc.GuildChannel):
        if not check_feature(self): return
        cfg = self._get_config(str(channel.guild.id))
        if not cfg:
            return
        db = SessionLocal()
        try:
            _save_log(db, str(channel.guild.id), "log_channel_delete",
                       target_name=f"#{channel.name}",
                       description=f"Channel deleted #{channel.name} ({channel.type})",
                       details={"type": str(channel.type)})

            if cfg.server_log_channel_id:
                embed = build_embed("log_channel_delete", db, vars={
                    "channel.name": channel.name, "type": str(channel.type),
                })
                await self._send_log(channel.guild, cfg.server_log_channel_id, embed)
        finally:
            db.close()

    # ── Snipe Commands ────────────────────────────────────────────────────

    @discord.slash_command(name="snipe", description="[Admin] View the last deleted message in channel")
    @discord.default_permissions(manage_messages=True)
    async def snipe_cmd(self, ctx: discord.ApplicationContext):
        data = self.snipe_cache.get(ctx.channel.id, {})
        msg = data.get("deleted")
        if not msg:
            return await ctx.respond("❌ No recently deleted messages.", ephemeral=True)
        embed = discord.Embed(
            description=msg.content[:2048] if msg.content else "*(empty)*",
            color=0xED4245,
            timestamp=msg.created_at,
        )
        embed.set_author(name=str(msg.author), icon_url=msg.author.display_avatar.url)
        embed.set_footer(text=f"#{msg.channel.name}")
        await ctx.respond(embed=embed)

    @discord.slash_command(name="editsnipe", description="[Admin] View the last edited message in channel")
    @discord.default_permissions(manage_messages=True)
    async def editsnipe_cmd(self, ctx: discord.ApplicationContext):
        data = self.snipe_cache.get(ctx.channel.id, {})
        edited = data.get("edited")
        if not edited:
            return await ctx.respond("❌ No recently edited messages.", ephemeral=True)
        before, after = edited
        embed = discord.Embed(color=0xFEE75C, timestamp=after.created_at)
        embed.set_author(name=str(before.author), icon_url=before.author.display_avatar.url)
        embed.add_field(name="Before", value=(before.content or "*(empty)*")[:1024], inline=False)
        embed.add_field(name="After", value=(after.content or "*(empty)*")[:1024], inline=False)
        embed.set_footer(text=f"#{before.channel.name}")
        await ctx.respond(embed=embed)
