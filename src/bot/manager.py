import asyncio
import discord
import logging
import os
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from src.database.config import SessionLocal
from src.models.models import SystemConfig, User, Product, Order

logger = logging.getLogger(__name__)

bot_task = None
bot = None


def get_session():
    return SessionLocal()


def update_bot_status(status: str):
    try:
        session = get_session()
        config = session.execute(select(SystemConfig).limit(1)).scalars().first()
        if config:
            config.bot_status = status
            session.commit()
            logger.info(f"bot_status updated to: {status}")
        session.close()
    except Exception as e:
        logger.error(f"Failed to update bot_status: {e}")


async def _check_expired_orders(bot_client: discord.Bot):
    """Background task: mỗi 2 phút check đơn PENDING > 15 phút, mark EXPIRED và DM user."""
    import datetime as _dt
    from src.bot.embed_utils import build_embed
    await asyncio.sleep(60)  # delay 60s sau khi bot ready
    while True:
        try:
            session = get_session()
            try:
                cutoff = _dt.datetime.utcnow() - _dt.timedelta(minutes=15)
                expired = session.execute(
                    select(Order).where(
                        Order.status == "PENDING",
                        Order.created_at <= cutoff,
                    )
                ).scalars().all()
                for order in expired:
                    order.status = "EXPIRED"
                    # DM user
                    try:
                        user_obj = session.execute(
                            select(User).where(User.id == order.user_id)
                        ).scalars().first()
                        product_name = "Sản phẩm"
                        if order.product_id:
                            prod = session.execute(
                                select(Product).where(Product.id == order.product_id)
                            ).scalars().first()
                            if prod:
                                product_name = prod.name
                        elif order.package_name:
                            product_name = order.package_name
                        if user_obj and user_obj.discord_id:
                            discord_user = await bot_client.fetch_user(int(user_obj.discord_id))
                            dm_embed = build_embed("don_hang_het_han", session, vars={
                                "user": str(discord_user),
                                "user.mention": discord_user.mention,
                                "user.id": str(discord_user.id),
                                "order.id": str(order.id),
                                "product.name": product_name,
                            })
                            await discord_user.send(embed=dm_embed)
                    except Exception as dm_err:
                        logger.debug(f"expire DM failed order#{order.id}: {dm_err}")
                if expired:
                    session.commit()
                    logger.info(f"Expired {len(expired)} orders")
            finally:
                session.close()
        except Exception as e:
            logger.error(f"_check_expired_orders error: {e}")
        await asyncio.sleep(120)  # check mỗi 2 phút


