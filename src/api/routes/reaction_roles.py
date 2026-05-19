"""Reaction Roles CRUD routes."""
import discord
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from src.database.config import get_db
from src.api.deps import get_guild_id, require_staff_perm
from src.models.models import ReactionRole
from src.bot.embed_utils import build_embed

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(require_staff_perm("can_roles"))])


@router.get("/reaction-roles")
def list_reaction_roles(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    panels = db.execute(
        select(ReactionRole).where(ReactionRole.guild_id == guild_id)
        .order_by(ReactionRole.created_at.desc())
    ).scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "channel_id": p.channel_id,
            "message_id": p.message_id,
            "embed_title": p.embed_title,
            "embed_description": p.embed_description,
            "embed_color": p.embed_color,
            "embed_footer": p.embed_footer,
            "embed_image_url": p.embed_image_url,
            "embed_thumbnail_url": p.embed_thumbnail_url,
            "embed_fields": p.embed_fields or [],
            "mappings": p.mappings or [],
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in panels
    ]


@router.post("/reaction-roles")
def create_reaction_role(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    panel = ReactionRole(
        guild_id=guild_id,
        name=body.get("name", "Reaction Role Panel"),
        embed_title=body.get("embed_title"),
        embed_description=body.get("embed_description"),
        embed_color=body.get("embed_color", "#5865F2"),
        embed_footer=body.get("embed_footer"),
        embed_image_url=body.get("embed_image_url"),
        embed_thumbnail_url=body.get("embed_thumbnail_url"),
        embed_fields=body.get("embed_fields", []),
        mappings=body.get("mappings", []),
    )
    db.add(panel)
    db.commit()
    db.refresh(panel)
    return {"ok": True, "id": panel.id}


@router.put("/reaction-roles/{panel_id}")
def update_reaction_role(panel_id: int, body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    panel = db.execute(select(ReactionRole).where(ReactionRole.id == panel_id, ReactionRole.guild_id == guild_id)).scalars().first()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")

    for field in ["name", "embed_title", "embed_description", "embed_color",
                  "embed_footer", "embed_image_url", "embed_thumbnail_url", "embed_fields", "mappings"]:
        if field in body:
            setattr(panel, field, body[field])
    db.commit()
    return {"ok": True}


@router.delete("/reaction-roles/{panel_id}")
def delete_reaction_role(panel_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    panel = db.execute(select(ReactionRole).where(ReactionRole.id == panel_id, ReactionRole.guild_id == guild_id)).scalars().first()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")

    # Try to delete the Discord message
    if panel.message_id and panel.channel_id:
        try:
            from src.bot.manager import bot as _bot
            if _bot and _bot.loop:
                async def _del():
                    try:
                        ch = await _bot.fetch_channel(int(panel.channel_id))
                        msg = await ch.fetch_message(int(panel.message_id))
                        await msg.delete()
                    except Exception:
                        pass
                asyncio.run_coroutine_threadsafe(_del(), _bot.loop)
        except Exception:
            pass

    db.delete(panel)
    db.commit()
    return {"ok": True}


@router.post("/reaction-roles/{panel_id}/send")
def send_reaction_role_panel(panel_id: int, body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Send the reaction role panel embed to a channel and add reactions."""
    panel = db.execute(select(ReactionRole).where(ReactionRole.id == panel_id, ReactionRole.guild_id == guild_id)).scalars().first()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")

    channel_id = body.get("channel_id")
    if not channel_id:
        raise HTTPException(status_code=400, detail="channel_id required")

    try:
        from src.bot.manager import bot as _bot
        if not _bot or not _bot.loop:
            raise HTTPException(status_code=503, detail="Bot không online")

        async def _send():
            ch = await _bot.fetch_channel(int(channel_id))
            # Build embed
            color_int = int(panel.embed_color.lstrip("#"), 16) if panel.embed_color else 0x5865F2
            embed = discord.Embed(
                title=panel.embed_title or panel.name,
                description=panel.embed_description or "",
                color=color_int,
            )
            # Add role mapping info to description
            lines = []
            for m in (panel.mappings or []):
                lines.append(f"{m.get('emoji', '❓')} → <@&{m['role_id']}>")
            if lines:
                embed.description = (embed.description + "\n\n" if embed.description else "") + "\n".join(lines)

            # Footer, image, thumbnail
            if panel.embed_footer:
                embed.set_footer(text=panel.embed_footer)
            if panel.embed_image_url:
                embed.set_image(url=panel.embed_image_url)
            if panel.embed_thumbnail_url:
                embed.set_thumbnail(url=panel.embed_thumbnail_url)
            for f in (panel.embed_fields or []):
                embed.add_field(
                    name=f.get("name", ""),
                    value=f.get("value", ""),
                    inline=f.get("inline", False),
                )

            msg = await ch.send(embed=embed)

            # Add reactions
            for m in (panel.mappings or []):
                emoji = m.get("emoji", "")
                try:
                    await msg.add_reaction(emoji)
                except Exception as e:
                    logger.warning(f"Failed to add reaction {emoji}: {e}")

            return str(msg.id)

        future = asyncio.run_coroutine_threadsafe(_send(), _bot.loop)
        message_id = future.result(timeout=10)

        panel.channel_id = channel_id
        panel.message_id = message_id
        db.commit()
        return {"ok": True, "message_id": message_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"send_reaction_role error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
