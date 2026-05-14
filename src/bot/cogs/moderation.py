# src/bot/cogs/moderation.py
import discord
import datetime
import logging
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import Warning
from src.bot.embed_utils import build_embed

logger = logging.getLogger(__name__)


def get_session():
    return SessionLocal()


class ModerationCog(discord.Cog):
    def __init__(self, bot):
        self.bot = bot

    @discord.slash_command(name="ban", description="[Admin] Ban thành viên")
    @discord.default_permissions(ban_members=True)
    async def ban_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Thành viên cần ban"),
        reason: discord.Option(str, "Lý do", required=False, default="Không có lý do"),
        delete_messages: discord.Option(int, "Xóa tin nhắn (ngày)", required=False, default=0, min_value=0, max_value=7),
    ):
        try:
            await user.ban(reason=reason, delete_message_days=delete_messages)
            session = get_session()
            try:
                embed = build_embed("ban", session, vars={
                    "user": str(user), "user.mention": user.mention, "user.id": str(user.id),
                    "reason": reason, "mod": ctx.author.mention, "mod.name": str(ctx.author),
                    "moderator": ctx.author.mention, "server": ctx.guild.name,
                })
                await ctx.respond(embed=embed)
            finally:
                session.close()
        except discord.Forbidden:
            await ctx.respond("❌ Bot không có quyền ban thành viên này.", ephemeral=True)

    @discord.slash_command(name="unban", description="[Admin] Unban thành viên")
    @discord.default_permissions(ban_members=True)
    async def unban_cmd(
        self,
        ctx: discord.ApplicationContext,
        user_id: discord.Option(str, "Discord ID của người cần unban"),
        reason: discord.Option(str, "Lý do", required=False, default="Không có lý do"),
    ):
        try:
            user = await self.bot.fetch_user(int(user_id))
            await ctx.guild.unban(user, reason=reason)
            session = get_session()
            try:
                embed = build_embed("unban", session, vars={
                    "user": str(user), "user.mention": user.mention, "user.id": str(user.id),
                    "reason": reason, "moderator": ctx.author.mention, "server": ctx.guild.name,
                })
                await ctx.respond(embed=embed)
            finally:
                session.close()
        except discord.NotFound:
            await ctx.respond("❌ Không tìm thấy user này trong danh sách ban.", ephemeral=True)
        except Exception as e:
            await ctx.respond(f"❌ Lỗi: {e}", ephemeral=True)

    @discord.slash_command(name="kick", description="[Admin] Kick thành viên")
    @discord.default_permissions(kick_members=True)
    async def kick_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Thành viên cần kick"),
        reason: discord.Option(str, "Lý do", required=False, default="Không có lý do"),
    ):
        try:
            await user.kick(reason=reason)
            session = get_session()
            try:
                embed = build_embed("kick", session, vars={
                    "user": str(user), "user.mention": user.mention, "user.id": str(user.id),
                    "reason": reason, "mod": ctx.author.mention, "mod.name": str(ctx.author),
                    "moderator": ctx.author.mention, "server": ctx.guild.name,
                })
                await ctx.respond(embed=embed)
            finally:
                session.close()
        except discord.Forbidden:
            await ctx.respond("❌ Bot không có quyền kick thành viên này.", ephemeral=True)

    @discord.slash_command(name="warn", description="[Admin] Cảnh cáo thành viên")
    @discord.default_permissions(manage_messages=True)
    async def warn_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Thành viên cần cảnh cáo"),
        reason: discord.Option(str, "Lý do"),
    ):
        session = get_session()
        try:
            warning = Warning(
                discord_id=str(user.id),
                guild_id=str(ctx.guild.id),
                reason=reason,
                moderator_id=str(ctx.author.id),
            )
            session.add(warning)
            session.commit()

            count = len(session.execute(
                select(Warning).where(
                    Warning.discord_id == str(user.id),
                    Warning.guild_id == str(ctx.guild.id),
                )
            ).scalars().all())

            # Channel embed
            embed = build_embed("canh_bao", session, vars={
                "user": str(user), "user.mention": user.mention, "user.id": str(user.id),
                "reason": reason, "warn_count": str(count),
                "mod": ctx.author.mention, "moderator": ctx.author.mention, "server": ctx.guild.name,
            })
            await ctx.respond(embed=embed)

            # DM user sử dụng embed template từ DB
            try:
                dm_embed = build_embed("canh_bao", session, vars={
                    "user": str(user),
                    "user.mention": user.mention,
                    "user.id": str(user.id),
                    "reason": reason,
                    "warn_count": str(count),
                    "server": ctx.guild.name,
                })
                await user.send(embed=dm_embed)
            except Exception:
                pass
        finally:
            session.close()

    @discord.slash_command(name="unwarn", description="[Admin] Xóa cảnh cáo")
    @discord.default_permissions(manage_messages=True)
    async def unwarn_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Thành viên"),
        warn_id: discord.Option(int, "ID cảnh cáo (xem /warnings)"),
    ):
        session = get_session()
        try:
            w = session.execute(
                select(Warning).where(Warning.id == warn_id, Warning.discord_id == str(user.id))
            ).scalars().first()
            if not w:
                await ctx.respond("❌ Không tìm thấy cảnh cáo này.", ephemeral=True)
                return
            session.delete(w)
            session.commit()
            await ctx.respond(f"✅ Đã xóa cảnh cáo #{warn_id} của {user.mention}.", ephemeral=True)
        finally:
            session.close()

    @discord.slash_command(name="warnings", description="[Admin] Xem lịch sử cảnh cáo")
    @discord.default_permissions(manage_messages=True)
    async def warnings_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Thành viên", required=False, default=None),
    ):
        target = user or ctx.author

        session = get_session()
        try:
            warns = session.execute(
                select(Warning).where(
                    Warning.discord_id == str(target.id),
                    Warning.guild_id == str(ctx.guild.id),
                ).order_by(Warning.created_at.desc())
            ).scalars().all()

            if not warns:
                await ctx.respond(f"✅ {target.mention} không có cảnh cáo nào.", ephemeral=True)
                return

            embed = discord.Embed(title=f"⚠️ Cảnh cáo của {target.display_name}", color=discord.Color.yellow())
            for w in warns[:10]:
                mod_mention = f"<@{w.moderator_id}>" if w.moderator_id else "Unknown"
                embed.add_field(
                    name=f"#{w.id} — {w.created_at.strftime('%d/%m/%Y') if w.created_at else '—'}",
                    value=f"**Lý do:** {w.reason or '—'}\n**Mod:** {mod_mention}",
                    inline=False,
                )
            embed.set_footer(text=f"Tổng: {len(warns)} cảnh cáo")
            await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()
