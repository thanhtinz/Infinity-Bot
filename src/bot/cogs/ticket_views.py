# src/bot/cogs/ticket_views.py
"""Persistent Views and Buttons for the ticket system."""
import asyncio
import datetime
import logging
import discord
from sqlalchemy import select
from src.models.models import Ticket, TicketPanel, TicketBlacklist
from src.bot.embed_utils import build_embed
from src.bot.cogs.ticket_helpers import (
    get_session, _get_config, _hex, _make_channel, _log_ticket,
    BUTTON_STYLES,
)

logger = logging.getLogger(__name__)


# ── Persistent Views ──────────────────────────────────────────────────────────

class TicketControlView(discord.ui.View):
    def __init__(self, ticket_id: int):
        super().__init__(timeout=None)
        self.add_item(_CloseBtn(ticket_id))


class _CloseBtn(discord.ui.Button):
    def __init__(self, ticket_id: int):
        super().__init__(label="Đóng Ticket", emoji="🔒",
                         style=discord.ButtonStyle.danger,
                         custom_id=f"ticket_close:{ticket_id}")
        self.ticket_id = ticket_id

    async def callback(self, interaction: discord.Interaction):
        session = get_session()
        try:
            ticket = session.get(Ticket, self.ticket_id)
            if not ticket or ticket.status != "open":
                await interaction.response.send_message("❌ Ticket không ở trạng thái mở.", ephemeral=True)
                return
            ticket.status = "closed"
            ticket.closed_at = datetime.datetime.utcnow()
            ticket.close_reason = f"Đóng bởi {interaction.user.display_name}"
            session.commit()

            ch = interaction.channel
            try:
                if not ch.name.startswith("closed-"):
                    await ch.edit(name=f"closed-{ch.name[:90]}")
            except Exception:
                pass
            try:
                creator = interaction.guild.get_member(int(ticket.creator_id))
                if creator:
                    await ch.set_permissions(creator, send_messages=False)
            except Exception:
                pass

            embed = build_embed("ticket_dong", session, vars={
                "ticket.id": str(ticket.id), "closer.mention": interaction.user.mention,
                "reason": ticket.close_reason or "", "duration": "",
            })
            await interaction.response.send_message(embed=embed, view=_ReopenDeleteView(self.ticket_id))
            await _log_ticket(interaction.client, "close", ticket, interaction.user)
        finally:
            session.close()


class _ReopenDeleteView(discord.ui.View):
    def __init__(self, ticket_id: int):
        super().__init__(timeout=None)
        self.add_item(_ReopenBtn(ticket_id))
        self.add_item(_DeleteBtn(ticket_id))


class _ReopenBtn(discord.ui.Button):
    def __init__(self, ticket_id: int):
        super().__init__(label="Mở lại", emoji="🔓",
                         style=discord.ButtonStyle.success,
                         custom_id=f"ticket_reopen:{ticket_id}")
        self.ticket_id = ticket_id

    async def callback(self, interaction: discord.Interaction):
        if not interaction.user.guild_permissions.manage_channels:
            await interaction.response.send_message("❌ Bạn không có quyền.", ephemeral=True)
            return
        session = get_session()
        try:
            ticket = session.get(Ticket, self.ticket_id)
            if not ticket:
                return
            ticket.status = "open"
            ticket.closed_at = None
            session.commit()
            ch = interaction.channel
            try:
                if ch.name.startswith("closed-"):
                    await ch.edit(name=ch.name[7:])
            except Exception:
                pass
            try:
                creator = interaction.guild.get_member(int(ticket.creator_id))
                if creator:
                    await ch.set_permissions(creator, read_messages=True, send_messages=True)
            except Exception:
                pass
            embed = discord.Embed(title="🔓 Ticket đã mở lại",
                                  description=f"Mở lại bởi {interaction.user.mention}",
                                  color=0x57F287, timestamp=datetime.datetime.utcnow())
            await interaction.response.send_message(embed=embed)
            await _log_ticket(interaction.client, "reopen", ticket, interaction.user)
        finally:
            session.close()


