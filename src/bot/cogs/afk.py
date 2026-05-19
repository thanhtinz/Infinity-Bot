# src/bot/cogs/afk.py
"""AFK system — set AFK status and auto-reply when mentioned."""
import discord
import datetime
import logging
from sqlalchemy import select, delete
from src.database.config import SessionLocal
from src.models.models import AFKStatus
from src.bot.embed_utils import build_embed
from src.bot.base_cog import check_feature

logger = logging.getLogger(__name__)


def get_session():
    return SessionLocal()


def _format_duration(seconds: float) -> str:
    """Format seconds into human-readable duration."""
    if seconds < 60:
        return f"{int(seconds)} seconds"
    elif seconds < 3600:
        return f"{int(seconds // 60)} minutes"
    elif seconds < 86400:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        return f"{h} hours {m} minutes" if m else f"{h} hours"
    else:
        d = int(seconds // 86400)
        h = int((seconds % 86400) // 3600)
        return f"{d} days {h} hours" if h else f"{d} days"


class AFKCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        # In-memory tracking of auto-reply counts per (guild_id, user_id)
        self._afk_reply_counts: dict[tuple[str, str], int] = {}

    @discord.slash_command(name="afk", description="Set AFK status")
    async def afk_cmd(
        self,
        ctx: discord.ApplicationContext,
        reason: discord.Option(str, "AFK reason", required=False, default="AFK"),
    ):
        session = get_session()
        try:
            existing = session.execute(
                select(AFKStatus).where(
                    AFKStatus.guild_id == str(ctx.guild.id),
                    AFKStatus.user_id == str(ctx.author.id),
                )
            ).scalars().first()

            if existing:
                existing.reason = reason
                existing.set_at = datetime.datetime.utcnow()
            else:
                session.add(AFKStatus(
                    guild_id=str(ctx.guild.id),
                    user_id=str(ctx.author.id),
                    reason=reason,
                ))
            session.commit()

            # Reset reply count
            key = (str(ctx.guild.id), str(ctx.author.id))
            self._afk_reply_counts[key] = 0

            # Try to add [AFK] prefix to nickname
            try:
                if not ctx.author.display_name.startswith("[AFK]"):
                    nick = f"[AFK] {ctx.author.display_name}"[:32]
                    await ctx.author.edit(nick=nick)
            except discord.Forbidden:
                pass

            embed = build_embed("afk_set", session, vars={
                "user": str(ctx.author),
                "user.mention": ctx.author.mention,
                "reason": reason,
            }, guild_id=str(ctx.guild.id))
            await ctx.respond(embed=embed)
        finally:
            session.close()

    @discord.Cog.listener()
    async def on_message(self, message: discord.Message):
        if not check_feature(self):
            return
        if not message.guild or message.author.bot:
            return

        session = get_session()
        try:
            # Check if author is AFK → remove AFK status
            author_afk = session.execute(
                select(AFKStatus).where(
                    AFKStatus.guild_id == str(message.guild.id),
                    AFKStatus.user_id == str(message.author.id),
                )
            ).scalars().first()

            if author_afk:
                duration_sec = (datetime.datetime.utcnow() - author_afk.set_at).total_seconds()
                duration_text = _format_duration(duration_sec)

                # Get reply count before removing
                key = (str(message.guild.id), str(message.author.id))
                reply_count = self._afk_reply_counts.pop(key, 0)

                session.delete(author_afk)
                session.commit()

                # Restore nickname
                try:
                    if message.author.display_name.startswith("[AFK]"):
                        nick = message.author.display_name[6:].strip() or None
                        await message.author.edit(nick=nick)
                except discord.Forbidden:
                    pass

                embed = build_embed("afk_return", session, vars={
                    "user": str(message.author),
                    "user.mention": message.author.mention,
                    "duration": duration_text,
                    "reply_count": str(reply_count),
                }, guild_id=str(message.guild.id))

                # Add reply count info if any
                if reply_count > 0:
                    embed.add_field(
                        name="Messages while away",
                        value=f"You received {reply_count} mention(s) while AFK.",
                        inline=False,
                    )

                await message.channel.send(embed=embed, delete_after=10)

            # Check if any mentioned users are AFK
            if message.mentions:
                for user in message.mentions:
                    if user.bot:
                        continue
                    afk = session.execute(
                        select(AFKStatus).where(
                            AFKStatus.guild_id == str(message.guild.id),
                            AFKStatus.user_id == str(user.id),
                        )
                    ).scalars().first()
                    if afk:
                        duration_sec = (datetime.datetime.utcnow() - afk.set_at).total_seconds()
                        duration_text = _format_duration(duration_sec)

                        # Increment reply count
                        afk_key = (str(message.guild.id), str(user.id))
                        self._afk_reply_counts[afk_key] = self._afk_reply_counts.get(afk_key, 0) + 1

                        # Use a nice embed for the auto-reply
                        embed = build_embed("afk_mention", session, vars={
                            "user": str(user),
                            "user.mention": user.mention,
                            "reason": afk.reason,
                            "duration": duration_text,
                        }, guild_id=str(message.guild.id))
                        await message.channel.send(embed=embed, delete_after=10)
        finally:
            session.close()
