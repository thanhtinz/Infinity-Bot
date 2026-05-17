# src/bot/cogs/utility.py
"""Utility slash commands — /avatar, /serverinfo, /userinfo, /poll, /qr"""
import discord
import datetime
import logging

logger = logging.getLogger(__name__)


class UtilityCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    # ── /avatar ──────────────────────────────────────────────
    @discord.slash_command(name="avatar", description="View a member's avatar")
    async def avatar_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member", required=False) = None,
    ):
        target = user or ctx.author
        embed = discord.Embed(
            title=f"🖼️ Avatar — {target.display_name}",
            color=target.color if target.color != discord.Color.default() else 0x5865F2,
        )
        avatar_url = target.display_avatar.url
        embed.set_image(url=avatar_url)
        embed.add_field(
            name="Links",
            value=(
                f"[PNG]({target.display_avatar.with_format('png').url}) • "
                f"[JPG]({target.display_avatar.with_format('jpg').url}) • "
                f"[WEBP]({target.display_avatar.with_format('webp').url})"
            ),
            inline=False,
        )
        # Show server avatar if different from global
        if hasattr(target, "guild_avatar") and target.guild_avatar:
            embed.add_field(
                name="Server Avatar",
                value=f"[Link]({target.guild_avatar.url})",
                inline=False,
            )
        embed.set_footer(text=f"ID: {target.id}")
        embed.timestamp = datetime.datetime.utcnow()
        await ctx.respond(embed=embed)

    # ── /banner ──────────────────────────────────────────────
    @discord.slash_command(name="banner", description="View a member's banner")
    async def banner_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member", required=False) = None,
    ):
        target = user or ctx.author
        # Need to fetch full user object for banner
        full_user = await self.bot.fetch_user(target.id)
        if not full_user.banner:
            await ctx.respond(f"❌ **{target.display_name}** không có banner.", ephemeral=True)
            return
        embed = discord.Embed(
            title=f"🎨 Banner — {target.display_name}",
            color=target.color if target.color != discord.Color.default() else 0x5865F2,
        )
        embed.set_image(url=full_user.banner.url)
        embed.set_footer(text=f"ID: {target.id}")
        embed.timestamp = datetime.datetime.utcnow()
        await ctx.respond(embed=embed)

    # ── /serverinfo ──────────────────────────────────────────
    @discord.slash_command(name="serverinfo", description="Server information")
    async def serverinfo_cmd(self, ctx: discord.ApplicationContext):
        g = ctx.guild
        embed = discord.Embed(
            title=f"📊 {g.name}",
            color=0x5865F2,
        )
        if g.icon:
            embed.set_thumbnail(url=g.icon.url)
        if g.banner:
            embed.set_image(url=g.banner.url)

        # Owner
        embed.add_field(name="👑 Chủ server", value=f"{g.owner.mention}" if g.owner else "N/A", inline=True)
        embed.add_field(name="📅 Tạo lúc", value=f"<t:{int(g.created_at.timestamp())}:R>", inline=True)
        embed.add_field(name="🆔 ID", value=str(g.id), inline=True)

        # Members
        total = g.member_count or len(g.members)
        bots = sum(1 for m in g.members if m.bot)
        humans = total - bots
        embed.add_field(name="👥 Thành viên", value=f"Tổng: **{total}** (👤 {humans} / 🤖 {bots})", inline=False)

        # Channels
        text_ch = len([c for c in g.channels if isinstance(c, discord.TextChannel)])
        voice_ch = len([c for c in g.channels if isinstance(c, discord.VoiceChannel)])
        categories = len(g.categories)
        embed.add_field(name="📺 Kênh", value=f"💬 {text_ch} • 🔊 {voice_ch} • 📁 {categories}", inline=True)

        # Roles & Emojis
        embed.add_field(name="🎭 Roles", value=str(len(g.roles) - 1), inline=True)  # exclude @everyone
        embed.add_field(name="😀 Emojis", value=str(len(g.emojis)), inline=True)

        # Boost
        boost_level = g.premium_tier
        boost_count = g.premium_subscription_count or 0
        embed.add_field(name="💎 Boost", value=f"Level {boost_level} ({boost_count} boosts)", inline=True)

        # Verification level
        embed.add_field(name="🛡️ Verification", value=str(g.verification_level).replace("_", " ").title(), inline=True)

        embed.set_footer(text=f"Requested by {ctx.author}")
        embed.timestamp = datetime.datetime.utcnow()
        await ctx.respond(embed=embed)

    # ── /userinfo ────────────────────────────────────────────
    @discord.slash_command(name="userinfo", description="Member information")
    async def userinfo_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member", required=False) = None,
    ):
        target = user or ctx.author
        embed = discord.Embed(
            title=f"👤 {target.display_name}",
            color=target.color if target.color != discord.Color.default() else 0x5865F2,
        )
        embed.set_thumbnail(url=target.display_avatar.url)

        embed.add_field(name="📛 Tên", value=f"{target} ({target.mention})", inline=False)
        embed.add_field(name="🆔 ID", value=str(target.id), inline=True)
        embed.add_field(name="🤖 Bot?", value="Có" if target.bot else "Không", inline=True)

        # Dates
        embed.add_field(
            name="📅 Tạo tài khoản",
            value=f"<t:{int(target.created_at.timestamp())}:R>",
            inline=True,
        )
        if target.joined_at:
            embed.add_field(
                name="📥 Tham gia server",
                value=f"<t:{int(target.joined_at.timestamp())}:R>",
                inline=True,
            )
        if target.premium_since:
            embed.add_field(
                name="💎 Boost từ",
                value=f"<t:{int(target.premium_since.timestamp())}:R>",
                inline=True,
            )

        # Roles (exclude @everyone, show max 15)
        roles = [r.mention for r in sorted(target.roles[1:], key=lambda r: r.position, reverse=True)]
        if roles:
            display_roles = roles[:15]
            extra = f" và {len(roles) - 15} role khác..." if len(roles) > 15 else ""
            embed.add_field(name=f"🎭 Roles ({len(roles)})", value=" ".join(display_roles) + extra, inline=False)

        # Top role
        if target.top_role and target.top_role.name != "@everyone":
            embed.add_field(name="⬆️ Role cao nhất", value=target.top_role.mention, inline=True)

        # Permissions highlights
        key_perms = []
        perms = target.guild_permissions
        if perms.administrator:
            key_perms.append("Administrator")
        elif perms.manage_guild:
            key_perms.append("Manage Server")
        if perms.manage_roles:
            key_perms.append("Manage Roles")
        if perms.manage_channels:
            key_perms.append("Manage Channels")
        if perms.ban_members:
            key_perms.append("Ban Members")
        if perms.kick_members:
            key_perms.append("Kick Members")
        if key_perms:
            embed.add_field(name="🔑 Quyền nổi bật", value=", ".join(key_perms), inline=False)

        embed.set_footer(text=f"Requested by {ctx.author}")
        embed.timestamp = datetime.datetime.utcnow()
        await ctx.respond(embed=embed)

    # ── /poll ────────────────────────────────────────────────
    @discord.slash_command(name="poll", description="Create a quick poll")
    async def poll_cmd(
        self,
        ctx: discord.ApplicationContext,
        question: discord.Option(str, "Poll question"),
        option1: discord.Option(str, "Option 1"),
        option2: discord.Option(str, "Option 2"),
        option3: discord.Option(str, "Option 3", required=False) = None,
        option4: discord.Option(str, "Option 4", required=False) = None,
        option5: discord.Option(str, "Option 5", required=False) = None,
        option6: discord.Option(str, "Option 6", required=False) = None,
    ):
        number_emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"]
        options = [o for o in [option1, option2, option3, option4, option5, option6] if o]

        desc_lines = []
        for i, opt in enumerate(options):
            desc_lines.append(f"{number_emojis[i]} {opt}")

        embed = discord.Embed(
            title=f"📊 {question}",
            description="\n\n".join(desc_lines),
            color=0x5865F2,
        )
        embed.set_footer(text=f"Bình chọn bởi {ctx.author.display_name}")
        embed.timestamp = datetime.datetime.utcnow()

        msg = await ctx.respond(embed=embed)
        msg = await msg.original_response()
        for i in range(len(options)):
            await msg.add_reaction(number_emojis[i])

    # ── /qr ──────────────────────────────────────────────────
    @discord.slash_command(name="qr", description="Generate a QR code")
    async def qr_cmd(
        self,
        ctx: discord.ApplicationContext,
        text: discord.Option(str, "Content to encode (URL or text)"),
    ):
        # Use goqr.me free API
        qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={discord.utils.escape_markdown(text)}"
        embed = discord.Embed(
            title="📱 Mã QR",
            description=f"```{text[:100]}```",
            color=0x5865F2,
        )
        embed.set_image(url=qr_url)
        embed.set_footer(text=f"Requested by {ctx.author}")
        embed.timestamp = datetime.datetime.utcnow()
        await ctx.respond(embed=embed)
