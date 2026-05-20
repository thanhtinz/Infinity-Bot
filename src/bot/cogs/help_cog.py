"""Help command — category → command → detail, embed content from embed manager."""
from __future__ import annotations

import discord
from discord.ext import commands

from src.bot.embed_utils import build_embed
from src.database.config import SessionLocal

# ── Help data ────────────────────────────────────────────────────────────────

_EMOJI_MAP: dict[str, str] = {
    # Shop
    "orders": "📋", "feedback": "⭐", "support": "🆘",
    "leaderboard": "📊", "createorder": "🧾", "createorder_custom": "✏️",
    "price_list": "📋",
    # Giveaway
    "giveaway": "🎁", "giveaway_list": "📋", "giveaway_reroll": "🔁",
    "giveaway_end": "🏁", "giveaway_ban": "🚫", "giveaway_unban": "✅",
    # Moderation
    "warn": "⚠️", "unwarn": "🗑️", "warnings": "📋", "kick": "👢",
    "ban": "🔨", "unban": "🔓", "snipe": "👁️", "editsnipe": "✏️",
    # Channel Admin
    "purge": "🗑️", "nuke": "💣", "lock": "🔒", "unlock": "🔓",
    "hide_channel": "🫥", "show_channel": "👁️", "block_channel": "🚫",
    "unblock_channel": "✅", "slowmode": "⏱️", "image_only": "🖼️",
    "announce": "📢", "move_message": "➡️", "clear_reactions": "🧹",
    "pin_message": "📌", "unpin_message": "📍", "role_add": "➕",
    "role_remove": "➖", "nick": "✏️",
    # Invites
    "invites me": "📊", "invites info": "👤", "invites leaderboard": "🏆",
    "invites fake": "🚫",
    # Utility
    "afk": "💤", "avatar": "🖼️", "banner": "🎨", "userinfo": "ℹ️",
    "serverinfo": "🏠", "poll": "📊", "qr": "📷", "report": "🐛", "setprefix": "⚙️",
    # Interactions
    "hug": "🫂", "pat": "🤚", "kiss": "💋", "slap": "🫲", "punch": "👊",
    "wave": "👋", "cuddle": "🤗", "poke": "👉", "tickle": "🤭", "bite": "😬",
    "lick": "👅", "wink": "😉", "stare": "👀", "brofist": "🤜", "handhold": "🤝",
    "nuzzle": "🥰", "smack": "💥", "airkiss": "😘", "angrystare": "😠",
    "pinch": "🤏", "nom": "😋", "peek": "🫣",
    # Expressions
    "blush": "😊", "cry": "😢", "dance": "💃", "laugh": "😂", "smile": "😊",
    "happy": "😄", "sad": "😞", "sleep": "😴", "yawn": "🥱", "shrug": "🤷",
    "facepalm": "🤦", "clap": "👏", "celebrate": "🎉", "thumbsup": "👍",
    "sorry": "🙏", "confused": "😕", "nervous": "😰", "scared": "😱",
    "surprised": "😲", "cool": "😎", "love": "❤️", "run": "🏃", "shy": "🙈",
    "smug": "😏", "yay": "🥳",
    # Fun
    "space": "🚀", "dadjoke": "😂", "cat": "🐱", "dog": "🐕", "pug": "🐶",
    "norris": "💪", "pokemon": "🎮", "itunes": "🎵",
    # Info
    "invites me": "📊", "invites info": "👤", "invites leaderboard": "🏆",
    "invites fake": "🚫",
    # Misc
    "afk": "💤", "poll": "📊", "qr": "📷", "report": "🐛", "setprefix": "⚙️",
    # Sticky
    "sticky create": "📝", "sticky embed": "📋", "sticky edit": "✏️",
    "sticky remove": "🗑️", "sticky enable": "✅", "sticky disable": "❌",
    "sticky list": "📋", "sticky view": "👁️", "sticky clear": "🧹",
    "sticky interval": "⏱️", "sticky messages": "💬", "sticky color": "🎨",
    "sticky image": "🖼️", "sticky thumbnail": "🖼️", "sticky footer": "📝",
    "sticky pin": "📌", "sticky unpin": "📍", "sticky sync": "🔄",
    "sticky expire": "⏳", "sticky move": "➡️", "sticky copy": "📋",
    "sticky stats": "📊", "sticky channel": "📢",
    # Moderator
    "delwarn": "🗑️", "mute": "🔇", "softban": "🔨", "deafen": "🔇",
    "undeafen": "🔊", "clean": "🧹", "members": "👥", "rolepersist": "🔄",
    "temprole": "⏳", "note": "📝", "notes": "📋", "delnote": "🗑️",
    "editnote": "✏️", "clearnotes": "🧹", "modlogs": "📋", "moderations": "🛡️",
    "case": "📁", "reason": "📝", "duration": "⏱️",
    # Modtools
    "modstats": "📊", "lockdown": "🔒", "ignored": "🚫", "diagnose": "🔍",
    # Role
    "roles deploy-button": "🔘", "roles deploy-select": "📋",
    # Other
    "help": "📚",
}


