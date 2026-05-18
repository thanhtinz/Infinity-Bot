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
        super().__init__(title=f"Review: {product.name[:40]}")
        self.product = product
        self.db_user_id = user_id
        self.stars_input = discord.ui.InputText(
            label="Stars (1-5)",
            placeholder="Enter a number from 1 to 5",
            max_length=1,
            style=discord.InputTextStyle.short,
        )
        self.content_input = discord.ui.InputText(
            label="Review content",
            placeholder="Share your experience...",
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
            await interaction.response.send_message("❌ Stars must be between 1 and 5.", ephemeral=True)
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
                f"✅ Thank you for reviewing **{self.product.name}**! {star_str}",
                ephemeral=True,
            )
        except Exception as e:
            session.rollback()
            await interaction.response.send_message("❌ System error.", ephemeral=True)
        finally:
            session.close()


class ProductSelectView(discord.ui.View):
    """View showing product dropdown for feedback."""
    def __init__(self, products: list, db_user_id: int):
        super().__init__(timeout=60)
        options = [
            discord.SelectOption(label=p.name[:25], value=str(p.id))
            for p in products[:25]
        ]
        self.db_user_id = db_user_id
        self.products = {str(p.id): p for p in products}

        select_menu = discord.ui.Select(
            placeholder="Select a purchased product...",
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

    @discord.slash_command(name="support", description="Contact support")
    async def support_cmd(self, ctx: discord.ApplicationContext):
        session = get_session()
        try:
            config = session.execute(select(SystemConfig).limit(1)).scalars().first()
            embed = discord.Embed(
                title="🆘 Customer Support",
                description=(
                    "If you have issues with your order, contact Admin via:\n\n"
                    "• Open a ticket in the server\n"
                    "• DM Admin directly\n"
                    "• Provide your **Order ID** for faster support"
                ),
                color=discord.Color.green(),
            )
            embed.add_field(
                name="📌 Note",
                value="Please provide a screenshot of the error and your Order ID when contacting support.",
                inline=False,
            )
            await ctx.respond(embed=embed)
        finally:
            session.close()

    @discord.slash_command(name="orders", description="View your orders")
    async def orders_cmd(
        self,
        ctx: discord.ApplicationContext,
        id: discord.Option(int, "Specific order ID (leave empty = last 5 orders)", required=False, default=None),
    ):
        session = get_session()
        try:
            user = session.execute(
                select(User).where(User.discord_id == str(ctx.author.id))
            ).scalars().first()

            if not user:
                await ctx.respond("❌ You have no orders yet.", ephemeral=True)
                return

            STATUS_ICON = {
                "PENDING": "⏳", "PAID": "💳", "DELIVERING": "🚚",
                "DELIVERED": "✅", "CANCELLED": "❌", "ERROR": "⚠️",
            }

            if id:
                # Order detail
                order = session.execute(
                    select(Order)
                    .options(joinedload(Order.product))
                    .where(Order.id == id, Order.user_id == user.id)
                ).unique().scalars().first()

                if not order:
                    await ctx.respond(f"❌ Order not found #{id}.", ephemeral=True)
                    return

                icon = STATUS_ICON.get(order.status, "❓")
                embed = discord.Embed(
                    title=f"📦 Order #{order.id}",
                    color=discord.Color.green() if order.status == "DELIVERED" else discord.Color.gold(),
                )
                embed.add_field(name="Product", value=(order.product.name or f"#{order.product_id}") if order.product else f"#{order.product_id}", inline=True)
                if order.package_name:
                    embed.add_field(name="Package", value=order.package_name, inline=True)
                embed.add_field(name="Amount", value=f"{order.total_price:,.0f} VNĐ", inline=True)
                embed.add_field(name="Status", value=f"{icon} {order.status}", inline=True)
                embed.add_field(
                    name="Created",
                    value=order.created_at.strftime("%d/%m/%Y %H:%M") if order.created_at else "—",
                    inline=True,
                )
                await ctx.respond(embed=embed, ephemeral=True)
            else:
                # 5 recent orders
                orders = session.execute(
                    select(Order)
                    .options(joinedload(Order.product))
                    .where(Order.user_id == user.id)
                    .order_by(Order.created_at.desc())
                    .limit(5)
                ).unique().scalars().all()

                if not orders:
                    await ctx.respond("❌ You have no orders yet.", ephemeral=True)
                    return

                embed = discord.Embed(title="📦 Your Orders", color=discord.Color.blue())
                for o in orders:
                    icon = STATUS_ICON.get(o.status, "❓")
                    pname = (o.product.name or f"#{o.product_id}") if o.product else f"#{o.product_id}"
                    pkg = f" ({o.package_name})" if o.package_name else ""
                    embed.add_field(
                        name=f"#{o.id} — {pname}{pkg}",
                        value=f"{icon} {o.status} • {o.total_price:,.0f} VND",
                        inline=False,
                    )
                embed.set_footer(text="Use /orders id:<id> for details")
                await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()

    @discord.slash_command(name="feedback", description="Rate a purchased product")
    async def feedback_cmd(self, ctx: discord.ApplicationContext):
        session = get_session()
        try:
            user = session.execute(
                select(User).where(User.discord_id == str(ctx.author.id))
            ).scalars().first()

            if not user:
                await ctx.respond("❌ You have no purchases yet.", ephemeral=True)
                return

            # Get purchased products (PAID/DELIVERED)
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
                await ctx.respond("❌ You have no paid orders to review.", ephemeral=True)
                return

            # Deduplicate products
            seen = set()
            products = []
            for o in paid_orders:
                if o.product and o.product_id not in seen:
                    seen.add(o.product_id)
                    products.append(o.product)

            view = ProductSelectView(products=products, db_user_id=user.id)
            await ctx.respond("📝 Select the product you want to review:", view=view, ephemeral=True)
        finally:
            session.close()

    @discord.slash_command(name="bxh", description="Purchase leaderboard")
    async def bxh_cmd(
        self,
        ctx: discord.ApplicationContext,
        loai: discord.Option(
            str, "Leaderboard type",
            choices=["chi_tieu", "don_hang"],
            default="chi_tieu",
        ),
        thoi_gian: discord.Option(
            str, "Time period",
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
                    conmessagesue
                uid = o.user.discord_id
                if uid not in agg:
                    agg[uid] = {"username": o.user.username, "total": 0.0, "count": 0}
                agg[uid]["total"] += float(o.total_price)
                agg[uid]["count"] += 1

            if not agg:
                await ctx.respond("No data available.", ephemeral=True)
                return

            sort_key = "total" if loai == "chi_tieu" else "count"
            top = sorted(agg.values(), key=lambda x: x[sort_key], reverse=True)[:10]

            time_map = {"daily": "Today", "7days": "7 days", "30days": "30 days", "all": "All"}
            medals = ["🥇", "🥈", "🥉"] + ["🏅"] * 7

            lines = []
            for i, u in enumerate(top):
                val = f"{u['total']:,.0f} VND" if loai == "chi_tieu" else f"{u['count']} orders"
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

    @discord.slash_command(name="milestones", description="View your spending milestones & progress")
    async def milestones_cmd(self, ctx: discord.ApplicationContext):
        if not check_feature(self): return
        session = get_session()
        try:
            from src.models.models import SpendingMilestone
            guild_id = str(ctx.guild_id) if ctx.guild_id else None

            user = session.execute(
                select(User).where(User.discord_id == str(ctx.author.id), User.guild_id == guild_id)
            ).scalars().first()
            total = user.total_spent if user else 0

            milestones = session.execute(
                select(SpendingMilestone)
                .where(SpendingMilestone.guild_id == guild_id, SpendingMilestone.active == True)
                .order_by(SpendingMilestone.threshold)
            ).scalars().all()

            if not milestones:
                await ctx.respond("No spending milestones configured.", ephemeral=True)
                return

            lines = []
            for m in milestones:
                reached = total >= m.threshold
                icon = "✅" if reached else "⬜"
                emoji = f" {m.emoji}" if m.emoji else ""
                progress = " — **reached!**" if reached else f" — remaining **{m.threshold - total:,.0f} VND**"
                lines.append(f"{icon}{emoji} **{m.name}** ({m.threshold:,.0f} VND){progress}")

            embed = discord.Embed(
                title="🏆 Spending Milestones",
                description="\n".join(lines),
                color=0xF0B232,
            )
            embed.add_field(name="💰 Your total spending", value=f"**{total:,.0f} VND**", inline=False)
            embed.set_footer(text=f"{ctx.author.display_name}", icon_url=ctx.author.display_avatar.url if ctx.author.display_avatar else None)
            await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()
