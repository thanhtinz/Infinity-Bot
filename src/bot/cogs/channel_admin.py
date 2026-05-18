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
    embed.set_footer(text=f"Action by {ctx.author}")
    return embed


# ── Cog ───────────────────────────────────────────────────────────────────────

class ChannelAdminCog(discord.Cog):
    def __init__(self, bot):
        self.bot = bot
        # channel_id → set of (role_id/user_id, type) currently image-only
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
            who = f" from **{thanh_vien.display_name}**" if thanh_vien else ""
            await ctx.respond(f"🗑️ Deleted **{len(deleted)}** messages{who}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks `Manage Messages` permission.", ephemeral=True)
        except Exception as e:
            logger.error(f"purge_cmd error: {e}")
            await ctx.respond("❌ Error deleting messages.", ephemeral=True)

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
            new_ch = await target.clone(reason=f"Nuke by {ctx.author}")
            await new_ch.edit(position=position)
            await target.delete(reason=f"Nuke by {ctx.author}")
            embed = discord.Embed(
                title="💥 Channel Nuked!",
                description=f"This channel has been nuked by {ctx.author.mention}.",
                color=0xFF4444,
                timestamp=datetime.datetime.utcnow(),
            )
            await new_ch.send(embed=embed)
            if ctx.channel.id != target.id:
                await ctx.respond(f"✅ Nuked {new_ch.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks `Administrator` permission.", ephemeral=True)
        except Exception as e:
            logger.error(f"nuke_cmd error: {e}")
            await ctx.respond("❌ Error nuking channel.", ephemeral=True)

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
                                         reason=f"Lock by {ctx.author}: {ly_do}")
            embed = discord.Embed(
                title="🔒 Channel Locked",
                description=f"{ctx.author.mention} locked {target.mention}.\n{'> ' + ly_do if ly_do else ''}",
                color=0xFF6B6B,
                timestamp=datetime.datetime.utcnow(),
            )
            await target.send(embed=embed)
            await ctx.respond(f"✅ Locked {target.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks `Manage Channels` permission.", ephemeral=True)
        except Exception as e:
            logger.error(f"lock_cmd error: {e}")
            await ctx.respond("❌ Error locking channel.", ephemeral=True)

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
                                         reason=f"Unlock by {ctx.author}")
            embed = discord.Embed(
                title="🔓 Channel Unlocked",
                description=f"{ctx.author.mention} unlocked {target.mention}.",
                color=0x57F287,
                timestamp=datetime.datetime.utcnow(),
            )
            await target.send(embed=embed)
            await ctx.respond(f"✅ Unlocked {target.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks `Manage Channels` permission.", ephemeral=True)
        except Exception as e:
            logger.error(f"unlock_cmd error: {e}")
            await ctx.respond("❌ Error.", ephemeral=True)

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
                                            reason=f"Hide by {ctx.author}")
            who = target.mention if hasattr(target, "mention") else str(target)
            await ctx.respond(f"✅ Hidden {target_ch.mention} from {who}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks `Manage Channels` permission.", ephemeral=True)
        except Exception as e:
            logger.error(f"hide_channel_cmd error: {e}")
            await ctx.respond("❌ Error.", ephemeral=True)

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
                                            reason=f"Show channel by {ctx.author}")
            who = target.mention if hasattr(target, "mention") else str(target)
            await ctx.respond(f"✅ Made {target_ch.mention} visible to {who}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks `Manage Channels` permission.", ephemeral=True)
        except Exception as e:
            logger.error(f"show_channel_cmd error: {e}")
            await ctx.respond("❌ Error.", ephemeral=True)

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
                                            reason=f"Block channel by {ctx.author}: {ly_do}")
            who = getattr(target, "mention", str(target))
            await ctx.respond(f"🚫 Blocked {who} from sending in {target_ch.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks `Manage Channels` permission.", ephemeral=True)
        except Exception as e:
            logger.error(f"block_channel_cmd error: {e}")
            await ctx.respond("❌ Error.", ephemeral=True)

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
                                            reason=f"Unblock channel by {ctx.author}")
            who = getattr(target, "mention", str(target))
            await ctx.respond(f"✅ Unblocked {who} in {target_ch.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks `Manage Channels` permission.", ephemeral=True)
        except Exception as e:
            logger.error(f"unblock_channel_cmd error: {e}")
            await ctx.respond("❌ Error.", ephemeral=True)

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
            await target.edit(slowmode_delay=giay, reason=f"Slowmode by {ctx.author}")
            if giay == 0:
                await ctx.respond(f"✅ Slowmode disabled in {target.mention}.", ephemeral=True)
            else:
                # Format time
                if giay < 60:
                    t = f"{giay}s"
                elif giay < 3600:
                    t = f"{giay//60}m {giay%60}s" if giay % 60 else f"{giay//60}m"
                else:
                    t = f"{giay//3600}h {(giay%3600)//60}m" if giay % 3600 else f"{giay//3600}h"
                await ctx.respond(f"⏱️ Slowmode set to **{t}** in {target.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks `Manage Channels` permission.", ephemeral=True)
        except Exception as e:
            logger.error(f"slowmode_cmd error: {e}")
            await ctx.respond("❌ Error.", ephemeral=True)

    # ── /image_only ───────────────────────────────────────────────────────────
    @discord.slash_command(name="image_only", description="[Admin] Set channel to image/video/file only")
    @discord.default_permissions(manage_channels=True)
    async def image_only_cmd(
        self,
        ctx: discord.ApplicationContext,
        bat_tat: discord.Option(str, "Enable or disable image-only mode", choices=["on", "off"]),
        kenh: discord.Option(discord.TextChannel, "Channel (leave empty = current channel)", required=False, default=None),
    ):
        await ctx.defer(ephemeral=True)
        target = kenh or ctx.channel
        if bat_tat == "on":
            self._image_only.add(target.id)
            await ctx.respond(
                f"🖼️ Channel {target.mention} is now **image/video only**.\n"
                "Text messages will be automatically deleted.",
                ephemeral=True,
            )
        else:
            self._image_only.discard(target.id)
            await ctx.respond(f"✅ Image-only mode disabled in {target.mention}.", ephemeral=True)

    @discord.Cog.listener()
    async def on_message(self, message: discord.Message):
        """Delete text messages in image-only channels."""
        if message.author.bot:
            return
        if message.channel.id not in self._image_only:
            return
        # Allow if has attachment or is an image link
        has_media = bool(message.attachments) or any(
            ext in message.content.lower()
            for ext in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".mov", ".webm")
        )
        if has_media:
            return
        try:
            await message.delete()
            warn = await message.channel.send(
                f"{message.author.mention} This channel only allows images/videos! ❌",
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
            await ctx.respond("❌ Message with that ID not found in this channel.", ephemeral=True)
            return
        try:
            # Build embed with original content
            embed = discord.Embed(
                description=msg.content or "*[No text content]*",
                color=0x5865F2,
                timestamp=msg.created_at,
            )
            embed.set_author(name=msg.author.display_name, icon_url=msg.author.display_avatar.url)
            embed.set_footer(text=f"Moved from #{ctx.channel.name} by {ctx.author.display_name}")
            files = [await a.to_file() for a in msg.attachments[:10]]
            await kenh_dich.send(embed=embed, files=files)
            await msg.delete()
            await ctx.respond(f"✅ Message moved to {kenh_dich.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks permissions in the target channel.", ephemeral=True)
        except Exception as e:
            logger.error(f"move_message_cmd error: {e}")
            await ctx.respond("❌ Error moving message.", ephemeral=True)

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
            await ctx.respond("✅ Cleared all reactions from the message.", ephemeral=True)
        except discord.NotFound:
            await ctx.respond("❌ Message not found.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks `Manage Messages` permission.", ephemeral=True)
        except Exception as e:
            logger.error(f"clear_reactions_cmd error: {e}")
            await ctx.respond("❌ Error.", ephemeral=True)

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
            await ctx.respond(f"✅ Announcement sent to {target.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks permission to send in that channel.", ephemeral=True)
        except Exception as e:
            logger.error(f"announce_cmd error: {e}")
            await ctx.respond("❌ Error sending announcement.", ephemeral=True)

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
            await msg.pin(reason=f"Pinned by {ctx.author}")
            await ctx.respond("📌 Message pinned.", ephemeral=True)
        except discord.NotFound:
            await ctx.respond("❌ Message not found.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks permission to pin messages.", ephemeral=True)
        except Exception as e:
            logger.error(f"pin_message_cmd error: {e}")
            await ctx.respond("❌ Error.", ephemeral=True)

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
            await msg.unpin(reason=f"Unpinned by {ctx.author}")
            await ctx.respond("✅ Message unpinned.", ephemeral=True)
        except discord.NotFound:
            await ctx.respond("❌ Message not found.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks permission.", ephemeral=True)
        except Exception as e:
            logger.error(f"unpin_message_cmd error: {e}")
            await ctx.respond("❌ Error.", ephemeral=True)

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
            await thanh_vien.add_roles(role, reason=f"Added by {ctx.author}")
            await ctx.respond(f"✅ Added {role.mention} to {thanh_vien.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks `Manage Roles` permission or role is above bot.", ephemeral=True)
        except Exception as e:
            await ctx.respond(f"❌ Error: {e}", ephemeral=True)

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
            await thanh_vien.remove_roles(role, reason=f"Removed by {ctx.author}")
            await ctx.respond(f"✅ Removed {role.mention} from {thanh_vien.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks `Manage Roles` permission.", ephemeral=True)
        except Exception as e:
            await ctx.respond(f"❌ Error: {e}", ephemeral=True)

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
            await thanh_vien.edit(nick=nickname, reason=f"Nickname changed by {ctx.author}")
            if nickname:
                await ctx.respond(f"✅ Changed nickname of {thanh_vien.mention} to **{nickname}**.", ephemeral=True)
            else:
                await ctx.respond(f"✅ Cleared nickname of {thanh_vien.mention}.", ephemeral=True)
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks `Manage Nicknames` permission or cannot edit the owner's nickname.", ephemeral=True)
        except Exception as e:
            await ctx.respond(f"❌ Error: {e}", ephemeral=True)


def setup(bot):
    bot.add_cog(ChannelAdminCog(bot))
