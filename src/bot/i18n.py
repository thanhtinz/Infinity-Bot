"""i18n — Bot language system (EN / VI).

Usage:
    from src.bot.i18n import t, get_lang, set_lang

    lang = get_lang(guild_id)
    text = t(guild_id, "welcome_title", bot_name="Infinity Bot")
"""
from __future__ import annotations
import logging
from sqlalchemy import select

logger = logging.getLogger(__name__)

# ── String table ──────────────────────────────────────────────────────────────

STRINGS: dict[str, dict[str, str]] = {
    "en": {
        # Onboarding / welcome
        "welcome_title": "👋 Thanks for adding {bot_name}!",
        "welcome_desc": (
            "**{bot_name}** is a full-featured Discord bot. Here's what you can do:\n\n"
            "🛒 **Shop & Orders** — sell products, manage orders with PayOS\n"
            "🎫 **Tickets** — multi-panel support ticket system\n"
            "🎉 **Giveaways** — professional giveaways with reroll\n"
            "🔨 **Moderation** — ban, kick, timeout, automod\n"
            "🎙️ **TempVoice** — user-managed temporary voice channels\n"
            "🎨 **Embed Builder** — customise every bot notification\n\n"
            "Use `/help` to see all commands."
        ),
        "welcome_select_lang": "Please select your preferred language to get started:",
        "welcome_footer": "You can change the language anytime with /language",
        "lang_set_en": "✅ Language set to **English**. Use `/help` to get started.",
        "lang_set_vi": "✅ Đã đặt ngôn ngữ thành **Tiếng Việt**. Dùng `/help` để bắt đầu.",
        "lang_no_perm": "❌ You need the **Manage Server** permission to change the bot language.",
        "lang_current_en": "🇬🇧 The bot language is already set to **English**.",
        "lang_current_vi": "🇻🇳 Ngôn ngữ bot hiện tại là **Tiếng Việt**.",
        "lang_prompt": "Select the bot language for this server:",
    },
    "vi": {
        # Onboarding / welcome
        "welcome_title": "👋 Cảm ơn đã thêm {bot_name}!",
        "welcome_desc": (
            "**{bot_name}** là bot Discord đa năng. Dưới đây là những gì bạn có thể làm:\n\n"
            "🛒 **Shop & Đơn hàng** — bán sản phẩm, quản lý đơn với PayOS\n"
            "🎫 **Ticket** — hệ thống ticket hỗ trợ đa panel\n"
            "🎉 **Giveaway** — tổ chức giveaway chuyên nghiệp, reroll\n"
            "🔨 **Kiểm duyệt** — ban, kick, timeout, automod\n"
            "🎙️ **TempVoice** — kênh voice tạm thời người dùng tự quản lý\n"
            "🎨 **Embed Builder** — tuỳ chỉnh mọi thông báo của bot\n\n"
            "Dùng `/help` để xem tất cả lệnh."
        ),
        "welcome_select_lang": "Vui lòng chọn ngôn ngữ để bắt đầu:",
        "welcome_footer": "Bạn có thể đổi ngôn ngữ bất cứ lúc nào với /language",
        "lang_set_en": "✅ Language set to **English**. Use `/help` to get started.",
        "lang_set_vi": "✅ Đã đặt ngôn ngữ thành **Tiếng Việt**. Dùng `/help` để bắt đầu.",
        "lang_no_perm": "❌ Bạn cần quyền **Quản lý Server** để đổi ngôn ngữ bot.",
        "lang_current_en": "🇬🇧 The bot language is already set to **English**.",
        "lang_current_vi": "🇻🇳 Ngôn ngữ bot hiện tại là **Tiếng Việt**.",
        "lang_prompt": "Chọn ngôn ngữ bot cho server này:",
    },
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_session():
    from src.database.config import SessionLocal
    return SessionLocal()


def get_lang(guild_id: str | int) -> str:
    """Return 'en' or 'vi' for the guild. Defaults to 'en'."""
    try:
        from src.models.models import SystemConfig
        session = _get_session()
        try:
            cfg = session.execute(
                select(SystemConfig).where(SystemConfig.guild_id == str(guild_id))
            ).scalars().first()
            if cfg and cfg.language in ("en", "vi"):
                return cfg.language
        finally:
            session.close()
    except Exception as e:
        logger.warning(f"i18n.get_lang failed: {e}")
    return "en"


def set_lang(guild_id: str | int, lang: str) -> None:
    """Persist language ('en' or 'vi') for the guild."""
    if lang not in ("en", "vi"):
        raise ValueError(f"Invalid language: {lang}")
    try:
        from src.models.models import SystemConfig
        session = _get_session()
        try:
            cfg = session.execute(
                select(SystemConfig).where(SystemConfig.guild_id == str(guild_id))
            ).scalars().first()
            if cfg:
                cfg.language = lang
                session.commit()
        finally:
            session.close()
    except Exception as e:
        logger.error(f"i18n.set_lang failed: {e}")


def t(guild_id: str | int, key: str, **kwargs) -> str:
    """Translate key for guild. Falls back to English if key/lang missing."""
    lang = get_lang(guild_id)
    table = STRINGS.get(lang) or STRINGS["en"]
    text = table.get(key) or STRINGS["en"].get(key, key)
    if kwargs:
        try:
            text = text.format(**kwargs)
        except (KeyError, ValueError):
            pass
    return text
