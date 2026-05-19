# src/bot/cogs/polls.py
"""Poll system — create polls with button voting, auto-end, and results."""
import discord
import asyncio
import datetime
import logging
from discord.ext import tasks
from sqlalchemy import select, func
from src.database.config import SessionLocal
from src.models.models import Poll, PollVote
from src.bot.embed_utils import build_embed
from src.bot.base_cog import check_feature

logger = logging.getLogger(__name__)


def get_session():
    return SessionLocal()


def parse_duration(s: str) -> int:
    """Parse duration strings like '30s', '5m', '2h', '1d' into seconds."""
    import re
    s = s.strip().lower()
    match = re.fullmatch(r"(\d+)\s*(s|m|h|d)", s)
    if match:
        amount = int(match.group(1))
        unit = match.group(2)
        multipliers = {"s": 1, "m": 60, "h": 3600, "d": 86400}
        return amount * multipliers[unit]
    try:
        return int(s) * 60
    except ValueError:
        return 3600  # default 1h


def _build_results_text(poll: Poll, votes: list) -> str:
    """Build text-based bar chart for poll results."""
    options = poll.options or []
    total_votes = len(votes)
    lines = []

    for i, option in enumerate(options):
        count = sum(1 for v in votes if v.option_index == i)
        pct = (count / total_votes * 100) if total_votes > 0 else 0
        filled = int(pct / 100 * 10)
        bar = chr(9608) * filled + chr(9617) * (10 - filled)
        lines.append(f"**{i + 1}. {option}**: {bar} {pct:.0f}% ({count})")

    lines.append(f"\nTotal votes: {total_votes}")
    return "\n".join(lines)


# ── Voting View ──

class PollVoteView(discord.ui.View):
    """Persistent view with one button per poll option."""

    def __init__(self, poll_id: int, options: list, multiple_choice: bool = False):
        super().__init__(timeout=None)
        self.poll_id = poll_id
        self.multiple_choice = multiple_choice

        for i, option in enumerate(options[:10]):  # Max 10 options
            self.add_item(PollVoteButton(
                index=i,
                label=option[:80],
                poll_id=poll_id,
                multiple_choice=multiple_choice,
            ))


class PollVoteButton(discord.ui.Button):
    def __init__(self, index: int, label: str, poll_id: int, multiple_choice: bool):
        super().__init__(
            label=label,
            style=discord.ButtonStyle.primary,
            custom_id=f"poll:{poll_id}:{index}",
            row=index // 5,
        )
        self.index = index
        self.poll_id = poll_id
        self.multiple_choice = multiple_choice

    async def callback(self, interaction: discord.Interaction):
        session = get_session()
        try:
            poll = session.get(Poll, self.poll_id)
            if not poll or poll.ended:
                await interaction.response.send_message("This poll has ended.", ephemeral=True)
                return

            user_id = str(interaction.user.id)

            # Check existing votes
            existing = session.execute(
                select(PollVote).where(
                    PollVote.poll_id == self.poll_id,
                    PollVote.user_id == user_id,
                )
            ).scalars().all()

            if not self.multiple_choice:
                if existing:
                    await interaction.response.send_message(
                        "You have already voted in this poll. Use the results command to see current standings.",
                        ephemeral=True,
                    )
                    return
            else:
                # Multiple choice: check if already voted for this option
                for v in existing:
                    if v.option_index == self.index:
                        await interaction.response.send_message(
                            "You have already voted for this option.",
                            ephemeral=True,
                        )
                        return

            vote = PollVote(
                poll_id=self.poll_id,
                user_id=user_id,
                option_index=self.index,
            )
            session.add(vote)
            session.commit()

            await interaction.response.send_message("Vote recorded!", ephemeral=True)
        except Exception as e:
            logger.error(f"Poll vote error: {e}")
            try:
                await interaction.response.send_message(f"Failed to record vote: {e}", ephemeral=True)
            except Exception:
                pass
        finally:
            session.close()


async def end_poll(bot: discord.Bot, poll_id: int):
    """End a poll and post results."""
    session = get_session()
    try:
        poll = session.get(Poll, poll_id)
        if not poll or poll.ended:
            return

        votes = session.execute(
            select(PollVote).where(PollVote.poll_id == poll_id)
        ).scalars().all()

        poll.ended = True
        session.commit()

        results_text = _build_results_text(poll, votes)

        # Edit original message
        channel = bot.get_channel(int(poll.channel_id))
        if channel:
            try:
                message = None
                if poll.message_id:
                    message = channel.get_partial_message(int(poll.message_id))

                embed = build_embed("poll_ended", session, vars={
                    "question": poll.question,
                    "results": results_text,
                }, guild_id=str(poll.guild_id))

                if message:
                    try:
                        await message.edit(embed=embed, view=None)
                    except Exception:
                        await channel.send(embed=embed)
                else:
                    await channel.send(embed=embed)
            except Exception as e:
                logger.error(f"Failed to edit poll message: {e}")
    except Exception as e:
        logger.error(f"end_poll error: {e}")
    finally:
        session.close()


# ── Cog ──

class PollsCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        self._poll_check.start()

    def cog_unload(self):
        self._poll_check.cancel()

    # ── Background task: check ended polls ──

    @tasks.loop(seconds=60)
    async def _poll_check(self):
        session = get_session()
        try:
            now = datetime.datetime.utcnow()
            polls = session.execute(
                select(Poll).where(
                    Poll.end_time <= now,
                    Poll.ended == False,
                )
            ).scalars().all()

            for poll in polls:
                await end_poll(self.bot, poll.id)
        except Exception as e:
            logger.error(f"Poll check loop error: {e}")
        finally:
            session.close()

    @_poll_check.before_loop
    async def before_poll_check(self):
        await self.bot.wait_until_ready()

    # ── Slash commands ──

    poll_group = discord.SlashCommandGroup("poll", "Poll commands")

    @poll_group.command(name="create", description="Create a new poll")
    async def poll_create(
        self,
        ctx: discord.ApplicationContext,
        question: discord.Option(str, "Poll question"),
        options: discord.Option(str, "Options (comma-separated, max 10)"),
        duration: discord.Option(str, "Duration (e.g. 1h, 30m)", required=False, default="1h"),
        anonymous: discord.Option(bool, "Anonymous poll", required=False, default=False),
        multiple: discord.Option(bool, "Allow multiple choices", required=False, default=False),
    ):
        option_list = [o.strip() for o in options.split(",") if o.strip()]
        if len(option_list) < 2:
            await ctx.respond("You need at least 2 options.", ephemeral=True)
            return
        if len(option_list) > 10:
            option_list = option_list[:10]

        seconds = parse_duration(duration)
        end_time = datetime.datetime.utcnow() + datetime.timedelta(seconds=seconds)

        session = get_session()
        try:
            poll = Poll(
                guild_id=str(ctx.guild.id),
                channel_id=str(ctx.channel.id),
                question=question,
                options=option_list,
                end_time=end_time,
                anonymous=anonymous,
                multiple_choice=multiple,
                creator_id=str(ctx.author.id),
                ended=False,
            )
            session.add(poll)
            session.commit()
            session.refresh(poll)

            # Build embed
            option_lines = []
            for i, opt in enumerate(option_list):
                option_lines.append(f"**{i + 1}.** {opt}")

            embed = build_embed("poll_created", session, vars={
                "question": question,
                "options": "\n".join(option_lines),
                "duration": f"{seconds // 60} minutes" if seconds >= 60 else f"{seconds} seconds",
                "ends_at": end_time.strftime("%Y-%m-%d %H:%M UTC"),
            }, guild_id=str(ctx.guild.id))

            view = PollVoteView(poll.id, option_list, multiple)
            msg = await ctx.channel.send(embed=embed, view=view)

            poll.message_id = str(msg.id)
            session.commit()

            # Register persistent view
            self.bot.add_view(view, message_id=msg.id)

            await ctx.respond(f"Poll created! ID: #{poll.id}", ephemeral=True)
        except Exception as e:
            logger.error(f"poll_create error: {e}")
            await ctx.respond(f"Failed to create poll: {e}", ephemeral=True)
        finally:
            session.close()

    @poll_group.command(name="end", description="End a poll early")
    async def poll_end(
        self,
        ctx: discord.ApplicationContext,
        poll_id: discord.Option(int, "Poll ID to end"),
    ):
        session = get_session()
        try:
            poll = session.get(Poll, poll_id)
            if not poll or poll.guild_id != str(ctx.guild.id):
                await ctx.respond("Poll not found.", ephemeral=True)
                return

            if poll.ended:
                await ctx.respond("This poll has already ended.", ephemeral=True)
                return

            if poll.creator_id != str(ctx.author.id):
                # Allow admins to end any poll
                if not ctx.author.guild_permissions.manage_guild:
                    await ctx.respond("Only the poll creator or an admin can end this poll.", ephemeral=True)
                    return

            await end_poll(self.bot, poll_id)
            await ctx.respond(f"Ended poll #{poll_id}.", ephemeral=True)
        except Exception as e:
            logger.error(f"poll_end error: {e}")
            await ctx.respond(f"Failed to end poll: {e}", ephemeral=True)
        finally:
            session.close()

    @poll_group.command(name="results", description="Show current poll results")
    async def poll_results(
        self,
        ctx: discord.ApplicationContext,
        poll_id: discord.Option(int, "Poll ID"),
    ):
        session = get_session()
        try:
            poll = session.get(Poll, poll_id)
            if not poll or poll.guild_id != str(ctx.guild.id):
                await ctx.respond("Poll not found.", ephemeral=True)
                return

            votes = session.execute(
                select(PollVote).where(PollVote.poll_id == poll_id)
            ).scalars().all()

            results_text = _build_results_text(poll, votes)
            status = "Ended" if poll.ended else "Active"

            embed = discord.Embed(
                title=f"Poll Results: {poll.question}",
                description=results_text,
                color=0x5865F2,
                timestamp=datetime.datetime.utcnow(),
            )
            embed.set_footer(text=f"Status: {status} | Poll #{poll.id}")
            await ctx.respond(embed=embed, ephemeral=True)
        except Exception as e:
            logger.error(f"poll_results error: {e}")
            await ctx.respond(f"Failed to show results: {e}", ephemeral=True)
        finally:
            session.close()


def setup(bot: discord.Bot):
    bot.add_cog(PollsCog(bot))