class _DeleteBtn(discord.ui.Button):
    def __init__(self, ticket_id: int):
        super().__init__(label="Xóa Ticket", emoji="🗑️",
                         style=discord.ButtonStyle.danger,
                         custom_id=f"ticket_delete_btn:{ticket_id}")
        self.ticket_id = ticket_id

    async def callback(self, interaction: discord.Interaction):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ Chỉ admin mới có thể xóa ticket.", ephemeral=True)
            return
        session = get_session()
        try:
            ticket = session.get(Ticket, self.ticket_id)
            if ticket:
                ticket.status = "deleted"
                session.commit()
            await interaction.response.send_message("🗑️ Đang xóa...", ephemeral=True)
            await asyncio.sleep(3)
            try:
                await interaction.channel.delete()
            except Exception as e:
                logger.error(f"delete channel: {e}")
        finally:
            session.close()


class PanelView(discord.ui.View):
    """Persistent panel view — survives bot restarts via custom_id."""
    def __init__(self, panel: TicketPanel):
        super().__init__(timeout=None)
        btn_style = BUTTON_STYLES.get(panel.button_style or "primary", discord.ButtonStyle.primary)
        self.add_item(_PanelBtn(
            panel_id=panel.id,
            label=panel.button_label or "Tạo Ticket",
            emoji=panel.button_emoji or "🎫",
            style=btn_style,
        ))


class _PanelBtn(discord.ui.Button):
    def __init__(self, panel_id, label, emoji, style):
        super().__init__(label=label, emoji=emoji, style=style,
                         custom_id=f"ticket_panel:{panel_id}")
        self.panel_id = panel_id

    async def callback(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        session = get_session()
        try:
            guild_id = str(interaction.guild_id)
            creator_id = str(interaction.user.id)

            bl = session.execute(
                select(TicketBlacklist).where(
                    TicketBlacklist.guild_id == guild_id,
                    TicketBlacklist.discord_id == creator_id,
                )
            ).scalars().first()
            if bl:
                await interaction.followup.send(
                    f"❌ Bạn bị cấm tạo ticket.\n**Lý do:** {bl.reason or '—'}", ephemeral=True)
                return

            cfg = _get_config(session, guild_id)
            limit = cfg.ticket_limit if cfg else 1
            open_count = len(session.execute(
                select(Ticket).where(
                    Ticket.guild_id == guild_id,
                    Ticket.creator_id == creator_id,
                    Ticket.status == "open",
                )
            ).scalars().all())
            if open_count >= limit:
                await interaction.followup.send(
                    f"❌ Bạn đã đạt giới hạn **{limit}** ticket đang mở.", ephemeral=True)
                return

            panel = session.get(TicketPanel, self.panel_id)
            ticket = Ticket(guild_id=guild_id, creator_id=creator_id,
                            panel_id=self.panel_id, status="open")
            session.add(ticket)
            session.commit()
            session.refresh(ticket)

            creator = interaction.user
            ch = await _make_channel(interaction.guild, creator, cfg, panel, None, ticket.id)
            if not ch:
                session.delete(ticket)
                session.commit()
                await interaction.followup.send("❌ Không tạo được kênh. Bot thiếu quyền?", ephemeral=True)
                return

            ticket.channel_id = str(ch.id)
            session.commit()

            color = _hex(panel.color if panel else None)
            embed = build_embed("ticket_mo", session, vars={
                "ticket.id": str(ticket.id), "user": creator.display_name,
                "user.mention": creator.mention, "user.id": str(creator.id),
                "ticket.subject": "",
            })
            await ch.send(content=creator.mention, embed=embed,
                          view=TicketControlView(ticket.id))
            await interaction.followup.send(f"✅ Ticket tạo thành công: {ch.mention}", ephemeral=True)
            await _log_ticket(interaction.client, "open", ticket, creator)
        except Exception as e:
            logger.error(f"_PanelBtn: {e}")
            try:
                await interaction.followup.send("❌ Lỗi khi tạo ticket.", ephemeral=True)
            except Exception:
                pass
        finally:
            session.close()
