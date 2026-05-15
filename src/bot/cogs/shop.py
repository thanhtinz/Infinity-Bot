# src/bot/cogs/shop.py
# Slash commands: /help, /status, /account, /orders, /support, /feedback, /bxh, /san_pham

import discord
import datetime
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from src.database.config import SessionLocal
from src.models.models import (
    SystemConfig, User, Product, Order, Coupon, Feedback
)


def get_session():
    return SessionLocal()


class FeedbackModal(discord.ui.Modal):
    def __init__(self, product: Product, user_id: int):
        super().__init__(title=f"Đánh giá: {product.name[:40]}")
        self.product = product
        self.db_user_id = user_id
        self.stars_input = discord.ui.InputText(
            label="Số sao (1-5)",
            placeholder="Nhập số từ 1 đến 5",
            max_length=1,
            style=discord.InputTextStyle.short,
        )
        self.content_input = discord.ui.InputText(
            label="Nội dung đánh giá",
            placeholder="Chia sẻ trải nghiệm của bạn...",
            style=discord.InputTextStyle.long,
            max_length=500,
            required=False,
        )
        self.add_item(self.stars_input)
        self.add_item(self.content_input)

    async def callback(self, interaction: discord.Interaction):
        try:
            stars = int(self.stars_input.value)
            if not 1 <= stars <= 5:
                raise ValueError
        except ValueError:
            await interaction.response.send_message("❌ Số sao phải từ 1 đến 5.", ephemeral=True)
            return

        session = get_session()
        try:
            config = session.execute(select(SystemConfig).limit(1)).scalars().first()
            feedback = Feedback(
                user_id=self.db_user_id,
                product_id=self.product.id,
                stars=stars,
                content=self.content_input.value or None,
            )
            session.add(feedback)
            session.flush()

            star_str = "⭐" * stars + "☆" * (5 - stars)
            from src.bot.embed_utils import build_embed
            embed = build_embed("feedback", session, vars={
                "user.mention": interaction.user.mention,
                "user": interaction.user.display_name,
                "user.id": interaction.user.id,
                "product.name": self.product.name,
                "stars": star_str,
                "content": self.content_input.value or "",
            })
            embed.set_thumbnail(url=interaction.user.display_avatar.url)

            sent_msg = None
            if config and config.feedback_channel_id:
                ch = interaction.guild.get_channel(int(config.feedback_channel_id))
                if ch:
                    sent_msg = await ch.send(embed=embed)
                    feedback.discord_message_id = str(sent_msg.id)

            session.commit()
            await interaction.response.send_message(
                f"✅ Cảm ơn bạn đã đánh giá **{self.product.name}**! {star_str}",
                ephemeral=True,
            )
        except Exception as e:
            session.rollback()
            await interaction.response.send_message("❌ Lỗi hệ thống.", ephemeral=True)
        finally:
            session.close()


class ProductSelectView(discord.ui.View):
    """View hiển thị dropdown chọn sản phẩm để feedback."""
    def __init__(self, products: list, db_user_id: int):
        super().__init__(timeout=60)
        options = [
            discord.SelectOption(label=p.name[:25], value=str(p.id))
            for p in products[:25]
        ]
        self.db_user_id = db_user_id
        self.products = {str(p.id): p for p in products}

        select_menu = discord.ui.Select(
            placeholder="Chọn sản phẩm đã mua...",
            options=options,
        )
        select_menu.callback = self.on_select
        self.add_item(select_menu)

    async def on_select(self, interaction: discord.Interaction):
        product = self.products.get(interaction.data["values"][0])
        if product:
            modal = FeedbackModal(product=product, user_id=self.db_user_id)
            await interaction.response.send_modal(modal)


