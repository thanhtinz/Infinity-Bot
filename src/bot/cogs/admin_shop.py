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
        # Xóa nút pay cũ, thêm nút mới với URL mới
        new_view = discord.ui.View(timeout=None)
        new_view.add_item(discord.ui.Button(
            label="💳 Thanh toán ngay",
            style=discord.ButtonStyle.link,
            url=checkout_url,
        ))
        new_view.add_item(discord.ui.Button(
            label=f"✅ Coupon: {coupon_code}",
            style=discord.ButtonStyle.success,
            disabled=True,
        ))

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
                await self.message.edit(embed=new_embed, view=new_view)
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
            product_display = product.name + (f" ({matched_pkg_name})" if matched_pkg_name else "")
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
            embed = build_embed("don_hang_moi", session, vars={
                "order.id": order.id,
                "user.mention": user.mention,
                "user": user.display_name,
                "user.id": user.id,
                "product.name": product_display,
                "package": matched_pkg_name,
                "order.total": f"{total:,.0f}",
            })

            view = OrderPayView(
                order_id=order.id,
                price=total,
                checkout_url=checkout_url,
                admin_id=ctx.author.id,
            )

            # Gửi QR: chỉ định kênh > kênh hiện tại
            target_channel = channel or ctx.channel

            msg = await target_channel.send(
                content=f"{user.mention} Bạn có đơn hàng mới!",
                embed=embed,
                view=view,
            )
            view.message = msg

            # Lưu message info
            order.discord_message_id = str(msg.id)
            order.discord_channel_id = str(msg.channel.id)
            session.commit()

            if target_channel != ctx.channel:
                await ctx.respond(f"✅ Đã tạo đơn #{order.id} và gửi tới {target_channel.mention}.", ephemeral=True)
            else:
                await ctx.respond(f"✅ Đã tạo đơn #{order.id}.", ephemeral=True)

        except Exception as e:
            logger.error(f"tao_don_cmd error: {e}")
            await ctx.respond("❌ Lỗi hệ thống khi tạo đơn.", ephemeral=True)
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
                product_id=None,            # Không gắn với product hệ thống
                quantity=so_luong,
                total_price=total,
                package_name=san_pham,       # Dùng package_name để lưu tên SP custom
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

            # Build embed từ template don_hang_moi (hoặc default)
            from src.bot.embed_utils import build_embed
            embed_vars = {
                "order.id": order.id,
                "user.mention": user.mention,
                "user": user.display_name,
                "user.id": user.id,
                "product.name": product_display,
                "package": san_pham,
                "order.total": f"{total:,.0f}",
            }
            embed = build_embed("don_hang_moi", session, vars=embed_vars)
            if ghi_chu:
                embed.add_field(name="Ghi chú", value=ghi_chu, inline=False)

            view = OrderPayView(
                order_id=order.id,
                price=total,
                checkout_url=checkout_url,
                admin_id=ctx.author.id,
            )

            # Gửi QR: chỉ định kênh > kênh hiện tại
            target_channel = channel or ctx.channel

            msg = await target_channel.send(
                content=f"{user.mention} Bạn có đơn hàng mới!",
                embed=embed,
                view=view,
            )
            view.message = msg

            order.discord_message_id = str(msg.id)
            order.discord_channel_id = str(msg.channel.id)
            session.commit()

            info = f"✅ Đã tạo đơn custom #{order.id}"
            if target_channel != ctx.channel:
                info += f" và gửi tới {target_channel.mention}"
            await ctx.respond(info + ".", ephemeral=True)

        except Exception as e:
            logger.error(f"tao_don_custom error: {e}")
            await ctx.respond("❌ Lỗi hệ thống khi tạo đơn.", ephemeral=True)
        finally:
            session.close()
