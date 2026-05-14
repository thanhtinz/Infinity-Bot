# src/bot/cogs/custom_commands.py
"""Custom commands — user-defined prefix commands managed from dashboard."""
import discord
import logging
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import CustomCommand

logger = logging.getLogger(__name__)

COMMAND_PREFIX = "!"
VARS = {
    "{user}": lambda m: str(m.author),
    "{user.mention}": lambda m: m.author.mention,
    "{user.id}": lambda m: str(m.author.id),
    "{server}": lambda m: m.guild.name if m.guild else "Server",
    "{channel}": lambda m: m.channel.mention,
    "{member_count}": lambda m: str(m.guild.member_count) if m.guild else "0",
}


def get_session():
    return SessionLocal()


def _substitute(text: str, message: discord.Message) -> str:
    for token, fn in VARS.items():
        if token in text:
            text = text.replace(token, fn(message))
    return text


class CustomCommandsCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    @discord.Cog.listener()
    async def on_message(self, message: discord.Message):
        if not message.guild or message.author.bot:
            return
        if not message.content.startswith(COMMAND_PREFIX):
            return

        cmd_name = message.content[len(COMMAND_PREFIX):].split()[0].lower()
        if not cmd_name:
            return

        session = get_session()
        try:
            cmd = session.execute(
                select(CustomCommand).where(
                    CustomCommand.guild_id == str(message.guild.id),
                    CustomCommand.name == cmd_name,
                    CustomCommand.enabled == True,
                )
            ).scalars().first()

            if not cmd:
                return

            # Check required roles
            if cmd.required_roles and isinstance(message.author, discord.Member):
                member_role_ids = {str(r.id) for r in message.author.roles}
                if not any(rid in member_role_ids for rid in cmd.required_roles):
                    return

            if cmd.response_type == "embed" and cmd.response_embed:
                data = cmd.response_embed
                embed = discord.Embed(
                    title=_substitute(data.get("title", ""), message),
                    description=_substitute(data.get("description", ""), message),
                    color=int(data.get("color", "#5865F2").lstrip("#"), 16) if data.get("color") else 0x5865F2,
                )
                for field in data.get("fields", []):
                    embed.add_field(
                        name=_substitute(field.get("name", ""), message),
                        value=_substitute(field.get("value", ""), message),
                        inline=field.get("inline", False),
                    )
                if data.get("footer"):
                    embed.set_footer(text=_substitute(data["footer"], message))
                if data.get("thumbnail_url"):
                    embed.set_thumbnail(url=data["thumbnail_url"])
                if data.get("image_url"):
                    embed.set_image(url=data["image_url"])
                await message.channel.send(embed=embed)
            else:
                # Text response
                text = _substitute(cmd.response_text or "", message)
                if text:
                    await message.channel.send(text)
        finally:
            session.close()
