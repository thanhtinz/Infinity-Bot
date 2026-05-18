# src/bot/cogs/moderation.py
import discord
import datetime
import logging
from sqlalchemy import select
from src.database.config import SessionLocal
import asyncio
from src.models.models import Warning, FirewallRule
from src.bot.embed_utils import build_embed

logger = logging.getLogger(__name__)


def get_session():
    return SessionLocal()


class ModerationCog(discord.Cog):
    def __init__(self, bot):
        self.bot = bot

    @discord.slash_command(name="ban", description="[Admin] Ban a member")
    @discord.default_permissions(ban_members=True)
    async def ban_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member to ban"),
        reason: discord.Option(str, "Reason", required=False, default="No reason"),
        delete_messages: discord.Option(int, "Delete message days", required=False, default=0, min_value=0, max_value=7),
    ):
        try:
            await user.ban(reason=reason, delete_message_days=delete_messages)
            session = get_session()
            try:
                embed = build_embed("ban", session, vars={
                    "user": str(user), "user.mention": user.mention, "user.id": str(user.id),
                    "reason": reason, "mod": ctx.author.mention, "mod.name": str(ctx.author),
                    "moderator": ctx.author.mention, "server": ctx.guild.name,
                })
                await ctx.respond(embed=embed)
            finally:
                session.close()
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks permission to ban this member.", ephemeral=True)

    @discord.slash_command(name="unban", description="[Admin] Unban a member")
    @discord.default_permissions(ban_members=True)
    async def unban_cmd(
        self,
        ctx: discord.ApplicationContext,
        user_id: discord.Option(str, "Discord ID of the user to unban"),
        reason: discord.Option(str, "Reason", required=False, default="No reason"),
    ):
        try:
            user = await self.bot.fetch_user(int(user_id))
            await ctx.guild.unban(user, reason=reason)
            session = get_session()
            try:
                embed = build_embed("unban", session, vars={
                    "user": str(user), "user.mention": user.mention, "user.id": str(user.id),
                    "reason": reason, "moderator": ctx.author.mention, "server": ctx.guild.name,
                })
                await ctx.respond(embed=embed)
            finally:
                session.close()
        except discord.NotFound:
            await ctx.respond("❌ Could not find this user in the ban list.", ephemeral=True)
        except Exception as e:
            await ctx.respond(f"❌ Error: {e}", ephemeral=True)

    @discord.slash_command(name="kick", description="[Admin] Kick a member")
    @discord.default_permissions(kick_members=True)
    async def kick_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member to kick"),
        reason: discord.Option(str, "Reason", required=False, default="No reason"),
    ):
        try:
            await user.kick(reason=reason)
            session = get_session()
            try:
                embed = build_embed("kick", session, vars={
                    "user": str(user), "user.mention": user.mention, "user.id": str(user.id),
                    "reason": reason, "mod": ctx.author.mention, "mod.name": str(ctx.author),
                    "moderator": ctx.author.mention, "server": ctx.guild.name,
                })
                await ctx.respond(embed=embed)
            finally:
                session.close()
        except discord.Forbidden:
            await ctx.respond("❌ Bot lacks permission to kick this member.", ephemeral=True)

    @discord.slash_command(name="warn", description="[Admin] Warn a member")
    @discord.default_permissions(manage_messages=True)
    async def warn_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member to warn"),
        reason: discord.Option(str, "Reason"),
    ):
        session = get_session()
        try:
            warning = Warning(
                discord_id=str(user.id),
                guild_id=str(ctx.guild.id),
                reason=reason,
                moderator_id=str(ctx.author.id),
            )
            session.add(warning)
            session.commit()

            count = len(session.execute(
                select(Warning).where(
                    Warning.discord_id == str(user.id),
                    Warning.guild_id == str(ctx.guild.id),
                )
            ).scalars().all())

            # Channel embed
            embed = build_embed("canh_bao", session, vars={
                "user": str(user), "user.mention": user.mention, "user.id": str(user.id),
                "reason": reason, "warn_count": str(count),
                "mod": ctx.author.mention, "moderator": ctx.author.mention, "server": ctx.guild.name,
            })
            await ctx.respond(embed=embed)

            # DM user using embed template from DB
            try:
                dm_embed = build_embed("canh_bao", session, vars={
                    "user": str(user),
                    "user.mention": user.mention,
                    "user.id": str(user.id),
                    "reason": reason,
                    "warn_count": str(count),
                    "server": ctx.guild.name,
                })
                await user.send(embed=dm_embed)
            except Exception:
                pass
        finally:
            session.close()

    @discord.slash_command(name="unwarn", description="[Admin] Remove a warning")
    @discord.default_permissions(manage_messages=True)
    async def unwarn_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member"),
        warn_id: discord.Option(int, "Warning ID (see /warnings)"),
    ):
        session = get_session()
        try:
            w = session.execute(
                select(Warning).where(Warning.id == warn_id, Warning.discord_id == str(user.id))
            ).scalars().first()
            if not w:
                await ctx.respond("❌ Warning not found.", ephemeral=True)
                return
            session.delete(w)
            session.commit()
            await ctx.respond(f"✅ Deleted warning #{warn_id} of {user.mention}.", ephemeral=True)
        finally:
            session.close()

    @discord.slash_command(name="warnings", description="[Admin] View warning history")
    @discord.default_permissions(manage_messages=True)
    async def warnings_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member", required=False, default=None),
    ):
        target = user or ctx.author

        session = get_session()
        try:
            warns = session.execute(
                select(Warning).where(
                    Warning.discord_id == str(target.id),
                    Warning.guild_id == str(ctx.guild.id),
                ).order_by(Warning.created_at.desc())
            ).scalars().all()

            if not warns:
                await ctx.respond(f"✅ {target.mention} has no warnings.", ephemeral=True)
                return

            embed = discord.Embed(title=f"⚠️ Warnings for {target.display_name}", color=discord.Color.yellow())
            for w in warns[:10]:
                mod_mention = f"<@{w.moderator_id}>" if w.moderator_id else "Unknown"
                embed.add_field(
                    name=f"#{w.id} — {w.created_at.strftime('%d/%m/%Y') if w.created_at else '—'}",
                    value=f"**Reason:** {w.reason or '—'}\n**Mod:** {mod_mention}",
                    inline=False,
                )
            embed.set_footer(text=f"Total: {len(warns)} warnings")
            await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()

    # ── Massrole ──────────────────────────────────────────────

    @discord.slash_command(name="massrole", description="[Admin] Add a role to all members")
    @discord.default_permissions(manage_roles=True)
    async def massrole_cmd(
        self,
        ctx: discord.ApplicationContext,
        role: discord.Option(discord.Role, "Role to add"),
    ):
        if role >= ctx.guild.me.top_role:
            return await ctx.respond("❌ That role is higher than or equal to the bot's top role.", ephemeral=True)
        if role >= ctx.author.top_role and ctx.author != ctx.guild.owner:
            return await ctx.respond("❌ That role is higher than or equal to your top role.", ephemeral=True)

        members = [m for m in ctx.guild.members if role not in m.roles and not m.bot]
        if not members:
            return await ctx.respond(f"✅ All members already have **{role.name}**.", ephemeral=True)

        # Confirmation
        confirm_embed = discord.Embed(
            title="⚠️ Confirm Massrole",
            description=f"This will add **{role.name}** to **{len(members)}** members.\nReact ✅ to confirm or ❌ to cancel.",
            color=discord.Color.orange(),
        )
        msg = await ctx.respond(embed=confirm_embed)
        msg = await msg.original_response()
        await msg.add_reaction("✅")
        await msg.add_reaction("❌")

        def check(reaction, user):
            return user == ctx.author and str(reaction.emoji) in ("✅", "❌") and reaction.message.id == msg.id

        try:
            reaction, _ = await self.bot.wait_for("reaction_add", timeout=30, check=check)
        except asyncio.TimeoutError:
            return await msg.edit(embed=discord.Embed(title="⏰ Timed out", color=discord.Color.greyple()))

        if str(reaction.emoji) == "❌":
            return await msg.edit(embed=discord.Embed(title="❌ Cancelled", color=discord.Color.red()))

        await msg.edit(embed=discord.Embed(
            title="⏳ Processing...",
            description=f"Adding **{role.name}** to {len(members)} members...",
            color=discord.Color.blue(),
        ))

        success, failed = 0, 0
        for m in members:
            try:
                await m.add_roles(role, reason=f"Massrole by {ctx.author}")
                success += 1
            except Exception:
                failed += 1
            if success % 10 == 0:
                await asyncio.sleep(1)  # rate limit

        result = discord.Embed(
            title="✅ Massrole Complete",
            description=f"**{role.name}** added to **{success}** members." + (f"\n⚠️ Failed: {failed}" if failed else ""),
            color=discord.Color.green(),
        )
        await msg.edit(embed=result)

    # ── Unrole ────────────────────────────────────────────────

    @discord.slash_command(name="unrole", description="[Admin] Remove a role from all members")
    @discord.default_permissions(manage_roles=True)
    async def unrole_cmd(
        self,
        ctx: discord.ApplicationContext,
        role: discord.Option(discord.Role, "Role to remove"),
    ):
        if role >= ctx.guild.me.top_role:
            return await ctx.respond("❌ That role is higher than or equal to the bot's top role.", ephemeral=True)
        if role >= ctx.author.top_role and ctx.author != ctx.guild.owner:
            return await ctx.respond("❌ That role is higher than or equal to your top role.", ephemeral=True)

        members = [m for m in ctx.guild.members if role in m.roles and not m.bot]
        if not members:
            return await ctx.respond(f"✅ No members have **{role.name}**.", ephemeral=True)

        confirm_embed = discord.Embed(
            title="⚠️ Confirm Unrole",
            description=f"This will remove **{role.name}** from **{len(members)}** members.\nReact ✅ to confirm or ❌ to cancel.",
            color=discord.Color.orange(),
        )
        msg = await ctx.respond(embed=confirm_embed)
        msg = await msg.original_response()
        await msg.add_reaction("✅")
        await msg.add_reaction("❌")

        def check(reaction, user):
            return user == ctx.author and str(reaction.emoji) in ("✅", "❌") and reaction.message.id == msg.id

        try:
            reaction, _ = await self.bot.wait_for("reaction_add", timeout=30, check=check)
        except asyncio.TimeoutError:
            return await msg.edit(embed=discord.Embed(title="⏰ Timed out", color=discord.Color.greyple()))

        if str(reaction.emoji) == "❌":
            return await msg.edit(embed=discord.Embed(title="❌ Cancelled", color=discord.Color.red()))

        await msg.edit(embed=discord.Embed(
            title="⏳ Processing...",
            description=f"Removing **{role.name}** from {len(members)} members...",
            color=discord.Color.blue(),
        ))

        success, failed = 0, 0
        for m in members:
            try:
                await m.remove_roles(role, reason=f"Unrole by {ctx.author}")
                success += 1
            except Exception:
                failed += 1
            if success % 10 == 0:
                await asyncio.sleep(1)

        result = discord.Embed(
            title="✅ Unrole Complete",
            description=f"**{role.name}** removed from **{success}** members." + (f"\n⚠️ Failed: {failed}" if failed else ""),
            color=discord.Color.green(),
        )
        await msg.edit(embed=result)

    # ── Deluser ───────────────────────────────────────────────

    @discord.slash_command(name="deluser", description="[Admin] Kick + purge messages + blacklist a user")
    @discord.default_permissions(ban_members=True)
    async def deluser_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Member to remove"),
        reason: discord.Option(str, "Reason", required=False, default="No reason"),
        purge_days: discord.Option(int, "Purge messages (days, 0-7)", required=False, default=1, min_value=0, max_value=7),
    ):
        if user == ctx.author:
            return await ctx.respond("❌ You cannot deluser yourself.", ephemeral=True)
        if user == ctx.guild.me:
            return await ctx.respond("❌ You cannot deluser the bot.", ephemeral=True)
        if user.top_role >= ctx.guild.me.top_role:
            return await ctx.respond("❌ That user's role is too high for the bot to action.", ephemeral=True)

        confirm_embed = discord.Embed(
            title="⚠️ Confirm Deluser",
            description=(
                f"**Target:** {user.mention} (`{user.id}`)\n"
                f"**Actions:** Kick + purge {purge_days}d messages + blacklist\n"
                f"**Reason:** {reason}\n\n"
                "React ✅ to confirm or ❌ to cancel."
            ),
            color=discord.Color.red(),
        )
        msg = await ctx.respond(embed=confirm_embed)
        msg = await msg.original_response()
        await msg.add_reaction("✅")
        await msg.add_reaction("❌")

        def check(reaction, u):
            return u == ctx.author and str(reaction.emoji) in ("✅", "❌") and reaction.message.id == msg.id

        try:
            reaction, _ = await self.bot.wait_for("reaction_add", timeout=30, check=check)
        except asyncio.TimeoutError:
            return await msg.edit(embed=discord.Embed(title="⏰ Timed out", color=discord.Color.greyple()))

        if str(reaction.emoji) == "❌":
            return await msg.edit(embed=discord.Embed(title="❌ Cancelled", color=discord.Color.red()))

        actions_done = []

        # 1) Purge messages
        if purge_days > 0:
            cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=purge_days)
            purged = 0
            for channel in ctx.guild.text_channels:
                try:
                    deleted = await channel.purge(limit=100, check=lambda m: m.author.id == user.id, after=cutoff)
                    purged += len(deleted)
                except Exception:
                    pass
            actions_done.append(f"Purged **{purged}** messages")

        # 2) Kick
        try:
            await user.kick(reason=f"Deluser by {ctx.author}: {reason}")
            actions_done.append("Kicked")
        except discord.Forbidden:
            actions_done.append("⚠️ Kick failed (no permission)")

        # 3) Blacklist via FirewallRule
        session = get_session()
        try:
            rule = FirewallRule(
                guild_id=str(ctx.guild.id),
                rule_type="block",
                target_type="user_id",
                target_value=str(user.id),
                reason=f"Deluser: {reason}",
                created_by=str(ctx.author.id),
            )
            session.add(rule)
            session.commit()
            actions_done.append("Blacklisted")
        except Exception as e:
            logger.error(f"Deluser blacklist error: {e}")
            actions_done.append("⚠️ Blacklist failed")
        finally:
            session.close()

        result = discord.Embed(
            title="✅ Deluser Complete",
            description=f"**User:** {user} (`{user.id}`)\n**Reason:** {reason}\n\n" + "\n".join(f"• {a}" for a in actions_done),
            color=discord.Color.dark_red(),
        )
        result.set_footer(text=f"By {ctx.author}")
        await msg.edit(embed=result)
