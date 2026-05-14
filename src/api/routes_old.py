from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy import select, func, case
import os, uuid, shutil
from sqlalchemy.orm import joinedload
from src.database.config import get_db
from src.models.models import SystemConfig, Product, Order, User, Coupon, StickyMessage, \
    Ticket, TicketPanel, TicketConfig, TicketBlacklist, TicketNote, \
    TicketForm, TicketTeam, TicketFeedback, TicketTranscript, \
    TicketFeedbackConfig, TicketClaimConfig, PanelButton, TicketPanelGroup
from src.schemas.schemas import SystemConfigBase, SystemConfigResponse, ProductBase, ProductResponse, OrderResponse
from src.bot.manager import start_bot, stop_bot
from src.api.auth import router as auth_router
from payos import PayOS
import logging
import discord
import datetime

logger = logging.getLogger(__name__)

router = APIRouter()
router.include_router(auth_router, tags=["auth"])


def is_oauth_configured(config: SystemConfig | None) -> bool:
    return bool(
        (config and config.discord_client_id and config.discord_client_secret)
        or (os.environ.get("DISCORD_CLIENT_ID") and os.environ.get("DISCORD_CLIENT_SECRET"))
    )

@router.get("/setup/status")
def get_setup_status(db = Depends(get_db)):
    result = db.execute(select(SystemConfig).limit(1))
    config = result.scalars().first()
    oauth_configured = is_oauth_configured(config)
    has_public_url = bool(
        (config and config.public_app_url)
        or os.environ.get("PUBLIC_APP_URL")
    )
    return {
        "oauth_configured": oauth_configured and has_public_url,
        "has_discord_token": bool(config and config.discord_token),
        "has_guild_id": bool(config and config.guild_id),
        "has_admin_role_id": bool(config and config.admin_role_id),
    }

import httpx

@router.get("/discord/guilds")
async def get_discord_guilds(db = Depends(get_db)):
    result = db.execute(select(SystemConfig).limit(1))
    config = result.scalars().first()
    if not config or not config.discord_token:
        raise HTTPException(status_code=400, detail="Bot token chưa được cấu hình")
    async with httpx.AsyncClient() as client:
        res = await client.get(
            "https://discord.com/api/users/@me/guilds",
            headers={"Authorization": f"Bot {config.discord_token}"}
        )
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail="Không thể lấy danh sách server")
        return res.json()

@router.get("/discord/channels")
async def get_discord_channels(guild_id: str = None, db = Depends(get_db)):
    result = db.execute(select(SystemConfig).limit(1))
    config = result.scalars().first()
    if not config or not config.discord_token:
        return []
    target_guild = guild_id or config.guild_id
    if not target_guild:
        return []
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{target_guild}/channels",
            headers={"Authorization": f"Bot {config.discord_token}"}
        )
        if res.status_code != 200:
            return []
        channels = res.json()
        return [{"id": c["id"], "name": c["name"]} for c in channels if c.get("type") == 0]

@router.get("/discord/channels/all")
async def get_discord_all_channels(guild_id: str = None, db = Depends(get_db)):
    result = db.execute(select(SystemConfig).limit(1))
    config = result.scalars().first()
    if not config or not config.discord_token:
        return []
    target_guild = guild_id or config.guild_id
    if not target_guild:
        return []
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{target_guild}/channels",
            headers={"Authorization": f"Bot {config.discord_token}"}
        )
        if res.status_code != 200:
            return []
        channels = res.json()
        return [{"id": c["id"], "name": c["name"], "type": c.get("type", 0), "parent_id": c.get("parent_id"), "position": c.get("position", 0)} for c in channels]

@router.get("/discord/roles")
async def get_discord_roles(guild_id: str = None, db = Depends(get_db)):
    result = db.execute(select(SystemConfig).limit(1))
    config = result.scalars().first()
    if not config or not config.discord_token:
        return []
    target_guild = guild_id or config.guild_id
    if not target_guild:
        return []
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{target_guild}/roles",
            headers={"Authorization": f"Bot {config.discord_token}"}
        )
        if res.status_code != 200:
            return []
        roles = res.json()
        return [{"id": r["id"], "name": r["name"], "color": r.get("color", 0)} for r in roles if r.get("name") != "@everyone"]


@router.get("/discord/emojis")
async def get_discord_emojis(guild_id: str = None, db=Depends(get_db)):
    """Lấy danh sách emoji của guild."""
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.discord_token:
        return []
    target_guild = guild_id or config.guild_id
    if not target_guild:
        return []
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{target_guild}/emojis",
            headers={"Authorization": f"Bot {config.discord_token}"}
        )
        if res.status_code != 200:
            return []
        emojis = res.json()
        return [
            {
                "id": e["id"],
                "name": e["name"],
                "animated": e.get("animated", False),
                "url": f"https://cdn.discordapp.com/emojis/{e['id']}.{'gif' if e.get('animated') else 'png'}",
                "usage": f"<{'a' if e.get('animated') else ''}:{e['name']}:{e['id']}>",
            }
            for e in emojis
        ]


@router.post("/discord/emojis")
async def upload_discord_emoji(body: dict, db=Depends(get_db)):
    """Upload emoji mới lên guild. body: { name, image_base64 }"""
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.discord_token:
        raise HTTPException(status_code=400, detail="Bot chưa cấu hình")
    target_guild = config.guild_id
    if not target_guild:
        raise HTTPException(status_code=400, detail="Chưa chọn server")

    emoji_name = body.get("name", "").strip()
    image_b64 = body.get("image_base64", "")
    if not emoji_name or not image_b64:
        raise HTTPException(status_code=400, detail="Thiếu name hoặc image_base64")

    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"https://discord.com/api/guilds/{target_guild}/emojis",
            headers={"Authorization": f"Bot {config.discord_token}", "Content-Type": "application/json"},
            json={"name": emoji_name, "image": image_b64},
        )
        if res.status_code not in (200, 201):
            detail = res.json().get("message", "Lỗi upload emoji")
            raise HTTPException(status_code=400, detail=detail)
        e = res.json()
        return {
            "id": e["id"],
            "name": e["name"],
            "animated": e.get("animated", False),
            "url": f"https://cdn.discordapp.com/emojis/{e['id']}.{'gif' if e.get('animated') else 'png'}",
            "usage": f"<{'a' if e.get('animated') else ''}:{e['name']}:{e['id']}>",
        }


@router.delete("/discord/emojis/{emoji_id}")
async def delete_discord_emoji(emoji_id: str, db=Depends(get_db)):
    """Xóa emoji khỏi guild."""
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.discord_token:
        raise HTTPException(status_code=400, detail="Bot chưa cấu hình")
    target_guild = config.guild_id
    async with httpx.AsyncClient() as client:
        res = await client.delete(
            f"https://discord.com/api/guilds/{target_guild}/emojis/{emoji_id}",
            headers={"Authorization": f"Bot {config.discord_token}"},
        )
        if res.status_code not in (200, 204):
            raise HTTPException(status_code=400, detail="Xóa emoji thất bại")
    return {"ok": True}

def get_config(db = Depends(get_db)):
    result = db.execute(select(SystemConfig).limit(1))
    config = result.scalars().first()
    if not config:
        config = SystemConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

@router.get("/config", response_model=SystemConfigResponse)
def read_config(config: SystemConfig = Depends(get_config)):
    return config

@router.post("/config", response_model=SystemConfigResponse)
def update_config(config_in: SystemConfigBase, db = Depends(get_db)):
    result = db.execute(select(SystemConfig).limit(1))
    config = result.scalars().first()
    
    if not config:
        config = SystemConfig(**config_in.model_dump(exclude_none=True))
        db.add(config)
    else:
        for key, value in config_in.model_dump().items():
            # Only overwrite if value is explicitly provided (not None/empty keeps existing)
            if value is not None and value != "":
                setattr(config, key, value)
            
    db.commit()
    db.refresh(config)
    return config

@router.post("/bot/start")
async def api_start_bot():
    success = await start_bot()
    if not success:
        raise HTTPException(status_code=400, detail="Failed to start bot. Check token.")
    return {"message": "Bot starting..."}

@router.post("/bot/stop")
async def api_stop_bot():
    await stop_bot()
    return {"message": "Bot stopped."}

@router.post("/bot/restart")
async def api_restart_bot():
    await stop_bot()
    success = await start_bot()
    if not success:
        raise HTTPException(status_code=400, detail="Failed to start bot.")
    return {"message": "Bot restarting..."}


@router.get("/bot/info")
async def api_bot_info():
    """Trả về thông tin live của bot: latency, guilds, members, uptime, avatar, tên."""
    from src.bot.manager import bot as _bot, bot_start_time
    import datetime as _dt

    if _bot is None or not _bot.is_ready():
        return {
            "online": False,
            "username": None,
            "discriminator": None,
            "avatar_url": None,
            "bot_id": None,
            "latency_ms": None,
            "guild_count": None,
            "member_count": None,
            "uptime_seconds": None,
        }

    guilds = _bot.guilds
    member_count = sum(g.member_count or 0 for g in guilds)
    uptime_s = None
    if bot_start_time:
        uptime_s = int((_dt.datetime.utcnow() - bot_start_time).total_seconds())

    user = _bot.user
    avatar_url = str(user.display_avatar.url) if user and user.display_avatar else None

    return {
        "online": True,
        "username": user.name if user else None,
        "discriminator": user.discriminator if user else None,
        "avatar_url": avatar_url,
        "bot_id": str(user.id) if user else None,
        "latency_ms": round(_bot.latency * 1000, 1),
        "guild_count": len(guilds),
        "member_count": member_count,
        "uptime_seconds": uptime_s,
    }


