# src/bot/cogs/starboard.py
"""Starboard — pin popular messages to a starboard channel."""
import discord
import logging
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import StarboardConfig, StarboardEntry
from src.bot.base_cog import check_feature

logger = logging.getLogger(__name__)


def get_session():
    return SessionLocal()


class StarboardCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    def _get_config(self, guild_id: str) -> StarboardConfig | None:
        session = get_session()
        try:
            return session.execute(
                select(StarboardConfig).where(
                    StarboardConfig.guild_id == guild_id,
                    StarboardConfig.enabled == True,
                )
            ).scalars().first()
        finally:
            session.close()

    async def _update_starboard(self, payload: discord.RawReactionActionEvent):
        session = get_session()
        try:
            cfg = session.execute(
                select(StarboardConfig).where(
                    StarboardConfig.guild_id == str(payload.guild_id),
                    StarboardConfig.enabled == True,
                )
            ).scalars().first()
            if not cfg or not cfg.channel_id:
                return

            # Check if this channel is ignored
            if str(payload.channel_id) in (cfg.ignored_channels or []):
                return

            # Don't star messages in starboard channel itself
            if str(payload.channel_id) == cfg.channel_id:
                return

            # Check emoji matches
            emoji_str = str(payload.emoji)
            if emoji_str != cfg.emoji:
                return

            # Fetch the message to count reactions
            source_channel = self.bot.get_channel(payload.channel_id)
            if not source_channel:
                return

            try:
                message = await source_channel.fetch_message(payload.message_id)
            except discord.NotFound:
                return

            # Count reactions for the starboard emoji
            star_count = 0
            for reaction in message.reactions:
                if str(reaction.emoji) == cfg.emoji:
                    star_count = reaction.count
                    # Subtract self-star if not allowed
                    if not cfg.self_star:
                        users = [u async for u in reaction.users()]
                        if message.author in users:
                            star_count -= 1
                    break

            # Check/get existing entry
            entry = session.execute(
                select(StarboardEntry).where(
                    StarboardEntry.source_message_id == str(payload.message_id),
                )
            ).scalars().first()

            starboard_channel = self.bot.get_channel(int(cfg.channel_id))
            if not starboard_channel:
                return

            if star_count >= cfg.threshold:
                # Build starboard embed
                embed = discord.Embed(
                    description=message.content[:2048] if message.content else "",
                    color=0xF1C40F,
                    timestamp=message.created_at,
                )
                embed.set_author(
                    name=str(message.author),
                    icon_url=message.author.display_avatar.url,
                )
                embed.add_field(
                    name="Nguồn",
                    value=f"[Nhảy tới tin nhắn]({message.jump_url})",
                    inline=True,
                )
                # Add first image attachment if any
                if message.attachments:
                    att = message.attachments[0]
                    if att.content_type and att.content_type.startswith("image"):
                        embed.set_image(url=att.url)

                header = f"{cfg.emoji} **{star_count}** | <#{payload.channel_id}>"

                if entry and entry.starboard_message_id:
                    # Update existing starboard message
                    try:
                        sb_msg = await starboard_channel.fetch_message(int(entry.starboard_message_id))
                        await sb_msg.edit(content=header, embed=embed)
                    except discord.NotFound:
                        # Re-send if deleted
                        sb_msg = await starboard_channel.send(content=header, embed=embed)
                        entry.starboard_message_id = str(sb_msg.id)
                    entry.star_count = star_count
                    session.commit()
                else:
                    # Create new starboard entry
                    sb_msg = await starboard_channel.send(content=header, embed=embed)
                    if entry:
                        entry.starboard_message_id = str(sb_msg.id)
                        entry.star_count = star_count
                    else:
                        entry = StarboardEntry(
                            guild_id=str(payload.guild_id),
                            source_message_id=str(payload.message_id),
                            source_channel_id=str(payload.channel_id),
                            starboard_message_id=str(sb_msg.id),
                            star_count=star_count,
                            author_id=str(message.author.id),
                        )
                        session.add(entry)
                    session.commit()

            elif entry and entry.starboard_message_id:
                # Below threshold — remove from starboard
                try:
                    sb_msg = await starboard_channel.fetch_message(int(entry.starboard_message_id))
                    await sb_msg.delete()
                except discord.NotFound:
                    pass
                entry.starboard_message_id = None
                entry.star_count = star_count
                session.commit()
        except Exception as e:
            logger.error(f"Starboard error: {e}")
        finally:
            session.close()

    @discord.Cog.listener()
    async def on_raw_reaction_add(self, payload: discord.RawReactionActionEvent):
        if not check_feature(self): return
        if not payload.guild_id or (payload.member and payload.member.bot):
            return
        await self._update_starboard(payload)

    @discord.Cog.listener()
    async def on_raw_reaction_remove(self, payload: discord.RawReactionActionEvent):
        if not check_feature(self): return
        if not payload.guild_id:
            return
        await self._update_starboard(payload)
