# src/bot/cogs/shop.py
# Slash commands: /help, /status, /account, /orders, /support, /feedback, /bxh, /san_pham

import discord
import datetime
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from src.database.config import SessionLocal
from src.models.models import (
    SystemConfig, User, Product, Order, Coupon, Feedback, FlashSale, SpendingMilestone
)


def get_session():
    return SessionLocal()


class FeedbackModal(discord.ui.Modal):
    def __init__(self, order: "Order", user_id: int, guild_id: str):
        product_name = order.product.name if order.product else f"Order #{order.id}"
        super().__init__(title=f"Review: {product_name[:40]}")
        self.order = order
        self.db_user_id = user_id
        self.guild_id = guild_id
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
        self.image_input = discord.ui.InputText(
            label="Image URL (optional)",
            placeholder="https://i.imgur.com/example.png",
            style=discord.InputTextStyle.short,
            max_length=500,
            required=False,
        )
        self.add_item(self.stars_input)
        self.add_item(self.content_input)
        self.add_item(self.image_input)

    async def callback(self, interaction: discord.Interaction):
        try:
            stars = int(self.stars_input.value)
            if not 1 <= stars <= 5:
                raise ValueError
        except ValueError:
            await interaction.response.send_message("Stars must be between 1 and 5.", ephemeral=True)
            return

        image_url = (self.image_input.value or "").strip() or None

        session = get_session()
        try:
            config = session.execute(
                select(SystemConfig).where(SystemConfig.guild_id == self.guild_id)
            ).scalars().first() or session.execute(select(SystemConfig).limit(1)).scalars().first()

            product_name = self.order.product.name if self.order.product else f"Order #{self.order.id}"
            feedback = Feedback(
                guild_id=self.guild_id,
                user_id=self.db_user_id,
                product_id=self.order.product_id,
                order_id=self.order.id,
                stars=stars,
                content=self.content_input.value or None,
                image_url=image_url,
            )
            session.add(feedback)
            session.flush()

            star_str = "\u2B50" * stars + "\u2606" * (5 - stars)
            from src.bot.embed_utils import build_embed
            embed = build_embed("feedback", session, vars={
                "user.mention": interaction.user.mention,
                "user": interaction.user.display_name,
                "user.id": str(interaction.user.id),
                "product.name": product_name,
                "order.id": str(self.order.id),
                "stars": star_str,
                "stars.count": str(stars),
                "content": self.content_input.value or "No comment",
            }, guild_id=self.guild_id)
            embed.set_thumbnail(url=interaction.user.display_avatar.url)
            if image_url:
                embed.set_image(url=image_url)

            if config and config.feedback_channel_id:
                ch = interaction.guild.get_channel(int(config.feedback_channel_id))
                if ch:
                    sent_msg = await ch.send(embed=embed)
                    feedback.discord_message_id = str(sent_msg.id)

            session.commit()
            await interaction.response.send_message(
                f"Thank you for reviewing **{product_name}**! {star_str}",
                ephemeral=True,
            )
        except Exception:
            session.rollback()
            await interaction.response.send_message("System error.", ephemeral=True)
        finally:
            session.close()


