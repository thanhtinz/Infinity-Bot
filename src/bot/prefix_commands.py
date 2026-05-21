"""Prefix bridge for user-facing commands.

Admin/staff commands intentionally stay slash-only. This listener only maps public
member commands to the exismessagesg slash command handlers.
"""
from __future__ import annotations

import shlex
from dataclasses import dataclass
import discord
from sqlalchemy import select

from src.database.config import SessionLocal
from src.models.models import SystemConfig
from src.bot.feature_utils import feature_enabled


def get_session():
    return SessionLocal()


def get_prefix(guild_id: str | None = None) -> str:
    session = get_session()
    try:
        cfg = None
        if guild_id:
            cfg = session.execute(
                select(SystemConfig).where(SystemConfig.guild_id == guild_id)
            ).scalars().first()
        if not cfg:
            cfg = session.execute(select(SystemConfig).limit(1)).scalars().first()
        return (cfg.command_prefix if cfg and cfg.command_prefix else "!")
    finally:
        session.close()


class _PrefixFollowup:
    def __init__(self, ctx: "PrefixContext"):
        self.ctx = ctx

    async def send(self, *args, ephemeral: bool = False, **kwargs):
        return await self.ctx.respond(*args, ephemeral=ephemeral, **kwargs)


class _PrefixResponse:
    def __init__(self, message: discord.Message):
        self._message = message

    async def original_response(self):
        return self._message


@dataclass
class PrefixContext:
    message: discord.Message
    bot: discord.Bot
    prefix: str

    def __post_init__(self):
        self.author = self.message.author
        self.user = self.message.author
        self.guild = self.message.guild
        self.guild_id = self.message.guild.id if self.message.guild else None
        self.channel = self.message.channel
        self.followup = _PrefixFollowup(self)
        self.command = None

    async def defer(self, *_, **__):
        return None

    async def respond(self, *args, ephemeral: bool = False, delete_after: float | None = None, **kwargs):
        if ephemeral and delete_after is None:
            delete_after = 30
        msg = await self.channel.send(*args, delete_after=delete_after, **kwargs)
        return _PrefixResponse(msg)

    async def send(self, *args, **kwargs):
        return await self.channel.send(*args, **kwargs)


def _parse_args(content: str) -> list[str]:
    try:
        return shlex.split(content)
    except ValueError:
        return content.split()


def _find_member(ctx: PrefixContext, token: str | None) -> discord.Member | None:
    if not token or not ctx.guild:
        return None
    if ctx.message.mentions:
        return ctx.message.mentions[0]
    raw = token.strip().strip("<@!>")
    if raw.isdigit():
        member = ctx.guild.get_member(int(raw))
        if member:
            return member
    q = token.lower()
    for member in ctx.guild.members:
        if q in member.display_name.lower() or q in str(member).lower():
            return member
    return None


def _find_text_channel(ctx: PrefixContext, token: str | None) -> discord.TextChannel | None:
    if not token or not ctx.guild:
        return None
    if ctx.message.channel_mentions:
        ch = ctx.message.channel_mentions[0]
        return ch if isinstance(ch, discord.TextChannel) else None
    raw = token.strip().strip("<#>")
    if raw.isdigit():
        ch = ctx.guild.get_channel(int(raw))
        return ch if isinstance(ch, discord.TextChannel) else None
    q = token.lower().lstrip("#")
    for ch in ctx.guild.text_channels:
        if ch.name.lower() == q:
            return ch
    return None


def _positive_int(value: str | None, default: int | None = None) -> int | None:
    if value is None:
        return default
    try:
        return max(0, int(value))
    except Exception:
        return default


