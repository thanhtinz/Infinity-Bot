# src/bot/cogs/admin_shop.py
# /tao_don nâng cấp: coupon button+Modal, timeout 15 phút, update embed

import discord
import asyncio
import datetime
import logging
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from src.database.config import SessionLocal
from src.models.models import SystemConfig, User, Product, Order, Coupon
from payos import PayOS
from payos.type import ItemData, PaymentData

logger = logging.getLogger(__name__)


def get_session():
    return SessionLocal()


def _apply_coupon(price: float, coupon: Coupon) -> float:
    if coupon.discount_percent:
        return max(0.0, price * (1 - coupon.discount_percent / 100))
    if coupon.discount_amount:
        return max(0.0, price - coupon.discount_amount)
    return price


class CouponModal(discord.ui.Modal):
    def __init__(self, order_id: int, original_price: float, view_ref: "OrderPayView"):
        super().__init__(title="Nhập mã Coupon")
        self.order_id = order_id
        self.original_price = original_price
        self.view_ref = view_ref
        self.code_input = discord.ui.InputText(
            label="Mã coupon",
            placeholder="VD: SUMMER30",
            style=discord.InputTextStyle.short,
            max_length=50,
        )
        self.add_item(self.code_input)

    async def callback(self, interaction: discord.Interaction):
        code = self.code_input.value.strip().upper()
        session = get_session()
        try:
            config = session.execute(select(SystemConfig).limit(1)).scalars().first()
            coupon = session.execute(
                select(Coupon).where(Coupon.code == code)
            ).scalars().first()

            if not coupon:
                await interaction.response.send_message("❌ Mã coupon không tồn tại.", ephemeral=True)
                return
            if coupon.used_count >= coupon.max_uses:
                await interaction.response.send_message("❌ Mã coupon đã hết lượt sử dụng.", ephemeral=True)
                return

            new_price = _apply_coupon(self.original_price, coupon)

            # Tạo PayOS link mới với giá đã giảm
            order = session.execute(select(Order).where(Order.id == self.order_id)).scalars().first()
            if not order:
                await interaction.response.send_message("❌ Đơn hàng không còn tồn tại.", ephemeral=True)
                return

            payos = PayOS(
                client_id=config.payos_client_id,
                api_key=config.payos_api_key,
                checksum_key=config.payos_checksum_key,
            )
            domain = config.public_app_url or "http://localhost:3034"
            if not domain.startswith("http"):
                domain = f"https://{domain}"

            new_order_code = int(f"{order.id}{int(datetime.datetime.utcnow().timestamp()) % 10000}")
            item = ItemData(name=f"Don #{order.id} (coupon)", quantity=1, price=int(new_price))
            payment_data = PaymentData(
                orderCode=new_order_code,
                amount=int(new_price),
                description=f"Don #{order.id} giam gia",
                items=[item],
                cancelUrl=f"{domain}/cancel",
                returnUrl=f"{domain}/success",
            )
            payos_res = await asyncio.to_thread(payos.createPaymentLink, payment_data)
            checkout_url = payos_res.checkoutUrl

            # Update order
            order.total_price = new_price
            order.payos_order_code = str(new_order_code)
            coupon.used_count += 1
            session.commit()

            # Update embed
            await self.view_ref.update_embed_with_coupon(
                interaction=interaction,
                coupon_code=code,
                original_price=self.original_price,
                new_price=new_price,
                checkout_url=checkout_url,
            )
        except Exception as e:
            logger.error(f"CouponModal error: {e}")
            await interaction.response.send_message("❌ Lỗi khi áp dụng coupon.", ephemeral=True)
        finally:
            session.close()