class OrderSelectView(discord.ui.View):
    """View showing order dropdown for feedback — only unreviewed orders."""
    def __init__(self, orders: list, db_user_id: int, guild_id: str):
        super().__init__(timeout=60)
        self.db_user_id = db_user_id
        self.guild_id = guild_id
        self.orders = {str(o.id): o for o in orders}

        options = []
        for o in orders[:25]:
            pname = o.product.name[:40] if o.product else "Unknown"
            label = f"#{o.id} — {pname}"
            desc = f"{o.quantity}x · {o.status}"
            options.append(discord.SelectOption(label=label[:100], description=desc[:100], value=str(o.id)))

        select_menu = discord.ui.Select(
            placeholder="Select an order to review...",
            options=options,
        )
        select_menu.callback = self.on_select
        self.add_item(select_menu)

    async def on_select(self, interaction: discord.Interaction):
        order = self.orders.get(interaction.data["values"][0])
        if order:
            modal = FeedbackModal(order=order, user_id=self.db_user_id, guild_id=self.guild_id)
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
                await ctx.respond("You have no purchases yet.", ephemeral=True)
                return

            # Get reviewed order IDs
            reviewed_order_ids = set(
                r[0] for r in session.execute(
                    select(Feedback.order_id).where(
                        Feedback.user_id == user.id,
                        Feedback.order_id.isnot(None),
                    )
                ).all()
            )

            # Get paid/delivered orders not yet reviewed
            paid_orders = session.execute(
                select(Order)
                .options(joinedload(Order.product))
                .where(
                    Order.user_id == user.id,
                    Order.guild_id == str(ctx.guild.id),
                    Order.status.in_(["PAID", "DELIVERED"]),
                )
                .order_by(Order.created_at.desc())
                .limit(25)
            ).unique().scalars().all()

            unreviewed = [o for o in paid_orders if o.id not in reviewed_order_ids]

            if not unreviewed:
                await ctx.respond("You have no unreviewed orders.", ephemeral=True)
                return

            view = OrderSelectView(orders=unreviewed, db_user_id=user.id, guild_id=str(ctx.guild.id))
            await ctx.respond("Select an order to review:", view=view, ephemeral=True)
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
            }, guild_id=str(ctx.guild_id))
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

    # ─────────────────────────────────────────────────────────────────────
    # Background tasks
    # ─────────────────────────────────────────────────────────────────────

    @discord.ext.tasks.loop(minutes=1)
    async def _flash_sale_expiry_check(self):
        """Deactivate expired or sold-out flash sales and post end embed."""
        session = get_session()
        try:
            now = datetime.datetime.utcnow()
            active_sales = session.execute(
                select(FlashSale).where(FlashSale.active == True)
            ).scalars().all()
            for fs in active_sales:
                expired = now >= fs.ends_at
                sold_out = fs.quantity_limit is not None and fs.quantity_used >= fs.quantity_limit
                if expired or sold_out:
                    fs.active = False
                    session.commit()
                    cfg = session.execute(select(SystemConfig).where(SystemConfig.guild_id == fs.guild_id)).scalars().first()
                    if not cfg:
                        cfg = session.execute(select(SystemConfig).limit(1)).scalars().first()
                    ch_id = getattr(cfg, "flash_sale_channel_id", None) if cfg else None
                    if ch_id:
                        try:
                            ch = self.bot.get_channel(int(ch_id))
                            if not ch:
                                ch = await self.bot.fetch_channel(int(ch_id))
                            if ch:
                                from src.bot.embed_utils import build_embed
                                product_name = fs.product.name if fs.product else f"Product #{fs.product_id}"
                                emb = build_embed("flash_sale_end", session, vars={
                                    "product.name": product_name,
                                    "package.name": fs.package_name,
                                    "sale.qty_used": str(fs.quantity_used),
                                    "sale.qty_limit": str(fs.quantity_limit or "∞"),
                                }, guild_id=fs.guild_id)
                                await ch.send(embed=emb)
                        except Exception as e:
                            import logging; logging.getLogger(__name__).warning(f"flash_sale_end send error: {e}")
        except Exception as e:
            import logging; logging.getLogger(__name__).error(f"flash_sale_expiry_check error: {e}")
        finally:
            session.close()

    @_flash_sale_expiry_check.before_loop
    async def before_flash_sale(self):
        await self.bot.wait_until_ready()

    @discord.ext.tasks.loop(minutes=1)
    async def _spending_leaderboard_auto(self):
        """Auto-post spending leaderboard on schedule."""
        session = get_session()
        try:
            now = datetime.datetime.utcnow()
            configs = session.execute(select(SystemConfig)).scalars().all()
            for cfg in configs:
                ch_id = getattr(cfg, "spending_leaderboard_channel_id", None)
                schedule = getattr(cfg, "spending_leaderboard_schedule", None)
                sched_time = getattr(cfg, "spending_leaderboard_time", None) or "08:00"
                guild_id = cfg.guild_id
                if not ch_id or not schedule or not guild_id:
                    continue
                h, m_val = (int(x) for x in sched_time.split(":")) if ":" in sched_time else (8, 0)
                if now.hour != h or now.minute != m_val:
                    continue
                if schedule == "weekly" and now.weekday() != 0:
                    continue
                elif schedule == "monthly" and now.day != 1:
                    continue
                try:
                    ch = self.bot.get_channel(int(ch_id))
                    if not ch:
                        ch = await self.bot.fetch_channel(int(ch_id))
                    if not ch:
                        continue
                    rows = session.execute(
                        select(User.discord_id, User.username, func.sum(Order.total_price).label("total"))
                        .join(Order, Order.user_id == User.id)
                        .where(Order.guild_id == guild_id, Order.status.in_(["PAID", "DELIVERED"]))
                        .group_by(User.id)
                        .order_by(func.sum(Order.total_price).desc())
                        .limit(10)
                    ).all()
                    from src.bot.embed_utils import build_embed
                    medals = ["🥇", "🥈", "🥉"]
                    lines = [
                        f"{medals[i] if i < 3 else f'**{i+1}.**'} <@{r.discord_id}> — **{r.total:,.0f}**"
                        for i, r in enumerate(rows)
                    ]
                    emb = build_embed("spending_leaderboard_auto", session, vars={
                        "leaderboard": "\n".join(lines) if lines else "No data yet.",
                        "period": schedule.capitalize(),
                        "date": now.strftime("%d/%m/%Y"),
                    }, guild_id=guild_id)
                    await ch.send(embed=emb)
                except Exception as e:
                    import logging; logging.getLogger(__name__).warning(f"auto BXH send error: {e}")
        except Exception as e:
            import logging; logging.getLogger(__name__).error(f"spending_leaderboard_auto error: {e}")
        finally:
            session.close()

    @_spending_leaderboard_auto.before_loop
    async def before_bxh_auto(self):
        await self.bot.wait_until_ready()

    def cog_load(self):
        self._flash_sale_expiry_check.start()
        self._spending_leaderboard_auto.start()

    def cog_unload(self):
        self._flash_sale_expiry_check.cancel()
        self._spending_leaderboard_auto.cancel()


def setup(bot):
    bot.add_cog(ShopCog(bot))
