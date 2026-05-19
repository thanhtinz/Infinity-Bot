# src/bot/cogs/reminder.py
"""Reminder and Todo system — set reminders, manage todo items."""
import discord
import asyncio
import datetime
import logging
import re
from discord.ext import tasks
from sqlalchemy import select, delete
from src.database.config import SessionLocal
from src.models.models import Reminder, TodoItem
from src.bot.embed_utils import build_embed
from src.bot.base_cog import check_feature

logger = logging.getLogger(__name__)


def get_session():
    return SessionLocal()


def parse_duration(s: str) -> int:
    """Parse duration strings like '30s', '5m', '2h', '1d', '1w' into seconds."""
    s = s.strip().lower()
    match = re.fullmatch(r"(\d+)\s*(s|m|h|d|w)", s)
    if match:
        amount = int(match.group(1))
        unit = match.group(2)
        multipliers = {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}
        return amount * multipliers[unit]
    # Fallback: try as plain number (treat as minutes)
    try:
        return int(s) * 60
    except ValueError:
        return 300


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


class ReminderCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        self._reminder_check.start()

    def cog_unload(self):
        self._reminder_check.cancel()

    # ── Background task: check reminders ──

    @tasks.loop(seconds=30)
    async def _reminder_check(self):
        session = get_session()
        try:
            now = datetime.datetime.utcnow()
            reminders = session.execute(
                select(Reminder).where(
                    Reminder.remind_at <= now,
                    Reminder.completed == False,
                )
            ).scalars().all()

            for rem in reminders:
                try:
                    # Try DM first
                    user = self.bot.get_user(int(rem.user_id))
                    if user:
                        try:
                            dm_embed = discord.Embed(
                                title="Reminder",
                                description=rem.message,
                                color=0x5865F2,
                                timestamp=datetime.datetime.utcnow(),
                            )
                            await user.send(embed=dm_embed)
                        except discord.Forbidden:
                            # DM failed, try channel
                            if rem.channel_id:
                                channel = self.bot.get_channel(int(rem.channel_id))
                                if channel:
                                    await channel.send(f"<@{rem.user_id}> Reminder: {rem.message}")

                    # Handle recurring
                    if rem.recurring:
                        if rem.recurring == "daily":
                            rem.remind_at = now + datetime.timedelta(days=1)
                        elif rem.recurring == "weekly":
                            rem.remind_at = now + datetime.timedelta(weeks=1)
                    else:
                        rem.completed = True

                    session.commit()
                except Exception as e:
                    logger.error(f"Failed to send reminder {rem.id}: {e}")
        except Exception as e:
            logger.error(f"Reminder check loop error: {e}")
        finally:
            session.close()

    @_reminder_check.before_loop
    async def before_reminder_check(self):
        await self.bot.wait_until_ready()

    # ── Reminder commands ──

    remind_group = discord.SlashCommandGroup("remind", "Reminder commands")

    @remind_group.command(name="set", description="Set a reminder")
    async def remind_set(
        self,
        ctx: discord.ApplicationContext,
        duration: discord.Option(str, "Duration (e.g. 30s, 5m, 2h, 1d, 1w)"),
        message: discord.Option(str, "Reminder message"),
    ):
        seconds = parse_duration(duration)
        remind_at = datetime.datetime.utcnow() + datetime.timedelta(seconds=seconds)

        session = get_session()
        try:
            rem = Reminder(
                guild_id=str(ctx.guild.id),
                user_id=str(ctx.author.id),
                channel_id=str(ctx.channel.id),
                message=message,
                remind_at=remind_at,
                completed=False,
            )
            session.add(rem)
            session.commit()
            session.refresh(rem)

            embed = build_embed("reminder_set", session, vars={
                "id": str(rem.id),
                "message": message,
                "duration": _format_duration(seconds),
                "remind_at": remind_at.strftime("%Y-%m-%d %H:%M UTC"),
            }, guild_id=str(ctx.guild.id))
            await ctx.respond(embed=embed, ephemeral=True)
        except Exception as e:
            logger.error(f"remind_set error: {e}")
            await ctx.respond(f"Failed to set reminder: {e}", ephemeral=True)
        finally:
            session.close()

    @remind_group.command(name="list", description="List your active reminders")
    async def remind_list(self, ctx: discord.ApplicationContext):
        session = get_session()
        try:
            reminders = session.execute(
                select(Reminder).where(
                    Reminder.guild_id == str(ctx.guild.id),
                    Reminder.user_id == str(ctx.author.id),
                    Reminder.completed == False,
                ).order_by(Reminder.remind_at)
            ).scalars().all()

            if not reminders:
                await ctx.respond("You have no active reminders.", ephemeral=True)
                return

            lines = []
            for r in reminders[:10]:
                recurring = f" [{r.recurring}]" if r.recurring else ""
                lines.append(f"**#{r.id}** | {r.remind_at.strftime('%Y-%m-%d %H:%M')} UTC{recurring} | {r.message[:50]}")

            embed = discord.Embed(
                title="Your Reminders",
                description="\n".join(lines),
                color=0x5865F2,
                timestamp=datetime.datetime.utcnow(),
            )
            await ctx.respond(embed=embed, ephemeral=True)
        except Exception as e:
            logger.error(f"remind_list error: {e}")
            await ctx.respond(f"Failed to list reminders: {e}", ephemeral=True)
        finally:
            session.close()

    @remind_group.command(name="cancel", description="Cancel a reminder")
    async def remind_cancel(
        self,
        ctx: discord.ApplicationContext,
        id: discord.Option(int, "Reminder ID to cancel"),
    ):
        session = get_session()
        try:
            rem = session.get(Reminder, id)
            if not rem or rem.guild_id != str(ctx.guild.id) or rem.user_id != str(ctx.author.id):
                await ctx.respond("Reminder not found.", ephemeral=True)
                return

            rem.completed = True
            session.commit()
            await ctx.respond(f"Cancelled reminder #{id}.", ephemeral=True)
        except Exception as e:
            logger.error(f"remind_cancel error: {e}")
            await ctx.respond(f"Failed to cancel reminder: {e}", ephemeral=True)
        finally:
            session.close()

    # ── Todo commands ──

    todo_group = discord.SlashCommandGroup("todo", "Todo list commands")

    @todo_group.command(name="add", description="Add a todo item")
    async def todo_add(
        self,
        ctx: discord.ApplicationContext,
        content: discord.Option(str, "Todo content"),
    ):
        session = get_session()
        try:
            item = TodoItem(
                guild_id=str(ctx.guild.id),
                user_id=str(ctx.author.id),
                content=content,
                done=False,
            )
            session.add(item)
            session.commit()
            session.refresh(item)
            await ctx.respond(f"Added todo #{item.id}: {content}", ephemeral=True)
        except Exception as e:
            logger.error(f"todo_add error: {e}")
            await ctx.respond(f"Failed to add todo: {e}", ephemeral=True)
        finally:
            session.close()

    @todo_group.command(name="list", description="List your todo items")
    async def todo_list(self, ctx: discord.ApplicationContext):
        session = get_session()
        try:
            items = session.execute(
                select(TodoItem).where(
                    TodoItem.guild_id == str(ctx.guild.id),
                    TodoItem.user_id == str(ctx.author.id),
                ).order_by(TodoItem.created_at)
            ).scalars().all()

            if not items:
                await ctx.respond("Your todo list is empty.", ephemeral=True)
                return

            lines = []
            for item in items:
                status = "[x]" if item.done else "[ ]"
                lines.append(f"{status} **#{item.id}** | {item.content}")

            embed = discord.Embed(
                title="Your Todo List",
                description="\n".join(lines),
                color=0x5865F2,
                timestamp=datetime.datetime.utcnow(),
            )
            await ctx.respond(embed=embed, ephemeral=True)
        except Exception as e:
            logger.error(f"todo_list error: {e}")
            await ctx.respond(f"Failed to list todos: {e}", ephemeral=True)
        finally:
            session.close()

    @todo_group.command(name="done", description="Mark a todo item as done")
    async def todo_done(
        self,
        ctx: discord.ApplicationContext,
        id: discord.Option(int, "Todo item ID"),
    ):
        session = get_session()
        try:
            item = session.get(TodoItem, id)
            if not item or item.guild_id != str(ctx.guild.id) or item.user_id != str(ctx.author.id):
                await ctx.respond("Todo item not found.", ephemeral=True)
                return

            item.done = True
            session.commit()
            await ctx.respond(f"Marked todo #{id} as done.", ephemeral=True)
        except Exception as e:
            logger.error(f"todo_done error: {e}")
            await ctx.respond(f"Failed to mark todo as done: {e}", ephemeral=True)
        finally:
            session.close()

    @todo_group.command(name="remove", description="Remove a todo item")
    async def todo_remove(
        self,
        ctx: discord.ApplicationContext,
        id: discord.Option(int, "Todo item ID to remove"),
    ):
        session = get_session()
        try:
            item = session.get(TodoItem, id)
            if not item or item.guild_id != str(ctx.guild.id) or item.user_id != str(ctx.author.id):
                await ctx.respond("Todo item not found.", ephemeral=True)
                return

            session.delete(item)
            session.commit()
            await ctx.respond(f"Removed todo #{id}.", ephemeral=True)
        except Exception as e:
            logger.error(f"todo_remove error: {e}")
            await ctx.respond(f"Failed to remove todo: {e}", ephemeral=True)
        finally:
            session.close()


def setup(bot: discord.Bot):
    bot.add_cog(ReminderCog(bot))