def create_bot():
    intents = discord.Intents.default()
    intents.message_content = True
    intents.members = True

    bot_client = discord.Bot(intents=intents)

    # ── Load cogs ────────────────────────────────────────────
    from src.bot.cogs.shop import ShopCog
    from src.bot.cogs.admin_shop import AdminShopCog
    from src.bot.cogs.giveaway import GiveawayCog
    from src.bot.cogs.moderation import ModerationCog
    from src.bot.cogs.temp_voice import TempVoiceCog
    from src.bot.cogs.invite_tracking import InviteTrackingCog
    from src.bot.cogs.sticky import StickyCog

    bot_client.add_cog(ShopCog(bot_client))
    bot_client.add_cog(AdminShopCog(bot_client))
    bot_client.add_cog(GiveawayCog(bot_client))
    bot_client.add_cog(ModerationCog(bot_client))
    bot_client.add_cog(TempVoiceCog(bot_client))
    bot_client.add_cog(InviteTrackingCog(bot_client))
    bot_client.add_cog(StickyCog(bot_client))

    # ── Legacy commands (status, san_pham, account) ──────────
    @bot_client.slash_command(name="status", description="Xem trạng thái bot hiện tại")
    async def status_cmd(ctx: discord.ApplicationContext):
        session = get_session()
        try:
            config = session.execute(select(SystemConfig).limit(1)).scalars().first()
            embed = discord.Embed(title="🤖 Trạng thái Bot", color=discord.Color.green())
            embed.add_field(name="Trạng thái", value="🟢 Đang hoạt động", inline=True)
            if config and config.guild_id:
                guild = bot_client.get_guild(int(config.guild_id))
                if guild:
                    embed.add_field(name="Server", value=guild.name, inline=True)
                    embed.add_field(name="Thành viên", value=str(guild.member_count), inline=True)
            await ctx.respond(embed=embed)
        finally:
            session.close()

    @bot_client.slash_command(name="san_pham", description="Xem danh sách sản phẩm đang bán")
    async def san_pham_cmd(ctx: discord.ApplicationContext):
        session = get_session()
        try:
            products = session.execute(
                select(Product).where(Product.active == True).order_by(Product.id)
            ).scalars().all()
            if not products:
                await ctx.respond("Hiện chưa có sản phẩm nào.", ephemeral=True)
                return
            embed = discord.Embed(title="🛒 Danh sách sản phẩm", color=discord.Color.green())
            for p in products:
                pkgs = p.packages or []
                active_pkgs = [pk for pk in pkgs if pk.get("active", True)]
                if active_pkgs:
                    pkg_lines = "\n".join(
                        f"  • **{pk['name']}** — {pk['price']:,.0f}đ" for pk in active_pkgs
                    )
                    embed.add_field(name=f"📦 {p.name}", value=pkg_lines, inline=False)
                else:
                    embed.add_field(
                        name=f"📦 {p.name}",
                        value=p.description or "Liên hệ admin để biết giá.",
                        inline=False,
                    )
            embed.set_footer(text="Liên hệ admin để đặt hàng hoặc dùng /help")
            await ctx.respond(embed=embed)
        finally:
            session.close()

    @bot_client.slash_command(name="account", description="Xem thông tin tài khoản & lịch sử mua hàng")
    async def account_cmd(ctx: discord.ApplicationContext):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            from src.models.models import User as UserM
            user_record = session.execute(
                select(UserM).where(UserM.discord_id == str(ctx.author.id))
            ).scalars().first()

            if not user_record:
                await ctx.respond(
                    "Bạn chưa có tài khoản trong hệ thống. Hãy đặt hàng lần đầu để tạo tài khoản!",
                    ephemeral=True,
                )
                return

            # Lấy 5 đơn gần nhất
            recent_orders = session.execute(
                select(Order)
                .where(Order.user_id == user_record.id)
                .order_by(Order.created_at.desc())
                .limit(5)
            ).scalars().all()

            total_orders = session.execute(
                select(func.count(Order.id)).where(Order.user_id == user_record.id)
            ).scalar() or 0

            embed = discord.Embed(
                title=f"👤 Tài khoản — {ctx.author.display_name}",
                color=discord.Color.blurple(),
            )
            embed.set_thumbnail(url=ctx.author.display_avatar.url)
            embed.add_field(name="💰 Tổng chi tiêu", value=f"{user_record.total_spent or 0:,.0f}đ", inline=True)
            embed.add_field(name="📦 Tổng đơn", value=str(total_orders), inline=True)
            embed.add_field(name="🆔 Discord ID", value=f"`{ctx.author.id}`", inline=True)

            if recent_orders:
                status_map = {
                    "PENDING": "⏳", "PAID": "✅", "DELIVERING": "🚚",
                    "DELIVERED": "📦", "CANCELLED": "❌", "ERROR": "⚠",
                }
                lines = []
                for o in recent_orders:
                    product_name = o.package_name or f"#{o.product_id}"
                    if o.product_id:
                        prod = session.get(Product, o.product_id)
                        if prod:
                            product_name = f"{prod.name}" + (f" ({o.package_name})" if o.package_name else "")
                    icon = status_map.get(o.status, "•")
                    lines.append(f"{icon} **#{o.id}** {product_name} — {o.total_price:,.0f}đ")
                embed.add_field(
                    name="📋 5 đơn gần nhất",
                    value="\n".join(lines),
                    inline=False,
                )

            embed.set_footer(text="Dùng /orders để xem chi tiết đơn hàng")
            await ctx.respond(embed=embed, ephemeral=True)
        finally:
            session.close()

    # ── Events ───────────────────────────────────────────────
    @bot_client.event
    async def on_ready():
        logger.info(f"Bot on_ready: Logged in as {bot_client.user} (ID: {bot_client.user.id})")
        await asyncio.to_thread(update_bot_status, "running")
        bot_client.loop.create_task(_check_expired_orders(bot_client))

    @bot_client.event
    async def on_disconnect():
        logger.info("Bot disconnected")
        await asyncio.to_thread(update_bot_status, "offline")

    return bot_client


async def start_bot():
    global bot_task, bot

    # Clean up stale
    if bot is not None:
        try:
            await bot.close()
        except Exception:
            pass
        bot = None
        bot_task = None

    session = get_session()
    try:
        config = session.execute(select(SystemConfig).limit(1)).scalars().first()
        if not config or not config.discord_token:
            logger.error("No Discord token configured.")
            return False
        token = config.discord_token
    finally:
        session.close()

    bot = create_bot()
    loop = asyncio.get_event_loop()
    bot_task = loop.create_task(bot.start(token))
    return True


async def stop_bot():
    global bot_task, bot

    if bot:
        try:
            await bot.close()
        except Exception as e:
            logger.error(f"Error closing bot: {e}")

    if bot_task:
        bot_task.cancel()
        try:
            await bot_task
        except asyncio.CancelledError:
            pass

    bot_task = None
    bot = None
    update_bot_status("offline")
    return True
