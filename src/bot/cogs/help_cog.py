"""Help command — category → command → detail, embed content from embed manager."""
from __future__ import annotations

import discord
from discord.ext import commands

from src.bot.embed_utils import build_embed
from src.database.config import SessionLocal

# ── Help data ────────────────────────────────────────────────────────────────
# Each category: emoji, name, list of (name, description, usage)
HELP_CATEGORIES: list[dict] = [
    {
        "key": "shop",
        "emoji": "🛒",
        "name": "Mua hàng",
        "commands": [
            {"name": "san_pham",       "emoji": "📦", "desc": "Xem danh sách & chi tiết sản phẩm",               "usage": "`/san_pham [sản phẩm]`"},
            {"name": "orders",         "emoji": "📋", "desc": "Xem đơn hàng của bạn",                         "usage": "`/orders` hoặc `/orders id:<id>`"},
            {"name": "feedback",       "emoji": "⭐", "desc": "Đánh giá sản phẩm đã mua",                     "usage": "`/feedback`"},
            {"name": "support",        "emoji": "🆘", "desc": "Liên hệ hỗ trợ",                               "usage": "`/support`"},
            {"name": "bxh",            "emoji": "📊", "desc": "Bảng xếp hạng mua hàng",                       "usage": "`/bxh`"},
            {"name": "tao_don",        "emoji": "🧾", "desc": "Tạo đơn hàng cho user",                        "usage": "`/tao_don`", "admin": True},
            {"name": "tao_don_custom", "emoji": "✏️", "desc": "Tạo đơn custom tên tự nhập",                   "usage": "`/tao_don_custom`", "admin": True},
            {"name": "bang_gia",       "emoji": "💰", "desc": "Gửi bảng giá sản phẩm vào kênh",               "usage": "`/bang_gia [#kênh]`", "admin": True},
        ],
    },
    {
        "key": "leveling",
        "emoji": "🏆",
        "name": "Leveling & XP",
        "commands": [
            {"name": "level rank",        "emoji": "🎖️", "desc": "Xem rank và XP của bạn hoặc thành viên khác", "usage": "`/level rank [@user]`"},
            {"name": "level leaderboard", "emoji": "📊", "desc": "Bảng xếp hạng XP server",                      "usage": "`/level leaderboard`"},
            {"name": "level background",  "emoji": "🖼️", "desc": "Chọn background cho rank card cá nhân",         "usage": "`/level background`"},
        ],
    },
    {
        "key": "giveaway",
        "emoji": "🎉",
        "name": "Giveaway",
        "commands": [
            {"name": "giveaway",        "emoji": "🎁", "desc": "Tạo giveaway mới (admin)",              "usage": "`/giveaway <thời gian> <số người> <giải thưởng>`", "admin": True},
            {"name": "giveaway_list",   "emoji": "📋", "desc": "Xem danh sách giveaway đang chạy",       "usage": "`/giveaway_list`"},
            {"name": "giveaway_reroll", "emoji": "🔁", "desc": "Chọn lại người thắng giveaway (admin)",  "usage": "`/giveaway_reroll <message_id>`", "admin": True},
            {"name": "giveaway_end",    "emoji": "🏁", "desc": "Kết thúc giveaway sớm (admin)",          "usage": "`/giveaway_end <message_id>`", "admin": True},
            {"name": "giveaway_ban",    "emoji": "🚫", "desc": "Cấm user tham gia giveaway (admin)",     "usage": "`/giveaway_ban <@user>`", "admin": True},
            {"name": "giveaway_unban",  "emoji": "✅", "desc": "Bỏ ban user khỏi giveaway (admin)",      "usage": "`/giveaway_unban <@user>`", "admin": True},
        ],
    },
    {
        "key": "ticket",
        "emoji": "🎫",
        "name": "Ticket",
        "commands": [
            {"name": "ticket create",     "emoji": "📩", "desc": "Tạo ticket hỗ trợ mới",                  "usage": "`/ticket create`"},
            {"name": "ticket close",      "emoji": "🔒", "desc": "Đóng ticket hiện tại",                    "usage": "`/ticket close`"},
            {"name": "ticket reopen",     "emoji": "🔓", "desc": "Mở lại ticket đã đóng",                   "usage": "`/ticket reopen`"},
            {"name": "ticket claim",      "emoji": "✋", "desc": "Nhận xử lý ticket (staff)",               "usage": "`/ticket claim`"},
            {"name": "ticket unclaim",    "emoji": "↩️", "desc": "Bỏ nhận ticket (staff)",                  "usage": "`/ticket unclaim`"},
            {"name": "ticket add",        "emoji": "➕", "desc": "Thêm thành viên vào ticket (staff)",      "usage": "`/ticket add <@user>`"},
            {"name": "ticket remove",     "emoji": "➖", "desc": "Xóa thành viên khỏi ticket (staff)",      "usage": "`/ticket remove <@user>`"},
            {"name": "ticket transcript", "emoji": "📄", "desc": "Xuất transcript ticket (staff)",           "usage": "`/ticket transcript`"},
            {"name": "ticket notes",      "emoji": "📝", "desc": "Xem/thêm ghi chú ticket (staff)",          "usage": "`/ticket notes`"},
            {"name": "ticket history",    "emoji": "📜", "desc": "Xem lịch sử ticket",                       "usage": "`/ticket history [@user]`"},
            {"name": "ticket stats",      "emoji": "📊", "desc": "Thống kê ticket (admin)",                  "usage": "`/ticket stats`", "admin": True},
            {"name": "ticket blacklist",  "emoji": "🚫", "desc": "Cấm user tạo ticket (admin)",              "usage": "`/ticket blacklist <@user>`", "admin": True},
            {"name": "panel send",        "emoji": "📌", "desc": "Gửi panel ticket vào kênh (admin)",        "usage": "`/panel send`", "admin": True},
        ],
    },
    {
        "key": "moderation",
        "emoji": "🛡️",
        "name": "Kiểm duyệt",
        "commands": [
            {"name": "warn",      "emoji": "⚠️", "desc": "Cảnh cáo thành viên (admin)",         "usage": "`/warn <@user> <lý do>`", "admin": True},
            {"name": "unwarn",    "emoji": "🗑️", "desc": "Xóa cảnh cáo (admin)",                "usage": "`/unwarn <@user> <id>`", "admin": True},
            {"name": "warnings",  "emoji": "📋", "desc": "Xem lịch sử cảnh cáo (admin)",        "usage": "`/warnings <@user>`", "admin": True},
            {"name": "kick",      "emoji": "👢", "desc": "Kick thành viên (admin)",              "usage": "`/kick <@user> [lý do]`", "admin": True},
            {"name": "ban",       "emoji": "🔨", "desc": "Ban thành viên (admin)",               "usage": "`/ban <@user> [lý do]`", "admin": True},
            {"name": "unban",     "emoji": "🔓", "desc": "Unban thành viên (admin)",             "usage": "`/unban <user_id>`", "admin": True},
            {"name": "snipe",     "emoji": "👁️", "desc": "Xem tin nhắn bị xóa gần nhất (admin)","usage": "`/snipe`", "admin": True},
            {"name": "editsnipe", "emoji": "✏️", "desc": "Xem tin nhắn bị sửa gần nhất (admin)","usage": "`/editsnipe`", "admin": True},
        ],
    },
    {
        "key": "channel_admin",
        "emoji": "⚙️",
        "name": "Quản lý kênh",
        "commands": [
            {"name": "purge",           "emoji": "🗑️",  "desc": "Xóa hàng loạt tin nhắn trong kênh",                   "usage": "`/purge <số_lượng> [@user]`",          "admin": True},
            {"name": "nuke",            "emoji": "💣",  "desc": "Xóa toàn bộ tin nhắn bằng cách clone lại kênh",       "usage": "`/nuke [lý_do]`",                      "admin": True},
            {"name": "lock",            "emoji": "🔒",  "desc": "Khóa kênh, không cho thành viên gửi tin",             "usage": "`/lock [#kênh] [lý_do]`",              "admin": True},
            {"name": "unlock",          "emoji": "🔓",  "desc": "Mở khóa kênh",                                        "usage": "`/unlock [#kênh]`",                    "admin": True},
            {"name": "hide_channel",    "emoji": "🫥",  "desc": "Ẩn kênh khỏi tầm nhìn thành viên thường",            "usage": "`/hide_channel [#kênh]`",              "admin": True},
            {"name": "show_channel",    "emoji": "👁️",  "desc": "Hiện lại kênh đã bị ẩn",                              "usage": "`/show_channel [#kênh]`",              "admin": True},
            {"name": "block_channel",   "emoji": "🚫",  "desc": "Chặn một thành viên/role khỏi kênh cụ thể",           "usage": "`/block_channel <@user/role> [#kênh]`","admin": True},
            {"name": "unblock_channel", "emoji": "✅",  "desc": "Bỏ chặn thành viên/role trong kênh",                  "usage": "`/unblock_channel <@user/role> [#kênh]`","admin": True},
            {"name": "slowmode",        "emoji": "⏱️",  "desc": "Đặt chế độ chậm (slowmode) cho kênh",                 "usage": "`/slowmode <giây> [#kênh]`",           "admin": True},
            {"name": "image_only",      "emoji": "🖼️",  "desc": "Chế độ kênh chỉ được gửi ảnh/video",                  "usage": "`/image_only [#kênh]`",                "admin": True},
            {"name": "announce",        "emoji": "📢",  "desc": "Gửi thông báo vào kênh với embed đẹp",                "usage": "`/announce <nội_dung> [#kênh] [@role]`","admin": True},
            {"name": "move_message",    "emoji": "➡️",  "desc": "Di chuyển tin nhắn sang kênh khác qua link",          "usage": "`/move_message <link> <#kênh_đích>`",  "admin": True},
            {"name": "clear_reactions", "emoji": "🧹",  "desc": "Xóa toàn bộ reaction trên một tin nhắn",              "usage": "`/clear_reactions <link>`",            "admin": True},
            {"name": "pin_message",     "emoji": "📌",  "desc": "Pin tin nhắn qua link",                                "usage": "`/pin_message <link>`",                "admin": True},
            {"name": "unpin_message",   "emoji": "📍",  "desc": "Bỏ pin tin nhắn qua link",                             "usage": "`/unpin_message <link>`",              "admin": True},
            {"name": "role_add",        "emoji": "➕",  "desc": "Thêm role cho thành viên",                             "usage": "`/role_add <@user> <@role>`",          "admin": True},
            {"name": "role_remove",     "emoji": "➖",  "desc": "Xóa role khỏi thành viên",                             "usage": "`/role_remove <@user> <@role>`",       "admin": True},
            {"name": "nick",            "emoji": "✏️",  "desc": "Đổi hoặc xóa nickname thành viên",                    "usage": "`/nick <@user> [nickname]`",           "admin": True},
        ],
    },
    {
        "key": "invites",
        "emoji": "📨",
        "name": "Invite Tracking",
        "commands": [
            {"name": "invites me",          "emoji": "📊", "desc": "Xem thống kê lời mời của bạn",             "usage": "`/invites me`"},
            {"name": "invites info",        "emoji": "👤", "desc": "Xem thống kê lời mời của thành viên khác", "usage": "`/invites info <@user>`"},
            {"name": "invites leaderboard", "emoji": "🏆", "desc": "BXH lời mời server",                       "usage": "`/invites leaderboard`"},
            {"name": "invites fake",        "emoji": "🚫", "desc": "Đánh dấu invite của user là fake (admin)", "usage": "`/invites fake <@user>`", "admin": True},
        ],
    },
    {
        "key": "voice",
        "emoji": "🎙️",
        "name": "Temp Voice",
        "commands": [
            {"name": "room rename",   "emoji": "✏️", "desc": "Đổi tên phòng voice",               "usage": "`/room rename <tên>`"},
            {"name": "room limit",    "emoji": "👥", "desc": "Đặt giới hạn thành viên phòng",      "usage": "`/room limit <số>`"},
            {"name": "room lock",     "emoji": "🔒", "desc": "Khóa phòng voice",                   "usage": "`/room lock`"},
            {"name": "room unlock",   "emoji": "🔓", "desc": "Mở khóa phòng voice",                "usage": "`/room unlock`"},
            {"name": "room hide",     "emoji": "🫥", "desc": "Ẩn phòng voice",                     "usage": "`/room hide`"},
            {"name": "room unhide",   "emoji": "👁️", "desc": "Hiện phòng voice",                   "usage": "`/room unhide`"},
            {"name": "room private",  "emoji": "🔐", "desc": "Chỉ người được cấp quyền mới vào",   "usage": "`/room private`"},
            {"name": "room public",   "emoji": "🌐", "desc": "Mở phòng cho mọi người",             "usage": "`/room public`"},
            {"name": "room permit",   "emoji": "✅", "desc": "Cho phép user vào phòng",             "usage": "`/room permit <@user>`"},
            {"name": "room reject",   "emoji": "🚫", "desc": "Chặn user vào phòng",                "usage": "`/room reject <@user>`"},
            {"name": "room boot",     "emoji": "👢", "desc": "Đuổi user ra khỏi phòng",            "usage": "`/room boot <@user>`"},
            {"name": "room mute",     "emoji": "🔇", "desc": "Mute user trong phòng",              "usage": "`/room mute <@user>`"},
            {"name": "room transfer", "emoji": "↔️", "desc": "Chuyển quyền chủ phòng",             "usage": "`/room transfer <@user>`"},
            {"name": "room claim",    "emoji": "👑", "desc": "Nhận quyền chủ nếu owner cũ rời",    "usage": "`/room claim`"},
            {"name": "room bitrate",  "emoji": "🔊", "desc": "Đổi bitrate phòng voice",             "usage": "`/room bitrate <kbps>`"},
            {"name": "room panel",    "emoji": "🎛️", "desc": "Gửi lại panel điều khiển phòng",     "usage": "`/room panel`"},
        ],
    },
    {
        "key": "utility",
        "emoji": "🔧",
        "name": "Tiện ích",
        "commands": [
            {"name": "afk",        "emoji": "💤", "desc": "Đặt trạng thái AFK",          "usage": "`/afk [lý do]`"},
            {"name": "avatar",     "emoji": "🖼️", "desc": "Xem avatar thành viên",       "usage": "`/avatar [@user]`"},
            {"name": "banner",     "emoji": "🎨", "desc": "Xem banner thành viên",        "usage": "`/banner [@user]`"},
            {"name": "userinfo",   "emoji": "ℹ️",  "desc": "Xem thông tin thành viên",   "usage": "`/userinfo [@user]`"},
            {"name": "serverinfo", "emoji": "🏠",  "desc": "Xem thông tin server",       "usage": "`/serverinfo`"},
            {"name": "poll",       "emoji": "📊",  "desc": "Tạo bình chọn nhanh",        "usage": "`/poll <câu hỏi> <lựa chọn...>`"},
            {"name": "qr",         "emoji": "📷",  "desc": "Tạo mã QR từ văn bản/link", "usage": "`/qr <nội dung>`"},
            {"name": "setprefix",  "emoji": "⚙️",  "desc": "Đặt prefix lệnh tương tác (admin)", "usage": "`/setprefix <prefix>`", "admin": True},
        ],
    },
    {
        "key": "interactions",
        "emoji": "🎭",
        "name": "Hành động",
        "commands": [
            # Tương tác với người khác
            {"name": "hug",        "emoji": "🫂", "desc": "Ôm một thành viên khác",             "usage": "`/hug <@user>`"},
            {"name": "pat",        "emoji": "🤚", "desc": "Xoa đầu thành viên",                 "usage": "`/pat <@user>`"},
            {"name": "kiss",       "emoji": "💋", "desc": "Hôn thành viên",                     "usage": "`/kiss <@user>`"},
            {"name": "slap",       "emoji": "🫲", "desc": "Tát thành viên",                     "usage": "`/slap <@user>`"},
            {"name": "punch",      "emoji": "👊", "desc": "Đấm thành viên",                     "usage": "`/punch <@user>`"},
            {"name": "wave",       "emoji": "👋", "desc": "Vẫy tay chào thành viên",            "usage": "`/wave <@user>`"},
            {"name": "cuddle",     "emoji": "🤗", "desc": "Ôm ấp thành viên",                   "usage": "`/cuddle <@user>`"},
            {"name": "poke",       "emoji": "👉", "desc": "Chọc thành viên",                    "usage": "`/poke <@user>`"},
            {"name": "tickle",     "emoji": "🤭", "desc": "Cù thành viên",                      "usage": "`/tickle <@user>`"},
            {"name": "bite",       "emoji": "😬", "desc": "Cắn thành viên",                     "usage": "`/bite <@user>`"},
            {"name": "lick",       "emoji": "👅", "desc": "Liếm thành viên",                    "usage": "`/lick <@user>`"},
            {"name": "wink",       "emoji": "😉", "desc": "Nháy mắt với thành viên",            "usage": "`/wink <@user>`"},
            {"name": "stare",      "emoji": "👀", "desc": "Nhìn chằm chằm thành viên",          "usage": "`/stare <@user>`"},
            {"name": "brofist",    "emoji": "🤜", "desc": "Đấm tay với thành viên",             "usage": "`/brofist <@user>`"},
            {"name": "handhold",   "emoji": "🤝", "desc": "Nắm tay thành viên",                 "usage": "`/handhold <@user>`"},
            {"name": "nuzzle",     "emoji": "🥰", "desc": "Cọ mũi với thành viên",              "usage": "`/nuzzle <@user>`"},
            {"name": "smack",      "emoji": "💥", "desc": "Đánh thành viên",                    "usage": "`/smack <@user>`"},
            {"name": "airkiss",    "emoji": "😘", "desc": "Gửi nụ hôn gió cho thành viên",     "usage": "`/airkiss <@user>`"},
            {"name": "angrystare", "emoji": "😠", "desc": "Nhìn giận dữ thành viên",            "usage": "`/angrystare <@user>`"},
            {"name": "pinch",      "emoji": "🤏", "desc": "Véo thành viên",                     "usage": "`/pinch <@user>`"},
            {"name": "nom",        "emoji": "😋", "desc": "Ăn thành viên (lol)",                "usage": "`/nom <@user>`"},
            {"name": "peek",       "emoji": "🫣", "desc": "Nhìn trộm thành viên",               "usage": "`/peek <@user>`"},
        ],
    },
    {
        "key": "expressions",
        "emoji": "😄",
        "name": "Biểu cảm",
        "commands": [
            {"name": "blush",      "emoji": "😊", "desc": "Đỏ mặt",                            "usage": "`/blush`"},
            {"name": "cry",        "emoji": "😢", "desc": "Khóc",                               "usage": "`/cry`"},
            {"name": "dance",      "emoji": "💃", "desc": "Nhảy",                               "usage": "`/dance`"},
            {"name": "laugh",      "emoji": "😂", "desc": "Cười",                               "usage": "`/laugh`"},
            {"name": "smile",      "emoji": "😊", "desc": "Cười tươi",                          "usage": "`/smile`"},
            {"name": "happy",      "emoji": "😄", "desc": "Vui vẻ",                             "usage": "`/happy`"},
            {"name": "sad",        "emoji": "😞", "desc": "Buồn",                               "usage": "`/sad`"},
            {"name": "sleep",      "emoji": "😴", "desc": "Ngủ",                                "usage": "`/sleep`"},
            {"name": "yawn",       "emoji": "🥱", "desc": "Ngáp",                               "usage": "`/yawn`"},
            {"name": "shrug",      "emoji": "🤷", "desc": "Nhún vai",                           "usage": "`/shrug`"},
            {"name": "facepalm",   "emoji": "🤦", "desc": "Facepalm",                           "usage": "`/facepalm`"},
            {"name": "clap",       "emoji": "👏", "desc": "Vỗ tay",                             "usage": "`/clap`"},
            {"name": "celebrate",  "emoji": "🎉", "desc": "Ăn mừng",                            "usage": "`/celebrate`"},
            {"name": "thumbsup",   "emoji": "👍", "desc": "Thích",                              "usage": "`/thumbsup`"},
            {"name": "sorry",      "emoji": "🙏", "desc": "Xin lỗi",                            "usage": "`/sorry`"},
            {"name": "confused",   "emoji": "😕", "desc": "Bối rối",                            "usage": "`/confused`"},
            {"name": "nervous",    "emoji": "😰", "desc": "Lo lắng",                            "usage": "`/nervous`"},
            {"name": "scared",     "emoji": "😱", "desc": "Sợ hãi",                             "usage": "`/scared`"},
            {"name": "surprised",  "emoji": "😲", "desc": "Ngạc nhiên",                         "usage": "`/surprised`"},
            {"name": "cool",       "emoji": "😎", "desc": "Ngầu",                               "usage": "`/cool`"},
            {"name": "love",       "emoji": "❤️", "desc": "Yêu",                               "usage": "`/love`"},
            {"name": "run",        "emoji": "🏃", "desc": "Chạy",                               "usage": "`/run`"},
            {"name": "shy",        "emoji": "🙈", "desc": "Ngại ngùng",                         "usage": "`/shy`"},
            {"name": "smug",       "emoji": "😏", "desc": "Tự mãn",                             "usage": "`/smug`"},
            {"name": "yay",        "emoji": "🥳", "desc": "Yay!",                               "usage": "`/yay`"},
        ],
    },
]

