# src/bot/cogs/giveaway.py
import discord
import asyncio
import datetime
import random
import logging
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from src.database.config import SessionLocal
from src.models.models import Giveaway, GiveawayEntry, GiveawayBanned

logger = logging.getLogger(__name__)


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
        return int(s) * 60  # default minutes
    except ValueError:
        return 300  # fallback 5 phút


class GiveawayJoinView(discord.ui.View):
    def __init__(self, giveaway_id: int):
        super().__init__(timeout=None)
        self.giveaway_id = giveaway_id

    @discord.ui.button(label="🎉 Tham gia (0)", style=discord.ButtonStyle.primary, custom_id="giveaway_join")
    async def join_btn(self, button: discord.ui.Button, interaction: discord.Interaction):
        session = get_session()
        try:
            giveaway = session.execute(
                select(Giveaway).where(Giveaway.id == self.giveaway_id)
            ).scalars().first()

            if not giveaway or giveaway.ended:
                await interaction.response.send_message("❌ Giveaway đã kết thúc.", ephemeral=True)
                return

            if datetime.datetime.utcnow() > giveaway.ends_at:
                await interaction.response.send_message("❌ Giveaway đã hết thời gian.", ephemeral=True)
                return

            # Check banned
            banned = session.execute(
                select(GiveawayBanned).where(
                    GiveawayBanned.giveaway_id == self.giveaway_id,
                    GiveawayBanned.discord_id == str(interaction.user.id),
                )
            ).scalars().first()
            if banned:
                await interaction.response.send_message("❌ Bạn bị cấm tham gia giveaway này.", ephemeral=True)
                return

            # Check already joined
            existing = session.execute(
                select(GiveawayEntry).where(
                    GiveawayEntry.giveaway_id == self.giveaway_id,
                    GiveawayEntry.discord_id == str(interaction.user.id),
                )
            ).scalars().first()

            if existing:
                # Rút tham gia
                session.delete(existing)
                session.commit()
                count = session.execute(
                    select(GiveawayEntry).where(GiveawayEntry.giveaway_id == self.giveaway_id)
                ).scalars().all()
                button.label = f"🎉 Tham gia ({len(count)})"
                await interaction.response.edit_message(view=self)
                await interaction.followup.send("✅ Đã rút khỏi giveaway.", ephemeral=True)
            else:
                entry = GiveawayEntry(giveaway_id=self.giveaway_id, discord_id=str(interaction.user.id))
                session.add(entry)
                session.commit()
                count = session.execute(
                    select(GiveawayEntry).where(GiveawayEntry.giveaway_id == self.giveaway_id)
                ).scalars().all()
                button.label = f"🎉 Tham gia ({len(count)})"
                await interaction.response.edit_message(view=self)
                await interaction.followup.send("✅ Đã tham gia giveaway!", ephemeral=True)
        finally:
            session.close()


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
            winners_text = "Không có người tham gia 😢"
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

        # Edit embed
        channel = bot.get_channel(int(giveaway.channel_id))
        if channel and giveaway.message_id:
            try:
                msg = await channel.fetch_message(int(giveaway.message_id))
                embed = discord.Embed(
                    title=f"🎉 {giveaway.title} — KẾT THÚC",
                    description=giveaway.description or "",
                    color=discord.Color.green(),
                )
                embed.add_field(name="🎁 Phần thưởng", value=giveaway.prize, inline=True)
                embed.add_field(name="👑 Người thắng", value=winners_text, inline=False)
                embed.set_footer(text=f"Kết thúc lúc {datetime.datetime.utcnow().strftime('%d/%m/%Y %H:%M')} UTC")
                await msg.edit(embed=embed, view=None)
                if winner_mentions:
                    await channel.send(
                        f"🎊 Chúc mừng {winner_mentions}! Bạn đã thắng **{giveaway.prize}**!"
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

    @discord.slash_command(name="giveaway", description="[Admin] Tạo giveaway")
    @discord.default_permissions(administrator=True)
    async def giveaway_cmd(
        self,
        ctx: discord.ApplicationContext,
        title: discord.Option(str, "Tên giveaway"),
        prize: discord.Option(str, "Phần thưởng"),
        duration: discord.Option(str, "Thời gian (VD: 10m, 2h, 1d)"),
        winners: discord.Option(int, "Số người thắng", default=1, min_value=1, max_value=20),
        description: discord.Option(str, "Mô tả (tuỳ chọn)", required=False, default=""),
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

            from src.bot.embed_utils import build_embed
            embed = build_embed("giveaway", session, vars={
                "prize": prize,
                "ends_at": f"<t:{int(ends_at.timestamp())}:R>",
                "host": ctx.author.display_name,
                "winners_count": str(winners),
                "server": ctx.guild.name if ctx.guild else "Server",
            })
            if title:
                embed.title = f"🎉 {title}"
            if description and not embed.description:
                embed.description = description

            view = GiveawayJoinView(giveaway_id=giveaway.id)
            msg = await ctx.respond(embed=embed, view=view)
            real_msg = await msg.original_response()
            giveaway.message_id = str(real_msg.id)
            session.commit()

            self._schedule(giveaway.id, ends_at)
        finally:
            session.close()

    @discord.slash_command(name="giveaway_reroll", description="[Admin] Chọn lại người thắng giveaway")
    @discord.default_permissions(administrator=True)
    async def reroll_cmd(
        self,
        ctx: discord.ApplicationContext,
        id: discord.Option(int, "ID giveaway"),
    ):
        await end_giveaway(self.bot, id, reroll=True)
        await ctx.respond(f"✅ Đã reroll giveaway #{id}.", ephemeral=True)

    @discord.slash_command(name="giveaway_list", description="Xem giveaway đang chạy")
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
                await ctx.respond("Không có giveaway nào đang chạy.", ephemeral=True)
                return
            embed = discord.Embed(title="🎉 Giveaway đang chạy", color=discord.Color.blurple())
            for g in actives:
                embed.add_field(
                    name=f"#{g.id} — {g.title}",
                    value=f"🎁 {g.prize} • Kết thúc <t:{int(g.ends_at.timestamp())}:R>",
                    inline=False,
                )
            await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()

    @discord.slash_command(name="giveaway_end", description="[Admin] Kết thúc sớm giveaway")
    @discord.default_permissions(administrator=True)
    async def end_cmd(self, ctx: discord.ApplicationContext, id: discord.Option(int, "ID giveaway")):
        if id in self._tasks:
            self._tasks[id].cancel()
        await end_giveaway(self.bot, id)
        await ctx.respond(f"✅ Đã kết thúc giveaway #{id}.", ephemeral=True)

    @discord.slash_command(name="giveaway_ban", description="[Admin] Cấm user tham gia giveaway")
    @discord.default_permissions(administrator=True)
    async def ban_cmd(
        self,
        ctx: discord.ApplicationContext,
        id: discord.Option(int, "ID giveaway"),
        user: discord.Option(discord.Member, "User cần ban"),
    ):
        session = get_session()
        try:
            existing = session.execute(
                select(GiveawayBanned).where(
                    GiveawayBanned.giveaway_id == id,
                    GiveawayBanned.discord_id == str(user.id),
                )
            ).scalars().first()
            if not existing:
                session.add(GiveawayBanned(giveaway_id=id, discord_id=str(user.id)))
                session.commit()
            await ctx.respond(f"✅ Đã ban {user.mention} khỏi giveaway #{id}.", ephemeral=True)
        finally:
            session.close()

    @discord.slash_command(name="giveaway_unban", description="[Admin] Bỏ ban user khỏi giveaway")
    @discord.default_permissions(administrator=True)
    async def unban_cmd(
        self,
        ctx: discord.ApplicationContext,
        id: discord.Option(int, "ID giveaway"),
        user: discord.Option(discord.Member, "User cần unban"),
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
            await ctx.respond(f"✅ Đã unban {user.mention} khỏi giveaway #{id}.", ephemeral=True)
        finally:
            session.close()
