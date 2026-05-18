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
    # ── Targeted interactions ──
    "airkiss":    {"label": "sends an air kiss to",   "emoji": "😘", "targeted": True},
    "angrystare": {"label": "glares angrily at",       "emoji": "😠", "targeted": True},
    "bite":       {"label": "bites",                   "emoji": "😬", "targeted": True},
    "brofist":    {"label": "brofists",                "emoji": "🤜", "targeted": True},
    "cuddle":     {"label": "cuddles",                 "emoji": "🤗", "targeted": True},
    "handhold":   {"label": "holds hands with",        "emoji": "🤝", "targeted": True},
    "hug":        {"label": "hugs",                    "emoji": "🫂", "targeted": True},
    "kiss":       {"label": "kisses",                  "emoji": "💋", "targeted": True},
    "lick":       {"label": "licks",                   "emoji": "👅", "targeted": True},
    "nom":        {"label": "noms",                    "emoji": "😋", "targeted": True},
    "nuzzle":     {"label": "nuzzles",                 "emoji": "🥰", "targeted": True},
    "pat":        {"label": "pats",                    "emoji": "🤚", "targeted": True},
    "pinch":      {"label": "pinches",                 "emoji": "🤏", "targeted": True},
    "poke":       {"label": "pokes",                   "emoji": "👉", "targeted": True},
    "punch":      {"label": "punches",                 "emoji": "👊", "targeted": True},
    "slap":       {"label": "slaps",                   "emoji": "🫲", "targeted": True},
    "smack":      {"label": "smacks",                  "emoji": "💥", "targeted": True},
    "tickle":     {"label": "tickles",                 "emoji": "🤭", "targeted": True},
    "wave":       {"label": "waves at",                "emoji": "👋", "targeted": True},
    "wink":       {"label": "winks at",                "emoji": "😉", "targeted": True},
    "stare":      {"label": "stares at",               "emoji": "👀", "targeted": True},
    "peek":       {"label": "peeks at",                "emoji": "🫣", "targeted": True},

    # ── Self / expressions ──
    "bleh":       {"label": "sticks tongue out",       "emoji": "😝", "targeted": False},
    "blush":      {"label": "blushes",                 "emoji": "😊", "targeted": False},
    "celebrate":  {"label": "celebrates",              "emoji": "🎉", "targeted": False},
    "cheers":     {"label": "raises a glass",          "emoji": "🍻", "targeted": False},
    "clap":       {"label": "claps",                   "emoji": "👏", "targeted": False},
    "confused":   {"label": "is confused",             "emoji": "😕", "targeted": False},
    "cool":       {"label": "looks cool",              "emoji": "😎", "targeted": False},
    "cry":        {"label": "cries",                   "emoji": "😢", "targeted": False},
    "dance":      {"label": "dances",                  "emoji": "💃", "targeted": False},
    "drool":      {"label": "drools",                  "emoji": "🤤", "targeted": False},
    "evillaugh":  {"label": "laughs evilly",           "emoji": "😈", "targeted": False},
    "facepalm":   {"label": "facepalms",               "emoji": "🤦", "targeted": False},
    "happy":      {"label": "is happy",                "emoji": "😄", "targeted": False},
    "headbang":   {"label": "headbangs",               "emoji": "🤘", "targeted": False},
    "huh":        {"label": "is confused",             "emoji": "❓", "targeted": False},
    "laugh":      {"label": "laughs",                  "emoji": "😂", "targeted": False},
    "love":       {"label": "is in love",              "emoji": "❤️", "targeted": False},
    "mad":        {"label": "is angry",                "emoji": "😡", "targeted": False},
    "nervous":    {"label": "is nervous",              "emoji": "😰", "targeted": False},
    "no":         {"label": "shakes head",             "emoji": "🙅", "targeted": False},
    "nosebleed":  {"label": "gets a nosebleed",        "emoji": "🫠", "targeted": False},
    "nyah":       {"label": "nyah~",                   "emoji": "😜", "targeted": False},
    "pout":       {"label": "pouts",                   "emoji": "😤", "targeted": False},
    "roll":       {"label": "rolls eyes",              "emoji": "🙄", "targeted": False},
    "run":        {"label": "runs",                    "emoji": "🏃", "targeted": False},
    "sad":        {"label": "is sad",                  "emoji": "😞", "targeted": False},
    "scared":     {"label": "is scared",               "emoji": "😱", "targeted": False},
    "shout":      {"label": "shouts",                  "emoji": "📢", "targeted": False},
    "shrug":      {"label": "shrugs",                  "emoji": "🤷", "targeted": False},
    "shy":        {"label": "is shy",                  "emoji": "🙈", "targeted": False},
    "sigh":       {"label": "sighs",                   "emoji": "😮‍💨", "targeted": False},
    "sip":        {"label": "takes a sip",             "emoji": "🍵", "targeted": False},
    "sleep":      {"label": "falls asleep",            "emoji": "😴", "targeted": False},
    "slowclap":   {"label": "slow claps",              "emoji": "👏", "targeted": False},
    "smile":      {"label": "smiles",                  "emoji": "😊", "targeted": False},
    "smug":       {"label": "looks smug",              "emoji": "😏", "targeted": False},
    "sneeze":     {"label": "sneezes",                 "emoji": "🤧", "targeted": False},
    "sorry":      {"label": "apologizes",              "emoji": "🙏", "targeted": False},
    "stop":       {"label": "says stop",               "emoji": "🛑", "targeted": False},
    "surprised":  {"label": "is surprised",            "emoji": "😲", "targeted": False},
    "sweat":      {"label": "sweats",                  "emoji": "😓", "targeted": False},
    "thumbsup":   {"label": "gives a thumbs up",       "emoji": "👍", "targeted": False},
    "tired":      {"label": "is tired",                "emoji": "😩", "targeted": False},
    "woah":       {"label": "says woah",               "emoji": "😮", "targeted": False},
    "yawn":       {"label": "yawns",                   "emoji": "🥱", "targeted": False},
    "yay":        {"label": "says yay!",               "emoji": "🥳", "targeted": False},
    "yes":        {"label": "nods",                    "emoji": "✅", "targeted": False},
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
                    await message.reply("You can't interact with yourself! 😅", delete_after=5)
                    return
            else:
                # Targeted command without mention — show usage hint
                await message.reply(
                    f"Usage: `{prefix}{cmd_name} @user`",
                    delete_after=5,
                )
                return

        await _send_interaction(message.channel, message.author, cmd_name, meta, target)

    # ── Admin command: set prefix ─────────────────────────────────────────
    @discord.slash_command(name="setprefix", description="🔧 Set interaction command prefix (Admin)")
    @discord.default_permissions(administrator=True)
    async def setprefix_cmd(
        self,
        ctx: discord.ApplicationContext,
        prefix: discord.Option(str, "New prefix (e.g. ! . ? >)", required=True, max_length=5),  # type: ignore
    ):
        prefix = prefix.strip()
        if not prefix:
            await ctx.respond("❌ Prefix cannot be empty!", ephemeral=True)
            return

        session = get_session()
        try:
            config = session.execute(select(SystemConfig).limit(1)).scalars().first()
            if config:
                config.command_prefix = prefix
                session.commit()
                await ctx.respond(f"✅ Prefix changed to `{prefix}`\nExample: `{prefix}hug @user`", ephemeral=True)
            else:
                await ctx.respond("❌ No system configuration found!", ephemeral=True)
        finally:
            session.close()


# ── Slash command factory ─────────────────────────────────────────────────────

def _make_command(reaction_key: str, meta: dict):
    """Factory: create a slash command for a reaction."""

    if meta["targeted"]:
        async def _cmd(
            self: InteractionCog,
            ctx: discord.ApplicationContext,
            user: discord.Option(discord.Member, "User to interact with", required=True),  # type: ignore
        ):
            if user.id == ctx.author.id:
                await ctx.respond("You can't interact with yourself! 😅", ephemeral=True)
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
        desc = f"{meta['emoji']} {meta['label'].capitalize()} someone"
    else:
        desc = f"{meta['emoji']} {meta['label'].capitalize()}"

    _cmd.__name__ = reaction_key
    return discord.slash_command(name=reaction_key, description=desc)(_cmd)


# ── Register all slash commands on the cog class ──
for _rk, _rm in REACTIONS.items():
    setattr(InteractionCog, _rk, _make_command(_rk, _rm))


def setup(bot: discord.Bot):
    bot.add_cog(InteractionCog(bot))
