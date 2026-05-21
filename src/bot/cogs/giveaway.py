# src/bot/cogs/giveaway.py
"""Giveaway system — reaction-based (🎉) giveaways."""
import discord
import asyncio
import datetime
import random
import logging
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from src.database.config import SessionLocal
from src.models.models import Giveaway, GiveawayEntry, GiveawayBanned
from src.bot.embed_utils import build_embed
from src.bot.base_cog import check_feature

logger = logging.getLogger(__name__)
GIVEAWAY_EMOJI = "🎉"


def get_session():
    return SessionLocal()


def parse_duration(s: str) -> int:
    """Parse '30s', '5m', '2h', '1d' → seconds."""
    s = s.strip().lower()
    units = {"s": 1, "m": 60, "h": 3600, "d": 86400}
    if s[-1] in units:
        try:
            return int(s[:-1]) * units[s[-1]]
        except ValueError:
            pass
    try:
        return int(s) * 60
    except ValueError:
        return 300


async def end_giveaway(bot: discord.Bot, giveaway_id: int, reroll: bool = False):
    session = get_session()
    try:
        giveaway = session.execute(
            select(Giveaway)
            .options(joinedload(Giveaway.entries))
            .where(Giveaway.id == giveaway_id)
        ).unique().scalars().first()

        if not giveaway:
            return

        entries = giveaway.entries
        if not entries:
            winners_text = "No participants 😢"
            winner_mentions = ""
        else:
            count = min(giveaway.winners_count, len(entries))
            picked = random.sample(entries, count)
            winner_ids = [e.discord_id for e in picked]
            try:
                guild = bot.get_guild(int(giveaway.guild_id))
                mentions = []
                for wid in winner_ids:
                    try:
                        m = guild.get_member(int(wid))
                        mentions.append(m.mention if m else f"<@{wid}>")
                    except Exception:
                        mentions.append(f"<@{wid}>")
                winner_mentions = " ".join(mentions)
                winners_text = winner_mentions
            except Exception:
                winners_text = ", ".join(f"<@{wid}>" for wid in winner_ids)
                winner_mentions = winners_text

        if not reroll:
            giveaway.ended = True
            session.commit()

        # Edit original message
        channel = bot.get_channel(int(giveaway.channel_id))
        if channel and giveaway.message_id:
            try:
                msg = await channel.fetch_message(int(giveaway.message_id))
                result_embed = build_embed("ket_qua_giveaway", session, vars={
                    "prize": giveaway.prize,
                    "winners": winners_text,
                    "host": f"<@{giveaway.host_id}>" if giveaway.host_id else "Admin",
                    "winners_count": str(giveaway.winners_count),
                }, guild_id=giveaway.guild_id)
                await msg.edit(embed=result_embed)
                if winner_mentions:
                    await channel.send(
                        f"🎊 Congratulations {winner_mentions}! You won **{giveaway.prize}**!"
                    )
            except Exception as e:
                logger.error(f"end_giveaway edit error: {e}")
    finally:
        session.close()


