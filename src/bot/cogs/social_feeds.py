# src/bot/cogs/social_feeds.py
"""Social Feeds — monitor YouTube, Twitch, and RSS feeds and post updates to Discord."""
import discord
import datetime
import logging
from discord.ext import tasks
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import SocialFeed
from src.bot.embed_utils import build_embed
from src.bot.base_cog import check_feature

logger = logging.getLogger(__name__)


def get_session():
    return SessionLocal()


def _extract_youtube_channel_id(url: str) -> str | None:
    """Extract channel ID from various YouTube URL formats."""
    import re
    # Handle channel_id directly
    m = re.search(r"channel_id=([A-Za-z0-9_-]+)", url)
    if m:
        return m.group(1)
    # Handle /channel/UC... format
    m = re.search(r"/channel/(UC[A-Za-z0-9_-]+)", url)
    if m:
        return m.group(1)
    # Handle /c/Name or /@Name — can't resolve without API, return as-is
    m = re.search(r"/(?:c/|@)([A-Za-z0-9_-]+)", url)
    if m:
        return m.group(1)
    return None


async def _check_rss_feed(feed: SocialFeed, session, bot: discord.Bot):
    """Check an RSS feed for new items and post them."""
    try:
        import feedparser
    except ImportError:
        logger.warning("feedparser is not installed. RSS/YouTube feeds will not work.")
        return

    try:
        parsed = feedparser.parse(feed.feed_url)
        if not parsed.entries:
            return

        latest = parsed.entries[0]
        item_id = latest.get("id") or latest.get("link") or ""

        if feed.last_item_id and item_id == feed.last_item_id:
            # No new items
            feed.last_checked = datetime.datetime.utcnow()
            session.commit()
            return

        # New item found
        channel = bot.get_channel(int(feed.discord_channel_id))
        if not channel:
            logger.warning(f"Feed {feed.id}: channel {feed.discord_channel_id} not found")
            return

        title = latest.get("title", "No title")
        url = latest.get("link", "")
        author = latest.get("author", "")
        summary = latest.get("summary", "")[:300]
        thumbnail = ""
        if latest.get("media_thumbnail"):
            thumbnail = latest["media_thumbnail"][0].get("url", "")
        elif latest.get("media_content"):
            for mc in latest["media_content"]:
                if mc.get("type", "").startswith("image"):
                    thumbnail = mc.get("url", "")
                    break

        if feed.custom_message:
            content = feed.custom_message.replace("{title}", title).replace("{url}", url).replace("{author}", author)
            await channel.send(content)
        else:
            embed = discord.Embed(
                title=title[:256],
                url=url or None,
                description=summary or None,
                color=0xFF0000 if feed.platform == "youtube" else 0x6441A5 if feed.platform == "twitch" else 0x5865F2,
                timestamp=datetime.datetime.utcnow(),
            )
            if author:
                embed.set_author(name=author)
            if thumbnail:
                embed.set_thumbnail(url=thumbnail)
            embed.set_footer(text=f"New {feed.platform} post")
            await channel.send(embed=embed)

        feed.last_item_id = item_id
        feed.last_checked = datetime.datetime.utcnow()
        session.commit()

    except Exception as e:
        logger.error(f"RSS feed check error for feed {feed.id}: {e}")


async def _check_youtube_feed(feed: SocialFeed, session, bot: discord.Bot):
    """Check YouTube feed using RSS."""
    channel_id = _extract_youtube_channel_id(feed.feed_url)
    if channel_id and channel_id.startswith("UC"):
        rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    else:
        # Fallback: try using the URL directly as RSS
        rss_url = feed.feed_url

    # Create a temporary feed object with the RSS URL for checking
    temp_feed = SocialFeed(
        guild_id=feed.guild_id,
        platform="rss",
        feed_url=rss_url,
        discord_channel_id=feed.discord_channel_id,
        custom_message=feed.custom_message,
        last_item_id=feed.last_item_id,
        last_checked=feed.last_checked,
        enabled=feed.enabled,
    )
    # Copy the id so we can update the real feed after
    temp_feed.id = feed.id

    await _check_rss_feed(temp_feed, session, bot)

    # Sync back last_item_id
    feed.last_item_id = temp_feed.last_item_id
    feed.last_checked = temp_feed.last_checked


async def _check_twitch_feed(feed: SocialFeed, session, bot: discord.Bot):
    """Check Twitch feed — placeholder, requires Twitch API key."""
    logger.warning(f"Twitch feed {feed.id}: Twitch API integration requires API key. Skipping.")
    feed.last_checked = datetime.datetime.utcnow()
    session.commit()


class SocialFeedsCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        self._feed_check.start()

    def cog_unload(self):
        self._feed_check.cancel()

    # ── Background task: check feeds ──

    @tasks.loop(minutes=5)
    async def _feed_check(self):
        session = get_session()
        try:
            feeds = session.execute(
                select(SocialFeed).where(SocialFeed.enabled == True)
            ).scalars().all()

            for feed in feeds:
                try:
                    if feed.platform == "rss":
                        await _check_rss_feed(feed, session, self.bot)
                    elif feed.platform == "youtube":
                        await _check_youtube_feed(feed, session, self.bot)
                    elif feed.platform == "twitch":
                        await _check_twitch_feed(feed, session, self.bot)
                    else:
                        logger.warning(f"Unknown platform for feed {feed.id}: {feed.platform}")
                except Exception as e:
                    logger.error(f"Feed check error for feed {feed.id}: {e}")
        except Exception as e:
            logger.error(f"Feed check loop error: {e}")
        finally:
            session.close()

    @_feed_check.before_loop
    async def before_feed_check(self):
        await self.bot.wait_until_ready()

    # ── Slash commands ──

    feed_group = discord.SlashCommandGroup("feed", "Social feed management")

    @feed_group.command(name="add", description="Add a social feed to monitor")
    @discord.default_permissions(manage_guild=True)
    async def feed_add(
        self,
        ctx: discord.ApplicationContext,
        platform: discord.Option(str, "Platform", choices=["youtube", "twitch", "rss"]),
        url: discord.Option(str, "Feed URL or channel URL"),
        channel: discord.Option(discord.TextChannel, "Channel to post updates"),
        custom_message: discord.Option(str, "Custom message template ({title}, {url}, {author})", required=False, default=None),
    ):
        session = get_session()
        try:
            feed = SocialFeed(
                guild_id=str(ctx.guild.id),
                platform=platform,
                feed_url=url,
                discord_channel_id=str(channel.id),
                custom_message=custom_message,
                enabled=True,
            )
            session.add(feed)
            session.commit()
            session.refresh(feed)

            await ctx.respond(
                f"Added {platform} feed #{feed.id}. Updates will be posted to {channel.mention}.",
                ephemeral=True,
            )
        except Exception as e:
            logger.error(f"feed_add error: {e}")
            await ctx.respond(f"Failed to add feed: {e}", ephemeral=True)
        finally:
            session.close()

    @feed_group.command(name="remove", description="Remove a social feed")
    @discord.default_permissions(manage_guild=True)
    async def feed_remove(
        self,
        ctx: discord.ApplicationContext,
        id: discord.Option(int, "Feed ID to remove"),
    ):
        session = get_session()
        try:
            feed = session.get(SocialFeed, id)
            if not feed or feed.guild_id != str(ctx.guild.id):
                await ctx.respond("Feed not found.", ephemeral=True)
                return

            session.delete(feed)
            session.commit()
            await ctx.respond(f"Removed feed #{id}.", ephemeral=True)
        except Exception as e:
            logger.error(f"feed_remove error: {e}")
            await ctx.respond(f"Failed to remove feed: {e}", ephemeral=True)
        finally:
            session.close()

    @feed_group.command(name="list", description="List configured social feeds")
    async def feed_list(self, ctx: discord.ApplicationContext):
        session = get_session()
        try:
            feeds = session.execute(
                select(SocialFeed).where(SocialFeed.guild_id == str(ctx.guild.id))
            ).scalars().all()

            if not feeds:
                await ctx.respond("No feeds configured.", ephemeral=True)
                return

            lines = []
            for f in feeds:
                status = "enabled" if f.enabled else "disabled"
                last = f.last_checked.strftime("%Y-%m-%d %H:%M") if f.last_checked else "never"
                lines.append(f"**#{f.id}** | {f.platform} | <#{f.discord_channel_id}> | {status} | last checked: {last}")

            embed = discord.Embed(
                title="Social Feeds",
                description="\n".join(lines),
                color=0x5865F2,
                timestamp=datetime.datetime.utcnow(),
            )
            await ctx.respond(embed=embed, ephemeral=True)
        except Exception as e:
            logger.error(f"feed_list error: {e}")
            await ctx.respond(f"Failed to list feeds: {e}", ephemeral=True)
        finally:
            session.close()


def setup(bot: discord.Bot):
    bot.add_cog(SocialFeedsCog(bot))
