"""Shop routes: Products, Orders, Coupons, Users, Stats, Leaderboard, PayOS."""
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
import os, uuid, shutil, logging, datetime

from src.database.config import get_db
from src.models.models import SystemConfig, Product, Order, User, Coupon
from src.schemas.schemas import ProductBase, ProductResponse, OrderResponse

from payos import PayOS

logger = logging.getLogger(__name__)

router = APIRouter()


async def _refresh_bang_gia(db):
    """Tự động cập nhật message bảng giá sau khi sản phẩm thay đổi."""
    try:
        from src.bot.manager import get_bot_client
        from src.bot.cogs.admin_shop import BangGiaView
        from src.bot.embed_utils import build_embed
        bot = get_bot_client()
        if not bot or not bot.is_ready():
            return
        config = db.execute(select(SystemConfig).limit(1)).scalars().first()
        if not config or not config.bang_gia_message_id or not config.bang_gia_channel_id:
            return
        channel = bot.get_channel(int(config.bang_gia_channel_id))
        if not channel:
            return
        products = db.execute(
            select(Product).where(Product.active == True).order_by(Product.id)
        ).scalars().all()
        embed = build_embed("bang_gia", db)
        view = BangGiaView(products)
        msg = await channel.fetch_message(int(config.bang_gia_message_id))
        await msg.edit(embed=embed, view=view)
    except Exception as e:
        logger.warning(f"_refresh_bang_gia failed: {e}")


# ── Products ──────────────────────────────────────────────────────────────────

@router.get("/products", response_model=list[ProductResponse])
def get_products(db=Depends(get_db)):
    result = db.execute(select(Product).order_by(Product.id))
    return result.scalars().all()


@router.post("/products/upload-image")
async def upload_product_image(file: UploadFile = File(...)):
    upload_dir = "static/uploads"
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "img.jpg")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(upload_dir, filename)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"url": f"/static/uploads/{filename}"}


@router.post("/products", response_model=ProductResponse)
async def create_product(product_in: ProductBase, db=Depends(get_db)):
    data = product_in.model_dump()
    data.setdefault("price", 0)
    product = Product(**data)
    db.add(product)
    db.commit()
    db.refresh(product)
    await _refresh_bang_gia(db)
    return product


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: int, product_in: ProductBase, db=Depends(get_db)):
    result = db.execute(select(Product).where(Product.id == product_id))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Sản phẩm không tồn tại")
    for key, value in product_in.model_dump().items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    await _refresh_bang_gia(db)
    return product


@router.delete("/products/{product_id}")
async def delete_product(product_id: int, db=Depends(get_db)):
    result = db.execute(select(Product).where(Product.id == product_id))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Sản phẩm không tồn tại")
    db.delete(product)
    db.commit()
    await _refresh_bang_gia(db)
    return {"ok": True}


# ── Orders ────────────────────────────────────────────────────────────────────

@router.get("/orders")
def get_orders(db=Depends(get_db)):
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
def create_order(body: dict, db=Depends(get_db)):
    """Tạo đơn hàng thủ công từ Discord UID. Hỗ trợ custom product."""
    discord_uid = str(body.get("discord_uid", "")).strip()
    product_id = body.get("product_id")
    package_name = body.get("package_name")
    total_price = body.get("total_price", 0)
    custom_product_name = str(body.get("custom_product_name", "")).strip()
    send_qr_channel_id = str(body.get("send_qr_channel_id", "")).strip()

    if not discord_uid:
        raise HTTPException(status_code=400, detail="Discord UID không được để trống")
    if not product_id and not custom_product_name:
        raise HTTPException(status_code=400, detail="Chọn sản phẩm hoặc nhập tên sản phẩm custom")

    user = db.execute(select(User).where(User.discord_id == discord_uid)).scalars().first()
    if not user:
        user = User(discord_id=discord_uid, username=f"User {discord_uid}")
        db.add(user)
        db.flush()

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
                            description="Vui lòng thanh toán để hoàn tất đơn hàng.\n⏰ Hết hạn sau **15 phút**.",
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

                if _bot and _bot.loop:
                    _asyncio.run_coroutine_threadsafe(_send_qr(), _bot.loop)
                    qr_sent = True
            except Exception as e:
                logger.error(f"create_order QR error: {e}")

    return {"ok": True, "order_id": order.id, "qr_sent": qr_sent}


