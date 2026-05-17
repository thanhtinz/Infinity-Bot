# src/bot/cogs/verification.py
"""Verification cog — OAuth2 verify embed, member pull, role snapshot, events."""
import asyncio
import datetime
import logging
import httpx
import discord
from discord.ext import commands, tasks
from sqlalchemy import select, func
from src.database.config import SessionLocal
from src.models.models import (
    SystemConfig, VerificationConfig, VerifiedMember, MemberPull,
)
from src.bot.embed_utils import build_embed
from src.bot.i18n import t

logger = logging.getLogger(__name__)


class VerifyButton(discord.ui.View):
    """Persistent "Verify" button on verification embed."""

    def __init__(self, guild_id: str, button_text: str = "Verify with Discord"):
        super().__init__(timeout=None)
        self.guild_id = guild_id
        self.btn = discord.ui.Button(
            label=button_text,
            style=discord.ButtonStyle.green,
            custom_id=f"verify_btn_{guild_id}",
            emoji="✅",
        )
        self.btn.callback = self.verify_callback
        self.add_item(self.btn)

    async def verify_callback(self, interaction: discord.Interaction):
        session = SessionLocal()
        try:
            sys_cfg = session.execute(select(SystemConfig).limit(1)).scalars().first()
            if not sys_cfg or not sys_cfg.public_app_url:
                await interaction.response.send_message(
                    "❌ Verification is not configured. Contact an admin.",
                    ephemeral=True,
                )
                return
            base_url = sys_cfg.public_app_url.rstrip("/")
            verify_url = f"{base_url}/verify/{self.guild_id}"
            await interaction.response.send_message(
                f"🔗 Click here to verify: {verify_url}",
                ephemeral=True,
            )
        finally:
            session.close()