class OrderPayView(discord.ui.View):
    """View kèm nút Nhập Coupon và Hủy đơn — gắn vào embed đơn hàng."""
    def __init__(self, order_id: int, price: float, checkout_url: str, admin_id: int):
        super().__init__(timeout=900)  # 15 phút
        self.order_id = order_id
        self.price = price
        self.checkout_url = checkout_url
        self.admin_id = admin_id
        self.message: discord.Message | None = None

        # Nút mở link thanh toán
        pay_btn = discord.ui.Button(
            label="💳 Thanh toán ngay",
            style=discord.ButtonStyle.link,
            url=checkout_url,
        )
        self.add_item(pay_btn)

    @discord.ui.button(label="🎫 Nhập Coupon", style=discord.ButtonStyle.secondary, custom_id="coupon_btn")
    async def coupon_btn(self, button: discord.ui.Button, interaction: discord.Interaction):
        modal = CouponModal(
            order_id=self.order_id,
            original_price=self.price,
            view_ref=self,
        )
        await interaction.response.send_modal(modal)

    @discord.ui.button(label="❌ Hủy đơn", style=discord.ButtonStyle.danger, custom_id="cancel_btn")
    async def cancel_btn(self, button: discord.ui.Button, interaction: discord.Interaction):
        if interaction.user.id != self.admin_id and not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ Chỉ Admin mới có thể hủy đơn.", ephemeral=True)
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
                    "product.name": "Đã hủy bởi admin",
                })
            finally:
                session2.close()
            if self.message:
                await self.message.edit(embed=embed, view=None)
            await interaction.response.send_message("Đã hủy đơn hàng.", ephemeral=True)
        finally:
            session.close()

    async def update_embed_with_coupon(
        self,
        interaction: discord.Interaction,
        coupon_code: str,
        original_price: float,
        new_price: float,
        checkout_url: str,
    ):
        """Cập nhật URL nút thanh toán và embed sau khi áp coupon."""
        self.checkout_url = checkout_url
        self.price = new_price

        # Rebuild view: giữ lại cancel button + timeout, cập nhật link
        self.clear_items()
        self.add_item(discord.ui.Button(
            label="💳 Thanh toán ngay",
            style=discord.ButtonStyle.link,
            url=checkout_url,
        ))
        self.add_item(discord.ui.Button(
            label=f"✅ Coupon: {coupon_code}",
            style=discord.ButtonStyle.success,
            disabled=True,
        ))
        cancel_btn = discord.ui.Button(label="❌ Hủy đơn", style=discord.ButtonStyle.danger, custom_id=f"cancel_{self.order_id}")
        cancel_btn.callback = self.cancel_callback
        self.add_item(cancel_btn)

        if self.message:
            try:
                old_embed = self.message.embeds[0]
                # Thêm field coupon
                new_embed = old_embed.copy()
                new_embed.color = discord.Color.orange()
                new_embed.add_field(
                    name="🎫 Coupon áp dụng",
                    value=f"`{coupon_code}` — {original_price:,.0f}đ → **{new_price:,.0f}đ**",
                    inline=False,
                )
                await self.message.edit(embed=new_embed, view=self)
            except Exception as e:
                logger.error(f"update_embed_with_coupon error: {e}")

        await interaction.response.send_message(
            f"✅ Đã áp dụng coupon **{coupon_code}**! Giá mới: **{new_price:,.0f}đ**",
            ephemeral=True,
        )

    async def on_timeout(self):
        """Sau 15 phút không thanh toán → hủy đơn + xóa embed."""
        session = get_session()
        try:
            order = session.execute(select(Order).where(Order.id == self.order_id)).scalars().first()
            if order and order.status == "PENDING":
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
                    })
                finally:
                    session2.close()
                await self.message.edit(embed=expire_embed, view=None)
            except Exception:
                pass


# ── Bang gia UI ───────────────────────────────────────────────────────────────

