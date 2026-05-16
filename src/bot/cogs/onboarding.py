"""Onboarding cog — welcome embed on guild join + /language command."""
from __future__ import annotations
import logging
import discord
from discord.ext import commands

from src.bot.i18n import t, get_lang, set_lang

logger = logging.getLogger(__name__)

ACCENT = 0x5865F2   # Discord blurple


def _has_manage_guild(user: discord.Member | discord.User) -> bool:
    if isinstance(user, discord.Member):
        return user.guild_permissions.manage_guild
    return False


def _build_welcome_embed(guild: discord.Guild, bot_name: str) -> discord.Embed:
    gid = str(guild.id)
    embed = discord.Embed(
        title=t(gid, "welcome_title", bot_name=bot_name),
        description=t(gid, "welcome_desc", bot_name=bot_name),
        color=ACCENT,
    )
    embed.set_footer(text=t(gid, "welcome_footer"))
    if guild.icon:
        embed.set_thumbnail(url=guild.icon.url)
    return embed


# ── Persistent language-select view ──────────────────────────────────────────

class LanguageSelectView(discord.ui.View):
    """Persistent view (no timeout) — survives bot restarts."""

    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(
        label="🇬🇧  English",
        style=discord.ButtonStyle.primary,
        custom_id="lang_select:en",
    )
    async def btn_english(self, button: discord.ui.Button, interaction: discord.Interaction):
        await self._handle(interaction, "en")

    @discord.ui.button(
        label="🇻🇳  Tiếng Việt",
        style=discord.ButtonStyle.secondary,
        custom_id="lang_select:vi",
    )
    async def btn_vietnamese(self, button: discord.ui.Button, interaction: discord.Interaction):
        await self._handle(interaction, "vi")

    async def _handle(self, interaction: discord.Interaction, lang: str):
        if not _has_manage_guild(interaction.user):
            await interaction.response.send_message(
                t(str(interaction.guild_id), "lang_no_perm"),
                ephemeral=True,
            )
            return

        set_lang(str(interaction.guild_id), lang)

        key = "lang_set_en" if lang == "en" else "lang_set_vi"
        confirm_text = t(str(interaction.guild_id), key)

        embed = discord.Embed(description=confirm_text, color=0x57F287)

        # Disable buttons after selection
        view = discord.ui.View()
        view.add_item(discord.ui.Button(
            label="🇬🇧  English",
            style=discord.ButtonStyle.primary if lang == "en" else discord.ButtonStyle.secondary,
            disabled=True,
            custom_id="lang_done:en",
        ))
        view.add_item(discord.ui.Button(
            label="🇻🇳  Tiếng Việt",
            style=discord.ButtonStyle.primary if lang == "vi" else discord.ButtonStyle.secondary,
            disabled=True,
            custom_id="lang_done:vi",
        ))

        await interaction.response.edit_message(embed=embed, view=view)


# ── Cog ──────────────────────────────────────────────────────────────────────

class OnboardingCog(commands.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_guild_join(self, guild: discord.Guild):
        """Send welcome embed + language select when bot joins a new server."""
        bot_name = self.bot.user.display_name if self.bot.user else "Infinity Bot"

        # Find best channel to send to
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
            # Add "select language" prompt as a field
            embed.add_field(
                name="\u200b",
                value=t(str(guild.id), "welcome_select_lang"),
                inline=False,
            )
            await channel.send(embed=embed, view=LanguageSelectView())
            logger.info(f"Sent welcome to {guild.name} ({guild.id})")
        except Exception as e:
            logger.error(f"on_guild_join send failed: {e}")

    @discord.slash_command(
        name="language",
        description="Change the bot language for this server / Đổi ngôn ngữ bot",
    )
    @discord.default_permissions(manage_guild=True)
    async def language_cmd(self, ctx: discord.ApplicationContext):
        gid = str(ctx.guild_id)
        prompt = t(gid, "lang_prompt")
        embed = discord.Embed(description=prompt, color=ACCENT)
        current = get_lang(gid)
        embed.set_footer(text=f"Current: {'🇬🇧 English' if current == 'en' else '🇻🇳 Tiếng Việt'}")
        await ctx.respond(embed=embed, view=LanguageSelectView(), ephemeral=True)


def setup(bot: discord.Bot):
    bot.add_cog(OnboardingCog(bot))