class GiveawayCog(discord.Cog):
    def __init__(self, bot):
        self.bot = bot
        self._tasks: dict[int, asyncio.Task] = {}

    def _schedule(self, giveaway_id: int, ends_at: datetime.datetime):
        delay = max(0, (ends_at - datetime.datetime.utcnow()).total_seconds())
        task = asyncio.get_event_loop().create_task(self._auto_end(giveaway_id, delay))
        self._tasks[giveaway_id] = task

    async def _auto_end(self, giveaway_id: int, delay: float):
        await asyncio.sleep(delay)
        await end_giveaway(self.bot, giveaway_id)

    @discord.Cog.listener()
    async def on_ready(self):
        if not check_feature(self): return
        """Resume unfinished giveaways on restart."""
        session = get_session()
        try:
            active = session.execute(
                select(Giveaway).where(Giveaway.ended == False)
            ).scalars().all()
            for g in active:
                if datetime.datetime.utcnow() < g.ends_at:
                    self._schedule(g.id, g.ends_at)
                else:
                    await end_giveaway(self.bot, g.id)
        finally:
            session.close()

    # ── Reaction listeners ────────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_raw_reaction_add(self, payload: discord.RawReactionActionEvent):
        if not check_feature(self): return
        if str(payload.emoji) != GIVEAWAY_EMOJI or payload.member.bot:
            return
        session = get_session()
        try:
            giveaway = session.execute(
                select(Giveaway).where(
                    Giveaway.message_id == str(payload.message_id),
                    Giveaway.ended == False,
                )
            ).scalars().first()
            if not giveaway:
                return
            if datetime.datetime.utcnow() > giveaway.ends_at:
                return

            # Check banned
            banned = session.execute(
                select(GiveawayBanned).where(
                    GiveawayBanned.giveaway_id == giveaway.id,
                    GiveawayBanned.discord_id == str(payload.user_id),
                )
            ).scalars().first()
            if banned:
                # Remove their reaction
                try:
                    channel = self.bot.get_channel(payload.channel_id)
                    msg = await channel.fetch_message(payload.message_id)
                    await msg.remove_reaction(GIVEAWAY_EMOJI, payload.member)
                except Exception:
                    pass
                return

            # Check already entered
            exismessagesg = session.execute(
                select(GiveawayEntry).where(
                    GiveawayEntry.giveaway_id == giveaway.id,
                    GiveawayEntry.discord_id == str(payload.user_id),
                )
            ).scalars().first()
            if not exismessagesg:
                session.add(GiveawayEntry(
                    giveaway_id=giveaway.id,
                    discord_id=str(payload.user_id),
                ))
                session.commit()
        finally:
            session.close()

    @discord.Cog.listener()
    async def on_raw_reaction_remove(self, payload: discord.RawReactionActionEvent):
        if not check_feature(self): return
        if str(payload.emoji) != GIVEAWAY_EMOJI:
            return
        session = get_session()
        try:
            giveaway = session.execute(
                select(Giveaway).where(
                    Giveaway.message_id == str(payload.message_id),
                    Giveaway.ended == False,
                )
            ).scalars().first()
            if not giveaway:
                return

            entry = session.execute(
                select(GiveawayEntry).where(
                    GiveawayEntry.giveaway_id == giveaway.id,
                    GiveawayEntry.discord_id == str(payload.user_id),
                )
            ).scalars().first()
            if entry:
                session.delete(entry)
                session.commit()
        finally:
            session.close()

    # ── Slash commands ────────────────────────────────────────────────────

    @discord.slash_command(name="giveaway", description="[Admin] Create a giveaway")
    @discord.default_permissions(administrator=True)
    async def giveaway_cmd(
        self,
        ctx: discord.ApplicationContext,
        title: discord.Option(str, "Giveaway title"),
        prize: discord.Option(str, "Prize"),
        duration: discord.Option(str, "Duration (e.g. 10m, 2h, 1d)"),
        winners: discord.Option(int, "Number of winners", default=1, min_value=1, max_value=20),
        description: discord.Option(str, "Description (optional)", required=False, default=""),
    ):
        seconds = parse_duration(duration)
        ends_at = datetime.datetime.utcnow() + datetime.timedelta(seconds=seconds)

        session = get_session()
        try:
            giveaway = Giveaway(
                guild_id=str(ctx.guild.id),
                channel_id=str(ctx.channel.id),
                title=title,
                description=description or None,
                prize=prize,
                winners_count=winners,
                ends_at=ends_at,
                host_id=str(ctx.author.id),
            )
            session.add(giveaway)
            session.commit()

            embed = build_embed("giveaway", session, vars={
                "prize": prize,
                "ends_at": f"<t:{int(ends_at.timestamp())}:R>",
                "host": ctx.author.display_name,
                "winners_count": str(winners),
                "server": ctx.guild.name if ctx.guild else "Server",
            }, guild_id=giveaway.guild_id)
            if title:
                embed.title = f"🎉 {title}"
            if description and not embed.description:
                embed.description = description

            # Send embed and add reaction
            msg = await ctx.respond(embed=embed)
            real_msg = await msg.original_response()
            await real_msg.add_reaction(GIVEAWAY_EMOJI)

            giveaway.message_id = str(real_msg.id)
            session.commit()

            self._schedule(giveaway.id, ends_at)
        finally:
            session.close()

    @discord.slash_command(name="giveaway_reroll", description="[Admin] Reroll giveaway winner")
    @discord.default_permissions(administrator=True)
    async def reroll_cmd(
        self,
        ctx: discord.ApplicationContext,
        id: discord.Option(int, "Giveaway ID"),
    ):
        await end_giveaway(self.bot, id, reroll=True)
        await ctx.respond(f"✅ Rerolled giveaway #{id}.", ephemeral=True)

    @discord.slash_command(name="giveaway_list", description="View active giveaways")
    async def list_cmd(self, ctx: discord.ApplicationContext):
        session = get_session()
        try:
            actives = session.execute(
                select(Giveaway).where(
                    Giveaway.ended == False,
                    Giveaway.guild_id == str(ctx.guild.id),
                )
            ).scalars().all()
            if not actives:
                await ctx.respond("No active giveaways.", ephemeral=True)
                return

            embed = discord.Embed(title="🎉 Active Giveaways", color=0xF0B232)
            for g in actives[:10]:
                entry_count = len(session.execute(
                    select(GiveawayEntry).where(GiveawayEntry.giveaway_id == g.id)
                ).scalars().all())
                embed.add_field(
                    name=f"#{g.id} — {g.title or g.prize}",
                    value=f"🎁 {g.prize}\n👥 {entry_count} participants\n⏰ End <t:{int(g.ends_at.timestamp())}:R>",
                    inline=False,
                )
            await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()

    @discord.slash_command(name="giveaway_end", description="[Admin] End a giveaway early")
    @discord.default_permissions(administrator=True)
    async def end_cmd(self, ctx: discord.ApplicationContext, id: discord.Option(int, "Giveaway ID")):
        if id in self._tasks:
            self._tasks[id].cancel()
        await end_giveaway(self.bot, id)
        await ctx.respond(f"✅ Ended giveaway #{id}.", ephemeral=True)

    @discord.slash_command(name="giveaway_ban", description="[Admin] Ban user from giveaway")
    @discord.default_permissions(administrator=True)
    async def ban_cmd(
        self,
        ctx: discord.ApplicationContext,
        id: discord.Option(int, "Giveaway ID"),
        user: discord.Option(discord.Member, "User to ban"),
    ):
        session = get_session()
        try:
            exismessagesg = session.execute(
                select(GiveawayBanned).where(
                    GiveawayBanned.giveaway_id == id,
                    GiveawayBanned.discord_id == str(user.id),
                )
            ).scalars().first()
            if not exismessagesg:
                session.add(GiveawayBanned(giveaway_id=id, discord_id=str(user.id)))
                session.commit()
            await ctx.respond(f"✅ Banned {user.mention} from giveaway #{id}.", ephemeral=True)
        finally:
            session.close()

    @discord.slash_command(name="giveaway_unban", description="[Admin] Unban user from giveaway")
    @discord.default_permissions(administrator=True)
    async def unban_cmd(
        self,
        ctx: discord.ApplicationContext,
        id: discord.Option(int, "Giveaway ID"),
        user: discord.Option(discord.Member, "User to unban"),
    ):
        session = get_session()
        try:
            rec = session.execute(
                select(GiveawayBanned).where(
                    GiveawayBanned.giveaway_id == id,
                    GiveawayBanned.discord_id == str(user.id),
                )
            ).scalars().first()
            if rec:
                session.delete(rec)
                session.commit()
            await ctx.respond(f"✅ Unbanned {user.mention} from giveaway #{id}.", ephemeral=True)
        finally:
            session.close()
