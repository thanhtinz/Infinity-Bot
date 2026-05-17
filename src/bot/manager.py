import asyncio
import datetime
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
bot_start_time: datetime.datetime | None = None
bot_ready_event: asyncio.Event | None = None


def get_session():
    if SessionLocal is None:
        raise RuntimeError("Database is not configured. Please set DATABASE_URL.")
    return SessionLocal()


def update_bot_status(status: str):
    try:
        session = get_session()
        try:
            config = session.execute(select(SystemConfig).limit(1)).scalars().first()
            if config:
                config.bot_status = status
                session.commit()
                logger.info(f"bot_status updated to: {status}")
        finally:
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


def get_bot_client():
    """Trả về bot instance hiện tại (hoặc None nếu chưa chạy)."""
    return bot


def create_bot():
    intents = discord.Intents.default()
    intents.message_content = True
    intents.members = True

    # Đọc shard_count từ DB (None = auto)
    _shard_count = None
    _debug_guilds = []
    try:
        _s = get_session()
        try:
            _cfg = _s.execute(select(SystemConfig).limit(1)).scalars().first()
            if _cfg and _cfg.shard_count and _cfg.shard_count > 0:
                _shard_count = _cfg.shard_count
            # Collect all guild IDs for instant slash command sync
            all_cfgs = _s.execute(select(SystemConfig)).scalars().all()
            for _c in all_cfgs:
                if _c.guild_id:
                    try:
                        _debug_guilds.append(int(_c.guild_id))
                    except (ValueError, TypeError):
                        pass
        finally:
            _s.close()
    except Exception:
        pass

    # Multi-guild: dùng AutoShardedBot để hỗ trợ nhiều shard tự động
    bot_client = discord.AutoShardedBot(
        intents=intents,
        shard_count=_shard_count,  # None = Discord tự quyết
        debug_guilds=_debug_guilds or None,  # instant sync for known guilds
        auto_sync_commands=False,  # We sync manually in on_ready with error handling
    )

    # ── Load cogs (reload modules to pick up code changes on restart) ─────────
    import importlib
    import sys

    _cog_modules = [
        "src.bot.cogs.shop", "src.bot.cogs.admin_shop", "src.bot.cogs.giveaway",
        "src.bot.cogs.moderation", "src.bot.cogs.invite_tracking",
        "src.bot.cogs.sticky", "src.bot.cogs.utility",
        "src.bot.cogs.roles", "src.bot.cogs.logging_cog",
        "src.bot.cogs.afk", "src.bot.cogs.starboard", "src.bot.cogs.automod",
        "src.bot.cogs.custom_commands", "src.bot.cogs.reaction_roles",
        "src.bot.cogs.scheduler", "src.bot.cogs.autoresponder",
        "src.bot.cogs.interactions", "src.bot.cogs.help_cog",
        "src.bot.cogs.channel_admin", "src.bot.cogs.onboarding",
        "src.bot.cogs.fun", "src.bot.cogs.moderation_ext",
        "src.bot.prefix_commands", "src.bot.embed_utils",
    ]
    for _mod_name in _cog_modules:
        if _mod_name in sys.modules:
            try:
                importlib.reload(sys.modules[_mod_name])
            except Exception as _reload_err:
                logger.warning(f"Failed to reload {_mod_name}: {_reload_err}")

    from src.bot.cogs.shop import ShopCog
    from src.bot.cogs.admin_shop import AdminShopCog
    from src.bot.cogs.giveaway import GiveawayCog
    from src.bot.cogs.moderation import ModerationCog
    from src.bot.cogs.invite_tracking import InviteTrackingCog
    from src.bot.cogs.sticky import StickyCog
    from src.bot.cogs.utility import UtilityCog
    from src.bot.cogs.roles import RolesCog
    from src.bot.cogs.logging_cog import LoggingCog
    from src.bot.cogs.afk import AFKCog
    from src.bot.cogs.starboard import StarboardCog
    from src.bot.cogs.automod import AutoModCog
    from src.bot.cogs.custom_commands import CustomCommandsCog
    from src.bot.cogs.reaction_roles import ReactionRolesCog
    from src.bot.cogs.scheduler import SchedulerCog
    from src.bot.cogs.autoresponder import AutoResponderCog
    from src.bot.cogs.interactions import InteractionCog
    from src.bot.cogs.help_cog import HelpCog
    from src.bot.cogs.channel_admin import ChannelAdminCog
    from src.bot.cogs.onboarding import OnboardingCog
    from src.bot.cogs.fun import FunCog
    from src.bot.cogs.moderation_ext import ModerationExtCog
    from src.bot.prefix_commands import PrefixCommandsCog

    # Tag cogs with feature keys for runtime check
    _COG_FEATURE_MAP = {
        "ShopCog": "shop", "AdminShopCog": "shop",
        "GiveawayCog": "giveaway",
        "ModerationCog": "moderation", "AutoModCog": "moderation", "LoggingCog": "moderation",
        "InviteTrackingCog": "invite_tracking",
        "StickyCog": "sticky",
        "UtilityCog": "utility", "AFKCog": "utility",
        "RolesCog": None, "ReactionRolesCog": None,
        "StarboardCog": "starboard",
        "CustomCommandsCog": "custom_commands",
        "SchedulerCog": "scheduler",
        "AutoResponderCog": "autoresponder",
        "InteractionCog": "interactions",
        "ChannelAdminCog": "moderation",
        "FunCog": "fun",
        "ModerationExtCog": "moderation",
        "PrefixCommandsCog": None,
    }

    cogs = [
        ShopCog(bot_client), AdminShopCog(bot_client),
        GiveawayCog(bot_client), ModerationCog(bot_client),
        InviteTrackingCog(bot_client),
        StickyCog(bot_client),
        UtilityCog(bot_client),
        RolesCog(bot_client), LoggingCog(bot_client),
        AFKCog(bot_client), StarboardCog(bot_client),
        AutoModCog(bot_client), CustomCommandsCog(bot_client),
        ReactionRolesCog(bot_client), SchedulerCog(bot_client),
        AutoResponderCog(bot_client),
        InteractionCog(bot_client),
        ChannelAdminCog(bot_client),
        HelpCog(bot_client),
        OnboardingCog(bot_client),
        FunCog(bot_client),
        ModerationExtCog(bot_client),
        PrefixCommandsCog(bot_client),
    ]
    for cog in cogs:
        cog.feature_key = _COG_FEATURE_MAP.get(type(cog).__name__)
        try:
            bot_client.add_cog(cog)
            logger.info(f"✅ Loaded cog: {type(cog).__name__}")
        except Exception as cog_err:
            logger.error(f"❌ Failed to load cog {type(cog).__name__}: {cog_err}")

    # ── Global before_invoke: block commands if feature disabled ──
    from src.bot.feature_utils import feature_enabled

    @bot_client.before_invoke
    async def _check_feature(ctx: discord.ApplicationContext):
        if not ctx.command:
            return
        cog = ctx.command.cog
        if cog and getattr(cog, "feature_key", None):
            if not feature_enabled(cog.feature_key):
                await ctx.respond("❌ Tính năng này đã bị tắt.", ephemeral=True)
                raise Exception("Feature disabled")

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
        global bot_start_time, bot_ready_event
        logger.info(f"Bot on_ready: Logged in as {bot_client.user} (ID: {bot_client.user.id})")
        logger.info(f"Loaded cogs: {list(bot_client.cogs.keys())}")
        logger.info(f"Pending application commands: {len(bot_client.pending_application_commands)}")
        bot_start_time = datetime.datetime.utcnow()

        # ── Force sync slash commands to all guilds bot is in ──
        try:
            guild_ids = [g.id for g in bot_client.guilds]
            logger.info(f"Syncing commands to {len(guild_ids)} guilds: {guild_ids}")
            await bot_client.sync_commands()
            logger.info("Command sync completed successfully")
        except Exception as sync_err:
            logger.error(f"Command sync failed (non-fatal): {sync_err}", exc_info=True)

        await asyncio.to_thread(update_bot_status, "running")
        if bot_ready_event and not bot_ready_event.is_set():
            bot_ready_event.set()
        bot_client.loop.create_task(_check_expired_orders(bot_client))
        # Apply invisible status + cache guild name/icon
        try:
            _inv_session = get_session()
            try:
                _cfg = _inv_session.execute(select(SystemConfig).limit(1)).scalars().first()
                if _cfg and _cfg.bot_invisible:
                    await bot_client.change_presence(status=discord.Status.invisible)
                    logger.info("Bot presence set to invisible (bot_invisible=True)")
                # Cache guild name + icon for every guild into their SystemConfig row
                for _guild in bot_client.guilds:
                    _gid = str(_guild.id)
                    _gc = _inv_session.execute(
                        select(SystemConfig).where(SystemConfig.guild_id == _gid)
                    ).scalars().first()
                    if _gc is None:
                        _gc = _inv_session.execute(select(SystemConfig).limit(1)).scalars().first()
                    if _gc:
                        _gc.guild_name = _guild.name
                        _gc.guild_icon = str(_guild.icon.url) if _guild.icon else None
                _inv_session.commit()
                logger.info("Cached guild name/icon into SystemConfig")
            finally:
                _inv_session.close()
        except Exception as _inv_err:
            logger.warning(f"Failed to apply invisible status / cache guild info: {_inv_err}")
        # Re-register persistent views (bảng giá) để hoạt động sau restart
        try:
            from src.bot.cogs.admin_shop import BangGiaView
            bot_client.add_view(BangGiaView())
        except Exception as _pv_err:
            logger.warning(f"Persistent view register failed: {_pv_err}")
        # Sync slash commands so new/updated commands register with Discord
        try:
            await bot_client.sync_commands()
            logger.info("Slash commands synced successfully")
        except Exception as _sync_err:
            logger.warning(f"sync_commands failed: {_sync_err}")

    @bot_client.event
    async def on_disconnect():
        logger.info("Bot disconnected")
        await asyncio.to_thread(update_bot_status, "offline")

    @bot_client.event
    async def on_guild_join(guild: discord.Guild):
        """Khi bot join guild mới → tự tạo SystemConfig row cho guild đó."""
        logger.info(f"Bot joined guild: {guild.name} ({guild.id})")
        try:
            session = get_session()
            try:
                existing = session.execute(
                    select(SystemConfig).where(SystemConfig.guild_id == str(guild.id))
                ).scalars().first()
                if not existing:
                    # Lấy discord_token từ config đầu tiên (shared token)
                    first_cfg = session.execute(select(SystemConfig).limit(1)).scalars().first()
                    new_cfg = SystemConfig(
                        guild_id=str(guild.id),
                        discord_token=first_cfg.discord_token if first_cfg else None,
                        discord_client_id=first_cfg.discord_client_id if first_cfg else None,
                        discord_client_secret=first_cfg.discord_client_secret if first_cfg else None,
                        public_app_url=first_cfg.public_app_url if first_cfg else None,
                        bot_status="running",
                    )
                    session.add(new_cfg)
                    session.commit()
                    logger.info(f"Created SystemConfig for guild {guild.id}")
            finally:
                session.close()
        except Exception as e:
            logger.error(f"on_guild_join SystemConfig creation failed: {e}")

    return bot_client


