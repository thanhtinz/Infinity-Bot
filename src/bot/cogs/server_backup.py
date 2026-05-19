# src/bot/cogs/server_backup.py
"""Server Backup cog — full Discord structure snapshot + bot config."""
import datetime
import json
import logging
import discord
from discord.ext import commands, tasks
from sqlalchemy import select, func
from src.database.config import SessionLocal
from src.models.models import (
    ServerBackup, BackupSchedule, SystemConfig,
    AutoModConfig, StarboardConfig, ReactionRole,
    CustomCommand, ScheduledMessage, StickyMessage, EmbedTemplate,
    ButtonRole, SelectMenuRole,
    LoggingConfig,
    ModerationConfig, FeatureToggle,
    Product, Coupon,
)
from src.bot.embed_utils import build_embed
from src.bot.i18n import t

logger = logging.getLogger(__name__)

EXCLUDE_FIELDS = {"id", "_sa_instance_state"}

BOT_CONFIG_TABLES = [
    ("automod_config", AutoModConfig),
    ("starboard_config", StarboardConfig),
    ("reaction_roles", ReactionRole),
    ("custom_commands", CustomCommand),
    ("scheduled_messages", ScheduledMessage),
    ("sticky_messages", StickyMessage),
    ("embed_templates", EmbedTemplate),
    ("button_roles", ButtonRole),
    ("select_menu_roles", SelectMenuRole),
    ("logging_config", LoggingConfig),
    ("moderation_config", ModerationConfig),
    ("feature_toggles", FeatureToggle),
    ("products", Product),
    ("coupons", Coupon),
]


def _row_to_dict(row) -> dict:
    d = {}
    for c in row.__table__.columns:
        if c.name in EXCLUDE_FIELDS:
            continue
        v = getattr(row, c.name)
        if isinstance(v, (datetime.datetime, datetime.date)):
            v = v.isoformat()
        d[c.name] = v
    return d


def _serialize_permissions(overwrites: dict) -> list:
    """Serialize channel permission overwrites."""
    result = []
    for target, overwrite in overwrites.items():
        allow, deny = overwrite.pair()
        result.append({
            "id": str(target.id),
            "type": "role" if isinstance(target, discord.Role) else "member",
            "allow": allow.value,
            "deny": deny.value,
        })
    return result


def _snapshot_discord(guild: discord.Guild) -> dict:
    """Snapshot Discord guild structure."""
    # Roles (exclude @everyone)
    roles = []
    for r in sorted(guild.roles, key=lambda r: r.position):
        if r.is_default():
            continue
        roles.append({
            "id": str(r.id),
            "name": r.name,
            "color": r.color.value,
            "hoist": r.hoist,
            "position": r.position,
            "permissions": r.permissions.value,
            "mentionable": r.mentionable,
            "icon": str(r.icon) if r.icon else None,
        })

    # Channels
    channels = []
    for ch in guild.channels:
        ch_data = {
            "id": str(ch.id),
            "name": ch.name,
            "type": str(ch.type),
            "position": ch.position,
            "category_id": str(ch.category_id) if ch.category_id else None,
            "overwrites": _serialize_permissions(ch.overwrites),
        }
        if isinstance(ch, discord.TextChannel):
            ch_data["topic"] = ch.topic
            ch_data["nsfw"] = ch.nsfw
            ch_data["slowmode_delay"] = ch.slowmode_delay
        elif isinstance(ch, discord.VoiceChannel):
            ch_data["bitrate"] = ch.bitrate
            ch_data["user_limit"] = ch.user_limit
        elif isinstance(ch, discord.ForumChannel):
            ch_data["topic"] = ch.topic
            ch_data["nsfw"] = ch.nsfw
            ch_data["default_auto_archive_duration"] = ch.default_auto_archive_duration
        channels.append(ch_data)

    # Emojis
    emojis = [
        {"id": str(e.id), "name": e.name, "animated": e.animated, "url": str(e.url)}
        for e in guild.emojis
    ]

    # Guild settings
    settings = {
        "name": guild.name,
        "icon": str(guild.icon) if guild.icon else None,
        "banner": str(guild.banner) if guild.banner else None,
        "description": guild.description,
        "verification_level": str(guild.verification_level),
        "default_notifications": str(guild.default_notifications),
        "explicit_content_filter": str(guild.explicit_content_filter),
        "afk_channel_id": str(guild.afk_channel.id) if guild.afk_channel else None,
        "afk_timeout": guild.afk_timeout,
        "system_channel_id": str(guild.system_channel.id) if guild.system_channel else None,
    }

    return {
        "roles": roles,
        "channels": channels,
        "emojis": emojis,
        "settings": settings,
    }


