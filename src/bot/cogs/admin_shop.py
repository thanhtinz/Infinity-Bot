# src/bot/cogs/admin_shop.py
# /createorder: multi-payment, coupon button+Modal, timeout 15 min, update embed

import discord
import logging
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import SystemConfig, User, Product, Order, Coupon
from src.services.payments import get_provider

logger = logging.getLogger(__name__)


def fmt_price(amount: float, symbol: str, currency: str) -> str:
    """Format price with currency symbol. VND uses trailing ₫, others use leading symbol."""
    if currency == "VND":
        return f"{amount:,.0f}₫"
    return f"{symbol}{amount:,.2f}"


def get_session():
    return SessionLocal()


def _apply_coupon(price: float, coupon: Coupon, quantity: int = 1) -> float:
    """Calculate discounted price based on coupon type."""
    dtype = getattr(coupon, "discount_type", "percent") or "percent"
    if dtype == "percent" and coupon.discount_percent:
        return max(0.0, price * (1 - coupon.discount_percent / 100))
    if dtype == "fixed" and coupon.discount_amount:
        return max(0.0, price - coupon.discount_amount)
    if dtype == "buy_x_get_y":
        bx = getattr(coupon, "buy_x", None) or 0
        gy = getattr(coupon, "get_y", None) or 0
        if bx > 0 and gy > 0 and quantity >= bx:
            # e.g. buy 3 get 1 free → pay for (quantity - free_items)
            unit = price / quantity if quantity > 0 else price
            free = (quantity // bx) * gy
            return max(0.0, unit * max(0, quantity - free))
    # fallback — old-style: try percent then fixed
    if coupon.discount_percent:
        return max(0.0, price * (1 - coupon.discount_percent / 100))
    if coupon.discount_amount:
        return max(0.0, price - coupon.discount_amount)
    return price


def _validate_coupon_scope(coupon: Coupon, order, user_id: str, session) -> str | None:
    """Validate coupon apply_mode and customer_mode. Returns error message or None."""
    # Check product / category restriction
    apply_mode = getattr(coupon, "apply_mode", "all") or "all"
    if apply_mode == "product":
        target_pid = getattr(coupon, "apply_product_id", None)
        if target_pid and order.product_id != target_pid:
            return "❌ This coupon is not valid for this product."
    elif apply_mode == "category":
        target_cid = getattr(coupon, "apply_category_id", None)
        if target_cid and order.product_id:
            from src.models.models import Product
            prod = session.execute(select(Product).where(Product.id == order.product_id)).scalars().first()
            if prod and getattr(prod, "category_id", None) != target_cid:
                return "❌ This coupon is not valid for this product category."

    # Check customer restriction
    cust_mode = getattr(coupon, "customer_mode", "all") or "all"
    if cust_mode == "specific":
        allowed_ids = getattr(coupon, "customer_ids", []) or []
        if allowed_ids and user_id not in allowed_ids:
            return "❌ This coupon is not available for your account."

    return None


class CouponModal(discord.ui.Modal):
    def __init__(self, order_id: int, original_price: float, view_ref: "OrderPayView", currency: str = "VND", currency_symbol: str = "₫"):
        super().__init__(title="Enter Coupon Code")
        self.order_id = order_id
        self.original_price = original_price
        self.view_ref = view_ref
        self.currency = currency
        self.currency_symbol = currency_symbol
        self.code_input = discord.ui.InputText(
            label="Coupon code",
            placeholder="e.g. SUMMER30",
            style=discord.InputTextStyle.short,
            max_length=50,
        )
        self.add_item(self.code_input)

    async def callback(self, interaction: discord.Interaction):
        code = self.code_input.value.strip().upper()
        session = get_session()
        try:
            config = session.execute(select(SystemConfig).where(SystemConfig.guild_id == str(interaction.guild_id))).scalars().first()
            if not config:
                config = session.execute(select(SystemConfig).limit(1)).scalars().first()

            currency = getattr(config, "currency", "VND") or "VND"
            currency_symbol = getattr(config, "currency_symbol", "₫") or "₫"
            payment_methods = getattr(config, "payment_methods", None) or ["payos"]

            coupon = session.execute(
                select(Coupon).where(
                    Coupon.code == code,
                    Coupon.guild_id == str(interaction.guild_id),
                )
            ).scalars().first()

            if not coupon:
                await interaction.response.send_message("❌ Coupon not found.", ephemeral=True)
                return
            if coupon.used_count >= coupon.max_uses:
                await interaction.response.send_message("❌ Coupon has been used up.", ephemeral=True)
                return

            # Fetch order for product/quantity validation
            order = session.execute(select(Order).where(Order.id == self.order_id)).scalars().first()
            if not order:
                await interaction.response.send_message("❌ Order no longer exists.", ephemeral=True)
                return

            # Validate scope (product/category/customer restrictions)
            scope_err = _validate_coupon_scope(coupon, order, str(interaction.user.id), session)
            if scope_err:
                await interaction.response.send_message(scope_err, ephemeral=True)
                return

            qty = order.quantity or 1
            new_price = _apply_coupon(self.original_price, coupon, quantity=qty)

            method = order.payment_method or payment_methods[0]
            provider = get_provider(method)
            domain = config.public_app_url or "http://localhost:3034"
            if not domain.startswith("http"):
                domain = f"https://{domain}"

            result = await provider.create_checkout(
                amount=new_price,
                currency=currency,
                order_id=order.id,
                description=f"Order #{order.id} (coupon)",
                return_url=f"{domain}/success",
                cancel_url=f"{domain}/cancel",
                config=config,
            )

            checkout_url = result.checkout_url or ""

            # Update order
            order.total_price = new_price
            order.payos_order_code = result.order_code or result.payment_id or str(order.id)
            order.checkout_url = checkout_url
            order.payment_id = result.payment_id
            coupon.used_count += 1
            session.commit()

            # Update embed
            await self.view_ref.update_embed_with_coupon(
                interaction=interaction,
                coupon_code=code,
                original_price=self.original_price,
                new_price=new_price,
                checkout_url=checkout_url,
                currency=currency,
                currency_symbol=currency_symbol,
            )
        except Exception as e:
            logger.error(f"CouponModal error: {e}")
            await interaction.response.send_message("❌ Error applying coupon.", ephemeral=True)
        finally:
            session.close()


class OrderPayView(discord.ui.View):
    """View with Coupon button and Cancel order — attached to order embed."""
    def __init__(self, order_id: int, price: float, checkout_url: str, admin_id: int, currency: str = "VND", currency_symbol: str = "₫"):
        super().__init__(timeout=900)  # 15 minutes
        self.order_id = order_id
        self.price = price
        self.checkout_url = checkout_url
        self.admin_id = admin_id
        self.currency = currency
        self.currency_symbol = currency_symbol
        self.message: discord.Message | None = None

        # Pay button (link) — only if checkout_url exists
        if checkout_url:
            pay_btn = discord.ui.Button(
                label="💳 Pay Now",
                style=discord.ButtonStyle.link,
                url=checkout_url,
            )
            self.add_item(pay_btn)

    @discord.ui.button(label="🎫 Enter Coupon", style=discord.ButtonStyle.secondary, custom_id="coupon_btn")
    async def coupon_btn(self, button: discord.ui.Button, interaction: discord.Interaction):
        modal = CouponModal(
            order_id=self.order_id,
            original_price=self.price,
            view_ref=self,
            currency=self.currency,
            currency_symbol=self.currency_symbol,
        )
        await interaction.response.send_modal(modal)

    @discord.ui.button(label="❌ Cancel Order", style=discord.ButtonStyle.danger, custom_id="cancel_btn")
    async def cancel_btn(self, button: discord.ui.Button, interaction: discord.Interaction):
        if interaction.user.id != self.admin_id and not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ Only admins can cancel orders.", ephemeral=True)
            return
        session = get_session()
        try:
            order = session.execute(select(Order).where(Order.id == self.order_id)).scalars().first()
            if order:
                order.status = "CANCELLED"
                session.commit()
            self.stop()
            from src.bot.embed_utils import build_embed
            session2 = get_session()
            try:
                embed = build_embed("don_hang_het_han", session2, vars={
                    "order.id": str(self.order_id),
                    "user": interaction.user.name,
                    "product.name": "Cancelled by admin",
                }, guild_id=str(interaction.guild_id))
            finally:
                session2.close()
            if self.message:
                await self.message.edit(embed=embed, view=None)
            await interaction.response.send_message("Order cancelled.", ephemeral=True)
        finally:
            session.close()

    async def _cancel_callback(self, interaction: discord.Interaction):
        """Callback for dynamically created cancel button in update_embed_with_coupon."""
        await self.cancel_btn(discord.ui.Button(), interaction)

    async def update_embed_with_coupon(
        self,
        interaction: discord.Interaction,
        coupon_code: str,
        original_price: float,
        new_price: float,
        checkout_url: str,
        currency: str = "VND",
        currency_symbol: str = "₫",
    ):
        """Update payment button URL and embed after applying coupon."""
        self.checkout_url = checkout_url
        self.price = new_price

        # Rebuild view: keep cancel button + timeout, update link
        self.clear_items()
        if checkout_url:
            self.add_item(discord.ui.Button(
                label="💳 Pay Now",
                style=discord.ButtonStyle.link,
                url=checkout_url,
            ))
        self.add_item(discord.ui.Button(
            label=f"✅ Coupon: {coupon_code}",
            style=discord.ButtonStyle.success,
            disabled=True,
        ))
        cancel_btn = discord.ui.Button(label="❌ Cancel Order", style=discord.ButtonStyle.danger, custom_id=f"cancel_{self.order_id}")
        cancel_btn.callback = self._cancel_callback
        self.add_item(cancel_btn)

        if self.message:
            try:
                old_embed = self.message.embeds[0]
                # Add coupon field
                new_embed = old_embed.copy()
                new_embed.color = discord.Color.orange()
                new_embed.add_field(
                    name="🎫 Coupon Applied",
                    value=f"`{coupon_code}` — {fmt_price(original_price, currency_symbol, currency)} → **{fmt_price(new_price, currency_symbol, currency)}**",
                    inline=False,
                )
                await self.message.edit(embed=new_embed, view=self)
            except Exception as e:
                logger.error(f"update_embed_with_coupon error: {e}")

        await interaction.response.send_message(
            f"✅ Coupon **{coupon_code}** applied! New price: **{fmt_price(new_price, currency_symbol, currency)}**",
            ephemeral=True,
        )

    async def on_timeout(self):
        """After 15 minutes without payment → cancel order + update embed."""
        session = get_session()
        try:
            order = session.execute(select(Order).where(Order.id == self.order_id)).scalars().first()
            if order and order.status in ("PENDING", "PENDING_MANUAL"):
                order.status = "CANCELLED"
                session.commit()
        finally:
            session.close()

        if self.message:
            try:
                from src.bot.embed_utils import build_embed
                session2 = get_session()
                try:
                    expire_embed = build_embed("don_hang_het_han", session2, vars={
                        "order.id": str(self.order_id),
                        "product.name": "",
                    }, guild_id=str(interaction.guild_id))
                finally:
                    session2.close()
                await self.message.edit(embed=expire_embed, view=None)
            except Exception:
                pass


# ── Price List UI ──────────────────────────────────────────────────────────────

class BangGiaSelect(discord.ui.Select):
    def __init__(self, products: list):
        options = []
        for p in products[:25]:
            opt = discord.SelectOption(
                label=(p.name or f"Product #{p.id}")[:100],
                value=str(p.id),
                description=(p.description[:100] if p.description else "View package details"),
            )
            # Parse emoji — supports Unicode, custom <:name:id>, or :name:id
            if p.emoji:
                raw = p.emoji.strip()
                if raw.startswith("<") and raw.endswith(">"):
                    raw = raw[1:-1]  # strip < >
                if ":" in raw:
                    parts = raw.split(":")
                    try:
                        eid = int(parts[-1])
                        ename = parts[-2] if len(parts) >= 2 else "_"
                        opt.emoji = discord.PartialEmoji(name=ename, id=eid, animated=raw.startswith("a:"))
                    except (ValueError, IndexError):
                        pass
                else:
                    opt.emoji = raw  # Unicode emoji
            options.append(opt)
        super().__init__(
            placeholder="🔍 Select a product to view details...",
            options=options or [discord.SelectOption(label="No products available", value="_")],
            min_values=1,
            max_values=1,
            custom_id="bang_gia_select_persistent",
        )
        # Store plain data (no SQLAlchemy objects since session is closed)
        self.product_ids = [str(p.id) for p in products[:25]]

    async def callback(self, interaction: discord.Interaction):
        product_id = self.values[0]

        from src.database.config import SessionLocal
        from src.bot.embed_utils import build_embed, resolve_image_url
        from src.models.models import EmbedTemplate
        session = SessionLocal()
        try:
            product = session.execute(
                select(Product).where(Product.id == int(product_id))
            ).scalars().first()

            if not product:
                await interaction.response.send_message("❌ Product not found.", ephemeral=True)
                return

            pkgs = [pk for pk in (product.packages or []) if pk.get("active", True)]
            img = resolve_image_url(product.image_url, session)

            # Get currency config
            config = session.execute(select(SystemConfig).where(SystemConfig.guild_id == str(interaction.guild_id))).scalars().first()
            if not config:
                config = session.execute(select(SystemConfig).limit(1)).scalars().first()
            currency = getattr(config, "currency", "VND") or "VND"
            currency_symbol = getattr(config, "currency_symbol", "₫") or "₫"

            # Try per-product embed first, fall back to generic san_pham_detail
            product_event = f"product_{product.id}"
            _gid = str(interaction.guild_id)
            tmpl = session.execute(
                select(EmbedTemplate).where(EmbedTemplate.event_type == product_event, EmbedTemplate.guild_id == _gid)
            ).scalars().first()
            if not tmpl:
                tmpl = session.execute(
                    select(EmbedTemplate).where(EmbedTemplate.event_type == "san_pham_detail", EmbedTemplate.guild_id == _gid)
                ).scalars().first()
            db_has_fields = bool(tmpl and tmpl.enabled and tmpl.fields)

            first_pkg = pkgs[0] if pkgs else {}
            embed = build_embed(product_event, session, vars={
                "product.name": product.name or f"Product #{product.id}",
                "product.description": product.description or "No description.",
                "product.image_url": img or "",
                "package.name": first_pkg.get("name", ""),
                "package.price": fmt_price(first_pkg.get('price', 0), currency_symbol, currency) if first_pkg else "",
                "package.description": first_pkg.get("description", "") if first_pkg else "Contact admin for pricing.",
            }, guild_id=_gid)

            if pkgs and not db_has_fields:
                for pk in pkgs:
                    price = pk.get("price", 0)
                    val = f"💰 **{fmt_price(price, currency_symbol, currency)}**"
                    if pk.get("description"):
                        val += f"\n{pk['description']}"
                    embed.add_field(name=f"🔹 {pk.get('name', 'Package')}", value=val, inline=False)

            if img and not embed.image:
                embed.set_image(url=img)
            elif img and not embed.thumbnail:
                embed.set_thumbnail(url=img)

            await interaction.response.send_message(embed=embed, ephemeral=True)
        except Exception as e:
            logger.error(f"BangGiaSelect callback error: {e}")
            await interaction.response.send_message("❌ System error.", ephemeral=True)
        finally:
            session.close()


class BangGiaView(discord.ui.View):
    def __init__(self, products: list | None = None):
        super().__init__(timeout=None)
        if products is not None:
            self.add_item(BangGiaSelect(products))
        else:
            # Persistent re-register: load products from DB
            session = SessionLocal()
            try:
                prods = session.execute(
                    select(Product).where(Product.active == True).order_by(Product.id)
                ).scalars().all()
                self.add_item(BangGiaSelect(prods))
            except Exception:
                self.add_item(BangGiaSelect([]))
            finally:
                session.close()


async def _autocomplete_product_names(ctx: discord.AutocompleteContext):
    session = SessionLocal()
    try:
        guild_id = str(ctx.interaction.guild_id) if ctx.interaction and ctx.interaction.guild_id else None
        where_clause = [Product.active == True]
        if guild_id:
            where_clause.append(Product.guild_id == guild_id)
        products = session.execute(
            select(Product).where(*where_clause).order_by(Product.id)
        ).scalars().all()
        query = (ctx.value or "").lower()
        return [p.name for p in products if p.name and query in p.name.lower()][:25]
    except Exception:
        return []
    finally:
        session.close()


class AdminShopCog(discord.Cog):
    def __init__(self, bot):
        self.bot = bot

    @discord.slash_command(name="createorder", description="[Admin] Create order + payment link for user")
    @discord.default_permissions(administrator=True)
    async def tao_don_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Select a member"),
        product_id: discord.Option(int, "Product ID (see /product)"),
        package_name: discord.Option(str, "Package name (leave empty = first package)", required=False, default=""),
        quantity: discord.Option(int, "Quantity", required=False, default=1, min_value=1, max_value=99),
        channel: discord.Option(discord.TextChannel, "Payment channel (leave empty = current channel)", required=False, default=None),
        payment_method: discord.Option(str, "Payment method", required=False, choices=["payos", "paypal", "crypto", "manual"], default=None),
    ):
        await ctx.defer()
        session = get_session()
        try:
            config = session.execute(select(SystemConfig).where(SystemConfig.guild_id == str(ctx.guild_id))).scalars().first()
            if not config:
                config = session.execute(select(SystemConfig).limit(1)).scalars().first()

            currency = getattr(config, "currency", "VND") or "VND"
            currency_symbol = getattr(config, "currency_symbol", "₫") or "₫"
            payment_methods = getattr(config, "payment_methods", None) or ["payos"]

            if not payment_methods:
                await ctx.respond("⚠️ No payment method configured! Set up in Dashboard > Payments.", ephemeral=True)
                return

            # Validate payment method
            method = payment_method or payment_methods[0]
            if method not in payment_methods:
                await ctx.respond(f"⚠️ Payment method **{method}** is not enabled. Enabled: {', '.join(payment_methods)}", ephemeral=True)
                return

            product = session.execute(
                select(Product).where(Product.id == product_id, Product.guild_id == str(ctx.guild_id))
            ).scalars().first()
            if not product:
                await ctx.respond(f"❌ Product ID #{product_id} not found.", ephemeral=True)
                return

            # Calculate price from package
            pkgs = product.packages or []
            price_per_unit = 0.0
            matched_pkg_name = package_name or ""

            if pkgs:
                active_pkgs = [pk for pk in pkgs if pk.get("active", True)]
                if package_name:
                    matched = next((pk for pk in active_pkgs if pk["name"].lower() == package_name.lower()), None)
                    if not matched:
                        names = ", ".join(f'`{pk["name"]}`' for pk in active_pkgs)
                        await ctx.respond(f"❌ Package **{package_name}** not found.\nPackages: {names}", ephemeral=True)
                        return
                    price_per_unit = float(matched["price"])
                    matched_pkg_name = matched["name"]
                elif active_pkgs:
                    price_per_unit = float(active_pkgs[0]["price"])
                    matched_pkg_name = active_pkgs[0]["name"]
            else:
                price_per_unit = float(product.price or 0)

            total = price_per_unit * quantity
            if total <= 0:
                await ctx.respond("❌ Invalid product price.", ephemeral=True)
                return

            # Find or create user in DB
            db_user = session.execute(
                select(User).where(User.discord_id == str(user.id))
            ).scalars().first()
            if not db_user:
                db_user = User(discord_id=str(user.id), username=str(user.display_name))
                session.add(db_user)
                session.flush()

            order = Order(
                user_id=db_user.id,
                product_id=product.id,
                quantity=quantity,
                total_price=total,
                package_name=matched_pkg_name or None,
                status="PENDING",
                payment_method=method,
                currency=currency,
                guild_id=str(ctx.guild_id),
            )
            session.add(order)
            session.commit()

            # Create checkout via payment service
            provider = get_provider(method)
            domain = config.public_app_url or "http://localhost:3034"
            if not domain.startswith("http"):
                domain = f"https://{domain}"

            product_display = (product.name or f"Product #{product.id}") + (f" ({matched_pkg_name})" if matched_pkg_name else "")
            if quantity > 1:
                product_display += f" x{quantity}"

            result = await provider.create_checkout(
                amount=total,
                currency=currency,
                order_id=order.id,
                description=f"Order #{order.id}",
                return_url=f"{domain}/success",
                cancel_url=f"{domain}/cancel",
                config=config,
            )

            checkout_url = result.checkout_url or ""
            order.checkout_url = checkout_url
            order.payos_order_code = result.order_code or result.payment_id or str(order.id)
            order.payment_method = method
            order.currency = currency
            order.payment_id = result.payment_id

            # Handle manual payment specifics
            if method == "manual" and result.raw:
                order.status = "PENDING_MANUAL"

            session.commit()

            # Build embed from template (or default)
            from src.bot.embed_utils import build_embed, resolve_image_url
            order_vars = {
                "order.id": order.id,
                "user.mention": user.mention,
                "user": user.display_name,
                "user.id": user.id,
                "product.name": product_display,
                "package": matched_pkg_name,
                "order.total": fmt_price(total, currency_symbol, currency),
            }

            # Manual payment: add bank info to vars
            if method == "manual" and result.raw:
                order_vars["bank_name"] = result.raw.get("bank_name", "")
                order_vars["account_holder"] = result.raw.get("account_holder", "")
                order_vars["account_number"] = result.raw.get("account_number", "")
                order_vars["instructions"] = result.raw.get("instructions", "")

            # 1) Send order notification → don_hang_channel (if configured)
            if config.don_hang_channel_id:
                don_hang_ch = ctx.guild.get_channel(int(config.don_hang_channel_id))
                if don_hang_ch:
                    order_embed = build_embed("don_hang_moi", session, vars=order_vars, guild_id=str(interaction.guild_id))
                    await don_hang_ch.send(
                        content=f"{user.mention} You have a new order!",
                        embed=order_embed,
                    )

            # 2) Send payment embed → specified channel or current channel
            # Try per-payment-type embed first, fall back to generic qr_thanh_toan
            embed_event = f"qr_thanh_toan_{method}"
            from src.models.models import EmbedTemplate
            specific_tmpl = session.execute(
                select(EmbedTemplate).where(EmbedTemplate.event_type == embed_event, EmbedTemplate.guild_id == str(interaction.guild_id))
            ).scalars().first()
            if not specific_tmpl:
                embed_event = "qr_thanh_toan"

            qr_embed = build_embed(embed_event, session, vars={
                **order_vars,
                "qr_url": checkout_url or "",
                "transfer_content": f"Order {order.id}",
            }, guild_id=str(interaction.guild_id))

            # Manual payment: set QR image if available
            if method == "manual" and result.raw and result.raw.get("qr_image_id"):
                qr_img = resolve_image_url(result.raw["qr_image_id"], session)
                if qr_img:
                    qr_embed.set_image(url=qr_img)

            view = OrderPayView(
                order_id=order.id,
                price=total,
                checkout_url=checkout_url,
                admin_id=ctx.author.id,
                currency=currency,
                currency_symbol=currency_symbol,
            )

            qr_channel = channel or ctx.channel
            msg = await qr_channel.send(
                content=f"{user.mention} Payment for order #{order.id}",
                embed=qr_embed,
                view=view,
            )
            view.message = msg

            # Save message info
            order.discord_message_id = str(msg.id)
            order.discord_channel_id = str(msg.channel.id)
            session.commit()

            parts = [f"✅ Order #{order.id} created."]
            if config.don_hang_channel_id:
                parts.append(f"📦 Order notification → <#{config.don_hang_channel_id}>")
            if qr_channel != ctx.channel:
                parts.append(f"💳 Payment → {qr_channel.mention}")
            await ctx.respond(" ".join(parts), ephemeral=True)

        except Exception as e:
            logger.error(f"tao_don_cmd error: {e}")
            await ctx.respond("❌ System error creating order.", ephemeral=True)
        finally:
            session.close()

    @discord.slash_command(name="pricelist", description="[Admin] Send/update product price list to channel")
    @discord.default_permissions(administrator=True)
    async def bang_gia_cmd(
        self,
        ctx: discord.ApplicationContext,
        channel: discord.Option(discord.TextChannel, "Price list channel (leave empty = current channel)", required=False, default=None),
    ):
        session = get_session()
        try:
            products = session.execute(
                select(Product).where(Product.active == True, Product.guild_id == str(ctx.guild_id)).order_by(Product.id)
            ).scalars().all()

            if not products:
                await ctx.respond("⚠️ No products available yet.", ephemeral=True)
                return

            from src.bot.embed_utils import build_embed
            embed = build_embed("bang_gia", session, guild_id=str(interaction.guild_id))
            if not embed.footer:
                embed.set_footer(text="Click a product name below to view package details")

            view = BangGiaView(products)
            target = channel or ctx.channel

            # Try to edit old message if exists
            config = session.execute(select(SystemConfig).where(SystemConfig.guild_id == str(ctx.guild_id))).scalars().first()
            if not config:
                config = session.execute(select(SystemConfig).limit(1)).scalars().first()
            old_msg_id = config.bang_gia_message_id if config else None
            old_channel_id = config.bang_gia_channel_id if config else None
            edited = False

            if old_msg_id and old_channel_id:
                try:
                    old_ch = ctx.guild.get_channel(int(old_channel_id))
                    if old_ch:
                        old_msg = await old_ch.fetch_message(int(old_msg_id))
                        await old_msg.edit(embed=embed, view=view)
                        edited = True
                        # Update channel if changed
                        if str(target.id) != old_channel_id:
                            await old_msg.delete()
                            edited = False
                except Exception:
                    edited = False

            if not edited:
                msg = await target.send(embed=embed, view=view)
                # Save message_id + channel_id to DB
                if config:
                    config.bang_gia_channel_id = str(target.id)
                    config.bang_gia_message_id = str(msg.id)
                    session.commit()

            if edited:
                await ctx.respond("✅ Price list updated.", ephemeral=True)
            else:
                await ctx.respond(f"✅ Price list sent to {target.mention}", ephemeral=True)

        except Exception as e:
            logger.error(f"bang_gia_cmd error: {e}")
            await ctx.respond("❌ System error.", ephemeral=True)
        finally:
            session.close()


    @discord.slash_command(name="createorder_custom", description="[Admin] Create custom order (custom name, no product in system required)")
    @discord.default_permissions(administrator=True)
    async def tao_don_custom_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Select a member"),
        product_name: discord.Option(str, "Custom product name"),
        price: discord.Option(int, "Price", min_value=1000),
        note: discord.Option(str, "Note / additional description (optional)", required=False, default=""),
        quantity: discord.Option(int, "Quantity", required=False, default=1, min_value=1, max_value=99),
        channel: discord.Option(discord.TextChannel, "Payment channel (leave empty = current channel)", required=False, default=None),
        payment_method: discord.Option(str, "Payment method", required=False, choices=["payos", "paypal", "crypto", "manual"], default=None),
    ):
        await ctx.defer()
        session = get_session()
        try:
            config = session.execute(select(SystemConfig).where(SystemConfig.guild_id == str(ctx.guild_id))).scalars().first()
            if not config:
                config = session.execute(select(SystemConfig).limit(1)).scalars().first()

            currency = getattr(config, "currency", "VND") or "VND"
            currency_symbol = getattr(config, "currency_symbol", "₫") or "₫"
            payment_methods = getattr(config, "payment_methods", None) or ["payos"]

            if not payment_methods:
                await ctx.respond("⚠️ No payment method configured! Set up in Dashboard > Payments.", ephemeral=True)
                return

            # Validate payment method
            method = payment_method or payment_methods[0]
            if method not in payment_methods:
                await ctx.respond(f"⚠️ Payment method **{method}** is not enabled. Enabled: {', '.join(payment_methods)}", ephemeral=True)
                return

            total = float(price) * quantity

            db_user = session.execute(
                select(User).where(User.discord_id == str(user.id))
            ).scalars().first()
            if not db_user:
                db_user = User(discord_id=str(user.id), username=str(user.display_name))
                session.add(db_user)
                session.flush()

            order = Order(
                user_id=db_user.id,
                product_id=None,
                quantity=quantity,
                total_price=total,
                package_name=product_name,
                status="PENDING",
                payment_method=method,
                currency=currency,
                guild_id=str(ctx.guild_id),
            )
            session.add(order)
            session.commit()

            # Create checkout via payment service
            provider = get_provider(method)
            domain = config.public_app_url or "http://localhost:3034"
            if not domain.startswith("http"):
                domain = f"https://{domain}"

            product_display = product_name[:40]
            if quantity > 1:
                product_display += f" x{quantity}"

            result = await provider.create_checkout(
                amount=total,
                currency=currency,
                order_id=order.id,
                description=f"Order #{order.id}",
                return_url=f"{domain}/success",
                cancel_url=f"{domain}/cancel",
                config=config,
            )

            checkout_url = result.checkout_url or ""
            order.checkout_url = checkout_url
            order.payos_order_code = result.order_code or result.payment_id or str(order.id)
            order.payment_method = method
            order.currency = currency
            order.payment_id = result.payment_id

            # Handle manual payment specifics
            if method == "manual" and result.raw:
                order.status = "PENDING_MANUAL"

            session.commit()

            from src.bot.embed_utils import build_embed, resolve_image_url
            from src.models.models import EmbedTemplate
            order_vars = {
                "order.id": order.id,
                "user.mention": user.mention,
                "user": user.display_name,
                "user.id": user.id,
                "product.name": product_display,
                "package": product_name,
                "order.total": fmt_price(total, currency_symbol, currency),
            }

            # Manual payment: add bank info to vars
            if method == "manual" and result.raw:
                order_vars["bank_name"] = result.raw.get("bank_name", "")
                order_vars["account_holder"] = result.raw.get("account_holder", "")
                order_vars["account_number"] = result.raw.get("account_number", "")
                order_vars["instructions"] = result.raw.get("instructions", "")

            if config.don_hang_channel_id:
                don_hang_ch = ctx.guild.get_channel(int(config.don_hang_channel_id))
                if don_hang_ch:
                    order_embed = build_embed("don_hang_moi", session, vars=order_vars, guild_id=str(interaction.guild_id))
                    if note:
                        order_embed.add_field(name="Note", value=note, inline=False)
                    await don_hang_ch.send(
                        content=f"{user.mention} You have a new order!",
                        embed=order_embed,
                    )

            # Try per-payment-type embed first, fall back to generic qr_thanh_toan
            embed_event = f"qr_thanh_toan_{method}"
            specific_tmpl = session.execute(
                select(EmbedTemplate).where(EmbedTemplate.event_type == embed_event, EmbedTemplate.guild_id == str(interaction.guild_id))
            ).scalars().first()
            if not specific_tmpl:
                embed_event = "qr_thanh_toan"

            qr_embed = build_embed(embed_event, session, vars={
                **order_vars,
                "qr_url": checkout_url or "",
                "transfer_content": f"Order {order.id}",
            }, guild_id=str(interaction.guild_id))

            # Manual payment: set QR image if available
            if method == "manual" and result.raw and result.raw.get("qr_image_id"):
                qr_img = resolve_image_url(result.raw["qr_image_id"], session)
                if qr_img:
                    qr_embed.set_image(url=qr_img)

            view = OrderPayView(
                order_id=order.id,
                price=total,
                checkout_url=checkout_url,
                admin_id=ctx.author.id,
                currency=currency,
                currency_symbol=currency_symbol,
            )

            qr_channel = channel or ctx.channel
            msg = await qr_channel.send(
                content=f"{user.mention} Payment for order #{order.id}",
                embed=qr_embed,
                view=view,
            )
            view.message = msg

            order.discord_message_id = str(msg.id)
            order.discord_channel_id = str(msg.channel.id)
            session.commit()

            parts = [f"✅ Custom order #{order.id} created."]
            if config.don_hang_channel_id:
                parts.append(f"📦 Order notification → <#{config.don_hang_channel_id}>")
            if qr_channel != ctx.channel:
                parts.append(f"💳 Payment → {qr_channel.mention}")
            await ctx.respond(" ".join(parts), ephemeral=True)

        except Exception as e:
            logger.error(f"tao_don_custom error: {e}")
            await ctx.respond("❌ System error creating order.", ephemeral=True)
        finally:
            session.close()


def setup(bot):
    bot.add_cog(AdminShopCog(bot))
