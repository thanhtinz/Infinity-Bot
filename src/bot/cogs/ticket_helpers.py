# src/bot/cogs/ticket_helpers.py
"""Shared helpers for the ticket system — used by both ticket.py and ticket_views.py."""
import datetime
import logging
import discord
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import Ticket, TicketPanel, TicketConfig
from src.bot.embed_utils import build_embed

logger = logging.getLogger(__name__)

PRIORITY_COLORS = {"low": 0x57F287, "normal": 0x5865F2, "high": 0xFEE75C, "urgent": 0xED4245}
PRIORITY_LABELS = {"low": "Thấp", "normal": "Bình thường", "high": "Cao", "urgent": "Khẩn cấp"}
BUTTON_STYLES = {
    "primary": discord.ButtonStyle.primary,
    "secondary": discord.ButtonStyle.secondary,
    "success": discord.ButtonStyle.success,
    "danger": discord.ButtonStyle.danger,
}


def get_session():
    return SessionLocal()


def _get_config(session, guild_id: str) -> TicketConfig | None:
    return session.execute(select(TicketConfig).where(TicketConfig.guild_id == guild_id)).scalars().first()


def _hex(color: str | None) -> int:
    try:
        return int((color or "5865F2").lstrip("#"), 16)
    except Exception:
        return 0x5865F2


# ── Channel helpers ───────────────────────────────────────────────────────────

async def _make_channel(guild, creator, config, panel, subject, ticket_id) -> discord.TextChannel | None:
    fmt = (config.naming_format if config else "ticket-{number}")
    name = fmt.replace("{number}", str(ticket_id)).replace("{username}", creator.name.lower()[:20])
    name = name[:100].replace(" ", "-")

    category = None
    cat_id = (panel.category_id if panel and panel.category_id else None) or \
             (config.category_id if config else None)
    if cat_id:
        try:
            category = guild.get_channel(int(cat_id))
        except Exception:
            pass

    ow = {
        guild.default_role: discord.PermissionOverwrite(read_messages=False, send_messages=False),
        creator: discord.PermissionOverwrite(
            read_messages=True, send_messages=True, read_message_history=True,
            attach_files=True, embed_links=True,
        ),
        guild.me: discord.PermissionOverwrite(
            read_messages=True, send_messages=True, manage_channels=True,
            manage_messages=True, read_message_history=True, embed_links=True,
        ),
    }
    if config and config.support_role_ids:
        for rid in config.support_role_ids:
            try:
                role = guild.get_role(int(rid))
                if role:
                    ow[role] = discord.PermissionOverwrite(
                        read_messages=True, send_messages=True,
                        manage_messages=True, read_message_history=True,
                    )
            except Exception:
                pass

    topic = f"Ticket #{ticket_id}" + (f" | {subject}" if subject else "") + f" | {creator.display_name}"
    try:
        return await guild.create_text_channel(
            name=name, overwrites=ow, category=category, topic=topic[:1024]
        )
    except Exception as e:
        logger.error(f"_make_channel error: {e}")
        return None


async def _log_ticket(bot, action: str, ticket: Ticket, actor=None, extra: str = ""):
    session = get_session()
    try:
        cfg = _get_config(session, ticket.guild_id)
        if not cfg or not cfg.log_channel_id:
            return
        ch = bot.get_channel(int(cfg.log_channel_id))
        if not ch:
            return
        colors = {"open": 0x57F287, "close": 0xFEE75C, "reopen": 0x5865F2,
                  "delete": 0xED4245, "claim": 0xEB459E}
        embed = discord.Embed(
            title=f"🎫 Ticket #{ticket.id} — {action.upper()}",
            color=colors.get(action, 0x5865F2),
            timestamp=datetime.datetime.utcnow(),
        )
        embed.add_field(name="Người tạo", value=f"<@{ticket.creator_id}>", inline=True)
        if actor:
            embed.add_field(name="Thực hiện bởi", value=actor.mention, inline=True)
        if ticket.channel_id:
            embed.add_field(name="Kênh", value=f"<#{ticket.channel_id}>", inline=True)
        if extra:
            embed.add_field(name="Ghi chú", value=extra, inline=False)
        await ch.send(embed=embed)
    except Exception as e:
        logger.error(f"_log_ticket: {e}")
    finally:
        session.close()
