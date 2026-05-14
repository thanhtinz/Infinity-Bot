"""
Interaction commands — anime reaction GIFs (hug, kiss, slap, …)
Uses https://api.otakugifs.xyz API.
"""
import discord
import logging
import aiohttp
from src.database.config import SessionLocal
from src.bot.embed_utils import build_embed

logger = logging.getLogger(__name__)

API_BASE = "https://api.otakugifs.xyz/gif"

# ── Reaction metadata ─────────────────────────────────────────────────────────
# targeted = True means the command mentions another user (hug @user)
# targeted = False means it's a self-action (dance, cry)

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


class InteractionCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    # We use a single factory to create all slash commands
    # to avoid 68 copy-paste methods.


def _make_command(reaction_key: str, meta: dict):
    """Factory: tạo slash command cho một reaction."""

    if meta["targeted"]:
        # Command targets another user
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
        # Self-action, no target required
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


# ── Register all commands on the cog class ──
for _rk, _rm in REACTIONS.items():
    setattr(InteractionCog, _rk, _make_command(_rk, _rm))


def setup(bot: discord.Bot):
    bot.add_cog(InteractionCog(bot))
