# src/bot/cogs/stats_channels.py
"""Stats Channels — auto-updating voice channel names showing server statistics."""
import discord
import datetime
import logging
from discord.ext import tasks
from sqlalchemy import select, func
from src.database.config import SessionLocal
from src.models.models import StatsChannel, Feedback
from src.bot.base_cog import check_feature

logger = logging.getLogger(__name__)


def get_session():
    return SessionLocal()


class StatsChannelsCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        self._stats_update.start()

    def cog_unload(self):
        self._stats_update.cancel()

    # ── Background task: update stats channels ──

    @tasks.loop(minutes=5)
    async def _stats_update(self):
        session = get_session()
        try:
            stats = session.execute(
                select(StatsChannel)
            ).scalars().all()

            for sc in stats:
                guild = self.bot.get_guild(int(sc.guild_id))
                if not guild:
                    continue

                channel = guild.get_channel(int(sc.channel_id))
                if not channel:
                    logger.warning(f"StatsChannel {sc.id}: channel {sc.channel_id} not found")
                    continue

                value = await self._compute_value(sc.stat_type, guild, session)
                if value is None:
                    continue

                new_name = sc.format_template.replace("{value}", str(value))
                try:
                    await channel.edit(name=new_name, reason="Stats channel auto-update")
                except discord.Forbidden:
                    logger.warning(f"No permission to edit channel {sc.channel_id}")
                except discord.HTTPException as e:
                    logger.error(f"Failed to update stats channel {sc.id}: {e}")
        except Exception as e:
            logger.error(f"Stats update loop error: {e}")
        finally:
            session.close()

    @_stats_update.before_loop
    async def before_stats_update(self):
        await self.bot.wait_until_ready()

    async def _compute_value(self, stat_type: str, guild: discord.Guild, session) -> str | None:
        """Compute the stat value for a given type."""
        try:
            if stat_type == "members":
                return str(guild.member_count)
            elif stat_type == "online":
                count = len([m for m in guild.members if m.status != discord.Status.offline])
                return str(count)
            elif stat_type == "boosts":
                return str(guild.premium_subscription_count or 0)
            elif stat_type == "roles":
                return str(len(guild.roles))
            elif stat_type == "channels":
                return str(len(guild.channels))
            elif stat_type == "avg_rating":
                avg = session.execute(
                    select(func.avg(Feedback.stars)).where(
                        Feedback.guild_id == str(guild.id)
                    )
                ).scalar()
                if avg:
                    return f"{avg:.1f}"
                return "0.0"
            else:
                logger.warning(f"Unknown stat type: {stat_type}")
                return None
        except Exception as e:
            logger.error(f"Error computing stat {stat_type}: {e}")
            return None

    # ── Slash commands ──

    stats_group = discord.SlashCommandGroup("stats-channel", "Stats channel management")

    @stats_group.command(name="add", description="Add a stats voice channel")
    @discord.default_permissions(manage_guild=True)
    async def stats_add(
        self,
        ctx: discord.ApplicationContext,
        channel: discord.Option(discord.VoiceChannel, "Voice channel to use"),
        type: discord.Option(str, "Stat type", choices=["members", "online", "boosts", "roles", "channels", "avg_rating"]),
        format: discord.Option(str, "Format template (use {value} placeholder)", required=False, default="{value}"),
    ):
        session = get_session()
        try:
            sc = StatsChannel(
                guild_id=str(ctx.guild.id),
                channel_id=str(channel.id),
                stat_type=type,
                format_template=format,
            )
            session.add(sc)
            session.commit()
            session.refresh(sc)

            # Immediately update the channel name
            value = await self._compute_value(type, ctx.guild, session)
            if value is not None:
                new_name = format.replace("{value}", str(value))
                try:
                    await channel.edit(name=new_name, reason="Stats channel setup")
                except discord.Forbidden:
                    pass

            await ctx.respond(
                f"Added stats channel #{sc.id} ({type}) to {channel.mention}.",
                ephemeral=True,
            )
        except Exception as e:
            logger.error(f"stats_add error: {e}")
            await ctx.respond(f"Failed to add stats channel: {e}", ephemeral=True)
        finally:
            session.close()

    @stats_group.command(name="remove", description="Remove a stats channel")
    @discord.default_permissions(manage_guild=True)
    async def stats_remove(
        self,
        ctx: discord.ApplicationContext,
        id: discord.Option(int, "Stats channel ID to remove"),
    ):
        session = get_session()
        try:
            sc = session.get(StatsChannel, id)
            if not sc or sc.guild_id != str(ctx.guild.id):
                await ctx.respond("Stats channel not found.", ephemeral=True)
                return

            session.delete(sc)
            session.commit()
            await ctx.respond(f"Removed stats channel #{id}.", ephemeral=True)
        except Exception as e:
            logger.error(f"stats_remove error: {e}")
            await ctx.respond(f"Failed to remove stats channel: {e}", ephemeral=True)
        finally:
            session.close()

    @stats_group.command(name="list", description="List configured stats channels")
    async def stats_list(self, ctx: discord.ApplicationContext):
        session = get_session()
        try:
            channels = session.execute(
                select(StatsChannel).where(StatsChannel.guild_id == str(ctx.guild.id))
            ).scalars().all()

            if not channels:
                await ctx.respond("No stats channels configured.", ephemeral=True)
                return

            lines = []
            for sc in channels:
                ch = ctx.guild.get_channel(int(sc.channel_id))
                ch_name = ch.mention if ch else f"Unknown ({sc.channel_id})"
                lines.append(f"**#{sc.id}** | {ch_name} | type: {sc.stat_type} | format: `{sc.format_template}`")

            embed = discord.Embed(
                title="Stats Channels",
                description="\n".join(lines),
                color=0x5865F2,
                timestamp=datetime.datetime.utcnow(),
            )
            await ctx.respond(embed=embed, ephemeral=True)
        except Exception as e:
            logger.error(f"stats_list error: {e}")
            await ctx.respond(f"Failed to list stats channels: {e}", ephemeral=True)
        finally:
            session.close()


def setup(bot: discord.Bot):
    bot.add_cog(StatsChannelsCog(bot))