@router.put("/orders/{order_id}/status")
def update_order_status(order_id: int, body: dict, db=Depends(get_db)):
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
async def deliver_order(order_id: int, body: dict, db=Depends(get_db)):
    result = db.execute(
        select(Order).options(joinedload(Order.user), joinedload(Order.product))
        .where(Order.id == order_id)
    )
    order = result.unique().scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Đơn hàng không tồn tại")

    dm_content = body.get("dm_content", "").strip()
    order.status = "DELIVERED"
    if order.user:
        order.user.total_spent = (order.user.total_spent or 0) + order.total_price
    db.commit()

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


# ── Coupons ───────────────────────────────────────────────────────────────────

@router.get("/coupons")
def get_coupons(db=Depends(get_db)):
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
def create_coupon(body: dict, db=Depends(get_db)):
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
def update_coupon(coupon_id: int, body: dict, db=Depends(get_db)):
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
def delete_coupon(coupon_id: int, db=Depends(get_db)):
    coupon = db.execute(select(Coupon).where(Coupon.id == coupon_id)).scalars().first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Không tìm thấy coupon")
    db.delete(coupon)
    db.commit()
    return {"ok": True}


# ── Stats / Dashboard ────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(db=Depends(get_db)):
    since = datetime.datetime.utcnow() - datetime.timedelta(days=14)
    orders = db.execute(
        select(Order).where(Order.created_at >= since).order_by(Order.created_at)
    ).scalars().all()

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
    loai: str = "chi_tieu",
    time: str = "all",
    db=Depends(get_db)
):
    from src.models.models import User as UserM
    now = datetime.datetime.utcnow()
    sys_cfg = db.execute(select(SystemConfig).limit(1)).scalars().first()
    shop_reset_at = sys_cfg.shop_leaderboard_reset_at if sys_cfg else None

    since_map = {
        "daily": now - datetime.timedelta(days=1),
        "7days": now - datetime.timedelta(days=7),
        "30days": now - datetime.timedelta(days=30),
        "all": None,
    }
    since = since_map.get(time)

    # Lấy mốc mới hơn giữa reset_at và time filter
    if shop_reset_at and since:
        since = max(since, shop_reset_at)
    elif shop_reset_at:
        since = shop_reset_at

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
    return {"reset_at": shop_reset_at.isoformat() if shop_reset_at else None, "items": result}


@router.post("/leaderboard/reset")
def reset_shop_leaderboard(db=Depends(get_db)):
    sys_cfg = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not sys_cfg:
        raise HTTPException(status_code=404, detail="Chưa cấu hình bot")
    sys_cfg.shop_leaderboard_reset_at = datetime.datetime.utcnow()
    db.commit()
    return {"ok": True, "reset_at": sys_cfg.shop_leaderboard_reset_at.isoformat()}


# ── PayOS ─────────────────────────────────────────────────────────────────────

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
        payos.confirmWebhook("https://example.com/webhook")
        return {"ok": True, "message": "Kết nối PayOS thành công"}
    except Exception as e:
        err_msg = str(e)
        if "Unauthorized" in err_msg or "401" in err_msg:
            raise HTTPException(status_code=400, detail="API Key hoặc Client ID không đúng")
        if "checksum" in err_msg.lower():
            raise HTTPException(status_code=400, detail="Checksum Key không đúng")
        raise HTTPException(status_code=400, detail=f"Lỗi kết nối: {err_msg}")


@router.post("/payos/webhook")
async def payos_webhook(request: Request, db=Depends(get_db)):
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

            from src.bot.manager import bot
            from src.bot.embed_utils import build_embed
            import discord
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
                        # Gửi ghi chú sản phẩm nếu có
                        product_note = order.product.note if order.product else None
                        if product_note and product_note.strip():
                            note_embed = discord.Embed(
                                title="📋 Hướng dẫn / Thông tin nhận hàng",
                                description=product_note.strip(),
                                color=discord.Color.blue(),
                            )
                            if order.product and order.product.name:
                                note_embed.set_footer(text=f"Sản phẩm: {order.product.name}")
                            await discord_user.send(embed=note_embed)
                except Exception as e:
                    logger.error(f"PayOS webhook DM error: {e}")

    return {"code": "00", "desc": "success"}
