# src/bot/cogs/autorole.py
"""AutoRole system — automatically assign roles on join, delay, or bot join."""
import discord
import asyncio
import datetime
import logging
from sqlalchemy import select, delete
from src.database.config import SessionLocal
from src.models.models import AutoRole
from src.bot.embed_utils import build_embed
from src.bot.base_cog import check_feature

logger = logging.getLogger(__name__)


def get_session():
    return SessionLocal()


class AutoRoleCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    # ── Listener: on_member_join ──

    @discord.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        if not check_feature(self):
            return
        if member.guild is None:
            return

        session = get_session()
        try:
            auto_roles = session.execute(
                select(AutoRole).where(
                    AutoRole.guild_id == str(member.guild.id),
                    AutoRole.enabled == True,
                )
            ).scalars().all()

            for ar in auto_roles:
                role = member.guild.get_role(int(ar.role_id))
                if not role:
                    logger.warning(f"AutoRole {ar.id}: role {ar.role_id} not found in guild {member.guild.id}")
                    continue

                if ar.trigger == "join":
                    try:
                        await member.add_roles(role, reason="AutoRole on join")
                    except discord.Forbidden:
                        logger.warning(f"No permission to add role {role.name} to {member}")
                    except Exception as e:
                        logger.error(f"AutoRole join error: {e}")

                elif ar.trigger == "delay" and ar.delay_seconds:
                    delay = ar.delay_seconds

                    async def _delayed_add(m=member, r=role, d=delay):
                        await asyncio.sleep(d)
                        try:
                            await m.add_roles(r, reason="AutoRole after delay")
                        except discord.Forbidden:
                            logger.warning(f"No permission to add delayed role {r.name} to {m}")
                        except Exception as e:
                            logger.error(f"AutoRole delay error: {e}")

                    asyncio.create_task(_delayed_add())

                elif ar.trigger == "bot" and member.bot:
                    try:
                        await member.add_roles(role, reason="AutoRole for bots")
                    except discord.Forbidden:
                        logger.warning(f"No permission to add bot role {role.name} to {member}")
                    except Exception as e:
                        logger.error(f"AutoRole bot error: {e}")
        finally:
            session.close()

    # ── Slash commands ──

    autorole_group = discord.SlashCommandGroup("autorole", "Auto role management")

    @autorole_group.command(name="add", description="Add an auto role")
    @discord.default_permissions(manage_roles=True)
    async def autorole_add(
        self,
        ctx: discord.ApplicationContext,
        role: discord.Option(discord.Role, "Role to assign"),
        trigger: discord.Option(str, "Trigger type", choices=["join", "delay", "bot"]),
        delay_seconds: discord.Option(int, "Delay in seconds (only for delay trigger)", required=False, default=0),
    ):
        session = get_session()
        try:
            ar = AutoRole(
                guild_id=str(ctx.guild.id),
                role_id=str(role.id),
                trigger=trigger,
                delay_seconds=delay_seconds if trigger == "delay" else 0,
                enabled=True,
            )
            session.add(ar)
            session.commit()
            session.refresh(ar)

            embed = build_embed("autorole_add", session, vars={
                "id": str(ar.id),
                "role": role.name,
                "role.mention": role.mention,
                "trigger": trigger,
                "delay": str(delay_seconds) if trigger == "delay" else "N/A",
            }, guild_id=str(ctx.guild.id))
            await ctx.respond(embed=embed, ephemeral=True)
        except Exception as e:
            logger.error(f"autorole_add error: {e}")
            await ctx.respond(f"Failed to add auto role: {e}", ephemeral=True)
        finally:
            session.close()

    @autorole_group.command(name="remove", description="Remove an auto role by ID")
    @discord.default_permissions(manage_roles=True)
    async def autorole_remove(
        self,
        ctx: discord.ApplicationContext,
        id: discord.Option(int, "Auto role ID to remove"),
    ):
        session = get_session()
        try:
            ar = session.get(AutoRole, id)
            if not ar or ar.guild_id != str(ctx.guild.id):
                await ctx.respond("Auto role not found.", ephemeral=True)
                return

            session.delete(ar)
            session.commit()
            await ctx.respond(f"Removed auto role #{id}.", ephemeral=True)
        except Exception as e:
            logger.error(f"autorole_remove error: {e}")
            await ctx.respond(f"Failed to remove auto role: {e}", ephemeral=True)
        finally:
            session.close()

    @autorole_group.command(name="list", description="List all configured auto roles")
    async def autorole_list(self, ctx: discord.ApplicationContext):
        session = get_session()
        try:
            auto_roles = session.execute(
                select(AutoRole).where(AutoRole.guild_id == str(ctx.guild.id))
            ).scalars().all()

            if not auto_roles:
                await ctx.respond("No auto roles configured.", ephemeral=True)
                return

            lines = []
            for ar in auto_roles:
                role = ctx.guild.get_role(int(ar.role_id))
                role_name = role.mention if role else f"Unknown ({ar.role_id})"
                status = "enabled" if ar.enabled else "disabled"
                delay_text = f" ({ar.delay_seconds}s)" if ar.trigger == "delay" else ""
                lines.append(f"**#{ar.id}** | {role_name} | trigger: {ar.trigger}{delay_text} | {status}")

            embed = discord.Embed(
                title="Auto Roles",
                description="\n".join(lines),
                color=0x5865F2,
                timestamp=datetime.datetime.utcnow(),
            )
            await ctx.respond(embed=embed, ephemeral=True)
        except Exception as e:
            logger.error(f"autorole_list error: {e}")
            await ctx.respond(f"Failed to list auto roles: {e}", ephemeral=True)
        finally:
            session.close()


def setup(bot: discord.Bot):
    bot.add_cog(AutoRoleCog(bot))
