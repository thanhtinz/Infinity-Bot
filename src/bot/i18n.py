"""i18n — Bot string table (English only).

Usage:
    from src.bot.i18n import t

    text = t(guild_id, "welcome_title", bot_name="Infinity Bot")
"""
from __future__ import annotations
import logging

logger = logging.getLogger(__name__)

# ── String table ──────────────────────────────────────────────────────────────

STRINGS: dict[str, str] = {
    # Onboarding / welcome
    "welcome_title": "👋 Thanks for adding {bot_name}!",
    "welcome_desc": (
        "**{bot_name}** is a full-featured Discord bot. Here's what you can do:\n\n"
        "🛒 **Shop & Orders** — sell products, manage orders with PayOS\n"
        "🎉 **Giveaways** — professional giveaways with reroll\n"
        "🔨 **Moderation** — ban, kick, timeout, automod\n"
        "🛡️ **Verification** — OAuth2 verify, VPN/alt detection, firewall\n"
        "🎨 **Embed Builder** — customise every bot notification\n\n"
        "Use `/help` to see all commands."
    ),
    "welcome_footer": "Configure your server at the dashboard",
    # ── Fun commands ──
    "fun_api_error": "❌ Could not reach the API right now. Try again later.",
    "fun_space_title": "🛰️ International Space Station",
    "fun_space_desc": "**Current position:**\n🌐 Lat: `{lat}` — Lon: `{lon}`",
    "fun_space_astronauts": "👨‍🚀 Astronauts in space ({count})",
    "fun_pokemon_not_found": "❌ Pokémon **{name}** not found.",
    "fun_pokemon_type": "Type",
    "fun_pokemon_abilities": "Abilities",
    "fun_pokemon_height_weight": "Height / Weight",
    "fun_itunes_not_found": "❌ No results for **{query}**.",
    "fun_itunes_artist": "Artist",
    "fun_itunes_album": "Album",
    "fun_itunes_title": "🎵 iTunes Search: {query}",
    "fun_dog_title": "🐶 Random Dog",
    "fun_cat_title": "🐱 Random Cat",
    "fun_fox_title": "🦊 Random Fox",
    "fun_advice_title": "💡 Advice",
    "fun_quote_title": "💬 Quote",
    "fun_quote_author": "— {author}",
    "fun_joke_title": "😂 Joke",
    "fun_fact_title": "🤓 Fun Fact",
    "fun_meme_title": "😂 Meme",
    "fun_8ball_title": "🎱 Magic 8-Ball",
    "fun_8ball_question": "Question",
    "fun_8ball_answer": "Answer",
    "fun_weather_title": "🌤️ Weather in {city}",
    "fun_weather_desc": "**Condition:** {condition}\n**Temp:** {temp}°C (feels like {feels}°C)\n**Humidity:** {humidity}%\n**Wind:** {wind} km/h",
    "fun_weather_not_found": "❌ City **{city}** not found.",
    "fun_trivia_title": "🧠 Trivia",
    "fun_trivia_category": "Category",
    "fun_trivia_difficulty": "Difficulty",
    "fun_trivia_answer": "Answer",
    "fun_crypto_title": "💰 {symbol} Price",
    "fun_crypto_price": "Price (USD)",
    "fun_crypto_change": "24h Change",
    "fun_crypto_not_found": "❌ Cryptocurrency **{symbol}** not found.",
    "fun_color_title": "🎨 Color: {hex}",
    "fun_color_rgb": "RGB",
    "fun_color_hsl": "HSL",
    "fun_color_name": "Name",
    "fun_number_title": "🔢 Number: {number}",
    "fun_number_interesting": "Interesting Fact",
    "fun_number_math": "Math Fact",
    "fun_urban_title": "📖 Urban Dictionary: {term}",
    "fun_urban_not_found": "❌ No definition found for **{term}**.",
    "fun_urban_example": "Example",
    "fun_urban_rating": "👍 {thumbs_up}  👎 {thumbs_down}",
}

# ── Cache ─────────────────────────────────────────────────────────────────────
_lang_cache: dict[str, str] = {}


def get_lang(guild_id: str | int) -> str:
    """Get language for a guild (always 'en' now, kept for API compat)."""
    return "en"


def invalidate_lang_cache(guild_id: str | int | None = None) -> None:
    """Clear language cache (no-op, kept for API compat)."""
    if guild_id:
        _lang_cache.pop(str(guild_id), None)
    else:
        _lang_cache.clear()


def t(guild_id: str | int, key: str, **kwargs) -> str:
    """Return translated string for key."""
    text = STRINGS.get(key, key)
    if kwargs:
        try:
            text = text.format(**kwargs)
        except (KeyError, ValueError):
            pass
    return text
