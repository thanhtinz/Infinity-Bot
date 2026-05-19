"""Onboarding cog — welcome embed on guild join + auto-create configs."""
from __future__ import annotations
import logging
import discord
from discord.ext import commands
from sqlalchemy import select

from src.bot.i18n import t
from src.database.config import SessionLocal

logger = logging.getLogger(__name__)

ACCENT = 0x5865F2   # Discord blurple


def _build_welcome_embed(guild: discord.Guild, bot_name: str) -> discord.Embed:
    gid = str(guild.id)
    embed = discord.Embed(
        title=t(gid, "welcome_title", bot_name=bot_name),
        description=t(gid, "welcome_desc", bot_name=bot_name),
        color=ACCENT,
    )
    embed.set_footer(text="Use /help to see all commands.")
    if guild.icon:
        embed.set_thumbnail(url=guild.icon.url)
    return embed


def _auto_create_guild_configs(guild_id: str, guild_name: str, guild_icon: str | None):
    """Auto-create default config rows for a new guild (idempotent)."""
    from src.models.models import (
        SystemConfig,
        LoggingConfig, AutoModConfig,
        ModerationConfig,
    )

    config_models = [
        (SystemConfig, {"guild_id": guild_id, "guild_name": guild_name, "guild_icon": guild_icon}),
        (LoggingConfig, {"guild_id": guild_id}),
        (AutoModConfig, {"guild_id": guild_id}),
        (ModerationConfig, {"guild_id": guild_id}),
    ]

    try:
        db = SessionLocal()
        # Copy global fields from first SystemConfig row
        first = db.execute(select(SystemConfig).limit(1)).scalars().first()

        for Model, defaults in config_models:
            existing = db.execute(
                select(Model).where(Model.guild_id == guild_id)
            ).scalars().first()
            if existing:
                # Update guild name/icon on SystemConfig if changed
                if Model is SystemConfig:
                    existing.guild_name = guild_name
                    existing.guild_icon = guild_icon
                continue
            row = Model(**defaults)
            if Model is SystemConfig and first:
                row.discord_token = first.discord_token
                row.discord_client_id = first.discord_client_id
                row.discord_client_secret = first.discord_client_secret
                row.public_app_url = first.public_app_url
                row.support_server_url = first.support_server_url
            db.add(row)

        db.commit()
        logger.info(f"Auto-created configs for guild {guild_name} ({guild_id})")
    except Exception as e:
        logger.error(f"Failed to auto-create configs for guild {guild_id}: {e}")
        db.rollback()
    finally:
        db.close()


class OnboardingCog(commands.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_guild_join(self, guild: discord.Guild):
        """Send welcome embed and auto-create configs when bot joins a new server."""
        bot_name = self.bot.user.display_name if self.bot.user else "Infinity Bot"
        guild_icon = str(guild.icon.url) if guild.icon else None

        # Auto-create per-guild config rows
        _auto_create_guild_configs(str(guild.id), guild.name, guild_icon)

        channel = guild.system_channel
        if channel is None or not channel.permissions_for(guild.me).send_messages:
            channel = next(
                (
                    c for c in guild.text_channels
                    if c.permissions_for(guild.me).send_messages
                ),
                None,
            )
        if channel is None:
            logger.warning(f"on_guild_join: no writable channel in {guild.name}")
            return

        try:
            embed = _build_welcome_embed(guild, bot_name)
            await channel.send(embed=embed)
            logger.info(f"Sent welcome to {guild.name} ({guild.id})")
        except Exception as e:
            logger.error(f"on_guild_join send failed: {e}")

    @commands.Cog.listener()
    async def on_ready(self):
        """Sync guild info for all currently joined guilds."""
        for guild in self.bot.guilds:
            guild_icon = str(guild.icon.url) if guild.icon else None
            _auto_create_guild_configs(str(guild.id), guild.name, guild_icon)
        logger.info(f"Synced configs for {len(self.bot.guilds)} guilds on ready")


def setup(bot: discord.Bot):
    bot.add_cog(OnboardingCog(bot))
