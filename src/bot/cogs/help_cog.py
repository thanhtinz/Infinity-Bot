"""Help command — category → command → detail, embed content from embed manager."""
from __future__ import annotations

import discord
from discord.ext import commands

from src.bot.embed_utils import build_embed
from src.bot.i18n import get_lang
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


# Public/help category model used by the bot and landing command catalog.
# Keep labels in English; the landing page maps these keys to icons.
_LEGACY_HELP_CATEGORIES = HELP_CATEGORIES
_LEGACY_COMMANDS = {
    cmd["name"]: cmd
    for cat in _LEGACY_HELP_CATEGORIES
    for cmd in cat["commands"]
}


def _help_cmd(name: str, desc: str, usage: str | None = None, admin: bool | None = None, desc_vi: str | None = None) -> dict:
    base = dict(_LEGACY_COMMANDS.get(name, {"name": name, "emoji": "▫️"}))
    base["desc"] = desc
    base["desc_vi"] = desc_vi or desc  # fallback to English
    base["usage"] = usage or f"`/{name}`"
    if admin is not None:
        base["admin"] = admin
    return base


HELP_CATEGORIES = [
    {
        "key": "interaction",
        "emoji": "💞",
        "name": "interaction",
        "name_vi": "Tương tác",
        "commands": [
            _help_cmd("hug", "Hug another member.", "`/hug <@user>`", desc_vi="Ôm một thành viên khác"),
            _help_cmd("pat", "Pat another member.", "`/pat <@user>`", desc_vi="Vuốt đầu thành viên khác"),
            _help_cmd("kiss", "Kiss another member.", "`/kiss <@user>`", desc_vi="Hôn thành viên khác"),
            _help_cmd("slap", "Slap another member.", "`/slap <@user>`", desc_vi="Tát thành viên khác"),
            _help_cmd("punch", "Punch another member.", "`/punch <@user>`", desc_vi="Đấm thành viên khác"),
            _help_cmd("wave", "Wave at another member.", "`/wave <@user>`", desc_vi="Vẫy tay chào thành viên khác"),
            _help_cmd("cuddle", "Cuddle another member.", "`/cuddle <@user>`", desc_vi="Ôm ấp thành viên khác"),
            _help_cmd("poke", "Poke another member.", "`/poke <@user>`", desc_vi="Chọc thành viên khác"),
            _help_cmd("tickle", "Tickle another member.", "`/tickle <@user>`", desc_vi="Cù thành viên khác"),
            _help_cmd("bite", "Bite another member.", "`/bite <@user>`", desc_vi="Cắn thành viên khác"),
            _help_cmd("lick", "Lick another member.", "`/lick <@user>`", desc_vi="Liếm thành viên khác"),
            _help_cmd("wink", "Wink at another member.", "`/wink <@user>`", desc_vi="Nháy mắt với thành viên khác"),
            _help_cmd("stare", "Stare at another member.", "`/stare <@user>`", desc_vi="Nhìn chằm chằm thành viên khác"),
            _help_cmd("brofist", "Brofist another member.", "`/brofist <@user>`", desc_vi="Đấm tay thành viên khác"),
            _help_cmd("handhold", "Hold hands with another member.", "`/handhold <@user>`", desc_vi="Nắm tay thành viên khác"),
            _help_cmd("nuzzle", "Nuzzle another member.", "`/nuzzle <@user>`", desc_vi="Cọ mũi thành viên khác"),
            _help_cmd("smack", "Smack another member.", "`/smack <@user>`", desc_vi="Đánh thành viên khác"),
            _help_cmd("airkiss", "Send an air kiss.", "`/airkiss <@user>`", desc_vi="Gửi nụ hôn gió"),
            _help_cmd("angrystare", "Give an angry stare.", "`/angrystare <@user>`", desc_vi="Nhìn giận dữ"),
            _help_cmd("pinch", "Pinch another member.", "`/pinch <@user>`", desc_vi="Véo thành viên khác"),
            _help_cmd("nom", "Nom another member.", "`/nom <@user>`", desc_vi="Gặm thành viên khác"),
            _help_cmd("peek", "Peek at another member.", "`/peek <@user>`", desc_vi="Nhìn lén thành viên khác"),
        ],
    },
    {
        "key": "expression",
        "emoji": "😄",
        "name": "expression",
        "name_vi": "Biểu cảm",
        "commands": [
            _help_cmd("blush", "Post a blush expression.", desc_vi="Biểu cảm xấu hổ"),
            _help_cmd("cry", "Post a crying expression.", desc_vi="Biểu cảm khóc"),
            _help_cmd("dance", "Post a dance expression.", desc_vi="Biểu cảm nhảy múa"),
            _help_cmd("laugh", "Post a laugh expression.", desc_vi="Biểu cảm cười"),
            _help_cmd("smile", "Post a smile expression.", desc_vi="Biểu cảm mỉm cười"),
            _help_cmd("happy", "Post a happy expression.", desc_vi="Biểu cảm vui vẻ"),
            _help_cmd("sad", "Post a sad expression.", desc_vi="Biểu cảm buồn"),
            _help_cmd("sleep", "Post a sleep expression.", desc_vi="Biểu cảm ngủ"),
            _help_cmd("yawn", "Post a yawn expression.", desc_vi="Biểu cảm ngáp"),
            _help_cmd("shrug", "Post a shrug expression.", desc_vi="Biểu cảm nhún vai"),
            _help_cmd("facepalm", "Post a facepalm expression.", desc_vi="Biểu cảm facepalm"),
            _help_cmd("clap", "Post a clap expression.", desc_vi="Biểu cảm vỗ tay"),
            _help_cmd("celebrate", "Post a celebration expression.", desc_vi="Biểu cảm ăn mừng"),
            _help_cmd("thumbsup", "Post a thumbs-up expression.", desc_vi="Biểu cảm giơ ngón cái"),
            _help_cmd("sorry", "Post an apology expression.", desc_vi="Biểu cảm xin lỗi"),
            _help_cmd("confused", "Post a confused expression.", desc_vi="Biểu cảm bối rối"),
            _help_cmd("nervous", "Post a nervous expression.", desc_vi="Biểu cảm lo lắng"),
            _help_cmd("scared", "Post a scared expression.", desc_vi="Biểu cảm sợ hãi"),
            _help_cmd("surprised", "Post a surprised expression.", desc_vi="Biểu cảm ngạc nhiên"),
            _help_cmd("cool", "Post a cool expression.", desc_vi="Biểu cảm ngầu"),
            _help_cmd("love", "Post a love expression.", desc_vi="Biểu cảm yêu thương"),
            _help_cmd("run", "Post a running expression.", desc_vi="Biểu cảm chạy"),
            _help_cmd("shy", "Post a shy expression.", desc_vi="Biểu cảm ngại ngùng"),
            _help_cmd("smug", "Post a smug expression.", desc_vi="Biểu cảm tự mãn"),
            _help_cmd("yay", "Post a yay expression.", desc_vi="Biểu cảm hoan hô"),
        ],
    },
    {
        "key": "fun",
        "emoji": "🎲",
        "name": "fun",
        "name_vi": "Giải trí",
        "commands": [
            _help_cmd("space", "Get ISS location & astronaut info.", "`/space`", desc_vi="Xem vị trí ISS & thông tin phi hành gia"),
            _help_cmd("dadjoke", "Get a random Dad joke.", "`/dadjoke`", desc_vi="Một câu đùa ngẫu nhiên"),
            _help_cmd("cat", "Find a cute cat picture.", "`/cat`", desc_vi="Tìm ảnh mèo dễ thương"),
            _help_cmd("dog", "Find a cute dog picture.", "`/dog`", desc_vi="Tìm ảnh chó dễ thương"),
            _help_cmd("pug", "Find a cute pug picture.", "`/pug`", desc_vi="Tìm ảnh chó Pug dễ thương"),
            _help_cmd("norris", "Get a random Chuck Norris fact.", "`/norris`", desc_vi="Sự thật ngẫu nhiên về Chuck Norris"),
            _help_cmd("pokemon", "Get info on a Pokémon.", "`/pokemon <name>`", desc_vi="Tra cứu thông tin Pokémon"),
            _help_cmd("itunes", "Search for a song on iTunes.", "`/itunes <query>`", desc_vi="Tìm bài hát trên iTunes"),
        ],
    },
    {
        "key": "shop",
        "emoji": "🛒",
        "name": "shop",
        "name_vi": "Cửa hàng",
        "commands": [
            _help_cmd("san_pham", "Browse products and product details.", "`/san_pham [product]`", desc_vi="Xem danh sách & chi tiết sản phẩm"),
            _help_cmd("orders", "View your orders or a specific order.", "`/orders [id]`", desc_vi="Xem đơn hàng của bạn hoặc theo ID"),
            _help_cmd("feedback", "Leave product feedback.", "`/feedback`", desc_vi="Đánh giá sản phẩm"),
            _help_cmd("support", "Contact server support.", "`/support`", desc_vi="Liên hệ hỗ trợ"),
            _help_cmd("bxh", "View the shop leaderboard.", "`/bxh`", desc_vi="Xem bảng xếp hạng mua hàng"),
            _help_cmd("tao_don", "Create an order for a member.", "`/tao_don`", True, desc_vi="Tạo đơn hàng cho thành viên"),
            _help_cmd("tao_don_custom", "Create a custom order with a custom name.", "`/tao_don_custom`", True, desc_vi="Tạo đơn custom tên tùy chỉnh"),
            _help_cmd("bang_gia", "Send the product price list to a channel.", "`/bang_gia [#channel]`", True, desc_vi="Gửi bảng giá sản phẩm vào kênh"),
        ],
    },
    {
        "key": "info",
        "emoji": "ℹ️",
        "name": "info",
        "name_vi": "Thông tin",
        "commands": [
            _help_cmd("avatar", "View a member avatar.", "`/avatar [@user]`", desc_vi="Xem ảnh đại diện thành viên"),
            _help_cmd("banner", "View a member banner.", "`/banner [@user]`", desc_vi="Xem banner thành viên"),
            _help_cmd("userinfo", "View member information.", "`/userinfo [@user]`", desc_vi="Xem thông tin thành viên"),
            _help_cmd("serverinfo", "View server information.", "`/serverinfo`", desc_vi="Xem thông tin server"),
            _help_cmd("invites me", "View your invite stats.", "`/invites me`", desc_vi="Xem thống kê lời mời của bạn"),
            _help_cmd("invites info", "View invite stats for a member.", "`/invites info <@user>`", desc_vi="Xem thống kê lời mời của thành viên"),
            _help_cmd("invites leaderboard", "View the invite leaderboard.", "`/invites leaderboard`", desc_vi="Xem BXH lời mời"),
            _help_cmd("invites fake", "Mark a member's invites as fake.", "`/invites fake <@user>`", True, desc_vi="Đánh dấu lời mời giả"),
        ],
    },
    {
        "key": "level",
        "emoji": "🏆",
        "name": "level",
        "name_vi": "Cấp độ",
        "commands": [
            _help_cmd("level rank", "View your rank card and XP.", "`/level rank [@user]`", desc_vi="Xem rank và XP của bạn"),
            _help_cmd("level leaderboard", "View the server XP leaderboard.", "`/level leaderboard`", desc_vi="Bảng xếp hạng XP server"),
            _help_cmd("level background", "Choose a personal rank-card background.", "`/level background`", desc_vi="Chọn background rank card"),
            _help_cmd("level backgrounds", "Browse available rank-card backgrounds.", "`/level backgrounds`", desc_vi="Xem các background có sẵn"),
            _help_cmd("level give", "Give XP to a member.", "`/level give <@user> <xp>`", True, desc_vi="Tặng XP cho thành viên"),
            _help_cmd("level reset", "Reset a member's level progress.", "`/level reset <@user>`", True, desc_vi="Reset tiến trình level thành viên"),
        ],
    },
    {
        "key": "giveaway",
        "emoji": "🎁",
        "name": "giveaway",
        "name_vi": "Giveaway",
        "commands": [
            _help_cmd("giveaway", "Create a new giveaway.", "`/giveaway <duration> <winners> <prize>`", True, desc_vi="Tạo giveaway mới"),
            _help_cmd("giveaway_list", "View active giveaways.", "`/giveaway_list`", desc_vi="Xem danh sách giveaway"),
            _help_cmd("giveaway_reroll", "Reroll a giveaway winner.", "`/giveaway_reroll <message_id>`", True, desc_vi="Quay lại người thắng giveaway"),
            _help_cmd("giveaway_end", "End a giveaway early.", "`/giveaway_end <message_id>`", True, desc_vi="Kết thúc giveaway sớm"),
            _help_cmd("giveaway_ban", "Ban a member from giveaways.", "`/giveaway_ban <@user>`", True, desc_vi="Cấm thành viên tham gia giveaway"),
            _help_cmd("giveaway_unban", "Unban a member from giveaways.", "`/giveaway_unban <@user>`", True, desc_vi="Bỏ cấm tham gia giveaway"),
        ],
    },
    {
        "key": "ticket",
        "emoji": "🎫",
        "name": "ticket",
        "name_vi": "Ticket",
        "commands": [
            _help_cmd("ticket create", "Create a support ticket.", "`/ticket create`", desc_vi="Tạo ticket hỗ trợ"),
            _help_cmd("ticket close", "Close the current ticket.", "`/ticket close`", desc_vi="Đóng ticket hiện tại"),
            _help_cmd("ticket reopen", "Reopen a closed ticket.", "`/ticket reopen`", desc_vi="Mở lại ticket đã đóng"),
            _help_cmd("ticket claim", "Claim a ticket as staff.", "`/ticket claim`", desc_vi="Nhận ticket làm staff"),
            _help_cmd("ticket unclaim", "Release a claimed ticket.", "`/ticket unclaim`", desc_vi="Bỏ nhận ticket"),
            _help_cmd("ticket add", "Add a member to a ticket.", "`/ticket add <@user>`", desc_vi="Thêm thành viên vào ticket"),
            _help_cmd("ticket remove", "Remove a member from a ticket.", "`/ticket remove <@user>`", desc_vi="Xóa thành viên khỏi ticket"),
            _help_cmd("ticket transcript", "Export a ticket transcript.", "`/ticket transcript`", desc_vi="Xuất bản ghi ticket"),
            _help_cmd("ticket notes", "View or add ticket notes.", "`/ticket notes`", desc_vi="Xem/thêm ghi chú ticket"),
            _help_cmd("ticket history", "View ticket history.", "`/ticket history [@user]`", desc_vi="Xem lịch sử ticket"),
            _help_cmd("ticket stats", "View ticket statistics.", "`/ticket stats`", True, desc_vi="Xem thống kê ticket"),
            _help_cmd("ticket setup", "Set up ticket configuration.", "`/ticket setup`", True, desc_vi="Thiết lập cấu hình ticket"),
            _help_cmd("ticket rename", "Rename the current ticket.", "`/ticket rename <name>`", desc_vi="Đổi tên ticket hiện tại"),
            _help_cmd("ticket priority", "Set ticket priority.", "`/ticket priority <level>`", desc_vi="Đặt mức ưu tiên ticket"),
            _help_cmd("ticket transfer", "Transfer to another staff.", "`/ticket transfer <@user>`", desc_vi="Chuyển ticket cho staff khác"),
            _help_cmd("ticket delete", "Delete a ticket record.", "`/ticket delete`", True, desc_vi="Xóa bản ghi ticket"),
            _help_cmd("ticket blacklist", "Block from creating tickets.", "`/ticket blacklist <@user>`", True, desc_vi="Chặn tạo ticket"),
            _help_cmd("ticket whitelist", "Unblock ticket creation.", "`/ticket whitelist <@user>`", True, desc_vi="Bỏ chặn tạo ticket"),
            _help_cmd("panel send", "Send a ticket panel.", "`/panel send`", True, desc_vi="Gửi panel ticket vào kênh"),
            _help_cmd("panel create", "Create a ticket panel.", "`/panel create`", True, desc_vi="Tạo panel ticket"),
            _help_cmd("panel list", "List ticket panels.", "`/panel list`", True, desc_vi="Danh sách panel ticket"),
            _help_cmd("panel delete", "Delete a ticket panel.", "`/panel delete`", True, desc_vi="Xóa panel ticket"),
        ],
    },
    {
        "key": "misc",
        "emoji": "🧩",
        "name": "misc",
        "name_vi": "Tiện ích",
        "commands": [
            _help_cmd("afk", "Set your AFK status.", "`/afk [reason]`", desc_vi="Đặt trạng thái AFK"),
            _help_cmd("poll", "Create a quick poll.", "`/poll <question> <options...>`", desc_vi="Tạo bình chọn nhanh"),
            _help_cmd("qr", "Generate a QR code from text or a link.", "`/qr <content>`", desc_vi="Tạo mã QR từ text hoặc link"),
            _help_cmd("setprefix", "Set the interaction command prefix.", "`/setprefix <prefix>`", True, desc_vi="Đặt prefix cho lệnh tương tác"),
        ],
    },
    {
        "key": "sticky",
        "emoji": "📌",
        "name": "sticky",
        "name_vi": "Sticky",
        "commands": [
            _help_cmd("sticky create", "Create a text sticky.", "`/sticky create`", True, desc_vi="Tạo sticky text"),
            _help_cmd("sticky embed", "Create an embed sticky.", "`/sticky embed`", True, desc_vi="Tạo sticky embed"),
            _help_cmd("sticky edit", "Edit a sticky.", "`/sticky edit`", True, desc_vi="Sửa sticky"),
            _help_cmd("sticky remove", "Remove a sticky.", "`/sticky remove`", True, desc_vi="Xóa sticky"),
            _help_cmd("sticky enable", "Enable a sticky.", "`/sticky enable`", True, desc_vi="Bật sticky"),
            _help_cmd("sticky disable", "Disable a sticky.", "`/sticky disable`", True, desc_vi="Tắt sticky"),
            _help_cmd("sticky list", "List stickies.", "`/sticky list`", True, desc_vi="Danh sách sticky"),
            _help_cmd("sticky view", "View sticky details.", "`/sticky view`", True, desc_vi="Xem chi tiết sticky"),
            _help_cmd("sticky clear", "Clear sticky data.", "`/sticky clear`", True, desc_vi="Xóa dữ liệu sticky"),
            _help_cmd("sticky interval", "Set resend interval.", "`/sticky interval`", True, desc_vi="Đặt khoảng gửi lại"),
            _help_cmd("sticky messages", "Set message count behavior.", "`/sticky messages`", True, desc_vi="Đặt hành vi đếm tin nhắn"),
            _help_cmd("sticky color", "Set embed color.", "`/sticky color`", True, desc_vi="Đặt màu embed"),
            _help_cmd("sticky image", "Set embed image.", "`/sticky image`", True, desc_vi="Đặt ảnh embed"),
            _help_cmd("sticky thumbnail", "Set embed thumbnail.", "`/sticky thumbnail`", True, desc_vi="Đặt thumbnail embed"),
            _help_cmd("sticky footer", "Set embed footer.", "`/sticky footer`", True, desc_vi="Đặt footer embed"),
            _help_cmd("sticky pin", "Pin a sticky.", "`/sticky pin`", True, desc_vi="Ghim sticky"),
            _help_cmd("sticky unpin", "Unpin a sticky.", "`/sticky unpin`", True, desc_vi="Bỏ ghim sticky"),
            _help_cmd("sticky sync", "Resend all stickies.", "`/sticky sync`", True, desc_vi="Gửi lại tất cả sticky"),
            _help_cmd("sticky expire", "Set auto-expiration.", "`/sticky expire`", True, desc_vi="Đặt hết hạn tự động"),
            _help_cmd("sticky move", "Move sticky to another channel.", "`/sticky move`", True, desc_vi="Di chuyển sticky sang kênh khác"),
            _help_cmd("sticky copy", "Copy sticky to another channel.", "`/sticky copy`", True, desc_vi="Sao chép sticky sang kênh khác"),
            _help_cmd("sticky stats", "View sticky stats.", "`/sticky stats`", True, desc_vi="Xem thống kê sticky"),
            _help_cmd("sticky channel", "Create for a target channel.", "`/sticky channel`", True, desc_vi="Tạo cho kênh cụ thể"),
        ],
    },
    {
        "key": "moderator",
        "emoji": "🛡️",
        "name": "moderator",
        "name_vi": "Kiểm duyệt",
        "commands": [
            _help_cmd("warn", "Warn a member.", "`/warn <@user> <reason>`", True, desc_vi="Cảnh cáo thành viên"),
            _help_cmd("unwarn", "Remove a warning.", "`/unwarn <@user> <id>`", True, desc_vi="Xóa cảnh cáo"),
            _help_cmd("delwarn", "Delete a warning by ID.", "`/delwarn <id>`", True, desc_vi="Xóa cảnh cáo theo ID"),
            _help_cmd("warnings", "View warning history.", "`/warnings <@user>`", True, desc_vi="Xem lịch sử cảnh cáo"),
            _help_cmd("kick", "Kick a member.", "`/kick <@user> [reason]`", True, desc_vi="Đuổi thành viên"),
            _help_cmd("ban", "Ban a member.", "`/ban <@user> [reason]`", True, desc_vi="Cấm thành viên"),
            _help_cmd("unban", "Unban a user by ID.", "`/unban <user_id>`", True, desc_vi="Bỏ cấm theo ID"),
            _help_cmd("mute", "Mute (timeout) a member.", "`/mute <@user> <duration> [reason]`", True, desc_vi="Tắt tiếng (timeout) thành viên"),
            _help_cmd("softban", "Softban (ban + unban).", "`/softban <@user> [reason]`", True, desc_vi="Softban thành viên (cấm + bỏ cấm)"),
            _help_cmd("deafen", "Deafen a member in voice.", "`/deafen <@user> [reason]`", True, desc_vi="Tắt âm thành viên trong voice"),
            _help_cmd("undeafen", "Undeafen a member.", "`/undeafen <@user>`", True, desc_vi="Bỏ tắt âm thành viên"),
            _help_cmd("clean", "Clean up bot responses.", "`/clean [amount]`", True, desc_vi="Dọn tin nhắn bot"),
            _help_cmd("members", "List members in a role.", "`/members <@role>`", True, desc_vi="Liệt kê thành viên có role"),
            _help_cmd("rolepersist", "Toggle persistent role.", "`/rolepersist <@user> <@role>`", True, desc_vi="Bật/tắt role cố định"),
            _help_cmd("temprole", "Assign a temporary role.", "`/temprole <@user> <@role> <duration>`", True, desc_vi="Gán role tạm thời"),
            _help_cmd("note", "Add a note about a member.", "`/note <@user> <content>`", True, desc_vi="Thêm ghi chú về thành viên"),
            _help_cmd("notes", "View notes for a member.", "`/notes <@user>`", True, desc_vi="Xem ghi chú thành viên"),
            _help_cmd("delnote", "Delete a note.", "`/delnote <id>`", True, desc_vi="Xóa ghi chú"),
            _help_cmd("editnote", "Edit a note.", "`/editnote <id> <content>`", True, desc_vi="Sửa ghi chú"),
            _help_cmd("clearnotes", "Delete all notes.", "`/clearnotes <@user>`", True, desc_vi="Xóa tất cả ghi chú"),
            _help_cmd("modlogs", "View mod log history.", "`/modlogs <@user>`", True, desc_vi="Xem lịch sử mod log"),
            _help_cmd("moderations", "View active moderations.", "`/moderations`", True, desc_vi="Xem hình phạt đang hoạt động"),
            _help_cmd("case", "Show a mod case.", "`/case <number>`", True, desc_vi="Xem chi tiết vụ việc"),
            _help_cmd("reason", "Update case reason.", "`/reason <number> <text>`", True, desc_vi="Cập nhật lý do vụ việc"),
            _help_cmd("duration", "Change case duration.", "`/duration <number> <time>`", True, desc_vi="Thay đổi thời hạn mute/ban"),
        ],
    },
    {
        "key": "modtools",
        "emoji": "⚙️",
        "name": "modtools",
        "name_vi": "Công cụ kênh",
        "commands": [
            _help_cmd("modstats", "Moderation statistics.", "`/modstats [@mod]`", True, desc_vi="Thống kê kiểm duyệt"),
            _help_cmd("lockdown", "Lock/unlock channels.", "`/lockdown <start|end>`", True, desc_vi="Khóa/mở kênh"),
            _help_cmd("star", "Starboard stats.", "`/star <message_id>`", True, desc_vi="Xem thống kê starboard"),
            _help_cmd("ignored", "List ignored targets.", "`/ignored`", True, desc_vi="Danh sách user/role/kênh bị bỏ qua"),
            _help_cmd("diagnose", "Diagnose permissions.", "`/diagnose [target]`", True, desc_vi="Chẩn đoán quyền bot"),
            _help_cmd("snipe", "View deleted message.", "`/snipe`", True, desc_vi="Xem tin nhắn vừa xóa"),
            _help_cmd("editsnipe", "View edited message.", "`/editsnipe`", True, desc_vi="Xem tin nhắn vừa sửa"),
            _help_cmd("purge", "Bulk delete messages.", "`/purge <amount> [@user]`", True, desc_vi="Xóa hàng loạt tin nhắn"),
            _help_cmd("nuke", "Clone and reset channel.", "`/nuke [reason]`", True, desc_vi="Clone và reset kênh"),
            _help_cmd("lock", "Lock a channel.", "`/lock [#channel] [reason]`", True, desc_vi="Khóa kênh"),
            _help_cmd("unlock", "Unlock a channel.", "`/unlock [#channel]`", True, desc_vi="Mở khóa kênh"),
            _help_cmd("hide_channel", "Hide a channel.", "`/hide_channel [#channel]`", True, desc_vi="Ẩn kênh"),
            _help_cmd("show_channel", "Show a channel.", "`/show_channel [#channel]`", True, desc_vi="Hiện kênh"),
            _help_cmd("block_channel", "Block from channel.", "`/block_channel <@target> [#ch]`", True, desc_vi="Chặn thành viên/role khỏi kênh"),
            _help_cmd("unblock_channel", "Unblock from channel.", "`/unblock_channel <@target> [#ch]`", True, desc_vi="Bỏ chặn khỏi kênh"),
            _help_cmd("slowmode", "Set slowmode.", "`/slowmode <seconds> [#channel]`", True, desc_vi="Đặt slowmode kênh"),
            _help_cmd("image_only", "Images-only mode.", "`/image_only [#channel]`", True, desc_vi="Chỉ cho phép ảnh/video"),
            _help_cmd("announce", "Send announcement.", "`/announce <content> [#ch] [@role]`", True, desc_vi="Gửi thông báo embed"),
            _help_cmd("move_message", "Move a message.", "`/move_message <link> <#target>`", True, desc_vi="Di chuyển tin nhắn"),
            _help_cmd("clear_reactions", "Clear reactions.", "`/clear_reactions <link>`", True, desc_vi="Xóa reactions"),
            _help_cmd("pin_message", "Pin a message.", "`/pin_message <link>`", True, desc_vi="Ghim tin nhắn"),
            _help_cmd("unpin_message", "Unpin a message.", "`/unpin_message <link>`", True, desc_vi="Bỏ ghim tin nhắn"),
        ],
    },
    {
        "key": "role",
        "emoji": "🏷️",
        "name": "role",
        "name_vi": "Role",
        "commands": [
            _help_cmd("role_add", "Add a role to a member.", "`/role_add <@user> <@role>`", True, desc_vi="Thêm role cho thành viên"),
            _help_cmd("role_remove", "Remove a role from a member.", "`/role_remove <@user> <@role>`", True, desc_vi="Xóa role thành viên"),
            _help_cmd("nick", "Change or clear a member nickname.", "`/nick <@user> [nickname]`", True, desc_vi="Đổi/xóa nickname thành viên"),
            _help_cmd("roles deploy-button", "Deploy a button role panel.", "`/roles deploy-button`", True, desc_vi="Triển khai panel role nút bấm"),
            _help_cmd("roles deploy-select", "Deploy a select-menu role panel.", "`/roles deploy-select`", True, desc_vi="Triển khai panel role menu chọn"),
        ],
    },
    {
        "key": "tempvoice",
        "emoji": "🎙️",
        "name": "tempvoice",
        "name_vi": "TempVoice",
        "commands": [
            _help_cmd("room rename", "Rename your voice room.", "`/room rename <name>`", desc_vi="Đổi tên phòng voice"),
            _help_cmd("room limit", "Set the room member limit.", "`/room limit <number>`", desc_vi="Đặt giới hạn thành viên"),
            _help_cmd("room lock", "Lock your voice room.", "`/room lock`", desc_vi="Khóa phòng voice"),
            _help_cmd("room unlock", "Unlock your voice room.", "`/room unlock`", desc_vi="Mở khóa phòng voice"),
            _help_cmd("room hide", "Hide your voice room.", "`/room hide`", desc_vi="Ẩn phòng voice"),
            _help_cmd("room unhide", "Show your voice room.", "`/room unhide`", desc_vi="Hiện phòng voice"),
            _help_cmd("room private", "Make your voice room private.", "`/room private`", desc_vi="Chuyển phòng sang riêng tư"),
            _help_cmd("room public", "Make your voice room public.", "`/room public`", desc_vi="Chuyển phòng sang công khai"),
            _help_cmd("room permit", "Permit a member to join.", "`/room permit <@user>`", desc_vi="Cho phép thành viên vào"),
            _help_cmd("room reject", "Reject a member from joining.", "`/room reject <@user>`", desc_vi="Từ chối thành viên vào"),
            _help_cmd("room boot", "Boot a member from the room.", "`/room boot <@user>`", desc_vi="Đuổi thành viên khỏi phòng"),
            _help_cmd("room mute", "Mute a member in the room.", "`/room mute <@user>`", desc_vi="Tắt mic thành viên"),
            _help_cmd("room unmute", "Unmute a member in the room.", "`/room unmute <@user>`", desc_vi="Bật mic thành viên"),
            _help_cmd("room transfer", "Transfer room ownership.", "`/room transfer <@user>`", desc_vi="Chuyển quyền chủ phòng"),
            _help_cmd("room owner", "View the current room owner.", "`/room owner`", desc_vi="Xem chủ phòng"),
            _help_cmd("room claim", "Claim ownership when the owner leaves.", "`/room claim`", desc_vi="Nhận quyền chủ phòng"),
            _help_cmd("room bitrate", "Change room bitrate.", "`/room bitrate <kbps>`", desc_vi="Đổi bitrate phòng"),
            _help_cmd("room slowmode", "Set room text slowmode.", "`/room slowmode <seconds>`", desc_vi="Đặt slowmode chat phòng"),
            _help_cmd("room panel", "Send the room control panel again.", "`/room panel`", desc_vi="Gửi lại bảng điều khiển"),
            _help_cmd("tempvoice rename", "Rename a managed temp voice room.", "`/tempvoice rename`", True, desc_vi="Đổi tên phòng temp voice"),
            _help_cmd("tempvoice delete", "Delete a managed temp voice room.", "`/tempvoice delete`", True, desc_vi="Xóa phòng temp voice"),
            _help_cmd("tempvoice transfer", "Transfer managed temp voice ownership.", "`/tempvoice transfer`", True, desc_vi="Chuyển quyền chủ phòng"),
            _help_cmd("tempvoice panel", "Send the temp voice control panel.", "`/tempvoice panel`", True, desc_vi="Gửi bảng điều khiển"),
            _help_cmd("tempvoice stats", "View temp voice statistics.", "`/tempvoice stats`", True, desc_vi="Xem thống kê temp voice"),
            _help_cmd("tempvoice cleanup", "Clean up inactive temp voice rooms.", "`/tempvoice cleanup`", True, desc_vi="Dọn phòng không hoạt động"),
        ],
    },
    {
        "key": "other",
        "emoji": "📚",
        "name": "other",
        "name_vi": "Khác",
        "commands": [
            {"name": "help", "emoji": "📚", "desc": "Open the interactive command help menu.", "desc_vi": "Mở menu trợ giúp lệnh", "usage": "`/help`"},
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


def _desc(cmd: dict, lang: str) -> str:
    """Get command description in the correct language."""
    if lang == "vi":
        return cmd.get("desc_vi") or cmd["desc"]
    return cmd["desc"]


def _cat_name(cat: dict, lang: str) -> str:
    if lang == "vi":
        return cat.get("name_vi") or cat["name"]
    return cat["name"]


def _commands_list_text(cat: dict, is_admin: bool = True, lang: str = "en") -> str:
    cmds = _visible_commands(cat, is_admin)
    return "\n".join(
        f"**`/{cmd['name']}`** — {_desc(cmd, lang)}{' *(admin)*' if cmd.get('admin') else ''}"
        for cmd in cmds
    )


class CategorySelect(discord.ui.Select):
    def __init__(self, is_admin: bool = False, lang: str = "en"):
        self.is_admin = is_admin
        self.lang = lang
        # Chỉ hiện danh mục có ít nhất 1 lệnh visible
        visible_cats = [
            cat for cat in HELP_CATEGORIES
            if _visible_commands(cat, is_admin)
        ]
        options = [
            discord.SelectOption(
                label=_cat_name(cat, lang),
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
        lang = get_lang(str(interaction.guild.id)) if interaction.guild else "en"
        session = _get_session()
        try:
            embed = build_embed("help_category", session, vars={
                "category_emoji": cat["emoji"],
                "category_name": _cat_name(cat, lang),
                "commands_list": _commands_list_text(cat, is_admin, lang),
                "bot_name": interaction.client.user.display_name if interaction.client.user else "Bot",
            })
        finally:
            session.close()

        view = CommandSelectView(cat, is_admin, lang)
        await interaction.response.edit_message(embed=embed, view=view)


class CommandSelect(discord.ui.Select):
    def __init__(self, cat: dict, is_admin: bool = False, lang: str = "en"):
        self.cat = cat
        self.is_admin = is_admin
        self.lang = lang
        cmds = _visible_commands(cat, is_admin)
        options = [
            discord.SelectOption(
                label=f"/{cmd['name']}" + (" (admin)" if cmd.get("admin") else ""),
                value=f"{cat['key']}:{cmd['name']}",
                description=_desc(cmd, lang)[:100],
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

        lang = get_lang(str(interaction.guild.id)) if interaction.guild else "en"
        session = _get_session()
        try:
            embed = build_embed("help_command", session, vars={
                "command_emoji": "",
                "command_name": cmd_info["name"],
                "command_desc": _desc(cmd_info, lang),
                "command_usage": cmd_info["usage"],
                "bot_name": interaction.client.user.display_name if interaction.client.user else "Bot",
            })
        finally:
            session.close()

        view = CommandDetailView(self.cat, self.is_admin, lang)
        await interaction.response.edit_message(embed=embed, view=view)


# ── Views ────────────────────────────────────────────────────────────────────

class HelpMenuView(discord.ui.View):
    def __init__(self, is_admin: bool = False, lang: str = "en"):
        super().__init__(timeout=120)
        self.add_item(CategorySelect(is_admin, lang))


class CommandSelectView(discord.ui.View):
    def __init__(self, cat: dict, is_admin: bool = False, lang: str = "en"):
        super().__init__(timeout=120)
        self.add_item(CommandSelect(cat, is_admin, lang))
        self.add_item(BackToCategoriesButton(is_admin, lang))


class CommandDetailView(discord.ui.View):
    def __init__(self, cat: dict, is_admin: bool = False, lang: str = "en"):
        super().__init__(timeout=120)
        self.cat = cat
        self.is_admin = is_admin
        self.lang = lang
        self.add_item(BackToCategoryButton(cat, is_admin, lang))
        self.add_item(BackToCategoriesButton(is_admin, lang))


class BackToCategoriesButton(discord.ui.Button):
    def __init__(self, is_admin: bool = False, lang: str = "en"):
        super().__init__(label="← Danh mục", style=discord.ButtonStyle.secondary, custom_id="help_back_categories")
        self.is_admin = is_admin
        self.lang = lang

    async def callback(self, interaction: discord.Interaction):
        is_admin = _is_admin(interaction.user)
        lang = get_lang(str(interaction.guild.id)) if interaction.guild else "en"
        session = _get_session()
        try:
            embed = build_embed("help_menu", session, vars={
                "user.mention": interaction.user.mention,
                "bot_name": interaction.client.user.display_name if interaction.client.user else "Bot",
            })
        finally:
            session.close()
        await interaction.response.edit_message(embed=embed, view=HelpMenuView(is_admin, lang))


class BackToCategoryButton(discord.ui.Button):
    def __init__(self, cat: dict, is_admin: bool = False, lang: str = "en"):
        super().__init__(label=f"← {cat['name']}", style=discord.ButtonStyle.secondary, custom_id="help_back_category")
        self.cat = cat
        self.is_admin = is_admin
        self.lang = lang

    async def callback(self, interaction: discord.Interaction):
        cat = self.cat
        is_admin = _is_admin(interaction.user)
        lang = get_lang(str(interaction.guild.id)) if interaction.guild else "en"
        session = _get_session()
        try:
            embed = build_embed("help_category", session, vars={
                "category_emoji": cat["emoji"],
                "category_name": _cat_name(cat, lang),
                "commands_list": _commands_list_text(cat, is_admin, lang),
                "bot_name": interaction.client.user.display_name if interaction.client.user else "Bot",
            })
        finally:
            session.close()
        await interaction.response.edit_message(embed=embed, view=CommandSelectView(cat, is_admin, lang))


# ── Cog ──────────────────────────────────────────────────────────────────────

class HelpCog(commands.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    @discord.slash_command(name="help", description="Xem danh sách lệnh bot")
    async def help_cmd(self, ctx: discord.ApplicationContext):
        is_admin = _is_admin(ctx.author)
        lang = get_lang(str(ctx.guild.id)) if ctx.guild else "en"
        session = _get_session()
        try:
            embed = build_embed("help_menu", session, vars={
                "user.mention": ctx.author.mention,
                "bot_name": ctx.bot.user.display_name if ctx.bot.user else "Bot",
            })
        finally:
            session.close()
        await ctx.respond(embed=embed, view=HelpMenuView(is_admin, lang))


def setup(bot: discord.Bot):
    bot.add_cog(HelpCog(bot))
