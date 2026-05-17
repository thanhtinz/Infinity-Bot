"""i18n — Bot language system (EN / VI).

Usage:
    from src.bot.i18n import t, get_lang, set_lang

    lang = get_lang(guild_id)
    text = t(guild_id, "welcome_title", bot_name="Infinity Bot")
"""
from __future__ import annotations
import logging

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
        "fun_itunes_genre": "Genre",
        # ── Moderation ──
        "mod_no_perm": "❌ You don't have permission to do this.",
        "mod_cannot_action_self": "❌ You cannot perform this action on yourself.",
        "mod_cannot_action_higher": "❌ You cannot perform this action on someone with a higher role.",
        "mod_case_created": "Case #{case_number} created.",
        "mod_muted": "🔇 {user} has been muted. {reason_text}",
        "mod_unmuted": "🔊 {user} has been unmuted.",
        "mod_deafened": "🔇 {user} has been deafened.",
        "mod_undeafened": "🔊 {user} has been undeafened.",
        "mod_softbanned": "🔨 {user} has been softbanned (messages deleted). {reason_text}",
        "mod_clean_done": "🗑️ Deleted **{count}** bot messages.",
        "mod_members_title": "👥 Members with role {role}",
        "mod_lockdown_start": "🔒 Lockdown activated on {count} channels.",
        "mod_lockdown_end": "🔓 Lockdown deactivated on {count} channels.",
        "mod_rolepersist_add": "📌 Role **{role}** will persist for **{user}** across leaves/rejoins.",
        "mod_rolepersist_remove": "📌 Role **{role}** will no longer persist for **{user}**.",
        "mod_temprole_add": "⏱️ Role **{role}** assigned to **{user}** for **{duration}**.",
        "mod_note_added": "📝 Note #{note_id} added for {user}.",
        "mod_note_deleted": "🗑️ Note #{note_id} deleted.",
        "mod_note_edited": "✏️ Note #{note_id} edited.",
        "mod_notes_cleared": "🗑️ Cleared **{count}** notes for {user}.",
        "mod_notes_empty": "📝 No notes found for this user.",
        "mod_warn_deleted": "🗑️ Warning #{warn_id} deleted.",
        "mod_duration_changed": "⏱️ Duration of case #{case_number} changed to **{duration}**.",
        "mod_reason_updated": "✏️ Reason of case #{case_number} updated.",
        "mod_modlogs_title": "📋 Mod Logs for {user}",
        "mod_modlogs_empty": "📋 No mod logs found for this user.",
        "mod_active_title": "⏱️ Active Moderations",
        "mod_active_empty": "✅ No active timed moderations.",
        "mod_case_title": "📋 Case #{case_number}",
        "mod_modstats_title": "📊 Mod Stats for {mod}",
        "mod_star_title": "⭐ Starboard Stats",
        "mod_ignored_title": "🚫 Ignored Items",
        "mod_diagnose_title": "🔍 Diagnose: {target}",
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
        # ── Fun commands ──
        "fun_api_error": "❌ Không thể kết nối API lúc này. Thử lại sau.",
        "fun_space_title": "🛰️ Trạm Vũ trụ Quốc tế (ISS)",
        "fun_space_desc": "**Vị trí hiện tại:**\n🌐 Vĩ độ: `{lat}` — Kinh độ: `{lon}`",
        "fun_space_astronauts": "👨‍🚀 Phi hành gia đang ở ngoài vũ trụ ({count})",
        "fun_pokemon_not_found": "❌ Không tìm thấy Pokémon **{name}**.",
        "fun_pokemon_type": "Loại",
        "fun_pokemon_abilities": "Khả năng",
        "fun_pokemon_height_weight": "Cao / Nặng",
        "fun_itunes_not_found": "❌ Không tìm thấy kết quả cho **{query}**.",
        "fun_itunes_artist": "Nghệ sĩ",
        "fun_itunes_album": "Album",
        "fun_itunes_genre": "Thể loại",
        # ── Moderation ──
        "mod_no_perm": "❌ Bạn không có quyền thực hiện hành động này.",
        "mod_cannot_action_self": "❌ Bạn không thể thực hiện hành động này trên chính mình.",
        "mod_cannot_action_higher": "❌ Bạn không thể thực hiện hành động này trên người có role cao hơn.",
        "mod_case_created": "Case #{case_number} đã được tạo.",
        "mod_muted": "🔇 {user} đã bị mute. {reason_text}",
        "mod_unmuted": "🔊 {user} đã được unmute.",
        "mod_deafened": "🔇 {user} đã bị deafen.",
        "mod_undeafened": "🔊 {user} đã được undeafen.",
        "mod_softbanned": "🔨 {user} đã bị softban (xóa tin nhắn). {reason_text}",
        "mod_clean_done": "🗑️ Đã xóa **{count}** tin nhắn bot.",
        "mod_members_title": "👥 Thành viên có role {role}",
        "mod_lockdown_start": "🔒 Đã khóa **{count}** kênh.",
        "mod_lockdown_end": "🔓 Đã mở khóa **{count}** kênh.",
        "mod_rolepersist_add": "📌 Role **{role}** sẽ được giữ lại cho **{user}** khi rời/vào lại server.",
        "mod_rolepersist_remove": "📌 Role **{role}** sẽ không còn được giữ lại cho **{user}**.",
        "mod_temprole_add": "⏱️ Role **{role}** đã gán cho **{user}** trong **{duration}**.",
        "mod_note_added": "📝 Ghi chú #{note_id} đã thêm cho {user}.",
        "mod_note_deleted": "🗑️ Ghi chú #{note_id} đã xóa.",
        "mod_note_edited": "✏️ Ghi chú #{note_id} đã sửa.",
        "mod_notes_cleared": "🗑️ Đã xóa **{count}** ghi chú cho {user}.",
        "mod_notes_empty": "📝 Không có ghi chú nào cho user này.",
        "mod_warn_deleted": "🗑️ Cảnh cáo #{warn_id} đã xóa.",
        "mod_duration_changed": "⏱️ Thời hạn case #{case_number} đã đổi thành **{duration}**.",
        "mod_reason_updated": "✏️ Lý do case #{case_number} đã được cập nhật.",
        "mod_modlogs_title": "📋 Lịch sử xử phạt của {user}",
        "mod_modlogs_empty": "📋 Không có lịch sử xử phạt cho user này.",
        "mod_active_title": "⏱️ Xử phạt đang hoạt động",
        "mod_active_empty": "✅ Không có xử phạt có thời hạn nào đang hoạt động.",
        "mod_case_title": "📋 Case #{case_number}",
        "mod_modstats_title": "📊 Thống kê mod cho {mod}",
        "mod_star_title": "⭐ Thống kê Starboard",
        "mod_ignored_title": "🚫 Mục bị bỏ qua",
        "mod_diagnose_title": "🔍 Chẩn đoán: {target}",
    },
}

