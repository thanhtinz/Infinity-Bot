# src/bot/cogs/temp_voice.py
import discord
import logging
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import TempVoiceConfig, TempVoiceRoom

logger = logging.getLogger(__name__)


def get_session():
    return SessionLocal()


def _get_room(session, channel_id: str):
    return session.execute(
        select(TempVoiceRoom).where(TempVoiceRoom.channel_id == channel_id)
    ).scalars().first()


class TempVoiceCog(discord.Cog):
    def __init__(self, bot):
        self.bot = bot

    # ── Events ──────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_voice_state_update(self, member: discord.Member, before, after):
        session = get_session()
        try:
            config = session.execute(
                select(TempVoiceConfig).where(
                    TempVoiceConfig.guild_id == str(member.guild.id),
                    TempVoiceConfig.enabled == True,
                )
            ).scalars().first()
            if not config or not config.join_channel_id:
                return

            # User join "Join to Create"
            if after.channel and str(after.channel.id) == config.join_channel_id:
                category = member.guild.get_channel(int(config.category_id)) if config.category_id else after.channel.category
                new_ch = await member.guild.create_voice_channel(
                    name=f"🎙 {member.display_name}",
                    category=category,
                    user_limit=0,
                )
                await member.move_to(new_ch)
                room = TempVoiceRoom(
                    channel_id=str(new_ch.id),
                    owner_id=str(member.id),
                    guild_id=str(member.guild.id),
                )
                session.add(room)
                session.commit()

            # User rời → xóa room nếu trống
            if before.channel and before.channel != after.channel:
                room = _get_room(session, str(before.channel.id))
                if room:
                    ch = member.guild.get_channel(int(room.channel_id))
                    if ch and len(ch.members) == 0:
                        await ch.delete()
                        session.delete(room)
                        session.commit()
        except Exception as e:
            logger.error(f"on_voice_state_update error: {e}")
        finally:
            session.close()

    # ── Helper ──────────────────────────────────────────────

    async def _get_user_room(self, ctx: discord.ApplicationContext):
        """Trả về (channel, room_record) nếu user đang trong temp room của mình."""
        if not ctx.author.voice or not ctx.author.voice.channel:
            await ctx.respond("❌ Bạn phải ở trong phòng voice.", ephemeral=True)
            return None, None
        session = get_session()
        try:
            room = _get_room(session, str(ctx.author.voice.channel.id))
            if not room:
                await ctx.respond("❌ Phòng này không phải temp voice.", ephemeral=True)
                session.close()
                return None, None
            if room.owner_id != str(ctx.author.id):
                await ctx.respond("❌ Bạn không phải chủ phòng.", ephemeral=True)
                session.close()
                return None, None
            ch = ctx.author.voice.channel
            session.close()
            return ch, room
        except Exception:
            session.close()
            return None, None

    # ── Room commands ────────────────────────────────────────

    room = discord.SlashCommandGroup("room", "Quản lý phòng voice tạm thời")

    @room.command(name="lock", description="Khóa phòng")
    async def lock(self, ctx):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(ctx.guild.default_role, connect=False)
        await ctx.respond("🔒 Đã khóa phòng.", ephemeral=True)

    @room.command(name="unlock", description="Mở khóa phòng")
    async def unlock(self, ctx):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(ctx.guild.default_role, connect=True)
        await ctx.respond("🔓 Đã mở khóa phòng.", ephemeral=True)

    @room.command(name="hide", description="Ẩn phòng")
    async def hide(self, ctx):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(ctx.guild.default_role, view_channel=False)
        await ctx.respond("👁 Đã ẩn phòng.", ephemeral=True)

    @room.command(name="unhide", description="Hiện phòng")
    async def unhide(self, ctx):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(ctx.guild.default_role, view_channel=True)
        await ctx.respond("👁 Đã hiện phòng.", ephemeral=True)

    @room.command(name="rename", description="Đổi tên phòng")
    async def rename(self, ctx, name: discord.Option(str, "Tên mới")):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.edit(name=name[:100])
        await ctx.respond(f"✏️ Đổi tên thành **{name}**.", ephemeral=True)

    @room.command(name="limit", description="Giới hạn số người")
    async def limit(self, ctx, so: discord.Option(int, "Số người (0 = không giới hạn)", min_value=0, max_value=99)):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.edit(user_limit=so)
        await ctx.respond(f"👥 Giới hạn: **{so if so > 0 else 'Không giới hạn'}**.", ephemeral=True)

    @room.command(name="bitrate", description="Chỉnh bitrate (kbps)")
    async def bitrate(self, ctx, kbps: discord.Option(int, "Bitrate (8–384)", min_value=8, max_value=384)):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.edit(bitrate=kbps * 1000)
        await ctx.respond(f"🔊 Bitrate: **{kbps} kbps**.", ephemeral=True)

    @room.command(name="private", description="Chỉ cho phép người được cấp quyền vào")
    async def private(self, ctx):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(ctx.guild.default_role, connect=False, view_channel=False)
        await ctx.respond("🔐 Phòng đã chuyển sang chế độ riêng tư.", ephemeral=True)

    @room.command(name="public", description="Mở phòng cho mọi người")
    async def public(self, ctx):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(ctx.guild.default_role, connect=True, view_channel=True)
        await ctx.respond("🌐 Phòng đã mở công khai.", ephemeral=True)

    @room.command(name="permit", description="Cho phép user vào phòng")
    async def permit(self, ctx, user: discord.Option(discord.Member, "User")):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(user, connect=True, view_channel=True)
        await ctx.respond(f"✅ Đã cho phép {user.mention} vào phòng.", ephemeral=True)

    @room.command(name="reject", description="Chặn user vào phòng")
    async def reject(self, ctx, user: discord.Option(discord.Member, "User")):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(user, connect=False, view_channel=False)
        if user in ch.members:
            await user.move_to(None)
        await ctx.respond(f"🚫 Đã chặn {user.mention}.", ephemeral=True)

    @room.command(name="kick", description="Kick user ra khỏi phòng")
    async def kick_voice(self, ctx, user: discord.Option(discord.Member, "User")):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        if user in ch.members:
            await user.move_to(None)
        await ctx.respond(f"👢 Đã kick {user.mention} ra khỏi phòng.", ephemeral=True)

    @room.command(name="mute", description="Mute user trong phòng")
    async def mute_voice(self, ctx, user: discord.Option(discord.Member, "User")):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(user, speak=False)
        await ctx.respond(f"🔇 Đã mute {user.mention}.", ephemeral=True)

    @room.command(name="unmute", description="Unmute user trong phòng")
    async def unmute_voice(self, ctx, user: discord.Option(discord.Member, "User")):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(user, speak=True)
        await ctx.respond(f"🔊 Đã unmute {user.mention}.", ephemeral=True)

    @room.command(name="transfer", description="Chuyển quyền chủ phòng")
    async def transfer(self, ctx, user: discord.Option(discord.Member, "User mới")):
        ch, room = await self._get_user_room(ctx)
        if not ch: return
        session = get_session()
        try:
            r = _get_room(session, str(ch.id))
            if r:
                r.owner_id = str(user.id)
                session.commit()
            await ctx.respond(f"👑 Đã chuyển quyền chủ phòng cho {user.mention}.", ephemeral=True)
        finally:
            session.close()

    @room.command(name="claim", description="Nhận quyền chủ phòng nếu owner cũ đã rời")
    async def claim(self, ctx):
        if not ctx.author.voice or not ctx.author.voice.channel:
            await ctx.respond("❌ Bạn phải ở trong phòng voice.", ephemeral=True)
            return
        ch = ctx.author.voice.channel
        session = get_session()
        try:
            room = _get_room(session, str(ch.id))
            if not room:
                await ctx.respond("❌ Đây không phải temp room.", ephemeral=True)
                return
            owner = ch.guild.get_member(int(room.owner_id))
            if owner and owner in ch.members:
                await ctx.respond("❌ Chủ phòng hiện tại vẫn trong phòng.", ephemeral=True)
                return
            room.owner_id = str(ctx.author.id)
            session.commit()
            await ctx.respond(f"👑 Bạn đã trở thành chủ phòng.", ephemeral=True)
        finally:
            session.close()

    @room.command(name="owner", description="Xem chủ phòng hiện tại")
    async def owner(self, ctx):
        if not ctx.author.voice or not ctx.author.voice.channel:
            await ctx.respond("❌ Bạn phải ở trong phòng voice.", ephemeral=True)
            return
        session = get_session()
        try:
            room = _get_room(session, str(ctx.author.voice.channel.id))
            if not room:
                await ctx.respond("❌ Đây không phải temp room.", ephemeral=True)
                return
            await ctx.respond(f"👑 Chủ phòng: <@{room.owner_id}>", ephemeral=True)
        finally:
            session.close()

    @room.command(name="slowmode", description="Bật/tắt slowmode")
    async def slowmode(self, ctx, giay: discord.Option(int, "Giây (0=tắt)", min_value=0, max_value=21600)):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.edit(slowmode_delay=giay)
        await ctx.respond(f"⏱ Slowmode: **{giay}s**.", ephemeral=True)