async def _snapshot_messages(guild: discord.Guild, limit: int = 100) -> dict:
    """Snapshot recent messages from text channels."""
    messages = {}
    for ch in guild.text_channels:
        try:
            ch_msgs = []
            async for msg in ch.history(limit=limit):
                ch_msgs.append({
                    "author_id": str(msg.author.id),
                    "author_name": str(msg.author),
                    "content": msg.content,
                    "embeds": [e.to_dict() for e in msg.embeds],
                    "attachments": [a.url for a in msg.attachments],
                    "created_at": msg.created_at.isoformat(),
                    "pinned": msg.pinned,
                })
            if ch_msgs:
                messages[str(ch.id)] = {
                    "channel_name": ch.name,
                    "messages": ch_msgs,
                }
        except (discord.Forbidden, discord.HTTPException):
            continue
    return messages


async def _restore_discord(guild: discord.Guild, discord_data: dict, ctx=None):
    """Restore Discord guild structure from backup. DESTRUCTIVE — deletes existing."""
    log_lines = []

    def log(msg):
        log_lines.append(msg)
        logger.info(msg)

    # 1. Restore roles (bottom-up)
    log("Restoring roles...")
    role_map = {}  # old_id → new_role
    for r_data in sorted(discord_data.get("roles", []), key=lambda r: r.get("position", 0)):
        try:
            new_role = await guild.create_role(
                name=r_data["name"],
                color=discord.Color(r_data.get("color", 0)),
                hoist=r_data.get("hoist", False),
                mentionable=r_data.get("mentionable", False),
                permissions=discord.Permissions(r_data.get("permissions", 0)),
            )
            role_map[r_data["id"]] = new_role
            log(f"  ✓ Role: {r_data['name']}")
        except Exception as e:
            log(f"  ✗ Role {r_data['name']}: {e}")

    # 2. Delete existing channels (except system)
    log("Deleting existing channels...")
    for ch in guild.channels:
        try:
            await ch.delete(reason="Backup restore")
        except Exception:
            pass

    # 3. Restore channels
    log("Restoring channels...")
    category_map = {}  # old_id → new_category
    # Create categories first
    for ch_data in sorted(discord_data.get("channels", []), key=lambda c: c.get("position", 0)):
        if ch_data.get("type") == "ChannelType.category":
            try:
                cat = await guild.create_category(
                    name=ch_data["name"],
                    position=ch_data.get("position", 0),
                )
                category_map[ch_data["id"]] = cat
                log(f"  ✓ Category: {ch_data['name']}")
            except Exception as e:
                log(f"  ✗ Category {ch_data['name']}: {e}")

    # Then create channels
    for ch_data in sorted(discord_data.get("channels", []), key=lambda c: c.get("position", 0)):
        ch_type = ch_data.get("type", "")
        if "category" in ch_type.lower():
            continue
        try:
            category = category_map.get(ch_data.get("category_id"))
            # Build permission overwrites
            overwrites = {}
            for ow in ch_data.get("overwrites", []):
                target = role_map.get(ow["id"]) or guild.get_member(int(ow["id"]))
                if target:
                    overwrites[target] = discord.PermissionOverwrite.from_pair(
                        discord.Permissions(ow["allow"]),
                        discord.Permissions(ow["deny"]),
                    )

            if "voice" in ch_type.lower():
                await guild.create_voice_channel(
                    name=ch_data["name"],
                    category=category,
                    position=ch_data.get("position", 0),
                    bitrate=ch_data.get("bitrate", 64000),
                    user_limit=ch_data.get("user_limit", 0),
                    overwrites=overwrites,
                )
            elif "forum" in ch_type.lower():
                await guild.create_forum(
                    name=ch_data["name"],
                    category=category,
                    position=ch_data.get("position", 0),
                    topic=ch_data.get("topic"),
                    overwrites=overwrites,
                )
            else:
                await guild.create_text_channel(
                    name=ch_data["name"],
                    category=category,
                    position=ch_data.get("position", 0),
                    topic=ch_data.get("topic"),
                    nsfw=ch_data.get("nsfw", False),
                    slowmode_delay=ch_data.get("slowmode_delay", 0),
                    overwrites=overwrites,
                )
            log(f"  ✓ Channel: {ch_data['name']}")
        except Exception as e:
            log(f"  ✗ Channel {ch_data['name']}: {e}")

    return log_lines


class ServerBackupCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self._scheduled_backup.start()

    def cog_unload(self):
        self._scheduled_backup.cancel()

    def _get_guild(self):
        session = SessionLocal()
        try:
            cfg = session.execute(select(SystemConfig).limit(1)).scalars().first()
            if cfg and cfg.guild_id:
                return self.bot.get_guild(int(cfg.guild_id))
        finally:
            session.close()
        if self.bot.guilds:
            return self.bot.guilds[0]
        return None

    # ── /backup command ──
    backup_group = discord.SlashCommandGroup("backup", "Server backup & restore")

    @backup_group.command(name="create", description="Create a full server backup")
    @commands.has_permissions(administrator=True)
    async def backup_create(self, ctx: discord.ApplicationContext):
        await ctx.defer()
        guild = ctx.guild
        session = SessionLocal()
        try:
            guild_id = str(guild.id)

            # Snapshot Discord structure
            discord_data = _snapshot_discord(guild)

            # Snapshot messages (limited)
            msg_data = await _snapshot_messages(guild, limit=50)

            # Snapshot bot config
            bot_config = {}
            config_count = 0
            for table_name, model in BOT_CONFIG_TABLES:
                try:
                    if hasattr(model, "guild_id"):
                        rows = session.execute(
                            select(model).where(model.guild_id == guild_id)
                        ).scalars().all()
                    else:
                        rows = session.execute(select(model)).scalars().all()
                    data = [_row_to_dict(r) for r in rows]
                    bot_config[table_name] = data
                    config_count += len(data)
                except Exception as e:
                    logger.warning(f"Backup skip {table_name}: {e}")
                    bot_config[table_name] = []

            # Build full backup
            full_data = {
                "discord": discord_data,
                "messages": msg_data,
                "bot_config": bot_config,
            }

            size_bytes = len(json.dumps(full_data, default=str).encode())
            msg_count = sum(len(ch.get("messages", [])) for ch in msg_data.values())

            backup = ServerBackup(
                guild_id=guild_id,
                backup_type="manual",
                status="completed",
                data=full_data,
                channel_count=len(discord_data.get("channels", [])),
                role_count=len(discord_data.get("roles", [])),
                member_count=0,
                config_count=config_count,
                message_count=msg_count,
                size_bytes=size_bytes,
            )
            session.add(backup)
            session.commit()

            embed = build_embed("backup_completed", session, vars={
                "backup_type": "manual",
                "channel_count": str(len(discord_data.get("channels", []))),
                "role_count": str(len(discord_data.get("roles", []))),
                "member_count": str(len(members_data)),
                "config_count": str(config_count),
            }, guild_id=str(guild.id))
            if not embed:
                embed = discord.Embed(
                    title="✅ Backup completed",
                    color=discord.Color.green(),
                    description=(
                        f"📁 Channels: **{len(discord_data.get('channels', []))}**\n"
                        f"🎭 Roles: **{len(discord_data.get('roles', []))}**\n"
                        f"👥 Verified members: **{len(members_data)}**\n"
                        f"⚙️ Bot configs: **{config_count}**\n"
                        f"💬 Messages: **{msg_count}**\n"
                        f"📦 Size: **{size_bytes // 1024} KB**"
                    ),
                )
            await ctx.respond(embed=embed)
        except Exception as e:
            logger.error(f"Backup error: {e}", exc_info=True)
            await ctx.respond(f"❌ Backup failed: {e}", ephemeral=True)
        finally:
            session.close()

    @backup_group.command(name="list", description="List recent backups")
    @commands.has_permissions(administrator=True)
    async def backup_list(self, ctx: discord.ApplicationContext):
        session = SessionLocal()
        try:
            backups = session.execute(
                select(ServerBackup)
                .where(ServerBackup.guild_id == str(ctx.guild.id))
                .order_by(ServerBackup.created_at.desc())
                .limit(10)
            ).scalars().all()

            if not backups:
                await ctx.respond("No backups found.", ephemeral=True)
                return

            lines = []
            for b in backups:
                date = b.created_at.strftime("%Y-%m-%d %H:%M") if b.created_at else "?"
                lines.append(
                    f"**#{b.id}** — {date} [{b.backup_type}] "
                    f"📁{b.channel_count} 🎭{b.role_count} 👥{b.member_count} ⚙️{b.config_count}"
                )

            embed = discord.Embed(
                title="📋 Server Backups",
                description="\n".join(lines),
                color=discord.Color.blue(),
            )
            await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()

    @backup_group.command(name="restore", description="Restore from a backup")
    @commands.has_permissions(administrator=True)
    async def backup_restore(
        self,
        ctx: discord.ApplicationContext,
        backup_id: discord.Option(int, description="Backup ID to restore"),
        restore_discord: discord.Option(bool, description="Restore channels/roles?", default=False),
        restore_config: discord.Option(bool, description="Restore bot config?", default=True),
    ):
        await ctx.defer()
        session = SessionLocal()
        try:
            backup = session.execute(
                select(ServerBackup).where(
                    ServerBackup.id == backup_id,
                    ServerBackup.guild_id == str(ctx.guild.id),
                )
            ).scalars().first()
            if not backup:
                await ctx.respond("❌ Backup not found.", ephemeral=True)
                return

            results = []

            # Restore Discord structure
            if restore_discord and backup.data and backup.data.get("discord"):
                log_lines = await _restore_discord(ctx.guild, backup.data["discord"], ctx)
                results.append(f"🏗️ Discord: {len(log_lines)} operations")

            # Restore bot config (delegated to API)
            if restore_config and backup.data and backup.data.get("bot_config"):
                from sqlalchemy import delete as sa_delete
                guild_id = str(ctx.guild.id)
                count = 0
                for table_name, model in BOT_CONFIG_TABLES:
                    if table_name not in backup.data["bot_config"]:
                        continue
                    rows_data = backup.data["bot_config"][table_name]
                    if not rows_data:
                        continue
                    try:
                        if hasattr(model, "guild_id"):
                            session.execute(sa_delete(model).where(model.guild_id == guild_id))
                        else:
                            session.execute(sa_delete(model))
                        session.flush()
                        valid_cols = {c.name for c in model.__table__.columns} - {"id"}
                        for row_dict in rows_data:
                            clean = {k: v for k, v in row_dict.items() if k in valid_cols}
                            session.add(model(**clean))
                            count += 1
                    except Exception as e:
                        logger.error(f"Restore {table_name}: {e}")
                results.append(f"⚙️ Bot config: {count} records")

            # (Verified members restore removed — model no longer exists)

            session.commit()
            embed = discord.Embed(
                title="✅ Restore completed",
                description="\n".join(results) or "Nothing restored",
                color=discord.Color.green(),
            )
            await ctx.respond(embed=embed)
        except Exception as e:
            logger.error(f"Restore error: {e}", exc_info=True)
            session.rollback()
            await ctx.respond(f"❌ Restore failed: {e}", ephemeral=True)
        finally:
            session.close()

    # ── Scheduled backup task ──
    @tasks.loop(minutes=30)
    async def _scheduled_backup(self):
        session = SessionLocal()
        try:
            schedules = session.execute(
                select(BackupSchedule).where(BackupSchedule.enabled == True)
            ).scalars().all()
            now = datetime.datetime.utcnow()

            for sched in schedules:
                if sched.next_backup_at and now < sched.next_backup_at:
                    continue

                guild = self.bot.get_guild(int(sched.guild_id))
                if not guild:
                    continue

                logger.info(f"Running scheduled backup for guild {sched.guild_id}")
                guild_id = sched.guild_id

                try:
                    # Build backup data
                    discord_data = _snapshot_discord(guild)
                    msg_data = {}
                    if sched.include_messages:
                        msg_data = await _snapshot_messages(guild, limit=sched.message_limit)

                    bot_config = {}
                    config_count = 0
                    if sched.include_bot_config:
                        for table_name, model in BOT_CONFIG_TABLES:
                            try:
                                if hasattr(model, "guild_id"):
                                    rows = session.execute(
                                        select(model).where(model.guild_id == guild_id)
                                    ).scalars().all()
                                else:
                                    rows = session.execute(select(model)).scalars().all()
                                data = [_row_to_dict(r) for r in rows]
                                bot_config[table_name] = data
                                config_count += len(data)
                            except Exception:
                                bot_config[table_name] = []

                    full_data = {
                        "discord": discord_data,
                        "messages": msg_data,
                        "bot_config": bot_config,
                    }
                    size_bytes = len(json.dumps(full_data, default=str).encode())
                    msg_count = sum(len(ch.get("messages", [])) for ch in msg_data.values())

                    backup = ServerBackup(
                        guild_id=guild_id,
                        backup_type="scheduled",
                        status="completed",
                        data=full_data,
                        channel_count=len(discord_data.get("channels", [])),
                        role_count=len(discord_data.get("roles", [])),
                        member_count=0,
                        config_count=config_count,
                        message_count=msg_count,
                        size_bytes=size_bytes,
                    )
                    session.add(backup)

                    # Update schedule
                    sched.last_backup_at = now
                    sched.next_backup_at = now + datetime.timedelta(hours=sched.interval_hours)

                    # Cleanup old backups
                    old_backups = session.execute(
                        select(ServerBackup)
                        .where(ServerBackup.guild_id == guild_id)
                        .order_by(ServerBackup.created_at.desc())
                    ).scalars().all()
                    if len(old_backups) > sched.max_backups:
                        for old in old_backups[sched.max_backups:]:
                            session.delete(old)

                    session.commit()
                    logger.info(f"Scheduled backup completed for {guild_id}")
                except Exception as e:
                    logger.error(f"Scheduled backup failed for {guild_id}: {e}", exc_info=True)
                    session.rollback()
        finally:
            session.close()

    @_scheduled_backup.before_loop
    async def _before_scheduled_backup(self):
        await self.bot.wait_until_ready()

    # ── Instant Recovery (Denukify) ──
    @backup_group.command(name="recover", description="[Admin] Instant recovery — rebuild from audit log (no backup needed)")
    @commands.has_permissions(administrator=True)
    async def instant_recover(
        self,
        ctx: discord.ApplicationContext,
        lookback_hours: discord.Option(int, "Hours to look back in audit log", default=1, min_value=1, max_value=24),
    ):
        """Scan audit log for recently deleted channels/roles and recreate them."""
        await ctx.defer()
        guild = ctx.guild
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=lookback_hours)
        results = {"channels_restored": 0, "roles_restored": 0, "unbans": 0, "errors": []}

        # 1. Restore deleted channels
        try:
            async for entry in guild.audit_logs(limit=300, action=discord.AuditLogAction.channel_delete, after=cutoff):
                if not entry.target:
                    continue
                try:
                    ch_name = entry.changes.before.name if entry.changes and hasattr(entry.changes, "before") and hasattr(entry.changes.before, "name") else f"recovered-{entry.target.id}"
                except Exception:
                    ch_name = f"recovered-{entry.target.id}"

                # Check if a channel with same name already exists
                existing = discord.utils.get(guild.channels, name=ch_name)
                if existing:
                    continue

                try:
                    # Try to determine channel type from extra data
                    ch_type = getattr(entry.extra, "type", None) if entry.extra else None
                    if ch_type == discord.ChannelType.voice:
                        await guild.create_voice_channel(name=ch_name)
                    elif ch_type == discord.ChannelType.category:
                        await guild.create_category(name=ch_name)
                    else:
                        await guild.create_text_channel(name=ch_name)
                    results["channels_restored"] += 1
                except Exception as e:
                    results["errors"].append(f"Channel {ch_name}: {str(e)[:100]}")
        except discord.Forbidden:
            results["errors"].append("No permission to read audit logs")
        except Exception as e:
            results["errors"].append(f"Channel scan: {str(e)[:100]}")

        # 2. Restore deleted roles
        try:
            async for entry in guild.audit_logs(limit=300, action=discord.AuditLogAction.role_delete, after=cutoff):
                try:
                    role_name = entry.changes.before.name if entry.changes and hasattr(entry.changes, "before") and hasattr(entry.changes.before, "name") else f"recovered-role"
                    role_color = entry.changes.before.colour if entry.changes and hasattr(entry.changes, "before") and hasattr(entry.changes.before, "colour") else discord.Color.default()
                except Exception:
                    role_name = "recovered-role"
                    role_color = discord.Color.default()

                existing = discord.utils.get(guild.roles, name=role_name)
                if existing:
                    continue

                try:
                    await guild.create_role(name=role_name, color=role_color)
                    results["roles_restored"] += 1
                except Exception as e:
                    results["errors"].append(f"Role {role_name}: {str(e)[:100]}")
        except Exception as e:
            results["errors"].append(f"Role scan: {str(e)[:100]}")

        # 3. Unban recently banned members (likely from nuker)
        try:
            async for entry in guild.audit_logs(limit=300, action=discord.AuditLogAction.ban, after=cutoff):
                if entry.target:
                    try:
                        await guild.unban(entry.target, reason="Instant recovery — reversing nuke bans")
                        results["unbans"] += 1
                    except Exception:
                        pass
        except Exception as e:
            results["errors"].append(f"Unban scan: {str(e)[:100]}")

        # Build result embed
        session = SessionLocal()
        try:
            embed = build_embed("restore_completed", session, vars={
                "channels": str(results["channels_restored"]),
                "roles": str(results["roles_restored"]),
                "unbans": str(results["unbans"]),
            }, guild_id=str(guild.id))
            if results["errors"]:
                embed.add_field(
                    name="⚠️ Errors",
                    value="\n".join(results["errors"][:5]),
                    inline=False,
                )
            embed.title = "🔄 Instant Recovery Complete"
            embed.description = (
                f"Scanned audit log ({lookback_hours}h lookback):\n"
                f"📝 Channels restored: **{results['channels_restored']}**\n"
                f"🎭 Roles restored: **{results['roles_restored']}**\n"
                f"🔓 Members unbanned: **{results['unbans']}**"
            )
            await ctx.respond(embed=embed)
        finally:
            session.close()


def setup(bot):
    bot.add_cog(ServerBackupCog(bot))
