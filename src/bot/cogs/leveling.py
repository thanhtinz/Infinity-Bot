# src/bot/cogs/leveling.py
"""Lurkr-style leveling: XP, rank, leaderboard, rewards, multipliers."""
import datetime
import math
import random
import discord
from sqlalchemy import select, func
from src.database.config import SessionLocal
from src.models.models import LevelingConfig, MemberXP, LevelReward, LevelMultiplier
from src.bot.base_cog import check_feature
from src.bot.embed_utils import build_embed
from src.bot.rank_card import make_rank_card


def get_session():
    return SessionLocal()


def xp_for_level(level: int) -> int:
    return max(0, 100 * level * level)


def level_from_xp(xp: int) -> int:
    return int(math.sqrt(max(0, xp) / 100))


def progress_for(xp: int, level: int) -> tuple[int, int, int]:
    current = xp_for_level(level)
    nxt = xp_for_level(level + 1)
    gained = max(0, xp - current)
    needed = max(1, nxt - current)
    return gained, needed, int((gained / needed) * 100)


def get_or_create_config(session, guild_id: str) -> LevelingConfig:
    cfg = session.execute(select(LevelingConfig).where(LevelingConfig.guild_id == guild_id)).scalars().first()
    if not cfg:
        cfg = LevelingConfig(guild_id=guild_id)
        session.add(cfg)
        session.commit()
        session.refresh(cfg)
    return cfg


def rank_card_settings(cfg: LevelingConfig | None, member_xp: MemberXP | None = None) -> dict:
    import os
    settings = {
        "accent": "#7C8CFF",
        "secondary_accent": "#7AF4D3",
        "show_avatar_ring": True,
        "show_progress_bar": True,
        "show_username": True,
        "show_server": True,
        "show_total_xp": True,
        "show_percent": True,
        "show_rank": True,
        "show_level": True,
        "rank_label": "Rank",
        "level_label": "Level",
        "xp_label": "XP",
        "server": "Discord Server",
        "custom_bg_path": None,
    }
    if cfg and isinstance(cfg.rank_card_config, dict):
        saved = cfg.rank_card_config
        for key in ["accent", "secondary_accent", "show_avatar_ring", "show_progress_bar",
                    "show_username", "show_server", "show_total_xp", "show_percent",
                    "show_rank", "show_level", "rank_label", "level_label", "xp_label",
                    "background", "panel_style", "progress_style", "avatar_shape",
                    "card_radius", "panel_opacity", "glow_strength", "avatar_size"]:
            if key in saved:
                settings[key] = saved[key]
        guild_id = cfg.guild_id
        bg_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "static", "uploads")

        # Per-user background takes priority
        user_slug = member_xp.rank_card_bg if member_xp and member_xp.rank_card_bg else None
        if user_slug:
            user_bg = os.path.join(bg_dir, f"{user_slug}.png")
            if os.path.exists(user_bg):
                settings["custom_bg_path"] = user_bg
                return settings

        # Server active background
        active_slug = saved.get("active_bg_slug")
        if active_slug:
            candidate = os.path.join(bg_dir, f"{active_slug}.png")
        else:
            candidate = os.path.join(bg_dir, f"rank_bg_{guild_id}.png")
        if candidate and os.path.exists(candidate):
            settings["custom_bg_path"] = candidate
    return settings


def set_rank_card_background(session, guild_id: str, background: str) -> LevelingConfig:
    cfg = get_or_create_config(session, guild_id)
    cfg.rank_card_config = {"background": background, "layout_config": {}}
    session.commit()
    session.refresh(cfg)
    return cfg



def get_or_create_member(session, guild_id: str, member: discord.Member) -> MemberXP:
    row = session.execute(
        select(MemberXP).where(MemberXP.guild_id == guild_id, MemberXP.discord_id == str(member.id))
    ).scalars().first()
    if not row:
        row = MemberXP(guild_id=guild_id, discord_id=str(member.id), username=str(member))
        session.add(row)
        session.commit()
        session.refresh(row)
    row.username = str(member)
    row.updated_at = datetime.datetime.utcnow()
    return row


def member_rank(session, guild_id: str, xp: int) -> int:
    higher = session.execute(
        select(func.count()).select_from(MemberXP).where(MemberXP.guild_id == guild_id, MemberXP.xp > xp)
    ).scalar() or 0
    return higher + 1