class VerificationCog(commands.Cog):
    feature_key = "verification"

    def __init__(self, bot):
        self.bot = bot
        self._role_snapshot.start()
        self._process_pulls.start()
        # Register persistent views
        self._register_views()

    def _register_views(self):
        """Register persistent verify buttons for all guilds."""
        session = SessionLocal()
        try:
            configs = session.execute(
                select(VerificationConfig).where(VerificationConfig.enabled == True)
            ).scalars().all()
            for cfg in configs:
                view = VerifyButton(cfg.guild_id, cfg.button_text or "Verify with Discord")
                self.bot.add_view(view)
        finally:
            session.close()

    def cog_unload(self):
        self._role_snapshot.cancel()
        self._process_pulls.cancel()

    # ── Slash commands ──
    verify_group = discord.SlashCommandGroup("verify", "Verification commands")

    @verify_group.command(name="embed", description="Send verification embed to this channel")
    @commands.has_permissions(administrator=True)
    async def verify_embed(self, ctx: discord.ApplicationContext):
        session = SessionLocal()
        try:
            guild_id = str(ctx.guild.id)
            cfg = session.execute(
                select(VerificationConfig).where(VerificationConfig.guild_id == guild_id)
            ).scalars().first()
            if not cfg or not cfg.enabled:
                await ctx.respond("❌ Verification is not enabled. Enable it in the dashboard.", ephemeral=True)
                return

            embed = build_embed("verify_panel", session, vars={
                "server": ctx.guild.name,
                "server.name": ctx.guild.name,
            })
            # Override with config values if user hasn't customized via embed builder
            if cfg.page_title:
                embed.title = cfg.page_title
            if cfg.page_description:
                embed.description = cfg.page_description
            if cfg.page_color:
                try:
                    embed.color = discord.Color.from_str(cfg.page_color)
                except Exception:
                    pass
            if cfg.page_logo_url:
                embed.set_thumbnail(url=cfg.page_logo_url)

            view = VerifyButton(guild_id, cfg.button_text or "Verify with Discord")
            await ctx.channel.send(embed=embed, view=view)
            await ctx.respond("✅ Verification embed sent!", ephemeral=True)
        finally:
            session.close()

    @verify_group.command(name="usercount", description="Show verified member count")
    async def usercount(self, ctx: discord.ApplicationContext):
        session = SessionLocal()
        try:
            guild_id = str(ctx.guild.id)
            total = session.execute(
                select(func.count()).select_from(VerifiedMember)
                .where(VerifiedMember.guild_id == guild_id)
            ).scalar() or 0
            pullable = session.execute(
                select(func.count()).select_from(VerifiedMember)
                .where(
                    VerifiedMember.guild_id == guild_id,
                    VerifiedMember.is_blacklisted == False,
                    VerifiedMember.access_token.isnot(None),
                )
            ).scalar() or 0

            embed = discord.Embed(
                title="👥 Verified Members",
                color=discord.Color.blue(),
                description=(
                    f"✅ Total verified: **{total}**\n"
                    f"🔄 Pullable (with valid token): **{pullable}**"
                ),
            )
            await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()

    @verify_group.command(name="info", description="Get details on a verified member")
    @commands.has_permissions(moderate_members=True)
    async def verify_info(
        self,
        ctx: discord.ApplicationContext,
        member: discord.Option(discord.Member, description="Member to look up"),
    ):
        session = SessionLocal()
        try:
            vm = session.execute(
                select(VerifiedMember).where(
                    VerifiedMember.guild_id == str(ctx.guild.id),
                    VerifiedMember.discord_id == str(member.id),
                )
            ).scalars().first()
            if not vm:
                await ctx.respond("❌ Member not verified.", ephemeral=True)
                return

            embed = discord.Embed(
                title=f"🔍 {vm.username or member.name}",
                color=discord.Color.blue(),
            )
            embed.add_field(name="Discord ID", value=vm.discord_id, inline=True)
            embed.add_field(name="Email", value=vm.email or "N/A", inline=True)
            embed.add_field(name="IP", value=vm.ip_address or "N/A", inline=True)
            embed.add_field(
                name="Verified",
                value=vm.verified_at.strftime("%Y-%m-%d %H:%M") if vm.verified_at else "N/A",
                inline=True,
            )
            embed.add_field(name="Risk Score", value=str(vm.risk_score), inline=True)
            embed.add_field(
                name="Blacklisted",
                value="🚫 Yes" if vm.is_blacklisted else "✅ No",
                inline=True,
            )
            if vm.roles:
                role_mentions = ", ".join(f"<@&{r}>" for r in vm.roles[:10])
                embed.add_field(name="Saved Roles", value=role_mentions, inline=False)

            await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()

    # ── /pull command ──
    @discord.slash_command(name="pull", description="Pull verified members back into the server")
    @commands.has_permissions(administrator=True)
    async def pull_members(
        self,
        ctx: discord.ApplicationContext,
        restore_roles: discord.Option(bool, description="Restore saved roles?", default=True),
        delay: discord.Option(int, description="Delay between joins (seconds)", default=1, min_value=1, max_value=30),
    ):
        session = SessionLocal()
        try:
            guild_id = str(ctx.guild.id)
            # Check for active pull
            active = session.execute(
                select(MemberPull).where(
                    MemberPull.guild_id == guild_id,
                    MemberPull.status.in_(["pending", "in_progress"]),
                )
            ).scalars().first()
            if active:
                await ctx.respond("❌ A pull is already in progress.", ephemeral=True)
                return

            pullable = session.execute(
                select(func.count()).select_from(VerifiedMember)
                .where(
                    VerifiedMember.guild_id == guild_id,
                    VerifiedMember.is_blacklisted == False,
                    VerifiedMember.access_token.isnot(None),
                )
            ).scalar() or 0

            if pullable == 0:
                await ctx.respond("❌ No pullable members found.", ephemeral=True)
                return

            pull = MemberPull(
                guild_id=guild_id,
                status="pending",
                total_members=pullable,
                restore_roles=restore_roles,
                join_delay_seconds=delay,
            )
            session.add(pull)
            session.commit()

            await ctx.respond(
                f"🔄 Pull started! Pulling **{pullable}** members with {delay}s delay.\n"
                f"Restore roles: {'Yes' if restore_roles else 'No'}",
            )
        finally:
            session.close()

    # ── Blacklist / Whitelist ──
    @verify_group.command(name="blacklist", description="Blacklist a member from verification")
    @commands.has_permissions(administrator=True)
    async def blacklist_member(
        self,
        ctx: discord.ApplicationContext,
        member: discord.Option(discord.Member, description="Member to blacklist"),
        reason: discord.Option(str, description="Reason for blacklist", required=False, default="No reason"),
    ):
        session = SessionLocal()
        try:
            guild_id = str(ctx.guild.id)
            vm = session.execute(
                select(VerifiedMember).where(
                    VerifiedMember.guild_id == guild_id,
                    VerifiedMember.discord_id == str(member.id),
                )
            ).scalars().first()
            if not vm:
                # Create a blacklist record even if not verified
                vm = VerifiedMember(
                    guild_id=guild_id,
                    discord_id=str(member.id),
                    username=str(member),
                    is_blacklisted=True,
                    risk_score=100,
                )
                session.add(vm)
            else:
                vm.is_blacklisted = True

            session.commit()

            # Remove verified role if configured
            cfg = session.execute(
                select(VerificationConfig).where(VerificationConfig.guild_id == guild_id)
            ).scalars().first()
            if cfg and cfg.verified_role_id:
                role = ctx.guild.get_role(int(cfg.verified_role_id))
                if role and role in member.roles:
                    try:
                        await member.remove_roles(role, reason=f"Blacklisted: {reason}")
                    except Exception:
                        pass

            embed = build_embed("verify_blacklist", session, vars={
                "user": str(member), "user.mention": member.mention,
                "user.id": str(member.id), "reason": reason,
                "mod": str(ctx.author), "mod.mention": ctx.author.mention,
            })
            await ctx.respond(embed=embed)
        finally:
            session.close()

    @verify_group.command(name="whitelist", description="Remove a member from the blacklist")
    @commands.has_permissions(administrator=True)
    async def whitelist_member(
        self,
        ctx: discord.ApplicationContext,
        member: discord.Option(discord.Member, description="Member to whitelist"),
    ):
        session = SessionLocal()
        try:
            guild_id = str(ctx.guild.id)
            vm = session.execute(
                select(VerifiedMember).where(
                    VerifiedMember.guild_id == guild_id,
                    VerifiedMember.discord_id == str(member.id),
                )
            ).scalars().first()
            if not vm or not vm.is_blacklisted:
                await ctx.respond("❌ Member is not blacklisted.", ephemeral=True)
                return

            vm.is_blacklisted = False
            session.commit()

            embed = build_embed("verify_whitelist", session, vars={
                "user": str(member), "user.mention": member.mention,
                "user.id": str(member.id),
                "mod": str(ctx.author), "mod.mention": ctx.author.mention,
            })
            await ctx.respond(embed=embed)
        finally:
            session.close()

    # ── /delunauthed ──
    @discord.slash_command(name="delunauthed", description="Kick all unverified members from the server")
    @commands.has_permissions(administrator=True)
    async def del_unauthed(
        self,
        ctx: discord.ApplicationContext,
        dry_run: discord.Option(bool, description="Preview only (don't actually kick)?", default=True),
    ):
        await ctx.defer()
        session = SessionLocal()
        try:
            guild_id = str(ctx.guild.id)
            cfg = session.execute(
                select(VerificationConfig).where(VerificationConfig.guild_id == guild_id)
            ).scalars().first()
            if not cfg or not cfg.enabled:
                await ctx.followup.send("❌ Verification is not enabled.", ephemeral=True)
                return

            # Get all verified discord IDs for this guild
            verified_ids = set(
                row[0] for row in session.execute(
                    select(VerifiedMember.discord_id).where(
                        VerifiedMember.guild_id == guild_id,
                        VerifiedMember.is_blacklisted == False,
                    )
                ).all()
            )

            unverified = []
            for member in ctx.guild.members:
                if member.bot:
                    continue
                if str(member.id) not in verified_ids:
                    unverified.append(member)

            if not unverified:
                await ctx.followup.send("✅ All members are verified!")
                return

            if dry_run:
                preview = "\n".join(
                    f"• {m} (`{m.id}`)" for m in unverified[:25]
                )
                remaining = len(unverified) - 25
                embed = discord.Embed(
                    title="🔍 Unverified Members Preview",
                    color=discord.Color.orange(),
                    description=(
                        f"Found **{len(unverified)}** unverified members.\n\n"
                        f"{preview}"
                        f"{f'\n... and {remaining} more' if remaining > 0 else ''}\n\n"
                        f"Run `/delunauthed dry_run:False` to kick them."
                    ),
                )
                await ctx.followup.send(embed=embed)
                return

            # Actually kick
            kicked = 0
            failed = 0
            for member in unverified:
                try:
                    await member.kick(reason="Unverified member — /delunauthed")
                    kicked += 1
                except Exception:
                    failed += 1
                # Rate limit
                if kicked % 5 == 0:
                    await asyncio.sleep(1)

            embed = discord.Embed(
                title="🧹 Unverified Members Removed",
                color=discord.Color.green(),
                description=(
                    f"✅ Kicked: **{kicked}**\n"
                    f"❌ Failed: **{failed}**\n"
                    f"Total unverified: **{len(unverified)}**"
                ),
            )
            await ctx.followup.send(embed=embed)
        finally:
            session.close()

    # ── Events ──
    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member):
        """When a member leaves, update their last_seen and save current roles."""
        session = SessionLocal()
        try:
            vm = session.execute(
                select(VerifiedMember).where(
                    VerifiedMember.guild_id == str(member.guild.id),
                    VerifiedMember.discord_id == str(member.id),
                )
            ).scalars().first()
            if vm:
                vm.last_seen = datetime.datetime.utcnow()
                vm.roles = [str(r.id) for r in member.roles if not r.is_default()]
                session.commit()
        finally:
            session.close()

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        """When a verified member rejoins, auto-assign their verified role."""
        session = SessionLocal()
        try:
            guild_id = str(member.guild.id)
            cfg = session.execute(
                select(VerificationConfig).where(VerificationConfig.guild_id == guild_id)
            ).scalars().first()
            if not cfg or not cfg.enabled:
                return

            vm = session.execute(
                select(VerifiedMember).where(
                    VerifiedMember.guild_id == guild_id,
                    VerifiedMember.discord_id == str(member.id),
                )
            ).scalars().first()
            if vm and not vm.is_blacklisted:
                # Auto-assign verified role
                if cfg.verified_role_id:
                    role = member.guild.get_role(int(cfg.verified_role_id))
                    if role:
                        try:
                            await member.add_roles(role, reason="Verified member rejoined")
                        except Exception as e:
                            logger.error(f"Auto-role assign error: {e}")
                # Remove unverified role
                if cfg.unverified_role_id:
                    unv_role = member.guild.get_role(int(cfg.unverified_role_id))
                    if unv_role:
                        try:
                            await member.remove_roles(unv_role, reason="Verified member")
                        except Exception:
                            pass
        finally:
            session.close()

    # ── Periodic role snapshot ──
    @tasks.loop(hours=6)
    async def _role_snapshot(self):
        """Periodically save member roles to VerifiedMember records."""
        session = SessionLocal()
        try:
            configs = session.execute(
                select(VerificationConfig).where(VerificationConfig.enabled == True)
            ).scalars().all()

            for cfg in configs:
                guild = self.bot.get_guild(int(cfg.guild_id))
                if not guild:
                    continue
                members = session.execute(
                    select(VerifiedMember).where(VerifiedMember.guild_id == cfg.guild_id)
                ).scalars().all()
                for vm in members:
                    member = guild.get_member(int(vm.discord_id))
                    if member:
                        vm.roles = [str(r.id) for r in member.roles if not r.is_default()]
                        vm.last_seen = datetime.datetime.utcnow()
                session.commit()
        except Exception as e:
            logger.error(f"Role snapshot error: {e}", exc_info=True)
        finally:
            session.close()

    @_role_snapshot.before_loop
    async def _before_role_snapshot(self):
        await self.bot.wait_until_ready()

    # ── Process member pulls ──
    @tasks.loop(seconds=10)
    async def _process_pulls(self):
        """Process pending member pull operations."""
        session = SessionLocal()
        try:
            pull = session.execute(
                select(MemberPull).where(MemberPull.status == "pending")
            ).scalars().first()
            if not pull:
                return

            pull.status = "in_progress"
            pull.started_at = datetime.datetime.utcnow()
            session.commit()

            guild_id = pull.guild_id
            guild = self.bot.get_guild(int(guild_id))
            if not guild:
                pull.status = "failed"
                pull.error = "Guild not found"
                pull.completed_at = datetime.datetime.utcnow()
                session.commit()
                return

            # Get bot token
            sys_cfg = session.execute(select(SystemConfig).limit(1)).scalars().first()
            bot_token = sys_cfg.discord_token if sys_cfg else None
            if not bot_token:
                pull.status = "failed"
                pull.error = "Bot token not configured"
                pull.completed_at = datetime.datetime.utcnow()
                session.commit()
                return

            # Get pullable members
            members = session.execute(
                select(VerifiedMember).where(
                    VerifiedMember.guild_id == guild_id,
                    VerifiedMember.is_blacklisted == False,
                    VerifiedMember.access_token.isnot(None),
                )
            ).scalars().all()

            pull.total_members = len(members)
            pull_log = []

            async with httpx.AsyncClient() as client:
                for vm in members:
                    # Check if pull was stopped
                    session.refresh(pull)
                    if pull.status != "in_progress":
                        break

                    try:
                        # Try to add member using their OAuth2 token
                        join_data = {"access_token": vm.access_token}
                        if pull.restore_roles and vm.roles:
                            # Only include roles that still exist
                            valid_roles = [
                                r for r in vm.roles
                                if guild.get_role(int(r)) is not None
                            ]
                            if valid_roles:
                                join_data["roles"] = valid_roles

                        res = await client.put(
                            f"https://discord.com/api/guilds/{guild_id}/members/{vm.discord_id}",
                            json=join_data,
                            headers={"Authorization": f"Bot {bot_token}"},
                        )

                        if res.status_code in (200, 201):
                            pull.pulled_members += 1
                            pull_log.append({
                                "discord_id": vm.discord_id,
                                "username": vm.username,
                                "status": "success",
                                "timestamp": datetime.datetime.utcnow().isoformat(),
                            })
                        elif res.status_code == 204:
                            # Already in guild
                            pull.pulled_members += 1
                            # Restore roles if needed
                            if pull.restore_roles and vm.roles:
                                for role_id in vm.roles:
                                    role = guild.get_role(int(role_id))
                                    member = guild.get_member(int(vm.discord_id))
                                    if role and member:
                                        try:
                                            await member.add_roles(role)
                                        except Exception:
                                            pass
                            pull_log.append({
                                "discord_id": vm.discord_id,
                                "username": vm.username,
                                "status": "already_in_guild",
                                "timestamp": datetime.datetime.utcnow().isoformat(),
                            })
                        else:
                            pull.failed_members += 1
                            error_text = res.text[:200] if res.text else str(res.status_code)
                            pull_log.append({
                                "discord_id": vm.discord_id,
                                "username": vm.username,
                                "status": "failed",
                                "error": error_text,
                                "timestamp": datetime.datetime.utcnow().isoformat(),
                            })
                    except Exception as e:
                        pull.failed_members += 1
                        pull_log.append({
                            "discord_id": vm.discord_id,
                            "username": vm.username,
                            "status": "error",
                            "error": str(e)[:200],
                            "timestamp": datetime.datetime.utcnow().isoformat(),
                        })

                    pull.log = pull_log
                    session.commit()

                    # Rate limit delay
                    await asyncio.sleep(pull.join_delay_seconds)

            pull.status = "completed"
            pull.completed_at = datetime.datetime.utcnow()
            pull.log = pull_log
            session.commit()

        except Exception as e:
            logger.error(f"Pull processing error: {e}", exc_info=True)
            try:
                if pull:
                    pull.status = "failed"
                    pull.error = str(e)[:500]
                    pull.completed_at = datetime.datetime.utcnow()
                    session.commit()
            except Exception:
                pass
        finally:
            session.close()

    @_process_pulls.before_loop
    async def _before_process_pulls(self):
        await self.bot.wait_until_ready()


def setup(bot):
    bot.add_cog(VerificationCog(bot))