def _help_cmd(name: str, desc: str, usage: str | None = None, admin: bool | None = None) -> dict:
    base = {"name": name, "emoji": _EMOJI_MAP.get(name, "▫️"), "desc": desc, "usage": usage or f"`/{name}`"}
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
            _help_cmd("orders", "View your orders or a specific order.", "`/orders [id]`"),
            _help_cmd("feedback", "Leave product feedback.", "`/feedback`"),
            _help_cmd("support", "Contact server support.", "`/support`"),
            _help_cmd("leaderboard", "View the shop leaderboard.", "`/leaderboard`"),
            _help_cmd("createorder", "Create an order for a member.", "`/createorder`", True),
            _help_cmd("createorder_custom", "Create a custom order with a custom name.", "`/createorder_custom`", True),
            _help_cmd("price_list", "View price list with category filter.", "`/price_list`", True),
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
            _help_cmd("report", "Report a bug or issue to the bot owner.", "`/report`"),
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
        "key": "autorole",
        "emoji": "👤",
        "name": "autorole",
        "commands": [
            _help_cmd("autorole add", "Add a role to auto-assign on join.", "`/autorole add <@role> [delay] [for_bots]`", True),
            _help_cmd("autorole remove", "Remove an auto role by ID.", "`/autorole remove <id>`", True),
            _help_cmd("autorole list", "List all configured auto roles.", "`/autorole list`"),
        ],
    },
    {
        "key": "forms",
        "emoji": "📋",
        "name": "forms",
        "commands": [
            _help_cmd("form apply", "Apply for a form.", "`/form apply <template_id>`"),
            _help_cmd("form list", "List active form templates.", "`/form list`"),
            _help_cmd("form submissions", "View pending submissions.", "`/form submissions <template_id>`", True),
            _help_cmd("form review", "Approve or reject a submission.", "`/form review <id> <approve|reject>`", True),
        ],
    },
    {
        "key": "reminders",
        "emoji": "⏰",
        "name": "reminders",
        "commands": [
            _help_cmd("remind set", "Set a reminder.", "`/remind set <time> <message>`"),
            _help_cmd("remind list", "List your active reminders.", "`/remind list`"),
            _help_cmd("remind cancel", "Cancel a reminder.", "`/remind cancel <id>`"),
            _help_cmd("todo add", "Add a todo item.", "`/todo add <content>`"),
            _help_cmd("todo list", "List your todo items.", "`/todo list`"),
            _help_cmd("todo done", "Mark a todo as done.", "`/todo done <id>`"),
            _help_cmd("todo remove", "Remove a todo item.", "`/todo remove <id>`"),
        ],
    },
    {
        "key": "polls",
        "emoji": "📊",
        "name": "polls",
        "commands": [
            _help_cmd("poll create", "Create a new poll.", "`/poll create <question> <options...> [duration]`"),
            _help_cmd("poll end", "End a poll early.", "`/poll end <poll_id>`"),
            _help_cmd("poll results", "Show current poll results.", "`/poll results <poll_id>`"),
        ],
    },
    {
        "key": "social_feeds",
        "emoji": "📡",
        "name": "social_feeds",
        "commands": [
            _help_cmd("feed add", "Add a social feed to monitor.", "`/feed add <platform> <url> <#channel>`", True),
            _help_cmd("feed remove", "Remove a social feed.", "`/feed remove <id>`", True),
            _help_cmd("feed list", "List configured social feeds.", "`/feed list`"),
        ],
    },
    {
        "key": "stats_channels",
        "emoji": "📈",
        "name": "stats_channels",
        "commands": [
            _help_cmd("stats-channel add", "Add a stats voice channel.", "`/stats-channel add <#channel> <type> [format]`", True),
            _help_cmd("stats-channel remove", "Remove a stats channel.", "`/stats-channel remove <id>`", True),
            _help_cmd("stats-channel list", "List configured stats channels.", "`/stats-channel list`"),
        ],
    },
    {
        "key": "ai_chat",
        "emoji": "🤖",
        "name": "ai_chat",
        "commands": [
            _help_cmd("ai ask", "Ask the AI assistant a question.", "`/ai ask <question>`"),
            _help_cmd("ai imagine", "Generate an image with AI.", "`/ai imagine <prompt>`"),
            _help_cmd("ai reset", "Reset your AI conversation history.", "`/ai reset`"),
            _help_cmd("ai status", "Check AI Chat status for this server.", "`/ai status`"),
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
            }, guild_id=ctx.guild_id)
        finally:
            session.close()
        await ctx.respond(embed=embed, view=HelpMenuView(is_admin))


def setup(bot: discord.Bot):
    bot.add_cog(HelpCog(bot))
