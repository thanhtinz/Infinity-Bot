# src/bot/cogs/sticky_modals.py
"""
Sticky Message Modals — Discord UI Modals for creating/editing sticky messages.
"""
import logging
import discord
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import StickyMessage

logger = logging.getLogger(__name__)

# ── helpers ──────────────────────────────────────────────────────────────────

def get_session():
    return SessionLocal()


def _hex_to_int(color: str | None) -> int:
    if not color:
        return 0x5865F2
    try:
        return int(color.lstrip("#"), 16)
    except Exception:
        return 0x5865F2


# ── Modals ────────────────────────────────────────────────────────────────────

class StickyContentModal(discord.ui.Modal):
    """Modal for plain-text sticky create/edit."""
    def __init__(self, channel_id: str, existing: StickyMessage | None = None):
        super().__init__(title="Tạo Sticky Message" if not existing else "Chỉnh sửa Sticky")
        self.channel_id = channel_id
        self.existing = existing
        self.add_item(discord.ui.InputText(
            label="Nội dung",
            placeholder="Nhập nội dung sticky...",
            style=discord.InputTextStyle.paragraph,
            max_length=2000,
            required=True,
            value=existing.content if existing and existing.content else "",
        ))

    async def callback(self, interaction: discord.Interaction):
        content = self.children[0].value
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == self.channel_id)
            ).scalars().first()

            if sticky:
                sticky.content = content
                sticky.embed_enabled = False
                sticky.is_enabled = True
            else:
                sticky = StickyMessage(
                    guild_id=str(interaction.guild_id),
                    channel_id=self.channel_id,
                    content=content,
                    embed_enabled=False,
                    created_by=str(interaction.user.id),
                )
                session.add(sticky)
            session.commit()
            session.refresh(sticky)

            # Send first sticky immediately
            channel = interaction.guild.get_channel(int(self.channel_id))
            if channel:
                from src.bot.cogs.sticky import _do_resend
                await _do_resend(interaction.client, sticky, session)

            await interaction.response.send_message(
                f"✅ Đã tạo sticky cho <#{self.channel_id}>.", ephemeral=True
            )
        except Exception as e:
            logger.error(f"StickyContentModal error: {e}")
            await interaction.response.send_message("❌ Lỗi khi tạo sticky.", ephemeral=True)
        finally:
            session.close()


class StickyEmbedModal(discord.ui.Modal):
    """Modal for embed sticky."""
    def __init__(self, channel_id: str, existing: StickyMessage | None = None):
        super().__init__(title="Tạo Embed Sticky")
        self.channel_id = channel_id
        self.existing = existing
        self.add_item(discord.ui.InputText(
            label="Tiêu đề (Title)",
            placeholder="Nhập tiêu đề...",
            max_length=256,
            required=False,
            value=existing.embed_title if existing and existing.embed_title else "",
        ))
        self.add_item(discord.ui.InputText(
            label="Mô tả (Description)",
            placeholder="Nhập nội dung embed...",
            style=discord.InputTextStyle.paragraph,
            max_length=4000,
            required=True,
            value=existing.embed_description if existing and existing.embed_description else "",
        ))
        self.add_item(discord.ui.InputText(
            label="Footer",
            placeholder="Nhập footer...",
            max_length=2048,
            required=False,
            value=existing.embed_footer if existing and existing.embed_footer else "",
        ))
        self.add_item(discord.ui.InputText(
            label="Màu (hex, VD: #FF5733)",
            placeholder="#5865F2",
            max_length=10,
            required=False,
            value=existing.embed_color if existing and existing.embed_color else "#5865F2",
        ))

    async def callback(self, interaction: discord.Interaction):
        title = self.children[0].value or None
        description = self.children[1].value
        footer = self.children[2].value or None
        color = self.children[3].value or "#5865F2"

        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == self.channel_id)
            ).scalars().first()

            if sticky:
                sticky.embed_enabled = True
                sticky.embed_title = title
                sticky.embed_description = description
                sticky.embed_footer = footer
                sticky.embed_color = color
                sticky.is_enabled = True
            else:
                sticky = StickyMessage(
                    guild_id=str(interaction.guild_id),
                    channel_id=self.channel_id,
                    embed_enabled=True,
                    embed_title=title,
                    embed_description=description,
                    embed_footer=footer,
                    embed_color=color,
                    created_by=str(interaction.user.id),
                )
                session.add(sticky)
            session.commit()
            session.refresh(sticky)

            from src.bot.cogs.sticky import _do_resend
            await _do_resend(interaction.client, sticky, session)
            await interaction.response.send_message(
                f"✅ Đã tạo embed sticky cho <#{self.channel_id}>.", ephemeral=True
            )
        except Exception as e:
            logger.error(f"StickyEmbedModal error: {e}")
            await interaction.response.send_message("❌ Lỗi khi tạo embed sticky.", ephemeral=True)
        finally:
            session.close()
