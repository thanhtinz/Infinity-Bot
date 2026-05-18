# src/bot/cogs/automod.py
"""AutoMod — anti-spam, anti-link, bad words, caps lock, mention spam."""
import discord
import re
import time
import datetime
import logging
from collections import defaultdict
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import AutoModConfig, Warning
from src.bot.embed_utils import build_embed
from src.bot.base_cog import check_feature

logger = logging.getLogger(__name__)

URL_PATTERN = re.compile(
    r"https?://[^\s<>\"']+|www\.[^\s<>\"']+",
    re.IGNORECASE,
)


def get_session():
    return SessionLocal()


class AutoModCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        # Anti-spam tracking: {guild_id: {user_id: [timestamps]}}
        self._spam_tracker: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))

    def _get_config(self, guild_id: str) -> AutoModConfig | None:
        session = get_session()
        try:
            return session.execute(
                select(AutoModConfig).where(
                    AutoModConfig.guild_id == guild_id,
                    AutoModConfig.enabled == True,
                )
            ).scalars().first()
        finally:
            session.close()

    def _is_exempt(self, cfg: AutoModConfig, member: discord.Member) -> bool:
        """Check if member is exempt from automod."""
        if member.guild_permissions.administrator:
            return True
        member_role_ids = [str(r.id) for r in member.roles]
        for rid in (cfg.ignored_roles or []):
            if rid in member_role_ids:
                return True
        return False

    async def _take_action(
        self,
        action: str,
        member: discord.Member,
        reason: str,
        cfg: AutoModConfig,
        channel: discord.TextChannel,
        content: str = "",
    ):
        """Execute automod action and send log."""
        session = get_session()
        try:
            if action == "warn":
                # Add warning to DB
                session.add(Warning(
                    guild_id=str(member.guild.id),
                    user_id=str(member.id),
                    moderator_id=str(self.bot.user.id),
                    reason=f"[AutoMod] {reason}",
                ))
                session.commit()
                embed = build_embed("automod_warn", session, vars={
                    "user": str(member), "user.mention": member.mention,
                    "reason": reason, "channel": channel.mention,
                    "content": content[:500],
                }, guild_id=str(message.guild.id))

            elif action == "mute":
                try:
                    await member.timeout_for(datetime.timedelta(minutes=5), reason=f"[AutoMod] {reason}")
                except discord.Forbidden:
                    pass
                embed = build_embed("automod_mute", session, vars={
                    "user": str(member), "user.mention": member.mention,
                    "reason": reason, "channel": channel.mention,
                    "duration": "5 minutes", "content": content[:500],
                }, guild_id=str(message.guild.id))

            elif action == "kick":
                try:
                    await member.kick(reason=f"[AutoMod] {reason}")
                except discord.Forbidden:
                    pass
                embed = build_embed("automod_kick", session, vars={
                    "user": str(member), "user.mention": member.mention,
                    "reason": reason, "content": content[:500],
                }, guild_id=str(message.guild.id))

            else:
                embed = build_embed("automod_delete", session, vars={
                    "user": str(member), "user.mention": member.mention,
                    "reason": reason, "channel": channel.mention,
                    "content": content[:500],
                }, guild_id=str(message.guild.id))

            # Send to log channel
            if cfg.log_channel_id:
                try:
                    log_ch = member.guild.get_channel(int(cfg.log_channel_id))
                    if log_ch:
                        await log_ch.send(embed=embed)
                except Exception:
                    pass
        finally:
            session.close()

    @discord.Cog.listener()
    async def on_message(self, message: discord.Message):
        if not check_feature(self): return
        if not message.guild or message.author.bot:
            return
        if not isinstance(message.author, discord.Member):
            return

        cfg = self._get_config(str(message.guild.id))
        if not cfg:
            return

        member = message.author
        if self._is_exempt(cfg, member):
            return

        # Check ignored channels
        if str(message.channel.id) in (cfg.ignored_channels or []):
            return

        violated = False

        # ── Anti-spam ──
        if cfg.anti_spam_enabled and not violated:
            gid = str(message.guild.id)
            uid = str(member.id)
            now = time.time()
            timestamps = self._spam_tracker[gid][uid]
            timestamps.append(now)
            # Clean old timestamps
            interval = cfg.anti_spam_interval or 5
            self._spam_tracker[gid][uid] = [t for t in timestamps if now - t < interval]

            if len(self._spam_tracker[gid][uid]) > (cfg.anti_spam_max_messages or 5):
                violated = True
                try:
                    await message.delete()
                except discord.Forbidden:
                    pass
                await self._take_action(
                    cfg.anti_spam_action or "warn", member,
                    "Spam messages", cfg, message.channel,
                    message.content or "",
                )
                self._spam_tracker[gid][uid] = []

        # ── Anti-link ──
        if cfg.anti_link_enabled and not violated and message.content:
            urls = URL_PATTERN.findall(message.content)
            if urls:
                whitelist = cfg.anti_link_whitelist or []
                has_bad_link = False
                for url in urls:
                    domain = url.split("//")[-1].split("/")[0].lower()
                    if not any(w.lower() in domain for w in whitelist):
                        has_bad_link = True
                        break
                if has_bad_link:
                    violated = True
                    try:
                        await message.delete()
                    except discord.Forbidden:
                        pass
                    await self._take_action(
                        "warn", member,
                        "Unauthorized link sent", cfg, message.channel,
                        message.content,
                    )

        # ── Bad words ──
        if cfg.bad_words_enabled and not violated and message.content:
            content_lower = message.content.lower()
            bad_words = cfg.bad_words_list or []
            for word in bad_words:
                if word.lower() in content_lower:
                    violated = True
                    try:
                        await message.delete()
                    except discord.Forbidden:
                        pass
                    await self._take_action(
                        "warn", member,
                        f"Using prohibited words", cfg, message.channel,
                        message.content,
                    )
                    break

        # ── Caps lock ──
        if cfg.caps_lock_enabled and not violated and message.content:
            text = message.content
            min_len = cfg.caps_lock_min_length or 10
            pct = cfg.caps_lock_percentage or 70
            alpha_chars = [c for c in text if c.isalpha()]
            if len(alpha_chars) >= min_len:
                upper_count = sum(1 for c in alpha_chars if c.isupper())
                upper_pct = (upper_count / len(alpha_chars)) * 100
                if upper_pct >= pct:
                    violated = True
                    try:
                        await message.delete()
                    except discord.Forbidden:
                        pass
                    await self._take_action(
                        "warn", member,
                        "Excessive caps", cfg, message.channel,
                        message.content,
                    )

        # ── Mention spam ──
        if cfg.mention_spam_enabled and not violated:
            max_mentions = cfg.mention_spam_max or 5
            total_mentions = len(message.mentions) + len(message.role_mentions)
            if total_mentions > max_mentions:
                violated = True
                try:
                    await message.delete()
                except discord.Forbidden:
                    pass
                await self._take_action(
                    cfg.mention_spam_action or "warn", member,
                    f"Spam mention ({total_mentions} mentions)", cfg, message.channel,
                    message.content or "",
                )