# Build lookup maps
_CAT_BY_KEY = {c["key"]: c for c in HELP_CATEGORIES}
_CMD_BY_KEY: dict[str, dict] = {}
for _cat in HELP_CATEGORIES:
    for _cmd in _cat["commands"]:
        _CMD_BY_KEY[f"{_cat['key']}:{_cmd['name']}"] = {**_cmd, "category": _cat}


def _get_session():
    return SessionLocal()


def _is_admin(user) -> bool:
    """Kiểm tra user có quyền administrator không."""
    perms = getattr(user, "guild_permissions", None)
    return bool(perms and perms.administrator)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _visible_commands(cat: dict, is_admin: bool) -> list:
    # Luôn hiện tất cả lệnh — kể cả lệnh admin, chỉ hiển thị tag (admin)
    return cat["commands"]


def _commands_list_text(cat: dict, is_admin: bool = True) -> str:
    cmds = _visible_commands(cat, is_admin)
    return "\n".join(
        f"{cmd['emoji']} **`/{cmd['name']}`** — {cmd['desc']}{' *(admin)*' if cmd.get('admin') else ''}"
        for cmd in cmds
    )


class CategorySelect(discord.ui.Select):
    def __init__(self, is_admin: bool = False):
        self.is_admin = is_admin
        # Chỉ hiện danh mục có ít nhất 1 lệnh visible
        visible_cats = [
            cat for cat in HELP_CATEGORIES
            if _visible_commands(cat, is_admin)
        ]
        options = [
            discord.SelectOption(
                label=cat["name"],
                value=cat["key"],
                emoji=cat["emoji"],
            )
            for cat in visible_cats
        ]
        super().__init__(
            placeholder="🔍 Chọn danh mục...",
            min_values=1, max_values=1,
            options=options,
            custom_id="help_category_select",
        )

    async def callback(self, interaction: discord.Interaction):
        cat_key = self.values[0]
        cat = _CAT_BY_KEY.get(cat_key)
        if not cat:
            await interaction.response.send_message("Danh mục không tồn tại.", ephemeral=True)
            return

        is_admin = _is_admin(interaction.user)
        session = _get_session()
        try:
            embed = build_embed("help_category", session, vars={
                "category_emoji": cat["emoji"],
                "category_name": cat["name"],
                "commands_list": _commands_list_text(cat, is_admin),
                "bot_name": interaction.client.user.display_name if interaction.client.user else "Bot",
            })
        finally:
            session.close()

        view = CommandSelectView(cat, is_admin)
        await interaction.response.edit_message(embed=embed, view=view)


