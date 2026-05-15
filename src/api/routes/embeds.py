"""Embed template CRUD routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
import datetime, re, logging

from src.database.config import get_db
from src.models.models import EmbedTemplate, CustomEmbedMessage, SystemConfig

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/embeds")
def list_embeds(db=Depends(get_db)):
    rows = db.execute(select(EmbedTemplate).order_by(EmbedTemplate.id)).scalars().all()
    return [
        {
            "id": r.id, "name": r.name, "event_type": r.event_type,
            "title": r.title, "description": r.description, "color": r.color,
            "author": r.author, "footer": r.footer,
            "thumbnail_url": r.thumbnail_url, "image_url": r.image_url,
            "fields": r.fields or [], "enabled": r.enabled,
            "response_mode": r.response_mode or "embed",
            "text_template": r.text_template,
        }
        for r in rows
    ]


@router.post("/embeds")
def create_embed(body: dict, db=Depends(get_db)):
    e = EmbedTemplate(
        name=body.get("name", ""),
        event_type=body.get("event_type"),
        title=body.get("title"),
        description=body.get("description"),
        color=body.get("color", "#5865F2"),
        author=body.get("author"),
        footer=body.get("footer"),
        thumbnail_url=body.get("thumbnail_url"),
        image_url=body.get("image_url"),
        fields=body.get("fields", []),
        enabled=body.get("enabled", True),
        response_mode=body.get("response_mode", "embed"),
        text_template=body.get("text_template"),
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return {"id": e.id, "name": e.name}


@router.put("/embeds/{embed_id}")
def update_embed(embed_id: int, body: dict, db=Depends(get_db)):
    e = db.get(EmbedTemplate, embed_id)
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    for k in ("name", "event_type", "title", "description", "color", "author",
              "footer", "thumbnail_url", "image_url", "fields", "enabled",
              "response_mode", "text_template"):
        if k in body:
            setattr(e, k, body[k])
    e.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.delete("/embeds/{embed_id}")
def delete_embed(embed_id: int, db=Depends(get_db)):
    e = db.get(EmbedTemplate, embed_id)
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(e)
    db.commit()
    return {"ok": True}


# ── Custom Embed Messages ─────────────────────────────────────────────────────

def _row_to_dict(r: CustomEmbedMessage) -> dict:
    return {
        "id": r.id, "name": r.name,
        "channel_id": r.channel_id, "message_id": r.message_id, "guild_id": r.guild_id,
        "title": r.title, "description": r.description, "color": r.color or "#5865F2",
        "author": r.author, "author_icon_url": r.author_icon_url,
        "footer": r.footer, "thumbnail_url": r.thumbnail_url, "image_url": r.image_url,
        "fields": r.fields or [],
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _build_discord_embed(data: dict):
    """Tạo discord.Embed từ dict embed data."""
    import discord
    color_hex = (data.get("color") or "#5865F2").lstrip("#")
    try:
        color_int = int(color_hex, 16)
    except Exception:
        color_int = 0x5865F2
    embed = discord.Embed(
        title=data.get("title") or None,
        description=data.get("description") or None,
        color=color_int,
    )
    if data.get("author"):
        embed.set_author(name=data["author"], icon_url=data.get("author_icon_url") or discord.Embed.Empty)
    if data.get("footer"):
        embed.set_footer(text=data["footer"])
    if data.get("thumbnail_url"):
        embed.set_thumbnail(url=data["thumbnail_url"])
    if data.get("image_url"):
        embed.set_image(url=data["image_url"])
    for f in (data.get("fields") or []):
        embed.add_field(name=f.get("name", ""), value=f.get("value", ""), inline=bool(f.get("inline", False)))
    return embed


@router.get("/embeds/custom")
def list_custom_embeds(db=Depends(get_db)):
    rows = db.execute(select(CustomEmbedMessage).order_by(CustomEmbedMessage.updated_at.desc())).scalars().all()
    return [_row_to_dict(r) for r in rows]


@router.post("/embeds/custom")
def create_custom_embed(body: dict, db=Depends(get_db)):
    r = CustomEmbedMessage(
        name=body.get("name") or "Embed mới",
        title=body.get("title"), description=body.get("description"),
        color=body.get("color", "#5865F2"),
        author=body.get("author"), author_icon_url=body.get("author_icon_url"),
        footer=body.get("footer"), thumbnail_url=body.get("thumbnail_url"),
        image_url=body.get("image_url"), fields=body.get("fields", []),
    )
    db.add(r); db.commit(); db.refresh(r)
    return _row_to_dict(r)


@router.put("/embeds/custom/{msg_id}")
def update_custom_embed(msg_id: int, body: dict, db=Depends(get_db)):
    r = db.get(CustomEmbedMessage, msg_id)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    for k in ("name", "title", "description", "color", "author", "author_icon_url",
              "footer", "thumbnail_url", "image_url", "fields"):
        if k in body:
            setattr(r, k, body[k])
    r.updated_at = datetime.datetime.utcnow()
    db.commit()
    return _row_to_dict(r)


@router.delete("/embeds/custom/{msg_id}")
def delete_custom_embed(msg_id: int, db=Depends(get_db)):
    r = db.get(CustomEmbedMessage, msg_id)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(r); db.commit()
    return {"ok": True}


@router.post("/embeds/custom/{msg_id}/send")
async def send_custom_embed(msg_id: int, body: dict, db=Depends(get_db)):
    """Gửi embed lên Discord channel. Body: { channel_id: str }"""
    r = db.get(CustomEmbedMessage, msg_id)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")

    channel_id = body.get("channel_id")
    if not channel_id:
        raise HTTPException(status_code=400, detail="Thiếu channel_id")

    try:
        from src.bot.manager import get_bot_client
        bot = get_bot_client()
        if not bot or not bot.is_ready():
            raise HTTPException(status_code=503, detail="Bot chưa sẵn sàng")

        channel = bot.get_channel(int(channel_id))
        if not channel:
            raise HTTPException(status_code=404, detail="Không tìm thấy kênh")

        embed = _build_discord_embed(_row_to_dict(r))
        msg = await channel.send(embed=embed)

        # Lưu message_id + channel_id
        r.channel_id = str(channel_id)
        r.message_id = str(msg.id)
        r.guild_id = str(msg.guild.id) if msg.guild else None
        r.updated_at = datetime.datetime.utcnow()
        db.commit()

        guild_id = msg.guild.id if msg.guild else 0
        msg_link = f"https://discord.com/channels/{guild_id}/{channel_id}/{msg.id}"
        return {"ok": True, "message_id": str(msg.id), "message_url": msg_link, **_row_to_dict(r)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"send_custom_embed error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embeds/custom/{msg_id}/update-message")
async def update_discord_message(msg_id: int, db=Depends(get_db)):
    """Cập nhật tin nhắn Discord đã gửi với nội dung embed mới nhất trong DB."""
    r = db.get(CustomEmbedMessage, msg_id)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    if not r.channel_id or not r.message_id:
        raise HTTPException(status_code=400, detail="Chưa có tin nhắn Discord để cập nhật")

    try:
        from src.bot.manager import get_bot_client
        bot = get_bot_client()
        if not bot or not bot.is_ready():
            raise HTTPException(status_code=503, detail="Bot chưa sẵn sàng")

        channel = bot.get_channel(int(r.channel_id))
        if not channel:
            raise HTTPException(status_code=404, detail="Không tìm thấy kênh")

        discord_msg = await channel.fetch_message(int(r.message_id))
        embed = _build_discord_embed(_row_to_dict(r))
        await discord_msg.edit(embed=embed)

        r.updated_at = datetime.datetime.utcnow()
        db.commit()

        guild_id = r.guild_id or "0"
        msg_link = f"https://discord.com/channels/{guild_id}/{r.channel_id}/{r.message_id}"
        return {"ok": True, "message_url": msg_link}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"update_discord_message error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embeds/custom/load-link")
async def load_from_link(body: dict, db=Depends(get_db)):
    """
    Nhận Discord message link, parse channel_id + message_id,
    fetch message từ Discord, trả về embed data.
    Nếu đã có trong DB thì trả về record đó, không thì tạo mới.
    """
    link = (body.get("link") or "").strip()
    # Parse: https://discord.com/channels/{guild}/{channel}/{message}
    m = re.match(r"https://(?:ptb\.|canary\.)?discord(?:app)?\.com/channels/(\d+)/(\d+)/(\d+)", link)
    if not m:
        raise HTTPException(status_code=400, detail="Link không hợp lệ. Dùng link tin nhắn Discord (chuột phải → Copy Message Link)")

    guild_id, channel_id, message_id = m.group(1), m.group(2), m.group(3)

    try:
        from src.bot.manager import get_bot_client
        bot = get_bot_client()
        if not bot or not bot.is_ready():
            raise HTTPException(status_code=503, detail="Bot chưa sẵn sàng")

        channel = bot.get_channel(int(channel_id))
        if not channel:
            raise HTTPException(status_code=404, detail="Bot không có quyền truy cập kênh này")

        discord_msg = await channel.fetch_message(int(message_id))

        # Kiểm tra xem đã có trong DB chưa
        existing = db.execute(
            select(CustomEmbedMessage).where(CustomEmbedMessage.message_id == message_id)
        ).scalars().first()

        # Parse embed từ message Discord
        embed_data: dict = {
            "channel_id": channel_id, "message_id": message_id, "guild_id": guild_id,
            "title": None, "description": None, "color": "#5865F2",
            "author": None, "author_icon_url": None,
            "footer": None, "thumbnail_url": None, "image_url": None,
            "fields": [],
        }
        if discord_msg.embeds:
            e = discord_msg.embeds[0]
            embed_data["title"] = e.title
            embed_data["description"] = e.description
            if e.color:
                embed_data["color"] = f"#{e.color.value:06x}"
            if e.author and e.author.name:
                embed_data["author"] = e.author.name
                embed_data["author_icon_url"] = str(e.author.icon_url) if e.author.icon_url else None
            if e.footer and e.footer.text:
                embed_data["footer"] = e.footer.text
            if e.thumbnail:
                embed_data["thumbnail_url"] = str(e.thumbnail.url)
            if e.image:
                embed_data["image_url"] = str(e.image.url)
            embed_data["fields"] = [
                {"name": f.name, "value": f.value, "inline": f.inline}
                for f in e.fields
            ]

        if existing:
            # Cập nhật embed data từ message Discord vào DB record
            for k in ("title", "description", "color", "author", "author_icon_url",
                      "footer", "thumbnail_url", "image_url", "fields"):
                setattr(existing, k, embed_data[k])
            existing.updated_at = datetime.datetime.utcnow()
            db.commit()
            return {"loaded": True, "is_new": False, **_row_to_dict(existing)}
        else:
            # Tạo mới
            r = CustomEmbedMessage(
                name=f"Tin nhắn #{message_id[-6:]}",
                **embed_data,
            )
            db.add(r); db.commit(); db.refresh(r)
            return {"loaded": True, "is_new": True, **_row_to_dict(r)}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"load_from_link error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
