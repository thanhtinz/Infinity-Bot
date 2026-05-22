"""Shop routes: Products, Orders, Coupons, Users, Stats, Leaderboard, PayOS."""
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy import select, func, case
from sqlalchemy.orm import joinedload
import os, uuid, shutil, logging, datetime

from src.database.config import get_db
from src.models.models import SystemConfig, Product, Order, User, Coupon, SpendingMilestone, FlashSale, InventoryItem, ProductCategory, OrderLog
from src.schemas.schemas import ProductBase, ProductResponse, OrderResponse
from src.api.deps import get_guild_id, require_staff_perm

from payos import PayOS

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(require_staff_perm("can_shop"))])


async def _refresh_bang_gia(db):
    """Auto-refresh price list message after product changes."""
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
        embed = build_embed("bang_gia", db, guild_id=guild_id)
        view = BangGiaView(products)
        msg = await channel.fetch_message(int(config.bang_gia_message_id))
        await msg.edit(embed=embed, view=view)
    except Exception as e:
        logger.warning(f"_refresh_bang_gia failed: {e}")


# ── Products ──────────────────────────────────────────────────────────────────

@router.get("/products", response_model=list[ProductResponse])
def get_products(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    result = db.execute(select(Product).where(Product.guild_id == guild_id).order_by(Product.id))
    return result.scalars().all()


@router.post("/products/upload-image")
async def upload_product_image(file: UploadFile = File(...), db=Depends(get_db)):
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10MB).")
    ext = os.path.splitext(file.filename or "img.jpg")[1] or ".jpg"
    file_id = uuid.uuid4().hex
    from src.models.models import UploadedFile
    uf = UploadedFile(
        id=file_id,
        filename=f"{file_id}{ext}",
        content_type=file.content_type or "image/jpeg",
        data=content,
        size=len(content),
    )
    db.add(uf)
    db.commit()
    return {"url": f"/api/files/{file_id}"}


# ── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories")
def get_categories(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rows = db.execute(
        select(ProductCategory)
        .where(ProductCategory.guild_id == guild_id)
        .order_by(ProductCategory.sort_order, ProductCategory.id)
    ).scalars().all()
    return [{"id": c.id, "guild_id": c.guild_id, "name": c.name, "emoji": c.emoji, "sort_order": c.sort_order} for c in rows]

@router.post("/categories")
def create_category(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Name is required")
    existing = db.execute(
        select(ProductCategory).where(ProductCategory.guild_id == guild_id, ProductCategory.name == name)
    ).scalars().first()
    if existing:
        raise HTTPException(409, "Category already exists")
    cat = ProductCategory(guild_id=guild_id, name=name, emoji=body.get("emoji"), sort_order=body.get("sort_order", 0))
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return {"id": cat.id, "guild_id": cat.guild_id, "name": cat.name, "emoji": cat.emoji, "sort_order": cat.sort_order}

@router.put("/categories/{cat_id}")
def update_category(cat_id: int, body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cat = db.execute(
        select(ProductCategory).where(ProductCategory.id == cat_id, ProductCategory.guild_id == guild_id)
    ).scalars().first()
    if not cat:
        raise HTTPException(404, "Category not found")
    if "name" in body:
        cat.name = (body["name"] or "").strip() or cat.name
    if "emoji" in body:
        cat.emoji = body["emoji"]
    if "sort_order" in body:
        cat.sort_order = body["sort_order"]
    db.commit()
    return {"id": cat.id, "guild_id": cat.guild_id, "name": cat.name, "emoji": cat.emoji, "sort_order": cat.sort_order}

@router.delete("/categories/{cat_id}")
def delete_category(cat_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cat = db.execute(
        select(ProductCategory).where(ProductCategory.id == cat_id, ProductCategory.guild_id == guild_id)
    ).scalars().first()
    if not cat:
        raise HTTPException(404, "Category not found")
    # Unlink products from this category
    db.execute(
        select(Product).where(Product.category_id == cat_id)
    )
    for p in db.execute(select(Product).where(Product.category_id == cat_id)).scalars().all():
        p.category_id = None
    db.delete(cat)
    db.commit()
    return {"ok": True}


@router.post("/products", response_model=ProductResponse)
async def create_product(product_in: ProductBase, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    # Validate category exists
    cat = db.execute(
        select(ProductCategory).where(
            ProductCategory.id == product_in.category_id,
            ProductCategory.guild_id == guild_id,
        )
    ).scalars().first()
    if not cat:
        raise HTTPException(400, "Category not found. Create a category first.")
    data = product_in.model_dump()
    data.setdefault("price", 0)
    data["guild_id"] = guild_id
    product = Product(**data)
    db.add(product)
    db.commit()
    db.refresh(product)

    # Auto-create per-product EmbedTemplate
    from src.models.models import EmbedTemplate
    event_type = f"product_{product.id}"
    existing = db.execute(
        select(EmbedTemplate).where(
            EmbedTemplate.event_type == event_type,
            EmbedTemplate.guild_id == guild_id,
        )
    ).scalars().first()
    if not existing:
        tmpl = EmbedTemplate(
            guild_id=guild_id,
            name=product.name or f"Product #{product.id}",
            event_type=event_type,
            title=f"📦 {{product.name}}",
            description="{product.description}",
            color="#57F287",
            footer="Contact an admin to place an order",
            thumbnail_url=product.image_url or "",
            fields=[{"name": "🔹 {package.name}", "value": "💰 **{package.price}**\n{package.description}", "inline": False}],
            enabled=True,
        )
        db.add(tmpl)
        db.commit()

    await _refresh_bang_gia(db)
    return product


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: int, product_in: ProductBase, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    result = db.execute(select(Product).where(Product.id == product_id, Product.guild_id == guild_id))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for key, value in product_in.model_dump().items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    await _refresh_bang_gia(db)
    return product


@router.delete("/products/{product_id}")
async def delete_product(product_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    result = db.execute(select(Product).where(Product.id == product_id, Product.guild_id == guild_id))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    # Clean up per-product embed template
    from src.models.models import EmbedTemplate
    tmpl = db.execute(
        select(EmbedTemplate).where(
            EmbedTemplate.event_type == f"product_{product_id}",
            EmbedTemplate.guild_id == guild_id,
        )
    ).scalars().first()
    if tmpl:
        db.delete(tmpl)
    db.delete(product)
    db.commit()
    await _refresh_bang_gia(db)
    return {"ok": True}


@router.post("/products/ensure-embeds")
async def ensure_product_embeds(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Ensure all existing products have per-product EmbedTemplates."""
    from src.models.models import EmbedTemplate
    products = db.execute(
        select(Product).where(Product.guild_id == guild_id)
    ).scalars().all()
    created = 0
    for p in products:
        event_type = f"product_{p.id}"
        existing = db.execute(
            select(EmbedTemplate).where(
                EmbedTemplate.event_type == event_type,
                EmbedTemplate.guild_id == guild_id,
            )
        ).scalars().first()
        if not existing:
            tmpl = EmbedTemplate(
                guild_id=guild_id,
                name=p.name or f"Product #{p.id}",
                event_type=event_type,
                title=f"📦 {{product.name}}",
                description="{product.description}",
                color="#57F287",
                footer="Contact an admin to place an order",
                thumbnail_url=p.image_url or "",
                fields=[{"name": "🔹 {package.name}", "value": "💰 **{package.price}**\n{package.description}", "inline": False}],
                enabled=True,
            )
            db.add(tmpl)
            created += 1
    if created:
        db.commit()
    return {"ok": True, "created": created}


# ── Orders ────────────────────────────────────────────────────────────────────

@router.get("/orders")
def get_orders(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    result = db.execute(
        select(Order).where(Order.guild_id == guild_id)
        .options(joinedload(Order.user), joinedload(Order.product))
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
def create_order(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Create an order manually from Discord UID. Supports custom product."""
    discord_uid = str(body.get("discord_uid", "")).strip()
    product_id = body.get("product_id")
    package_name = body.get("package_name")
    total_price = body.get("total_price", 0)
    custom_product_name = str(body.get("custom_product_name", "")).strip()
    send_qr_channel_id = str(body.get("send_qr_channel_id", "")).strip()

    if not discord_uid:
        raise HTTPException(status_code=400, detail="Discord UID is required")
    if not product_id and not custom_product_name:
        raise HTTPException(status_code=400, detail="Select a product or enter a custom product name")

    user = db.execute(select(User).where(User.discord_id == discord_uid)).scalars().first()
    if not user:
        user = User(discord_id=discord_uid, username=f"User {discord_uid}")
        db.add(user)
        db.flush()

    if custom_product_name and not product_id:
        package_name = custom_product_name
        product_id = None

    # ── Flash sale price override ──────────────────────────────────────────
    allow_coupon_override = True  # default: coupon allowed
    if product_id and package_name:
        now = datetime.datetime.utcnow()
        active_sale = db.execute(
            select(FlashSale).where(
                FlashSale.guild_id == guild_id,
                FlashSale.product_id == product_id,
                FlashSale.package_name == package_name,
                FlashSale.active == True,
                FlashSale.starts_at <= now,
                FlashSale.ends_at > now,
            )
        ).scalars().first()
        if active_sale and (active_sale.quantity_limit is None or active_sale.quantity_used < active_sale.quantity_limit):
            product_obj = db.execute(select(Product).where(Product.id == product_id)).scalars().first()
            if product_obj:
                pkgs = product_obj.packages or []
                matched_pkg = next((p for p in pkgs if p.get("name") == package_name), None)
                if matched_pkg:
                    orig = float(matched_pkg.get("price", 0))
                    if active_sale.discount_type == "percent":
                        sale_price = orig * (1 - active_sale.discount_value / 100)
                    else:
                        sale_price = max(0, orig - active_sale.discount_value)
                    total_price = sale_price
                    # increment used
                    active_sale.quantity_used = (active_sale.quantity_used or 0) + 1
                    allow_coupon_override = active_sale.allow_coupon

    # ── Check inventory ────────────────────────────────────────────────────
    use_inventory = False
    inventory_item = None
    if product_id and package_name:
        product_obj2 = db.execute(select(Product).where(Product.id == product_id)).scalars().first()
        if product_obj2:
            pkgs2 = product_obj2.packages or []
            matched_pkg2 = next((p for p in pkgs2 if p.get("name") == package_name), None)
            if matched_pkg2 and matched_pkg2.get("use_inventory"):
                use_inventory = True
                # Pick oldest available item (FIFO)
                inventory_item = db.execute(
                    select(InventoryItem).where(
                        InventoryItem.guild_id == guild_id,
                        InventoryItem.product_id == product_id,
                        InventoryItem.package_name == package_name,
                        InventoryItem.delivered_order_id == None,
                    ).order_by(InventoryItem.created_at.asc()).limit(1)
                ).scalars().first()

    initial_status = body.get("status", "PENDING")
    if use_inventory and not inventory_item:
        initial_status = "PENDING_MANUAL"

    order = Order(
        guild_id=guild_id,
        user_id=user.id,
        product_id=product_id,
        quantity=body.get("quantity", 1),
        total_price=float(total_price),
        package_name=package_name,
        status=initial_status,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(hours=24),
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # ── Auto-deliver from inventory ────────────────────────────────────────
    if use_inventory and inventory_item and initial_status == "PENDING":
        inventory_item.delivered_order_id = order.id
        db.commit()
        # Trigger async delivery notification
        import asyncio as _asyncio2
        from src.bot.manager import bot as _bot2
        async def _auto_deliver():
            try:
                from src.database.config import SessionLocal as _SL2
                _db3 = _SL2()
                try:
                    _o = _db3.get(Order, order.id)
                    if _o:
                        _o.status = "DELIVERED"
                        _db3.commit()
                    from src.bot.embed_utils import build_embed
                    from src.models.models import SystemConfig as _SC
                    _cfg = _db3.execute(select(_SC).limit(1)).scalars().first()
                    if _cfg and _cfg.don_hang_channel_id and _bot2:
                        import discord as _dc
                        ch = _bot2.get_channel(int(_cfg.don_hang_channel_id))
                        if ch:
                            emb = build_embed("giao_hang", _db3, vars={
                                "order.id": str(order.id),
                                "user.mention": f"<@{discord_uid}>",
                                "product.name": package_name or "",
                                "delivery.content": inventory_item.content,
                            })
                            await ch.send(content=f"<@{discord_uid}>", embed=emb)
                    # Low stock check
                    remaining = _db3.execute(
                        select(func.count(InventoryItem.id)).where(
                            InventoryItem.guild_id == guild_id,
                            InventoryItem.product_id == product_id,
                            InventoryItem.package_name == package_name,
                            InventoryItem.delivered_order_id == None,
                        )
                    ).scalar() or 0
                    threshold = (_cfg.inventory_low_stock_threshold or 5) if _cfg else 5
                    if remaining <= threshold and _cfg and _bot2:
                        _guild = _bot2.get_guild(int(guild_id)) if guild_id else None
                        if _guild and _guild.owner:
                            try:
                                await _guild.owner.send(
                                    f"⚠️ **Low Stock Alert**\nProduct: **{package_name}** (ID {product_id})\nRemaining: **{remaining}** item(s)"
                                )
                            except Exception:
                                pass
                finally:
                    _db3.close()
            except Exception as _e:
                logger.error(f"auto_deliver error: {_e}")
        if _bot2 and _bot2.loop:
            _asyncio2.run_coroutine_threadsafe(_auto_deliver(), _bot2.loop)

    # ── Out-of-stock: send admin confirm embed ─────────────────────────────
    elif use_inventory and not inventory_item:
        import asyncio as _asyncio3
        from src.bot.manager import bot as _bot3
        async def _send_oos_admin():
            try:
                from src.database.config import SessionLocal as _SL3
                _db4 = _SL3()
                try:
                    from src.models.models import SystemConfig as _SC2
                    _cfg2 = _db4.execute(select(_SC2).limit(1)).scalars().first()
                    if not _cfg2 or not _cfg2.don_hang_channel_id or not _bot3:
                        return
                    import discord as _dc2
                    ch2 = _bot3.get_channel(int(_cfg2.don_hang_channel_id))
                    if not ch2:
                        return
                    from src.bot.embed_utils import build_embed
                    emb_oos = build_embed("out_of_stock_admin", _db4, vars={
                        "order.id": str(order.id),
                        "user.mention": f"<@{discord_uid}>",
                        "product.name": package_name or "",
                    })

                    class OosView(_dc2.ui.View):
                        def __init__(self):
                            super().__init__(timeout=None)
                        @_dc2.ui.button(label="✅ Confirm manual delivery", style=_dc2.ButtonStyle.success, custom_id=f"oos_confirm_{order.id}")
                        async def confirm(self, btn, inter):
                            _db5 = _SL3()
                            try:
                                _o2 = _db5.get(Order, order.id)
                                if _o2:
                                    _o2.status = "PENDING"
                                    _db5.commit()
                                await inter.response.send_message("✅ Order moved to manual delivery queue.", ephemeral=True)
                                await inter.message.edit(view=None)
                            finally:
                                _db5.close()
                        @_dc2.ui.button(label="❌ Cancel order", style=_dc2.ButtonStyle.danger, custom_id=f"oos_cancel_{order.id}")
                        async def cancel(self, btn, inter):
                            _db6 = _SL3()
                            try:
                                _o3 = _db6.get(Order, order.id)
                                if _o3:
                                    _o3.status = "CANCELLED"
                                    _db6.commit()
                                await inter.response.send_message("❌ Order cancelled.", ephemeral=True)
                                await inter.message.edit(view=None)
                            finally:
                                _db6.close()

                    await ch2.send(embed=emb_oos, view=OosView())
                finally:
                    _db4.close()
            except Exception as _e2:
                logger.error(f"oos_admin embed error: {_e2}")
        if _bot3 and _bot3.loop:
            _asyncio3.run_coroutine_threadsafe(_send_oos_admin(), _bot3.loop)

    qr_sent = False
    if send_qr_channel_id and float(total_price) > 0:
        import asyncio as _asyncio
        config = db.execute(select(SystemConfig).limit(1)).scalars().first()
        if config and all([config.payos_client_id, config.payos_api_key, config.payos_checksum_key]):
            from payos import PayOS as _PayOS
            from payos.type import ItemData as _ItemData, PaymentData as _PaymentData
            from src.bot.manager import bot as _bot
            import discord as _discord

            domain = config.public_app_url or os.environ.get("PUBLIC_APP_URL", "")
            if not domain.startswith("http"):
                domain = f"https://{domain}"

            try:
                payos = _PayOS(
                    client_id=config.payos_client_id,
                    api_key=config.payos_api_key,
                    checksum_key=config.payos_checksum_key,
                )
                product_display = custom_product_name or (package_name or f"Order #{order.id}")
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
                            title="🛒 New Order",
                            description="Please complete payment to finalize your order.\n⏰ Expires in **15 minutes**.",
                            color=_discord.Color.gold(),
                        )
                        embed.add_field(name="🔢 Order ID", value=f"#{order.id}", inline=True)
                        embed.add_field(name="👤 Discord", value=f"<@{discord_uid}>", inline=True)
                        embed.add_field(name="📦 Product", value=product_display, inline=False)
                        embed.add_field(name="💰 Amount", value=f"{float(total_price):,.0f}", inline=True)
                        embed.set_footer(text="⏳ Awaiting payment...")
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
                            content=f"<@{discord_uid}> You have a new order!",
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
def update_order_status(order_id: int, body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    result = db.execute(select(Order).where(Order.id == order_id, Order.guild_id == guild_id))
    order = result.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    new_status = body.get("status")
    valid = ["PENDING", "PAID", "DELIVERING", "DELIVERED", "CANCELLED", "ERROR"]
    if new_status not in valid:
        raise HTTPException(status_code=400, detail="Invalid status")
    order.status = new_status
    db.commit()
    log_order_action(order_id, guild_id, new_status.lower(), db=db,
                     actor_discord_id=body.get("actor_discord_id"),
                     note=body.get("note"))
    return {"ok": True, "status": new_status}


@router.get("/orders/{order_id}/logs")
def get_order_logs(order_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Return audit log for a specific order."""
    logs = db.execute(
        select(OrderLog)
        .where(OrderLog.order_id == order_id, OrderLog.guild_id == guild_id)
        .order_by(OrderLog.created_at)
    ).scalars().all()
    return [
        {
            "id": lg.id,
            "action": lg.action,
            "actor_discord_id": lg.actor_discord_id,
            "note": lg.note,
            "created_at": lg.created_at.isoformat() if lg.created_at else None,
        }
        for lg in logs
    ]


@router.post("/orders/{order_id}/deliver")
async def deliver_order(order_id: int, body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    result = db.execute(
        select(Order).options(joinedload(Order.user), joinedload(Order.product))
        .where(Order.id == order_id, Order.guild_id == guild_id)
    )
    order = result.unique().scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    dm_content = body.get("dm_content", "").strip()
    order.status = "DELIVERED"
    # Deprecated: do not write to user.total_spent (cross-guild field); milestones use per-guild Order sum
    db.commit()

    # Log the action
    log_order_action(order.id, order.guild_id, "delivered", db=db,
                     actor_discord_id=body.get("actor_discord_id"), note="Manual delivery")

    # Check spending milestones
    if order.user and order.guild_id:
        await check_spending_milestones(order.user, order.guild_id, db)

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
                    dm_embed = build_embed("giao_hang", db, vars=dm_vars, guild_id=guild_id)
                    if dm_content:
                        dm_embed.add_field(name="Content", value=dm_content, inline=False)
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
                        embed.set_footer(text="✅ Delivered successfully!")
                        await msg.edit(embed=embed, view=None)
            except Exception as e:
                logger.error(f"deliver embed update error: {e}")

    return {"ok": True}


# ── Coupons ───────────────────────────────────────────────────────────────────

@router.get("/coupons")
def get_coupons(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    result = db.execute(select(Coupon).where(Coupon.guild_id == guild_id).order_by(Coupon.id.desc()))
    coupons = result.scalars().all()
    return [
        {
            "id": c.id, "code": c.code,
            "discount_type": getattr(c, "discount_type", "percent") or "percent",
            "discount_percent": c.discount_percent,
            "discount_amount": c.discount_amount,
            "buy_x": getattr(c, "buy_x", None),
            "get_y": getattr(c, "get_y", None),
            "apply_mode": getattr(c, "apply_mode", "all") or "all",
            "apply_category_id": getattr(c, "apply_category_id", None),
            "apply_product_id": getattr(c, "apply_product_id", None),
            "customer_mode": getattr(c, "customer_mode", "all") or "all",
            "customer_ids": getattr(c, "customer_ids", []) or [],
            "max_uses": c.max_uses, "used_count": c.used_count,
            "is_public": c.is_public,
        } for c in coupons
    ]


@router.post("/coupons")
def create_coupon(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    code = str(body.get("code", "")).strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Code is required")
    existing = db.execute(select(Coupon).where(Coupon.code == code, Coupon.guild_id == guild_id)).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Code already exists")
    coupon = Coupon(
        guild_id=guild_id,
        code=code,
        discount_type=body.get("discount_type", "percent"),
        discount_percent=body.get("discount_percent") or None,
        discount_amount=body.get("discount_amount") or None,
        buy_x=body.get("buy_x") or None,
        get_y=body.get("get_y") or None,
        apply_mode=body.get("apply_mode", "all"),
        apply_category_id=body.get("apply_category_id") or None,
        apply_product_id=body.get("apply_product_id") or None,
        customer_mode=body.get("customer_mode", "all"),
        customer_ids=body.get("customer_ids") or [],
        max_uses=int(body.get("max_uses", 1)),
        is_public=bool(body.get("is_public", False)),
    )
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return {"ok": True, "id": coupon.id}


@router.put("/coupons/{coupon_id}")
def update_coupon(coupon_id: int, body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    coupon = db.execute(select(Coupon).where(Coupon.id == coupon_id, Coupon.guild_id == guild_id)).scalars().first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    FIELDS = (
        "discount_type", "discount_percent", "discount_amount",
        "buy_x", "get_y",
        "apply_mode", "apply_category_id", "apply_product_id",
        "customer_mode", "customer_ids",
        "max_uses", "is_public",
    )
    for field in FIELDS:
        if field in body:
            val = body[field]
            if field in ("discount_percent", "discount_amount", "buy_x", "get_y", "apply_category_id", "apply_product_id"):
                val = val or None
            setattr(coupon, field, val)
    db.commit()
    return {"ok": True}


@router.delete("/coupons/{coupon_id}")
def delete_coupon(coupon_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    coupon = db.execute(select(Coupon).where(Coupon.id == coupon_id, Coupon.guild_id == guild_id)).scalars().first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    db.delete(coupon)
    db.commit()
    return {"ok": True}


# ── Stats / Dashboard ────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    since = datetime.datetime.utcnow() - datetime.timedelta(days=14)
    orders = db.execute(
        select(Order).where(Order.guild_id == guild_id, Order.created_at >= since).order_by(Order.created_at)
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

    all_orders = db.execute(select(Order).where(Order.guild_id == guild_id)).scalars().all()
    total_revenue = sum(float(o.total_price) for o in all_orders if o.status == "PAID")
    total_users = db.execute(select(func.count(User.id)).where(User.guild_id == guild_id)).scalar() or 0
    total_products = db.execute(select(func.count(Product.id)).where(Product.guild_id == guild_id)).scalar() or 0

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
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    from src.models.models import User as UserM
    now = datetime.datetime.utcnow()
    sys_cfg = db.execute(select(SystemConfig).where(SystemConfig.guild_id == guild_id)).scalars().first()
    shop_reset_at = sys_cfg.shop_leaderboard_reset_at if sys_cfg else None

    since_map = {
        "daily": now - datetime.timedelta(days=1),
        "7days": now - datetime.timedelta(days=7),
        "30days": now - datetime.timedelta(days=30),
        "all": None,
    }
    since = since_map.get(time)

    # Use the more recent of reset_at and time filter
    if shop_reset_at and since:
        since = max(since, shop_reset_at)
    elif shop_reset_at:
        since = shop_reset_at

    query = select(
        Order.user_id,
        func.count(Order.id).label("don_count"),
        func.sum(Order.total_price).label("total_spent"),
    ).where(Order.status == "PAID", Order.guild_id == guild_id)
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
def reset_shop_leaderboard(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    sys_cfg = db.execute(select(SystemConfig).where(SystemConfig.guild_id == guild_id)).scalars().first()
    if not sys_cfg:
        raise HTTPException(status_code=404, detail="Bot not configured")
    sys_cfg.shop_leaderboard_reset_at = datetime.datetime.utcnow()
    db.commit()
    return {"ok": True, "reset_at": sys_cfg.shop_leaderboard_reset_at.isoformat()}


# ── PayOS ─────────────────────────────────────────────────────────────────────

@router.get("/payos/config")
def get_payos_config(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    config = db.execute(
        select(SystemConfig).where(SystemConfig.guild_id == guild_id)
    ).scalars().first()
    return {
        "payos_client_id": config.payos_client_id if config else None,
        "has_payos_api_key": bool(config and config.payos_api_key),
        "has_payos_checksum_key": bool(config and config.payos_checksum_key),
    }


@router.post("/payos/config")
def save_payos_config(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    config = db.execute(
        select(SystemConfig).where(SystemConfig.guild_id == guild_id)
    ).scalars().first()
    if not config:
        raise HTTPException(status_code=404, detail="No config found for this guild")

    client_id = body.get("payos_client_id") or config.payos_client_id
    api_key = body.get("payos_api_key") or config.payos_api_key
    checksum_key = body.get("payos_checksum_key") or config.payos_checksum_key

    # Validate before saving — must pass test connection
    if client_id and api_key and checksum_key:
        try:
            payos = PayOS(client_id=client_id, api_key=api_key, checksum_key=checksum_key)
            payos.webhooks.confirm("https://example.com/webhook")
        except Exception as e:
            err_msg = str(e)
            if "Unauthorized" in err_msg or "401" in err_msg:
                raise HTTPException(status_code=400, detail="Invalid API Key or Client ID")
            if "checksum" in err_msg.lower():
                raise HTTPException(status_code=400, detail="Invalid Checksum Key")
            raise HTTPException(status_code=400, detail=f"PayOS validation failed: {err_msg}")

    if "payos_client_id" in body:
        config.payos_client_id = body["payos_client_id"] or None
    if "payos_api_key" in body and body["payos_api_key"] is not None:
        config.payos_api_key = body["payos_api_key"] or None
    if "payos_checksum_key" in body and body["payos_checksum_key"] is not None:
        config.payos_checksum_key = body["payos_checksum_key"] or None
    db.commit()
    return {
        "payos_client_id": config.payos_client_id,
        "has_payos_api_key": bool(config.payos_api_key),
        "has_payos_checksum_key": bool(config.payos_checksum_key),
    }


@router.post("/payos/test")
def test_payos_connection(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    config = db.execute(
        select(SystemConfig).where(SystemConfig.guild_id == guild_id)
    ).scalars().first()
    if not config or not all([config.payos_client_id, config.payos_api_key, config.payos_checksum_key]):
        raise HTTPException(status_code=400, detail="PayOS is not fully configured")
    try:
        payos = PayOS(
            client_id=config.payos_client_id,
            api_key=config.payos_api_key,
            checksum_key=config.payos_checksum_key,
        )
        payos.webhooks.confirm("https://example.com/webhook")
        return {"ok": True, "message": "PayOS connection successful"}
    except Exception as e:
        err_msg = str(e)
        if "Unauthorized" in err_msg or "401" in err_msg:
            raise HTTPException(status_code=400, detail="Invalid API Key or Client ID")
        if "checksum" in err_msg.lower():
            raise HTTPException(status_code=400, detail="Invalid Checksum Key")
        raise HTTPException(status_code=400, detail=f"Connection error: {err_msg}")


@router.post("/paypal/test")
async def test_paypal_connection(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    config = db.execute(
        select(SystemConfig).where(SystemConfig.guild_id == guild_id)
    ).scalars().first()
    if not config or not config.paypal_client_id or not config.paypal_client_secret:
        raise HTTPException(status_code=400, detail="PayPal credentials not configured")
    mode = config.paypal_mode or "live"
    base = "https://api-m.sandbox.paypal.com" if mode == "sandbox" else "https://api-m.paypal.com"
    try:
        import httpx, base64 as _b64
        creds = _b64.b64encode(f"{config.paypal_client_id}:{config.paypal_client_secret}".encode()).decode()
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{base}/v1/oauth2/token",
                headers={"Authorization": f"Basic {creds}", "Content-Type": "application/x-www-form-urlencoded"},
                data="grant_type=client_credentials",
            )
        if r.status_code == 200:
            return {"ok": True, "message": f"PayPal connection successful ({mode} mode)"}
        elif r.status_code == 401:
            raise HTTPException(status_code=400, detail="Invalid Client ID or Secret")
        else:
            raise HTTPException(status_code=400, detail=f"PayPal error: {r.status_code}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Connection error: {str(e)}")


@router.post("/payos/webhook")
async def payos_webhook(request: Request, db=Depends(get_db)):
    body = await request.json()

    # We need the order's guild_id to load the correct config, so fetch order first.
    # Strategy: extract orderCode from raw body → find order → load guild-scoped config → verify signature.
    order_code_raw = str(body.get("data", {}).get("orderCode", ""))
    
    # 1. Find order to get guild_id for config scoping
    order = db.execute(
        select(Order).options(joinedload(Order.user), joinedload(Order.product))
        .where(Order.payos_order_code == order_code_raw)
        .with_for_update()
    ).unique().scalars().first()

    guild_id = order.guild_id if order else None

    # 2. Load config scoped to order's guild
    if guild_id:
        config = db.execute(
            select(SystemConfig).where(SystemConfig.guild_id == guild_id)
        ).scalars().first()
    else:
        config = None

    if not config or not config.payos_checksum_key:
        return {"code": "00", "desc": "no config"}

    try:
        payos = PayOS(
            client_id=config.payos_client_id,
            api_key=config.payos_api_key,
            checksum_key=config.payos_checksum_key,
        )
        webhook_data = payos.webhooks.verify(body)
    except Exception as e:
        logger.error(f"PayOS webhook verify error: {e}")
        return {"code": "00", "desc": "verify error"}

    if webhook_data.code == "00":
        order_code = str(webhook_data.orderCode)
        # Re-fetch with lock if order_code_raw didn't match (safety)
        if not order or order.payos_order_code != order_code:
            order = db.execute(
                select(Order).options(joinedload(Order.user), joinedload(Order.product))
                .where(Order.payos_order_code == order_code)
                .with_for_update()
            ).unique().scalars().first()

        if order and order.status in ("PENDING", "PENDING_MANUAL"):
            order.status = "PAID"
            # Increment coupon used_count if coupon was applied to this order
            if hasattr(order, 'coupon_code') and order.coupon_code:
                coupon = db.execute(
                    select(Coupon).where(Coupon.code == order.coupon_code, Coupon.guild_id == order.guild_id)
                ).scalars().first()
                if coupon:
                    coupon.used_count = (coupon.used_count or 0) + 1
            # Update last_order_at on user
            if order.user:
                order.user.last_order_at = datetime.datetime.utcnow()
            db.commit()
            log_order_action(order.id, order.guild_id, "paid", db=db, note="PayOS webhook confirmed")

            # Fraud velocity check
            flag_reason = fraud_velocity_check(order, db)
            if flag_reason:
                order.flagged = True
                order.flag_reason = flag_reason
                db.commit()
                log_order_action(order.id, order.guild_id, "flagged", db=db, note=flag_reason)
                logger.warning(f"Order #{order.id} flagged: {flag_reason}")
            else:
                # Try auto-delivery from inventory
                await auto_deliver_order(order, db)

            # Check spending milestones (per-guild total from Order table)
            if order.user and order.guild_id:
                await check_spending_milestones(order.user, order.guild_id, db)

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
                            paid_embed.set_footer(text="Status: ✅ Payment successful!")
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
                        }, guild_id=order.guild_id)
                        await discord_user.send(embed=dm_embed)
                        # Send product note if available
                        product_note = order.product.note if order.product else None
                        if product_note and product_note.strip():
                            note_embed = discord.Embed(
                                title="📋 Product Information / Delivery Instructions",
                                description=product_note.strip(),
                                color=discord.Color.blue(),
                            )
                            if order.product and order.product.name:
                                note_embed.set_footer(text=f"Product: {order.product.name}")
                            await discord_user.send(embed=note_embed)
                except Exception as e:
                    logger.error(f"PayOS webhook DM error: {e}")

    return {"code": "00", "desc": "success"}


# ── Order Cleanup ─────────────────────────────────────────────────────────────

@router.post("/orders/cleanup-expired")
def cleanup_expired_orders(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Cancel PENDING orders that have passed their expires_at deadline."""
    now = datetime.datetime.utcnow()
    expired = db.execute(
        select(Order).where(
            Order.guild_id == guild_id,
            Order.status == "PENDING",
            Order.expires_at != None,
            Order.expires_at < now,
        )
    ).scalars().all()
    for o in expired:
        o.status = "CANCELLED"
    db.commit()
    return {"cancelled": len(expired)}


# ── Spending Milestones ───────────────────────────────────────────────────────

@router.get("/milestones")
def get_milestones(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rows = db.execute(
        select(SpendingMilestone)
        .where(SpendingMilestone.guild_id == guild_id)
        .order_by(SpendingMilestone.threshold)
    ).scalars().all()
    return [
        {"id": m.id, "name": m.name, "threshold": m.threshold,
         "role_id": m.role_id, "emoji": m.emoji, "active": m.active}
        for m in rows
    ]


@router.post("/milestones")
def create_milestone(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    m = SpendingMilestone(
        guild_id=guild_id,
        name=body["name"],
        threshold=float(body["threshold"]),
        role_id=str(body["role_id"]),
        emoji=body.get("emoji"),
        active=body.get("active", True),
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"id": m.id, "name": m.name, "threshold": m.threshold,
            "role_id": m.role_id, "emoji": m.emoji, "active": m.active}


@router.put("/milestones/{milestone_id}")
def update_milestone(milestone_id: int, body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    m = db.execute(select(SpendingMilestone).where(SpendingMilestone.id == milestone_id, SpendingMilestone.guild_id == guild_id)).scalars().first()
    if not m:
        raise HTTPException(404, "Milestone not found")
    for k in ("name", "threshold", "role_id", "emoji", "active"):
        if k in body:
            setattr(m, k, body[k])
    db.commit()
    return {"ok": True}


@router.delete("/milestones/{milestone_id}")
def delete_milestone(milestone_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    m = db.execute(select(SpendingMilestone).where(SpendingMilestone.id == milestone_id, SpendingMilestone.guild_id == guild_id)).scalars().first()
    if not m:
        raise HTTPException(404, "Milestone not found")
    db.delete(m)
    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Core helpers: logging, fraud, auto-delivery
# ─────────────────────────────────────────────────────────────────────────────

def log_order_action(order_id: int, guild_id: str | None, action: str, db,
                     actor_discord_id: str | None = None, note: str | None = None):
    """Write an OrderLog entry. Call this on every status change."""
    try:
        entry = OrderLog(
            order_id=order_id,
            guild_id=guild_id,
            action=action,
            actor_discord_id=actor_discord_id,
            note=note,
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        logger.warning(f"log_order_action failed: {e}")


def fraud_velocity_check(order: Order, db) -> str | None:
    """Return a flag reason string if fraud is detected, else None.

    Rules (per guild, per discord_id):
    - >5 PENDING/PAID orders created in the last 60 minutes → velocity flag
    - User is blacklisted in CRM
    """
    if not order.user:
        return None
    # Blacklist check
    if getattr(order.user, "blacklisted", False):
        return "Blacklisted user"
    # Velocity check: >5 orders in last hour
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    recent = db.execute(
        select(func.count()).select_from(Order)
        .where(
            Order.guild_id == order.guild_id,
            Order.user_id == order.user_id,
            Order.created_at >= cutoff,
            Order.status.in_(["PENDING", "PENDING_MANUAL", "PAID"]),
        )
    ).scalar() or 0
    if recent > 5:
        return f"Velocity: {recent} orders in last 60 min"
    return None


async def auto_deliver_order(order: Order, db) -> bool:
    """Try to auto-deliver an inventory item to the user via DM.

    Returns True if delivery succeeded.
    Looks for an undelivered InventoryItem matching product + package (FIFO).
    """
    if not order.product or not order.user:
        return False
    pkg_name = order.package_name or ""
    # Find oldest undelivered item for this product + package
    item = db.execute(
        select(InventoryItem)
        .where(
            InventoryItem.product_id == order.product_id,
            InventoryItem.guild_id == order.guild_id,
            InventoryItem.delivered_order_id.is_(None),
            InventoryItem.package_name == pkg_name,
        )
        .order_by(InventoryItem.id)
        .limit(1)
        .with_for_update(skip_locked=True)
    ).scalars().first()

    if not item:
        return False  # No stock — manual delivery required

    # Mark delivered
    item.delivered_order_id = order.id
    item.delivered_at = datetime.datetime.utcnow()
    item.delivered_to_discord_id = order.user.discord_id
    order.delivered_item_id = item.id
    order.status = "DELIVERED"
    db.commit()

    # DM the user
    try:
        from src.bot.manager import get_bot_client
        from src.bot.embed_utils import build_embed
        import discord as _discord
        bot = get_bot_client()
        if bot and bot.is_ready():
            discord_user = await bot.fetch_user(int(order.user.discord_id))
            if discord_user:
                embed = build_embed("giao_hang", db, vars={
                    "order.id": order.id,
                    "user.mention": f"<@{order.user.discord_id}>",
                    "user": order.user.username or order.user.discord_id,
                    "product.name": order.product.name if order.product else "",
                    "package": pkg_name,
                    "order.total": f"{order.total_price:,.0f}",
                }, guild_id=order.guild_id)
                embed.add_field(name="📦 Your Item", value=f"||{item.content}||", inline=False)
                if item.serial_number:
                    embed.add_field(name="🔑 Serial", value=f"`{item.serial_number}`", inline=True)
                await discord_user.send(embed=embed)
                log_order_action(order.id, order.guild_id, "delivered",
                                 actor_discord_id=None,
                                 note=f"Auto-delivered item #{item.id}", db=db)
                return True
    except Exception as e:
        logger.error(f"auto_deliver_order DM error: {e}")
    return False


async def check_spending_milestones(user: User, guild_id: str, db):
    """Check if user reached any spending milestones, grant roles, update tier, DM on new milestone."""
    if not user or not user.discord_id:
        return
    milestones = db.execute(
        select(SpendingMilestone)
        .where(SpendingMilestone.guild_id == guild_id, SpendingMilestone.active == True)
        .order_by(SpendingMilestone.threshold)
    ).scalars().all()
    if not milestones:
        return

    # Per-guild total from PAID/DELIVERED orders
    total = db.execute(
        select(func.sum(Order.total_price))
        .where(Order.user_id == user.id, Order.guild_id == guild_id,
               Order.status.in_(["PAID", "DELIVERED"]))
    ).scalar() or 0

    from src.bot.manager import get_bot_client
    bot = get_bot_client()
    if not bot or not bot.is_ready():
        return

    guild = bot.get_guild(int(guild_id)) if guild_id else None
    if not guild:
        return

    try:
        member = guild.get_member(int(user.discord_id)) or await guild.fetch_member(int(user.discord_id))
    except Exception:
        return

    from src.bot.embed_utils import build_embed

    # Determine highest reached milestone → update loyalty_tier
    highest_reached: SpendingMilestone | None = None
    for m in milestones:
        if total >= m.threshold:
            highest_reached = m

    if highest_reached:
        new_tier = highest_reached.name.lower().replace(" ", "_")
        if getattr(user, "loyalty_tier", None) != new_tier:
            user.loyalty_tier = new_tier
            user.tier_updated_at = datetime.datetime.utcnow()
            try:
                db.commit()
            except Exception:
                pass

    for m in milestones:
        if total >= m.threshold:
            role = guild.get_role(int(m.role_id))
            if role and role not in member.roles:
                try:
                    await member.add_roles(role, reason=f"Spending milestone: {m.name}")
                    # DM user on new milestone
                    try:
                        config = db.execute(select(SystemConfig).where(SystemConfig.guild_id == guild_id)).scalars().first()
                        currency_symbol = getattr(config, "currency_symbol", "$") or "$"
                        currency = getattr(config, "currency", "USD") or "USD"
                        dm_embed = build_embed("milestone_reached", db, vars={
                            "user.mention": member.mention,
                            "milestone.name": m.name,
                            "milestone.threshold": f"{m.threshold:,.0f} {currency_symbol}",
                            "role.mention": role.mention,
                            "user.total": f"{total:,.0f} {currency_symbol}",
                        }, guild_id=guild_id)
                        await member.send(embed=dm_embed)
                    except Exception:
                        pass  # DM blocked — non-fatal
                except Exception as e:
                    logger.warning(f"Failed to add milestone role {m.name}: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Flash Sale routes
# ─────────────────────────────────────────────────────────────────────────────

def _flash_sale_dict(fs: FlashSale) -> dict:
    return {
        "id": fs.id,
        "guild_id": fs.guild_id,
        "product_id": fs.product_id,
        "product_name": fs.product.name if fs.product else None,
        "package_name": fs.package_name,
        "discount_type": fs.discount_type,
        "discount_value": fs.discount_value,
        "quantity_limit": fs.quantity_limit,
        "quantity_used": fs.quantity_used,
        "allow_coupon": fs.allow_coupon,
        "starts_at": fs.starts_at.isoformat() if fs.starts_at else None,
        "ends_at": fs.ends_at.isoformat() if fs.ends_at else None,
        "active": fs.active,
        "channel_message_id": fs.channel_message_id,
        "created_at": fs.created_at.isoformat() if fs.created_at else None,
    }


@router.get("/flash-sales")
def get_flash_sales(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    items = db.execute(
        select(FlashSale)
        .options(joinedload(FlashSale.product))
        .where(FlashSale.guild_id == guild_id)
        .order_by(FlashSale.created_at.desc())
    ).scalars().all()
    return [_flash_sale_dict(fs) for fs in items]


@router.get("/flash-sales/active")
def get_active_flash_sale(product_id: int, package_name: str, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Check if an active flash sale exists for a product/package."""
    now = datetime.datetime.utcnow()
    fs = db.execute(
        select(FlashSale)
        .where(
            FlashSale.guild_id == guild_id,
            FlashSale.product_id == product_id,
            FlashSale.package_name == package_name,
            FlashSale.active == True,
            FlashSale.starts_at <= now,
            FlashSale.ends_at > now,
        )
    ).scalars().first()
    if not fs:
        return None
    # Also check quantity limit
    if fs.quantity_limit is not None and fs.quantity_used >= fs.quantity_limit:
        return None
    return _flash_sale_dict(fs)


@router.post("/flash-sales")
def create_flash_sale(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    product_id = body.get("product_id")
    if not product_id:
        raise HTTPException(400, "product_id required")
    product = db.execute(select(Product).where(Product.id == product_id, Product.guild_id == guild_id)).scalars().first()
    if not product:
        raise HTTPException(404, "Product not found")

    starts_at = datetime.datetime.fromisoformat(body["starts_at"]) if body.get("starts_at") else datetime.datetime.utcnow()
    ends_at = datetime.datetime.fromisoformat(body["ends_at"]) if body.get("ends_at") else starts_at + datetime.timedelta(hours=24)

    fs = FlashSale(
        guild_id=guild_id,
        product_id=product_id,
        package_name=body.get("package_name", ""),
        discount_type=body.get("discount_type", "percent"),
        discount_value=float(body.get("discount_value", 0)),
        quantity_limit=body.get("quantity_limit"),
        allow_coupon=bool(body.get("allow_coupon", False)),
        starts_at=starts_at,
        ends_at=ends_at,
        active=bool(body.get("active", True)),
    )
    db.add(fs)
    db.commit()
    db.refresh(fs)
    return _flash_sale_dict(fs)


@router.put("/flash-sales/{sale_id}")
def update_flash_sale(sale_id: int, body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    fs = db.execute(select(FlashSale).where(FlashSale.id == sale_id, FlashSale.guild_id == guild_id)).scalars().first()
    if not fs:
        raise HTTPException(404, "Flash sale not found")
    for k in ("discount_type", "discount_value", "quantity_limit", "allow_coupon", "active", "package_name"):
        if k in body:
            setattr(fs, k, body[k])
    if body.get("starts_at"):
        fs.starts_at = datetime.datetime.fromisoformat(body["starts_at"])
    if body.get("ends_at"):
        fs.ends_at = datetime.datetime.fromisoformat(body["ends_at"])
    db.commit()
    db.refresh(fs)
    return _flash_sale_dict(fs)


@router.delete("/flash-sales/{sale_id}")
def delete_flash_sale(sale_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    fs = db.execute(select(FlashSale).where(FlashSale.id == sale_id, FlashSale.guild_id == guild_id)).scalars().first()
    if not fs:
        raise HTTPException(404, "Flash sale not found")
    db.delete(fs)
    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Inventory routes
# ─────────────────────────────────────────────────────────────────────────────

def _inv_dict(item: InventoryItem) -> dict:
    return {
        "id": item.id,
        "guild_id": item.guild_id,
        "product_id": item.product_id,
        "product_name": item.product.name if item.product else None,
        "package_name": item.package_name,
        "content": item.content,
        "delivered_order_id": item.delivered_order_id,
        "status": "delivered" if item.delivered_order_id else "available",
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


@router.get("/inventory")
def get_inventory(
    product_id: int | None = None,
    package_name: str | None = None,
    status: str | None = None,   # "available" | "delivered" | None = all
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    q = select(InventoryItem).options(joinedload(InventoryItem.product)).where(InventoryItem.guild_id == guild_id)
    if product_id:
        q = q.where(InventoryItem.product_id == product_id)
    if package_name:
        q = q.where(InventoryItem.package_name == package_name)
    if status == "available":
        q = q.where(InventoryItem.delivered_order_id == None)
    elif status == "delivered":
        q = q.where(InventoryItem.delivered_order_id != None)
    items = db.execute(q.order_by(InventoryItem.created_at.asc())).scalars().all()
    return [_inv_dict(i) for i in items]


@router.get("/inventory/stats")
def get_inventory_stats(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Return available count per product/package."""
    rows = db.execute(
        select(
            InventoryItem.product_id,
            InventoryItem.package_name,
            func.count(InventoryItem.id).label("total"),
            func.sum(case((InventoryItem.delivered_order_id == None, 1), else_=0)).label("available"),
        )
        .where(InventoryItem.guild_id == guild_id)
        .group_by(InventoryItem.product_id, InventoryItem.package_name)
    ).all()
    result = []
    for r in rows:
        product = db.execute(select(Product).where(Product.id == r.product_id)).scalars().first()
        result.append({
            "product_id": r.product_id,
            "product_name": product.name if product else None,
            "package_name": r.package_name,
            "total": r.total,
            "available": int(r.available or 0),
            "delivered": r.total - int(r.available or 0),
        })
    return result


@router.post("/inventory")
def add_inventory_item(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    product_id = body.get("product_id")
    if not product_id:
        raise HTTPException(400, "product_id required")
    item = InventoryItem(
        guild_id=guild_id,
        product_id=product_id,
        package_name=body.get("package_name", ""),
        content=body.get("content", ""),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _inv_dict(item)


@router.post("/inventory/bulk")
def bulk_add_inventory(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Upload multiple items at once. body.contents = list of strings."""
    product_id = body.get("product_id")
    package_name = body.get("package_name", "")
    contents: list[str] = body.get("contents", [])
    if not product_id:
        raise HTTPException(400, "product_id required")
    if not contents:
        raise HTTPException(400, "No contents provided")
    added = 0
    for c in contents:
        c = c.strip()
        if not c:
            continue
        db.add(InventoryItem(guild_id=guild_id, product_id=product_id, package_name=package_name, content=c))
        added += 1
    db.commit()
    return {"ok": True, "added": added}


@router.delete("/inventory/{item_id}")
def delete_inventory_item(item_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    item = db.execute(select(InventoryItem).where(InventoryItem.id == item_id, InventoryItem.guild_id == guild_id)).scalars().first()
    if not item:
        raise HTTPException(404, "Item not found")
    if item.delivered_order_id:
        raise HTTPException(400, "Cannot delete delivered item")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.delete("/inventory/bulk-delete")
def bulk_delete_inventory(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Delete all available (undelivered) items for a product/package."""
    product_id = body.get("product_id")
    package_name = body.get("package_name")
    q = select(InventoryItem).where(
        InventoryItem.guild_id == guild_id,
        InventoryItem.delivered_order_id == None,
    )
    if product_id:
        q = q.where(InventoryItem.product_id == product_id)
    if package_name:
        q = q.where(InventoryItem.package_name == package_name)
    items = db.execute(q).scalars().all()
    for i in items:
        db.delete(i)
    db.commit()
    return {"ok": True, "deleted": len(items)}
