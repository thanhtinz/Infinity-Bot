# src/bot/cogs/leveling.py
"""Lurkr-style leveling: XP, rank, leaderboard, rewards, multipliers, voice XP, reputation."""
import datetime
import logging
import math
import random
import discord
from discord.ext import tasks
from sqlalchemy import select, func
from src.database.config import SessionLocal
from src.models.models import LevelingConfig, MemberXP, LevelReward, LevelMultiplier, Reputation, XPHistory
from src.bot.base_cog import check_feature
from src.bot.embed_utils import build_embed
from src.bot.rank_card import make_rank_card

logger = logging.getLogger(__name__)


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
        # Voice XP tracking: "guild_id:user_id" → session info
        self._voice_sessions: dict[str, dict] = {}
        self._voice_xp_tick.start()
        self._weekly_reset_check.start()
        self._daily_analytics.start()

    def cog_unload(self):
        self._voice_xp_tick.cancel()
        self._weekly_reset_check.cancel()
        self._daily_analytics.cancel()

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
            row.last_message_at = now
            row.weekly_xp = (row.weekly_xp or 0) + gained
            row.weekly_messages = (row.weekly_messages or 0) + 1
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
                message_count=row.message_count or 0,
                voice_minutes=row.voice_minutes or 0,
                voice_xp=row.voice_xp or 0,
                rep_score=row.rep_score or 0,
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
    async def leaderboard(self, ctx, page: discord.Option(int, "Trang", min_value=1, required=False) = 1,
                          type: discord.Option(str, "Loại", choices=["all", "text", "voice", "weekly", "rep"], required=False) = "all"):
        session = get_session()
        try:
            q = select(MemberXP).where(MemberXP.guild_id == str(ctx.guild.id))
            if type == "voice":
                q = q.order_by(MemberXP.voice_xp.desc())
            elif type == "text":
                q = q.order_by((MemberXP.xp - MemberXP.voice_xp).desc())
            elif type == "weekly":
                q = q.order_by(MemberXP.weekly_xp.desc())
            elif type == "rep":
                q = q.order_by(MemberXP.rep_score.desc())
            else:
                q = q.order_by(MemberXP.xp.desc())
            rows = session.execute(q.offset((page - 1) * 10).limit(10)).scalars().all()
            lines = []
            type_labels = {"all": "Tổng XP", "text": "Text XP", "voice": "Voice XP", "weekly": "Weekly XP", "rep": "Reputation"}
            for idx, row in enumerate(rows, start=(page - 1) * 10 + 1):
                if type == "voice":
                    val = f"{row.voice_xp or 0} XP • {row.voice_minutes or 0}m"
                elif type == "text":
                    val = f"{(row.xp or 0) - (row.voice_xp or 0)} XP • {row.message_count or 0} msgs"
                elif type == "weekly":
                    val = f"{row.weekly_xp or 0} XP"
                elif type == "rep":
                    val = f"⭐ {row.rep_score or 0}"
                else:
                    val = f"Lv.{row.level} • {row.xp} XP"
                lines.append(f"`#{idx}` <@{row.discord_id}> — {val}")
            emoji_map = {"all": "🏆", "text": "📝", "voice": "🔊", "weekly": "📅", "rep": "⭐"}
            embed = discord.Embed(
                title=f"{emoji_map.get(type, '🏆')} {type_labels.get(type, 'Leaderboard')} — {ctx.guild.name}",
                description="\n".join(lines) or "Chưa có dữ liệu.",
                color=0xF0B232,
            )
            embed.set_footer(text=f"Trang {page}")
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

    # ── Voice XP ──────────────────────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_voice_state_update(self, member: discord.Member, before: discord.VoiceState, after: discord.VoiceState):
        if not check_feature(self) or member.bot:
            return
        key = f"{member.guild.id}:{member.id}"

        # Left voice entirely
        if before.channel and not after.channel:
            self._voice_sessions.pop(key, None)
            return

        # Joined voice
        if not before.channel and after.channel:
            self._voice_sessions[key] = {
                "joined_at": datetime.datetime.utcnow(),
                "last_xp_at": datetime.datetime.utcnow(),
                "guild_id": str(member.guild.id),
                "channel_id": str(after.channel.id),
                "is_streaming": after.self_stream or False,
                "is_camera": after.self_video or False,
                "is_muted": after.self_mute or after.mute or False,
                "is_deafened": after.self_deaf or after.deaf or False,
            }
            return

        # State change (mute/deafen/stream/camera/channel switch)
        if key in self._voice_sessions:
            s = self._voice_sessions[key]
            s["channel_id"] = str(after.channel.id) if after.channel else s["channel_id"]
            s["is_streaming"] = after.self_stream or False
            s["is_camera"] = after.self_video or False
            s["is_muted"] = after.self_mute or after.mute or False
            s["is_deafened"] = after.self_deaf or after.deaf or False

    @tasks.loop(minutes=1)
    async def _voice_xp_tick(self):
        """Award voice XP every minute to eligible users."""
        if not self._voice_sessions:
            return
        now = datetime.datetime.utcnow()
        # Group by guild for config lookup
        guild_sessions: dict[str, list[tuple[str, dict]]] = {}
        for key, s in list(self._voice_sessions.items()):
            guild_sessions.setdefault(s["guild_id"], []).append((key, s))

        session = get_session()
        try:
            for guild_id, entries in guild_sessions.items():
                cfg = get_or_create_config(session, guild_id)
                if not cfg.enabled or not (cfg.voice_xp_enabled if cfg.voice_xp_enabled is not None else True):
                    continue
                xp_per_min = cfg.voice_xp_per_minute or 5
                afk_timeout = cfg.voice_afk_timeout or 5
                solo_ok = cfg.voice_solo_xp or False
                stream_bonus = cfg.voice_stream_bonus or 1.0
                camera_bonus = cfg.voice_camera_bonus or 1.0
                voice_ignored = set(cfg.voice_ignored_channels or [])

                guild = self.bot.get_guild(int(guild_id))
                if not guild:
                    continue

                for key, s in entries:
                    # Skip ignored channels
                    if s["channel_id"] in voice_ignored:
                        continue

                    # AFK check: muted AND deafened for > afk_timeout minutes
                    if s["is_muted"] and s["is_deafened"]:
                        idle_mins = (now - s.get("last_xp_at", now)).total_seconds() / 60
                        if idle_mins >= afk_timeout:
                            continue

                    # Solo check
                    if not solo_ok:
                        ch = guild.get_channel(int(s["channel_id"]))
                        if ch and len([m for m in ch.members if not m.bot]) < 2:
                            continue

                    # Calculate XP
                    gained = xp_per_min
                    if s.get("is_streaming"):
                        gained = int(gained * stream_bonus)
                    if s.get("is_camera"):
                        gained = int(gained * camera_bonus)

                    # Apply multiplier (use guild-level only for voice)
                    mult_rows = session.execute(
                        select(LevelMultiplier).where(
                            LevelMultiplier.guild_id == guild_id,
                            LevelMultiplier.enabled == True,
                            LevelMultiplier.type == "global",
                        )
                    ).scalars().all()
                    if mult_rows:
                        best = sorted(mult_rows, key=lambda m: m.priority or 0, reverse=True)[0]
                        gained = int(gained * (best.multiplier or 1.0))

                    if gained <= 0:
                        continue

                    # Update member XP
                    user_id = key.split(":")[1]
                    member_obj = guild.get_member(int(user_id))
                    if not member_obj:
                        continue
                    row = get_or_create_member(session, guild_id, member_obj)
                    old_level = row.level or 0
                    row.xp = (row.xp or 0) + gained
                    row.voice_xp = (row.voice_xp or 0) + gained
                    row.voice_minutes = (row.voice_minutes or 0) + 1
                    row.weekly_xp = (row.weekly_xp or 0) + gained
                    row.weekly_voice_minutes = (row.weekly_voice_minutes or 0) + 1
                    row.voice_last_active = now
                    row.level = level_from_xp(row.xp)
                    row.updated_at = now
                    s["last_xp_at"] = now

                    # Voice streak: if voice_last_active was yesterday or today, keep streak
                    if row.voice_last_active:
                        last_date = row.voice_last_active.date() if hasattr(row.voice_last_active, 'date') else row.voice_last_active
                        today = now.date()
                        if last_date == today:
                            pass  # same day
                        elif (today - last_date).days == 1:
                            row.voice_streak_days = (row.voice_streak_days or 0) + 1
                        elif (today - last_date).days > 1:
                            row.voice_streak_days = 1

                    if row.level > old_level:
                        # Create a fake message context for level-up
                        ch = guild.get_channel(int(s["channel_id"]))
                        if ch:
                            try:
                                gained_p, needed_p, percent_p = progress_for(row.xp or 0, row.level or 0)
                                embed = build_embed("level_up", session, vars={
                                    "user": str(member_obj), "user.mention": member_obj.mention,
                                    "user.id": str(member_obj.id), "level": str(row.level),
                                    "old_level": str(old_level), "xp": str(row.xp),
                                    "rank": str(member_rank(session, guild_id, row.xp or 0)),
                                    "progress": f"{gained_p}/{needed_p}", "progress_percent": str(percent_p),
                                    "next_level_xp": str(xp_for_level((row.level or 0) + 1)),
                                    "reward.role": "—", "server": guild.name,
                                    "xp_source": "voice",
                                })
                                target = ch
                                if cfg.level_up_mode == "fixed" and cfg.level_up_channel_id:
                                    target = guild.get_channel(int(cfg.level_up_channel_id)) or target
                                if cfg.level_up_mode == "dm":
                                    try:
                                        await member_obj.send(embed=embed)
                                    except Exception:
                                        pass
                                elif cfg.level_up_mode != "off":
                                    await target.send(embed=embed)
                            except Exception as e:
                                logger.error(f"Voice level-up notification error: {e}")

                session.commit()
        except Exception as e:
            logger.error(f"Voice XP tick error: {e}")
        finally:
            session.close()

    @_voice_xp_tick.before_loop
    async def _before_voice_tick(self):
        await self.bot.wait_until_ready()

    # ── Weekly Reset ──────────────────────────────────────────────────────────

    @tasks.loop(hours=1)
    async def _weekly_reset_check(self):
        """Reset weekly stats on configured day."""
        now = datetime.datetime.utcnow()
        if now.weekday() != 1 or now.hour != 0:  # Default: Tuesday 00:00 UTC
            return
        session = get_session()
        try:
            configs = session.execute(select(LevelingConfig).where(LevelingConfig.enabled == True)).scalars().all()
            for cfg in configs:
                reset_day = cfg.weekly_reset_day if cfg.weekly_reset_day is not None else 1
                if now.weekday() != reset_day:
                    continue
                members = session.execute(
                    select(MemberXP).where(MemberXP.guild_id == cfg.guild_id)
                ).scalars().all()
                for m in members:
                    m.weekly_xp = 0
                    m.weekly_messages = 0
                    m.weekly_voice_minutes = 0
                session.commit()
                logger.info(f"Weekly XP reset for guild {cfg.guild_id}")
        except Exception as e:
            logger.error(f"Weekly reset error: {e}")
        finally:
            session.close()

    @_weekly_reset_check.before_loop
    async def _before_weekly_reset(self):
        await self.bot.wait_until_ready()

    # ── Daily Analytics Snapshot ──────────────────────────────────────────────

    @tasks.loop(hours=24)
    async def _daily_analytics(self):
        """Save daily XP snapshot for analytics."""
        session = get_session()
        try:
            today = datetime.date.today()
            configs = session.execute(select(LevelingConfig).where(LevelingConfig.enabled == True)).scalars().all()
            for cfg in configs:
                guild_id = cfg.guild_id
                # Check if already recorded today
                existing = session.execute(
                    select(XPHistory).where(XPHistory.guild_id == guild_id, XPHistory.date == today)
                ).scalars().first()
                if existing:
                    continue
                # Aggregate
                members = session.execute(select(MemberXP).where(MemberXP.guild_id == guild_id)).scalars().all()
                total_text = sum((m.xp or 0) - (m.voice_xp or 0) for m in members)
                total_voice = sum(m.voice_xp or 0 for m in members)
                total_msgs = sum(m.message_count or 0 for m in members)
                total_voice_mins = sum(m.voice_minutes or 0 for m in members)
                yesterday = today - datetime.timedelta(days=1)
                active = sum(1 for m in members if m.updated_at and m.updated_at.date() >= yesterday)
                snapshot = XPHistory(
                    guild_id=guild_id, date=today,
                    total_text_xp=total_text, total_voice_xp=total_voice,
                    active_members=active, messages_count=total_msgs,
                    voice_minutes=total_voice_mins,
                )
                session.add(snapshot)
            session.commit()
        except Exception as e:
            logger.error(f"Daily analytics error: {e}")
        finally:
            session.close()

    @_daily_analytics.before_loop
    async def _before_daily_analytics(self):
        await self.bot.wait_until_ready()

    # ── /level remove ─────────────────────────────────────────────────────────

    @level.command(name="remove", description="Admin: trừ XP user")
    @discord.default_permissions(manage_guild=True)
    async def remove(self, ctx, user: discord.Option(discord.Member, "User"), amount: discord.Option(int, "XP", min_value=1)):
        session = get_session()
        try:
            row = get_or_create_member(session, str(ctx.guild.id), user)
            row.xp = max(0, (row.xp or 0) - amount)
            row.level = level_from_xp(row.xp)
            session.commit()
            await ctx.respond(f"✅ Đã trừ {amount} XP của {user.mention}. XP hiện tại: {row.xp}", ephemeral=True)
        finally:
            session.close()

    # ── /level reward add / remove ────────────────────────────────────────────

    reward = level.create_subgroup("reward", "Quản lý level rewards")

    @reward.command(name="add", description="Admin: thêm reward role cho level")
    @discord.default_permissions(manage_guild=True)
    async def reward_add(self, ctx, level_num: discord.Option(int, "Level", min_value=1),
                         role: discord.Option(discord.Role, "Role")):
        session = get_session()
        try:
            existing = session.execute(
                select(LevelReward).where(
                    LevelReward.guild_id == str(ctx.guild.id),
                    LevelReward.level == level_num,
                    LevelReward.role_id == str(role.id),
                )
            ).scalars().first()
            if existing:
                await ctx.respond(f"❌ Role {role.mention} đã là reward cho level {level_num}.", ephemeral=True)
                return
            reward_obj = LevelReward(
                guild_id=str(ctx.guild.id), level=level_num,
                role_id=str(role.id), role_name=role.name,
            )
            session.add(reward_obj)
            session.commit()
            await ctx.respond(f"✅ Đã thêm reward {role.mention} cho level {level_num}.", ephemeral=True)
        finally:
            session.close()

    @reward.command(name="remove", description="Admin: xóa reward role")
    @discord.default_permissions(manage_guild=True)
    async def reward_remove(self, ctx, level_num: discord.Option(int, "Level", min_value=1),
                            role: discord.Option(discord.Role, "Role")):
        session = get_session()
        try:
            row = session.execute(
                select(LevelReward).where(
                    LevelReward.guild_id == str(ctx.guild.id),
                    LevelReward.level == level_num,
                    LevelReward.role_id == str(role.id),
                )
            ).scalars().first()
            if not row:
                await ctx.respond(f"❌ Không tìm thấy reward đó.", ephemeral=True)
                return
            session.delete(row)
            session.commit()
            await ctx.respond(f"✅ Đã xóa reward {role.mention} ở level {level_num}.", ephemeral=True)
        finally:
            session.close()

    # ── /level rep ────────────────────────────────────────────────────────────

    @level.command(name="rep", description="Tặng điểm uy tín cho thành viên")
    async def rep(self, ctx, user: discord.Option(discord.Member, "User"),
                  reason: discord.Option(str, "Lý do", required=False) = None):
        if user.id == ctx.author.id:
            await ctx.respond("❌ Bạn không thể rep chính mình.", ephemeral=True)
            return
        if user.bot:
            await ctx.respond("❌ Không thể rep bot.", ephemeral=True)
            return
        session = get_session()
        try:
            today = datetime.date.today()
            existing = session.execute(
                select(Reputation).where(
                    Reputation.guild_id == str(ctx.guild.id),
                    Reputation.from_user_id == str(ctx.author.id),
                    Reputation.to_user_id == str(user.id),
                    Reputation.date == today,
                )
            ).scalars().first()
            if existing:
                await ctx.respond("❌ Bạn đã rep người này hôm nay rồi. Thử lại ngày mai.", ephemeral=True)
                return
            rep_entry = Reputation(
                guild_id=str(ctx.guild.id),
                from_user_id=str(ctx.author.id),
                to_user_id=str(user.id),
                reason=reason, date=today,
            )
            session.add(rep_entry)
            # Update scores
            sender_row = get_or_create_member(session, str(ctx.guild.id), ctx.author)
            sender_row.rep_given = (sender_row.rep_given or 0) + 1
            target_row = get_or_create_member(session, str(ctx.guild.id), user)
            target_row.rep_score = (target_row.rep_score or 0) + 1
            session.commit()
            embed = build_embed("rep_given", session, vars={
                "user": str(ctx.author), "user.mention": ctx.author.mention,
                "target": str(user), "target.mention": user.mention,
                "target.rep": str(target_row.rep_score),
                "reason": reason or "Không có lý do",
                "server": ctx.guild.name,
            })
            await ctx.respond(embed=embed)
        finally:
            session.close()

    # ── /level setup ──────────────────────────────────────────────────────────

    @level.command(name="setup", description="Admin: thiết lập nhanh hệ thống level")
    @discord.default_permissions(manage_guild=True)
    async def setup(self, ctx):
        session = get_session()
        try:
            cfg = get_or_create_config(session, str(ctx.guild.id))
            session.close()
        except Exception:
            session.close()

        class SetupView(discord.ui.View):
            def __init__(self):
                super().__init__(timeout=120)
                self.cfg_data = {
                    "enabled": True, "xp_min": 15, "xp_max": 25,
                    "cooldown_seconds": 60, "level_up_mode": "current",
                    "voice_xp_enabled": True, "voice_xp_per_minute": 5,
                }

            @discord.ui.button(label="✅ Bật Level System", style=discord.ButtonStyle.success)
            async def enable(self_, button, interaction):
                if interaction.user.id != ctx.author.id:
                    return await interaction.response.send_message("❌", ephemeral=True)
                self_.cfg_data["enabled"] = True
                await interaction.response.edit_message(
                    content="✅ Level system **BẬT**. Chọn chế độ thông báo level up:",
                    view=ModeView(self_.cfg_data),
                )

            @discord.ui.button(label="❌ Tắt Level System", style=discord.ButtonStyle.danger)
            async def disable(self_, button, interaction):
                if interaction.user.id != ctx.author.id:
                    return await interaction.response.send_message("❌", ephemeral=True)
                s = get_session()
                try:
                    c = get_or_create_config(s, str(ctx.guild.id))
                    c.enabled = False
                    s.commit()
                finally:
                    s.close()
                await interaction.response.edit_message(content="❌ Level system đã **TẮT**.", view=None)

        class ModeView(discord.ui.View):
            def __init__(self_, cfg_data):
                super().__init__(timeout=120)
                self_.cfg_data = cfg_data

            @discord.ui.select(
                placeholder="Chế độ thông báo level up",
                options=[
                    discord.SelectOption(label="Kênh hiện tại", value="current", description="Thông báo ở kênh user chat"),
                    discord.SelectOption(label="Kênh cố định", value="fixed", description="Gửi đến 1 kênh cố định"),
                    discord.SelectOption(label="DM", value="dm", description="Gửi DM cho user"),
                    discord.SelectOption(label="Tắt", value="off", description="Không thông báo"),
                ],
            )
            async def mode_select(self_, select, interaction):
                if interaction.user.id != ctx.author.id:
                    return await interaction.response.send_message("❌", ephemeral=True)
                self_.cfg_data["level_up_mode"] = select.values[0]
                await interaction.response.edit_message(
                    content=f"📢 Chế độ: **{select.values[0]}**. Chọn voice XP:",
                    view=VoiceView(self_.cfg_data),
                )

        class VoiceView(discord.ui.View):
            def __init__(self_, cfg_data):
                super().__init__(timeout=120)
                self_.cfg_data = cfg_data

            @discord.ui.button(label="🔊 Bật Voice XP", style=discord.ButtonStyle.success)
            async def voice_on(self_, button, interaction):
                if interaction.user.id != ctx.author.id:
                    return await interaction.response.send_message("❌", ephemeral=True)
                self_.cfg_data["voice_xp_enabled"] = True
                await self_._save(interaction)

            @discord.ui.button(label="🔇 Tắt Voice XP", style=discord.ButtonStyle.secondary)
            async def voice_off(self_, button, interaction):
                if interaction.user.id != ctx.author.id:
                    return await interaction.response.send_message("❌", ephemeral=True)
                self_.cfg_data["voice_xp_enabled"] = False
                await self_._save(interaction)

            async def _save(self_, interaction):
                s = get_session()
                try:
                    c = get_or_create_config(s, str(ctx.guild.id))
                    for k, v in self_.cfg_data.items():
                        if hasattr(c, k):
                            setattr(c, k, v)
                    s.commit()
                finally:
                    s.close()
                voice_status = "BẬT 🔊" if self_.cfg_data["voice_xp_enabled"] else "TẮT 🔇"
                summary = (
                    f"✅ **Setup hoàn tất!**\n\n"
                    f"📊 Level System: **BẬT**\n"
                    f"📢 Level Up Mode: **{self_.cfg_data['level_up_mode']}**\n"
                    f"🔊 Voice XP: **{voice_status}**\n"
                    f"⚡ XP/tin nhắn: **{self_.cfg_data['xp_min']}-{self_.cfg_data['xp_max']}**\n"
                    f"⏱️ Cooldown: **{self_.cfg_data['cooldown_seconds']}s**\n\n"
                    f"💡 Tùy chỉnh thêm trên Dashboard → Level System"
                )
                await interaction.response.edit_message(content=summary, view=None)

        await ctx.respond("⚙️ **Level System Setup**\n\nBật hoặc tắt hệ thống level:", view=SetupView(), ephemeral=True)
