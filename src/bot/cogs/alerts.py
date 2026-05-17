"""Server Alerts cog — detect mass ban/kick, channel/role delete storms, nuke attempts."""
from __future__ import annotations
import logging
from collections import defaultdict
from datetime import datetime, timedelta

import discord
from discord.ext import commands
from sqlalchemy import select

from src.database.config import SessionLocal
from src.models.models import ServerAlert, AlertHistory

logger = logging.getLogger(__name__)


class AlertTracker:
    """In-memory sliding-window counter per guild per alert type."""

    def __init__(self):
        # guild_id -> alert_type -> list[datetime]
        self._events: dict[str, dict[str, list[datetime]]] = defaultdict(lambda: defaultdict(list))

    def record(self, guild_id: str, alert_type: str) -> int:
        """Record an event, return current count within last 10 minutes."""
        now = datetime.utcnow()
        bucket = self._events[guild_id][alert_type]
        bucket.append(now)
        # Prune events older than 10 minutes
        cutoff = now - timedelta(minutes=10)
        self._events[guild_id][alert_type] = [t for t in bucket if t > cutoff]
        return len(self._events[guild_id][alert_type])

    def clear(self, guild_id: str, alert_type: str):
        self._events[guild_id][alert_type].clear()


def _check_and_fire(tracker: AlertTracker, guild_id: str, alert_type: str,
                     actor: discord.Member | discord.User | None, details: dict):
    """Check if threshold reached and fire alert if so."""
    count = tracker.record(guild_id, alert_type)

    try:
        db = SessionLocal()
        alert = db.execute(
            select(ServerAlert).where(
                ServerAlert.guild_id == guild_id,
                ServerAlert.alert_type == alert_type,
                ServerAlert.enabled == True,
            )
        ).scalars().first()

        if not alert:
            db.close()
            return

        # Check if count exceeds threshold within window
        now = datetime.utcnow()
        window_start = now - timedelta(minutes=alert.window_minutes)
        events_in_window = [
            t for t in tracker._events[guild_id][alert_type] if t > window_start
        ]

        if len(events_in_window) < alert.threshold:
            db.close()
            return

        # Threshold reached — log alert
        severity = "critical" if alert_type == "nuke_detect" else "warning"
        entry = AlertHistory(
            guild_id=guild_id,
            alert_type=alert_type,
            actor_id=str(actor.id) if actor else None,
            actor_name=str(actor) if actor else None,
            details=details,
            severity=severity,
        )
        db.add(entry)
        db.commit()

        # Clear counter to avoid repeated alerts
        tracker.clear(guild_id, alert_type)

        logger.warning(f"Alert fired: {alert_type} in guild {guild_id} (count={len(events_in_window)})")
    except Exception as e:
        logger.error(f"Alert check failed: {e}")
    finally:
        db.close()


class AlertsCog(commands.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        self.tracker = AlertTracker()

    @commands.Cog.listener()
    async def on_member_ban(self, guild: discord.Guild, user: discord.User):
        gid = str(guild.id)
        # Try to get who did the ban from audit log
        actor = None
        try:
            async for entry in guild.audit_logs(limit=1, action=discord.AuditLogAction.ban):
                if entry.target and entry.target.id == user.id:
                    actor = entry.user
                    break
        except Exception:
            pass

        _check_and_fire(self.tracker, gid, "mass_ban", actor, {
            "banned_user": str(user), "banned_user_id": str(user.id),
        })
        # Also check nuke pattern
        _check_and_fire(self.tracker, gid, "nuke_detect", actor, {
            "action": "ban", "target": str(user),
        })

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member):
        gid = str(member.guild.id)
        # Check audit log for kick
        actor = None
        try:
            async for entry in member.guild.audit_logs(limit=1, action=discord.AuditLogAction.kick):
                if entry.target and entry.target.id == member.id:
                    actor = entry.user
                    break
        except Exception:
            pass

        if actor:  # Only count if it was a kick (not a leave)
            _check_and_fire(self.tracker, gid, "mass_kick", actor, {
                "kicked_user": str(member), "kicked_user_id": str(member.id),
            })
            _check_and_fire(self.tracker, gid, "nuke_detect", actor, {
                "action": "kick", "target": str(member),
            })

    @commands.Cog.listener()
    async def on_guild_channel_delete(self, channel: discord.abc.GuildChannel):
        gid = str(channel.guild.id)
        actor = None
        try:
            async for entry in channel.guild.audit_logs(limit=1, action=discord.AuditLogAction.channel_delete):
                if entry.target and entry.target.id == channel.id:
                    actor = entry.user
                    break
        except Exception:
            pass

        _check_and_fire(self.tracker, gid, "channel_delete", actor, {
            "channel_name": channel.name, "channel_id": str(channel.id),
        })
        _check_and_fire(self.tracker, gid, "nuke_detect", actor, {
            "action": "channel_delete", "target": channel.name,
        })

    @commands.Cog.listener()
    async def on_guild_role_delete(self, role: discord.Role):
        gid = str(role.guild.id)
        actor = None
        try:
            async for entry in role.guild.audit_logs(limit=1, action=discord.AuditLogAction.role_delete):
                if entry.target and entry.target.id == role.id:
                    actor = entry.user
                    break
        except Exception:
            pass

        _check_and_fire(self.tracker, gid, "role_delete", actor, {
            "role_name": role.name, "role_id": str(role.id),
        })
        _check_and_fire(self.tracker, gid, "nuke_detect", actor, {
            "action": "role_delete", "target": role.name,
        })


def setup(bot: discord.Bot):
    bot.add_cog(AlertsCog(bot))
