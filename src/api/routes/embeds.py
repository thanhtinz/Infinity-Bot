"""Embed template CRUD routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
import datetime, re, logging

from src.database.config import get_db
from src.models.models import EmbedTemplate, CustomEmbedMessage, SystemConfig
from src.api.deps import get_guild_id

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/embeds")
def list_embeds(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rows = db.execute(
        select(EmbedTemplate).where(EmbedTemplate.guild_id == guild_id).order_by(EmbedTemplate.id)
    ).scalars().all()
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
def create_embed(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    e = EmbedTemplate(
        guild_id=guild_id,
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
    # Nếu r.embeds có data → dùng luôn
    # Nếu không có → migrate từ flat fields cũ thành embeds[0]
    embeds = r.embeds or []
    if not embeds and (r.title or r.description or r.color or r.fields):
        embeds = [{
            "title": r.title or "",
            "description": r.description or "",
            "color": r.color or "#5865F2",
            "author": r.author or "",
            "author_icon_url": r.author_icon_url or "",
            "footer": r.footer or "",
            "thumbnail_url": r.thumbnail_url or "",
            "image_url": r.image_url or "",
            "fields": r.fields or [],
        }]
    return {
        "id": r.id, "name": r.name,
        "channel_id": r.channel_id, "message_id": r.message_id, "guild_id": r.guild_id,
        "content": r.content or "",
        "webhook_username": r.webhook_username or "",
        "webhook_avatar_url": r.webhook_avatar_url or "",
        "thread_name": r.thread_name or "",
        "embeds": embeds,
        "components": r.components or [],
        "flags": r.flags or {},
        "allowed_mentions": r.allowed_mentions or {},
        # Legacy flat (giữ để tương thích ngược)
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


def _build_embeds_from_row(r: CustomEmbedMessage):
    """Trả về list discord.Embed từ row (hỗ trợ multi-embed mới và legacy flat)."""
    row_dict = _row_to_dict(r)
    embeds_data = row_dict.get("embeds") or []
    if not embeds_data:
        return [_build_discord_embed(row_dict)]
    return [_build_discord_embed(e) for e in embeds_data]


def _build_view_from_components(components: list):
    """Tạo discord.ui.View từ list action rows. Chỉ hỗ trợ Link Buttons (style=5)."""
    import discord
    if not components:
        return None
    view = discord.ui.View(timeout=None)
    for row_idx, row in enumerate(components[:5]):
        btns = row.get("components") or []
        for btn_data in btns[:5]:
            style_int = btn_data.get("style", 2)
            label = btn_data.get("label") or "Button"
            disabled = bool(btn_data.get("disabled", False))
            emoji_str = btn_data.get("emoji") or None

            style_map = {
                1: discord.ButtonStyle.primary,
                2: discord.ButtonStyle.secondary,
                3: discord.ButtonStyle.success,
                4: discord.ButtonStyle.danger,
                5: discord.ButtonStyle.link,
            }
            style = style_map.get(style_int, discord.ButtonStyle.secondary)

            if style == discord.ButtonStyle.link:
                url = btn_data.get("url") or "https://discord.com"
                btn = discord.ui.Button(style=style, label=label, url=url, disabled=disabled, row=row_idx)
            else:
                custom_id = btn_data.get("custom_id") or f"btn_{row_idx}_{label[:10]}"
                btn = discord.ui.Button(style=style, label=label, custom_id=custom_id, disabled=disabled, row=row_idx)
            if emoji_str:
                try:
                    btn.emoji = emoji_str
                except Exception:
                    pass
            view.add_item(btn)
    return view if view.children else None


def _build_allowed_mentions(am_data: dict):
    """Tạo discord.AllowedMentions từ dict."""
    import discord
    if not am_data:
        return None
    parse = am_data.get("parse", [])
    kwargs: dict = {}
    if "everyone" in parse:
        kwargs["everyone"] = True
    if "roles" in parse:
        kwargs["roles"] = True
    elif "roles" not in parse and am_data.get("roles"):
        kwargs["roles"] = [discord.Object(id=int(rid)) for rid in am_data["roles"] if rid.isdigit()]
    if "users" in parse:
        kwargs["users"] = True
    elif "users" not in parse and am_data.get("users"):
        kwargs["users"] = [discord.Object(id=int(uid)) for uid in am_data["users"] if uid.isdigit()]
    if "replied_user" in am_data:
        kwargs["replied_user"] = bool(am_data["replied_user"])
    return discord.AllowedMentions(**kwargs) if kwargs else None


@router.get("/embeds/custom")
def list_custom_embeds(db=Depends(get_db)):
    rows = db.execute(select(CustomEmbedMessage).order_by(CustomEmbedMessage.updated_at.desc())).scalars().all()
    return [_row_to_dict(r) for r in rows]


@router.post("/embeds/custom")
def create_custom_embed(body: dict, db=Depends(get_db)):
    r = CustomEmbedMessage(
        name=body.get("name") or "Embed mới",
        content=body.get("content"),
        webhook_username=body.get("webhook_username"),
        webhook_avatar_url=body.get("webhook_avatar_url"),
        thread_name=body.get("thread_name"),
        embeds=body.get("embeds", []),
        components=body.get("components", []),
        flags=body.get("flags", {}),
        allowed_mentions=body.get("allowed_mentions", {}),
        # legacy flat
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
    for k in ("name", "content", "webhook_username", "webhook_avatar_url", "thread_name", "embeds",
              "components", "flags", "allowed_mentions",
              "title", "description", "color", "author", "author_icon_url",
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


@router.post("/embeds/custom/{msg_id}/duplicate")
def duplicate_custom_embed(msg_id: int, db=Depends(get_db)):
    r = db.get(CustomEmbedMessage, msg_id)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    clone = CustomEmbedMessage(
        name=f"{r.name} (copy)",
        content=r.content,
        webhook_username=r.webhook_username,
        webhook_avatar_url=r.webhook_avatar_url,
        thread_name=r.thread_name,
        embeds=r.embeds or [],
        components=r.components or [],
        flags=r.flags or {},
        allowed_mentions=r.allowed_mentions or {},
        title=r.title, description=r.description, color=r.color,
        author=r.author, author_icon_url=r.author_icon_url,
        footer=r.footer, thumbnail_url=r.thumbnail_url,
        image_url=r.image_url, fields=r.fields or [],
    )
    db.add(clone); db.commit(); db.refresh(clone)
    return _row_to_dict(clone)


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

        embeds = _build_embeds_from_row(r)
        content = r.content or None

        send_kwargs: dict = {"embeds": embeds}
        if content:
            send_kwargs["content"] = content

        # ── Components (Link Buttons only) ──
        view = _build_view_from_components(r.components or [])
        if view:
            send_kwargs["view"] = view

        # ── Flags ──
        flags_data = r.flags or {}
        if flags_data.get("suppress_embeds"):
            import discord as _discord
            send_kwargs["flags"] = _discord.MessageFlags(suppress_embeds=True)

        # ── Allowed Mentions ──
        am = _build_allowed_mentions(r.allowed_mentions or {})
        if am:
            send_kwargs["allowed_mentions"] = am

        msg = await channel.send(**send_kwargs)

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
        embeds = _build_embeds_from_row(r)
        content = r.content or None
        edit_kwargs: dict = {"embeds": embeds}
        if content is not None:
            edit_kwargs["content"] = content
        # Components
        view = _build_view_from_components(r.components or [])
        edit_kwargs["view"] = view if view else discord.ui.View()
        await discord_msg.edit(**edit_kwargs)

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

        # Parse tất cả embeds từ message Discord
        parsed_embeds = []
        for e in discord_msg.embeds:
            color_str = f"#{e.color.value:06x}" if e.color else "#5865F2"
            parsed_embeds.append({
                "title": e.title or "",
                "description": e.description or "",
                "color": color_str,
                "author": e.author.name if e.author else "",
                "author_icon_url": str(e.author.icon_url) if (e.author and e.author.icon_url) else "",
                "footer": e.footer.text if e.footer else "",
                "thumbnail_url": str(e.thumbnail.url) if e.thumbnail else "",
                "image_url": str(e.image.url) if e.image else "",
                "fields": [{"name": f.name, "value": f.value, "inline": f.inline} for f in e.fields],
            })

        content_text = discord_msg.content or ""

        embed_data: dict = {
            "channel_id": channel_id, "message_id": message_id, "guild_id": guild_id,
            "content": content_text,
            "embeds": parsed_embeds,
            # legacy flat từ embed đầu tiên (nếu có)
            "title": parsed_embeds[0]["title"] if parsed_embeds else None,
            "description": parsed_embeds[0]["description"] if parsed_embeds else None,
            "color": parsed_embeds[0]["color"] if parsed_embeds else "#5865F2",
            "author": parsed_embeds[0]["author"] if parsed_embeds else None,
            "author_icon_url": parsed_embeds[0]["author_icon_url"] if parsed_embeds else None,
            "footer": parsed_embeds[0]["footer"] if parsed_embeds else None,
            "thumbnail_url": parsed_embeds[0]["thumbnail_url"] if parsed_embeds else None,
            "image_url": parsed_embeds[0]["image_url"] if parsed_embeds else None,
            "fields": parsed_embeds[0]["fields"] if parsed_embeds else [],
        }

        if existing:
            for k in ("content", "embeds", "title", "description", "color", "author",
                      "author_icon_url", "footer", "thumbnail_url", "image_url", "fields"):
                setattr(existing, k, embed_data[k])
            existing.updated_at = datetime.datetime.utcnow()
            db.commit()
            return {"loaded": True, "is_new": False, **_row_to_dict(existing)}
        else:
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


# ── Export / Import ───────────────────────────────────────────────────────────

@router.get("/embeds/custom/{msg_id}/export")
def export_custom_embed(msg_id: int, db=Depends(get_db)):
    """Trả về JSON export của message (Discohook-compatible format)."""
    from fastapi.responses import JSONResponse
    r = db.get(CustomEmbedMessage, msg_id)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    data = _row_to_dict(r)
    export = {
        "version": "d2",
        "name": data["name"],
        "content": data["content"],
        "embeds": data["embeds"],
        "components": data["components"],
        "flags": data["flags"],
        "allowed_mentions": data["allowed_mentions"],
        "webhook_username": data["webhook_username"],
        "webhook_avatar_url": data["webhook_avatar_url"],
        "thread_name": data["thread_name"],
    }
    return JSONResponse(
        content=export,
        headers={"Content-Disposition": f'attachment; filename="{r.name or "message"}.json"'},
    )


@router.post("/embeds/custom/import")
def import_custom_embed(body: dict, db=Depends(get_db)):
    """Import message từ JSON body (Discohook-compatible). Tạo record mới."""
    name = body.get("name") or "Imported Message"
    r = CustomEmbedMessage(
        name=name,
        content=body.get("content") or "",
        webhook_username=body.get("webhook_username") or "",
        webhook_avatar_url=body.get("webhook_avatar_url") or "",
        thread_name=body.get("thread_name") or "",
        embeds=body.get("embeds") or [],
        components=body.get("components") or [],
        flags=body.get("flags") or {},
        allowed_mentions=body.get("allowed_mentions") or {},
    )
    db.add(r); db.commit(); db.refresh(r)
    return _row_to_dict(r)
