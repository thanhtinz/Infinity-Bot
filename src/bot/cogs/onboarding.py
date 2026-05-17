"""Onboarding cog — welcome embed on guild join."""
from __future__ import annotations
import logging
import discord
from discord.ext import commands

from src.bot.i18n import t

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


class OnboardingCog(commands.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_guild_join(self, guild: discord.Guild):
        """Send welcome embed when bot joins a new server."""
        bot_name = self.bot.user.display_name if self.bot.user else "Infinity Bot"

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


def setup(bot: discord.Bot):
    bot.add_cog(OnboardingCog(bot))