# ── Language cache (guild_id -> lang code) ────────────────────────────────────

_lang_cache: dict[str, str] = {}


def get_lang(guild_id: str | int) -> str:
    """Get language for a guild. Checks cache first, then DB, defaults to 'en'."""
    gid = str(guild_id) if guild_id else ""
    if not gid:
        return "en"
    if gid in _lang_cache:
        return _lang_cache[gid]
    # DB lookup
    try:
        from src.database.config import SessionLocal
        from src.models.models import SystemConfig
        if SessionLocal is None:
            return "en"
        db = SessionLocal()
        try:
            cfg = db.query(SystemConfig).filter(
                SystemConfig.guild_id == gid
            ).first()
            lang = (cfg.language if cfg and cfg.language else "en")
            _lang_cache[gid] = lang
            return lang
        finally:
            db.close()
    except Exception:
        logger.debug("i18n: DB lookup failed for guild %s, defaulting to en", gid)
        return "en"


def set_lang(guild_id: str | int, lang: str) -> None:
    """Update language for a guild in DB + cache."""
    gid = str(guild_id) if guild_id else ""
    if not gid:
        return
    lang = lang if lang in STRINGS else "en"
    _lang_cache[gid] = lang
    try:
        from src.database.config import SessionLocal
        from src.models.models import SystemConfig
        if SessionLocal is None:
            return
        db = SessionLocal()
        try:
            cfg = db.query(SystemConfig).filter(
                SystemConfig.guild_id == gid
            ).first()
            if cfg:
                cfg.language = lang
                db.commit()
        finally:
            db.close()
    except Exception:
        logger.warning("i18n: failed to save language for guild %s", gid)


def invalidate_lang_cache(guild_id: str | int | None = None) -> None:
    """Clear language cache. Call when language changes via API."""
    if guild_id:
        _lang_cache.pop(str(guild_id), None)
    else:
        _lang_cache.clear()


def t(guild_id: str | int, key: str, **kwargs) -> str:
    """Translate key using guild's configured language."""
    lang = get_lang(guild_id)
    text = STRINGS.get(lang, STRINGS["en"]).get(key)
    if text is None:
        # Fallback to English if key missing in target language
        text = STRINGS["en"].get(key, key)
    if kwargs:
        try:
            text = text.format(**kwargs)
        except (KeyError, ValueError):
            pass
    return text
