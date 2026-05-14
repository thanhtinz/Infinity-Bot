# src/bot/cogs/reaction_roles.py
"""Reaction Roles — assign roles when users react to a panel message."""
import discord
import logging
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import ReactionRole
from src.bot.base_cog import check_feature

logger = logging.getLogger(__name__)


def get_session():
    return SessionLocal()


class ReactionRolesCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    def _find_panel(self, guild_id: str, message_id: str):
        session = get_session()
        try:
            return session.execute(
                select(ReactionRole).where(
                    ReactionRole.guild_id == guild_id,
                    ReactionRole.message_id == message_id,
                )
            ).scalars().first()
        finally:
            session.close()

    def _find_role_id(self, panel: ReactionRole, emoji_str: str) -> str | None:
        for m in (panel.mappings or []):
            if m.get("emoji") == emoji_str:
                return m.get("role_id")
        return None

    @discord.Cog.listener()
    async def on_raw_reaction_add(self, payload: discord.RawReactionActionEvent):
        if not check_feature(self): return
        if not payload.guild_id or payload.member and payload.member.bot:
            return

        panel = self._find_panel(str(payload.guild_id), str(payload.message_id))
        if not panel:
            return

        role_id = self._find_role_id(panel, str(payload.emoji))
        if not role_id:
            return

        guild = self.bot.get_guild(payload.guild_id)
        if not guild:
            return

        role = guild.get_role(int(role_id))
        member = payload.member or guild.get_member(payload.user_id)
        if role and member:
            try:
                await member.add_roles(role, reason="Reaction Role")
                logger.info(f"Added role {role.name} to {member}")
            except discord.Forbidden:
                logger.warning(f"No permission to add role {role.name}")

    @discord.Cog.listener()
    async def on_raw_reaction_remove(self, payload: discord.RawReactionActionEvent):
        if not check_feature(self): return
        if not payload.guild_id:
            return

        panel = self._find_panel(str(payload.guild_id), str(payload.message_id))
        if not panel:
            return

        role_id = self._find_role_id(panel, str(payload.emoji))
        if not role_id:
            return

        guild = self.bot.get_guild(payload.guild_id)
        if not guild:
            return

        role = guild.get_role(int(role_id))
        member = guild.get_member(payload.user_id)
        if role and member:
            try:
                await member.remove_roles(role, reason="Reaction Role removed")
                logger.info(f"Removed role {role.name} from {member}")
            except discord.Forbidden:
                logger.warning(f"No permission to remove role {role.name}")
