# src/bot/cogs/channel_admin.py
# Admin commands: purge, nuke, lock/unlock, hide/show, slowmode, image-only,
#                 block/unblock channel, move-message, announce, clear-reactions

import discord
import asyncio
import datetime
import logging

logger = logging.getLogger(__name__)

# ── Helpers ───────────────────────────────────────────────────────────────────

async def _send_log(ctx: discord.ApplicationContext, color: int, title: str, desc: str):
    embed = discord.Embed(title=title, description=desc, color=color,
                          timestamp=datetime.datetime.utcnow())
    embed.set_footer(text=f"Thực hiện bởi {ctx.author}")
    return embed


# ── Cog ───────────────────────────────────────────────────────────────────────

class ChannelAdminCog(discord.Cog):
    def __init__(self, bot):
        self.bot = bot
        # channel_id → set of (role_id/user_id, type) đang bị image-only
        self._image_only: set[int] = set()

    # ── /purge ────────────────────────────────────────────────────────────────
    @discord.slash_command(name="purge", description="[Admin] Bulk delete messages in channel")
    @discord.default_permissions(manage_messages=True)
    async def purge_cmd(
        self,
        ctx: discord.ApplicationContext,
        so_luong: discord.Option(int, "Number of messages to delete (1–300)", min_value=1, max_value=300),
        thanh_vien: discord.Option(discord.Member, "Only delete messages from this member", required=False, default=None),
    ):
        await ctx.defer(ephemeral=True)
        def check(m: discord.Message):
            if thanh_vien:
                return m.author.id == thanh_vien.id
            return True
        try:
            deleted = await ctx.channel.purge(limit=so_luong, check=check)
            who = f" của **{thanh_vien.display_name}**" if thanh_vien else ""
            await ctx.respond(f"🗑️ Đã xóa **{len(deleted)}** tin nhắn{who}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot thiếu quyền `Manage Messages`.", ephemeral=True)
        except Exception as e:
            logger.error(f"purge_cmd error: {e}")
            await ctx.respond("❌ Lỗi khi xóa tin nhắn.", ephemeral=True)

    # ── /nuke ─────────────────────────────────────────────────────────────────
    @discord.slash_command(name="nuke", description="[Admin] Delete all messages in channel (clone channel)")
    @discord.default_permissions(administrator=True)
    async def nuke_cmd(
        self,
        ctx: discord.ApplicationContext,
        kenh: discord.Option(discord.TextChannel, "Channel to nuke (leave empty = current channel)", required=False, default=None),
    ):
        await ctx.defer(ephemeral=True)
        target = kenh or ctx.channel
        try:
            position = target.position
            new_ch = await target.clone(reason=f"Nuke bởi {ctx.author}")
            await new_ch.edit(position=position)
            await target.delete(reason=f"Nuke bởi {ctx.author}")
            embed = discord.Embed(
                title="💥 Kênh đã được nuke!",
                description=f"Kênh này đã được làm sạch bởi {ctx.author.mention}.",
                color=0xFF4444,
                timestamp=datetime.datetime.utcnow(),
            )
            await new_ch.send(embed=embed)
            if ctx.channel.id != target.id:
                await ctx.respond(f"✅ Đã nuke {new_ch.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot thiếu quyền `Administrator`.", ephemeral=True)
        except Exception as e:
            logger.error(f"nuke_cmd error: {e}")
            await ctx.respond("❌ Lỗi khi nuke kênh.", ephemeral=True)

    # ── /lock ─────────────────────────────────────────────────────────────────
    @discord.slash_command(name="lock", description="[Admin] Lock channel — block @everyone from sending")
    @discord.default_permissions(manage_channels=True)
    async def lock_cmd(
        self,
        ctx: discord.ApplicationContext,
        kenh: discord.Option(discord.TextChannel, "Channel to lock (leave empty = current channel)", required=False, default=None),
        ly_do: discord.Option(str, "Reason for locking", required=False, default=""),
    ):
        await ctx.defer(ephemeral=True)
        target = kenh or ctx.channel
        everyone = ctx.guild.default_role
        try:
            await target.set_permissions(everyone, send_messages=False,
                                         reason=f"Lock bởi {ctx.author}: {ly_do}")
            embed = discord.Embed(
                title="🔒 Kênh đã bị khóa",
                description=f"{ctx.author.mention} đã khóa {target.mention}.\n{'> ' + ly_do if ly_do else ''}",
                color=0xFF6B6B,
                timestamp=datetime.datetime.utcnow(),
            )
            await target.send(embed=embed)
            await ctx.respond(f"✅ Đã khóa {target.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot thiếu quyền `Manage Channels`.", ephemeral=True)
        except Exception as e:
            logger.error(f"lock_cmd error: {e}")
            await ctx.respond("❌ Lỗi khi khóa kênh.", ephemeral=True)

    # ── /unlock ───────────────────────────────────────────────────────────────
    @discord.slash_command(name="unlock", description="[Admin] Unlock channel")
    @discord.default_permissions(manage_channels=True)
    async def unlock_cmd(
        self,
        ctx: discord.ApplicationContext,
        kenh: discord.Option(discord.TextChannel, "Channel to unlock (leave empty = current channel)", required=False, default=None),
    ):
        await ctx.defer(ephemeral=True)
        target = kenh or ctx.channel
        everyone = ctx.guild.default_role
        try:
            await target.set_permissions(everyone, send_messages=None,
                                         reason=f"Unlock bởi {ctx.author}")
            embed = discord.Embed(
                title="🔓 Kênh đã được mở khóa",
                description=f"{ctx.author.mention} đã mở khóa {target.mention}.",
                color=0x57F287,
                timestamp=datetime.datetime.utcnow(),
            )
            await target.send(embed=embed)
            await ctx.respond(f"✅ Đã mở khóa {target.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot thiếu quyền `Manage Channels`.", ephemeral=True)
        except Exception as e:
            logger.error(f"unlock_cmd error: {e}")
            await ctx.respond("❌ Lỗi.", ephemeral=True)

    # ── /hide_channel ─────────────────────────────────────────────────────────
    @discord.slash_command(name="hide_channel", description="[Admin] Hide channel from role/user")
    @discord.default_permissions(manage_channels=True)
    async def hide_channel_cmd(
        self,
        ctx: discord.ApplicationContext,
        doi_tuong: discord.Option(str, "Mention @role or @user to hide from", required=False, default=None),
        kenh: discord.Option(discord.TextChannel, "Channel to hide (leave empty = current channel)", required=False, default=None),
    ):
        await ctx.defer(ephemeral=True)
        target_ch = kenh or ctx.channel
        # Parse target role/user
        target = None
        if doi_tuong:
            # Try parse mention
            import re
            m = re.match(r"<@&?(\d+)>", doi_tuong)
            if m:
                uid = int(m.group(1))
                target = ctx.guild.get_role(uid) or ctx.guild.get_member(uid)
        if target is None:
            target = ctx.guild.default_role
        try:
            await target_ch.set_permissions(target, view_channel=False,
                                            reason=f"Hide bởi {ctx.author}")
            who = target.mention if hasattr(target, "mention") else str(target)
            await ctx.respond(f"✅ Đã ẩn {target_ch.mention} khỏi {who}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot thiếu quyền `Manage Channels`.", ephemeral=True)
        except Exception as e:
            logger.error(f"hide_channel_cmd error: {e}")
            await ctx.respond("❌ Lỗi.", ephemeral=True)

    # ── /show_channel ─────────────────────────────────────────────────────────
    @discord.slash_command(name="show_channel", description="[Admin] Show channel to role/user")
    @discord.default_permissions(manage_channels=True)
    async def show_channel_cmd(
        self,
        ctx: discord.ApplicationContext,
        doi_tuong: discord.Option(str, "Mention @role or @user to show to", required=False, default=None),
        kenh: discord.Option(discord.TextChannel, "Channel to show (leave empty = current channel)", required=False, default=None),
    ):
        await ctx.defer(ephemeral=True)
        target_ch = kenh or ctx.channel
        target = None
        if doi_tuong:
            import re
            m = re.match(r"<@&?(\d+)>", doi_tuong)
            if m:
                uid = int(m.group(1))
                target = ctx.guild.get_role(uid) or ctx.guild.get_member(uid)
        if target is None:
            target = ctx.guild.default_role
        try:
            await target_ch.set_permissions(target, view_channel=None,
                                            reason=f"Show channel bởi {ctx.author}")
            who = target.mention if hasattr(target, "mention") else str(target)
            await ctx.respond(f"✅ Đã hiện lại {target_ch.mention} cho {who}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot thiếu quyền `Manage Channels`.", ephemeral=True)
        except Exception as e:
            logger.error(f"show_channel_cmd error: {e}")
            await ctx.respond("❌ Lỗi.", ephemeral=True)

    # ── /block_channel ────────────────────────────────────────────────────────
    @discord.slash_command(name="block_channel", description="[Admin] Block role/user from sending messages in channel")
    @discord.default_permissions(manage_channels=True)
    async def block_channel_cmd(
        self,
        ctx: discord.ApplicationContext,
        thanh_vien: discord.Option(discord.Member, "Member to block", required=False, default=None),
        role: discord.Option(discord.Role, "Role to block", required=False, default=None),
        kenh: discord.Option(discord.TextChannel, "Channel to block in (leave empty = current channel)", required=False, default=None),
        ly_do: discord.Option(str, "Reason", required=False, default=""),
    ):
        await ctx.defer(ephemeral=True)
        target_ch = kenh or ctx.channel
        target = thanh_vien or role or ctx.guild.default_role
        try:
            await target_ch.set_permissions(target, send_messages=False,
                                            reason=f"Block channel bởi {ctx.author}: {ly_do}")
            who = getattr(target, "mention", str(target))
            await ctx.respond(f"🚫 Đã chặn {who} gửi tin trong {target_ch.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot thiếu quyền `Manage Channels`.", ephemeral=True)
        except Exception as e:
            logger.error(f"block_channel_cmd error: {e}")
            await ctx.respond("❌ Lỗi.", ephemeral=True)

    # ── /unblock_channel ──────────────────────────────────────────────────────
    @discord.slash_command(name="unblock_channel", description="[Admin] Unblock role/user in channel")
    @discord.default_permissions(manage_channels=True)
    async def unblock_channel_cmd(
        self,
        ctx: discord.ApplicationContext,
        thanh_vien: discord.Option(discord.Member, "Member to unblock", required=False, default=None),
        role: discord.Option(discord.Role, "Role to unblock", required=False, default=None),
        kenh: discord.Option(discord.TextChannel, "Channel (leave empty = current channel)", required=False, default=None),
    ):
        await ctx.defer(ephemeral=True)
        target_ch = kenh or ctx.channel
        target = thanh_vien or role or ctx.guild.default_role
        try:
            await target_ch.set_permissions(target, send_messages=None,
                                            reason=f"Unblock channel bởi {ctx.author}")
            who = getattr(target, "mention", str(target))
            await ctx.respond(f"✅ Đã bỏ chặn {who} trong {target_ch.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot thiếu quyền `Manage Channels`.", ephemeral=True)
        except Exception as e:
            logger.error(f"unblock_channel_cmd error: {e}")
            await ctx.respond("❌ Lỗi.", ephemeral=True)

    # ── /slowmode ─────────────────────────────────────────────────────────────
    @discord.slash_command(name="slowmode", description="[Admin] Set slowmode in channel")
    @discord.default_permissions(manage_channels=True)
    async def slowmode_cmd(
        self,
        ctx: discord.ApplicationContext,
        giay: discord.Option(int, "Slowmode seconds (0 = off, max 21600)", min_value=0, max_value=21600),
        kenh: discord.Option(discord.TextChannel, "Channel to set slowmode (leave empty = current channel)", required=False, default=None),
    ):
        await ctx.defer(ephemeral=True)
        target = kenh or ctx.channel
        try:
            await target.edit(slowmode_delay=giay, reason=f"Slowmode bởi {ctx.author}")
            if giay == 0:
                await ctx.respond(f"✅ Đã tắt slowmode trong {target.mention}.", ephemeral=True)
            else:
                # Format thời gian
                if giay < 60:
                    t = f"{giay}s"
                elif giay < 3600:
                    t = f"{giay//60}m {giay%60}s" if giay % 60 else f"{giay//60}m"
                else:
                    t = f"{giay//3600}h {(giay%3600)//60}m" if giay % 3600 else f"{giay//3600}h"
                await ctx.respond(f"⏱️ Đã đặt slowmode **{t}** trong {target.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot thiếu quyền `Manage Channels`.", ephemeral=True)
        except Exception as e:
            logger.error(f"slowmode_cmd error: {e}")
            await ctx.respond("❌ Lỗi.", ephemeral=True)

    # ── /image_only ───────────────────────────────────────────────────────────
    @discord.slash_command(name="image_only", description="[Admin] Set channel to image/video/file only")
    @discord.default_permissions(manage_channels=True)
    async def image_only_cmd(
        self,
        ctx: discord.ApplicationContext,
        bat_tat: discord.Option(str, "Enable or disable image-only mode", choices=["bật", "tắt"]),
        kenh: discord.Option(discord.TextChannel, "Channel (leave empty = current channel)", required=False, default=None),
    ):
        await ctx.defer(ephemeral=True)
        target = kenh or ctx.channel
        if bat_tat == "bật":
            self._image_only.add(target.id)
            await ctx.respond(
                f"🖼️ Kênh {target.mention} đã bật chế độ **chỉ ảnh/video**.\n"
                "Tin nhắn text sẽ tự động bị xóa.",
                ephemeral=True,
            )
        else:
            self._image_only.discard(target.id)
            await ctx.respond(f"✅ Đã tắt chế độ chỉ ảnh trong {target.mention}.", ephemeral=True)

    @discord.Cog.listener()
    async def on_message(self, message: discord.Message):
        """Xóa tin nhắn text trong kênh image-only."""
        if message.author.bot:
            return
        if message.channel.id not in self._image_only:
            return
        # Cho phép nếu có attachment hoặc là link ảnh
        has_media = bool(message.attachments) or any(
            ext in message.content.lower()
            for ext in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".mov", ".webm")
        )
        if has_media:
            return
        try:
            await message.delete()
            warn = await message.channel.send(
                f"{message.author.mention} Kênh này chỉ cho phép gửi ảnh/video! ❌",
                delete_after=4,
            )
        except Exception:
            pass

    # ── /move_message ─────────────────────────────────────────────────────────
    @discord.slash_command(name="move_message", description="[Admin] Move a message to another channel")
    @discord.default_permissions(manage_messages=True)
    async def move_message_cmd(
        self,
        ctx: discord.ApplicationContext,
        message_id: discord.Option(str, "ID of the message to move"),
        kenh_dich: discord.Option(discord.TextChannel, "Target channel"),
    ):
        await ctx.defer(ephemeral=True)
        try:
            msg = await ctx.channel.fetch_message(int(message_id))
        except (discord.NotFound, ValueError):
            await ctx.respond("❌ Không tìm thấy tin nhắn với ID đó trong kênh hiện tại.", ephemeral=True)
            return
        try:
            # Build embed chứa nội dung gốc
            embed = discord.Embed(
                description=msg.content or "*[Không có nội dung text]*",
                color=0x5865F2,
                timestamp=msg.created_at,
            )
            embed.set_author(name=msg.author.display_name, icon_url=msg.author.display_avatar.url)
            embed.set_footer(text=f"Chuyển từ #{ctx.channel.name} bởi {ctx.author.display_name}")
            files = [await a.to_file() for a in msg.attachments[:10]]
            await kenh_dich.send(embed=embed, files=files)
            await msg.delete()
            await ctx.respond(f"✅ Đã chuyển tin nhắn sang {kenh_dich.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot thiếu quyền trong kênh đích.", ephemeral=True)
        except Exception as e:
            logger.error(f"move_message_cmd error: {e}")
            await ctx.respond("❌ Lỗi khi chuyển tin nhắn.", ephemeral=True)

    # ── /clear_reactions ──────────────────────────────────────────────────────
    @discord.slash_command(name="clear_reactions", description="[Admin] Clear all reactions from a message")
    @discord.default_permissions(manage_messages=True)
    async def clear_reactions_cmd(
        self,
        ctx: discord.ApplicationContext,
        message_id: discord.Option(str, "ID of the message to clear reactions"),
    ):
        await ctx.defer(ephemeral=True)
        try:
            msg = await ctx.channel.fetch_message(int(message_id))
            await msg.clear_reactions()
            await ctx.respond("✅ Đã xóa tất cả reaction khỏi tin nhắn.", ephemeral=True)
        except discord.NotFound:
            await ctx.respond("❌ Không tìm thấy tin nhắn.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot thiếu quyền `Manage Messages`.", ephemeral=True)
        except Exception as e:
            logger.error(f"clear_reactions_cmd error: {e}")
            await ctx.respond("❌ Lỗi.", ephemeral=True)

    # ── /announce ─────────────────────────────────────────────────────────────
    @discord.slash_command(name="announce", description="[Admin] Send an embed announcement to channel")
    @discord.default_permissions(administrator=True)
    async def announce_cmd(
        self,
        ctx: discord.ApplicationContext,
        noi_dung: discord.Option(str, "Announcement content (supports Discord markdown)"),
        kenh: discord.Option(discord.TextChannel, "Target channel (leave empty = current channel)", required=False, default=None),
        tieu_de: discord.Option(str, "Embed title (leave empty = none)", required=False, default=""),
        mention: discord.Option(str, "Who to mention (@here, @everyone, @role)", required=False, default=""),
        mau: discord.Option(str, "Embed hex color (e.g. #FF0000)", required=False, default="#5865F2"),
    ):
        await ctx.defer(ephemeral=True)
        target = kenh or ctx.channel
        try:
            color_int = int(mau.lstrip("#"), 16) if mau else 0x5865F2
        except Exception:
            color_int = 0x5865F2
        embed = discord.Embed(
            title=tieu_de or None,
            description=noi_dung,
            color=color_int,
            timestamp=datetime.datetime.utcnow(),
        )
        embed.set_footer(text=ctx.guild.name, icon_url=ctx.guild.icon.url if ctx.guild.icon else None)
        content = mention if mention else None
        try:
            await target.send(content=content, embed=embed)
            await ctx.respond(f"✅ Đã gửi thông báo đến {target.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot thiếu quyền gửi tin trong kênh đó.", ephemeral=True)
        except Exception as e:
            logger.error(f"announce_cmd error: {e}")
            await ctx.respond("❌ Lỗi khi gửi thông báo.", ephemeral=True)

    # ── /pin_message ──────────────────────────────────────────────────────────
    @discord.slash_command(name="pin_message", description="[Admin] Pin a message by ID")
    @discord.default_permissions(manage_messages=True)
    async def pin_message_cmd(
        self,
        ctx: discord.ApplicationContext,
        message_id: discord.Option(str, "ID of the message to pin"),
    ):
        await ctx.defer(ephemeral=True)
        try:
            msg = await ctx.channel.fetch_message(int(message_id))
            await msg.pin(reason=f"Ghim bởi {ctx.author}")
            await ctx.respond("📌 Đã ghim tin nhắn.", ephemeral=True)
        except discord.NotFound:
            await ctx.respond("❌ Không tìm thấy tin nhắn.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot thiếu quyền ghim tin nhắn.", ephemeral=True)
        except Exception as e:
            logger.error(f"pin_message_cmd error: {e}")
            await ctx.respond("❌ Lỗi.", ephemeral=True)

    # ── /unpin_message ────────────────────────────────────────────────────────
    @discord.slash_command(name="unpin_message", description="[Admin] Unpin a message by ID")
    @discord.default_permissions(manage_messages=True)
    async def unpin_message_cmd(
        self,
        ctx: discord.ApplicationContext,
        message_id: discord.Option(str, "ID of the message to unpin"),
    ):
        await ctx.defer(ephemeral=True)
        try:
            msg = await ctx.channel.fetch_message(int(message_id))
            await msg.unpin(reason=f"Bỏ ghim bởi {ctx.author}")
            await ctx.respond("✅ Đã bỏ ghim tin nhắn.", ephemeral=True)
        except discord.NotFound:
            await ctx.respond("❌ Không tìm thấy tin nhắn.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot thiếu quyền.", ephemeral=True)
        except Exception as e:
            logger.error(f"unpin_message_cmd error: {e}")
            await ctx.respond("❌ Lỗi.", ephemeral=True)

    # ── /role_add / /role_remove ───────────────────────────────────────────────
    @discord.slash_command(name="role_add", description="[Admin] Add a role to a member")
    @discord.default_permissions(manage_roles=True)
    async def role_add_cmd(
        self,
        ctx: discord.ApplicationContext,
        thanh_vien: discord.Option(discord.Member, "Member"),
        role: discord.Option(discord.Role, "Role to add"),
    ):
        await ctx.defer(ephemeral=True)
        try:
            await thanh_vien.add_roles(role, reason=f"Thêm bởi {ctx.author}")
            await ctx.respond(f"✅ Đã thêm {role.mention} cho {thanh_vien.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot thiếu quyền `Manage Roles` hoặc role cao hơn bot.", ephemeral=True)
        except Exception as e:
            await ctx.respond(f"❌ Lỗi: {e}", ephemeral=True)

    @discord.slash_command(name="role_remove", description="[Admin] Remove a role from a member")
    @discord.default_permissions(manage_roles=True)
    async def role_remove_cmd(
        self,
        ctx: discord.ApplicationContext,
        thanh_vien: discord.Option(discord.Member, "Member"),
        role: discord.Option(discord.Role, "Role to remove"),
    ):
        await ctx.defer(ephemeral=True)
        try:
            await thanh_vien.remove_roles(role, reason=f"Xóa bởi {ctx.author}")
            await ctx.respond(f"✅ Đã xóa {role.mention} khỏi {thanh_vien.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot thiếu quyền `Manage Roles`.", ephemeral=True)
        except Exception as e:
            await ctx.respond(f"❌ Lỗi: {e}", ephemeral=True)

    # ── /nick ─────────────────────────────────────────────────────────────────
    @discord.slash_command(name="nick", description="[Admin] Change a member's nickname")
    @discord.default_permissions(manage_nicknames=True)
    async def nick_cmd(
        self,
        ctx: discord.ApplicationContext,
        thanh_vien: discord.Option(discord.Member, "Member"),
        nickname: discord.Option(str, "New nickname (leave empty to reset)", required=False, default=None),
    ):
        await ctx.defer(ephemeral=True)
        try:
            await thanh_vien.edit(nick=nickname, reason=f"Đổi nick bởi {ctx.author}")
            if nickname:
                await ctx.respond(f"✅ Đã đổi nickname {thanh_vien.mention} thành **{nickname}**.", ephemeral=True)
            else:
                await ctx.respond(f"✅ Đã xóa nickname của {thanh_vien.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot thiếu quyền `Manage Nicknames` hoặc không thể sửa nickname của owner.", ephemeral=True)
        except Exception as e:
            await ctx.respond(f"❌ Lỗi: {e}", ephemeral=True)


def setup(bot):
    bot.add_cog(ChannelAdminCog(bot))
