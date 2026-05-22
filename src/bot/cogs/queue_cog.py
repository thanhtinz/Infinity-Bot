# src/bot/cogs/queue_cog.py
"""Smart Queue / Support Ticket cog — /ticket open, close, claim, assign, list, rate."""
import discord
import datetime
import logging
import asyncio
from discord.ext import tasks
from sqlalchemy import select, func
from src.database.config import SessionLocal
from src.models.models import QueueConfig, SupportTicket, TicketMessage, StaffProfile
from src.bot.embed_utils import build_embed

logger = logging.getLogger(__name__)

OPEN_STATUSES = ("open", "claimed", "in_progress", "pending")
PRIORITY_COLORS = {
    "low": discord.Color.light_grey(),
    "normal": discord.Color.blue(),
    "high": discord.Color.orange(),
    "urgent": discord.Color.red(),
}


def _get_session():
    return SessionLocal()


def _get_or_create_config(session, guild_id: str) -> QueueConfig:
    cfg = session.execute(
        select(QueueConfig).where(QueueConfig.guild_id == guild_id)
    ).scalar_one_or_none()
    if not cfg:
        cfg = QueueConfig(guild_id=guild_id)
        session.add(cfg)
        session.commit()
        session.refresh(cfg)
    return cfg


class QueueCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        self._sla_task_started = False

    def cog_load(self):
        if not self._sla_task_started:
            self._sla_worker.start()
            self._sla_task_started = True

    def cog_unload(self):
        self._sla_worker.cancel()

    # ── SLA Worker ─────────────────────────────────────────────────────────────

    @tasks.loop(minutes=5)
    async def _sla_worker(self):
        """Check SLA breaches every 5 minutes and alert log channel."""
        try:
            session = _get_session()
            try:
                # Get all guilds with queue config
                configs = session.execute(
                    select(QueueConfig).where(QueueConfig.enabled == True)
                ).scalars().all()
                now = datetime.datetime.utcnow()
                for cfg in configs:
                    open_tickets = session.execute(
                        select(SupportTicket).where(
                            SupportTicket.guild_id == cfg.guild_id,
                            SupportTicket.status.in_(OPEN_STATUSES),
                        )
                    ).scalars().all()
                    newly_breached = []
                    for t in open_tickets:
                        elapsed = (now - t.created_at).total_seconds() / 60
                        changed = False
                        if not t.sla_response_breached and not t.first_response_at:
                            if elapsed > cfg.sla_response_minutes:
                                t.sla_response_breached = True
                                changed = True
                                newly_breached.append(t)
                        if not t.sla_resolve_breached and t.status not in ("resolved", "closed"):
                            if elapsed > cfg.sla_resolve_minutes:
                                t.sla_resolve_breached = True
                                changed = True
                                if t not in newly_breached:
                                    newly_breached.append(t)
                    if newly_breached:
                        session.commit()
                        # Alert log channel
                        if cfg.log_channel_id:
                            channel = self.bot.get_channel(int(cfg.log_channel_id))
                            if channel:
                                for t in newly_breached:
                                    vars_ = {
                                        "ticket.number": str(t.ticket_number),
                                        "ticket.priority": t.priority,
                                        "ticket.created_at": t.created_at.strftime("%Y-%m-%d %H:%M UTC"),
                                    }
                                    embed = build_embed("ticket_sla_breach", session, vars=vars_)
                                    await channel.send(embed=embed)
            finally:
                session.close()
        except Exception as e:
            logger.error(f"[QueueCog] SLA worker error: {e}")

    @_sla_worker.before_loop
    async def _before_sla_worker(self):
        await self.bot.wait_until_ready()
        await asyncio.sleep(30)

    # ── /ticket group ──────────────────────────────────────────────────────────

    ticket = discord.SlashCommandGroup("ticket", "Support ticket commands")

    @ticket.command(name="open", description="Open a new support ticket")
    async def open_ticket(
        self,
        ctx: discord.ApplicationContext,
        subject: discord.Option(str, "Brief subject of your ticket", required=True),
        priority: discord.Option(
            str, "Priority level", required=False,
            choices=["low", "normal", "high", "urgent"], default="normal"
        ),
        category: discord.Option(str, "Category (billing, tech, general)", required=False) = None,
    ):
        await ctx.defer(ephemeral=True)
        guild_id = str(ctx.guild_id)
        discord_id = str(ctx.author.id)
        session = _get_session()
        try:
            cfg = _get_or_create_config(session, guild_id)
            if not cfg.enabled:
                await ctx.followup.send("❌ Support tickets are currently disabled.", ephemeral=True)
                return
            # Check max open per user
            open_count = session.execute(
                select(func.count(SupportTicket.id)).where(
                    SupportTicket.guild_id == guild_id,
                    SupportTicket.creator_discord_id == discord_id,
                    SupportTicket.status.in_(OPEN_STATUSES),
                )
            ).scalar()
            if open_count >= cfg.max_open_per_user:
                await ctx.followup.send(
                    f"❌ You already have {open_count} open ticket(s). Please close existing tickets first.",
                    ephemeral=True,
                )
                return
            # Auto-increment ticket number
            max_num = session.execute(
                select(func.max(SupportTicket.ticket_number)).where(SupportTicket.guild_id == guild_id)
            ).scalar() or 0
            ticket = SupportTicket(
                guild_id=guild_id,
                ticket_number=max_num + 1,
                subject=subject,
                creator_discord_id=discord_id,
                creator_name=ctx.author.display_name,
                priority=priority,
                category=category or "general",
            )
            session.add(ticket)
            session.commit()
            session.refresh(ticket)

            # Try to create a Discord channel if category set
            channel_mention = ""
            if cfg.category_id:
                try:
                    category_channel = ctx.guild.get_channel(int(cfg.category_id))
                    if category_channel:
                        overwrites = {
                            ctx.guild.default_role: discord.PermissionOverwrite(view_channel=False),
                            ctx.author: discord.PermissionOverwrite(view_channel=True, send_messages=True),
                            ctx.guild.me: discord.PermissionOverwrite(view_channel=True, send_messages=True),
                        }
                        if cfg.support_role_id:
                            support_role = ctx.guild.get_role(int(cfg.support_role_id))
                            if support_role:
                                overwrites[support_role] = discord.PermissionOverwrite(view_channel=True, send_messages=True)
                        ch = await ctx.guild.create_text_channel(
                            name=f"ticket-{ticket.ticket_number:04d}",
                            category=category_channel,
                            overwrites=overwrites,
                            topic=f"Ticket #{ticket.ticket_number} — {subject}",
                        )
                        ticket.channel_id = str(ch.id)
                        session.commit()
                        channel_mention = f" → {ch.mention}"
                        # Send welcome embed to channel
                        vars_ = {
                            "ticket.number": str(ticket.ticket_number),
                            "ticket.subject": subject,
                            "ticket.priority": priority,
                            "ticket.category": category or "general",
                            "user.mention": ctx.author.mention,
                        }
                        embed = build_embed("ticket_opened", session, vars=vars_)
                        msg = cfg.welcome_message or "A support agent will be with you shortly."
                        await ch.send(content=f"{ctx.author.mention}\n{msg}", embed=embed)
                        # Ping support role
                        if cfg.support_role_id:
                            support_role = ctx.guild.get_role(int(cfg.support_role_id))
                            if support_role:
                                await ch.send(f"{support_role.mention} — new ticket assigned!", delete_after=10)
                except Exception as ch_err:
                    logger.warning(f"[QueueCog] Could not create ticket channel: {ch_err}")

            await ctx.followup.send(
                f"✅ Ticket **#{ticket.ticket_number}** opened{channel_mention}",
                ephemeral=True,
            )
        finally:
            session.close()

    @ticket.command(name="close", description="Close your ticket or a ticket (staff)")
    async def close_ticket(
        self,
        ctx: discord.ApplicationContext,
        ticket_number: discord.Option(int, "Ticket number to close", required=False) = None,
    ):
        await ctx.defer(ephemeral=True)
        guild_id = str(ctx.guild_id)
        session = _get_session()
        try:
            if ticket_number:
                t = session.execute(
                    select(SupportTicket).where(
                        SupportTicket.guild_id == guild_id,
                        SupportTicket.ticket_number == ticket_number,
                    )
                ).scalar_one_or_none()
            else:
                # Find by channel
                ch_id = str(ctx.channel_id)
                t = session.execute(
                    select(SupportTicket).where(
                        SupportTicket.guild_id == guild_id,
                        SupportTicket.channel_id == ch_id,
                    )
                ).scalar_one_or_none()
            if not t:
                await ctx.followup.send("❌ Ticket not found.", ephemeral=True)
                return
            if t.status in ("closed",):
                await ctx.followup.send("⚠️ Ticket is already closed.", ephemeral=True)
                return
            t.status = "closed"
            t.closed_at = datetime.datetime.utcnow()
            session.commit()

            vars_ = {
                "ticket.number": str(t.ticket_number),
                "ticket.rating": str(t.rating or "—"),
            }
            embed = build_embed("ticket_closed", session, vars=vars_)
            await ctx.followup.send(embed=embed)
        finally:
            session.close()

    @ticket.command(name="claim", description="Claim a ticket as the assigned staff")
    async def claim_ticket(
        self,
        ctx: discord.ApplicationContext,
        ticket_number: discord.Option(int, "Ticket number to claim", required=False) = None,
    ):
        await ctx.defer(ephemeral=True)
        guild_id = str(ctx.guild_id)
        discord_id = str(ctx.author.id)
        session = _get_session()
        try:
            # Find staff profile
            profile = session.execute(
                select(StaffProfile).where(
                    StaffProfile.guild_id == guild_id,
                    StaffProfile.discord_id == discord_id,
                )
            ).scalar_one_or_none()
            if not profile:
                await ctx.followup.send("❌ You are not registered as a staff member.", ephemeral=True)
                return
            if ticket_number:
                t = session.execute(
                    select(SupportTicket).where(
                        SupportTicket.guild_id == guild_id,
                        SupportTicket.ticket_number == ticket_number,
                    )
                ).scalar_one_or_none()
            else:
                ch_id = str(ctx.channel_id)
                t = session.execute(
                    select(SupportTicket).where(
                        SupportTicket.guild_id == guild_id,
                        SupportTicket.channel_id == ch_id,
                    )
                ).scalar_one_or_none()
            if not t:
                await ctx.followup.send("❌ Ticket not found.", ephemeral=True)
                return
            t.assigned_staff_id = profile.id
            t.status = "claimed"
            t.updated_at = datetime.datetime.utcnow()
            session.commit()

            vars_ = {
                "ticket.number": str(t.ticket_number),
                "ticket.priority": t.priority,
                "staff.name": profile.display_name or ctx.author.display_name,
            }
            embed = build_embed("ticket_claimed", session, vars=vars_)
            await ctx.followup.send(embed=embed)
        finally:
            session.close()

    @ticket.command(name="list", description="List open tickets")
    async def list_tickets(
        self,
        ctx: discord.ApplicationContext,
        status: discord.Option(
            str, "Filter by status", required=False,
            choices=["open", "claimed", "in_progress", "pending", "resolved", "closed"]
        ) = None,
    ):
        await ctx.defer(ephemeral=True)
        guild_id = str(ctx.guild_id)
        session = _get_session()
        try:
            q = select(SupportTicket).where(SupportTicket.guild_id == guild_id)
            if status:
                q = q.where(SupportTicket.status == status)
            else:
                q = q.where(SupportTicket.status.in_(OPEN_STATUSES))
            tickets = session.execute(q.order_by(SupportTicket.ticket_number).limit(20)).scalars().all()
            if not tickets:
                await ctx.followup.send("No tickets found.", ephemeral=True)
                return
            embed = discord.Embed(
                title=f"🎫 Tickets ({status or 'open'})",
                color=0x5865F2,
            )
            lines = []
            for t in tickets:
                breached = " 🔴" if t.sla_response_breached or t.sla_resolve_breached else ""
                lines.append(
                    f"**#{t.ticket_number}** [{t.priority.upper()}] {t.subject or '(no subject)'}{breached}\n"
                    f"  Status: {t.status} · By: {t.creator_name or t.creator_discord_id}"
                )
            embed.description = "\n".join(lines)
            await ctx.followup.send(embed=embed, ephemeral=True)
        finally:
            session.close()

    @ticket.command(name="resolve", description="Mark a ticket as resolved")
    async def resolve_ticket(
        self,
        ctx: discord.ApplicationContext,
        ticket_number: discord.Option(int, "Ticket number", required=False) = None,
    ):
        await ctx.defer(ephemeral=True)
        guild_id = str(ctx.guild_id)
        session = _get_session()
        try:
            if ticket_number:
                t = session.execute(
                    select(SupportTicket).where(
                        SupportTicket.guild_id == guild_id,
                        SupportTicket.ticket_number == ticket_number,
                    )
                ).scalar_one_or_none()
            else:
                ch_id = str(ctx.channel_id)
                t = session.execute(
                    select(SupportTicket).where(
                        SupportTicket.guild_id == guild_id,
                        SupportTicket.channel_id == ch_id,
                    )
                ).scalar_one_or_none()
            if not t:
                await ctx.followup.send("❌ Ticket not found.", ephemeral=True)
                return
            staff_name = "Staff"
            if t.assigned_staff_id:
                p = session.execute(select(StaffProfile).where(StaffProfile.id == t.assigned_staff_id)).scalar_one_or_none()
                if p:
                    staff_name = p.display_name or "Staff"
            t.status = "resolved"
            t.resolved_at = datetime.datetime.utcnow()
            session.commit()

            vars_ = {
                "ticket.number": str(t.ticket_number),
                "staff.name": staff_name,
            }
            embed = build_embed("ticket_resolved", session, vars=vars_)
            await ctx.followup.send(embed=embed)
        finally:
            session.close()