class BangGiaSelect(discord.ui.Select):
    def __init__(self, products: list):
        options = []
        for p in products[:25]:
            opt = discord.SelectOption(
                label=(p.name or f"Sản phẩm #{p.id}")[:100],
                value=str(p.id),
                description=(p.description[:100] if p.description else "Xem chi tiết gói"),
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
            placeholder="🔍 Chọn sản phẩm để xem chi tiết...",
            options=options or [discord.SelectOption(label="Không có sản phẩm", value="_")],
            min_values=1,
            max_values=1,
            custom_id="bang_gia_select_persistent",
        )
        # Lưu plain data (không giữ SQLAlchemy objects vì session đã đóng)
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
                await interaction.response.send_message("❌ Không tìm thấy sản phẩm.", ephemeral=True)
                return

            pkgs = [pk for pk in (product.packages or []) if pk.get("active", True)]
            img = resolve_image_url(product.image_url, session)

            # Try per-product embed first, fall back to generic san_pham_detail
            product_event = f"product_{product.id}"
            tmpl = session.execute(
                select(EmbedTemplate).where(EmbedTemplate.event_type == product_event)
            ).scalars().first()
            if not tmpl:
                tmpl = session.execute(
                    select(EmbedTemplate).where(EmbedTemplate.event_type == "san_pham_detail")
                ).scalars().first()
            db_has_fields = bool(tmpl and tmpl.enabled and tmpl.fields)

            first_pkg = pkgs[0] if pkgs else {}
            embed = build_embed(product_event, session, vars={
                "product.name": product.name or f"Sản phẩm #{product.id}",
                "product.description": product.description or "Không có mô tả.",
                "product.image_url": img or "",
                "package.name": first_pkg.get("name", ""),
                "package.price": f"{first_pkg.get('price', 0):,.0f}" if first_pkg else "",
                "package.description": first_pkg.get("description", "") if first_pkg else "Liên hệ admin để biết giá.",
            })

            if pkgs and not db_has_fields:
                for pk in pkgs:
                    price = pk.get("price", 0)
                    val = f"💰 **{price:,.0f}đ**"
                    if pk.get("description"):
                        val += f"\n{pk['description']}"
                    embed.add_field(name=f"🔹 {pk.get('name', 'Gói')}", value=val, inline=False)

            if img and not embed.image:
                embed.set_image(url=img)
            elif img and not embed.thumbnail:
                embed.set_thumbnail(url=img)

            await interaction.response.send_message(embed=embed, ephemeral=True)
        except Exception as e:
            logger.error(f"BangGiaSelect callback error: {e}")
            await interaction.response.send_message("❌ Lỗi hệ thống.", ephemeral=True)
        finally:
            session.close()


