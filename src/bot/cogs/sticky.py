# src/bot/cogs/sticky.py
"""
Sticky Message System — messages that stay at the bottom of a channel.
Auto-resend after N messages or after X minutes.
"""
import asyncio
import datetime
import logging
import discord
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import StickyMessage
from src.bot.base_cog import check_feature
from src.bot.cogs.sticky_modals import (
    get_session,
    _hex_to_int,
    StickyContentModal,
    StickyEmbedModal,
)

logger = logging.getLogger(__name__)


async def _build_sticky_message(sticky: StickyMessage):
    """Returns (content, embed) ready for channel.send()"""
    content = sticky.content or None
    embed = None
    if sticky.embed_enabled:
        embed = discord.Embed(
            title=sticky.embed_title or None,
            description=sticky.embed_description or None,
            color=_hex_to_int(sticky.embed_color),
        )
        if sticky.embed_footer:
            embed.set_footer(text=sticky.embed_footer)
        if sticky.embed_image_url:
            embed.set_image(url=sticky.embed_image_url)
        if sticky.embed_thumbnail_url:
            embed.set_thumbnail(url=sticky.embed_thumbnail_url)
        embed.timestamp = datetime.datetime.utcnow()
    return content, embed


async def _do_resend(bot: discord.Bot, sticky: StickyMessage, session) -> bool:
    """Delete old sticky message and send a new one. Returns True on success."""
    channel = bot.get_channel(int(sticky.channel_id))
    if not channel:
        try:
            channel = await bot.fetch_channel(int(sticky.channel_id))
        except Exception:
            return False

    # Delete old sticky
    if sticky.last_message_id:
        try:
            old = await channel.fetch_message(int(sticky.last_message_id))
            await old.delete()
        except Exception:
            pass

    content, embed = await _build_sticky_message(sticky)
    try:
        msg = await channel.send(content=content, embed=embed)
        sticky.last_message_id = str(msg.id)
        sticky.last_sent = datetime.datetime.utcnow()
        sticky.resend_count = (sticky.resend_count or 0) + 1
        sticky.current_count = 0
        session.commit()

        if sticky.is_pinned:
            try:
                await msg.pin()
            except Exception:
                pass
        return True
    except Exception as e:
        logger.error(f"_do_resend error ch={sticky.channel_id}: {e}")
        return False



# ── Cog ──────────────────────────────────────────────────────────────────────

class StickyCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        self._interval_task = None

    def cog_unload(self):
        if self._interval_task:
            self._interval_task.cancel()

    @discord.Cog.listener()
    async def on_ready(self):
        if not check_feature(self): return
        if self._interval_task is None or self._interval_task.done():
            self._interval_task = asyncio.get_event_loop().create_task(self._interval_loop())

    @discord.Cog.listener()
    async def on_message(self, message: discord.Message):
        if not check_feature(self): return
        """Detect new messages and resend sticky if trigger reached."""
        if message.author.bot:
            return
        if not message.guild:
            return

        channel_id = str(message.channel.id)
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(
                    StickyMessage.channel_id == channel_id,
                    StickyMessage.is_enabled == True,
                )
            ).scalars().first()

            if not sticky:
                return

            # Check expiry
            if sticky.expires_at and sticky.expires_at < datetime.datetime.utcnow():
                sticky.is_enabled = False
                session.commit()
                return

            # Increment message counter
            sticky.current_count = (sticky.current_count or 0) + 1

            # Check if trigger count reached
            trigger = sticky.message_count_trigger or 1
            if sticky.current_count >= trigger:
                session.commit()  # save count first
                await _do_resend(self.bot, sticky, session)
            else:
                session.commit()
        except Exception as e:
            logger.error(f"sticky on_message error: {e}")
        finally:
            session.close()

    async def _interval_loop(self):
        """Background task: resend stickies with interval_minutes set."""
        await self.bot.wait_until_ready()
        while not self.bot.is_closed():
            try:
                now = datetime.datetime.utcnow()
                session = get_session()
                try:
                    stickies = session.execute(
                        select(StickyMessage).where(
                            StickyMessage.is_enabled == True,
                            StickyMessage.interval_minutes > 0,
                        )
                    ).scalars().all()
                    for sticky in stickies:
                        if sticky.expires_at and sticky.expires_at < now:
                            sticky.is_enabled = False
                            session.commit()
                            conmessagesue
                        last = sticky.last_sent or sticky.created_at or now
                        delta = (now - last).total_seconds() / 60
                        if delta >= sticky.interval_minutes:
                            await _do_resend(self.bot, sticky, session)
                finally:
                    session.close()
            except Exception as e:
                logger.error(f"sticky interval_loop error: {e}")
            await asyncio.sleep(60)  # check every minute

    # ── Slash command group ──────────────────────────────────────────────────

    sticky = discord.SlashCommandGroup(
        "sticky",
        "Manage sticky messages",
        default_member_permissions=discord.Permissions(manage_channels=True),
    )

    # ── CREATE ───────────────────────────────────────────────────────────────

    @sticky.command(name="create", description="Create a text sticky message for channel")
    async def sticky_create(
        self,
        ctx: discord.ApplicationContext,
        channel: discord.Option(discord.TextChannel, "Channel to attach sticky to", required=False),
    ):
        ch = channel or ctx.channel
        await ctx.send_modal(StickyContentModal(channel_id=str(ch.id)))

    @sticky.command(name="embed", description="Create an embed sticky message for channel")
    async def sticky_embed(
        self,
        ctx: discord.ApplicationContext,
        channel: discord.Option(discord.TextChannel, "Channel to attach sticky to", required=False),
    ):
        ch = channel or ctx.channel
        session = get_session()
        exismessagesg = None
        try:
            exismessagesg = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(ch.id))
            ).scalars().first()
        finally:
            session.close()
        await ctx.send_modal(StickyEmbedModal(channel_id=str(ch.id), exismessagesg=exismessagesg))

    # ── EDIT ─────────────────────────────────────────────────────────────────

    @sticky.command(name="edit", description="Edit exismessagesg sticky content")
    async def sticky_edit(
        self,
        ctx: discord.ApplicationContext,
        channel: discord.Option(discord.TextChannel, "Channel with sticky", required=False),
    ):
        ch = channel or ctx.channel
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(ch.id))
            ).scalars().first()
            if not sticky:
                await ctx.respond(f"❌ No sticky in <#{ch.id}>.", ephemeral=True)
                return
            if sticky.embed_enabled:
                await ctx.send_modal(StickyEmbedModal(str(ch.id), exismessagesg=sticky))
            else:
                await ctx.send_modal(StickyContentModal(str(ch.id), exismessagesg=sticky))
        finally:
            session.close()

    # ── REMOVE ───────────────────────────────────────────────────────────────

    @sticky.command(name="remove", description="Remove sticky from channel")
    async def sticky_remove(
        self,
        ctx: discord.ApplicationContext,
        channel: discord.Option(discord.TextChannel, "Channel with sticky", required=False),
    ):
        ch = channel or ctx.channel
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(ch.id))
            ).scalars().first()
            if not sticky:
                await ctx.followup.send(f"❌ No sticky in <#{ch.id}>.")
                return
            # Delete the sticky message from Discord
            if sticky.last_message_id:
                try:
                    msg = await ch.fetch_message(int(sticky.last_message_id))
                    await msg.delete()
                except Exception:
                    pass
            session.delete(sticky)
            session.commit()
            await ctx.followup.send(f"✅ Deleted sticky in <#{ch.id}>.")
        finally:
            session.close()

    # ── ENABLE / DISABLE ─────────────────────────────────────────────────────

    @sticky.command(name="enable", description="Enable sticky in channel")
    async def sticky_enable(
        self,
        ctx: discord.ApplicationContext,
        channel: discord.Option(discord.TextChannel, "Channel", required=False),
    ):
        ch = channel or ctx.channel
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(ch.id))
            ).scalars().first()
            if not sticky:
                await ctx.followup.send(f"❌ Sticky not found in <#{ch.id}>.")
                return
            sticky.is_enabled = True
            session.commit()
            await _do_resend(self.bot, sticky, session)
            await ctx.followup.send(f"✅ Enabled sticky <#{ch.id}>.")
        finally:
            session.close()

    @sticky.command(name="disable", description="Disable sticky in channel (does not delete)")
    async def sticky_disable(
        self,
        ctx: discord.ApplicationContext,
        channel: discord.Option(discord.TextChannel, "Channel", required=False),
    ):
        ch = channel or ctx.channel
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(ch.id))
            ).scalars().first()
            if not sticky:
                await ctx.followup.send(f"❌ Sticky not found in <#{ch.id}>.")
                return
            sticky.is_enabled = False
            # Delete the pinned message
            if sticky.last_message_id:
                try:
                    msg = await ch.fetch_message(int(sticky.last_message_id))
                    await msg.delete()
                except Exception:
                    pass
                sticky.last_message_id = None
            session.commit()
            await ctx.followup.send(f"⏸ Disabled sticky <#{ch.id}>.")
        finally:
            session.close()

    # ── LIST ─────────────────────────────────────────────────────────────────

    @sticky.command(name="list", description="List all sticky messages in server")
    async def sticky_list(self, ctx: discord.ApplicationContext):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            stickies = session.execute(
                select(StickyMessage).where(StickyMessage.guild_id == str(ctx.guild_id))
            ).scalars().all()
            if not stickies:
                await ctx.followup.send("📋 No stickies in this server yet.")
                return
            embed = discord.Embed(
                title=f"📌 Sticky List — {ctx.guild.name}",
                color=0x5865F2,
            )
            for s in stickies[:20]:
                status = "✅" if s.is_enabled else "⏸"
                stype = "Embed" if s.embed_enabled else "Text"
                trigger_info = f"every {s.message_count_trigger} messages"
                if s.interval_minutes:
                    trigger_info += f" | {s.interval_minutes}p"
                embed.add_field(
                    name=f"{status} <#{s.channel_id}>",
                    value=f"`{stype}` · {trigger_info} · Sent: {s.resend_count}",
                    inline=False,
                )
            await ctx.followup.send(embed=embed)
        finally:
            session.close()

    # ── VIEW ─────────────────────────────────────────────────────────────────

    @sticky.command(name="view", description="View current sticky in channel")
    async def sticky_view(
        self,
        ctx: discord.ApplicationContext,
        channel: discord.Option(discord.TextChannel, "Channel", required=False),
    ):
        ch = channel or ctx.channel
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(ch.id))
            ).scalars().first()
            if not sticky:
                await ctx.followup.send(f"❌ No sticky in <#{ch.id}>.")
                return
            status = "✅ Enabled" if sticky.is_enabled else "⏸ Disabled"
            stype = "Embed" if sticky.embed_enabled else "Text"
            info = discord.Embed(
                title=f"📌 Sticky — #{ch.name}",
                color=_hex_to_int(sticky.embed_color if sticky.embed_enabled else "#5865F2"),
            )
            info.add_field(name="Status", value=status, inline=True)
            info.add_field(name="Type", value=stype, inline=True)
            info.add_field(name="Sent", value=str(sticky.resend_count), inline=True)
            info.add_field(name="Trigger", value=f"After {sticky.message_count_trigger} messages", inline=True)
            if sticky.interval_minutes:
                info.add_field(name="Interval", value=f"{sticky.interval_minutes} minutes", inline=True)
            if sticky.expires_at:
                info.add_field(name="Expires", value=sticky.expires_at.strftime("%d/%m/%Y %H:%M"), inline=True)
            if sticky.content:
                info.add_field(name="Content", value=sticky.content[:1024], inline=False)
            elif sticky.embed_title:
                info.add_field(name="Embed Title", value=sticky.embed_title, inline=False)
            await ctx.followup.send(embed=info)
        finally:
            session.close()

    # ── CLEAR ────────────────────────────────────────────────────────────────

    @sticky.command(name="clear", description="Delete ALL sticky messages in server")
    @discord.default_permissions(administrator=True)
    async def sticky_clear(self, ctx: discord.ApplicationContext):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            stickies = session.execute(
                select(StickyMessage).where(StickyMessage.guild_id == str(ctx.guild_id))
            ).scalars().all()
            count = len(stickies)
            for s in stickies:
                if s.last_message_id:
                    ch = ctx.guild.get_channel(int(s.channel_id))
                    if ch:
                        try:
                            msg = await ch.fetch_message(int(s.last_message_id))
                            await msg.delete()
                        except Exception:
                            pass
                session.delete(s)
            session.commit()
            await ctx.followup.send(f"🗑️ Deleted {count} sticky.")
        finally:
            session.close()

    # ── INTERVAL ─────────────────────────────────────────────────────────────

    @sticky.command(name="interval", description="Re-send sticky every X minutes (0 = off)")
    async def sticky_interval(
        self,
        ctx: discord.ApplicationContext,
        minutes: discord.Option(int, "Minutes (0 to disable)", min_value=0, max_value=10080),
        channel: discord.Option(discord.TextChannel, "Channel", required=False),
    ):
        ch = channel or ctx.channel
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(ch.id))
            ).scalars().first()
            if not sticky:
                await ctx.followup.send(f"❌ Sticky not found in <#{ch.id}>.")
                return
            sticky.interval_minutes = minutes
            session.commit()
            if minutes:
                await ctx.followup.send(f"✅ Sticky <#{ch.id}> will resend every **{minutes} minutes**.")
            else:
                await ctx.followup.send(f"✅ Disabled interval resend for <#{ch.id}>.")
        finally:
            session.close()

    # ── MESSAGES (count trigger) ──────────────────────────────────────────────

    @sticky.command(name="messages", description="Re-send sticky every X new messages")
    async def sticky_messages(
        self,
        ctx: discord.ApplicationContext,
        count: discord.Option(int, "Message count (default 1)", min_value=1, max_value=500),
        channel: discord.Option(discord.TextChannel, "Channel", required=False),
    ):
        ch = channel or ctx.channel
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(ch.id))
            ).scalars().first()
            if not sticky:
                await ctx.followup.send(f"❌ Sticky not found in <#{ch.id}>.")
                return
            sticky.message_count_trigger = count
            session.commit()
            await ctx.followup.send(f"✅ Sticky <#{ch.id}> will resend every **{count} messages**.")
        finally:
            session.close()

    # ── COLOR ─────────────────────────────────────────────────────────────────

    @sticky.command(name="color", description="Change sticky embed color")
    async def sticky_color(
        self,
        ctx: discord.ApplicationContext,
        color: discord.Option(str, "Hex color code, e.g. #FF5733"),
        channel: discord.Option(discord.TextChannel, "Channel", required=False),
    ):
        ch = channel or ctx.channel
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(ch.id))
            ).scalars().first()
            if not sticky:
                await ctx.followup.send(f"❌ Sticky not found in <#{ch.id}>.")
                return
            sticky.embed_color = color if color.startswith("#") else f"#{color}"
            session.commit()
            await _do_resend(self.bot, sticky, session)
            await ctx.followup.send(f"✅ Changed sticky color in <#{ch.id}> to `{color}`.")
        finally:
            session.close()

    # ── IMAGE ─────────────────────────────────────────────────────────────────

    @sticky.command(name="image", description="Set image for sticky embed")
    async def sticky_image(
        self,
        ctx: discord.ApplicationContext,
        url: discord.Option(str, "Image URL (leave empty to remove)", required=False, default=""),
        channel: discord.Option(discord.TextChannel, "Channel", required=False),
    ):
        ch = channel or ctx.channel
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(ch.id))
            ).scalars().first()
            if not sticky:
                await ctx.followup.send(f"❌ Sticky not found in <#{ch.id}>.")
                return
            sticky.embed_image_url = url or None
            session.commit()
            await _do_resend(self.bot, sticky, session)
            await ctx.followup.send("✅ Updated sticky image.")
        finally:
            session.close()

    # ── THUMBNAIL ─────────────────────────────────────────────────────────────

    @sticky.command(name="thumbnail", description="Set thumbnail for sticky embed")
    async def sticky_thumbnail(
        self,
        ctx: discord.ApplicationContext,
        url: discord.Option(str, "Thumbnail URL (leave empty to remove)", required=False, default=""),
        channel: discord.Option(discord.TextChannel, "Channel", required=False),
    ):
        ch = channel or ctx.channel
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(ch.id))
            ).scalars().first()
            if not sticky:
                await ctx.followup.send(f"❌ Sticky not found in <#{ch.id}>.")
                return
            sticky.embed_thumbnail_url = url or None
            session.commit()
            await _do_resend(self.bot, sticky, session)
            await ctx.followup.send("✅ Updated thumbnail sticky.")
        finally:
            session.close()

    # ── FOOTER ────────────────────────────────────────────────────────────────

    @sticky.command(name="footer", description="Set footer for sticky embed")
    async def sticky_footer(
        self,
        ctx: discord.ApplicationContext,
        text: discord.Option(str, "Footer text (leave empty to remove)", required=False, default=""),
        channel: discord.Option(discord.TextChannel, "Channel", required=False),
    ):
        ch = channel or ctx.channel
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(ch.id))
            ).scalars().first()
            if not sticky:
                await ctx.followup.send(f"❌ Sticky not found in <#{ch.id}>.")
                return
            sticky.embed_footer = text or None
            session.commit()
            await _do_resend(self.bot, sticky, session)
            await ctx.followup.send("✅ Updated footer sticky.")
        finally:
            session.close()

    # ── PIN / UNPIN ──────────────────────────────────────────────────────────

    @sticky.command(name="pin", description="Pin sticky message (requires Manage Messages)")
    async def sticky_pin(
        self,
        ctx: discord.ApplicationContext,
        channel: discord.Option(discord.TextChannel, "Channel", required=False),
    ):
        ch = channel or ctx.channel
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(ch.id))
            ).scalars().first()
            if not sticky:
                await ctx.followup.send(f"❌ Sticky not found in <#{ch.id}>.")
                return
            sticky.is_pinned = True
            session.commit()
            # Pin current message
            if sticky.last_message_id:
                try:
                    msg = await ch.fetch_message(int(sticky.last_message_id))
                    await msg.pin()
                except Exception:
                    pass
            await ctx.followup.send(f"📌 Pinned sticky <#{ch.id}>.")
        finally:
            session.close()

    @sticky.command(name="unpin", description="Unpin sticky message")
    async def sticky_unpin(
        self,
        ctx: discord.ApplicationContext,
        channel: discord.Option(discord.TextChannel, "Channel", required=False),
    ):
        ch = channel or ctx.channel
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(ch.id))
            ).scalars().first()
            if not sticky:
                await ctx.followup.send(f"❌ Sticky not found in <#{ch.id}>.")
                return
            sticky.is_pinned = False
            session.commit()
            if sticky.last_message_id:
                try:
                    msg = await ch.fetch_message(int(sticky.last_message_id))
                    await msg.unpin()
                except Exception:
                    pass
            await ctx.followup.send(f"Unpinned sticky <#{ch.id}>.")
        finally:
            session.close()

    # ── SYNC (force resend all) ───────────────────────────────────────────────

    @sticky.command(name="sync", description="Re-send ALL sticky messages now")
    @discord.default_permissions(administrator=True)
    async def sticky_sync(self, ctx: discord.ApplicationContext):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            stickies = session.execute(
                select(StickyMessage).where(
                    StickyMessage.guild_id == str(ctx.guild_id),
                    StickyMessage.is_enabled == True,
                )
            ).scalars().all()
            count = 0
            for s in stickies:
                ok = await _do_resend(self.bot, s, session)
                if ok:
                    count += 1
            await ctx.followup.send(f"✅ Resent **{count}/{len(stickies)}** sticky.")
        finally:
            session.close()

    # ── EXPIRE ───────────────────────────────────────────────────────────────

    @sticky.command(name="expire", description="Set auto-delete timer for sticky (e.g. 60 = 60 minutes)")
    async def sticky_expire(
        self,
        ctx: discord.ApplicationContext,
        minutes: discord.Option(int, "Minutes to live (0 = unlimited)", min_value=0),
        channel: discord.Option(discord.TextChannel, "Channel", required=False),
    ):
        ch = channel or ctx.channel
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(ch.id))
            ).scalars().first()
            if not sticky:
                await ctx.followup.send(f"❌ Sticky not found in <#{ch.id}>.")
                return
            if minutes == 0:
                sticky.expires_at = None
                msg_text = f"✅ Cleared expiration for sticky <#{ch.id}>."
            else:
                sticky.expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=minutes)
                msg_text = f"⏰ Sticky <#{ch.id}> will auto-disable after **{minutes} minutes**."
            session.commit()
            await ctx.followup.send(msg_text)
        finally:
            session.close()

    # ── MOVE / COPY ───────────────────────────────────────────────────────────

    @sticky.command(name="move", description="Move sticky to another channel")
    async def sticky_move(
        self,
        ctx: discord.ApplicationContext,
        source: discord.Option(discord.TextChannel, "Source channel"),
        target: discord.Option(discord.TextChannel, "Target channel"),
    ):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(source.id))
            ).scalars().first()
            if not sticky:
                await ctx.followup.send(f"❌ Sticky not found in <#{source.id}>.")
                return
            # Check target doesn't have sticky
            exismessagesg_target = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(target.id))
            ).scalars().first()
            if exismessagesg_target:
                await ctx.followup.send(f"❌ <#{target.id}> already has a sticky. Use `/sticky remove` first.")
                return
            # Delete old from source
            if sticky.last_message_id:
                try:
                    msg = await source.fetch_message(int(sticky.last_message_id))
                    await msg.delete()
                except Exception:
                    pass
            sticky.channel_id = str(target.id)
            sticky.last_message_id = None
            sticky.current_count = 0
            session.commit()
            await _do_resend(self.bot, sticky, session)
            await ctx.followup.send(f"✅ Moved sticky from <#{source.id}> to <#{target.id}>.")
        finally:
            session.close()

    @sticky.command(name="copy", description="Copy sticky to another channel")
    async def sticky_copy(
        self,
        ctx: discord.ApplicationContext,
        source: discord.Option(discord.TextChannel, "Source channel"),
        target: discord.Option(discord.TextChannel, "Target channel"),
    ):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            sticky = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(source.id))
            ).scalars().first()
            if not sticky:
                await ctx.followup.send(f"❌ Sticky not found in <#{source.id}>.")
                return
            exismessagesg_target = session.execute(
                select(StickyMessage).where(StickyMessage.channel_id == str(target.id))
            ).scalars().first()
            if exismessagesg_target:
                await ctx.followup.send(f"❌ <#{target.id}> already has a sticky.")
                return
            new_sticky = StickyMessage(
                guild_id=sticky.guild_id,
                channel_id=str(target.id),
                content=sticky.content,
                embed_enabled=sticky.embed_enabled,
                embed_title=sticky.embed_title,
                embed_description=sticky.embed_description,
                embed_color=sticky.embed_color,
                embed_footer=sticky.embed_footer,
                embed_image_url=sticky.embed_image_url,
                embed_thumbnail_url=sticky.embed_thumbnail_url,
                message_count_trigger=sticky.message_count_trigger,
                interval_minutes=sticky.interval_minutes,
                is_enabled=True,
                created_by=str(ctx.author.id),
            )
            session.add(new_sticky)
            session.commit()
            session.refresh(new_sticky)
            await _do_resend(self.bot, new_sticky, session)
            await ctx.followup.send(f"✅ Copied sticky from <#{source.id}> to <#{target.id}>.")
        finally:
            session.close()

    # ── STATS ─────────────────────────────────────────────────────────────────

    @sticky.command(name="stats", description="View sticky statistics")
    async def sticky_stats(
        self,
        ctx: discord.ApplicationContext,
        channel: discord.Option(discord.TextChannel, "Specific channel (leave empty = whole server)", required=False),
    ):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            if channel:
                sticky = session.execute(
                    select(StickyMessage).where(StickyMessage.channel_id == str(channel.id))
                ).scalars().first()
                if not sticky:
                    await ctx.followup.send(f"❌ No sticky in <#{channel.id}>.")
                    return
                embed = discord.Embed(title=f"📊 Stats — #{channel.name}", color=0x5865F2)
                embed.add_field(name="Status", value="✅ On" if sticky.is_enabled else "⏸ Off", inline=True)
                embed.add_field(name="Sent", value=str(sticky.resend_count), inline=True)
                embed.add_field(name="Type", value="Embed" if sticky.embed_enabled else "Text", inline=True)
                embed.add_field(name="Trigger", value=f"After {sticky.message_count_trigger} messages", inline=True)
                if sticky.interval_minutes:
                    embed.add_field(name="Interval", value=f"{sticky.interval_minutes}p", inline=True)
                if sticky.last_sent:
                    embed.add_field(name="Last sent", value=sticky.last_sent.strftime("%d/%m/%Y %H:%M"), inline=True)
            else:
                stickies = session.execute(
                    select(StickyMessage).where(StickyMessage.guild_id == str(ctx.guild_id))
                ).scalars().all()
                active = sum(1 for s in stickies if s.is_enabled)
                total_sends = sum(s.resend_count or 0 for s in stickies)
                embed = discord.Embed(title=f"📊 Sticky Stats — {ctx.guild.name}", color=0x5865F2)
                embed.add_field(name="Total stickies", value=str(len(stickies)), inline=True)
                embed.add_field(name="Active", value=str(active), inline=True)
                embed.add_field(name="Total sends", value=str(total_sends), inline=True)
                top = sorted(stickies, key=lambda s: s.resend_count or 0, reverse=True)[:5]
                if top:
                    embed.add_field(
                        name="Top channels",
                        value="\n".join(f"<#{s.channel_id}> — {s.resend_count} times" for s in top),
                        inline=False,
                    )
            await ctx.followup.send(embed=embed)
        finally:
            session.close()

    # ── CHANNEL (alias create for a specific channel) ─────────────────────────

    @sticky.command(name="channel", description="Create sticky for a specific channel")
    async def sticky_channel(
        self,
        ctx: discord.ApplicationContext,
        channel: discord.Option(discord.TextChannel, "Target channel"),
    ):
        await ctx.send_modal(StickyContentModal(channel_id=str(channel.id)))