class PrefixCommandsCog(discord.Cog):
    """Public prefix command bridge. Admin/staff commands are not registered here."""

    def __init__(self, bot: discord.Bot):
        self.bot = bot

    @discord.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot or not message.guild or not message.content:
            return

        prefix = get_prefix(guild_id=str(message.guild.id))
        content = message.content.strip()
        if not content.startswith(prefix):
            return

        rest = content[len(prefix):].strip()
        if not rest:
            return
        parts = _parse_args(rest)
        if not parts:
            return

        cmd = parts[0].lower()
        args = parts[1:]
        ctx = PrefixContext(message=message, bot=self.bot, prefix=prefix)

        handled = await self._dispatch(ctx, cmd, args)
        if handled:
            try:
                await message.add_reaction("✅")
            except Exception:
                pass

    async def _guard(self, ctx: PrefixContext, feature: str) -> bool:
        if feature_enabled(feature):
            return True
        await ctx.respond("❌ This feature has been disabled.", delete_after=10)
        return False

    def _cog(self, name: str):
        return self.bot.get_cog(name)

    async def _dispatch(self, ctx: PrefixContext, cmd: str, args: list[str]) -> bool:
        # Shop/user account commands
        if cmd in {"help", "support", "orders", "feedback", "bxh"}:
            if not await self._guard(ctx, "shop"):
                return True
            cog = self._cog("ShopCog")
            if not cog:
                return False
            if cmd == "help":
                await cog.help_cmd(ctx)
            elif cmd == "support":
                await cog.support_cmd(ctx)
            elif cmd == "orders":
                await cog.orders_cmd(ctx, id=_positive_int(args[0], None) if args else None)
            elif cmd == "feedback":
                await cog.feedback_cmd(ctx)
            elif cmd == "bxh":
                loai = args[0] if args and args[0] in {"chi_tieu", "don_hang"} else "chi_tieu"
                thoi_gian = args[1] if len(args) > 1 and args[1] in {"daily", "7days", "30days", "all"} else "all"
                await cog.bxh_cmd(ctx, loai=loai, thoi_gian=thoi_gian)
            return True

        if cmd in {"status", "san_pham", "account"}:
            if not await self._guard(ctx, "shop"):
                return True
            callback = getattr(self.bot, f"_prefix_{cmd}", None)
            if callback:
                await callback(ctx)
                return True

        # Utility commands
        if cmd in {"avatar", "banner", "serverinfo", "userinfo", "poll", "qr"}:
            if not await self._guard(ctx, "utility"):
                return True
            cog = self._cog("UtilityCog")
            if not cog:
                return False
            member = _find_member(ctx, args[0] if args else None)
            if cmd == "avatar":
                await cog.avatar_cmd(ctx, user=member)
            elif cmd == "banner":
                await cog.banner_cmd(ctx, user=member)
            elif cmd == "serverinfo":
                await cog.serverinfo_cmd(ctx)
            elif cmd == "userinfo":
                await cog.userinfo_cmd(ctx, user=member)
            elif cmd == "qr":
                if not args:
                    await ctx.respond(f"Usage: `{ctx.prefix}qr <text/url>`", delete_after=10)
                else:
                    await cog.qr_cmd(ctx, text=" ".join(args))
            elif cmd == "poll":
                if len(args) < 3:
                    await ctx.respond(f"Usage: `{ctx.prefix}poll \"Question\" \"Option 1\" \"Option 2\" ...`", delete_after=12)
                else:
                    await cog.poll_cmd(ctx, args[0], args[1], args[2], *(args[3:7] + [None] * 4)[:4])
            return True

        # AFK
        if cmd == "afk":
            if not await self._guard(ctx, "utility"):
                return True
            cog = self._cog("AFKCog")
            if cog:
                await cog.afk_cmd(ctx, reason=" ".join(args) if args else "AFK")
                return True

        # Giveaways: public list only. Admin giveaway actions remain slash-only.
        if cmd in {"giveaway_list", "giveaways"}:
            if not await self._guard(ctx, "giveaway"):
                return True
            cog = self._cog("GiveawayCog")
            if cog:
                await cog.list_cmd(ctx)
                return True

        # Invite tracking public commands: !invites me|info|leaderboard and aliases.
        if cmd in {"invites", "invite"}:
            if not await self._guard(ctx, "invite_tracking"):
                return True
            cog = self._cog("InviteTrackingCog")
            if not cog:
                return False
            sub = args[0].lower() if args else "me"
            if sub == "me":
                await cog.invites_me(ctx)
            elif sub == "info":
                await cog.invites_info(ctx, member=_find_member(ctx, args[1] if len(args) > 1 else None) or ctx.author)
            elif sub in {"leaderboard", "top", "lb"}:
                await cog.invites_leaderboard(ctx)
            else:
                await ctx.respond(f"Usage: `{ctx.prefix}invites me|info @user|leaderboard`", delete_after=12)
            return True

        return False