class CommandSelect(discord.ui.Select):
    def __init__(self, cat: dict, is_admin: bool = False):
        self.cat = cat
        self.is_admin = is_admin
        cmds = _visible_commands(cat, is_admin)
        options = [
            discord.SelectOption(
                label=f"/{cmd['name']}" + (" (admin)" if cmd.get("admin") else ""),
                value=f"{cat['key']}:{cmd['name']}",
                description=cmd["desc"][:100],
                emoji=cmd["emoji"],
            )
            for cmd in cmds
        ]
        super().__init__(
            placeholder="📖 Chọn lệnh để xem chi tiết...",
            min_values=1, max_values=1,
            options=options,
            custom_id="help_command_select",
        )

    async def callback(self, interaction: discord.Interaction):
        cmd_key = self.values[0]
        cmd_info = _CMD_BY_KEY.get(cmd_key)
        if not cmd_info:
            await interaction.response.send_message("Lệnh không tồn tại.", ephemeral=True)
            return

        session = _get_session()
        try:
            embed = build_embed("help_command", session, vars={
                "command_emoji": cmd_info["emoji"],
                "command_name": cmd_info["name"],
                "command_desc": cmd_info["desc"],
                "command_usage": cmd_info["usage"],
                "bot_name": interaction.client.user.display_name if interaction.client.user else "Bot",
            })
        finally:
            session.close()

        view = CommandDetailView(self.cat, self.is_admin)
        await interaction.response.edit_message(embed=embed, view=view)


