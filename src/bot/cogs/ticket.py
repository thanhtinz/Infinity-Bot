# src/bot/cogs/ticket.py
"""
Ticket System — hệ thống hỗ trợ đầy đủ.
/ticket group + /panel group + persistent views + auto-close task.
"""
import asyncio
import datetime
import logging
import discord
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import Ticket, TicketPanel, TicketConfig, TicketBlacklist, TicketNote, SystemConfig
from src.bot.embed_utils import build_embed
from src.bot.base_cog import check_feature

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

# ── Cog ──────────────────────────────────────────────────────────────────────

class TicketCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        self._auto_close_task = None

    def cog_unload(self):
        if self._auto_close_task:
            self._auto_close_task.cancel()

    @discord.Cog.listener()
    async def on_ready(self):
        if not check_feature(self): return
        # Register persistent panel views
        session = get_session()
        try:
            panels = session.execute(
                select(TicketPanel).where(TicketPanel.message_id.isnot(None))
            ).scalars().all()
            for p in panels:
                try:
                    self.bot.add_view(PanelView(p))
                except Exception:
                    pass
        finally:
            session.close()

        if self._auto_close_task is None or self._auto_close_task.done():
            self._auto_close_task = asyncio.get_event_loop().create_task(self._auto_close_loop())

    async def _auto_close_loop(self):
        await self.bot.wait_until_ready()
        while not self.bot.is_closed():
            try:
                session = get_session()
                try:
                    # Get all guilds with auto_close_hours > 0
                    configs = session.execute(
                        select(TicketConfig).where(TicketConfig.auto_close_hours > 0)
                    ).scalars().all()
                    now = datetime.datetime.utcnow()
                    for cfg in configs:
                        cutoff = now - datetime.timedelta(hours=cfg.auto_close_hours)
                        old_tickets = session.execute(
                            select(Ticket).where(
                                Ticket.guild_id == cfg.guild_id,
                                Ticket.status == "open",
                                Ticket.created_at <= cutoff,
                            )
                        ).scalars().all()
                        for t in old_tickets:
                            t.status = "closed"
                            t.closed_at = now
                            t.close_reason = f"Tự động đóng sau {cfg.auto_close_hours}h không hoạt động"
                            # Notify in ticket channel
                            if t.channel_id:
                                ch = self.bot.get_channel(int(t.channel_id))
                                if ch:
                                    try:
                                        embed = discord.Embed(
                                            title="⏰ Ticket tự động đóng",
                                            description=f"Ticket đã bị đóng tự động do không hoạt động sau {cfg.auto_close_hours} giờ.",
                                            color=0xFEE75C,
                                        )
                                        await ch.send(embed=embed)
                                        try:
                                            if not ch.name.startswith("closed-"):
                                                await ch.edit(name=f"closed-{ch.name[:90]}")
                                        except Exception:
                                            pass
                                    except Exception:
                                        pass
                    if any(configs):
                        session.commit()
                finally:
                    session.close()
            except Exception as e:
                logger.error(f"_auto_close_loop: {e}")
            await asyncio.sleep(1800)  # check every 30 minutes

    # ── /ticket group ──────────────────────────────────────────────────────────

    ticket = discord.SlashCommandGroup(
        "ticket", "Hệ thống ticket hỗ trợ",
        default_member_permissions=discord.Permissions(manage_guild=True),
    )

    @ticket.command(name="create", description="Tạo ticket hỗ trợ mới")
    async def ticket_create(
        self,
        ctx: discord.ApplicationContext,
        subject: discord.Option(str, "Chủ đề ticket", required=False, default=None),
    ):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            guild_id = str(ctx.guild_id)
            creator_id = str(ctx.author.id)

            bl = session.execute(
                select(TicketBlacklist).where(
                    TicketBlacklist.guild_id == guild_id,
                    TicketBlacklist.discord_id == creator_id,
                )
            ).scalars().first()
            if bl:
                await ctx.followup.send(f"❌ Bạn bị cấm tạo ticket. Lý do: {bl.reason or '—'}")
                return

            cfg = _get_config(session, guild_id)
            limit = cfg.ticket_limit if cfg else 1
            open_tickets = session.execute(
                select(Ticket).where(
                    Ticket.guild_id == guild_id,
                    Ticket.creator_id == creator_id,
                    Ticket.status == "open",
                )
            ).scalars().all()
            if len(open_tickets) >= limit:
                extra = f" Xem: <#{open_tickets[0].channel_id}>" if open_tickets[0].channel_id else ""
                await ctx.followup.send(f"❌ Bạn đã đạt giới hạn **{limit}** ticket mở.{extra}")
                return

            ticket = Ticket(guild_id=guild_id, creator_id=creator_id,
                            subject=subject, status="open")
            session.add(ticket)
            session.commit()
            session.refresh(ticket)

            ch = await _make_channel(ctx.guild, ctx.author, cfg, None, subject, ticket.id)
            if not ch:
                session.delete(ticket)
                session.commit()
                await ctx.followup.send("❌ Không tạo được kênh. Kiểm tra quyền bot?")
                return

            ticket.channel_id = str(ch.id)
            if subject:
                ticket.subject = subject
            session.commit()

            embed = build_embed("ticket_mo", session, vars={
                "ticket.id": str(ticket.id), "user": ctx.author.display_name,
                "user.mention": ctx.author.mention, "user.id": str(ctx.author.id),
                "ticket.subject": subject or "",
            })
            await ch.send(content=ctx.author.mention, embed=embed,
                          view=TicketControlView(ticket.id))
            await ctx.followup.send(f"✅ Ticket đã tạo: {ch.mention}")
            await _log_ticket(self.bot, "open", ticket, ctx.author, subject or "")
        finally:
            session.close()

    @ticket.command(name="close", description="Đóng ticket hiện tại")
    @discord.default_permissions(manage_channels=True)
    async def ticket_close(
        self,
        ctx: discord.ApplicationContext,
        reason: discord.Option(str, "Lý do đóng", required=False, default=None),
    ):
        await ctx.defer()
        session = get_session()
        try:
            ticket = session.execute(
                select(Ticket).where(
                    Ticket.channel_id == str(ctx.channel_id),
                    Ticket.status == "open",
                )
            ).scalars().first()
            if not ticket:
                await ctx.followup.send("❌ Kênh này không phải ticket đang mở.", ephemeral=True)
                return
            ticket.status = "closed"
            ticket.closed_at = datetime.datetime.utcnow()
            ticket.close_reason = reason or f"Đóng bởi {ctx.author.display_name}"
            session.commit()

            try:
                if not ctx.channel.name.startswith("closed-"):
                    await ctx.channel.edit(name=f"closed-{ctx.channel.name[:90]}")
            except Exception:
                pass
            try:
                creator = ctx.guild.get_member(int(ticket.creator_id))
                if creator:
                    await ctx.channel.set_permissions(creator, send_messages=False)
            except Exception:
                pass

            embed = build_embed("ticket_dong", session, vars={
                "ticket.id": str(ticket.id), "closer.mention": ctx.author.mention,
                "reason": reason or "", "duration": "",
            })
            await ctx.followup.send(embed=embed, view=_ReopenDeleteView(ticket.id))
            await _log_ticket(self.bot, "close", ticket, ctx.author, reason or "")
        finally:
            session.close()

    @ticket.command(name="reopen", description="Mở lại ticket đã đóng")
    @discord.default_permissions(manage_channels=True)
    async def ticket_reopen(self, ctx: discord.ApplicationContext):
        await ctx.defer()
        session = get_session()
        try:
            ticket = session.execute(
                select(Ticket).where(
                    Ticket.channel_id == str(ctx.channel_id),
                    Ticket.status == "closed",
                )
            ).scalars().first()
            if not ticket:
                await ctx.followup.send("❌ Kênh này không phải ticket đã đóng.", ephemeral=True)
                return
            ticket.status = "open"
            ticket.closed_at = None
            session.commit()
            try:
                if ctx.channel.name.startswith("closed-"):
                    await ctx.channel.edit(name=ctx.channel.name[7:])
            except Exception:
                pass
            try:
                creator = ctx.guild.get_member(int(ticket.creator_id))
                if creator:
                    await ctx.channel.set_permissions(creator, read_messages=True, send_messages=True)
            except Exception:
                pass
            embed = discord.Embed(title="🔓 Ticket đã mở lại",
                                  description=f"Mở lại bởi {ctx.author.mention}",
                                  color=0x57F287, timestamp=datetime.datetime.utcnow())
            await ctx.followup.send(embed=embed)
            await _log_ticket(self.bot, "reopen", ticket, ctx.author)
        finally:
            session.close()

    @ticket.command(name="delete", description="Xóa kênh ticket này vĩnh viễn")
    @discord.default_permissions(administrator=True)
    async def ticket_delete(self, ctx: discord.ApplicationContext):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            ticket = session.execute(
                select(Ticket).where(Ticket.channel_id == str(ctx.channel_id))
            ).scalars().first()
            if ticket:
                ticket.status = "deleted"
                session.commit()
                await _log_ticket(self.bot, "delete", ticket, ctx.author)
            await ctx.followup.send("🗑️ Đang xóa kênh...")
            await asyncio.sleep(3)
            await ctx.channel.delete()
        except Exception as e:
            logger.error(f"ticket delete: {e}")
        finally:
            session.close()

    @ticket.command(name="rename", description="Đổi tên kênh ticket")
    @discord.default_permissions(manage_channels=True)
    async def ticket_rename(
        self,
        ctx: discord.ApplicationContext,
        name: discord.Option(str, "Tên mới"),
    ):
        await ctx.defer()
        try:
            await ctx.channel.edit(name=name[:100])
            session = get_session()
            try:
                ticket = session.execute(
                    select(Ticket).where(Ticket.channel_id == str(ctx.channel_id))
                ).scalars().first()
                if ticket:
                    ticket.subject = name
                    session.commit()
            finally:
                session.close()
            await ctx.followup.send(f"✅ Đã đổi tên kênh thành `{name}`.")
        except discord.Forbidden:
            await ctx.followup.send("❌ Bot thiếu quyền đổi tên kênh.")

    @ticket.command(name="claim", description="Nhận xử lý ticket này")
    @discord.default_permissions(manage_channels=True)
    async def ticket_claim(self, ctx: discord.ApplicationContext):
        await ctx.defer()
        session = get_session()
        try:
            ticket = session.execute(
                select(Ticket).where(Ticket.channel_id == str(ctx.channel_id))
            ).scalars().first()
            if not ticket:
                await ctx.followup.send("❌ Kênh này không phải ticket.")
                return
            ticket.claimed_by = str(ctx.author.id)
            session.commit()
            embed = build_embed("ticket_nhan", session, vars={
                "ticket.id": str(ticket.id), "staff.mention": ctx.author.mention,
                "staff.name": ctx.author.display_name,
            })
            await ctx.followup.send(embed=embed)
            await _log_ticket(self.bot, "claim", ticket, ctx.author)
        finally:
            session.close()

    @ticket.command(name="unclaim", description="Bỏ claim ticket này")
    @discord.default_permissions(manage_channels=True)
    async def ticket_unclaim(self, ctx: discord.ApplicationContext):
        await ctx.defer()
        session = get_session()
        try:
            ticket = session.execute(
                select(Ticket).where(Ticket.channel_id == str(ctx.channel_id))
            ).scalars().first()
            if not ticket:
                await ctx.followup.send("❌ Kênh này không phải ticket.")
                return
            ticket.claimed_by = None
            session.commit()
            embed = build_embed("ticket_unclaim", session, vars={
                "ticket.id": str(ticket.id), "staff.mention": ctx.author.mention,
            })
            await ctx.followup.send(embed=embed)
        finally:
            session.close()

    @ticket.command(name="add", description="Thêm người dùng vào ticket")
    @discord.default_permissions(manage_channels=True)
    async def ticket_add(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Người dùng cần thêm"),
    ):
        await ctx.defer()
        try:
            await ctx.channel.set_permissions(
                user, read_messages=True, send_messages=True, read_message_history=True
            )
            session = get_session()
            try:
                ticket = session.execute(
                    select(Ticket).where(Ticket.channel_id == str(ctx.channel_id))
                ).scalars().first()
                if ticket:
                    members = ticket.members or []
                    if str(user.id) not in members:
                        members.append(str(user.id))
                    ticket.members = members
                    session.commit()
            finally:
                session.close()
            await ctx.followup.send(f"✅ Đã thêm {user.mention} vào ticket.")
        except discord.Forbidden:
            await ctx.followup.send("❌ Bot thiếu quyền.")

    @ticket.command(name="remove", description="Xóa người dùng khỏi ticket")
    @discord.default_permissions(manage_channels=True)
    async def ticket_remove(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Người dùng cần xóa"),
    ):
        await ctx.defer()
        try:
            await ctx.channel.set_permissions(user, overwrite=None)
            session = get_session()
            try:
                ticket = session.execute(
                    select(Ticket).where(Ticket.channel_id == str(ctx.channel_id))
                ).scalars().first()
                if ticket:
                    members = [m for m in (ticket.members or []) if m != str(user.id)]
                    ticket.members = members
                    session.commit()
            finally:
                session.close()
            await ctx.followup.send(f"✅ Đã xóa {user.mention} khỏi ticket.")
        except discord.Forbidden:
            await ctx.followup.send("❌ Bot thiếu quyền.")

    @ticket.command(name="priority", description="Đặt độ ưu tiên ticket")
    @discord.default_permissions(manage_channels=True)
    async def ticket_priority(
        self,
        ctx: discord.ApplicationContext,
        level: discord.Option(str, "Mức ưu tiên",
                               choices=["low", "normal", "high", "urgent"]),
    ):
        await ctx.defer()
        session = get_session()
        try:
            ticket = session.execute(
                select(Ticket).where(Ticket.channel_id == str(ctx.channel_id))
            ).scalars().first()
            if not ticket:
                await ctx.followup.send("❌ Không tìm thấy ticket.")
                return
            ticket.priority = level
            session.commit()
            label = PRIORITY_LABELS.get(level, level)
            color = PRIORITY_COLORS.get(level, 0x5865F2)
            embed = discord.Embed(
                description=f"🏷️ Độ ưu tiên đặt thành **{label}** bởi {ctx.author.mention}",
                color=color,
            )
            await ctx.followup.send(embed=embed)
        finally:
            session.close()

    @ticket.command(name="transfer", description="Chuyển ticket cho staff khác")
    @discord.default_permissions(manage_channels=True)
    async def ticket_transfer(
        self,
        ctx: discord.ApplicationContext,
        staff: discord.Option(discord.Member, "Staff nhận ticket"),
    ):
        await ctx.defer()
        session = get_session()
        try:
            ticket = session.execute(
                select(Ticket).where(Ticket.channel_id == str(ctx.channel_id))
            ).scalars().first()
            if not ticket:
                await ctx.followup.send("❌ Không tìm thấy ticket.")
                return
            ticket.claimed_by = str(staff.id)
            session.commit()
            await ctx.followup.send(f"↪️ Đã chuyển ticket cho {staff.mention}.")
            await _log_ticket(self.bot, "transfer", ticket, ctx.author, f"→ {staff.display_name}")
        finally:
            session.close()

    @ticket.command(name="blacklist", description="Cấm người dùng tạo ticket")
    @discord.default_permissions(administrator=True)
    async def ticket_blacklist(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Người dùng"),
        reason: discord.Option(str, "Lý do", required=False, default=None),
    ):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            existing = session.execute(
                select(TicketBlacklist).where(
                    TicketBlacklist.guild_id == str(ctx.guild_id),
                    TicketBlacklist.discord_id == str(user.id),
                )
            ).scalars().first()
            if existing:
                await ctx.followup.send(f"⚠️ {user.mention} đã có trong blacklist.")
                return
            bl = TicketBlacklist(
                guild_id=str(ctx.guild_id), discord_id=str(user.id),
                reason=reason, added_by=str(ctx.author.id),
            )
            session.add(bl)
            session.commit()
            await ctx.followup.send(f"🚫 Đã thêm {user.mention} vào blacklist ticket.")
        finally:
            session.close()

    @ticket.command(name="whitelist", description="Bỏ cấm người dùng tạo ticket")
    @discord.default_permissions(administrator=True)
    async def ticket_whitelist(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Người dùng"),
    ):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            bl = session.execute(
                select(TicketBlacklist).where(
                    TicketBlacklist.guild_id == str(ctx.guild_id),
                    TicketBlacklist.discord_id == str(user.id),
                )
            ).scalars().first()
            if not bl:
                await ctx.followup.send(f"⚠️ {user.mention} không có trong blacklist.")
                return
            session.delete(bl)
            session.commit()
            await ctx.followup.send(f"✅ Đã bỏ {user.mention} khỏi blacklist.")
        finally:
            session.close()

    @ticket.command(name="notes", description="Xem / thêm ghi chú cho ticket")
    @discord.default_permissions(manage_channels=True)
    async def ticket_notes(
        self,
        ctx: discord.ApplicationContext,
        content: discord.Option(str, "Nội dung ghi chú (bỏ trống = xem)", required=False, default=None),
    ):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            ticket = session.execute(
                select(Ticket).where(Ticket.channel_id == str(ctx.channel_id))
            ).scalars().first()
            if not ticket:
                await ctx.followup.send("❌ Không tìm thấy ticket trong kênh này.")
                return

            if content:
                note = TicketNote(ticket_id=ticket.id, author_id=str(ctx.author.id), content=content)
                session.add(note)
                session.commit()
                await ctx.followup.send("📝 Đã lưu ghi chú.")
            else:
                notes = session.execute(
                    select(TicketNote).where(TicketNote.ticket_id == ticket.id)
                    .order_by(TicketNote.created_at.desc())
                ).scalars().all()
                if not notes:
                    await ctx.followup.send("📝 Chưa có ghi chú nào.")
                    return
                embed = discord.Embed(title=f"📝 Ghi chú — Ticket #{ticket.id}", color=0x5865F2)
                for n in notes[:10]:
                    embed.add_field(
                        name=f"<@{n.author_id}> — {n.created_at.strftime('%d/%m %H:%M')}",
                        value=n.content[:1024], inline=False,
                    )
                await ctx.followup.send(embed=embed)
        finally:
            session.close()

    @ticket.command(name="history", description="Xem lịch sử ticket của bạn hoặc người dùng khác")
    async def ticket_history(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Người dùng (mặc định là bạn)", required=False),
    ):
        await ctx.defer(ephemeral=True)
        target = user or ctx.author
        # Non-admins can only view own history
        if target.id != ctx.author.id and not ctx.author.guild_permissions.manage_channels:
            await ctx.followup.send("❌ Bạn chỉ có thể xem lịch sử của mình.")
            return
        session = get_session()
        try:
            tickets = session.execute(
                select(Ticket).where(
                    Ticket.guild_id == str(ctx.guild_id),
                    Ticket.creator_id == str(target.id),
                ).order_by(Ticket.created_at.desc())
            ).scalars().all()
            if not tickets:
                await ctx.followup.send(f"📋 {target.mention} chưa có ticket nào.")
                return
            embed = discord.Embed(title=f"📋 Lịch sử Ticket — {target.display_name}", color=0x5865F2)
            for t in tickets[:15]:
                status_icon = {"open": "🟢", "closed": "🔴", "deleted": "⚫"}.get(t.status, "⚪")
                ch_ref = f"<#{t.channel_id}>" if t.channel_id and t.status == "open" else f"#{t.id}"
                embed.add_field(
                    name=f"{status_icon} Ticket #{t.id} — {ch_ref}",
                    value=f"Tạo: {t.created_at.strftime('%d/%m/%Y')}" +
                          (f" | Đóng: {t.closed_at.strftime('%d/%m/%Y')}" if t.closed_at else ""),
                    inline=False,
                )
            embed.set_footer(text=f"Tổng: {len(tickets)} ticket")
            await ctx.followup.send(embed=embed)
        finally:
            session.close()

    @ticket.command(name="stats", description="Thống kê ticket")
    async def ticket_stats(self, ctx: discord.ApplicationContext):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            guild_id = str(ctx.guild_id)
            all_t = session.execute(select(Ticket).where(Ticket.guild_id == guild_id)).scalars().all()
            open_c = sum(1 for t in all_t if t.status == "open")
            closed_c = sum(1 for t in all_t if t.status == "closed")
            embed = discord.Embed(title="📊 Thống kê Ticket", color=0x5865F2)
            embed.add_field(name="Tổng", value=str(len(all_t)), inline=True)
            embed.add_field(name="🟢 Đang mở", value=str(open_c), inline=True)
            embed.add_field(name="🔴 Đã đóng", value=str(closed_c), inline=True)
            await ctx.followup.send(embed=embed)
        finally:
            session.close()

    @ticket.command(name="setup", description="Cấu hình hệ thống ticket cho server")
    @discord.default_permissions(administrator=True)
    async def ticket_setup(
        self,
        ctx: discord.ApplicationContext,
        category: discord.Option(discord.CategoryChannel, "Category chứa ticket channels", required=False),
        log_channel: discord.Option(discord.TextChannel, "Kênh ghi log ticket", required=False),
        support_role: discord.Option(discord.Role, "Role staff hỗ trợ", required=False),
        ticket_limit: discord.Option(int, "Max ticket mở cùng lúc / user", required=False, default=1, min_value=1, max_value=10),
        auto_close: discord.Option(int, "Tự đóng sau X giờ (0=tắt)", required=False, default=0, min_value=0),
    ):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            guild_id = str(ctx.guild_id)
            cfg = _get_config(session, guild_id)
            if not cfg:
                cfg = TicketConfig(guild_id=guild_id)
                session.add(cfg)

            if category:
                cfg.category_id = str(category.id)
            if log_channel:
                cfg.log_channel_id = str(log_channel.id)
            if support_role:
                roles = cfg.support_role_ids or []
                if str(support_role.id) not in roles:
                    roles.append(str(support_role.id))
                cfg.support_role_ids = roles
            if ticket_limit:
                cfg.ticket_limit = ticket_limit
            if auto_close is not None:
                cfg.auto_close_hours = auto_close

            session.commit()
            embed = discord.Embed(title="✅ Cấu hình Ticket đã lưu", color=0x57F287)
            if cfg.category_id:
                embed.add_field(name="Category", value=f"<#{cfg.category_id}>", inline=True)
            if cfg.log_channel_id:
                embed.add_field(name="Log channel", value=f"<#{cfg.log_channel_id}>", inline=True)
            embed.add_field(name="Limit / user", value=str(cfg.ticket_limit), inline=True)
            if cfg.auto_close_hours:
                embed.add_field(name="Auto-close", value=f"{cfg.auto_close_hours}h", inline=True)
            await ctx.followup.send(embed=embed)
        finally:
            session.close()

    @ticket.command(name="transcript", description="Xuất transcript kênh ticket hiện tại")
    @discord.default_permissions(manage_channels=True)
    async def ticket_transcript(self, ctx: discord.ApplicationContext):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            ticket = session.execute(
                select(Ticket).where(Ticket.channel_id == str(ctx.channel_id))
            ).scalars().first()
            if not ticket:
                await ctx.followup.send("❌ Kênh này không phải ticket.")
                return

            messages = []
            async for msg in ctx.channel.history(limit=200, oldest_first=True):
                ts = msg.created_at.strftime("%d/%m/%Y %H:%M")
                content = msg.content or ""
                if msg.embeds:
                    for emb in msg.embeds:
                        if emb.title:
                            content += f" [Embed: {emb.title}]"
                messages.append(f"[{ts}] {msg.author.display_name}: {content}")

            text = "\n".join(messages)
            text = f"=== Transcript Ticket #{ticket.id} ===\n" \
                   f"Tạo bởi: <@{ticket.creator_id}>\n" \
                   f"Thời gian: {ticket.created_at.strftime('%d/%m/%Y %H:%M')}\n\n" + text

            import io
            file = discord.File(
                io.BytesIO(text.encode("utf-8")),
                filename=f"transcript-ticket-{ticket.id}.txt",
            )
            await ctx.followup.send(f"📄 Transcript Ticket #{ticket.id}:", file=file)
        finally:
            session.close()

    # ── /panel group ───────────────────────────────────────────────────────────

    panel = discord.SlashCommandGroup(
        "panel", "Quản lý ticket panel",
        default_member_permissions=discord.Permissions(administrator=True),
    )

    @panel.command(name="create", description="Tạo ticket panel mới")
    async def panel_create(
        self,
        ctx: discord.ApplicationContext,
        name: discord.Option(str, "Tên panel"),
        title: discord.Option(str, "Tiêu đề embed", required=False, default="Hỗ trợ"),
        description: discord.Option(str, "Mô tả", required=False, default="Nhấn nút bên dưới để tạo ticket."),
        button_label: discord.Option(str, "Nhãn nút", required=False, default="Tạo Ticket"),
        button_style: discord.Option(str, "Style nút", required=False, default="primary",
                                      choices=["primary", "secondary", "success", "danger"]),
    ):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            p = TicketPanel(
                guild_id=str(ctx.guild_id),
                name=name, title=title, description=description,
                button_label=button_label, button_style=button_style,
            )
            session.add(p)
            session.commit()
            session.refresh(p)
            await ctx.followup.send(f"✅ Tạo panel **{name}** (ID: {p.id}). Dùng `/panel send` để gửi vào kênh.")
        finally:
            session.close()

    @panel.command(name="send", description="Gửi panel vào kênh")
    async def panel_send(
        self,
        ctx: discord.ApplicationContext,
        panel_id: discord.Option(int, "ID panel (xem /panel list)"),
        channel: discord.Option(discord.TextChannel, "Kênh gửi panel"),
    ):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            p = session.get(TicketPanel, panel_id)
            if not p or p.guild_id != str(ctx.guild_id):
                await ctx.followup.send("❌ Không tìm thấy panel.")
                return

            # Delete old message if exists
            if p.message_id and p.channel_id:
                try:
                    old_ch = ctx.guild.get_channel(int(p.channel_id))
                    if old_ch:
                        old_msg = await old_ch.fetch_message(int(p.message_id))
                        await old_msg.delete()
                except Exception:
                    pass

            embed = build_embed("ticket_panel", session, vars={
                "panel.name": p.name or "Hỗ trợ",
            })
            # Override with panel-specific title/desc/color if set
            if p.title:
                embed.title = p.title
            if p.description:
                embed.description = p.description
            if p.color:
                embed.color = _hex(p.color)
            view = PanelView(p)
            msg = await channel.send(embed=embed, view=view)

            p.channel_id = str(channel.id)
            p.message_id = str(msg.id)
            session.commit()

            # Register persistent view
            self.bot.add_view(view)
            await ctx.followup.send(f"✅ Đã gửi panel **{p.name}** vào {channel.mention}.")
        finally:
            session.close()

    @panel.command(name="list", description="Danh sách các panel")
    async def panel_list(self, ctx: discord.ApplicationContext):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            panels = session.execute(
                select(TicketPanel).where(TicketPanel.guild_id == str(ctx.guild_id))
            ).scalars().all()
            if not panels:
                await ctx.followup.send("📋 Chưa có panel nào.")
                return
            embed = discord.Embed(title="📋 Danh sách Ticket Panel", color=0x5865F2)
            for p in panels:
                status = f"<#{p.channel_id}>" if p.channel_id else "Chưa gửi"
                embed.add_field(
                    name=f"ID {p.id} — {p.name}",
                    value=f"Kênh: {status}\nNút: `{p.button_label}` ({p.button_style})",
                    inline=False,
                )
            await ctx.followup.send(embed=embed)
        finally:
            session.close()

    @panel.command(name="delete", description="Xóa panel")
    async def panel_delete(
        self,
        ctx: discord.ApplicationContext,
        panel_id: discord.Option(int, "ID panel"),
    ):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            p = session.get(TicketPanel, panel_id)
            if not p or p.guild_id != str(ctx.guild_id):
                await ctx.followup.send("❌ Không tìm thấy panel.")
                return
            if p.message_id and p.channel_id:
                try:
                    ch = ctx.guild.get_channel(int(p.channel_id))
                    if ch:
                        msg = await ch.fetch_message(int(p.message_id))
                        await msg.delete()
                except Exception:
                    pass
            session.delete(p)
            session.commit()
            await ctx.followup.send(f"✅ Đã xóa panel **{p.name}**.")
        finally:
            session.close()