def multiplier_for(session, guild_id: str, message: discord.Message) -> float:
    total = 1.0
    multipliers = session.execute(
        select(LevelMultiplier).where(LevelMultiplier.guild_id == guild_id, LevelMultiplier.enabled == True)
    ).scalars().all()
    globals_ = [m for m in multipliers if m.type == "global"]
    if globals_:
        total *= sorted(globals_, key=lambda m: m.priority or 0, reverse=True)[0].multiplier or 1.0
    channel = [m for m in multipliers if m.type == "channel" and m.target_id == str(message.channel.id)]
    if channel:
        total *= sorted(channel, key=lambda m: m.priority or 0, reverse=True)[0].multiplier or 1.0
    role_ids = {str(r.id) for r in getattr(message.author, "roles", [])}
    roles = [m for m in multipliers if m.type == "role" and m.target_id in role_ids]
    if roles:
        total *= sorted(roles, key=lambda m: m.priority or 0, reverse=True)[0].multiplier or 1.0
    return max(0.0, total)


class LevelingCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    level = discord.SlashCommandGroup("level", "Leveling system")

    @discord.Cog.listener()
    async def on_message(self, message: discord.Message):
        if not check_feature(self):
            return
        if not message.guild or message.author.bot:
            return
        session = get_session()
        try:
            guild_id = str(message.guild.id)
            cfg = get_or_create_config(session, guild_id)
            if not cfg.enabled:
                return
            author: discord.Member = message.author
            if str(author.id) in (cfg.ignored_users or []):
                return
            role_ids = {str(r.id) for r in getattr(author, "roles", [])}
            if role_ids.intersection(set(cfg.ignored_roles or [])):
                return
            channel_id = str(message.channel.id)
            if cfg.use_channel_whitelist:
                if channel_id not in (cfg.whitelist_channels or []):
                    return
            elif channel_id in (cfg.ignored_channels or []):
                return

            row = get_or_create_member(session, guild_id, author)
            now = datetime.datetime.utcnow()
            if row.last_xp_at and (now - row.last_xp_at).total_seconds() < (cfg.cooldown_seconds or 60):
                return

            base_xp = random.randint(cfg.xp_min or 15, cfg.xp_max or 25)
            gained = int(base_xp * multiplier_for(session, guild_id, message))
            if gained <= 0:
                return
            old_level = row.level or 0
            row.xp = (row.xp or 0) + gained
            row.level = level_from_xp(row.xp)
            row.message_count = (row.message_count or 0) + 1
            row.last_xp_at = now
            row.updated_at = now
            session.commit()

            if row.level > old_level:
                await self._handle_level_up(message, session, cfg, row, old_level)
        finally:
            session.close()

    async def _handle_level_up(self, message: discord.Message, session, cfg: LevelingConfig, row: MemberXP, old_level: int):
        member = message.author
        guild = message.guild
        rewards = session.execute(
            select(LevelReward).where(LevelReward.guild_id == str(guild.id), LevelReward.level <= row.level).order_by(LevelReward.level)
        ).scalars().all()
        latest_reward = None
        for reward in rewards:
            role = guild.get_role(int(reward.role_id)) if reward.role_id else None
            if role and role not in member.roles:
                try:
                    await member.add_roles(role, reason=f"Level reward {reward.level}")
                    latest_reward = reward
                except Exception:
                    pass
        if cfg.remove_old_reward_roles and latest_reward:
            keep = str(latest_reward.role_id)
            for reward in rewards:
                if str(reward.role_id) != keep:
                    role = guild.get_role(int(reward.role_id)) if reward.role_id else None
                    if role and role in member.roles:
                        try:
                            await member.remove_roles(role, reason="Remove old level reward")
                        except Exception:
                            pass

        if cfg.level_up_mode == "off":
            return
        gained, needed, percent = progress_for(row.xp or 0, row.level or 0)
        embed = build_embed("level_up", session, vars={
            "user": str(member), "user.mention": member.mention, "user.id": str(member.id),
            "level": str(row.level), "old_level": str(old_level), "xp": str(row.xp),
            "rank": str(member_rank(session, str(guild.id), row.xp or 0)),
            "progress": f"{gained}/{needed}", "progress_percent": str(percent),
            "next_level_xp": str(xp_for_level((row.level or 0) + 1)),
            "reward.role": f"<@&{latest_reward.role_id}>" if latest_reward else "—",
            "server": guild.name,
        })
        target = message.channel
        if cfg.level_up_mode == "fixed" and cfg.level_up_channel_id:
            target = guild.get_channel(int(cfg.level_up_channel_id)) or target
        if cfg.level_up_mode == "dm":
            try:
                await member.send(embed=embed)
                return
            except Exception:
                pass
        await target.send(embed=embed)

    @level.command(name="rank", description="Xem rank của bạn hoặc thành viên khác")
    async def rank(self, ctx, user: discord.Option(discord.Member, "User", required=False) = None):
        member = user or ctx.author
        session = get_session()
        try:
            row = get_or_create_member(session, str(ctx.guild.id), member)
            gained, needed, percent = progress_for(row.xp or 0, row.level or 0)
            rank = member_rank(session, str(ctx.guild.id), row.xp or 0)
            avatar_bytes = None
            try:
                avatar_bytes = await member.display_avatar.with_size(256).read()
            except Exception:
                avatar_bytes = None
            bot_avatar_bytes = None
            try:
                bot_avatar_bytes = await ctx.bot.user.display_avatar.with_size(64).read()
            except Exception:
                pass
            bot_name = ctx.bot.user.display_name if ctx.bot.user else None
            card = make_rank_card(
                username=str(member),
                display_name=getattr(member, "display_name", str(member)),
                avatar_bytes=avatar_bytes,
                level=row.level or 0,
                rank=rank,
                xp=row.xp or 0,
                progress=gained,
                needed=needed,
                percent=percent,
                bot_name=bot_name,
                bot_avatar_bytes=bot_avatar_bytes,
                **rank_card_settings(get_or_create_config(session, str(ctx.guild.id)), row),
            )
            file = discord.File(card, filename="rank-card.png")
            await ctx.defer()
            await ctx.followup.send(file=file)
        finally:
            session.close()

    @level.command(name="background", description="Chọn background cho rank card của bạn")
    async def background(self, ctx):
        """Show available backgrounds and let user pick one."""
        import os
        session = get_session()
        try:
            cfg = get_or_create_config(session, str(ctx.guild.id))
            bg_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "static", "uploads")
            guild_id = str(ctx.guild.id)

            # Collect available backgrounds
            items = []
            idx = 1
            while True:
                slug = f"rank_bg_{guild_id}_{idx}"
                if not os.path.exists(os.path.join(bg_dir, f"{slug}.png")):
                    break
                items.append(slug)
                idx += 1
            # Legacy single bg
            legacy = f"rank_bg_{guild_id}"
            if os.path.exists(os.path.join(bg_dir, f"{legacy}.png")):
                items.insert(0, legacy)

            if not items:
                await ctx.respond("❌ Server chưa có background nào. Admin hãy upload trên dashboard.", ephemeral=True)
                return

            row = get_or_create_member(session, guild_id, ctx.author)
            current_slug = row.rank_card_bg

            class BgSelect(discord.ui.Select):
                def __init__(self):
                    options = [discord.SelectOption(label="Không có (mặc định server)", value="", default=not current_slug)]
                    for s in items:
                        label = f"Background #{s.split('_')[-1]}" if s != legacy else "Background mặc định"
                        options.append(discord.SelectOption(label=label, value=s, default=(s == current_slug)))
                    super().__init__(placeholder="Chọn background...", options=options[:25])

                async def callback(self_, interaction: discord.Interaction):
                    if interaction.user.id != ctx.author.id:
                        await interaction.response.send_message("Chỉ người gọi lệnh mới chọn được.", ephemeral=True)
                        return
                    sess2 = get_session()
                    try:
                        r2 = get_or_create_member(sess2, guild_id, ctx.author)
                        r2.rank_card_bg = self_.values[0] or None
                        sess2.commit()
                    finally:
                        sess2.close()
                    label = self_.values[0] or "mặc định server"
                    await interaction.response.edit_message(content=f"✅ Đã chọn background: `{label}`", view=None)

            view = discord.ui.View(timeout=60)
            view.add_item(BgSelect())
            await ctx.respond("🖼️ **Chọn background cho rank card của bạn:**", view=view, ephemeral=True)
        finally:
            session.close()

    @level.command(name="backgrounds", description="Xem danh sách background có sẵn")
    async def backgrounds(self, ctx):
        """Display all available backgrounds as a collage."""
        import os
        from PIL import Image as PILImage
        from io import BytesIO
        guild_id = str(ctx.guild.id)
        bg_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "static", "uploads")

        items = []
        idx = 1
        while True:
            slug = f"rank_bg_{guild_id}_{idx}"
            path = os.path.join(bg_dir, f"{slug}.png")
            if not os.path.exists(path):
                break
            items.append((f"#{idx}", path))
            idx += 1
        legacy_path = os.path.join(bg_dir, f"rank_bg_{guild_id}.png")
        if os.path.exists(legacy_path):
            items.insert(0, ("#0", legacy_path))

        if not items:
            await ctx.respond("❌ Server chưa có background nào. Admin hãy upload trên dashboard.", ephemeral=True)
            return

        # Build collage: 3 per row, thumbnail 320x80
        TW, TH = 320, 80
        cols = min(3, len(items))
        rows_count = math.ceil(len(items) / cols)
        collage = PILImage.new("RGBA", (cols * TW, rows_count * TH), (30, 30, 38, 255))
        from PIL import ImageDraw as PIDraw, ImageFont as PIFont
        cd = PIDraw.Draw(collage)
        for i, (label, path) in enumerate(items):
            cx = (i % cols) * TW
            cy = (i // cols) * TH
            try:
                thumb = PILImage.open(path).convert("RGBA").resize((TW, TH), PILImage.Resampling.LANCZOS)
                collage.paste(thumb, (cx, cy))
            except Exception:
                pass
            cd.rectangle((cx, cy, cx + TW - 1, cy + TH - 1), outline=(255, 255, 255, 60), width=1)
            cd.text((cx + 6, cy + 6), label, fill=(255, 255, 255, 220))

        buf = BytesIO()
        collage.save(buf, format="PNG")
        buf.seek(0)
        file = discord.File(buf, filename="backgrounds.png")
        embed = discord.Embed(
            title="🖼️ Danh sách Background",
            description=f"**{len(items)}** background có sẵn. Dùng `/level background` để chọn của bạn.",
            color=0x7C8CFF,
        )
        embed.set_image(url="attachment://backgrounds.png")
        await ctx.respond(embed=embed, file=file)

    @level.command(name="leaderboard", description="Xem bảng xếp hạng level")
    async def leaderboard(self, ctx, page: discord.Option(int, "Trang", min_value=1, required=False) = 1):
        session = get_session()
        try:
            rows = session.execute(
                select(MemberXP).where(MemberXP.guild_id == str(ctx.guild.id)).order_by(MemberXP.xp.desc()).offset((page - 1) * 10).limit(10)
            ).scalars().all()
            lines = []
            for idx, row in enumerate(rows, start=(page - 1) * 10 + 1):
                lines.append(f"`#{idx}` <@{row.discord_id}> — **Lv.{row.level}** • {row.xp} XP")
            embed = discord.Embed(
                title=f"🏆 Level Leaderboard — {ctx.guild.name}",
                description="\n".join(lines) or "Chưa có dữ liệu.",
                color=0xF0B232,
            )
            await ctx.respond(embed=embed)
        finally:
            session.close()

    @level.command(name="give", description="Admin: cộng XP cho user")
    @discord.default_permissions(manage_guild=True)
    async def give(self, ctx, user: discord.Option(discord.Member, "User"), amount: discord.Option(int, "XP", min_value=1)):
        session = get_session()
        try:
            row = get_or_create_member(session, str(ctx.guild.id), user)
            row.xp = (row.xp or 0) + amount
            row.level = level_from_xp(row.xp)
            session.commit()
            await ctx.respond(f"✅ Đã cộng {amount} XP cho {user.mention}.", ephemeral=True)
        finally:
            session.close()

    @level.command(name="reset", description="Admin: reset XP user")
    @discord.default_permissions(manage_guild=True)
    async def reset(self, ctx, user: discord.Option(discord.Member, "User")):
        session = get_session()
        try:
            row = session.execute(select(MemberXP).where(MemberXP.guild_id == str(ctx.guild.id), MemberXP.discord_id == str(user.id))).scalars().first()
            if row:
                row.xp = 0
                row.level = 0
                row.message_count = 0
                session.commit()
            await ctx.respond(f"✅ Đã reset level của {user.mention}.", ephemeral=True)
        finally:
            session.close()