class ShopCog(discord.Cog):
    def __init__(self, bot):
        self.bot = bot

    @discord.slash_command(name="support", description="Hướng dẫn liên hệ hỗ trợ")
    async def support_cmd(self, ctx: discord.ApplicationContext):
        session = get_session()
        try:
            config = session.execute(select(SystemConfig).limit(1)).scalars().first()
            embed = discord.Embed(
                title="🆘 Hỗ trợ khách hàng",
                description=(
                    "Nếu bạn gặp vấn đề với đơn hàng, hãy liên hệ Admin qua:\n\n"
                    "• Mở ticket trong server\n"
                    "• DM trực tiếp cho Admin\n"
                    "• Cung cấp **ID đơn hàng** để được hỗ trợ nhanh hơn"
                ),
                color=discord.Color.green(),
            )
            embed.add_field(
                name="📌 Lưu ý",
                value="Vui lòng cung cấp ảnh chụp màn hình lỗi và ID đơn hàng khi liên hệ.",
                inline=False,
            )
            await ctx.respond(embed=embed)
        finally:
            session.close()

    @discord.slash_command(name="orders", description="Xem đơn hàng của bạn")
    async def orders_cmd(
        self,
        ctx: discord.ApplicationContext,
        id: discord.Option(int, "ID đơn hàng cụ thể (để trống = xem 5 đơn gần nhất)", required=False, default=None),
    ):
        session = get_session()
        try:
            user = session.execute(
                select(User).where(User.discord_id == str(ctx.author.id))
            ).scalars().first()

            if not user:
                await ctx.respond("❌ Bạn chưa có đơn hàng nào.", ephemeral=True)
                return

            STATUS_ICON = {
                "PENDING": "⏳", "PAID": "💳", "DELIVERING": "🚚",
                "DELIVERED": "✅", "CANCELLED": "❌", "ERROR": "⚠️",
            }

            if id:
                # Chi tiết 1 đơn
                order = session.execute(
                    select(Order)
                    .options(joinedload(Order.product))
                    .where(Order.id == id, Order.user_id == user.id)
                ).unique().scalars().first()

                if not order:
                    await ctx.respond(f"❌ Không tìm thấy đơn #{id}.", ephemeral=True)
                    return

                icon = STATUS_ICON.get(order.status, "❓")
                embed = discord.Embed(
                    title=f"📦 Đơn hàng #{order.id}",
                    color=discord.Color.green() if order.status == "DELIVERED" else discord.Color.gold(),
                )
                embed.add_field(name="Sản phẩm", value=(order.product.name or f"#{order.product_id}") if order.product else f"#{order.product_id}", inline=True)
                if order.package_name:
                    embed.add_field(name="Gói", value=order.package_name, inline=True)
                embed.add_field(name="Số tiền", value=f"{order.total_price:,.0f} VNĐ", inline=True)
                embed.add_field(name="Trạng thái", value=f"{icon} {order.status}", inline=True)
                embed.add_field(
                    name="Ngày tạo",
                    value=order.created_at.strftime("%d/%m/%Y %H:%M") if order.created_at else "—",
                    inline=True,
                )
                await ctx.respond(embed=embed, ephemeral=True)
            else:
                # 5 đơn gần nhất
                orders = session.execute(
                    select(Order)
                    .options(joinedload(Order.product))
                    .where(Order.user_id == user.id)
                    .order_by(Order.created_at.desc())
                    .limit(5)
                ).unique().scalars().all()

                if not orders:
                    await ctx.respond("❌ Bạn chưa có đơn hàng nào.", ephemeral=True)
                    return

                embed = discord.Embed(title="📦 Đơn hàng của bạn", color=discord.Color.blue())
                for o in orders:
                    icon = STATUS_ICON.get(o.status, "❓")
                    pname = (o.product.name or f"#{o.product_id}") if o.product else f"#{o.product_id}"
                    pkg = f" ({o.package_name})" if o.package_name else ""
                    embed.add_field(
                        name=f"#{o.id} — {pname}{pkg}",
                        value=f"{icon} {o.status} • {o.total_price:,.0f}đ",
                        inline=False,
                    )
                embed.set_footer(text="Dùng /orders id:<id> để xem chi tiết")
                await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()

    @discord.slash_command(name="feedback", description="Đánh giá sản phẩm đã mua")
    async def feedback_cmd(self, ctx: discord.ApplicationContext):
        session = get_session()
        try:
            user = session.execute(
                select(User).where(User.discord_id == str(ctx.author.id))
            ).scalars().first()

            if not user:
                await ctx.respond("❌ Bạn chưa mua hàng nào.", ephemeral=True)
                return

            # Lấy sản phẩm đã mua (PAID/DELIVERED)
            paid_orders = session.execute(
                select(Order)
                .options(joinedload(Order.product))
                .where(
                    Order.user_id == user.id,
                    Order.status.in_(["PAID", "DELIVERED"]),
                )
                .order_by(Order.created_at.desc())
                .limit(25)
            ).unique().scalars().all()

            if not paid_orders:
                await ctx.respond("❌ Bạn chưa có đơn hàng đã thanh toán để đánh giá.", ephemeral=True)
                return

            # Deduplicate sản phẩm
            seen = set()
            products = []
            for o in paid_orders:
                if o.product and o.product_id not in seen:
                    seen.add(o.product_id)
                    products.append(o.product)

            view = ProductSelectView(products=products, db_user_id=user.id)
            await ctx.respond("📝 Chọn sản phẩm bạn muốn đánh giá:", view=view, ephemeral=True)
        finally:
            session.close()

    @discord.slash_command(name="bxh", description="Bảng xếp hạng mua hàng")
    async def bxh_cmd(
        self,
        ctx: discord.ApplicationContext,
        loai: discord.Option(
            str, "Loại bảng xếp hạng",
            choices=["chi_tieu", "don_hang"],
            default="chi_tieu",
        ),
        thoi_gian: discord.Option(
            str, "Thời gian",
            choices=["daily", "7days", "30days", "all"],
            default="all",
        ),
    ):
        await ctx.defer()
        session = get_session()
        try:
            now = datetime.datetime.utcnow()
            since = {
                "daily": now - datetime.timedelta(days=1),
                "7days": now - datetime.timedelta(days=7),
                "30days": now - datetime.timedelta(days=30),
                "all": datetime.datetime(2000, 1, 1),
            }[thoi_gian]

            orders = session.execute(
                select(Order)
                .options(joinedload(Order.user))
                .where(
                    Order.status.in_(["PAID", "DELIVERED"]),
                    Order.created_at >= since,
                )
            ).unique().scalars().all()

            # Aggregate by user
            agg: dict[str, dict] = {}
            for o in orders:
                if not o.user:
                    continue
                uid = o.user.discord_id
                if uid not in agg:
                    agg[uid] = {"username": o.user.username, "total": 0.0, "count": 0}
                agg[uid]["total"] += float(o.total_price)
                agg[uid]["count"] += 1

            if not agg:
                await ctx.respond("Chưa có dữ liệu.", ephemeral=True)
                return

            sort_key = "total" if loai == "chi_tieu" else "count"
            top = sorted(agg.values(), key=lambda x: x[sort_key], reverse=True)[:10]

            time_map = {"daily": "Hôm nay", "7days": "7 ngày", "30days": "30 ngày", "all": "Tất cả"}
            medals = ["🥇", "🥈", "🥉"] + ["🏅"] * 7

            lines = []
            for i, u in enumerate(top):
                val = f"{u['total']:,.0f}đ" if loai == "chi_tieu" else f"{u['count']} đơn"
                lines.append(f"{medals[i]} **{u['username']}** — {val}")

            from src.bot.embed_utils import build_embed
            event_key = "bxh_chi_tieu" if loai == "chi_tieu" else "bxh_don_hang"
            embed = build_embed(event_key, session, vars={
                "time_label": time_map[thoi_gian],
                "leaderboard_lines": "\n".join(lines),
                "updated_at": datetime.datetime.utcnow().strftime("%H:%M %d/%m/%Y"),
            })
            await ctx.respond(embed=embed)
        finally:
            session.close()
