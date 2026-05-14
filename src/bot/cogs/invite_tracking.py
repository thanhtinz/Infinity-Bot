"""
Invite Tracking Cog
- Tracks who invited each member to the server
- Commands: /invites, /inviteinfo, /invites_leaderboard, /bonus
- Persists data to invite_tracking table
"""
import discord
from discord.ext import commands
from discord import SlashCommandGroup
from sqlalchemy import select, func
from src.database.config import SessionLocal
from src.models.models import InviteTracking


class InviteTrackingCog(commands.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        # Cache: guild_id -> {invite_code: uses_count}
        self._invite_cache: dict[str, dict[str, int]] = {}

    async def _build_cache(self, guild: discord.Guild):
        try:
            invites = await guild.invites()
            self._invite_cache[str(guild.id)] = {inv.code: inv.uses for inv in invites}
        except discord.Forbidden:
            pass

    @commands.Cog.listener()
    async def on_ready(self):
        for guild in self.bot.guilds:
            await self._build_cache(guild)

    @commands.Cog.listener()
    async def on_guild_join(self, guild: discord.Guild):
        await self._build_cache(guild)

    @commands.Cog.listener()
    async def on_invite_create(self, invite: discord.Invite):
        guild_id = str(invite.guild.id) if invite.guild else None
        if guild_id and guild_id in self._invite_cache:
            self._invite_cache[guild_id][invite.code] = invite.uses

    @commands.Cog.listener()
    async def on_invite_delete(self, invite: discord.Invite):
        guild_id = str(invite.guild.id) if invite.guild else None
        if guild_id and guild_id in self._invite_cache:
            self._invite_cache[guild_id].pop(invite.code, None)

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        guild = member.guild
        guild_id = str(guild.id)
        old_cache = dict(self._invite_cache.get(guild_id, {}))

        # Refresh invite list
        try:
            new_invites = await guild.invites()
        except discord.Forbidden:
            return

        new_cache = {inv.code: inv.uses for inv in new_invites}
        self._invite_cache[guild_id] = new_cache

        # Find which invite was used (uses increased)
        used_code = None
        inviter_id = None
        for inv in new_invites:
            old_uses = old_cache.get(inv.code, 0)
            if inv.uses > old_uses:
                used_code = inv.code
                inviter_id = str(inv.inviter.id) if inv.inviter else "unknown"
                break

        if not inviter_id:
            inviter_id = "unknown"

        db = SessionLocal()
        try:
            record = InviteTracking(
                guild_id=guild_id,
                inviter_id=inviter_id,
                invitee_id=str(member.id),
                invite_code=used_code,
            )
            db.add(record)
            db.commit()
        finally:
            db.close()

        # Gửi welcome embed
        try:
            from src.bot.embed_utils import build_embed
            from src.models.models import SystemConfig
            _db = SessionLocal()
            try:
                config = _db.execute(__import__("sqlalchemy").select(SystemConfig).limit(1)).scalars().first()
                welcome_channel_id = config.welcome_channel_id if config else None
                if welcome_channel_id:
                    ch = guild.get_channel(int(welcome_channel_id))
                    if not ch:
                        ch = await guild.fetch_channel(int(welcome_channel_id))
                    if ch:
                        welcome_embed = build_embed("welcome", _db, vars={
                            "user.mention": member.mention,
                            "user": member.display_name,
                            "user.id": member.id,
                            "server": guild.name,
                            "member_count": str(guild.member_count),
                        })
                        await ch.send(content=member.mention, embed=welcome_embed)
            finally:
                _db.close()
        except Exception as _e:
            import logging as _log
            _log.getLogger(__name__).error(f"welcome embed error: {_e}")

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member):
        guild_id = str(member.guild.id)
        db = SessionLocal()
        try:
            record = db.execute(
                select(InviteTracking)
                .where(
                    InviteTracking.guild_id == guild_id,
                    InviteTracking.invitee_id == str(member.id),
                    InviteTracking.left == False,
                )
                .order_by(InviteTracking.joined_at.desc())
                .limit(1)
            ).scalars().first()
            if record:
                record.left = True
                db.commit()
        finally:
            db.close()

    # ── Slash commands ──────────────────────────────────────────────────────

    invite_group = SlashCommandGroup("invites", "Lệnh invite tracking")

    @invite_group.command(name="me", description="Xem số invite của bạn")
    async def invites_me(self, ctx: discord.ApplicationContext):
        await ctx.defer(ephemeral=True)
        db = SessionLocal()
        try:
            stats = db.execute(
                select(
                    func.count().label("total"),
                    func.sum((InviteTracking.left == False).cast(db.bind.dialect.name == "postgresql" and "integer" or "integer")).label("active"),
                ).where(
                    InviteTracking.inviter_id == str(ctx.author.id),
                    InviteTracking.guild_id == str(ctx.guild.id),
                    InviteTracking.is_fake == False,
                )
            ).first()
        finally:
            db.close()

        total = stats.total if stats else 0
        embed = discord.Embed(
            title="📨 Invite của bạn",
            color=0x5865F2,
        )
        embed.add_field(name="Tổng invite", value=str(total or 0), inline=True)
        embed.set_footer(text=f"ID: {ctx.author.id}")
        await ctx.respond(embed=embed, ephemeral=True)

    @invite_group.command(name="info", description="Xem invite của một thành viên")
    async def invites_info(
        self,
        ctx: discord.ApplicationContext,
        member: discord.Option(discord.Member, "Thành viên cần xem"),
    ):
        await ctx.defer()
        db = SessionLocal()
        try:
            rows = db.execute(
                select(InviteTracking).where(
                    InviteTracking.inviter_id == str(member.id),
                    InviteTracking.guild_id == str(ctx.guild.id),
                )
            ).scalars().all()
        finally:
            db.close()

        total = len(rows)
        active = sum(1 for r in rows if not r.left and not r.is_fake)
        left = sum(1 for r in rows if r.left)
        fake = sum(1 for r in rows if r.is_fake)

        embed = discord.Embed(
            title=f"📨 Invite của {member.display_name}",
            color=0x5865F2,
        )
        embed.add_field(name="Tổng", value=str(total), inline=True)
        embed.add_field(name="✅ Active", value=str(active), inline=True)
        embed.add_field(name="❌ Đã rời", value=str(left), inline=True)
        embed.add_field(name="🚫 Fake", value=str(fake), inline=True)
        embed.set_thumbnail(url=member.display_avatar.url)
        await ctx.respond(embed=embed)

    @invite_group.command(name="leaderboard", description="Bảng xếp hạng invite server")
    async def invites_leaderboard(self, ctx: discord.ApplicationContext):
        await ctx.defer()
        db = SessionLocal()
        try:
            rows = db.execute(
                select(
                    InviteTracking.inviter_id,
                    func.count().label("total"),
                ).where(
                    InviteTracking.guild_id == str(ctx.guild.id),
                    InviteTracking.is_fake == False,
                    InviteTracking.left == False,
                ).group_by(InviteTracking.inviter_id)
                .order_by(func.count().desc())
                .limit(10)
            ).all()
        finally:
            db.close()

        if not rows:
            await ctx.respond("Chưa có dữ liệu invite.", ephemeral=True)
            return

        medals = ["🥇", "🥈", "🥉"]
        lines = []
        for i, row in enumerate(rows):
            medal = medals[i] if i < 3 else f"`{i+1}.`"
            try:
                user = await self.bot.fetch_user(int(row.inviter_id))
                name = user.display_name
            except Exception:
                name = f"<@{row.inviter_id}>"
            lines.append(f"{medal} **{name}** — {row.total} invites")

        embed = discord.Embed(
            title="🏆 Bảng xếp hạng Invite",
            description="\n".join(lines),
            color=0xF1C40F,
        )
        embed.set_footer(text=f"Server: {ctx.guild.name}")
        await ctx.respond(embed=embed)

    @invite_group.command(name="fake", description="Đánh dấu invite của user là fake (Admin)")
    @commands.has_permissions(administrator=True)
    async def invites_fake(
        self,
        ctx: discord.ApplicationContext,
        member: discord.Option(discord.Member, "Thành viên bị đánh fake"),
    ):
        await ctx.defer(ephemeral=True)
        db = SessionLocal()
        try:
            records = db.execute(
                select(InviteTracking).where(
                    InviteTracking.invitee_id == str(member.id),
                    InviteTracking.guild_id == str(ctx.guild.id),
                )
            ).scalars().all()
            for r in records:
                r.is_fake = True
            db.commit()
            count = len(records)
        finally:
            db.close()

        await ctx.respond(f"✅ Đã đánh dấu {count} record invite của {member.mention} là fake.", ephemeral=True)