# ── Views ────────────────────────────────────────────────────────────────────

class HelpMenuView(discord.ui.View):
    def __init__(self, is_admin: bool = False):
        super().__init__(timeout=120)
        self.add_item(CategorySelect(is_admin))


class CommandSelectView(discord.ui.View):
    def __init__(self, cat: dict, is_admin: bool = False):
        super().__init__(timeout=120)
        self.add_item(CommandSelect(cat, is_admin))
        self.add_item(BackToCategoriesButton(is_admin))


class CommandDetailView(discord.ui.View):
    def __init__(self, cat: dict, is_admin: bool = False):
        super().__init__(timeout=120)
        self.cat = cat
        self.is_admin = is_admin
        self.add_item(BackToCategoryButton(cat, is_admin))
        self.add_item(BackToCategoriesButton(is_admin))


class BackToCategoriesButton(discord.ui.Button):
    def __init__(self, is_admin: bool = False):
        super().__init__(label="← Danh mục", style=discord.ButtonStyle.secondary, custom_id="help_back_categories")
        self.is_admin = is_admin

    async def callback(self, interaction: discord.Interaction):
        is_admin = _is_admin(interaction.user)
        session = _get_session()
        try:
            embed = build_embed("help_menu", session, vars={
                "user.mention": interaction.user.mention,
                "bot_name": interaction.client.user.display_name if interaction.client.user else "Bot",
            })
        finally:
            session.close()
        await interaction.response.edit_message(embed=embed, view=HelpMenuView(is_admin))