class BangGiaView(discord.ui.View):
    def __init__(self, products: list | None = None):
        super().__init__(timeout=None)
        if products is not None:
            self.add_item(BangGiaSelect(products))
        else:
            # Persistent re-register: load products từ DB
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
        products = session.execute(
            select(Product).where(Product.active == True).order_by(Product.id)
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

    @discord.slash_command(name="tao_don", description="[Admin] Tạo đơn hàng + link PayOS cho user")
    @discord.default_permissions(administrator=True)
    async def tao_don_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Chọn thành viên"),
        product_id: discord.Option(int, "ID sản phẩm (xem /san_pham)"),
        package_name: discord.Option(str, "Tên gói (để trống = gói đầu tiên)", required=False, default=""),
        quantity: discord.Option(int, "Số lượng", required=False, default=1, min_value=1, max_value=99),
        channel: discord.Option(discord.TextChannel, "Kênh gửi QR (để trống = gửi tại kênh hiện tại)", required=False, default=None),
    ):
        await ctx.defer()
        session = get_session()
        try:
            config = session.execute(select(SystemConfig).limit(1)).scalars().first()
            if not config or not all([config.payos_client_id, config.payos_api_key, config.payos_checksum_key]):
                await ctx.respond("⚠️ Chưa cấu hình PayOS trên Dashboard!", ephemeral=True)
                return

            product = session.execute(
                select(Product).where(Product.id == product_id)
            ).scalars().first()
            if not product:
                await ctx.respond(f"❌ Không tìm thấy sản phẩm ID #{product_id}.", ephemeral=True)
                return

            # Tính giá từ gói
            pkgs = product.packages or []
            price_per_unit = 0.0
            matched_pkg_name = package_name or ""

            if pkgs:
                active_pkgs = [pk for pk in pkgs if pk.get("active", True)]
                if package_name:
                    matched = next((pk for pk in active_pkgs if pk["name"].lower() == package_name.lower()), None)
                    if not matched:
                        names = ", ".join(f'`{pk["name"]}`' for pk in active_pkgs)
                        await ctx.respond(f"❌ Gói **{package_name}** không tồn tại.\nCác gói: {names}", ephemeral=True)
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
                await ctx.respond("❌ Giá sản phẩm không hợp lệ.", ephemeral=True)
                return

            # Tìm/tạo user DB
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
            )
            session.add(order)
            session.commit()

            # Tạo PayOS link
            domain = config.public_app_url or "http://localhost:3034"
            if not domain.startswith("http"):
                domain = f"https://{domain}"

            payos = PayOS(
                client_id=config.payos_client_id,
                api_key=config.payos_api_key,
                checksum_key=config.payos_checksum_key,
            )
            product_display = (product.name or f"Sản phẩm #{product.id}") + (f" ({matched_pkg_name})" if matched_pkg_name else "")
            if quantity > 1:
                product_display += f" x{quantity}"

            item = ItemData(name=product_display[:40], quantity=1, price=int(total))
            payment_data = PaymentData(
                orderCode=order.id,
                amount=int(total),
                description=f"Don #{order.id}",
                items=[item],
                cancelUrl=f"{domain}/cancel",
                returnUrl=f"{domain}/success",
            )
            payos_res = await asyncio.to_thread(payos.createPaymentLink, payment_data)
            checkout_url = payos_res.checkoutUrl
            order.payos_order_code = str(order.id)
            order.checkout_url = checkout_url
            session.commit()

            # Build embed từ template (hoặc default)
            from src.bot.embed_utils import build_embed
            order_vars = {
                "order.id": order.id,
                "user.mention": user.mention,
                "user": user.display_name,
                "user.id": user.id,
                "product.name": product_display,
                "package": matched_pkg_name,
                "order.total": f"{total:,.0f}",
            }

            # 1) Gửi thông báo đơn hàng → don_hang_channel (nếu có)
            if config.don_hang_channel_id:
                don_hang_ch = ctx.guild.get_channel(int(config.don_hang_channel_id))
                if don_hang_ch:
                    order_embed = build_embed("don_hang_moi", session, vars=order_vars)
                    await don_hang_ch.send(
                        content=f"{user.mention} Bạn có đơn hàng mới!",
                        embed=order_embed,
                    )

            # 2) Gửi mã QR thanh toán → kênh chỉ định hoặc kênh hiện tại
            qr_embed = build_embed("qr_thanh_toan", session, vars={
                **order_vars,
                "qr_url": checkout_url,
                "transfer_content": f"Don {order.id}",
            })

            view = OrderPayView(
                order_id=order.id,
                price=total,
                checkout_url=checkout_url,
                admin_id=ctx.author.id,
            )

            qr_channel = channel or ctx.channel
            msg = await qr_channel.send(
                content=f"{user.mention} Thanh toán đơn hàng #{order.id}",
                embed=qr_embed,
                view=view,
            )
            view.message = msg

            # Lưu message info
            order.discord_message_id = str(msg.id)
            order.discord_channel_id = str(msg.channel.id)
            session.commit()

            parts = [f"✅ Đã tạo đơn #{order.id}."]
            if config.don_hang_channel_id:
                parts.append(f"📦 Thông báo đơn → <#{config.don_hang_channel_id}>")
            if qr_channel != ctx.channel:
                parts.append(f"💳 QR → {qr_channel.mention}")
            await ctx.respond(" ".join(parts), ephemeral=True)

        except Exception as e:
            logger.error(f"tao_don_cmd error: {e}")
            await ctx.respond("❌ Lỗi hệ thống khi tạo đơn.", ephemeral=True)
        finally:
            session.close()

    @discord.slash_command(name="san_pham", description="Xem chi tiết sản phẩm")
    async def san_pham_cmd(
        self,
        ctx: discord.ApplicationContext,
        ten: discord.Option(
            str,
            "Tên sản phẩm",
            required=True,
            autocomplete=_autocomplete_product_names,
        ),
    ):
        session = get_session()
        try:
            from src.bot.embed_utils import build_embed, resolve_image_url
            from src.models.models import EmbedTemplate

            products = session.execute(
                select(Product).where(Product.active == True).order_by(Product.id)
            ).scalars().all()

            ten_lower = ten.lower()
            product = next(
                (p for p in products if p.name and p.name.lower() == ten_lower), None
            ) or next(
                (p for p in products if p.name and ten_lower in p.name.lower()), None
            )

            if not product:
                await ctx.respond(f"❌ Không tìm thấy sản phẩm **{ten}**.", ephemeral=True)
                return

            pkgs = [pk for pk in (product.packages or []) if pk.get("active", True)]
            img = resolve_image_url(product.image_url, session)

            # Try per-product embed first, fall back to generic san_pham_detail
            product_event = f"product_{product.id}"
            tmpl = session.execute(
                select(EmbedTemplate).where(EmbedTemplate.event_type == product_event)
            ).scalars().first()
            if not tmpl:
                tmpl = session.execute(
                    select(EmbedTemplate).where(EmbedTemplate.event_type == "san_pham_detail")
                ).scalars().first()
            db_has_fields = bool(tmpl and tmpl.enabled and tmpl.fields)

            first_pkg = pkgs[0] if pkgs else {}
            embed = build_embed(product_event, session, vars={
                "product.name": product.name or f"Sản phẩm #{product.id}",
                "product.description": product.description or "Không có mô tả.",
                "product.image_url": img or "",
                "package.name": first_pkg.get("name", ""),
                "package.price": f"{first_pkg.get('price', 0):,.0f}" if first_pkg else "",
                "package.description": first_pkg.get("description", "") if first_pkg else "Liên hệ admin để biết giá.",
            })

            if pkgs and not db_has_fields:
                for pk in pkgs:
                    price = pk.get("price", 0)
                    val = f"💰 **{price:,.0f}đ**"
                    if pk.get("description"):
                        val += f"\n{pk['description']}"
                    embed.add_field(name=f"🔹 {pk.get('name', 'Gói')}", value=val, inline=False)

            if img and not embed.image:
                embed.set_image(url=img)
            elif img and not embed.thumbnail:
                embed.set_thumbnail(url=img)

            await ctx.respond(embed=embed, ephemeral=True)
        except Exception as e:
            logger.error(f"san_pham_cmd error: {e}")
            await ctx.respond("❌ Lỗi hệ thống.", ephemeral=True)
        finally:
            session.close()

    @discord.slash_command(name="bang_gia", description="[Admin] Gửi/cập nhật bảng giá sản phẩm vào kênh")
    @discord.default_permissions(administrator=True)
    async def bang_gia_cmd(
        self,
        ctx: discord.ApplicationContext,
        channel: discord.Option(discord.TextChannel, "Kênh gửi bảng giá (để trống = kênh hiện tại)", required=False, default=None),
    ):
        session = get_session()
        try:
            products = session.execute(
                select(Product).where(Product.active == True).order_by(Product.id)
            ).scalars().all()

            if not products:
                await ctx.respond("⚠️ Chưa có sản phẩm nào đang bán.", ephemeral=True)
                return

            from src.bot.embed_utils import build_embed
            embed = build_embed("bang_gia", session)
            if not embed.footer:
                embed.set_footer(text="Bấm vào tên sản phẩm bên dưới để xem chi tiết gói")

            view = BangGiaView(products)
            target = channel or ctx.channel

            # Thử edit message cũ nếu có
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
                        # Cập nhật channel nếu đổi kênh
                        if str(target.id) != old_channel_id:
                            await old_msg.delete()
                            edited = False
                except Exception:
                    edited = False

            if not edited:
                msg = await target.send(embed=embed, view=view)
                # Lưu message_id + channel_id vào DB
                if config:
                    config.bang_gia_channel_id = str(target.id)
                    config.bang_gia_message_id = str(msg.id)
                    session.commit()

            if edited:
                await ctx.respond(f"✅ Đã cập nhật bảng giá.", ephemeral=True)
            else:
                await ctx.respond(f"✅ Đã gửi bảng giá vào {target.mention}", ephemeral=True)

        except Exception as e:
            logger.error(f"bang_gia_cmd error: {e}")
            await ctx.respond("❌ Lỗi hệ thống.", ephemeral=True)
        finally:
            session.close()


    @discord.slash_command(name="tao_don_custom", description="[Admin] Tạo đơn custom (tên SP tự nhập, không cần SP trong hệ thống)")
    @discord.default_permissions(administrator=True)
    async def tao_don_custom_cmd(
        self,
        ctx: discord.ApplicationContext,
        user: discord.Option(discord.Member, "Chọn thành viên"),
        san_pham: discord.Option(str, "Tên sản phẩm tự nhập"),
        gia: discord.Option(int, "Giá tiền (VNĐ)", min_value=1000),
        ghi_chu: discord.Option(str, "Ghi chú / mô tả thêm (tuỳ chọn)", required=False, default=""),
        so_luong: discord.Option(int, "Số lượng", required=False, default=1, min_value=1, max_value=99),
        channel: discord.Option(discord.TextChannel, "Kênh gửi QR (để trống = gửi tại kênh hiện tại)", required=False, default=None),
    ):
        await ctx.defer()
        session = get_session()
        try:
            config = session.execute(select(SystemConfig).limit(1)).scalars().first()
            if not config or not all([config.payos_client_id, config.payos_api_key, config.payos_checksum_key]):
                await ctx.respond("⚠️ Chưa cấu hình PayOS trên Dashboard!", ephemeral=True)
                return

            total = float(gia) * so_luong

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
                quantity=so_luong,
                total_price=total,
                package_name=san_pham,
                status="PENDING",
            )
            session.add(order)
            session.commit()

            domain = config.public_app_url or "http://localhost:3034"
            if not domain.startswith("http"):
                domain = f"https://{domain}"

            payos = PayOS(
                client_id=config.payos_client_id,
                api_key=config.payos_api_key,
                checksum_key=config.payos_checksum_key,
            )
            product_display = san_pham[:40]
            if so_luong > 1:
                product_display += f" x{so_luong}"

            item = ItemData(name=product_display, quantity=1, price=int(total))
            payment_data = PaymentData(
                orderCode=order.id,
                amount=int(total),
                description=f"Don #{order.id}",
                items=[item],
                cancelUrl=f"{domain}/cancel",
                returnUrl=f"{domain}/success",
            )
            payos_res = await asyncio.to_thread(payos.createPaymentLink, payment_data)
            checkout_url = payos_res.checkoutUrl
            order.payos_order_code = str(order.id)
            order.checkout_url = checkout_url
            session.commit()

            from src.bot.embed_utils import build_embed
            order_vars = {
                "order.id": order.id,
                "user.mention": user.mention,
                "user": user.display_name,
                "user.id": user.id,
                "product.name": product_display,
                "package": san_pham,
                "order.total": f"{total:,.0f}",
            }

            if config.don_hang_channel_id:
                don_hang_ch = ctx.guild.get_channel(int(config.don_hang_channel_id))
                if don_hang_ch:
                    order_embed = build_embed("don_hang_moi", session, vars=order_vars)
                    if ghi_chu:
                        order_embed.add_field(name="Ghi chú", value=ghi_chu, inline=False)
                    await don_hang_ch.send(
                        content=f"{user.mention} Bạn có đơn hàng mới!",
                        embed=order_embed,
                    )

            qr_embed = build_embed("qr_thanh_toan", session, vars={
                **order_vars,
                "qr_url": checkout_url,
                "transfer_content": f"Don {order.id}",
            })

            view = OrderPayView(
                order_id=order.id,
                price=total,
                checkout_url=checkout_url,
                admin_id=ctx.author.id,
            )

            qr_channel = channel or ctx.channel
            msg = await qr_channel.send(
                content=f"{user.mention} Thanh toán đơn hàng #{order.id}",
                embed=qr_embed,
                view=view,
            )
            view.message = msg

            order.discord_message_id = str(msg.id)
            order.discord_channel_id = str(msg.channel.id)
            session.commit()

            parts = [f"✅ Đã tạo đơn custom #{order.id}."]
            if config.don_hang_channel_id:
                parts.append(f"📦 Thông báo đơn → <#{config.don_hang_channel_id}>")
            if qr_channel != ctx.channel:
                parts.append(f"💳 QR → {qr_channel.mention}")
            await ctx.respond(" ".join(parts), ephemeral=True)

        except Exception as e:
            logger.error(f"tao_don_custom error: {e}")
            await ctx.respond("❌ Lỗi hệ thống khi tạo đơn.", ephemeral=True)
        finally:
            session.close()


def setup(bot):
    bot.add_cog(AdminShopCog(bot))