async def _close_bot_client(bot_client: discord.Bot | None):
    if bot_client is None:
        return
    try:
        if bot_client.is_closed():
            return
    except Exception:
        pass
    try:
        await bot_client.close()
    except RuntimeError as e:
        if "Session is closed" not in str(e):
            raise
        logger.warning("Bot client session was already closed during shutdown")


def _log_bot_task_done(task: asyncio.Task):
    global bot, bot_task
    try:
        task.result()
    except asyncio.CancelledError:
        return
    except Exception as e:
        logger.exception(f"Bot task crashed: {e}")
    if bot_task is task:
        bot_task = None
        bot = None
        update_bot_status("offline")


async def start_bot():
    global bot_task, bot, bot_ready_event

    # Clean up stale
    if bot is not None or bot_task is not None:
        await stop_bot()

    session = get_session()
    try:
        config = session.execute(select(SystemConfig).limit(1)).scalars().first()
        if not config or not config.discord_token:
            logger.error("No Discord token configured.")
            return False
        token = config.discord_token
    finally:
        session.close()

    bot_ready_event = asyncio.Event()
    bot = create_bot()
    loop = asyncio.get_event_loop()
    bot_task = loop.create_task(bot.start(token))
    bot_task.add_done_callback(_log_bot_task_done)

    try:
        await asyncio.wait_for(bot_ready_event.wait(), timeout=12)
        return True
    except asyncio.TimeoutError:
        current_task = bot_task  # snapshot before callback may null it
        if current_task is not None and current_task.done():
            return False
        logger.info("Bot start still connecting; leaving task running")
        return True


async def stop_bot():
    global bot_task, bot, bot_ready_event

    current_bot = bot
    current_task = bot_task
    bot = None
    bot_task = None
    bot_ready_event = None

    await _close_bot_client(current_bot)

    if current_task:
        current_task.cancel()
        try:
            await current_task
        except asyncio.CancelledError:
            pass
        except RuntimeError as e:
            if "Session is closed" not in str(e):
                raise
            logger.warning("Bot task ended with already-closed session during shutdown")
        except Exception as e:
            logger.error(f"Error waiting for bot task shutdown: {e}")

    update_bot_status("offline")
    return True
