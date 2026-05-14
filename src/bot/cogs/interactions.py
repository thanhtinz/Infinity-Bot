"""
Interaction commands — anime reaction GIFs (hug, kiss, slap, …)
Uses https://api.otakugifs.xyz API.
Supports both slash commands and prefix commands.
"""
import discord
import logging
import aiohttp
from sqlalchemy import select
from src.database.config import SessionLocal
from src.bot.embed_utils import build_embed
from src.models.models import SystemConfig

logger = logging.getLogger(__name__)

API_BASE = "https://api.otakugifs.xyz/gif"

# ── Reaction metadata ─────────────────────────────────────────────────────────

REACTIONS: dict[str, dict] = {
    # ── Tương tác với người khác ──
    "airkiss":    {"label": "gửi nụ hôn gió cho",   "emoji": "😘", "targeted": True},
    "angrystare": {"label": "nhìn giận dữ",          "emoji": "😠", "targeted": True},
    "bite":       {"label": "cắn",                    "emoji": "😬", "targeted": True},
    "brofist":    {"label": "đấm tay với",            "emoji": "🤜", "targeted": True},
    "cuddle":     {"label": "ôm ấp",                  "emoji": "🤗", "targeted": True},
    "handhold":   {"label": "nắm tay",                "emoji": "🤝", "targeted": True},
    "hug":        {"label": "ôm",                     "emoji": "🫂", "targeted": True},
    "kiss":       {"label": "hôn",                    "emoji": "💋", "targeted": True},
    "lick":       {"label": "liếm",                   "emoji": "👅", "targeted": True},
    "nom":        {"label": "ăn",                     "emoji": "😋", "targeted": True},
    "nuzzle":     {"label": "cọ mũi với",             "emoji": "🥰", "targeted": True},
    "pat":        {"label": "xoa đầu",                "emoji": "🤚", "targeted": True},
    "pinch":      {"label": "véo",                    "emoji": "🤏", "targeted": True},
    "poke":       {"label": "chọc",                   "emoji": "👉", "targeted": True},
    "punch":      {"label": "đấm",                    "emoji": "👊", "targeted": True},
    "slap":       {"label": "tát",                    "emoji": "🫲", "targeted": True},
    "smack":      {"label": "đánh",                   "emoji": "💥", "targeted": True},
    "tickle":     {"label": "cù",                     "emoji": "🤭", "targeted": True},
    "wave":       {"label": "vẫy tay với",            "emoji": "👋", "targeted": True},
    "wink":       {"label": "nháy mắt với",           "emoji": "😉", "targeted": True},
    "stare":      {"label": "nhìn chằm chằm",        "emoji": "👀", "targeted": True},
    "peek":       {"label": "nhìn trộm",              "emoji": "🫣", "targeted": True},

    # ── Tự thân / biểu cảm ──
    "bleh":       {"label": "le lưỡi",                "emoji": "😝", "targeted": False},
    "blush":      {"label": "đỏ mặt",                 "emoji": "😊", "targeted": False},
    "celebrate":  {"label": "ăn mừng",                "emoji": "🎉", "targeted": False},
    "cheers":     {"label": "nâng ly",                "emoji": "🍻", "targeted": False},
    "clap":       {"label": "vỗ tay",                 "emoji": "👏", "targeted": False},
    "confused":   {"label": "bối rối",                "emoji": "😕", "targeted": False},
    "cool":       {"label": "ngầu",                   "emoji": "😎", "targeted": False},
    "cry":        {"label": "khóc",                   "emoji": "😢", "targeted": False},
    "dance":      {"label": "nhảy",                   "emoji": "💃", "targeted": False},
    "drool":      {"label": "chảy nước miếng",        "emoji": "🤤", "targeted": False},
    "evillaugh":  {"label": "cười ác",                "emoji": "😈", "targeted": False},
    "facepalm":   {"label": "facepalm",               "emoji": "🤦", "targeted": False},
    "happy":      {"label": "vui vẻ",                 "emoji": "😄", "targeted": False},
    "headbang":   {"label": "headbang",                "emoji": "🤘", "targeted": False},
    "huh":        {"label": "hả?",                    "emoji": "❓", "targeted": False},
    "laugh":      {"label": "cười",                   "emoji": "😂", "targeted": False},
    "love":       {"label": "yêu",                    "emoji": "❤️", "targeted": False},
    "mad":        {"label": "giận dữ",                "emoji": "😡", "targeted": False},
    "nervous":    {"label": "lo lắng",                "emoji": "😰", "targeted": False},
    "no":         {"label": "lắc đầu",                "emoji": "🙅", "targeted": False},
    "nosebleed":  {"label": "chảy máu mũi",           "emoji": "🫠", "targeted": False},
    "nyah":       {"label": "nyah~",                  "emoji": "😜", "targeted": False},
    "pout":       {"label": "phụng phịu",             "emoji": "😤", "targeted": False},
    "roll":       {"label": "lăn",                    "emoji": "🙄", "targeted": False},
    "run":        {"label": "chạy",                   "emoji": "🏃", "targeted": False},
    "sad":        {"label": "buồn",                   "emoji": "😞", "targeted": False},
    "scared":     {"label": "sợ hãi",                 "emoji": "😱", "targeted": False},
    "shout":      {"label": "hét",                    "emoji": "📢", "targeted": False},
    "shrug":      {"label": "nhún vai",               "emoji": "🤷", "targeted": False},
    "shy":        {"label": "ngại ngùng",             "emoji": "🙈", "targeted": False},
    "sigh":       {"label": "thở dài",                "emoji": "😮‍💨", "targeted": False},
    "sip":        {"label": "nhâm nhi",               "emoji": "🍵", "targeted": False},
    "sleep":      {"label": "ngủ",                    "emoji": "😴", "targeted": False},
    "slowclap":   {"label": "vỗ tay chậm",            "emoji": "👏", "targeted": False},
    "smile":      {"label": "cười",                   "emoji": "😊", "targeted": False},
    "smug":       {"label": "tự mãn",                 "emoji": "😏", "targeted": False},
    "sneeze":     {"label": "hắt xì",                 "emoji": "🤧", "targeted": False},
    "sorry":      {"label": "xin lỗi",                "emoji": "🙏", "targeted": False},
    "stop":       {"label": "dừng lại",               "emoji": "🛑", "targeted": False},
    "surprised":  {"label": "ngạc nhiên",              "emoji": "😲", "targeted": False},
    "sweat":      {"label": "toát mồ hôi",            "emoji": "😓", "targeted": False},
    "thumbsup":   {"label": "thích",                  "emoji": "👍", "targeted": False},
    "tired":      {"label": "mệt",                   "emoji": "😩", "targeted": False},
    "woah":       {"label": "woah",                   "emoji": "😮", "targeted": False},
    "yawn":       {"label": "ngáp",                   "emoji": "🥱", "targeted": False},
    "yay":        {"label": "yay!",                   "emoji": "🥳", "targeted": False},
    "yes":        {"label": "gật đầu",                "emoji": "✅", "targeted": False},
}


