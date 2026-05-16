# src/bot/cogs/fun.py
"""Fun slash commands — public APIs for jokes, animals, space, music, pokemon, etc."""
import discord
import logging
import httpx
from src.bot.i18n import t

logger = logging.getLogger(__name__)

# ── API endpoints (all free, no key needed) ───────────────────────────────────
_APIS = {
    "dadjoke":  "https://icanhazdadjoke.com/",
    "cat":      "https://api.thecatapi.com/v1/images/search",
    "dog":      "https://dog.ceo/api/breeds/image/random",
    "pug":      "https://dog.ceo/api/breed/pug/images/random",
    "norris":   "https://api.chucknorris.io/jokes/random",
    "space":    "http://api.open-notify.org/iss-now.json",
    "space_ppl":"http://api.open-notify.org/astros.json",
}


async def _fetch_json(url: str, headers: dict | None = None) -> dict | list | None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url, headers=headers or {})
            r.raise_for_status()
            return r.json()
    except Exception as e:
        logger.warning(f"Fun API error ({url}): {e}")
        return None


class FunCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    # ── /space ────────────────────────────────────────────────────────────────
    @discord.slash_command(name="space", description="Get ISS location & astronaut info")
    async def space_cmd(self, ctx: discord.ApplicationContext):
        await ctx.defer()
        gid = str(ctx.guild.id) if ctx.guild else "0"
        iss = await _fetch_json(_APIS["space"])
        astros = await _fetch_json(_APIS["space_ppl"])
        if not iss:
            await ctx.respond(t(gid, "fun_api_error"), ephemeral=True)
            return
        pos = iss.get("iss_position", {})
        lat, lon = pos.get("latitude", "?"), pos.get("longitude", "?")
        embed = discord.Embed(
            title=t(gid, "fun_space_title"),
            description=t(gid, "fun_space_desc", lat=lat, lon=lon),
            color=discord.Color.dark_blue(),
        )
        embed.set_thumbnail(url="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/International_Space_Station.jpg/240px-International_Space_Station.jpg")
        if astros:
            people = astros.get("people", [])
            names = ", ".join(p["name"] for p in people[:15])
            embed.add_field(
                name=t(gid, "fun_space_astronauts", count=len(people)),
                value=names or "—",
                inline=False,
            )
        embed.set_footer(text="Open Notify API")
        await ctx.respond(embed=embed)

    # ── /dadjoke ──────────────────────────────────────────────────────────────
    @discord.slash_command(name="dadjoke", description="Get a random Dad joke")
    async def dadjoke_cmd(self, ctx: discord.ApplicationContext):
        data = await _fetch_json(_APIS["dadjoke"], headers={"Accept": "application/json"})
        if not data or "joke" not in data:
            await ctx.respond("😅 Couldn't fetch a joke right now.", ephemeral=True)
            return
        embed = discord.Embed(title="😂 Dad Joke", description=data["joke"], color=discord.Color.gold())
        await ctx.respond(embed=embed)

    # ── /cat ──────────────────────────────────────────────────────────────────
    @discord.slash_command(name="cat", description="Find a cute cat picture")
    async def cat_cmd(self, ctx: discord.ApplicationContext):
        data = await _fetch_json(_APIS["cat"])
        if not data or not isinstance(data, list) or not data[0].get("url"):
            await ctx.respond("🐱 Couldn't find a cat right now.", ephemeral=True)
            return
        embed = discord.Embed(title="🐱 Meow!", color=discord.Color.orange())
        embed.set_image(url=data[0]["url"])
        await ctx.respond(embed=embed)

    # ── /dog ──────────────────────────────────────────────────────────────────
    @discord.slash_command(name="dog", description="Find a cute dog picture")
    async def dog_cmd(self, ctx: discord.ApplicationContext):
        data = await _fetch_json(_APIS["dog"])
        if not data or data.get("status") != "success":
            await ctx.respond("🐶 Couldn't find a dog right now.", ephemeral=True)
            return
        embed = discord.Embed(title="🐶 Woof!", color=discord.Color.from_rgb(139, 90, 43))
        embed.set_image(url=data["message"])
        await ctx.respond(embed=embed)

    # ── /pug ──────────────────────────────────────────────────────────────────
    @discord.slash_command(name="pug", description="Find a cute pug picture")
    async def pug_cmd(self, ctx: discord.ApplicationContext):
        data = await _fetch_json(_APIS["pug"])
        if not data or data.get("status") != "success":
            await ctx.respond("🐶 Couldn't find a pug right now.", ephemeral=True)
            return
        embed = discord.Embed(title="🐾 Pug!", color=discord.Color.from_rgb(210, 180, 140))
        embed.set_image(url=data["message"])
        await ctx.respond(embed=embed)

    # ── /norris ───────────────────────────────────────────────────────────────
    @discord.slash_command(name="norris", description="Get a random Chuck Norris fact")
    async def norris_cmd(self, ctx: discord.ApplicationContext):
        data = await _fetch_json(_APIS["norris"])
        if not data or "value" not in data:
            await ctx.respond("💪 Couldn't fetch a fact right now.", ephemeral=True)
            return
        embed = discord.Embed(title="💪 Chuck Norris", description=data["value"], color=discord.Color.red())
        if data.get("icon_url"):
            embed.set_thumbnail(url=data["icon_url"])
        await ctx.respond(embed=embed)

    # ── /pokemon ──────────────────────────────────────────────────────────────
    @discord.slash_command(name="pokemon", description="Get info on a Pokémon")
    async def pokemon_cmd(
        self,
        ctx: discord.ApplicationContext,
        name: discord.Option(str, "Pokémon name or ID", required=True),
    ):
        await ctx.defer()
        gid = str(ctx.guild.id) if ctx.guild else "0"
        data = await _fetch_json(f"https://pokeapi.co/api/v2/pokemon/{name.lower().strip()}")
        if not data:
            await ctx.respond(t(gid, "fun_pokemon_not_found", name=name), ephemeral=True)
            return
        pname = data.get("name", name).capitalize()
        pid = data.get("id", "?")
        types = ", ".join(t_["type"]["name"].capitalize() for t_ in data.get("types", []))
        stats_lines = []
        for s in data.get("stats", []):
            sname = s["stat"]["name"].upper().replace("-", " ")
            stats_lines.append(f"**{sname}**: {s['base_stat']}")
        abilities = ", ".join(a["ability"]["name"].replace("-", " ").title() for a in data.get("abilities", []))
        embed = discord.Embed(
            title=f"#{pid} — {pname}",
            color=discord.Color.from_rgb(255, 203, 5),
        )
        sprite = data.get("sprites", {}).get("other", {}).get("official-artwork", {}).get("front_default")
        if not sprite:
            sprite = data.get("sprites", {}).get("front_default")
        if sprite:
            embed.set_thumbnail(url=sprite)
        embed.add_field(name=t(gid, "fun_pokemon_type"), value=types or "—", inline=True)
        embed.add_field(name=t(gid, "fun_pokemon_abilities"), value=abilities or "—", inline=True)
        embed.add_field(name=t(gid, "fun_pokemon_height_weight"),
                        value=f"{data.get('height', 0) / 10}m / {data.get('weight', 0) / 10}kg", inline=True)
        embed.add_field(name="Stats", value="\n".join(stats_lines) if stats_lines else "—", inline=False)
        embed.set_footer(text="PokéAPI")
        await ctx.respond(embed=embed)

    # ── /itunes ───────────────────────────────────────────────────────────────
    @discord.slash_command(name="itunes", description="Search for a song on iTunes")
    async def itunes_cmd(
        self,
        ctx: discord.ApplicationContext,
        query: discord.Option(str, "Song name or artist", required=True),
    ):
        await ctx.defer()
        gid = str(ctx.guild.id) if ctx.guild else "0"
        data = await _fetch_json(f"https://itunes.apple.com/search?term={query.replace(' ', '+')}&media=music&limit=1")
        if not data or not data.get("results"):
            await ctx.respond(t(gid, "fun_itunes_not_found", query=query), ephemeral=True)
            return
        song = data["results"][0]
        embed = discord.Embed(
            title=song.get("trackName", "Unknown"),
            url=song.get("trackViewUrl"),
            color=discord.Color.from_rgb(251, 61, 87),
        )
        embed.add_field(name=t(gid, "fun_itunes_artist"), value=song.get("artistName", "—"), inline=True)
        embed.add_field(name=t(gid, "fun_itunes_album"), value=song.get("collectionName", "—"), inline=True)
        embed.add_field(name=t(gid, "fun_itunes_genre"), value=song.get("primaryGenreName", "—"), inline=True)
        if song.get("artworkUrl100"):
            embed.set_thumbnail(url=song["artworkUrl100"].replace("100x100", "600x600"))
        if song.get("releaseDate"):
            embed.set_footer(text=f"Released: {song['releaseDate'][:10]}")
        await ctx.respond(embed=embed)


def setup(bot: discord.Bot):
    bot.add_cog(FunCog(bot))