class BackToCategoryButton(discord.ui.Button):
    def __init__(self, cat: dict, is_admin: bool = False):
        super().__init__(label=f"← {cat['name']}", style=discord.ButtonStyle.secondary, custom_id="help_back_category")
        self.cat = cat
        self.is_admin = is_admin

    async def callback(self, interaction: discord.Interaction):
        cat = self.cat
        is_admin = _is_admin(interaction.user)
        session = _get_session()
        try:
            embed = build_embed("help_category", session, vars={
                "category_emoji": cat["emoji"],
                "category_name": cat["name"],
                "commands_list": _commands_list_text(cat, is_admin),
                "bot_name": interaction.client.user.display_name if interaction.client.user else "Bot",
            })
        finally:
            session.close()
        await interaction.response.edit_message(embed=embed, view=CommandSelectView(cat, is_admin))


# ── Cog ──────────────────────────────────────────────────────────────────────

class HelpCog(commands.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    @discord.slash_command(name="help", description="Xem danh sách lệnh bot")
    async def help_cmd(self, ctx: discord.ApplicationContext):
        is_admin = _is_admin(ctx.author)
        session = _get_session()
        try:
            embed = build_embed("help_menu", session, vars={
                "user.mention": ctx.author.mention,
                "bot_name": ctx.bot.user.display_name if ctx.bot.user else "Bot",
            })
        finally:
            session.close()
        await ctx.respond(embed=embed, view=HelpMenuView(is_admin))


def setup(bot: discord.Bot):
    bot.add_cog(HelpCog(bot))
