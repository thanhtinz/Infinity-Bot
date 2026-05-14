# src/bot/cogs/welcome.py
"""Welcome, Goodbye, Auto Role, DM welcome, Auto nickname."""
import discord
import logging
from discord.ext import commands
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import WelcomeConfig, AutoRoleConfig, SystemConfig
from src.bot.embed_utils import build_embed

logger = logging.getLogger(__name__)


def _get_db():
    return SessionLocal()


class WelcomeCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    def _get_config(self, db, guild_id: str) -> WelcomeConfig | None:
        return db.execute(
            select(WelcomeConfig).where(WelcomeConfig.guild_id == guild_id)
        ).scalars().first()

    def _get_autorole(self, db, guild_id: str) -> AutoRoleConfig | None:
        return db.execute(
            select(AutoRoleConfig).where(AutoRoleConfig.guild_id == guild_id)
        ).scalars().first()

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        guild = member.guild
        guild_id = str(guild.id)
        db = _get_db()
        try:
            cfg = self._get_config(db, guild_id)
            autorole = self._get_autorole(db, guild_id)

            embed_vars = {
                "user.mention": member.mention,
                "user": member.display_name,
                "user.name": str(member),
                "user.id": str(member.id),
                "server": guild.name,
                "member_count": str(guild.member_count),
            }

            # ── Welcome message ──
            if cfg and cfg.welcome_enabled and cfg.welcome_channel_id:
                try:
                    ch = guild.get_channel(int(cfg.welcome_channel_id))
                    if not ch:
                        ch = await guild.fetch_channel(int(cfg.welcome_channel_id))
                    if ch:
                        if cfg.welcome_embed_enabled:
                            embed = build_embed("welcome", db, vars=embed_vars)
                            content = member.mention
                            await ch.send(content=content, embed=embed)
                        elif cfg.welcome_message:
                            msg = cfg.welcome_message
                            for k, v in embed_vars.items():
                                msg = msg.replace("{" + k + "}", str(v))
                            await ch.send(msg)
                except Exception as e:
                    logger.error(f"Welcome channel send error: {e}")

            # ── DM welcome ──
            if cfg and cfg.welcome_dm_enabled and cfg.welcome_dm_message:
                try:
                    dm_msg = cfg.welcome_dm_message
                    for k, v in embed_vars.items():
                        dm_msg = dm_msg.replace("{" + k + "}", str(v))
                    await member.send(dm_msg)
                except discord.Forbidden:
                    logger.debug(f"Cannot DM {member} — DMs disabled")
                except Exception as e:
                    logger.error(f"DM welcome error: {e}")

            # ── Auto nickname ──
            if cfg and cfg.auto_nickname_template:
                try:
                    nick = cfg.auto_nickname_template
                    for k, v in embed_vars.items():
                        nick = nick.replace("{" + k + "}", str(v))
                    nick = nick[:32]  # Discord 32 char limit
                    await member.edit(nick=nick)
                except discord.Forbidden:
                    logger.debug(f"Cannot set nickname for {member}")

            # ── Auto roles ──
            if autorole:
                roles_to_add = autorole.bot_roles if member.bot else autorole.join_roles
                if roles_to_add:
                    role_objs = []
                    for rid in roles_to_add:
                        role = guild.get_role(int(rid))
                        if role:
                            role_objs.append(role)
                    if role_objs:
                        try:
                            await member.add_roles(*role_objs, reason="Auto Role on join")
                        except discord.Forbidden:
                            logger.error(f"Cannot add auto roles to {member}")

        finally:
            db.close()

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member):
        guild = member.guild
        guild_id = str(guild.id)
        db = _get_db()
        try:
            cfg = self._get_config(db, guild_id)
            if not cfg or not cfg.goodbye_enabled or not cfg.goodbye_channel_id:
                return

            embed_vars = {
                "user.mention": member.mention,
                "user": member.display_name,
                "user.name": str(member),
                "user.id": str(member.id),
                "server": guild.name,
                "member_count": str(guild.member_count),
            }

            try:
                ch = guild.get_channel(int(cfg.goodbye_channel_id))
                if not ch:
                    ch = await guild.fetch_channel(int(cfg.goodbye_channel_id))
                if ch:
                    if cfg.goodbye_embed_enabled:
                        embed = build_embed("goodbye", db, vars=embed_vars)
                        await ch.send(embed=embed)
                    elif cfg.goodbye_message:
                        msg = cfg.goodbye_message
                        for k, v in embed_vars.items():
                            msg = msg.replace("{" + k + "}", str(v))
                        await ch.send(msg)
            except Exception as e:
                logger.error(f"Goodbye channel send error: {e}")
        finally:
            db.close()