async def _fetch_gif(reaction: str) -> str | None:
    """Fetch a random GIF URL from otakugifs.xyz."""
    try:
        async with aiohttp.ClientSession() as cs:
            async with cs.get(f"{API_BASE}?reaction={reaction}&format=gif", timeout=aiohttp.ClientTimeout(total=8)) as r:
                if r.status == 200:
                    data = await r.json()
                    return data.get("url")
    except Exception as e:
        logger.warning(f"otakugifs fetch failed for {reaction}: {e}")
    return None


def get_session():
    return SessionLocal()


def _get_prefix(session) -> str:
    """Get command prefix from DB config."""
    config = session.execute(select(SystemConfig).limit(1)).scalars().first()
    return (config.command_prefix if config and config.command_prefix else "!")


async def _send_interaction(channel, author, reaction_key: str, meta: dict, target: discord.Member | None = None):
    """Core logic shared by slash and prefix commands."""
    gif_url = await _fetch_gif(reaction_key)
    session = get_session()
    try:
        vars_dict = {
            "user": str(author.display_name),
            "user.mention": author.mention,
            "action": meta["label"],
            "emoji": meta["emoji"],
            "gif_url": gif_url or "",
        }
        if target:
            vars_dict["target"] = str(target.display_name)
            vars_dict["target.mention"] = target.mention

        result = build_embed(f"interact_{reaction_key}", session, vars=vars_dict)
    finally:
        session.close()

    if isinstance(result, str):
        await channel.send(result)
    else:
        if gif_url:
            result.set_image(url=gif_url)
        await channel.send(embed=result)


class InteractionCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    # ── Prefix command listener ───────────────────────────────────────────
    @discord.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot or not message.guild or not message.content:
            return

        session = get_session()
        try:
            prefix = _get_prefix(session)
        finally:
            session.close()

        content = message.content.strip()
        if not content.startswith(prefix):
            return

        # Parse: prefix + command [+ @mention]
        without_prefix = content[len(prefix):]
        parts = without_prefix.split(None, 1)
        if not parts:
            return

        cmd_name = parts[0].lower()
        if cmd_name not in REACTIONS:
            return

        # Check feature toggle
        from src.bot.feature_utils import feature_enabled
        if not feature_enabled("interactions"):
            return

        meta = REACTIONS[cmd_name]

        # Resolve target from mentions
        target = None
        if meta["targeted"]:
            if message.mentions:
                target = message.mentions[0]
                if target.id == message.author.id:
                    await message.reply("Bạn không thể tự tương tác với chính mình! 😅", delete_after=5)
                    return
            else:
                # Targeted command without mention — show usage hint
                await message.reply(
                    f"Dùng: `{prefix}{cmd_name} @user`",
                    delete_after=5,
                )
                return

        await _send_interaction(message.channel, message.author, cmd_name, meta, target)

    # ── Admin command: set prefix ─────────────────────────────────────────
    @discord.slash_command(name="setprefix", description="🔧 Đặt prefix cho lệnh tương tác (Admin)")
    @discord.default_permissions(administrator=True)
    async def setprefix_cmd(
        self,
        ctx: discord.ApplicationContext,
        prefix: discord.Option(str, "Prefix mới (vd: ! . ? >)", required=True, max_length=5),  # type: ignore
    ):
        prefix = prefix.strip()
        if not prefix:
            await ctx.respond("❌ Prefix không được để trống!", ephemeral=True)
            return

        session = get_session()
        try:
            config = session.execute(select(SystemConfig).limit(1)).scalars().first()
            if config:
                config.command_prefix = prefix
                session.commit()
                await ctx.respond(f"✅ Prefix đã được đổi thành `{prefix}`\nVí dụ: `{prefix}hug @user`", ephemeral=True)
            else:
                await ctx.respond("❌ Chưa có cấu hình hệ thống!", ephemeral=True)
        finally:
            session.close()


# ── Slash command factory ─────────────────────────────────────────────────────

def _make_command(reaction_key: str, meta: dict):
    """Factory: tạo slash command cho một reaction."""

    if meta["targeted"]:
        async def _cmd(
            self: InteractionCog,
            ctx: discord.ApplicationContext,
            user: discord.Option(discord.Member, "Người bạn muốn tương tác", required=True),  # type: ignore
        ):
            if user.id == ctx.author.id:
                await ctx.respond("Bạn không thể tự tương tác với chính mình! 😅", ephemeral=True)
                return
            gif_url = await _fetch_gif(reaction_key)
            session = get_session()
            try:
                result = build_embed(f"interact_{reaction_key}", session, vars={
                    "user": str(ctx.author.display_name),
                    "user.mention": ctx.author.mention,
                    "target": str(user.display_name),
                    "target.mention": user.mention,
                    "action": meta["label"],
                    "emoji": meta["emoji"],
                    "gif_url": gif_url or "",
                })
            finally:
                session.close()
            if isinstance(result, str):
                await ctx.respond(result)
            else:
                if gif_url:
                    result.set_image(url=gif_url)
                await ctx.respond(embed=result)
    else:
        async def _cmd(
            self: InteractionCog,
            ctx: discord.ApplicationContext,
        ):
            gif_url = await _fetch_gif(reaction_key)
            session = get_session()
            try:
                result = build_embed(f"interact_{reaction_key}", session, vars={
                    "user": str(ctx.author.display_name),
                    "user.mention": ctx.author.mention,
                    "action": meta["label"],
                    "emoji": meta["emoji"],
                    "gif_url": gif_url or "",
                })
            finally:
                session.close()
            if isinstance(result, str):
                await ctx.respond(result)
            else:
                if gif_url:
                    result.set_image(url=gif_url)
                await ctx.respond(embed=result)
    # Set nice description
    if meta["targeted"]:
        desc = f"{meta['emoji']} {meta['label'].capitalize()} một người"
    else:
        desc = f"{meta['emoji']} {meta['label'].capitalize()}"

    _cmd.__name__ = reaction_key
    return discord.slash_command(name=reaction_key, description=desc)(_cmd)


# ── Register all slash commands on the cog class ──
for _rk, _rm in REACTIONS.items():
    setattr(InteractionCog, _rk, _make_command(_rk, _rm))


def setup(bot: discord.Bot):
    bot.add_cog(InteractionCog(bot))