@router.post("/bot/profile")
async def api_update_bot_profile(body: dict):
    """Đổi tên hoặc avatar của bot qua Discord API."""
    from src.bot.manager import bot as _bot
    import base64 as _b64
    import httpx as _httpx

    if _bot is None or not _bot.is_ready() or not _bot.user:
        raise HTTPException(status_code=400, detail="Bot chưa online")

    payload: dict = {}
    if "username" in body and body["username"]:
        payload["username"] = body["username"]
    if "avatar_url" in body and body["avatar_url"]:
        # Fetch image and convert to base64 data URI
        try:
            async with _httpx.AsyncClient() as client:
                r = await client.get(body["avatar_url"], timeout=10)
                r.raise_for_status()
                mime = r.headers.get("content-type", "image/png").split(";")[0]
                data = _b64.b64encode(r.content).decode()
                payload["avatar"] = f"data:{mime};base64,{data}"
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Không tải được avatar: {e}")
    if "avatar_base64" in body and body["avatar_base64"]:
        payload["avatar"] = body["avatar_base64"]

    if not payload:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật")

    try:
        await _bot.user.edit(**payload)
    except discord.HTTPException as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@router.post("/bot/presence")
async def api_update_presence(body: dict):
    """Đổi status (online/idle/dnd/invisible) và activity của bot."""
    from src.bot.manager import bot as _bot

    if _bot is None or not _bot.is_ready():
        raise HTTPException(status_code=400, detail="Bot chưa online")

    status_map = {
        "online": discord.Status.online,
        "idle": discord.Status.idle,
        "dnd": discord.Status.do_not_disturb,
        "invisible": discord.Status.invisible,
    }
    status = status_map.get(body.get("status", "online"), discord.Status.online)

    activity = None
    activity_type = body.get("activity_type", "")
    activity_name = body.get("activity_name", "")
    if activity_name:
        if activity_type == "playing":
            activity = discord.Game(name=activity_name)
        elif activity_type == "watching":
            activity = discord.Activity(type=discord.ActivityType.watching, name=activity_name)
        elif activity_type == "listening":
            activity = discord.Activity(type=discord.ActivityType.listening, name=activity_name)
        elif activity_type == "competing":
            activity = discord.Activity(type=discord.ActivityType.competing, name=activity_name)
        elif activity_type == "streaming":
            activity = discord.Streaming(name=activity_name, url=body.get("stream_url", "https://twitch.tv/discord"))

    try:
        await _bot.change_presence(status=status, activity=activity)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@router.get("/bot/emojis")
async def api_list_emojis(db=Depends(get_db)):
    """Trả về danh sách emoji của bot application."""
    import httpx as _httpx
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.discord_token:
        return []
    async with _httpx.AsyncClient() as client:
        r = await client.get("https://discord.com/api/oauth2/@me",
            headers={"Authorization": f"Bot {config.discord_token}"})
        if not r.is_success:
            return []
        app_id = r.json().get("application", {}).get("id")
        if not app_id:
            return []
        r2 = await client.get(f"https://discord.com/api/applications/{app_id}/emojis",
            headers={"Authorization": f"Bot {config.discord_token}"})
        if not r2.is_success:
            return []
        data = r2.json()
        emojis = data.get("items", data) if isinstance(data, dict) else data
        return [{"id": str(e["id"]), "name": e["name"], "animated": e.get("animated", False),
                 "url": f"https://cdn.discordapp.com/emojis/{e['id']}.{'gif' if e.get('animated') else 'png'}"}
                for e in (emojis or [])]


@router.post("/bot/emojis")
async def api_upload_emoji(body: dict, db=Depends(get_db)):
    """Upload emoji cho bot application."""
    import httpx as _httpx
    name = body.get("name", "").strip()
    image_data = body.get("image")
    if not name or not image_data:
        raise HTTPException(status_code=400, detail="Cần name và image")
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.discord_token:
        raise HTTPException(status_code=400, detail="Chưa cấu hình Bot Token")
    async with _httpx.AsyncClient() as client:
        r = await client.get("https://discord.com/api/oauth2/@me",
            headers={"Authorization": f"Bot {config.discord_token}"})
        if not r.is_success:
            raise HTTPException(status_code=400, detail="Không lấy được app ID")
        app_id = r.json().get("application", {}).get("id")
        r2 = await client.post(f"https://discord.com/api/applications/{app_id}/emojis",
            headers={"Authorization": f"Bot {config.discord_token}"},
            json={"name": name, "image": image_data})
        if not r2.is_success:
            raise HTTPException(status_code=400, detail=str(r2.text[:200]))
        e = r2.json()
        return {"ok": True, "id": str(e["id"]), "name": e["name"], "animated": e.get("animated", False),
                "url": f"https://cdn.discordapp.com/emojis/{e['id']}.{'gif' if e.get('animated') else 'png'}"}


@router.delete("/bot/emojis/{emoji_id}")
async def api_delete_emoji(emoji_id: str, db=Depends(get_db)):
    """Xóa emoji của bot application."""
    import httpx as _httpx
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.discord_token:
        raise HTTPException(status_code=400, detail="Chưa cấu hình Bot Token")
    async with _httpx.AsyncClient() as client:
        r = await client.get("https://discord.com/api/oauth2/@me",
            headers={"Authorization": f"Bot {config.discord_token}"})
        app_id = r.json().get("application", {}).get("id") if r.is_success else None
        if not app_id:
            raise HTTPException(status_code=400, detail="Không lấy được app ID")
        r2 = await client.delete(f"https://discord.com/api/applications/{app_id}/emojis/{emoji_id}",
            headers={"Authorization": f"Bot {config.discord_token}"})
        if r2.status_code not in (200, 204):
            raise HTTPException(status_code=400, detail="Xóa thất bại")
        return {"ok": True}


# --- Products ---
@router.get("/products", response_model=list[ProductResponse])
def get_products(db = Depends(get_db)):
    result = db.execute(select(Product).order_by(Product.id))
    return result.scalars().all()

@router.post("/products/upload-image")
async def upload_product_image(file: UploadFile = File(...)):
    """Upload ảnh sản phẩm, trả về URL tương đối."""
    upload_dir = "static/uploads"
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "img.jpg")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(upload_dir, filename)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"url": f"/static/uploads/{filename}"}

@router.post("/products", response_model=ProductResponse)
def create_product(product_in: ProductBase, db = Depends(get_db)):
    data = product_in.model_dump()
    data.setdefault("price", 0)
    product = Product(**data)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

