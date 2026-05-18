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
        "name": "Shopping",
        "commands": [
            {"name": "san_pham",       "emoji": "📦", "desc": "Browse products and product details",               "usage": "`/san_pham [product]`"},
            {"name": "orders",         "emoji": "📋", "desc": "View your orders",                         "usage": "`/orders` or `/orders id:<id>`"},
            {"name": "feedback",       "emoji": "⭐", "desc": "Leave product feedback",                     "usage": "`/feedback`"},
            {"name": "support",        "emoji": "🆘", "desc": "Contact server support",                               "usage": "`/support`"},
            {"name": "bxh",            "emoji": "📊", "desc": "Shop leaderboard",                       "usage": "`/bxh`"},
            {"name": "tao_don",        "emoji": "🧾", "desc": "Create an order for a member",                        "usage": "`/tao_don`", "admin": True},
            {"name": "tao_don_custom", "emoji": "✏️", "desc": "Create a custom order with a custom name",                   "usage": "`/tao_don_custom`", "admin": True},
            {"name": "bang_gia",       "emoji": "💰", "desc": "Send the product price list to a channel",               "usage": "`/bang_gia [#channel]`", "admin": True},
        ],
    },
    {
        "key": "giveaway",
        "emoji": "🎉",
        "name": "Giveaway",
        "commands": [
            {"name": "giveaway",        "emoji": "🎁", "desc": "Create a new giveaway (admin)",              "usage": "`/giveaway <duration> <winners> <prize>`", "admin": True},
            {"name": "giveaway_list",   "emoji": "📋", "desc": "View active giveaways",       "usage": "`/giveaway_list`"},
            {"name": "giveaway_reroll", "emoji": "🔁", "desc": "Reroll a giveaway winner (admin)",  "usage": "`/giveaway_reroll <message_id>`", "admin": True},
            {"name": "giveaway_end",    "emoji": "🏁", "desc": "End a giveaway early (admin)",          "usage": "`/giveaway_end <message_id>`", "admin": True},
            {"name": "giveaway_ban",    "emoji": "🚫", "desc": "Ban user tham gia giveaway (admin)",     "usage": "`/giveaway_ban <@user>`", "admin": True},
            {"name": "giveaway_unban",  "emoji": "✅", "desc": "Unban a member from giveaways (admin)",      "usage": "`/giveaway_unban <@user>`", "admin": True},
        ],
    },
    {
        "key": "moderation",
        "emoji": "🛡️",
        "name": "Moderation",
        "commands": [
            {"name": "warn",      "emoji": "⚠️", "desc": "Warn a member (admin)",         "usage": "`/warn <@user> <reason>`", "admin": True},
            {"name": "unwarn",    "emoji": "🗑️", "desc": "Delete warnings (admin)",                "usage": "`/unwarn <@user> <id>`", "admin": True},
            {"name": "warnings",  "emoji": "📋", "desc": "View warning history (admin)",        "usage": "`/warnings <@user>`", "admin": True},
            {"name": "kick",      "emoji": "👢", "desc": "Kick a member (admin)",              "usage": "`/kick <@user> [reason]`", "admin": True},
            {"name": "ban",       "emoji": "🔨", "desc": "Ban a member (admin)",               "usage": "`/ban <@user> [reason]`", "admin": True},
            {"name": "unban",     "emoji": "🔓", "desc": "Unban a user (admin)",             "usage": "`/unban <user_id>`", "admin": True},
            {"name": "snipe",     "emoji": "👁️", "desc": "View last deleted message (admin)","usage": "`/snipe`", "admin": True},
            {"name": "editsnipe", "emoji": "✏️", "desc": "View last edited message (admin)","usage": "`/editsnipe`", "admin": True},
        ],
    },
    {
        "key": "channel_admin",
        "emoji": "⚙️",
        "name": "Channel Admin",
        "commands": [
            {"name": "purge",           "emoji": "🗑️",  "desc": "Bulk delete messages in channel",                   "usage": "`/purge <amount> [@user]`",          "admin": True},
            {"name": "nuke",            "emoji": "💣",  "desc": "Delete all messages by cloning the channel",       "usage": "`/nuke [reason]`",                      "admin": True},
            {"name": "lock",            "emoji": "🔒",  "desc": "Lock channel, prevent members from sending",             "usage": "`/lock [#channel] [reason]`",              "admin": True},
            {"name": "unlock",          "emoji": "🔓",  "desc": "Unlock a channel",                                        "usage": "`/unlock [#channel]`",                    "admin": True},
            {"name": "hide_channel",    "emoji": "🫥",  "desc": "Hide channel from regular members",            "usage": "`/hide_channel [#channel]`",              "admin": True},
            {"name": "show_channel",    "emoji": "👁️",  "desc": "Show a previously hidden channel",                              "usage": "`/show_channel [#channel]`",              "admin": True},
            {"name": "block_channel",   "emoji": "🚫",  "desc": "Block a member/role from a specific channel",           "usage": "`/block_channel <@user/role> [#channel]`","admin": True},
            {"name": "unblock_channel", "emoji": "✅",  "desc": "Unblock a member/role in a channel",                  "usage": "`/unblock_channel <@user/role> [#channel]`","admin": True},
            {"name": "slowmode",        "emoji": "⏱️",  "desc": "Set slowmode for a channel",                 "usage": "`/slowmode <seconds> [#channel]`",           "admin": True},
            {"name": "image_only",      "emoji": "🖼️",  "desc": "Set channel to images/video only",                  "usage": "`/image_only [#channel]`",                "admin": True},
            {"name": "announce",        "emoji": "📢",  "desc": "Send an announcement with a nice embed",                "usage": "`/announce <content> [#channel] [@role]`","admin": True},
            {"name": "move_message",    "emoji": "➡️",  "desc": "Move a message to another channel via link",          "usage": "`/move_message <link> <#target_channel>`",  "admin": True},
            {"name": "clear_reactions", "emoji": "🧹",  "desc": "Clear all reactions from a message",              "usage": "`/clear_reactions <link>`",            "admin": True},
            {"name": "pin_message",     "emoji": "📌",  "desc": "Pin a message via link",                                "usage": "`/pin_message <link>`",                "admin": True},
            {"name": "unpin_message",   "emoji": "📍",  "desc": "Unpin a message via link",                             "usage": "`/unpin_message <link>`",              "admin": True},
            {"name": "role_add",        "emoji": "➕",  "desc": "Add a role to a member",                             "usage": "`/role_add <@user> <@role>`",          "admin": True},
            {"name": "role_remove",     "emoji": "➖",  "desc": "Remove a role from a member",                             "usage": "`/role_remove <@user> <@role>`",       "admin": True},
            {"name": "nick",            "emoji": "✏️",  "desc": "Change or clear a member nickname",                    "usage": "`/nick <@user> [nickname]`",           "admin": True},
        ],
    },
    {
        "key": "invites",
        "emoji": "📨",
        "name": "Invite Tracking",
        "commands": [
            {"name": "invites me",          "emoji": "📊", "desc": "View your invite stats",             "usage": "`/invites me`"},
            {"name": "invites info",        "emoji": "👤", "desc": "View invite stats for another member", "usage": "`/invites info <@user>`"},
            {"name": "invites leaderboard", "emoji": "🏆", "desc": "Server invite leaderboard",                       "usage": "`/invites leaderboard`"},
            {"name": "invites fake",        "emoji": "🚫", "desc": "Mark a member's invites as fake (admin)", "usage": "`/invites fake <@user>`", "admin": True},
        ],
    },
    {
        "key": "utility",
        "emoji": "🔧",
        "name": "Utility",
        "commands": [
            {"name": "afk",        "emoji": "💤", "desc": "Set AFK status",          "usage": "`/afk [reason]`"},
            {"name": "avatar",     "emoji": "🖼️", "desc": "View member avatar",       "usage": "`/avatar [@user]`"},
            {"name": "banner",     "emoji": "🎨", "desc": "View member banner",        "usage": "`/banner [@user]`"},
            {"name": "userinfo",   "emoji": "ℹ️",  "desc": "View member info",   "usage": "`/userinfo [@user]`"},
            {"name": "serverinfo", "emoji": "🏠",  "desc": "View server info",       "usage": "`/serverinfo`"},
            {"name": "poll",       "emoji": "📊",  "desc": "Create a quick poll",        "usage": "`/poll <question> <options...>`"},
            {"name": "qr",         "emoji": "📷",  "desc": "Generate QR code from text/link", "usage": "`/qr <content>`"},
            {"name": "setprefix",  "emoji": "⚙️",  "desc": "Set interaction command prefix (admin)", "usage": "`/setprefix <prefix>`", "admin": True},
        ],
    },
    {
        "key": "interactions",
        "emoji": "🎭",
        "name": "Actions",
        "commands": [
            # Interactions with other members
            {"name": "hug",        "emoji": "🫂", "desc": "Hug another member",             "usage": "`/hug <@user>`"},
            {"name": "pat",        "emoji": "🤚", "desc": "Pat another member",                 "usage": "`/pat <@user>`"},
            {"name": "kiss",       "emoji": "💋", "desc": "Kiss another member",                     "usage": "`/kiss <@user>`"},
            {"name": "slap",       "emoji": "🫲", "desc": "Slap another member",                     "usage": "`/slap <@user>`"},
            {"name": "punch",      "emoji": "👊", "desc": "Punch another member",                     "usage": "`/punch <@user>`"},
            {"name": "wave",       "emoji": "👋", "desc": "Wave at another member",            "usage": "`/wave <@user>`"},
            {"name": "cuddle",     "emoji": "🤗", "desc": "Cuddle another member",                   "usage": "`/cuddle <@user>`"},
            {"name": "poke",       "emoji": "👉", "desc": "Poke another member",                    "usage": "`/poke <@user>`"},
            {"name": "tickle",     "emoji": "🤭", "desc": "Tickle another member",                      "usage": "`/tickle <@user>`"},
            {"name": "bite",       "emoji": "😬", "desc": "Bite another member",                     "usage": "`/bite <@user>`"},
            {"name": "lick",       "emoji": "👅", "desc": "Lick another member",                    "usage": "`/lick <@user>`"},
            {"name": "wink",       "emoji": "😉", "desc": "Wink at another member",            "usage": "`/wink <@user>`"},
            {"name": "stare",      "emoji": "👀", "desc": "Stare at another member",          "usage": "`/stare <@user>`"},
            {"name": "brofist",    "emoji": "🤜", "desc": "Brofist another member",             "usage": "`/brofist <@user>`"},
            {"name": "handhold",   "emoji": "🤝", "desc": "Hold hands with another member",                 "usage": "`/handhold <@user>`"},
            {"name": "nuzzle",     "emoji": "🥰", "desc": "Nuzzle another member",              "usage": "`/nuzzle <@user>`"},
            {"name": "smack",      "emoji": "💥", "desc": "Smack another member",                    "usage": "`/smack <@user>`"},
            {"name": "airkiss",    "emoji": "😘", "desc": "Send an air kiss to another member",     "usage": "`/airkiss <@user>`"},
            {"name": "angrystare", "emoji": "😠", "desc": "Give an angry stare at another member",            "usage": "`/angrystare <@user>`"},
            {"name": "pinch",      "emoji": "🤏", "desc": "Pinch another member",                     "usage": "`/pinch <@user>`"},
            {"name": "nom",        "emoji": "😋", "desc": "Nom another member (lol)",                "usage": "`/nom <@user>`"},
            {"name": "peek",       "emoji": "🫣", "desc": "Peek at another member",               "usage": "`/peek <@user>`"},
        ],
    },
    {
        "key": "expressions",
        "emoji": "😄",
        "name": "Expressions",
        "commands": [
            {"name": "blush",      "emoji": "😊", "desc": "Blush",                            "usage": "`/blush`"},
            {"name": "cry",        "emoji": "😢", "desc": "Cry",                               "usage": "`/cry`"},
            {"name": "dance",      "emoji": "💃", "desc": "Dance",                               "usage": "`/dance`"},
            {"name": "laugh",      "emoji": "😂", "desc": "Laugh",                               "usage": "`/laugh`"},
            {"name": "smile",      "emoji": "😊", "desc": "Smile",                          "usage": "`/smile`"},
            {"name": "happy",      "emoji": "😄", "desc": "Be happy",                             "usage": "`/happy`"},
            {"name": "sad",        "emoji": "😞", "desc": "Be sad",                               "usage": "`/sad`"},
            {"name": "sleep",      "emoji": "😴", "desc": "Sleep",                                "usage": "`/sleep`"},
            {"name": "yawn",       "emoji": "🥱", "desc": "Yawn",                               "usage": "`/yawn`"},
            {"name": "shrug",      "emoji": "🤷", "desc": "Shrug",                           "usage": "`/shrug`"},
            {"name": "facepalm",   "emoji": "🤦", "desc": "Facepalm",                           "usage": "`/facepalm`"},
            {"name": "clap",       "emoji": "👏", "desc": "Clap",                             "usage": "`/clap`"},
            {"name": "celebrate",  "emoji": "🎉", "desc": "Celebrate",                            "usage": "`/celebrate`"},
            {"name": "thumbsup",   "emoji": "👍", "desc": "Thumbs up",                              "usage": "`/thumbsup`"},
            {"name": "sorry",      "emoji": "🙏", "desc": "Apologize",                            "usage": "`/sorry`"},
            {"name": "confused",   "emoji": "😕", "desc": "Be confused",                            "usage": "`/confused`"},
            {"name": "nervous",    "emoji": "😰", "desc": "Be nervous",                            "usage": "`/nervous`"},
            {"name": "scared",     "emoji": "😱", "desc": "Be scared",                             "usage": "`/scared`"},
            {"name": "surprised",  "emoji": "😲", "desc": "Be surprised",                         "usage": "`/surprised`"},
            {"name": "cool",       "emoji": "😎", "desc": "Look cool",                               "usage": "`/cool`"},
            {"name": "love",       "emoji": "❤️", "desc": "Be in love",                               "usage": "`/love`"},
            {"name": "run",        "emoji": "🏃", "desc": "Run",                               "usage": "`/run`"},
            {"name": "shy",        "emoji": "🙈", "desc": "Be shy",                         "usage": "`/shy`"},
            {"name": "smug",       "emoji": "😏", "desc": "Look smug",                             "usage": "`/smug`"},
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


def _help_cmd(name: str, desc: str, usage: str | None = None, admin: bool | None = None) -> dict:
    base = dict(_LEGACY_COMMANDS.get(name, {"name": name, "emoji": "▫️"}))
    base["desc"] = desc
    base["usage"] = usage or f"`/{name}`"
    if admin is not None:
        base["admin"] = admin
    return base


HELP_CATEGORIES = [
    {
        "key": "interaction",
        "emoji": "💞",
        "name": "interaction",
        "commands": [
            _help_cmd("hug", "Hug another member.", "`/hug <@user>`"),
            _help_cmd("pat", "Pat another member.", "`/pat <@user>`"),
            _help_cmd("kiss", "Kiss another member.", "`/kiss <@user>`"),
            _help_cmd("slap", "Slap another member.", "`/slap <@user>`"),
            _help_cmd("punch", "Punch another member.", "`/punch <@user>`"),
            _help_cmd("wave", "Wave at another member.", "`/wave <@user>`"),
            _help_cmd("cuddle", "Cuddle another member.", "`/cuddle <@user>`"),
            _help_cmd("poke", "Poke another member.", "`/poke <@user>`"),
            _help_cmd("tickle", "Tickle another member.", "`/tickle <@user>`"),
            _help_cmd("bite", "Bite another member.", "`/bite <@user>`"),
            _help_cmd("lick", "Lick another member.", "`/lick <@user>`"),
            _help_cmd("wink", "Wink at another member.", "`/wink <@user>`"),
            _help_cmd("stare", "Stare at another member.", "`/stare <@user>`"),
            _help_cmd("brofist", "Brofist another member.", "`/brofist <@user>`"),
            _help_cmd("handhold", "Hold hands with another member.", "`/handhold <@user>`"),
            _help_cmd("nuzzle", "Nuzzle another member.", "`/nuzzle <@user>`"),
            _help_cmd("smack", "Smack another member.", "`/smack <@user>`"),
            _help_cmd("airkiss", "Send an air kiss.", "`/airkiss <@user>`"),
            _help_cmd("angrystare", "Give an angry stare.", "`/angrystare <@user>`"),
            _help_cmd("pinch", "Pinch another member.", "`/pinch <@user>`"),
            _help_cmd("nom", "Nom another member.", "`/nom <@user>`"),
            _help_cmd("peek", "Peek at another member.", "`/peek <@user>`"),
        ],
    },
    {
        "key": "expression",
        "emoji": "😄",
        "name": "expression",
        "commands": [
            _help_cmd("blush", "Post a blush expression."),
            _help_cmd("cry", "Post a crying expression."),
            _help_cmd("dance", "Post a dance expression."),
            _help_cmd("laugh", "Post a laugh expression."),
            _help_cmd("smile", "Post a smile expression."),
            _help_cmd("happy", "Post a happy expression."),
            _help_cmd("sad", "Post a sad expression."),
            _help_cmd("sleep", "Post a sleep expression."),
            _help_cmd("yawn", "Post a yawn expression."),
            _help_cmd("shrug", "Post a shrug expression."),
            _help_cmd("facepalm", "Post a facepalm expression."),
            _help_cmd("clap", "Post a clap expression."),
            _help_cmd("celebrate", "Post a celebration expression."),
            _help_cmd("thumbsup", "Post a thumbs-up expression."),
            _help_cmd("sorry", "Post an apology expression."),
            _help_cmd("confused", "Post a confused expression."),
            _help_cmd("nervous", "Post a nervous expression."),
            _help_cmd("scared", "Post a scared expression."),
            _help_cmd("surprised", "Post a surprised expression."),
            _help_cmd("cool", "Post a cool expression."),
            _help_cmd("love", "Post a love expression."),
            _help_cmd("run", "Post a running expression."),
            _help_cmd("shy", "Post a shy expression."),
            _help_cmd("smug", "Post a smug expression."),
            _help_cmd("yay", "Post a yay expression."),
        ],
    },
    {
        "key": "fun",
        "emoji": "🎲",
        "name": "fun",
        "commands": [
            _help_cmd("space", "Get ISS location & astronaut info.", "`/space`"),
            _help_cmd("dadjoke", "Get a random Dad joke.", "`/dadjoke`"),
            _help_cmd("cat", "Find a cute cat picture.", "`/cat`"),
            _help_cmd("dog", "Find a cute dog picture.", "`/dog`"),
            _help_cmd("pug", "Find a cute pug picture.", "`/pug`"),
            _help_cmd("norris", "Get a random Chuck Norris fact.", "`/norris`"),
            _help_cmd("pokemon", "Get info on a Pokémon.", "`/pokemon <name>`"),
            _help_cmd("itunes", "Search for a song on iTunes.", "`/itunes <query>`"),
        ],
    },
    {
        "key": "shop",
        "emoji": "🛒",
        "name": "shop",
        "commands": [
            _help_cmd("san_pham", "Browse products and product details.", "`/san_pham [product]`"),
            _help_cmd("orders", "View your orders or a specific order.", "`/orders [id]`"),
            _help_cmd("feedback", "Leave product feedback.", "`/feedback`"),
            _help_cmd("support", "Contact server support.", "`/support`"),
            _help_cmd("bxh", "View the shop leaderboard.", "`/bxh`"),
            _help_cmd("tao_don", "Create an order for a member.", "`/tao_don`", True),
            _help_cmd("tao_don_custom", "Create a custom order with a custom name.", "`/tao_don_custom`", True),
            _help_cmd("bang_gia", "Send the product price list to a channel.", "`/bang_gia [#channel]`", True),
        ],
    },
    {
        "key": "info",
        "emoji": "ℹ️",
        "name": "info",
        "commands": [
            _help_cmd("avatar", "View a member avatar.", "`/avatar [@user]`"),
            _help_cmd("banner", "View a member banner.", "`/banner [@user]`"),
            _help_cmd("userinfo", "View member information.", "`/userinfo [@user]`"),
            _help_cmd("serverinfo", "View server information.", "`/serverinfo`"),
            _help_cmd("invites me", "View your invite stats.", "`/invites me`"),
            _help_cmd("invites info", "View invite stats for a member.", "`/invites info <@user>`"),
            _help_cmd("invites leaderboard", "View the invite leaderboard.", "`/invites leaderboard`"),
            _help_cmd("invites fake", "Mark a member's invites as fake.", "`/invites fake <@user>`", True),
        ],
    },
    {
        "key": "giveaway",
        "emoji": "🎁",
        "name": "giveaway",
        "commands": [
            _help_cmd("giveaway", "Create a new giveaway.", "`/giveaway <duration> <winners> <prize>`", True),
            _help_cmd("giveaway_list", "View active giveaways.", "`/giveaway_list`"),
            _help_cmd("giveaway_reroll", "Reroll a giveaway winner.", "`/giveaway_reroll <message_id>`", True),
            _help_cmd("giveaway_end", "End a giveaway early.", "`/giveaway_end <message_id>`", True),
            _help_cmd("giveaway_ban", "Ban a member from giveaways.", "`/giveaway_ban <@user>`", True),
            _help_cmd("giveaway_unban", "Unban a member from giveaways.", "`/giveaway_unban <@user>`", True),
        ],
    },
    {
        "key": "misc",
        "emoji": "🧩",
        "name": "misc",
        "commands": [
            _help_cmd("afk", "Set your AFK status.", "`/afk [reason]`"),
            _help_cmd("poll", "Create a quick poll.", "`/poll <question> <options...>`"),
            _help_cmd("qr", "Generate a QR code from text or a link.", "`/qr <content>`"),
            _help_cmd("setprefix", "Set the interaction command prefix.", "`/setprefix <prefix>`", True),
        ],
    },
    {
        "key": "sticky",
        "emoji": "📌",
        "name": "sticky",
        "commands": [
            _help_cmd("sticky create", "Create a text sticky.", "`/sticky create`", True),
            _help_cmd("sticky embed", "Create an embed sticky.", "`/sticky embed`", True),
            _help_cmd("sticky edit", "Edit a sticky.", "`/sticky edit`", True),
            _help_cmd("sticky remove", "Remove a sticky.", "`/sticky remove`", True),
            _help_cmd("sticky enable", "Enable a sticky.", "`/sticky enable`", True),
            _help_cmd("sticky disable", "Disable a sticky.", "`/sticky disable`", True),
            _help_cmd("sticky list", "List stickies.", "`/sticky list`", True),
            _help_cmd("sticky view", "View sticky details.", "`/sticky view`", True),
            _help_cmd("sticky clear", "Clear sticky data.", "`/sticky clear`", True),
            _help_cmd("sticky interval", "Set resend interval.", "`/sticky interval`", True),
            _help_cmd("sticky messages", "Set message count behavior.", "`/sticky messages`", True),
            _help_cmd("sticky color", "Set embed color.", "`/sticky color`", True),
            _help_cmd("sticky image", "Set embed image.", "`/sticky image`", True),
            _help_cmd("sticky thumbnail", "Set embed thumbnail.", "`/sticky thumbnail`", True),
            _help_cmd("sticky footer", "Set embed footer.", "`/sticky footer`", True),
            _help_cmd("sticky pin", "Pin a sticky.", "`/sticky pin`", True),
            _help_cmd("sticky unpin", "Unpin a sticky.", "`/sticky unpin`", True),
            _help_cmd("sticky sync", "Resend all stickies.", "`/sticky sync`", True),
            _help_cmd("sticky expire", "Set auto-expiration.", "`/sticky expire`", True),
            _help_cmd("sticky move", "Move sticky to another channel.", "`/sticky move`", True),
            _help_cmd("sticky copy", "Copy sticky to another channel.", "`/sticky copy`", True),
            _help_cmd("sticky stats", "View sticky stats.", "`/sticky stats`", True),
            _help_cmd("sticky channel", "Create for a target channel.", "`/sticky channel`", True),
        ],
    },
    {
        "key": "moderator",
        "emoji": "🛡️",
        "name": "moderator",
        "commands": [
            _help_cmd("warn", "Warn a member.", "`/warn <@user> <reason>`", True),
            _help_cmd("unwarn", "Remove a warning.", "`/unwarn <@user> <id>`", True),
            _help_cmd("delwarn", "Delete a warning by ID.", "`/delwarn <id>`", True),
            _help_cmd("warnings", "View warning history.", "`/warnings <@user>`", True),
            _help_cmd("kick", "Kick a member.", "`/kick <@user> [reason]`", True),
            _help_cmd("ban", "Ban a member.", "`/ban <@user> [reason]`", True),
            _help_cmd("unban", "Unban a user by ID.", "`/unban <user_id>`", True),
            _help_cmd("mute", "Mute (timeout) a member.", "`/mute <@user> <duration> [reason]`", True),
            _help_cmd("softban", "Softban (ban + unban).", "`/softban <@user> [reason]`", True),
            _help_cmd("deafen", "Deafen a member in voice.", "`/deafen <@user> [reason]`", True),
            _help_cmd("undeafen", "Undeafen a member.", "`/undeafen <@user>`", True),
            _help_cmd("clean", "Clean up bot responses.", "`/clean [amount]`", True),
            _help_cmd("members", "List members in a role.", "`/members <@role>`", True),
            _help_cmd("rolepersist", "Toggle persistent role.", "`/rolepersist <@user> <@role>`", True),
            _help_cmd("temprole", "Assign a temporary role.", "`/temprole <@user> <@role> <duration>`", True),
            _help_cmd("note", "Add a note about a member.", "`/note <@user> <content>`", True),
            _help_cmd("notes", "View notes for a member.", "`/notes <@user>`", True),
            _help_cmd("delnote", "Delete a note.", "`/delnote <id>`", True),
            _help_cmd("editnote", "Edit a note.", "`/editnote <id> <content>`", True),
            _help_cmd("clearnotes", "Delete all notes.", "`/clearnotes <@user>`", True),
            _help_cmd("modlogs", "View mod log history.", "`/modlogs <@user>`", True),
            _help_cmd("moderations", "View active moderations.", "`/moderations`", True),
            _help_cmd("case", "Show a mod case.", "`/case <number>`", True),
            _help_cmd("reason", "Update case reason.", "`/reason <number> <text>`", True),
            _help_cmd("duration", "Change case duration.", "`/duration <number> <time>`", True),
        ],
    },
    {
        "key": "modtools",
        "emoji": "⚙️",
        "name": "modtools",
        "commands": [
            _help_cmd("modstats", "Moderation statistics.", "`/modstats [@mod]`", True),
            _help_cmd("lockdown", "Lock/unlock channels.", "`/lockdown <start|end>`", True),
            _help_cmd("ignored", "List ignored targets.", "`/ignored`", True),
            _help_cmd("diagnose", "Diagnose permissions.", "`/diagnose [target]`", True),
            _help_cmd("snipe", "View deleted message.", "`/snipe`", True),
            _help_cmd("editsnipe", "View edited message.", "`/editsnipe`", True),
            _help_cmd("purge", "Bulk delete messages.", "`/purge <amount> [@user]`", True),
            _help_cmd("nuke", "Clone and reset channel.", "`/nuke [reason]`", True),
            _help_cmd("lock", "Lock a channel.", "`/lock [#channel] [reason]`", True),
            _help_cmd("unlock", "Unlock a channel.", "`/unlock [#channel]`", True),
            _help_cmd("hide_channel", "Hide a channel.", "`/hide_channel [#channel]`", True),
            _help_cmd("show_channel", "Show a channel.", "`/show_channel [#channel]`", True),
            _help_cmd("block_channel", "Block from channel.", "`/block_channel <@target> [#ch]`", True),
            _help_cmd("unblock_channel", "Unblock from channel.", "`/unblock_channel <@target> [#ch]`", True),
            _help_cmd("slowmode", "Set slowmode.", "`/slowmode <seconds> [#channel]`", True),
            _help_cmd("image_only", "Images-only mode.", "`/image_only [#channel]`", True),
            _help_cmd("announce", "Send announcement.", "`/announce <content> [#ch] [@role]`", True),
            _help_cmd("move_message", "Move a message.", "`/move_message <link> <#target>`", True),
            _help_cmd("clear_reactions", "Clear reactions.", "`/clear_reactions <link>`", True),
            _help_cmd("pin_message", "Pin a message.", "`/pin_message <link>`", True),
            _help_cmd("unpin_message", "Unpin a message.", "`/unpin_message <link>`", True),
        ],
    },
    {
        "key": "role",
        "emoji": "🏷️",
        "name": "role",
        "commands": [
            _help_cmd("role_add", "Add a role to a member.", "`/role_add <@user> <@role>`", True),
            _help_cmd("role_remove", "Remove a role from a member.", "`/role_remove <@user> <@role>`", True),
            _help_cmd("nick", "Change or clear a member nickname.", "`/nick <@user> [nickname]`", True),
            _help_cmd("roles deploy-button", "Deploy a button role panel.", "`/roles deploy-button`", True),
            _help_cmd("roles deploy-select", "Deploy a select-menu role panel.", "`/roles deploy-select`", True),
        ],
    },
    {
        "key": "other",
        "emoji": "📚",
        "name": "other",
        "commands": [
            {"name": "help", "emoji": "📚", "desc": "Open the interactive command help menu.", "usage": "`/help`"},
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
    """Check if user has administrator permissions."""
    perms = getattr(user, "guild_permissions", None)
    return bool(perms and perms.administrator)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _visible_commands(cat: dict, is_admin: bool) -> list:
    # Always show all commands — admin commands just get an (admin) tag
    return cat["commands"]


def _desc(cmd: dict) -> str:
    """Get command description."""
    return cmd["desc"]


def _cat_name(cat: dict) -> str:
    return cat["name"]


def _commands_list_text(cat: dict, is_admin: bool = True) -> str:
    cmds = _visible_commands(cat, is_admin)
    return "\n".join(
        f"**`/{cmd['name']}`** — {_desc(cmd)}{' *(admin)*' if cmd.get('admin') else ''}"
        for cmd in cmds
    )


class CategorySelect(discord.ui.Select):
    def __init__(self, is_admin: bool = False):
        self.is_admin = is_admin
        # Only show categories with at least 1 visible command
        visible_cats = [
            cat for cat in HELP_CATEGORIES
            if _visible_commands(cat, is_admin)
        ]
        options = [
            discord.SelectOption(
                label=_cat_name(cat),
                value=cat["key"],
                emoji=cat["emoji"],
            )
            for cat in visible_cats
        ]
        super().__init__(
            placeholder="🔍 Select a category...",
            min_values=1, max_values=1,
            options=options,
            custom_id="help_category_select",
        )

    async def callback(self, interaction: discord.Interaction):
        cat_key = self.values[0]
        cat = _CAT_BY_KEY.get(cat_key)
        if not cat:
            await interaction.response.send_message("Category not found.", ephemeral=True)
            return

        is_admin = _is_admin(interaction.user)
        session = _get_session()
        try:
            embed = build_embed("help_category", session, vars={
                "category_emoji": cat["emoji"],
                "category_name": _cat_name(cat),
                "commands_list": _commands_list_text(cat, is_admin),
                "bot_name": interaction.client.user.display_name if interaction.client.user else "Bot",
            }, guild_id=interaction.guild_id)
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
                description=_desc(cmd)[:100],
            )
            for cmd in cmds
        ]
        super().__init__(
            placeholder="📖 Select a command for details...",
            min_values=1, max_values=1,
            options=options,
            custom_id="help_command_select",
        )

    async def callback(self, interaction: discord.Interaction):
        cmd_key = self.values[0]
        cmd_info = _CMD_BY_KEY.get(cmd_key)
        if not cmd_info:
            await interaction.response.send_message("Command not found.", ephemeral=True)
            return

        lang = get_lang(str(interaction.guild.id)) if interaction.guild else "en"
        session = _get_session()
        try:
            embed = build_embed("help_command", session, vars={
                "command_emoji": "",
                "command_name": cmd_info["name"],
                "command_desc": _desc(cmd_info),
                "command_usage": cmd_info["usage"],
                "bot_name": interaction.client.user.display_name if interaction.client.user else "Bot",
            }, guild_id=interaction.guild_id)
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
        super().__init__(label="← Categories", style=discord.ButtonStyle.secondary, custom_id="help_back_categories")
        self.is_admin = is_admin

    async def callback(self, interaction: discord.Interaction):
        is_admin = _is_admin(interaction.user)
        session = _get_session()
        try:
            embed = build_embed("help_menu", session, vars={
                "user.mention": interaction.user.mention,
                "bot_name": interaction.client.user.display_name if interaction.client.user else "Bot",
            }, guild_id=interaction.guild_id)
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
                "category_name": _cat_name(cat),
                "commands_list": _commands_list_text(cat, is_admin),
                "bot_name": interaction.client.user.display_name if interaction.client.user else "Bot",
            }, guild_id=interaction.guild_id)
        finally:
            session.close()
        await interaction.response.edit_message(embed=embed, view=CommandSelectView(cat, is_admin))


# ── Cog ──────────────────────────────────────────────────────────────────────

class HelpCog(commands.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    @discord.slash_command(name="help", description="View bot command list")
    async def help_cmd(self, ctx: discord.ApplicationContext):
        is_admin = _is_admin(ctx.author)
        session = _get_session()
        try:
            embed = build_embed("help_menu", session, vars={
                "user.mention": ctx.author.mention,
                "bot_name": ctx.bot.user.display_name if ctx.bot.user else "Bot",
            }, guild_id=interaction.guild_id)
        finally:
            session.close()
        await ctx.respond(embed=embed, view=HelpMenuView(is_admin))


def setup(bot: discord.Bot):
    bot.add_cog(HelpCog(bot))
