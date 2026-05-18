# src/bot/cogs/moderation_ext.py
"""Extended moderation commands — builds on ModerationCog with cases, notes, timed mods, etc."""
import discord
import datetime
import logging
from discord import SlashCommandGroup
from sqlalchemy import select, func, delete
from src.database.config import SessionLocal
from src.models.models import (
    ModerationCase, ModerationNote, RolePersist, TempRole,
    ModerationConfig, Warning, StarboardEntry,
)
from src.bot.embed_utils import build_embed
from src.bot.i18n import t

logger = logging.getLogger(__name__)


def _session():
    return SessionLocal()


def _parse_duration(text: str) -> int | None:
    """Parse '1h', '30m', '7d', '1d12h' → seconds. Returns None on failure."""
    import re
    total = 0
    parts = re.findall(r'(\d+)\s*([smhdw])', text.lower())
    if not parts:
        return None
    units = {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}
    for val, unit in parts:
        total += int(val) * units.get(unit, 0)
    return total if total > 0 else None


def _format_duration(seconds: int) -> str:
    parts = []
    for label, div in [("d", 86400), ("h", 3600), ("m", 60), ("s", 1)]:
        if seconds >= div:
            n = seconds // div
            seconds %= div
            parts.append(f"{n}{label}")
    return " ".join(parts) or "0s"


def _next_case_number(session, guild_id: str) -> int:
    result = session.execute(
        select(func.coalesce(func.max(ModerationCase.case_number), 0))
        .where(ModerationCase.guild_id == guild_id)
    ).scalar()
    return (result or 0) + 1


def _create_case(session, guild_id, action, target, moderator, reason=None, duration=None, role_id=None):
    cn = _next_case_number(session, guild_id)
    expires = None
    if duration:
        expires = datetime.datetime.utcnow() + datetime.timedelta(seconds=duration)
    case = ModerationCase(
        guild_id=guild_id, case_number=cn, action=action,
        target_id=str(target.id), target_name=str(target),
        moderator_id=str(moderator.id), moderator_name=str(moderator),
        reason=reason, duration=duration, expires_at=expires,
        active=bool(duration), role_id=role_id,
    )
    session.add(case)
    session.commit()
    return case


class ModerationExtCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    # ── /clean ────────────────────────────────────────────────────────────────
    @discord.slash_command(name="clean", description="[Mod] Clean up bot responses")
    @discord.default_permissions(manage_messages=True)
    async def clean_cmd(
        self, ctx: discord.ApplicationContext,
        amount: discord.Option(int, "Number of messages to scan", required=False, default=50, min_value=1, max_value=200),
    ):
        await ctx.defer(ephemeral=True)
        gid = str(ctx.guild.id)
        deleted = await ctx.channel.purge(limit=amount, check=lambda m: m.author.bot)
        await ctx.respond(t(gid, "mod_clean_done", count=len(deleted)), ephemeral=True)

    # ── /mute ─────────────────────────────────────────────────────────────────
    @discord.slash_command(name="mute", description="[Mod] Timeout a member")
    @discord.default_permissions(moderate_members=True)
    async def mute_cmd(
        self, ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member to mute"),
        duration: discord.Option(str, "Duration (e.g. 1h, 30m, 7d)", required=True),
        reason: discord.Option(str, "Reason", required=False, default="No reason"),
    ):
        gid = str(ctx.guild.id)
        secs = _parse_duration(duration)
        if not secs:
            await ctx.respond("❌ Invalid duration. Use e.g. `1h`, `30m`, `7d`.", ephemeral=True)
            return
        if secs > 28 * 86400:
            secs = 28 * 86400  # Discord max timeout
        try:
            await user.timeout_for(datetime.timedelta(seconds=secs), reason=reason)
        except discord.Forbidden:
            await ctx.respond("❌ Missing permissions.", ephemeral=True)
            return
        session = _session()
        try:
            case = _create_case(session, gid, "mute", user, ctx.author, reason, secs)
            embed = build_embed("timeout", session, vars={
                "user": str(user), "user.mention": user.mention, "user.id": str(user.id),
                "duration": _format_duration(secs), "reason": reason,
                "mod": ctx.author.mention, "moderator": ctx.author.mention, "server": ctx.guild.name,
            }, guild_id=str(ctx.guild.id))
            await ctx.respond(embed=embed)
        finally:
            session.close()

    # ── /deafen & /undeafen ───────────────────────────────────────────────────
    @discord.slash_command(name="deafen", description="[Mod] Deafen a member in voice")
    @discord.default_permissions(deafen_members=True)
    async def deafen_cmd(
        self, ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member to deafen"),
        reason: discord.Option(str, "Reason", required=False, default="No reason"),
    ):
        gid = str(ctx.guild.id)
        if not user.voice:
            await ctx.respond("❌ User is not in a voice channel.", ephemeral=True)
            return
        try:
            await user.edit(deafen=True, reason=reason)
        except discord.Forbidden:
            await ctx.respond("❌ Missing permissions.", ephemeral=True)
            return
        session = _session()
        try:
            _create_case(session, gid, "deafen", user, ctx.author, reason)
        finally:
            session.close()
        await ctx.respond(t(gid, "mod_deafened", user=user.mention, reason_text=reason))

    @discord.slash_command(name="undeafen", description="[Mod] Undeafen a member in voice")
    @discord.default_permissions(deafen_members=True)
    async def undeafen_cmd(
        self, ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member to undeafen"),
    ):
        gid = str(ctx.guild.id)
        if not user.voice:
            await ctx.respond("❌ User is not in a voice channel.", ephemeral=True)
            return
        try:
            await user.edit(deafen=False)
        except discord.Forbidden:
            await ctx.respond("❌ Missing permissions.", ephemeral=True)
            return
        session = _session()
        try:
            _create_case(session, gid, "undeafen", user, ctx.author)
        finally:
            session.close()
        await ctx.respond(t(gid, "mod_undeafened", user=user.mention))

    # ── /members ──────────────────────────────────────────────────────────────
    @discord.slash_command(name="members", description="[Mod] List members in a role (max 90)")
    @discord.default_permissions(manage_roles=True)
    async def members_cmd(
        self, ctx: discord.ApplicationContext,
        role: discord.Option(discord.Role, "Role to check"),
    ):
        gid = str(ctx.guild.id)
        mems = role.members[:90]
        if not mems:
            await ctx.respond(f"No members with role **{role.name}**.", ephemeral=True)
            return
        lines = [f"{m.mention} (`{m.id}`)" for m in mems]
        desc = "\n".join(lines)
        if len(desc) > 4000:
            desc = desc[:4000] + "\n…"
        embed = discord.Embed(
            title=t(gid, "mod_members_title", role=role.name),
            description=desc,
            color=role.color or discord.Color.blurple(),
        )
        embed.set_footer(text=f"Total: {len(role.members)}")
        await ctx.respond(embed=embed, ephemeral=True)

    # ── /softban ──────────────────────────────────────────────────────────────
    @discord.slash_command(name="softban", description="[Mod] Softban a member (ban + unban to delete messages)")
    @discord.default_permissions(ban_members=True)
    async def softban_cmd(
        self, ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member to softban"),
        reason: discord.Option(str, "Reason", required=False, default="No reason"),
    ):
        gid = str(ctx.guild.id)
        try:
            await user.ban(reason=f"Softban: {reason}", delete_message_days=7)
            await ctx.guild.unban(user, reason="Softban unban")
        except discord.Forbidden:
            await ctx.respond("❌ Missing permissions.", ephemeral=True)
            return
        session = _session()
        try:
            case = _create_case(session, gid, "softban", user, ctx.author, reason)
            embed = build_embed("kick", session, vars={
                "user": str(user), "user.mention": user.mention, "user.id": str(user.id),
                "reason": reason, "mod": ctx.author.mention, "mod.name": str(ctx.author),
                "moderator": ctx.author.mention, "server": ctx.guild.name,
            }, guild_id=str(ctx.guild.id))
            embed.title = "🔨 Softbanned"
            await ctx.respond(embed=embed)
        finally:
            session.close()

    # ── /rolepersist ──────────────────────────────────────────────────────────
    @discord.slash_command(name="rolepersist", description="[Mod] Toggle a persistent role for a member")
    @discord.default_permissions(manage_roles=True)
    async def rolepersist_cmd(
        self, ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member"),
        role: discord.Option(discord.Role, "Role to persist"),
    ):
        gid = str(ctx.guild.id)
        session = _session()
        try:
            existing = session.execute(
                select(RolePersist).where(
                    RolePersist.guild_id == gid,
                    RolePersist.target_id == str(user.id),
                    RolePersist.role_id == str(role.id),
                )
            ).scalars().first()
            if existing:
                session.delete(existing)
                session.commit()
                await ctx.respond(t(gid, "mod_rolepersist_remove", role=role.name, user=str(user)))
            else:
                rp = RolePersist(guild_id=gid, target_id=str(user.id), role_id=str(role.id), assigned_by=str(ctx.author.id))
                session.add(rp)
                session.commit()
                if role not in user.roles:
                    try:
                        await user.add_roles(role, reason="Role persist")
                    except discord.Forbidden:
                        pass
                _create_case(session, gid, "rolepersist", user, ctx.author, role_id=str(role.id))
                await ctx.respond(t(gid, "mod_rolepersist_add", role=role.name, user=str(user)))
        finally:
            session.close()

    # ── /temprole ─────────────────────────────────────────────────────────────
    @discord.slash_command(name="temprole", description="[Mod] Assign a temporary role")
    @discord.default_permissions(manage_roles=True)
    async def temprole_cmd(
        self, ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member"),
        role: discord.Option(discord.Role, "Role"),
        duration: discord.Option(str, "Duration (e.g. 1h, 7d)", required=True),
    ):
        gid = str(ctx.guild.id)
        secs = _parse_duration(duration)
        if not secs:
            await ctx.respond("❌ Invalid duration.", ephemeral=True)
            return
        session = _session()
        try:
            tr = TempRole(
                guild_id=gid, target_id=str(user.id), role_id=str(role.id),
                assigned_by=str(ctx.author.id),
                expires_at=datetime.datetime.utcnow() + datetime.timedelta(seconds=secs),
            )
            session.add(tr)
            session.commit()
            try:
                await user.add_roles(role, reason=f"Temp role ({_format_duration(secs)})")
            except discord.Forbidden:
                pass
            _create_case(session, gid, "temprole", user, ctx.author, duration=secs, role_id=str(role.id))
        finally:
            session.close()
        await ctx.respond(t(gid, "mod_temprole_add", role=role.name, user=str(user), duration=_format_duration(secs)))

    # ── /note, /notes, /delnote, /clearnotes, /editnote ──────────────────────
    @discord.slash_command(name="note", description="[Mod] Add a note about a member")
    @discord.default_permissions(manage_messages=True)
    async def note_cmd(
        self, ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member"),
        content: discord.Option(str, "Note content"),
    ):
        gid = str(ctx.guild.id)
        session = _session()
        try:
            n = ModerationNote(guild_id=gid, target_id=str(user.id), author_id=str(ctx.author.id), content=content)
            session.add(n)
            session.commit()
            session.refresh(n)
            await ctx.respond(t(gid, "mod_note_added", note_id=n.id, user=user.mention), ephemeral=True)
        finally:
            session.close()

    @discord.slash_command(name="notes", description="[Mod] View notes for a member")
    @discord.default_permissions(manage_messages=True)
    async def notes_cmd(
        self, ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member"),
    ):
        gid = str(ctx.guild.id)
        session = _session()
        try:
            rows = session.execute(
                select(ModerationNote)
                .where(ModerationNote.guild_id == gid, ModerationNote.target_id == str(user.id))
                .order_by(ModerationNote.created_at.desc())
            ).scalars().all()
            if not rows:
                await ctx.respond(t(gid, "mod_notes_empty"), ephemeral=True)
                return
            embed = discord.Embed(title=f"📝 Notes — {user.display_name}", color=discord.Color.blurple())
            for n in rows[:15]:
                date = n.created_at.strftime("%d/%m/%Y") if n.created_at else "—"
                embed.add_field(name=f"#{n.id} — {date} (by <@{n.author_id}>)", value=n.content[:200], inline=False)
            embed.set_footer(text=f"Total: {len(rows)}")
            await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()

    @discord.slash_command(name="delnote", description="[Mod] Delete a note")
    @discord.default_permissions(manage_messages=True)
    async def delnote_cmd(
        self, ctx: discord.ApplicationContext,
        note_id: discord.Option(int, "Note ID"),
    ):
        gid = str(ctx.guild.id)
        session = _session()
        try:
            n = session.execute(
                select(ModerationNote).where(ModerationNote.id == note_id, ModerationNote.guild_id == gid)
            ).scalars().first()
            if not n:
                await ctx.respond("❌ Note not found.", ephemeral=True)
                return
            session.delete(n)
            session.commit()
            await ctx.respond(t(gid, "mod_note_deleted", note_id=note_id), ephemeral=True)
        finally:
            session.close()

    @discord.slash_command(name="editnote", description="[Mod] Edit a note")
    @discord.default_permissions(manage_messages=True)
    async def editnote_cmd(
        self, ctx: discord.ApplicationContext,
        note_id: discord.Option(int, "Note ID"),
        content: discord.Option(str, "New content"),
    ):
        gid = str(ctx.guild.id)
        session = _session()
        try:
            n = session.execute(
                select(ModerationNote).where(ModerationNote.id == note_id, ModerationNote.guild_id == gid)
            ).scalars().first()
            if not n:
                await ctx.respond("❌ Note not found.", ephemeral=True)
                return
            n.content = content
            session.commit()
            await ctx.respond(t(gid, "mod_note_edited", note_id=note_id), ephemeral=True)
        finally:
            session.close()

    @discord.slash_command(name="clearnotes", description="[Mod] Delete all notes for a member")
    @discord.default_permissions(manage_messages=True)
    async def clearnotes_cmd(
        self, ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member"),
    ):
        gid = str(ctx.guild.id)
        session = _session()
        try:
            rows = session.execute(
                select(ModerationNote)
                .where(ModerationNote.guild_id == gid, ModerationNote.target_id == str(user.id))
            ).scalars().all()
            count = len(rows)
            for r in rows:
                session.delete(r)
            session.commit()
            await ctx.respond(t(gid, "mod_notes_cleared", count=count, user=user.mention), ephemeral=True)
        finally:
            session.close()

    # ── /delwarn ──────────────────────────────────────────────────────────────
    @discord.slash_command(name="delwarn", description="[Mod] Delete a warning by ID")
    @discord.default_permissions(manage_messages=True)
    async def delwarn_cmd(
        self, ctx: discord.ApplicationContext,
        warn_id: discord.Option(int, "Warning ID"),
    ):
        gid = str(ctx.guild.id)
        session = _session()
        try:
            w = session.execute(
                select(Warning).where(Warning.id == warn_id, Warning.guild_id == gid)
            ).scalars().first()
            if not w:
                await ctx.respond("❌ Warning not found.", ephemeral=True)
                return
            session.delete(w)
            session.commit()
            await ctx.respond(t(gid, "mod_warn_deleted", warn_id=warn_id), ephemeral=True)
        finally:
            session.close()

    # ── /reason ───────────────────────────────────────────────────────────────
    @discord.slash_command(name="reason", description="[Mod] Update the reason for a mod case")
    @discord.default_permissions(manage_messages=True)
    async def reason_cmd(
        self, ctx: discord.ApplicationContext,
        case_number: discord.Option(int, "Case number"),
        reason: discord.Option(str, "New reason"),
    ):
        gid = str(ctx.guild.id)
        session = _session()
        try:
            c = session.execute(
                select(ModerationCase).where(ModerationCase.guild_id == gid, ModerationCase.case_number == case_number)
            ).scalars().first()
            if not c:
                await ctx.respond("❌ Case not found.", ephemeral=True)
                return
            c.reason = reason
            session.commit()
            await ctx.respond(t(gid, "mod_reason_updated", case_number=case_number), ephemeral=True)
        finally:
            session.close()

    # ── /duration ─────────────────────────────────────────────────────────────
    @discord.slash_command(name="duration", description="[Mod] Change duration of a mute/ban case")
    @discord.default_permissions(moderate_members=True)
    async def duration_cmd(
        self, ctx: discord.ApplicationContext,
        case_number: discord.Option(int, "Case number"),
        new_duration: discord.Option(str, "New duration (e.g. 1h, 7d)"),
    ):
        gid = str(ctx.guild.id)
        secs = _parse_duration(new_duration)
        if not secs:
            await ctx.respond("❌ Invalid duration.", ephemeral=True)
            return
        session = _session()
        try:
            c = session.execute(
                select(ModerationCase).where(ModerationCase.guild_id == gid, ModerationCase.case_number == case_number)
            ).scalars().first()
            if not c:
                await ctx.respond("❌ Case not found.", ephemeral=True)
                return
            c.duration = secs
            c.expires_at = c.created_at + datetime.timedelta(seconds=secs)
            session.commit()
            # Try to update Discord timeout if it's a mute
            if c.action == "mute":
                try:
                    member = ctx.guild.get_member(int(c.target_id))
                    if member:
                        await member.timeout_for(datetime.timedelta(seconds=secs), reason="Duration updated")
                except Exception:
                    pass
            await ctx.respond(t(gid, "mod_duration_changed", case_number=case_number, duration=_format_duration(secs)))
        finally:
            session.close()

    # ── /case ─────────────────────────────────────────────────────────────────
    @discord.slash_command(name="case", description="[Mod] Show a single mod log case")
    @discord.default_permissions(manage_messages=True)
    async def case_cmd(
        self, ctx: discord.ApplicationContext,
        case_number: discord.Option(int, "Case number"),
    ):
        gid = str(ctx.guild.id)
        session = _session()
        try:
            c = session.execute(
                select(ModerationCase).where(ModerationCase.guild_id == gid, ModerationCase.case_number == case_number)
            ).scalars().first()
            if not c:
                await ctx.respond("❌ Case not found.", ephemeral=True)
                return
            embed = discord.Embed(
                title=t(gid, "mod_case_title", case_number=c.case_number),
                color=discord.Color.orange(),
            )
            embed.add_field(name="Action", value=c.action.upper(), inline=True)
            embed.add_field(name="Target", value=f"<@{c.target_id}> ({c.target_name})", inline=True)
            embed.add_field(name="Moderator", value=f"<@{c.moderator_id}>", inline=True)
            embed.add_field(name="Reason", value=c.reason or "—", inline=False)
            if c.duration:
                embed.add_field(name="Duration", value=_format_duration(c.duration), inline=True)
            if c.expires_at:
                embed.add_field(name="Expires", value=f"<t:{int(c.expires_at.timestamp())}:R>", inline=True)
            embed.timestamp = c.created_at
            await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()

    # ── /modlogs ──────────────────────────────────────────────────────────────
    @discord.slash_command(name="modlogs", description="[Mod] View mod log history for a user")
    @discord.default_permissions(manage_messages=True)
    async def modlogs_cmd(
        self, ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member"),
    ):
        gid = str(ctx.guild.id)
        session = _session()
        try:
            cases = session.execute(
                select(ModerationCase)
                .where(ModerationCase.guild_id == gid, ModerationCase.target_id == str(user.id))
                .order_by(ModerationCase.created_at.desc())
                .limit(15)
            ).scalars().all()
            if not cases:
                await ctx.respond(t(gid, "mod_modlogs_empty"), ephemeral=True)
                return
            embed = discord.Embed(title=t(gid, "mod_modlogs_title", user=str(user)), color=discord.Color.orange())
            for c in cases:
                date = c.created_at.strftime("%d/%m/%Y") if c.created_at else "—"
                dur = f" ({_format_duration(c.duration)})" if c.duration else ""
                embed.add_field(
                    name=f"#{c.case_number} — {c.action.upper()}{dur} — {date}",
                    value=f"**Reason:** {c.reason or '—'}\n**Mod:** <@{c.moderator_id}>",
                    inline=False,
                )
            await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()

    # ── /moderations (active timed) ───────────────────────────────────────────
    @discord.slash_command(name="moderations", description="[Mod] View active timed moderations")
    @discord.default_permissions(manage_messages=True)
    async def moderations_cmd(self, ctx: discord.ApplicationContext):
        gid = str(ctx.guild.id)
        session = _session()
        try:
            now = datetime.datetime.utcnow()
            cases = session.execute(
                select(ModerationCase)
                .where(
                    ModerationCase.guild_id == gid,
                    ModerationCase.active == True,
                    ModerationCase.expires_at > now,
                )
                .order_by(ModerationCase.expires_at)
                .limit(20)
            ).scalars().all()
            if not cases:
                await ctx.respond(t(gid, "mod_active_empty"), ephemeral=True)
                return
            embed = discord.Embed(title=t(gid, "mod_active_title"), color=discord.Color.orange())
            for c in cases:
                embed.add_field(
                    name=f"#{c.case_number} — {c.action.upper()} — <@{c.target_id}>",
                    value=f"Expires <t:{int(c.expires_at.timestamp())}:R>\n{c.reason or '—'}",
                    inline=False,
                )
            await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()

    # ── /modstats ─────────────────────────────────────────────────────────────
    @discord.slash_command(name="modstats", description="[Mod] Get moderation statistics for a mod")
    @discord.default_permissions(manage_messages=True)
    async def modstats_cmd(
        self, ctx: discord.ApplicationContext,
        mod: discord.Option(discord.Member, "Moderator", required=False, default=None),
    ):
        target_mod = mod or ctx.author
        gid = str(ctx.guild.id)
        session = _session()
        try:
            cases = session.execute(
                select(ModerationCase)
                .where(ModerationCase.guild_id == gid, ModerationCase.moderator_id == str(target_mod.id))
            ).scalars().all()
            total = len(cases)
            by_action = {}
            for c in cases:
                by_action[c.action] = by_action.get(c.action, 0) + 1
            embed = discord.Embed(
                title=t(gid, "mod_modstats_title", mod=str(target_mod)),
                color=discord.Color.blurple(),
            )
            embed.add_field(name="Total Actions", value=str(total), inline=True)
            for action, count in sorted(by_action.items(), key=lambda x: -x[1]):
                embed.add_field(name=action.upper(), value=str(count), inline=True)
            await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()

    # ── /lockdown ─────────────────────────────────────────────────────────────
    @discord.slash_command(name="lockdown", description="[Admin] Lock/unlock channels defined in moderation settings")
    @discord.default_permissions(administrator=True)
    async def lockdown_cmd(
        self, ctx: discord.ApplicationContext,
        mode: discord.Option(str, "Mode", choices=["start", "end"], required=True),
    ):
        gid = str(ctx.guild.id)
        session = _session()
        try:
            cfg = session.execute(
                select(ModerationConfig).where(ModerationConfig.guild_id == gid)
            ).scalars().first()
            channel_ids = cfg.lockdown_channels if cfg else []
            if not channel_ids:
                await ctx.respond("❌ No lockdown channels configured. Set them in the dashboard.", ephemeral=True)
                return
        finally:
            session.close()
        count = 0
        overwrite_val = False if mode == "start" else None
        for cid in channel_ids:
            ch = ctx.guild.get_channel(int(cid))
            if ch:
                try:
                    await ch.set_permissions(ctx.guild.default_role, send_messages=overwrite_val, reason=f"Lockdown {mode}")
                    count += 1
                except Exception:
                    pass
        key = "mod_lockdown_start" if mode == "start" else "mod_lockdown_end"
        await ctx.respond(t(gid, key, count=count))

    # ── /star ─────────────────────────────────────────────────────────────────
    @discord.slash_command(name="star", description="[Mod] View starboard stats for a message")
    @discord.default_permissions(manage_messages=True)
    async def star_cmd(
        self, ctx: discord.ApplicationContext,
        message_id: discord.Option(str, "Message ID"),
    ):
        gid = str(ctx.guild.id)
        session = _session()
        try:
            entry = session.execute(
                select(StarboardEntry)
                .where(StarboardEntry.guild_id == gid, StarboardEntry.source_message_id == message_id)
            ).scalars().first()
            if not entry:
                await ctx.respond("❌ No starboard entry found for this message.", ephemeral=True)
                return
            embed = discord.Embed(title=t(gid, "mod_star_title"), color=discord.Color.gold())
            embed.add_field(name="Stars", value=str(entry.star_count), inline=True)
            embed.add_field(name="Author", value=f"<@{entry.author_id}>", inline=True)
            embed.add_field(name="Channel", value=f"<#{entry.source_channel_id}>", inline=True)
            await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()

    # ── /ignored ──────────────────────────────────────────────────────────────
    @discord.slash_command(name="ignored", description="[Mod] List ignored users, roles, and channels")
    @discord.default_permissions(manage_messages=True)
    async def ignored_cmd(self, ctx: discord.ApplicationContext):
        gid = str(ctx.guild.id)
        session = _session()
        try:
            cfg = session.execute(
                select(ModerationConfig).where(ModerationConfig.guild_id == gid)
            ).scalars().first()
            if not cfg:
                await ctx.respond("No moderation config found. Configure in the dashboard.", ephemeral=True)
                return
            embed = discord.Embed(title=t(gid, "mod_ignored_title"), color=discord.Color.greyple())
            users_str = ", ".join(f"<@{u}>" for u in (cfg.ignored_users or [])) or "None"
            roles_str = ", ".join(f"<@&{r}>" for r in (cfg.ignored_roles or [])) or "None"
            channels_str = ", ".join(f"<#{c}>" for c in (cfg.ignored_channels or [])) or "None"
            embed.add_field(name="Users", value=users_str, inline=False)
            embed.add_field(name="Roles", value=roles_str, inline=False)
            embed.add_field(name="Channels", value=channels_str, inline=False)
            await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()

    # ── /diagnose ─────────────────────────────────────────────────────────────
    @discord.slash_command(name="diagnose", description="[Admin] Diagnose bot permissions and module status")
    @discord.default_permissions(administrator=True)
    async def diagnose_cmd(
        self, ctx: discord.ApplicationContext,
        target: discord.Option(str, "Command or module name (e.g. 'ban', 'ticket')", required=False, default="bot"),
    ):
        gid = str(ctx.guild.id)
        bot_member = ctx.guild.me
        perms = bot_member.guild_permissions
        issues = []
        # Check key permissions
        perm_checks = {
            "ban_members": perms.ban_members,
            "kick_members": perms.kick_members,
            "manage_messages": perms.manage_messages,
            "manage_roles": perms.manage_roles,
            "manage_channels": perms.manage_channels,
            "moderate_members": perms.moderate_members,
            "send_messages": perms.send_messages,
            "embed_links": perms.embed_links,
            "read_message_history": perms.read_message_history,
            "view_channel": perms.view_channel,
        }
        missing = [k for k, v in perm_checks.items() if not v]
        # Check cogs loaded
        loaded_cogs = [type(c).__name__ for c in self.bot.cogs.values()]

        embed = discord.Embed(title=t(gid, "mod_diagnose_title", target=target), color=discord.Color.blurple())
        embed.add_field(name="Bot Permissions OK", value=str(len(perm_checks) - len(missing)), inline=True)
        embed.add_field(name="Missing Permissions", value=", ".join(missing) if missing else "✅ None", inline=True)
        embed.add_field(name="Loaded Cogs", value=str(len(loaded_cogs)), inline=True)
        embed.add_field(name="Latency", value=f"{self.bot.latency * 1000:.0f}ms", inline=True)
        embed.add_field(name="Guilds", value=str(len(self.bot.guilds)), inline=True)
        if issues:
            embed.add_field(name="⚠️ Issues", value="\n".join(issues), inline=False)
        await ctx.respond(embed=embed, ephemeral=True)

    # ── Event: re-apply persisted roles on member join ────────────────────────
    @discord.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        session = _session()
        try:
            persisted = session.execute(
                select(RolePersist).where(
                    RolePersist.guild_id == str(member.guild.id),
                    RolePersist.target_id == str(member.id),
                )
            ).scalars().all()
            for rp in persisted:
                role = member.guild.get_role(int(rp.role_id))
                if role:
                    try:
                        await member.add_roles(role, reason="Role persist — rejoin")
                    except discord.Forbidden:
                        pass
        except Exception as e:
            logger.warning(f"RolePersist on_member_join error: {e}")
        finally:
            session.close()


def setup(bot: discord.Bot):
    bot.add_cog(ModerationExtCog(bot))
