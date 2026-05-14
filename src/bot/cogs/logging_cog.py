# src/bot/cogs/logging_cog.py
"""Logging system — message/voice/member/server events → configurable log channels."""
import discord
import datetime
import logging
from collections import defaultdict
from discord.ext import commands
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import LoggingConfig
from src.bot.embed_utils import build_embed

logger = logging.getLogger(__name__)


class LoggingCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        # In-memory snipe cache: {channel_id: {deleted: msg, edited: (before, after)}}
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
        if not message.guild or message.author.bot:
            return
        # Snipe cache
        self.snipe_cache[message.channel.id]["deleted"] = message

        cfg = self._get_config(str(message.guild.id))
        if not cfg or not cfg.message_log_channel_id:
            return
        if self._is_ignored(cfg, str(message.channel.id)):
            return

        db = SessionLocal()
        try:
            embed = build_embed("log_message_delete", db, vars={
                "user": str(message.author), "user.mention": message.author.mention,
                "user.id": str(message.author.id),
                "channel": message.channel.mention, "channel.name": message.channel.name,
                "content": (message.content or "*(trống)*")[:1024],
            })
            await self._send_log(message.guild, cfg.message_log_channel_id, embed)
        finally:
            db.close()

    @commands.Cog.listener()
    async def on_message_edit(self, before: discord.Message, after: discord.Message):
        if not before.guild or before.author.bot:
            return
        if before.content == after.content:
            return
        # Snipe cache
        self.snipe_cache[before.channel.id]["edited"] = (before, after)

        cfg = self._get_config(str(before.guild.id))
        if not cfg or not cfg.message_log_channel_id:
            return
        if self._is_ignored(cfg, str(before.channel.id)):
            return

        db = SessionLocal()
        try:
            embed = build_embed("log_message_edit", db, vars={
                "user": str(before.author), "user.mention": before.author.mention,
                "channel": before.channel.mention,
                "before": (before.content or "*(trống)*")[:1024],
                "after": (after.content or "*(trống)*")[:1024],
                "message.url": after.jump_url,
            })
            await self._send_log(before.guild, cfg.message_log_channel_id, embed)
        finally:
            db.close()

    @commands.Cog.listener()
    async def on_bulk_message_delete(self, messages: list[discord.Message]):
        if not messages or not messages[0].guild:
            return
        cfg = self._get_config(str(messages[0].guild.id))
        if not cfg or not cfg.message_log_channel_id:
            return

        db = SessionLocal()
        try:
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
        if member.bot:
            return
        cfg = self._get_config(str(member.guild.id))
        if not cfg or not cfg.voice_log_channel_id:
            return

        db = SessionLocal()
        try:
            vars_base = {
                "user": str(member), "user.mention": member.mention,
                "user.id": str(member.id),
            }
            if before.channel is None and after.channel is not None:
                embed = build_embed("log_voice_join", db, vars={
                    **vars_base, "channel": after.channel.mention,
                })
            elif before.channel is not None and after.channel is None:
                embed = build_embed("log_voice_leave", db, vars={
                    **vars_base, "channel": before.channel.mention,
                })
            elif before.channel != after.channel:
                embed = build_embed("log_voice_move", db, vars={
                    **vars_base,
                    "from": before.channel.mention,
                    "to": after.channel.mention,
                })
            else:
                return
            await self._send_log(member.guild, cfg.voice_log_channel_id, embed)
        finally:
            db.close()

    # ── Member Events ─────────────────────────────────────────────────────

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        cfg = self._get_config(str(member.guild.id))
        if not cfg or not cfg.member_log_channel_id:
            return
        db = SessionLocal()
        try:
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
        cfg = self._get_config(str(member.guild.id))
        if not cfg or not cfg.member_log_channel_id:
            return
        db = SessionLocal()
        try:
            roles = ", ".join(r.mention for r in member.roles[1:]) or "Không có"
            embed = build_embed("log_member_leave", db, vars={
                "user": str(member), "user.mention": member.mention,
                "user.id": str(member.id),
                "roles": roles,
                "member_count": str(member.guild.member_count),
            })
            await self._send_log(member.guild, cfg.member_log_channel_id, embed)
        finally:
            db.close()

    # ── Member Update (nickname, roles) ───────────────────────────────────

    @commands.Cog.listener()
    async def on_member_update(self, before: discord.Member, after: discord.Member):
        if before.bot:
            return
        cfg = self._get_config(str(before.guild.id))
        if not cfg:
            return

        db = SessionLocal()
        try:
            # Nickname change
            if before.nick != after.nick and cfg.member_log_channel_id:
                embed = build_embed("log_nickname_change", db, vars={
                    "user": str(after), "user.mention": after.mention,
                    "before": before.nick or before.name,
                    "after": after.nick or after.name,
                })
                await self._send_log(before.guild, cfg.member_log_channel_id, embed)

            # Role change
            if before.roles != after.roles and cfg.member_log_channel_id:
                added = set(after.roles) - set(before.roles)
                removed = set(before.roles) - set(after.roles)
                if added or removed:
                    parts = []
                    if added:
                        parts.append(f"➕ {', '.join(r.mention for r in added)}")
                    if removed:
                        parts.append(f"➖ {', '.join(r.mention for r in removed)}")
                    embed = build_embed("log_role_update", db, vars={
                        "user": str(after), "user.mention": after.mention,
                        "changes": "\n".join(parts),
                    })
                    await self._send_log(before.guild, cfg.member_log_channel_id, embed)
        finally:
            db.close()

    # ── Channel Events ────────────────────────────────────────────────────

    @commands.Cog.listener()
    async def on_guild_channel_create(self, channel: discord.abc.GuildChannel):
        cfg = self._get_config(str(channel.guild.id))
        if not cfg or not cfg.server_log_channel_id:
            return
        db = SessionLocal()
        try:
            embed = build_embed("log_channel_create", db, vars={
                "channel": channel.mention, "channel.name": channel.name,
                "type": str(channel.type),
            })
            await self._send_log(channel.guild, cfg.server_log_channel_id, embed)
        finally:
            db.close()

    @commands.Cog.listener()
    async def on_guild_channel_delete(self, channel: discord.abc.GuildChannel):
        cfg = self._get_config(str(channel.guild.id))
        if not cfg or not cfg.server_log_channel_id:
            return
        db = SessionLocal()
        try:
            embed = build_embed("log_channel_delete", db, vars={
                "channel.name": channel.name, "type": str(channel.type),
            })
            await self._send_log(channel.guild, cfg.server_log_channel_id, embed)
        finally:
            db.close()

    # ── Snipe Commands ────────────────────────────────────────────────────

    @discord.slash_command(name="snipe", description="Xem tin nhắn bị xóa gần nhất trong kênh")
    async def snipe_cmd(self, ctx: discord.ApplicationContext):
        data = self.snipe_cache.get(ctx.channel.id, {})
        msg = data.get("deleted")
        if not msg:
            return await ctx.respond("❌ Không có tin nhắn nào bị xóa gần đây.", ephemeral=True)
        embed = discord.Embed(
            description=msg.content[:2048] if msg.content else "*(trống)*",
            color=0xED4245,
            timestamp=msg.created_at,
        )
        embed.set_author(name=str(msg.author), icon_url=msg.author.display_avatar.url)
        embed.set_footer(text=f"#{msg.channel.name}")
        await ctx.respond(embed=embed)

    @discord.slash_command(name="editsnipe", description="Xem tin nhắn bị sửa gần nhất trong kênh")
    async def editsnipe_cmd(self, ctx: discord.ApplicationContext):
        data = self.snipe_cache.get(ctx.channel.id, {})
        edited = data.get("edited")
        if not edited:
            return await ctx.respond("❌ Không có tin nhắn nào bị sửa gần đây.", ephemeral=True)
        before, after = edited
        embed = discord.Embed(color=0xFEE75C, timestamp=after.created_at)
        embed.set_author(name=str(before.author), icon_url=before.author.display_avatar.url)
        embed.add_field(name="Trước", value=(before.content or "*(trống)*")[:1024], inline=False)
        embed.add_field(name="Sau", value=(after.content or "*(trống)*")[:1024], inline=False)
        embed.set_footer(text=f"#{before.channel.name}")
        await ctx.respond(embed=embed)
