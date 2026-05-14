# src/bot/cogs/scheduler.py
"""Scheduled Messages — send messages/embeds at scheduled times."""
import discord
import logging
import datetime
from discord.ext import tasks
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import ScheduledMessage

logger = logging.getLogger(__name__)

REPEAT_DELTAS = {
    "hourly": datetime.timedelta(hours=1),
    "daily": datetime.timedelta(days=1),
    "weekly": datetime.timedelta(weeks=1),
    "monthly": datetime.timedelta(days=30),
}


class SchedulerCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        self.check_scheduled.start()

    def cog_unload(self):
        self.check_scheduled.cancel()

    @tasks.loop(seconds=30)
    async def check_scheduled(self):
        session = SessionLocal()
        try:
            now = datetime.datetime.utcnow()
            msgs = session.execute(
                select(ScheduledMessage).where(
                    ScheduledMessage.enabled == True,
                    ScheduledMessage.send_at <= now,
                )
            ).scalars().all()

            for msg in msgs:
                # For non-repeating, skip if already sent
                if msg.repeat_type == "none" and msg.sent:
                    continue

                channel = self.bot.get_channel(int(msg.channel_id))
                if not channel:
                    logger.warning(f"Scheduled msg {msg.id}: channel {msg.channel_id} not found")
                    if msg.repeat_type == "none":
                        msg.sent = True
                        session.commit()
                    continue

                try:
                    embed = None
                    if msg.embed_data:
                        ed = msg.embed_data
                        embed = discord.Embed(
                            title=ed.get("title", ""),
                            description=ed.get("description", ""),
                            color=int(ed["color"].lstrip("#"), 16) if ed.get("color") else 0x5865F2,
                        )
                        if ed.get("footer"):
                            embed.set_footer(text=ed["footer"])
                        if ed.get("image_url"):
                            embed.set_image(url=ed["image_url"])
                        if ed.get("thumbnail_url"):
                            embed.set_thumbnail(url=ed["thumbnail_url"])
                        for f in ed.get("fields", []):
                            embed.add_field(
                                name=f.get("name", ""),
                                value=f.get("value", ""),
                                inline=f.get("inline", False),
                            )

                    await channel.send(content=msg.content or None, embed=embed)
                    logger.info(f"Sent scheduled message {msg.id}")

                    msg.last_sent_at = now

                    if msg.repeat_type == "none":
                        msg.sent = True
                    else:
                        # Schedule next occurrence
                        delta = REPEAT_DELTAS.get(msg.repeat_type)
                        if delta:
                            msg.send_at = now + delta
                        else:
                            msg.sent = True

                    session.commit()
                except Exception as e:
                    logger.error(f"Failed to send scheduled message {msg.id}: {e}")

        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
        finally:
            session.close()

    @check_scheduled.before_loop
    async def before_check(self):
        await self.bot.wait_until_ready()
