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
from src.bot.embed_utils import build_embed

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
                     actor: discord.Member | discord.User | None, details: dict,
                     bot: discord.Bot | None = None):
    """Check if threshold reached and fire alert if so. Returns embed if fired."""
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
            return None

        # Check if count exceeds threshold within window
        now = datetime.utcnow()
        window_start = now - timedelta(minutes=alert.window_minutes)
        events_in_window = [
            t for t in tracker._events[guild_id][alert_type] if t > window_start
        ]

        if len(events_in_window) < alert.threshold:
            db.close()
            return None

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

        # Build embed via embed system
        embed_key = f"alert_{alert_type}"
        embed_vars = {
            "actor": str(actor) if actor else "Unknown",
            "actor.mention": actor.mention if actor else "Unknown",
            "event_count": str(len(events_in_window)),
            "window_minutes": str(alert.window_minutes),
            "severity": severity.upper(),
            **{k: str(v) for k, v in details.items()},
        }
        embed = build_embed(embed_key, db, vars=embed_vars)

        # Clear counter to avoid repeated alerts
        tracker.clear(guild_id, alert_type)

        logger.warning(f"Alert fired: {alert_type} in guild {guild_id} (count={len(events_in_window)})")
        return embed
    except Exception as e:
        logger.error(f"Alert check failed: {e}")
        return None
    finally:
        db.close()


class AlertsCog(commands.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot
        self.tracker = AlertTracker()

    async def _send_alert(self, guild: discord.Guild, alert_type: str,
                          actor: discord.Member | discord.User | None, details: dict):
        """Fire alert check and send embed to webhook/log channel if triggered."""
        gid = str(guild.id)
        embed = _check_and_fire(self.tracker, gid, alert_type, actor, details)
        if not embed:
            return
        # Try to send to alert webhook or first available text channel
        db = SessionLocal()
        try:
            alert = db.execute(
                select(ServerAlert).where(
                    ServerAlert.guild_id == gid,
                    ServerAlert.alert_type == alert_type,
                )
            ).scalars().first()
            if alert and getattr(alert, "webhook_url", None):
                import httpx
                async with httpx.AsyncClient() as client:
                    await client.post(alert.webhook_url, json={
                        "embeds": [embed.to_dict()],
                    })
            else:
                # Send to system channel or first text channel bot can write to
                target = guild.system_channel
                if not target or not target.permissions_for(guild.me).send_messages:
                    for ch in guild.text_channels:
                        if ch.permissions_for(guild.me).send_messages:
                            target = ch
                            break
                if target:
                    await target.send(embed=embed)
        except Exception as e:
            logger.error(f"Failed to send alert embed: {e}")
        finally:
            db.close()

    @commands.Cog.listener()
    async def on_member_ban(self, guild: discord.Guild, user: discord.User):
        actor = None
        try:
            async for entry in guild.audit_logs(limit=1, action=discord.AuditLogAction.ban):
                if entry.target and entry.target.id == user.id:
                    actor = entry.user
                    break
        except Exception:
            pass

        await self._send_alert(guild, "mass_ban", actor, {
            "banned_user": str(user), "banned_user_id": str(user.id),
        })
        await self._send_alert(guild, "nuke_detect", actor, {
            "action": "ban", "target": str(user),
        })

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member):
        actor = None
        try:
            async for entry in member.guild.audit_logs(limit=1, action=discord.AuditLogAction.kick):
                if entry.target and entry.target.id == member.id:
                    actor = entry.user
                    break
        except Exception:
            pass

        if actor:
            await self._send_alert(member.guild, "mass_kick", actor, {
                "kicked_user": str(member), "kicked_user_id": str(member.id),
            })
            await self._send_alert(member.guild, "nuke_detect", actor, {
                "action": "kick", "target": str(member),
            })

    @commands.Cog.listener()
    async def on_guild_channel_delete(self, channel: discord.abc.GuildChannel):
        actor = None
        try:
            async for entry in channel.guild.audit_logs(limit=1, action=discord.AuditLogAction.channel_delete):
                if entry.target and entry.target.id == channel.id:
                    actor = entry.user
                    break
        except Exception:
            pass

        await self._send_alert(channel.guild, "channel_delete", actor, {
            "channel_name": channel.name, "channel_id": str(channel.id),
        })
        await self._send_alert(channel.guild, "nuke_detect", actor, {
            "action": "channel_delete", "target": channel.name,
        })

    @commands.Cog.listener()
    async def on_guild_role_delete(self, role: discord.Role):
        actor = None
        try:
            async for entry in role.guild.audit_logs(limit=1, action=discord.AuditLogAction.role_delete):
                if entry.target and entry.target.id == role.id:
                    actor = entry.user
                    break
        except Exception:
            pass

        await self._send_alert(role.guild, "role_delete", actor, {
            "role_name": role.name, "role_id": str(role.id),
        })
        await self._send_alert(role.guild, "nuke_detect", actor, {
            "action": "role_delete", "target": role.name,
        })


def setup(bot: discord.Bot):
    bot.add_cog(AlertsCog(bot))
