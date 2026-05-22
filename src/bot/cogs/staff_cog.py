# src/bot/cogs/staff_cog.py
"""Staff Management cog — /staff checkin, checkout, status, leaderboard."""
import discord
import datetime
import logging
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import StaffProfile, StaffShift, CommissionLog, SystemConfig
from src.bot.embed_utils import build_embed

logger = logging.getLogger(__name__)


def _get_session():
    return SessionLocal()


class StaffCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    def _get_guild_id(self, ctx: discord.ApplicationContext) -> str:
        return str(ctx.guild_id)

    # ── /staff group ──────────────────────────────────────────────────────────

    staff = discord.SlashCommandGroup("staff", "Staff management commands")

    @staff.command(name="checkin", description="Clock in as a staff member")
    async def checkin(self, ctx: discord.ApplicationContext):
        await ctx.defer(ephemeral=True)
        guild_id = self._get_guild_id(ctx)
        discord_id = str(ctx.author.id)
        session = _get_session()
        try:
            profile = session.execute(
                select(StaffProfile).where(
                    StaffProfile.guild_id == guild_id,
                    StaffProfile.discord_id == discord_id,
                )
            ).scalar_one_or_none()
            if not profile:
                await ctx.followup.send("❌ You are not registered as a staff member.", ephemeral=True)
                return
            if not profile.is_active:
                await ctx.followup.send("❌ Your staff account is inactive.", ephemeral=True)
                return
            # Check already clocked in
            active = session.execute(
                select(StaffShift).where(
                    StaffShift.staff_id == profile.id,
                    StaffShift.clock_out.is_(None),
                )
            ).scalar_one_or_none()
            if active:
                elapsed = datetime.datetime.utcnow() - active.clock_in
                mins = int(elapsed.total_seconds() / 60)
                await ctx.followup.send(
                    f"⚠️ You're already clocked in (started {mins} minutes ago).",
                    ephemeral=True,
                )
                return
            now = datetime.datetime.utcnow()
            shift = StaffShift(
                guild_id=guild_id,
                staff_id=profile.id,
                clock_in=now,
            )
            session.add(shift)
            session.commit()

            # Send embed to staff channel if configured
            config = session.execute(select(SystemConfig).limit(1)).scalar_one_or_none()
            vars_ = {
                "staff.name": profile.display_name or ctx.author.display_name,
                "staff.role_title": profile.role_title or "Staff",
                "shift.clock_in": now.strftime("%H:%M UTC"),
            }
            embed = build_embed("staff_clockin", session, vars=vars_)
            await ctx.followup.send(embed=embed, ephemeral=True)
        finally:
            session.close()

    @staff.command(name="checkout", description="Clock out as a staff member")
    async def checkout(self, ctx: discord.ApplicationContext):
        await ctx.defer(ephemeral=True)
        guild_id = self._get_guild_id(ctx)
        discord_id = str(ctx.author.id)
        session = _get_session()
        try:
            profile = session.execute(
                select(StaffProfile).where(
                    StaffProfile.guild_id == guild_id,
                    StaffProfile.discord_id == discord_id,
                )
            ).scalar_one_or_none()
            if not profile:
                await ctx.followup.send("❌ You are not registered as a staff member.", ephemeral=True)
                return
            active = session.execute(
                select(StaffShift).where(
                    StaffShift.staff_id == profile.id,
                    StaffShift.clock_out.is_(None),
                )
            ).scalar_one_or_none()
            if not active:
                await ctx.followup.send("❌ You are not currently clocked in.", ephemeral=True)
                return
            now = datetime.datetime.utcnow()
            active.clock_out = now
            diff = now - active.clock_in
            duration = int(diff.total_seconds() / 60)
            active.duration_minutes = duration
            profile.total_hours_worked = (profile.total_hours_worked or 0) + diff.total_seconds() / 3600
            session.commit()

            vars_ = {
                "staff.name": profile.display_name or ctx.author.display_name,
                "staff.role_title": profile.role_title or "Staff",
                "shift.duration": str(duration),
                "commission.amount": "—",  # commission calculated separately
            }
            embed = build_embed("staff_clockout", session, vars=vars_)
            await ctx.followup.send(embed=embed, ephemeral=True)
        finally:
            session.close()

    @staff.command(name="status", description="Check your current shift status")
    async def status(self, ctx: discord.ApplicationContext):
        await ctx.defer(ephemeral=True)
        guild_id = self._get_guild_id(ctx)
        discord_id = str(ctx.author.id)
        session = _get_session()
        try:
            profile = session.execute(
                select(StaffProfile).where(
                    StaffProfile.guild_id == guild_id,
                    StaffProfile.discord_id == discord_id,
                )
            ).scalar_one_or_none()
            if not profile:
                await ctx.followup.send("❌ You are not registered as a staff member.", ephemeral=True)
                return
            active = session.execute(
                select(StaffShift).where(
                    StaffShift.staff_id == profile.id,
                    StaffShift.clock_out.is_(None),
                )
            ).scalar_one_or_none()

            embed = discord.Embed(title="📋 Your Staff Status", color=0x57F287 if active else 0xED4245)
            embed.add_field(name="Name", value=profile.display_name or ctx.author.display_name, inline=True)
            embed.add_field(name="Role", value=profile.role_title or "Staff", inline=True)
            embed.add_field(name="Commission Rate", value=f"{profile.commission_rate}%", inline=True)

            if active:
                elapsed = datetime.datetime.utcnow() - active.clock_in
                mins = int(elapsed.total_seconds() / 60)
                embed.add_field(name="Status", value=f"🟢 Clocked In ({mins} min ago)", inline=False)
            else:
                embed.add_field(name="Status", value="🔴 Clocked Out", inline=False)

            embed.add_field(name="Total Hours", value=f"{profile.total_hours_worked:.1f}h", inline=True)
            embed.add_field(name="Orders Handled", value=str(profile.total_orders_handled), inline=True)
            embed.add_field(name="Commission Earned", value=f"{profile.total_commission_earned:,.0f}", inline=True)
            await ctx.followup.send(embed=embed, ephemeral=True)
        finally:
            session.close()

    @staff.command(name="leaderboard", description="View staff performance leaderboard")
    async def leaderboard(self, ctx: discord.ApplicationContext):
        await ctx.defer()
        guild_id = self._get_guild_id(ctx)
        session = _get_session()
        try:
            profiles = session.execute(
                select(StaffProfile).where(
                    StaffProfile.guild_id == guild_id,
                    StaffProfile.is_active == True,
                ).order_by(StaffProfile.total_orders_handled.desc()).limit(10)
            ).scalars().all()

            if not profiles:
                await ctx.followup.send("No active staff members found.")
                return

            embed = discord.Embed(
                title="🏆 Staff Leaderboard",
                color=0xF0B232,
            )
            medals = ["🥇", "🥈", "🥉"]
            lines = []
            for i, p in enumerate(profiles):
                medal = medals[i] if i < 3 else f"**#{i+1}**"
                lines.append(
                    f"{medal} **{p.display_name or 'Unknown'}** ({p.role_title or 'Staff'})\n"
                    f"    Orders: {p.total_orders_handled} · "
                    f"Hours: {p.total_hours_worked:.1f}h · "
                    f"Commission: {p.total_commission_earned:,.0f}"
                )
            embed.description = "\n".join(lines)
            await ctx.followup.send(embed=embed)
        finally:
            session.close()