@router.put("/products/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, product_in: ProductBase, db = Depends(get_db)):
    result = db.execute(select(Product).where(Product.id == product_id))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Sản phẩm không tồn tại")
    for key, value in product_in.model_dump().items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return product

@router.delete("/products/{product_id}")
def delete_product(product_id: int, db = Depends(get_db)):
    result = db.execute(select(Product).where(Product.id == product_id))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Sản phẩm không tồn tại")
    db.delete(product)
    db.commit()
    return {"ok": True}

# --- Orders ---
@router.get("/orders")
def get_orders(db = Depends(get_db)):
    result = db.execute(
        select(Order).options(joinedload(Order.user), joinedload(Order.product))
        .order_by(Order.created_at.desc())
    )
    orders = result.unique().scalars().all()
    out = []
    for o in orders:
        out.append({
            "id": o.id,
            "user_id": o.user_id,
            "product_id": o.product_id,
            "quantity": o.quantity,
            "total_price": float(o.total_price),
            "status": o.status,
            "payos_order_code": o.payos_order_code,
            "checkout_url": o.checkout_url,
            "package_name": o.package_name,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "user_discord_id": o.user.discord_id if o.user else None,
            "user_username": o.user.username if o.user else None,
            "product_name": o.product.name if o.product else None,
        })
    return out

@router.post("/orders")
def create_order(body: dict, db = Depends(get_db)):
    """Tạo đơn hàng thủ công từ Discord UID. Hỗ trợ custom product (không cần product_id)."""
    discord_uid = str(body.get("discord_uid", "")).strip()
    product_id = body.get("product_id")
    package_name = body.get("package_name")
    total_price = body.get("total_price", 0)
    custom_product_name = str(body.get("custom_product_name", "")).strip()  # tên SP custom
    send_qr_channel_id = str(body.get("send_qr_channel_id", "")).strip()    # kênh Discord gửi QR

    if not discord_uid:
        raise HTTPException(status_code=400, detail="Discord UID không được để trống")
    if not product_id and not custom_product_name:
        raise HTTPException(status_code=400, detail="Chọn sản phẩm hoặc nhập tên sản phẩm custom")

    # Tìm hoặc tạo user
    user = db.execute(select(User).where(User.discord_id == discord_uid)).scalars().first()
    if not user:
        user = User(discord_id=discord_uid, username=f"User {discord_uid}")
        db.add(user)
        db.flush()

    # Nếu custom: package_name lưu tên SP custom, product_id = None
    if custom_product_name and not product_id:
        package_name = custom_product_name
        product_id = None

    order = Order(
        user_id=user.id,
        product_id=product_id,
        quantity=body.get("quantity", 1),
        total_price=float(total_price),
        package_name=package_name,
        status=body.get("status", "PENDING"),
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # Nếu có channel_id và PayOS được cấu hình → tạo QR và gửi vào kênh
    qr_sent = False
    if send_qr_channel_id and float(total_price) > 0:
        import asyncio as _asyncio
        config = db.execute(select(SystemConfig).limit(1)).scalars().first()
        if config and all([config.payos_client_id, config.payos_api_key, config.payos_checksum_key]):
            from payos import PayOS as _PayOS
            from payos.type import ItemData as _ItemData, PaymentData as _PaymentData
            from src.bot.manager import bot as _bot
            import discord as _discord

            domain = config.public_app_url or "http://localhost:3034"
            if not domain.startswith("http"):
                domain = f"https://{domain}"

            try:
                payos = _PayOS(
                    client_id=config.payos_client_id,
                    api_key=config.payos_api_key,
                    checksum_key=config.payos_checksum_key,
                )
                product_display = custom_product_name or (package_name or f"Đơn #{order.id}")
                item = _ItemData(name=product_display[:40], quantity=1, price=int(float(total_price)))
                payment_data = _PaymentData(
                    orderCode=order.id,
                    amount=int(float(total_price)),
                    description=f"Don #{order.id}",
                    items=[item],
                    cancelUrl=f"{domain}/cancel",
                    returnUrl=f"{domain}/success",
                )
                payos_res = payos.createPaymentLink(payment_data)
                checkout_url = payos_res.checkoutUrl
                order.payos_order_code = str(order.id)
                order.checkout_url = checkout_url
                db.commit()

                # Gửi vào Discord channel qua bot
                async def _send_qr():
                    if not _bot:
                        return
                    try:
                        ch = _bot.get_channel(int(send_qr_channel_id))
                        if not ch:
                            ch = await _bot.fetch_channel(int(send_qr_channel_id))
                        if not ch:
                            return
                        embed = _discord.Embed(
                            title="🛒 Đơn hàng mới",
                            description=f"Vui lòng thanh toán để hoàn tất đơn hàng.\n⏰ Hết hạn sau **15 phút**.",
                            color=_discord.Color.gold(),
                        )
                        embed.add_field(name="🔢 ID Đơn", value=f"#{order.id}", inline=True)
                        embed.add_field(name="👤 Discord", value=f"<@{discord_uid}>", inline=True)
                        embed.add_field(name="📦 Sản phẩm", value=product_display, inline=False)
                        embed.add_field(name="💰 Số tiền", value=f"{float(total_price):,.0f} VNĐ", inline=True)
                        embed.set_footer(text="⏳ Đang chờ thanh toán...")
                        import datetime as _dt
                        embed.timestamp = _dt.datetime.utcnow()

                        from src.bot.cogs.admin_shop import OrderPayView
                        view = OrderPayView(
                            order_id=order.id,
                            price=float(total_price),
                            checkout_url=checkout_url,
                            admin_id=None,
                        )
                        msg = await ch.send(
                            content=f"<@{discord_uid}> Bạn có đơn hàng mới!",
                            embed=embed,
                            view=view,
                        )
                        view.message = msg
                        # Cập nhật message_id (cần session mới)
                        from src.database.config import SessionLocal as _SL
                        _db2 = _SL()
                        try:
                            _o = _db2.get(Order, order.id)
                            if _o:
                                _o.discord_message_id = str(msg.id)
                                _o.discord_channel_id = str(ch.id)
                                _db2.commit()
                        finally:
                            _db2.close()
                    except Exception as _e:
                        logger.error(f"send_qr_to_channel error: {_e}")

                # Schedule coroutine vào event loop của bot
                if _bot and _bot.loop:
                    _asyncio.run_coroutine_threadsafe(_send_qr(), _bot.loop)
                    qr_sent = True
            except Exception as e:
                logger.error(f"create_order QR error: {e}")

    return {"ok": True, "order_id": order.id, "qr_sent": qr_sent}

@router.put("/orders/{order_id}/status")
def update_order_status(order_id: int, body: dict, db = Depends(get_db)):
    result = db.execute(select(Order).where(Order.id == order_id))
    order = result.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Đơn hàng không tồn tại")
    new_status = body.get("status")
    valid = ["PENDING", "PAID", "DELIVERING", "DELIVERED", "CANCELLED", "ERROR"]
    if new_status not in valid:
        raise HTTPException(status_code=400, detail="Trạng thái không hợp lệ")
    order.status = new_status
    db.commit()
    return {"ok": True, "status": new_status}


@router.post("/orders/{order_id}/deliver")
async def deliver_order(order_id: int, body: dict, db = Depends(get_db)):
    """Giao hàng: cập nhật trạng thái + gửi DM cho user Discord."""
    result = db.execute(
        select(Order).options(joinedload(Order.user), joinedload(Order.product))
        .where(Order.id == order_id)
    )
    order = result.unique().scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Đơn hàng không tồn tại")

    dm_content = body.get("dm_content", "").strip()
    order.status = "DELIVERED"
    # cập nhật total_spent
    if order.user:
        order.user.total_spent = (order.user.total_spent or 0) + order.total_price
    db.commit()

    # Gửi DM qua bot Discord
    if dm_content and order.user:
        from src.bot.manager import bot
        if bot:
            try:
                discord_user = await bot.fetch_user(int(order.user.discord_id))
                if discord_user:
                    from src.bot.embed_utils import build_embed
                    dm_vars = {
                        "order.id": order.id,
                        "user.mention": f"<@{order.user.discord_id}>",
                        "user": order.user.username or order.user.discord_id,
                        "user.id": order.user.discord_id,
                        "product.name": order.product.name if order.product else (order.package_name or ""),
                        "package": order.package_name or "",
                        "order.total": f"{order.total_price:,.0f}",
                    }
                    dm_embed = build_embed("giao_hang", db, vars=dm_vars)
                    if dm_content:
                        dm_embed.add_field(name="Nội dung", value=dm_content, inline=False)
                    await discord_user.send(embed=dm_embed)
            except Exception as e:
                logger.error(f"deliver DM error: {e}")

    # Update Discord embed nếu có
    if order.discord_channel_id and order.discord_message_id:
        from src.bot.manager import bot
        if bot:
            try:
                import discord as _discord
                channel = bot.get_channel(int(order.discord_channel_id))
                if channel:
                    msg = await channel.fetch_message(int(order.discord_message_id))
                    if msg and msg.embeds:
                        embed = msg.embeds[0].copy()
                        embed.color = _discord.Color.green()
                        embed.set_footer(text="✅ Đã giao hàng thành công!")
                        await msg.edit(embed=embed, view=None)
            except Exception as e:
                logger.error(f"deliver embed update error: {e}")

    return {"ok": True}


# ─── Coupons ─────────────────────────────────────────────────

@router.get("/coupons")
def get_coupons(db = Depends(get_db)):
    result = db.execute(select(Coupon).order_by(Coupon.id.desc()))
    coupons = result.scalars().all()
    return [
        {
            "id": c.id, "code": c.code,
            "discount_percent": c.discount_percent,
            "discount_amount": c.discount_amount,
            "max_uses": c.max_uses, "used_count": c.used_count,
            "is_public": c.is_public,
        } for c in coupons
    ]

@router.post("/coupons")
def create_coupon(body: dict, db = Depends(get_db)):
    code = str(body.get("code", "")).strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Code không được trống")
    existing = db.execute(select(Coupon).where(Coupon.code == code)).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Code đã tồn tại")
    coupon = Coupon(
        code=code,
        discount_percent=body.get("discount_percent") or None,
        discount_amount=body.get("discount_amount") or None,
        max_uses=int(body.get("max_uses", 1)),
        is_public=bool(body.get("is_public", False)),
    )
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return {"ok": True, "id": coupon.id}

@router.put("/coupons/{coupon_id}")
def update_coupon(coupon_id: int, body: dict, db = Depends(get_db)):
    coupon = db.execute(select(Coupon).where(Coupon.id == coupon_id)).scalars().first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Không tìm thấy coupon")
    for field in ("discount_percent", "discount_amount", "max_uses", "is_public"):
        if field in body:
            val = body[field]
            if field in ("discount_percent", "discount_amount"):
                val = val or None
            setattr(coupon, field, val)
    db.commit()
    return {"ok": True}

@router.delete("/coupons/{coupon_id}")
def delete_coupon(coupon_id: int, db = Depends(get_db)):
    coupon = db.execute(select(Coupon).where(Coupon.id == coupon_id)).scalars().first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Không tìm thấy coupon")
    db.delete(coupon)
    db.commit()
    return {"ok": True}


# ─── Users ────────────────────────────────────────────────────

@router.get("/users")
def get_users(db = Depends(get_db)):
    result = db.execute(
        select(User).options(joinedload(User.orders)).order_by(User.total_spent.desc())
    )
    users = result.unique().scalars().all()
    out = []
    for u in users:
        paid_orders = [o for o in u.orders if o.status == "PAID"]
        out.append({
            "id": u.id,
            "discord_id": u.discord_id,
            "username": u.username,
            "total_spent": float(u.total_spent or 0),
            "order_count": len(u.orders),
            "paid_order_count": len(paid_orders),
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })
    return out


# ─── Stats (Dashboard) ────────────────────────────────────────

@router.get("/stats")
def get_stats(db = Depends(get_db)):
    # Revenue last 14 days
    since = datetime.datetime.utcnow() - datetime.timedelta(days=14)
    orders = db.execute(
        select(Order).where(Order.created_at >= since).order_by(Order.created_at)
    ).scalars().all()

    # Build day-by-day buckets
    days: dict[str, dict] = {}
    for i in range(14):
        d = (datetime.datetime.utcnow() - datetime.timedelta(days=13 - i)).strftime("%m/%d")
        days[d] = {"date": d, "revenue": 0, "orders": 0}

    for o in orders:
        d = o.created_at.strftime("%m/%d")
        if d in days:
            days[d]["orders"] += 1
            if o.status == "PAID":
                days[d]["revenue"] += float(o.total_price)

    # Summary totals
    all_orders = db.execute(select(Order)).scalars().all()
    total_revenue = sum(float(o.total_price) for o in all_orders if o.status == "PAID")
    total_users = db.execute(select(func.count(User.id))).scalar() or 0
    total_products = db.execute(select(func.count(Product.id))).scalar() or 0

    return {
        "chart": list(days.values()),
        "total_revenue": total_revenue,
        "total_orders": len(all_orders),
        "pending_orders": sum(1 for o in all_orders if o.status == "PENDING"),
        "total_users": total_users,
        "total_products": total_products,
    }

@router.get("/leaderboard")
def get_leaderboard(
    loai: str = "chi_tieu",  # chi_tieu | don_hang
    time: str = "all",       # all | 30days | 7days | daily
    db = Depends(get_db)
):
    """Bảng xếp hạng mua hàng — dùng cho cả Dashboard và /bxh bot."""
    from src.models.models import User as UserM
    now = datetime.datetime.utcnow()
    since_map = {
        "daily":   now - datetime.timedelta(days=1),
        "7days":   now - datetime.timedelta(days=7),
        "30days":  now - datetime.timedelta(days=30),
        "all":     None,
    }
    since = since_map.get(time)

    query = select(
        Order.user_id,
        func.count(Order.id).label("don_count"),
        func.sum(Order.total_price).label("total_spent"),
    ).where(Order.status == "PAID")
    if since:
        query = query.where(Order.created_at >= since)
    query = query.group_by(Order.user_id)

    if loai == "don_hang":
        query = query.order_by(func.count(Order.id).desc())
    else:
        query = query.order_by(func.sum(Order.total_price).desc())

    rows = db.execute(query.limit(20)).all()

    result = []
    for r in rows:
        user = db.get(UserM, r.user_id)
        result.append({
            "rank": len(result) + 1,
            "user_id": r.user_id,
            "discord_id": user.discord_id if user else None,
            "username": user.username if user else f"User #{r.user_id}",
            "don_count": r.don_count,
            "total_spent": float(r.total_spent or 0),
        })
    return result


# ─── PayOS Test Connection ────────────────────────────────────

@router.post("/payos/test")
def test_payos_connection(db=Depends(get_db)):
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not all([config.payos_client_id, config.payos_api_key, config.payos_checksum_key]):
        raise HTTPException(status_code=400, detail="PayOS chưa được cấu hình đầy đủ")
    try:
        payos = PayOS(
            client_id=config.payos_client_id,
            api_key=config.payos_api_key,
            checksum_key=config.payos_checksum_key,
        )
        # Verify credentials by attempting to confirm webhook URL
        # This makes a real API call to PayOS servers
        payos.confirmWebhook("https://example.com/webhook")
        return {"ok": True, "message": "Kết nối PayOS thành công"}
    except Exception as e:
        err_msg = str(e)
        if "Unauthorized" in err_msg or "401" in err_msg:
            raise HTTPException(status_code=400, detail="API Key hoặc Client ID không đúng")
        if "checksum" in err_msg.lower():
            raise HTTPException(status_code=400, detail="Checksum Key không đúng")
        raise HTTPException(status_code=400, detail=f"Lỗi kết nối: {err_msg}")


# ─── PayOS Test Connection ─────────────────────────────────────

@router.post("/payos/test")
def test_payos_connection(db=Depends(get_db)):
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not all([config.payos_client_id, config.payos_api_key, config.payos_checksum_key]):
        raise HTTPException(status_code=400, detail="PayOS chưa được cấu hình đầy đủ")
    try:
        payos = PayOS(
            client_id=config.payos_client_id,
            api_key=config.payos_api_key,
            checksum_key=config.payos_checksum_key,
        )
        # Verify credentials by calling a read-only API
        payos.confirmWebhook("https://example.com")
        return {"ok": True, "message": "Kết nối PayOS thành công"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi kết nối: {str(e)}")


# ─── PayOS Webhook ────────────────────────────────────────────

@router.post("/payos/webhook")
async def payos_webhook(request: Request, db = Depends(get_db)):
    body = await request.json()
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.payos_checksum_key:
        return {"code": "00", "desc": "no config"}
    try:
        payos = PayOS(
            client_id=config.payos_client_id,
            api_key=config.payos_api_key,
            checksum_key=config.payos_checksum_key,
        )
        webhook_data = payos.verifyPaymentWebhookData(body)
    except Exception as e:
        logger.error(f"PayOS webhook verify error: {e}")
        return {"code": "00", "desc": "verify error"}

    if webhook_data.code == "00":
        order_code = str(webhook_data.orderCode)
        order = db.execute(
            select(Order).options(joinedload(Order.user), joinedload(Order.product))
            .where(Order.payos_order_code == order_code)
        ).unique().scalars().first()

        if order and order.status == "PENDING":
            order.status = "PAID"
            if order.user:
                order.user.total_spent = (order.user.total_spent or 0) + order.total_price
            db.commit()

            # Cập nhật embed Discord → màu xanh + dùng template thanh_toan để gửi DM
            from src.bot.manager import bot
            from src.bot.embed_utils import build_embed
            if bot and order.discord_channel_id and order.discord_message_id:
                try:
                    channel = bot.get_channel(int(order.discord_channel_id))
                    if channel:
                        msg = await channel.fetch_message(int(order.discord_message_id))
                        if msg and msg.embeds:
                            paid_embed = msg.embeds[0].copy()
                            paid_embed.color = discord.Color.green()
                            paid_embed.set_footer(text="Trạng thái: ✅ Đã thanh toán thành công!")
                            await msg.edit(embed=paid_embed, view=None)
                except Exception as e:
                    logger.error(f"Discord embed update error: {e}")

            # Gửi DM thanh toán thành công cho user
            if bot and order.user:
                try:
                    discord_user = await bot.fetch_user(int(order.user.discord_id))
                    if discord_user:
                        dm_embed = build_embed("thanh_toan", db, vars={
                            "order.id": order.id,
                            "user.mention": f"<@{order.user.discord_id}>",
                            "user": order.user.username or order.user.discord_id,
                            "user.id": order.user.discord_id,
                            "product.name": order.product.name if order.product else (order.package_name or ""),
                            "package": order.package_name or "",
                            "order.total": f"{order.total_price:,.0f}",
                        })
                        await discord_user.send(embed=dm_embed)
                except Exception as e:
                    logger.error(f"PayOS webhook DM error: {e}")

    return {"code": "00", "desc": "success"}


# ─── Giveaways (Dashboard) ────────────────────────────────────

@router.get("/giveaways")
def get_giveaways(db = Depends(get_db)):
    from src.models.models import Giveaway, GiveawayEntry
    rows = db.execute(
        select(Giveaway).options(joinedload(Giveaway.entries)).order_by(Giveaway.created_at.desc())
    ).unique().scalars().all()
    return [
        {
            "id": g.id, "title": g.title, "prize": g.prize,
            "winners_count": g.winners_count,
            "entries_count": len(g.entries),
            "ended": g.ended,
            "ends_at": g.ends_at.isoformat() if g.ends_at else None,
        } for g in rows
    ]


# ─── Temp Voice (Dashboard) ──────────────────────────────────

@router.get("/tempvoice/config")
def get_tempvoice(db = Depends(get_db)):
    from src.models.models import TempVoiceConfig
    cfg = db.execute(select(TempVoiceConfig).limit(1)).scalars().first()
    if not cfg:
        return {
            "enabled": False, "join_channel_id": None, "category_id": None,
            "default_user_limit": 0, "default_bitrate": 64000,
            "naming_format": "{user}'s Channel", "auto_delete_seconds": 0,
            "allow_rename": True, "allow_limit": True, "allow_lock": True, "allow_hide": True,
            "interface_channel_id": None,
        }
    return {
        "enabled": cfg.enabled,
        "join_channel_id": cfg.join_channel_id,
        "category_id": cfg.category_id,
        "default_user_limit": cfg.default_user_limit or 0,
        "default_bitrate": cfg.default_bitrate or 64000,
        "naming_format": cfg.naming_format or "{user}'s Channel",
        "auto_delete_seconds": cfg.auto_delete_seconds or 0,
        "allow_rename": cfg.allow_rename if cfg.allow_rename is not None else True,
        "allow_limit": cfg.allow_limit if cfg.allow_limit is not None else True,
        "allow_lock": cfg.allow_lock if cfg.allow_lock is not None else True,
        "allow_hide": cfg.allow_hide if cfg.allow_hide is not None else True,
        "interface_channel_id": cfg.interface_channel_id,
    }

@router.post("/tempvoice/config")
def save_tempvoice(body: dict, db = Depends(get_db)):
    from src.models.models import TempVoiceConfig, SystemConfig as SC
    system = db.execute(select(SC).limit(1)).scalars().first()
    guild_id = system.guild_id if system else None
    cfg = db.execute(select(TempVoiceConfig).limit(1)).scalars().first()
    if not cfg:
        cfg = TempVoiceConfig(guild_id=guild_id)
        db.add(cfg)
    cfg.enabled = body.get("enabled", True)
    cfg.join_channel_id = body.get("join_channel_id") or None
    cfg.category_id = body.get("category_id") or None
    cfg.default_user_limit = body.get("default_user_limit", 0)
    cfg.default_bitrate = body.get("default_bitrate", 64000)
    cfg.naming_format = body.get("naming_format", "{user}'s Channel")
    cfg.auto_delete_seconds = body.get("auto_delete_seconds", 0)
    cfg.allow_rename = body.get("allow_rename", True)
    cfg.allow_limit = body.get("allow_limit", True)
    cfg.allow_lock = body.get("allow_lock", True)
    cfg.allow_hide = body.get("allow_hide", True)
    cfg.interface_channel_id = body.get("interface_channel_id") or None
    if guild_id:
        cfg.guild_id = guild_id
    db.commit()
    return {"ok": True}

# ─────────────────────────── EMBED TEMPLATES ───────────────────────────────

@router.get("/embeds")
def list_embeds(db = Depends(get_db)):
    from src.models.models import EmbedTemplate
    rows = db.execute(select(EmbedTemplate).order_by(EmbedTemplate.id)).scalars().all()
    return [
        {
            "id": r.id, "name": r.name, "event_type": r.event_type,
            "title": r.title, "description": r.description, "color": r.color,
            "author": r.author, "footer": r.footer,
            "thumbnail_url": r.thumbnail_url, "image_url": r.image_url,
            "fields": r.fields or [], "enabled": r.enabled,
        }
        for r in rows
    ]

@router.post("/embeds")
def create_embed(body: dict, db = Depends(get_db)):
    from src.models.models import EmbedTemplate
    import datetime
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
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return {"id": e.id, "name": e.name}

@router.put("/embeds/{embed_id}")
def update_embed(embed_id: int, body: dict, db = Depends(get_db)):
    from src.models.models import EmbedTemplate
    import datetime
    e = db.get(EmbedTemplate, embed_id)
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    for k in ("name","event_type","title","description","color","author","footer","thumbnail_url","image_url","fields","enabled"):
        if k in body:
            setattr(e, k, body[k])
    e.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"ok": True}

@router.delete("/embeds/{embed_id}")
def delete_embed(embed_id: int, db = Depends(get_db)):
    from src.models.models import EmbedTemplate
    e = db.get(EmbedTemplate, embed_id)
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(e)
    db.commit()
    return {"ok": True}

# ─────────────────────────── USERS MANAGER ─────────────────────────────────

@router.get("/users")
def list_users(db = Depends(get_db)):
    from src.models.models import User, Order, BannedShopUser
    users = db.execute(select(User).order_by(User.total_spent.desc())).scalars().all()
    banned_ids = {
        b.discord_id for b in db.execute(select(BannedShopUser)).scalars().all()
    }
    result = []
    for u in users:
        order_count = db.execute(
            select(func.count()).where(Order.user_id == u.id)
        ).scalar() or 0
        result.append({
            "id": u.id,
            "discord_id": u.discord_id,
            "username": u.username,
            "total_spent": u.total_spent or 0,
            "order_count": order_count,
            "is_banned": u.discord_id in banned_ids,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })
    return result

@router.get("/users/{user_id}/orders")
def get_user_orders(user_id: int, db = Depends(get_db)):
    from src.models.models import User, Order, Product
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Not found")
    orders = db.execute(
        select(Order).where(Order.user_id == user_id).order_by(Order.created_at.desc()).limit(20)
    ).scalars().all()
    result = []
    for o in orders:
        product = db.get(Product, o.product_id) if o.product_id else None
        result.append({
            "id": o.id,
            "product_name": product.name if product else "?",
            "package_name": o.package_name,
            "quantity": o.quantity,
            "total_price": o.total_price,
            "status": o.status,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        })
    return result

@router.post("/users/{user_id}/ban")
def ban_user(user_id: int, body: dict, db = Depends(get_db)):
    from src.models.models import User, BannedShopUser
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Not found")
    existing = db.execute(select(BannedShopUser).where(BannedShopUser.discord_id == user.discord_id)).scalars().first()
    if not existing:
        ban = BannedShopUser(
            discord_id=user.discord_id,
            reason=body.get("reason", ""),
            banned_by=body.get("banned_by", "admin"),
        )
        db.add(ban)
        db.commit()
    return {"ok": True}

@router.post("/users/{user_id}/unban")
def unban_user(user_id: int, db = Depends(get_db)):
    from src.models.models import User, BannedShopUser
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Not found")
    ban = db.execute(select(BannedShopUser).where(BannedShopUser.discord_id == user.discord_id)).scalars().first()
    if ban:
        db.delete(ban)
        db.commit()
    return {"ok": True}

# ─────────────────────────── INVITE TRACKING ───────────────────────────────

@router.get("/invites")
def list_invites(db = Depends(get_db)):
    from src.models.models import InviteTracking
    rows = db.execute(
        select(
            InviteTracking.inviter_id,
            func.count().label("total"),
            func.sum(case((InviteTracking.left == False, 1), else_=0)).label("active"),
            func.sum(case((InviteTracking.left == True, 1), else_=0)).label("left"),
            func.sum(case((InviteTracking.is_fake == True, 1), else_=0)).label("fake"),
        ).group_by(InviteTracking.inviter_id).order_by(func.count().desc())
    ).all()
    return [
        {
            "inviter_id": r.inviter_id,
            "total": r.total,
            "active": r.active or 0,
            "left": r.left or 0,
            "fake": r.fake or 0,
        }
        for r in rows
    ]

@router.get("/invites/leaderboard")
def invites_leaderboard(db = Depends(get_db)):
    return list_invites(db=db)

@router.get("/invites/log")
def invites_log(db = Depends(get_db)):
    from src.models.models import InviteTracking
    rows = db.execute(
        select(InviteTracking).order_by(InviteTracking.joined_at.desc()).limit(100)
    ).scalars().all()
    return [
        {
            "id": r.id,
            "inviter_id": r.inviter_id,
            "invitee_id": r.invitee_id,
            "invite_code": r.invite_code,
            "joined_at": r.joined_at.isoformat() if r.joined_at else None,
            "left": r.left,
            "is_fake": r.is_fake,
        }
        for r in rows
    ]

# ─────────────────────────── GIVEAWAYS MANAGER ─────────────────────────────

@router.get("/giveaways")
def list_giveaways(db = Depends(get_db)):
    from src.models.models import Giveaway, GiveawayEntry
    rows = db.execute(
        select(Giveaway).order_by(Giveaway.created_at.desc()).limit(50)
    ).scalars().all()
    result = []
    for g in rows:
        entry_count = db.execute(
            select(func.count()).where(GiveawayEntry.giveaway_id == g.id)
        ).scalar() or 0
        result.append({
            "id": g.id,
            "title": g.title,
            "prize": g.prize,
            "winners_count": g.winners_count,
            "ends_at": g.ends_at.isoformat() if g.ends_at else None,
            "ended": g.ended,
            "host_id": g.host_id,
            "entry_count": entry_count,
            "channel_id": g.channel_id,
            "created_at": g.created_at.isoformat() if g.created_at else None,
        })
    return result

@router.delete("/giveaways/{giveaway_id}")
def delete_giveaway(giveaway_id: int, db = Depends(get_db)):
    from src.models.models import Giveaway
    g = db.get(Giveaway, giveaway_id)
    if not g:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(g)
    db.commit()
    return {"ok": True}

# ─────────────────────────── WARNINGS ──────────────────────────────────────

@router.get("/warnings")
def list_warnings(db = Depends(get_db)):
    from src.models.models import Warning
    rows = db.execute(
        select(Warning).order_by(Warning.created_at.desc()).limit(200)
    ).scalars().all()
    return [
        {
            "id": r.id, "discord_id": r.discord_id, "guild_id": r.guild_id,
            "reason": r.reason, "moderator_id": r.moderator_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]

@router.delete("/warnings/{warning_id}")
def delete_warning(warning_id: int, db = Depends(get_db)):
    from src.models.models import Warning
    w = db.get(Warning, warning_id)
    if not w:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(w)
    db.commit()
    return {"ok": True}

# ─────────────────────────── FEEDBACK ──────────────────────────────────────

@router.get("/feedback")
def list_feedback(db = Depends(get_db)):
    from src.models.models import Feedback, User as UserM, Product
    rows = db.execute(
        select(Feedback).order_by(Feedback.created_at.desc()).limit(200)
    ).scalars().all()
    result = []
    for r in rows:
        user = db.get(UserM, r.user_id) if r.user_id else None
        product = db.get(Product, r.product_id) if r.product_id else None
        result.append({
            "id": r.id,
            "user_discord_id": user.discord_id if user else None,
            "username": user.username if user else "Unknown",
            "product_id": r.product_id,
            "product_name": product.name if product else None,
            "stars": r.stars,
            "content": r.content,
            "discord_message_id": r.discord_message_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return result

@router.delete("/feedback/{feedback_id}")
async def delete_feedback(feedback_id: int, db = Depends(get_db)):
    from src.models.models import Feedback
    fb = db.get(Feedback, feedback_id)
    if not fb:
        raise HTTPException(status_code=404, detail="Not found")
    
    # Xóa Discord message nếu có
    if fb.discord_message_id:
        try:
            from src.bot.manager import bot
            from src.models.models import SystemConfig
            config = db.execute(select(SystemConfig).limit(1)).scalars().first()
            feedback_channel_id = config.feedback_channel_id if config else None
            if bot and feedback_channel_id:
                ch = bot.get_channel(int(feedback_channel_id))
                if not ch:
                    ch = await bot.fetch_channel(int(feedback_channel_id))
                if ch:
                    try:
                        msg = await ch.fetch_message(int(fb.discord_message_id))
                        await msg.delete()
                    except Exception:
                        pass
        except Exception as e:
            logger.error(f"delete feedback discord msg error: {e}")
    
    db.delete(fb)
    db.commit()
    return {"ok": True}


# ── Sticky Message Routes ─────────────────────────────────────────────────────

@router.get("/sticky")
def list_stickies(db=Depends(get_db)):
    """Lấy tất cả sticky messages."""
    stickies = db.execute(select(StickyMessage).order_by(StickyMessage.created_at.desc())).scalars().all()
    out = []
    for s in stickies:
        out.append({
            "id": s.id,
            "guild_id": s.guild_id,
            "channel_id": s.channel_id,
            "content": s.content,
            "embed_enabled": s.embed_enabled,
            "embed_title": s.embed_title,
            "embed_description": s.embed_description,
            "embed_color": s.embed_color,
            "embed_footer": s.embed_footer,
            "embed_image_url": s.embed_image_url,
            "embed_thumbnail_url": s.embed_thumbnail_url,
            "message_count_trigger": s.message_count_trigger,
            "interval_minutes": s.interval_minutes,
            "is_enabled": s.is_enabled,
            "is_pinned": s.is_pinned,
            "resend_count": s.resend_count or 0,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "last_sent": s.last_sent.isoformat() if s.last_sent else None,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
        })
    return out


@router.post("/sticky")
def create_sticky(body: dict, db=Depends(get_db)):
    """Tạo hoặc cập nhật sticky cho một kênh (từ dashboard)."""
    channel_id = str(body.get("channel_id", "")).strip()
    if not channel_id:
        raise HTTPException(status_code=400, detail="channel_id required")

    existing = db.execute(select(StickyMessage).where(StickyMessage.channel_id == channel_id)).scalars().first()

    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    guild_id = config.guild_id if config else ""

    if existing:
        # Update existing
        for field in ["content", "embed_enabled", "embed_title", "embed_description",
                      "embed_color", "embed_footer", "embed_image_url", "embed_thumbnail_url",
                      "message_count_trigger", "interval_minutes", "is_enabled", "is_pinned"]:
            if field in body:
                setattr(existing, field, body[field])
        db.commit()
        return {"ok": True, "id": existing.id}
    else:
        sticky = StickyMessage(
            guild_id=guild_id,
            channel_id=channel_id,
            content=body.get("content"),
            embed_enabled=body.get("embed_enabled", False),
            embed_title=body.get("embed_title"),
            embed_description=body.get("embed_description"),
            embed_color=body.get("embed_color", "#5865F2"),
            embed_footer=body.get("embed_footer"),
            embed_image_url=body.get("embed_image_url"),
            embed_thumbnail_url=body.get("embed_thumbnail_url"),
            message_count_trigger=body.get("message_count_trigger", 1),
            interval_minutes=body.get("interval_minutes", 0),
            is_enabled=body.get("is_enabled", True),
            is_pinned=body.get("is_pinned", False),
        )
        db.add(sticky)
        db.commit()
        db.refresh(sticky)
        return {"ok": True, "id": sticky.id}


@router.put("/sticky/{sticky_id}")
def update_sticky(sticky_id: int, body: dict, db=Depends(get_db)):
    sticky = db.get(StickyMessage, sticky_id)
    if not sticky:
        raise HTTPException(status_code=404, detail="Sticky not found")
    for field in ["content", "embed_enabled", "embed_title", "embed_description",
                  "embed_color", "embed_footer", "embed_image_url", "embed_thumbnail_url",
                  "message_count_trigger", "interval_minutes", "is_enabled", "is_pinned"]:
        if field in body:
            setattr(sticky, field, body[field])
    db.commit()
    return {"ok": True}


@router.delete("/sticky/{sticky_id}")
def delete_sticky(sticky_id: int, db=Depends(get_db)):
    sticky = db.get(StickyMessage, sticky_id)
    if not sticky:
        raise HTTPException(status_code=404, detail="Sticky not found")
    # Try delete from Discord via bot
    try:
        from src.bot.manager import bot as _bot
        import asyncio as _asyncio
        if _bot and sticky.last_message_id:
            async def _del():
                try:
                    ch = await _bot.fetch_channel(int(sticky.channel_id))
                    msg = await ch.fetch_message(int(sticky.last_message_id))
                    await msg.delete()
                except Exception:
                    pass
            if _bot.loop:
                _asyncio.run_coroutine_threadsafe(_del(), _bot.loop)
    except Exception:
        pass
    db.delete(sticky)
    db.commit()
    return {"ok": True}


@router.post("/sticky/{sticky_id}/resend")
def resend_sticky(sticky_id: int, db=Depends(get_db)):
    """Force resend sticky từ dashboard."""
    sticky = db.get(StickyMessage, sticky_id)
    if not sticky:
        raise HTTPException(status_code=404, detail="Sticky not found")
    try:
        from src.bot.manager import bot as _bot
        from src.bot.cogs.sticky import _do_resend
        import asyncio as _asyncio
        if _bot and _bot.loop:
            future = _asyncio.run_coroutine_threadsafe(_do_resend(_bot, sticky, db), _bot.loop)
            future.result(timeout=5)
            return {"ok": True}
        return {"ok": False, "detail": "Bot không online"}
    except Exception as e:
        logger.error(f"resend_sticky error: {e}")
        return {"ok": False, "detail": str(e)}


@router.get("/sticky/stats")
def sticky_stats(db=Depends(get_db)):
    from sqlalchemy import func as _func
    stickies = db.execute(select(StickyMessage)).scalars().all()
    return {
        "total": len(stickies),
        "active": sum(1 for s in stickies if s.is_enabled),
        "total_resends": sum(s.resend_count or 0 for s in stickies),
        "embed_count": sum(1 for s in stickies if s.embed_enabled),
        "pinned_count": sum(1 for s in stickies if s.is_pinned),
    }


# ── Ticket System Routes ──────────────────────────────────────────────────────

# ── Ticket Config ─────────────────────────────────────────────────────────────

@router.get("/ticket-config")
def get_ticket_config(db=Depends(get_db)):
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    guild_id = config.guild_id if config else None
    if not guild_id:
        return {"guild_id": None}
    tc = db.execute(select(TicketConfig).where(TicketConfig.guild_id == guild_id)).scalars().first()
    if not tc:
        return {"guild_id": guild_id, "category_id": None, "log_channel_id": None,
                "support_role_ids": [], "ticket_limit": 1, "cooldown_minutes": 0,
                "auto_close_hours": 0, "naming_format": "ticket-{number}",
                "open_message_title": None, "open_message_body": None,
                "close_message_title": None, "close_message_body": None,
                "claim_message_title": None, "claim_message_body": None}
    return {
        "id": tc.id, "guild_id": tc.guild_id, "category_id": tc.category_id,
        "log_channel_id": tc.log_channel_id, "support_role_ids": tc.support_role_ids or [],
        "ticket_limit": tc.ticket_limit, "cooldown_minutes": tc.cooldown_minutes,
        "auto_close_hours": tc.auto_close_hours, "naming_format": tc.naming_format,
        "open_message_title": tc.open_message_title, "open_message_body": tc.open_message_body,
        "close_message_title": tc.close_message_title, "close_message_body": tc.close_message_body,
        "claim_message_title": tc.claim_message_title, "claim_message_body": tc.claim_message_body,
    }


@router.put("/ticket-config")
def update_ticket_config(body: dict, db=Depends(get_db)):
    sc = db.execute(select(SystemConfig).limit(1)).scalars().first()
    guild_id = sc.guild_id if sc else None
    if not guild_id:
        raise HTTPException(status_code=400, detail="guild_id not configured")
    tc = db.execute(select(TicketConfig).where(TicketConfig.guild_id == guild_id)).scalars().first()
    if not tc:
        tc = TicketConfig(guild_id=guild_id)
        db.add(tc)
    for field in ["category_id", "log_channel_id", "support_role_ids",
                  "ticket_limit", "cooldown_minutes", "auto_close_hours", "naming_format",
                  "open_message_title", "open_message_body",
                  "close_message_title", "close_message_body",
                  "claim_message_title", "claim_message_body"]:
        if field in body:
            setattr(tc, field, body[field])
    db.commit()
    return {"ok": True}


# ── Ticket Panels ─────────────────────────────────────────────────────────────

@router.get("/ticket-panels")
def list_ticket_panels(db=Depends(get_db)):
    panels = db.execute(
        select(TicketPanel).options(joinedload(TicketPanel.buttons)).order_by(TicketPanel.created_at.desc())
    ).unique().scalars().all()
    result = []
    for p in panels:
        btns = sorted(p.buttons, key=lambda b: b.sort_order) if p.buttons else []
        # Fallback: nếu chưa có buttons mới, dùng legacy single-button fields
        if not btns and p.button_label:
            btns_data = [{"id": 0, "label": p.button_label, "emoji": p.button_emoji or "", "style": p.button_style or "primary", "category_id": p.category_id or "", "form_id": None, "sort_order": 0}]
        else:
            btns_data = [{"id": b.id, "label": b.label, "emoji": b.emoji or "", "style": b.style, "category_id": b.category_id or "", "form_id": b.form_id, "sort_order": b.sort_order} for b in btns]
        result.append({
            "id": p.id, "guild_id": p.guild_id, "name": p.name,
            "channel_id": p.channel_id, "message_id": p.message_id,
            "group_id": p.group_id,
            "title": p.title, "description": p.description, "color": p.color,
            # Per-panel overrides (null = dùng global)
            "naming_format": p.naming_format,
            "open_message_title": p.open_message_title,
            "open_message_body": p.open_message_body,
            "close_message_title": p.close_message_title,
            "close_message_body": p.close_message_body,
            "claim_message_title": p.claim_message_title,
            "claim_message_body": p.claim_message_body,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "is_sent": bool(p.message_id),
            "buttons": btns_data,
        })
    return result


@router.post("/ticket-panels")
def create_ticket_panel(body: dict, db=Depends(get_db)):
    sc = db.execute(select(SystemConfig).limit(1)).scalars().first()
    guild_id = sc.guild_id if sc else ""
    panel = TicketPanel(
        guild_id=guild_id,
        name=body.get("name", "Panel"),
        title=body.get("title", "Hỗ trợ"),
        description=body.get("description", "Nhấn nút bên dưới để tạo ticket hỗ trợ."),
        color=body.get("color", "#5865F2"),
        group_id=body.get("group_id"),
        naming_format=body.get("naming_format"),
        open_message_title=body.get("open_message_title"),
        open_message_body=body.get("open_message_body"),
        close_message_title=body.get("close_message_title"),
        close_message_body=body.get("close_message_body"),
        claim_message_title=body.get("claim_message_title"),
        claim_message_body=body.get("claim_message_body"),
    )
    db.add(panel)
    db.flush()  # get panel.id
    # Add buttons
    for idx, btn_data in enumerate(body.get("buttons", [])):
        btn = PanelButton(
            panel_id=panel.id,
            label=btn_data.get("label", "Tạo Ticket"),
            emoji=btn_data.get("emoji"),
            style=btn_data.get("style", "primary"),
            category_id=btn_data.get("category_id"),
            form_id=btn_data.get("form_id"),
            sort_order=idx,
        )
        db.add(btn)
    db.commit()
    db.refresh(panel)
    return {"ok": True, "id": panel.id}


@router.put("/ticket-panels/{panel_id}")
def update_ticket_panel(panel_id: int, body: dict, db=Depends(get_db)):
    panel = db.get(TicketPanel, panel_id)
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    for field in ["name", "title", "description", "color", "channel_id", "group_id",
                   "naming_format", "open_message_title", "open_message_body",
                   "close_message_title", "close_message_body",
                   "claim_message_title", "claim_message_body"]:
        if field in body:
            setattr(panel, field, body[field])
    # Replace buttons
    if "buttons" in body:
        # Delete old buttons
        for old_btn in list(panel.buttons):
            db.delete(old_btn)
        db.flush()
        # Add new buttons
        for idx, btn_data in enumerate(body["buttons"]):
            btn = PanelButton(
                panel_id=panel.id,
                label=btn_data.get("label", "Tạo Ticket"),
                emoji=btn_data.get("emoji"),
                style=btn_data.get("style", "primary"),
                category_id=btn_data.get("category_id"),
                form_id=btn_data.get("form_id"),
                sort_order=idx,
            )
            db.add(btn)
    db.commit()
    return {"ok": True}


@router.delete("/ticket-panels/{panel_id}")
def delete_ticket_panel(panel_id: int, db=Depends(get_db)):
    panel = db.get(TicketPanel, panel_id)
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    # Try delete Discord message
    if panel.message_id and panel.channel_id:
        try:
            from src.bot.manager import bot as _bot
            import asyncio as _asyncio
            if _bot and _bot.loop:
                async def _del():
                    try:
                        ch = await _bot.fetch_channel(int(panel.channel_id))
                        msg = await ch.fetch_message(int(panel.message_id))
                        await msg.delete()
                    except Exception:
                        pass
                _asyncio.run_coroutine_threadsafe(_del(), _bot.loop)
        except Exception:
            pass
    db.delete(panel)
    db.commit()
    return {"ok": True}


# ── Ticket Panel Groups ──────────────────────────────────────────────────────

@router.get("/ticket-panel-groups")
def list_ticket_panel_groups(db=Depends(get_db)):
    groups = db.execute(
        select(TicketPanelGroup)
        .options(joinedload(TicketPanelGroup.panels).joinedload(TicketPanel.buttons))
        .order_by(TicketPanelGroup.created_at.desc())
    ).unique().scalars().all()
    result = []
    for g in groups:
        panel_ids = [p.id for p in g.panels] if g.panels else []
        result.append({
            "id": g.id, "guild_id": g.guild_id, "name": g.name,
            "channel_id": g.channel_id, "message_id": g.message_id,
            "title": g.title, "description": g.description, "color": g.color,
            "created_at": g.created_at.isoformat() if g.created_at else None,
            "is_sent": bool(g.message_id),
            "panel_ids": panel_ids,
        })
    return result


@router.post("/ticket-panel-groups")
def create_ticket_panel_group(body: dict, db=Depends(get_db)):
    sc = db.execute(select(SystemConfig).limit(1)).scalars().first()
    guild_id = sc.guild_id if sc else ""
    group = TicketPanelGroup(
        guild_id=guild_id,
        name=body.get("name", "Multi Panel"),
        title=body.get("title", "Hỗ trợ"),
        description=body.get("description", ""),
        color=body.get("color", "#5865F2"),
        channel_id=body.get("channel_id"),
    )
    db.add(group)
    db.flush()
    # Assign panels if provided
    for pid in body.get("panel_ids", []):
        panel = db.get(TicketPanel, pid)
        if panel:
            panel.group_id = group.id
    db.commit()
    db.refresh(group)
    return {"ok": True, "id": group.id}


@router.put("/ticket-panel-groups/{group_id}")
def update_ticket_panel_group(group_id: int, body: dict, db=Depends(get_db)):
    group = db.get(TicketPanelGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    for field in ["name", "title", "description", "color", "channel_id"]:
        if field in body:
            setattr(group, field, body[field])
    # Reassign panels
    if "panel_ids" in body:
        # Unassign old panels
        old_panels = db.execute(
            select(TicketPanel).where(TicketPanel.group_id == group_id)
        ).scalars().all()
        for p in old_panels:
            p.group_id = None
        # Assign new panels
        for pid in body["panel_ids"]:
            panel = db.get(TicketPanel, pid)
            if panel:
                panel.group_id = group_id
    db.commit()
    return {"ok": True}


@router.delete("/ticket-panel-groups/{group_id}")
def delete_ticket_panel_group(group_id: int, db=Depends(get_db)):
    group = db.get(TicketPanelGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    # Unassign panels (don't delete them)
    panels = db.execute(
        select(TicketPanel).where(TicketPanel.group_id == group_id)
    ).scalars().all()
    for p in panels:
        p.group_id = None
    db.delete(group)
    db.commit()
    return {"ok": True}


# ── Ticket Panel Resolved Config ──────────────────────────────────────────────

@router.get("/ticket-panels/{panel_id}/resolved-config")
def get_panel_resolved_config(panel_id: int, db=Depends(get_db)):
    """Return merged config: panel overrides + global TicketConfig fallback."""
    panel = db.get(TicketPanel, panel_id)
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    cfg = db.execute(select(TicketConfig).limit(1)).scalars().first()
    def resolve(panel_val, global_val, default=""):
        return panel_val if panel_val is not None else (global_val if global_val is not None else default)
    return {
        "naming_format": resolve(panel.naming_format, cfg.naming_format if cfg else None, "ticket-{number}"),
        "open_message_title": resolve(panel.open_message_title, cfg.open_message_title if cfg else None),
        "open_message_body": resolve(panel.open_message_body, cfg.open_message_body if cfg else None),
        "close_message_title": resolve(panel.close_message_title, cfg.close_message_title if cfg else None),
        "close_message_body": resolve(panel.close_message_body, cfg.close_message_body if cfg else None),
        "claim_message_title": resolve(panel.claim_message_title, cfg.claim_message_title if cfg else None),
        "claim_message_body": resolve(panel.claim_message_body, cfg.claim_message_body if cfg else None),
        "source": {
            "naming_format": "panel" if panel.naming_format is not None else "global",
            "open_message_title": "panel" if panel.open_message_title is not None else "global",
            "open_message_body": "panel" if panel.open_message_body is not None else "global",
            "close_message_title": "panel" if panel.close_message_title is not None else "global",
            "close_message_body": "panel" if panel.close_message_body is not None else "global",
            "claim_message_title": "panel" if panel.claim_message_title is not None else "global",
            "claim_message_body": "panel" if panel.claim_message_body is not None else "global",
        }
    }


# ── Tickets ───────────────────────────────────────────────────────────────────

@router.get("/tickets")
def list_tickets(status: str = None, db=Depends(get_db)):
    q = select(Ticket).order_by(Ticket.created_at.desc())
    if status:
        q = q.where(Ticket.status == status)
    tickets = db.execute(q).scalars().all()
    return [{
        "id": t.id, "guild_id": t.guild_id, "channel_id": t.channel_id,
        "creator_id": t.creator_id, "claimed_by": t.claimed_by,
        "status": t.status, "priority": t.priority, "subject": t.subject,
        "close_reason": t.close_reason, "members": t.members or [],
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "closed_at": t.closed_at.isoformat() if t.closed_at else None,
    } for t in tickets]


@router.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: int, db=Depends(get_db)):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    notes = db.execute(
        select(TicketNote).where(TicketNote.ticket_id == ticket_id).order_by(TicketNote.created_at)
    ).scalars().all()
    return {
        "id": t.id, "guild_id": t.guild_id, "channel_id": t.channel_id,
        "creator_id": t.creator_id, "claimed_by": t.claimed_by,
        "status": t.status, "priority": t.priority, "subject": t.subject,
        "close_reason": t.close_reason, "members": t.members or [],
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "closed_at": t.closed_at.isoformat() if t.closed_at else None,
        "notes": [{"id": n.id, "author_id": n.author_id, "content": n.content,
                   "created_at": n.created_at.isoformat()} for n in notes],
    }


@router.put("/tickets/{ticket_id}")
def update_ticket(ticket_id: int, body: dict, db=Depends(get_db)):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    for field in ["status", "priority", "claimed_by", "close_reason", "subject"]:
        if field in body:
            setattr(t, field, body[field])
    if body.get("status") == "closed" and not t.closed_at:
        t.closed_at = datetime.datetime.utcnow()
    elif body.get("status") == "open":
        t.closed_at = None
    db.commit()
    return {"ok": True}


# ── Ticket Blacklist ──────────────────────────────────────────────────────────

@router.get("/ticket-blacklist")
def list_ticket_blacklist(db=Depends(get_db)):
    items = db.execute(select(TicketBlacklist).order_by(TicketBlacklist.created_at.desc())).scalars().all()
    return [{
        "id": b.id, "guild_id": b.guild_id, "discord_id": b.discord_id,
        "reason": b.reason, "added_by": b.added_by,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    } for b in items]


@router.post("/ticket-blacklist")
def add_ticket_blacklist(body: dict, db=Depends(get_db)):
    sc = db.execute(select(SystemConfig).limit(1)).scalars().first()
    guild_id = sc.guild_id if sc else ""
    bl = TicketBlacklist(
        guild_id=guild_id,
        discord_id=body.get("discord_id", ""),
        reason=body.get("reason"),
        added_by=body.get("added_by"),
    )
    db.add(bl)
    db.commit()
    db.refresh(bl)
    return {"ok": True, "id": bl.id}


@router.delete("/ticket-blacklist/{bl_id}")
def remove_ticket_blacklist(bl_id: int, db=Depends(get_db)):
    bl = db.get(TicketBlacklist, bl_id)
    if not bl:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(bl)
    db.commit()
    return {"ok": True}


@router.get("/ticket-notes/{ticket_id}")
def get_ticket_notes(ticket_id: int, db=Depends(get_db)):
    notes = db.execute(
        select(TicketNote).where(TicketNote.ticket_id == ticket_id).order_by(TicketNote.created_at)
    ).scalars().all()
    return [{"id": n.id, "ticket_id": n.ticket_id, "author_id": n.author_id,
             "content": n.content, "created_at": n.created_at.isoformat()} for n in notes]


@router.post("/ticket-notes")
def add_ticket_note(body: dict, db=Depends(get_db)):
    note = TicketNote(
        ticket_id=body.get("ticket_id"),
        author_id=body.get("author_id", "dashboard"),
        content=body.get("content", ""),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return {"ok": True, "id": note.id}


@router.delete("/ticket-notes/{note_id}")
def delete_ticket_note(note_id: int, db=Depends(get_db)):
    note = db.get(TicketNote, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(note)
    db.commit()
    return {"ok": True}


# ── Ticket Stats ──────────────────────────────────────────────────────────────

@router.get("/ticket-stats")
def ticket_stats(db=Depends(get_db)):
    tickets = db.execute(select(Ticket)).scalars().all()
    open_t = [t for t in tickets if t.status == "open"]
    closed_t = [t for t in tickets if t.status == "closed"]
    # Avg close time in hours
    close_times = []
    for t in closed_t:
        if t.created_at and t.closed_at:
            delta = (t.closed_at - t.created_at).total_seconds() / 3600
            close_times.append(delta)
    avg_close = round(sum(close_times) / len(close_times), 1) if close_times else 0
    priority_counts = {}
    for t in open_t:
        priority_counts[t.priority] = priority_counts.get(t.priority, 0) + 1
    return {
        "total": len(tickets),
        "open": len(open_t),
        "closed": len(closed_t),
        "avg_close_hours": avg_close,
        "by_priority": priority_counts,
        "panels": db.execute(select(TicketPanel)).scalars().all().__len__(),
    }

# ─── Ticket Forms ───────────────────────────────────────────────────────────
api = router  # alias

@api.get("/ticket-forms")
def list_ticket_forms(db=Depends(get_db)):
    cfg = db.execute(select(SystemConfig)).scalars().first()
    if not cfg: return []
    return db.execute(select(TicketForm).where(TicketForm.guild_id == cfg.guild_id)).scalars().all()

@api.post("/ticket-forms")
def create_ticket_form(body: dict, db=Depends(get_db)):
    cfg = db.execute(select(SystemConfig)).scalars().first()
    if not cfg: raise HTTPException(400, "Not configured")
    form = TicketForm(
        guild_id=cfg.guild_id,
        name=body.get("name", "Form mặc định"),
        panel_id=body.get("panel_id"),
        questions=body.get("questions", []),
    )
    db.add(form); db.commit(); db.refresh(form)
    return form

@api.put("/ticket-forms/{form_id}")
def update_ticket_form(form_id: int, body: dict, db=Depends(get_db)):
    form = db.get(TicketForm, form_id)
    if not form: raise HTTPException(404)
    for k, v in body.items():
        if hasattr(form, k): setattr(form, k, v)
    db.commit(); db.refresh(form)
    return form

@api.delete("/ticket-forms/{form_id}")
def delete_ticket_form(form_id: int, db=Depends(get_db)):
    form = db.get(TicketForm, form_id)
    if not form: raise HTTPException(404)
    db.delete(form); db.commit()
    return {"status": "deleted"}

# ─── Ticket Teams ────────────────────────────────────────────────────────────

@api.get("/ticket-teams")
def list_ticket_teams(db=Depends(get_db)):
    cfg = db.execute(select(SystemConfig)).scalars().first()
    if not cfg: return []
    return db.execute(select(TicketTeam).where(TicketTeam.guild_id == cfg.guild_id)).scalars().all()

@api.post("/ticket-teams")
def create_ticket_team(body: dict, db=Depends(get_db)):
    cfg = db.execute(select(SystemConfig)).scalars().first()
    if not cfg: raise HTTPException(400, "Not configured")
    team = TicketTeam(
        guild_id=cfg.guild_id,
        name=body.get("name", "Team mới"),
        description=body.get("description"),
        role_ids=body.get("role_ids", []),
        panel_ids=body.get("panel_ids", []),
        color=body.get("color", "#5865F2"),
    )
    db.add(team); db.commit(); db.refresh(team)
    return team

@api.put("/ticket-teams/{team_id}")
def update_ticket_team(team_id: int, body: dict, db=Depends(get_db)):
    team = db.get(TicketTeam, team_id)
    if not team: raise HTTPException(404)
    for k, v in body.items():
        if hasattr(team, k): setattr(team, k, v)
    db.commit(); db.refresh(team)
    return team

@api.delete("/ticket-teams/{team_id}")
def delete_ticket_team(team_id: int, db=Depends(get_db)):
    team = db.get(TicketTeam, team_id)
    if not team: raise HTTPException(404)
    db.delete(team); db.commit()
    return {"status": "deleted"}

# ─── Ticket Feedback ─────────────────────────────────────────────────────────

@api.get("/ticket-feedback")
def list_ticket_feedback(db=Depends(get_db)):
    cfg = db.execute(select(SystemConfig)).scalars().first()
    if not cfg: return []
    rows = db.execute(select(TicketFeedback).where(TicketFeedback.guild_id == cfg.guild_id).order_by(TicketFeedback.created_at.desc())).scalars().all()
    total = len(rows)
    avg_rating = round(sum(r.rating for r in rows) / total, 2) if total else 0
    by_rating = {str(i): sum(1 for r in rows if r.rating == i) for i in range(1, 6)}
    return {"items": rows, "total": total, "avg_rating": avg_rating, "by_rating": by_rating}

@api.post("/ticket-feedback")
def submit_ticket_feedback(body: dict, db=Depends(get_db)):
    cfg = db.execute(select(SystemConfig)).scalars().first()
    if not cfg: raise HTTPException(400)
    fb = TicketFeedback(
        ticket_id=body["ticket_id"],
        guild_id=cfg.guild_id,
        user_id=body.get("user_id", "dashboard"),
        rating=body["rating"],
        comment=body.get("comment"),
    )
    db.add(fb); db.commit(); db.refresh(fb)
    return fb

# ─── Ticket Transcripts ──────────────────────────────────────────────────────

@api.get("/ticket-transcripts")
def list_ticket_transcripts(db=Depends(get_db)):
    cfg = db.execute(select(SystemConfig)).scalars().first()
    if not cfg: return []
    return db.execute(select(TicketTranscript).where(TicketTranscript.guild_id == cfg.guild_id).order_by(TicketTranscript.created_at.desc())).scalars().all()

@api.get("/ticket-transcripts/{ticket_id}")
def get_ticket_transcript(ticket_id: int, db=Depends(get_db)):
    t = db.execute(select(TicketTranscript).where(TicketTranscript.ticket_id == ticket_id)).scalars().first()
    if not t: raise HTTPException(404, "Transcript not found")
    return t

# ─── Ticket Feedback Config ──────────────────────────────────────────────────

@api.get("/ticket-feedback/stats")
def feedback_stats(db=Depends(get_db)):
    fb = db.execute(select(TicketFeedback)).scalars().all()
    if not fb:
        return {"avg_rating": 0.0, "total": 0}
    return {"avg_rating": round(sum(f.rating for f in fb) / len(fb), 1), "total": len(fb)}

@api.get("/ticket-feedback-config")
def get_feedback_config(db=Depends(get_db)):
    sc = db.execute(select(SystemConfig)).scalars().first()
    guild_id = sc.guild_id if sc else ""
    cfg = db.execute(select(TicketFeedbackConfig).where(TicketFeedbackConfig.guild_id == guild_id)).scalars().first()
    if not cfg:
        return {"enabled": False, "channel_id": None}
    return {"enabled": cfg.enabled, "channel_id": cfg.channel_id}

@api.post("/ticket-feedback-config")
def save_feedback_config(body: dict, db=Depends(get_db)):
    sc = db.execute(select(SystemConfig)).scalars().first()
    guild_id = sc.guild_id if sc else ""
    cfg = db.execute(select(TicketFeedbackConfig).where(TicketFeedbackConfig.guild_id == guild_id)).scalars().first()
    if not cfg:
        cfg = TicketFeedbackConfig(guild_id=guild_id)
        db.add(cfg)
    cfg.enabled = body.get("enabled", False)
    cfg.channel_id = body.get("channel_id")
    db.commit()
    return {"ok": True}

# ─── Ticket Claim Config ─────────────────────────────────────────────────────

@api.get("/ticket-claim-config")
def get_claim_config(db=Depends(get_db)):
    sc = db.execute(select(SystemConfig)).scalars().first()
    guild_id = sc.guild_id if sc else ""
    cfg = db.execute(select(TicketClaimConfig).where(TicketClaimConfig.guild_id == guild_id)).scalars().first()
    if not cfg:
        return {"enabled": True, "exclusive": False, "notify": True, "notify_channel_id": None}
    return {"enabled": cfg.enabled, "exclusive": cfg.exclusive,
            "notify": cfg.notify, "notify_channel_id": cfg.notify_channel_id}

@api.post("/ticket-claim-config")
def save_claim_config(body: dict, db=Depends(get_db)):
    sc = db.execute(select(SystemConfig)).scalars().first()
    guild_id = sc.guild_id if sc else ""
    cfg = db.execute(select(TicketClaimConfig).where(TicketClaimConfig.guild_id == guild_id)).scalars().first()
    if not cfg:
        cfg = TicketClaimConfig(guild_id=guild_id)
        db.add(cfg)
    for k in ["enabled", "exclusive", "notify", "notify_channel_id"]:
        if k in body:
            setattr(cfg, k, body[k])
    db.commit()
    return {"ok": True}

@api.post("/tickets/{ticket_id}/unclaim")
def unclaim_ticket(ticket_id: int, db=Depends(get_db)):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404)
    t.claimed_by = None
    db.commit()
    return {"ok": True}

@api.get("/ticket-messages/{ticket_id}")
def get_ticket_messages(ticket_id: int, db=Depends(get_db)):
    # Placeholder — real impl fetches from stored transcript
    tr = db.execute(select(TicketTranscript).where(TicketTranscript.ticket_id == ticket_id)).scalars().first()
    if not tr:
        return []
    return []
