from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy import select, func, case
import os, uuid, shutil
from sqlalchemy.orm import joinedload
from src.database.config import get_db
from src.models.models import SystemConfig, Product, Order, User, Coupon
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
        raise HTTPException(status_code=400, detail="Bot token chưa được cấu hình")
    target_guild = guild_id or config.guild_id
    if not target_guild:
        raise HTTPException(status_code=400, detail="Server ID chưa được cấu hình")
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{target_guild}/channels",
            headers={"Authorization": f"Bot {config.discord_token}"}
        )
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail="Không thể lấy danh sách kênh")
        channels = res.json()
        return [{"id": c["id"], "name": c["name"]} for c in channels if c.get("type") == 0]

@router.get("/discord/channels/all")
async def get_discord_all_channels(guild_id: str = None, db = Depends(get_db)):
    result = db.execute(select(SystemConfig).limit(1))
    config = result.scalars().first()
    if not config or not config.discord_token:
        raise HTTPException(status_code=400, detail="Bot token chưa được cấu hình")
    target_guild = guild_id or config.guild_id
    if not target_guild:
        raise HTTPException(status_code=400, detail="Server ID chưa được cấu hình")
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{target_guild}/channels",
            headers={"Authorization": f"Bot {config.discord_token}"}
        )
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail="Không thể lấy danh sách kênh")
        channels = res.json()
        return [{"id": c["id"], "name": c["name"], "type": c.get("type", 0)} for c in channels]

@router.get("/discord/roles")
async def get_discord_roles(guild_id: str = None, db = Depends(get_db)):
    result = db.execute(select(SystemConfig).limit(1))
    config = result.scalars().first()
    if not config or not config.discord_token:
        raise HTTPException(status_code=400, detail="Bot token chưa được cấu hình")
    target_guild = guild_id or config.guild_id
    if not target_guild:
        raise HTTPException(status_code=400, detail="Server ID chưa được cấu hình")
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{target_guild}/roles",
            headers={"Authorization": f"Bot {config.discord_token}"}
        )
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail="Không thể lấy danh sách role")
        roles = res.json()
        return [{"id": r["id"], "name": r["name"]} for r in roles if r.get("name") != "@everyone"]

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
                    import discord as _discord
                    embed = _discord.Embed(
                        title="📦 Đơn hàng đã được giao",
                        color=_discord.Color.green(),
                    )
                    embed.add_field(name="ID Đơn", value=f"#{order.id}", inline=True)
                    if order.product:
                        embed.add_field(name="Sản phẩm", value=order.product.name, inline=True)
                    embed.add_field(name="Nội dung", value=dm_content, inline=False)
                    await discord_user.send(embed=embed)
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

@router.get("/users/{user_id}/orders")
def get_user_orders(user_id: int, db = Depends(get_db)):
    result = db.execute(
        select(Order)
        .options(joinedload(Order.product))
        .where(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
    )
    orders = result.unique().scalars().all()
    return [
        {
            "id": o.id,
            "product_name": o.product.name if o.product else f"#{o.product_id}",
            "package_name": o.package_name,
            "total_price": float(o.total_price),
            "status": o.status,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        } for o in orders
    ]


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

            # Cập nhật embed Discord
            from src.bot.manager import bot
            if bot and order.discord_channel_id and order.discord_message_id:
                try:
                    channel = bot.get_channel(int(order.discord_channel_id))
                    if channel:
                        msg = await channel.fetch_message(int(order.discord_message_id))
                        if msg and msg.embeds:
                            embed = msg.embeds[0].copy()
                            embed.color = discord.Color.green()
                            embed.set_footer(text="Trạng thái: ✅ Đã thanh toán thành công!")
                            await msg.edit(embed=embed)
                except Exception as e:
                    logger.error(f"Discord embed update error: {e}")

    return {"code": "00", "desc": "success"}


# ─── Warnings (Dashboard) ─────────────────────────────────────

@router.get("/warnings")
def get_warnings(db = Depends(get_db)):
    from src.models.models import Warning
    rows = db.execute(select(Warning).order_by(Warning.created_at.desc())).scalars().all()
    return [
        {
            "id": w.id, "discord_id": w.discord_id,
            "reason": w.reason, "moderator_id": w.moderator_id,
            "created_at": w.created_at.isoformat() if w.created_at else None,
        } for w in rows
    ]


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
        return {"enabled": False, "join_channel_id": None, "category_id": None}
    return {
        "enabled": cfg.enabled,
        "join_channel_id": cfg.join_channel_id,
        "category_id": cfg.category_id,
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
