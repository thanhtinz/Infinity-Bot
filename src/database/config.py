import os
import ssl
import logging
from typing import AsyncGenerator
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger(__name__)

# Get DB config from Neon
# Workshop's DB injection standard: use standard env vars injected by workshop platform
DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("DB8624B53A_DATABASE_URL")

# Try dropping asyncpg and using sync psycopg2 driver since asyncpg has bug
if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    pass # Use native postgresql driver

engine = None
async_session = None
SessionLocal = None  # defined below if DATABASE_URL is set

if DATABASE_URL:
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    # Use sync engine as fallback because of asyncpg bug
    engine = create_engine(
        DATABASE_URL,
        echo=False,
        connect_args={"sslmode": "require"},
        pool_pre_ping=True,      # test connection before use → auto-reconnect
        pool_recycle=300,        # recycle connections every 5 min (Neon idles out at ~5min)
    )

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

async def get_db():
    # Wrap sync session in async generator interface
    session = SessionLocal()
    try:
        # It's actually a sync session but we'll try to use it as transparently as possible
        yield session
    finally:
        session.close()

async def init_db():
    if engine:
        import src.models.models  # noqa: F401 — ensure all models registered
        Base.metadata.create_all(bind=engine)

        # ── Lấy toàn bộ column info trong 1 query duy nhất (thay vì inspector.get_columns() từng bảng) ──
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT table_name, column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
            """)).fetchall()
        # Build map: table_name → set of column names
        all_cols: dict[str, set] = {}
        for table_name, column_name in rows:
            all_cols.setdefault(table_name, set()).add(column_name)

        def cols(table: str) -> set:
            return all_cols.get(table, set())

        all_stmts: list[str] = []

        # system_config
        sc = cols("system_config")
        if "discord_client_id" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN discord_client_id VARCHAR")
        if "discord_client_secret" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN discord_client_secret VARCHAR")
        if "public_app_url" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN public_app_url VARCHAR")
        if "support_server_url" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN support_server_url VARCHAR")
        if "shop_leaderboard_reset_at" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN shop_leaderboard_reset_at TIMESTAMP")
        if "bot_invisible" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN bot_invisible BOOLEAN DEFAULT FALSE")
        if "guild_name" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN guild_name VARCHAR")
        if "guild_icon" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN guild_icon VARCHAR")
        if "guild_member_count" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN guild_member_count INTEGER")
        if "shard_count" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN shard_count INTEGER")
        if "language" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN language VARCHAR DEFAULT 'en'")
        if "currency" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN currency VARCHAR DEFAULT 'VND'")
        if "currency_symbol" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN currency_symbol VARCHAR DEFAULT '₫'")
        if "payment_methods" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN payment_methods JSON")
        if "paypal_client_id" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN paypal_client_id VARCHAR")
        if "paypal_client_secret" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN paypal_client_secret VARCHAR")
        if "paypal_mode" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN paypal_mode VARCHAR DEFAULT 'sandbox'")
        if "crypto_api_key" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN crypto_api_key VARCHAR")
        if "crypto_provider" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN crypto_provider VARCHAR DEFAULT 'nowpayments'")
        if "manual_qr_image_id" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN manual_qr_image_id VARCHAR")
        if "manual_bank_name" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN manual_bank_name VARCHAR")
        if "manual_account_holder" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN manual_account_holder VARCHAR")
        if "manual_account_number" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN manual_account_number VARCHAR")
        if "manual_instructions" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN manual_instructions TEXT")
        if "premium_payment_instructions" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN premium_payment_instructions TEXT")
        if "premium_default_renewal_days" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN premium_default_renewal_days INTEGER DEFAULT 7")
        if "premium_renewal_channel_id" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN premium_renewal_channel_id VARCHAR")
        if "flash_sale_channel_id" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN flash_sale_channel_id VARCHAR")
        if "spending_leaderboard_channel_id" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN spending_leaderboard_channel_id VARCHAR")
        if "spending_leaderboard_schedule" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN spending_leaderboard_schedule VARCHAR")
        if "spending_leaderboard_time" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN spending_leaderboard_time VARCHAR")
        if "inventory_low_stock_threshold" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN inventory_low_stock_threshold INTEGER DEFAULT 5")

        # embed_templates
        et = cols("embed_templates")
        if "response_mode" not in et:
            all_stmts.append("ALTER TABLE embed_templates ADD COLUMN response_mode VARCHAR DEFAULT 'embed'")
        if "text_template" not in et:
            all_stmts.append("ALTER TABLE embed_templates ADD COLUMN text_template TEXT")

        # custom_commands
        cc = cols("custom_commands")
        for col, stmt in {
            "aliases": "ALTER TABLE custom_commands ADD COLUMN aliases JSON DEFAULT '[]'",
            "cooldown": "ALTER TABLE custom_commands ADD COLUMN cooldown INTEGER DEFAULT 0",
            "allowed_channels": "ALTER TABLE custom_commands ADD COLUMN allowed_channels JSON DEFAULT '[]'",
            "delete_trigger": "ALTER TABLE custom_commands ADD COLUMN delete_trigger BOOLEAN DEFAULT FALSE",
            "auto_react": "ALTER TABLE custom_commands ADD COLUMN auto_react VARCHAR",
            "silent": "ALTER TABLE custom_commands ADD COLUMN silent BOOLEAN DEFAULT FALSE",
            "dm_response": "ALTER TABLE custom_commands ADD COLUMN dm_response BOOLEAN DEFAULT FALSE",
            "no_everyone": "ALTER TABLE custom_commands ADD COLUMN no_everyone BOOLEAN DEFAULT FALSE",
            "allowed_roles": "ALTER TABLE custom_commands ADD COLUMN allowed_roles JSON DEFAULT '[]'",
            "ignored_roles": "ALTER TABLE custom_commands ADD COLUMN ignored_roles JSON DEFAULT '[]'",
            "ignored_channels": "ALTER TABLE custom_commands ADD COLUMN ignored_channels JSON DEFAULT '[]'",
            "response_channel_id": "ALTER TABLE custom_commands ADD COLUMN response_channel_id VARCHAR",
            "delete_after": "ALTER TABLE custom_commands ADD COLUMN delete_after INTEGER DEFAULT 0",
            "required_args": "ALTER TABLE custom_commands ADD COLUMN required_args INTEGER DEFAULT 0",
            "additional_responses": "ALTER TABLE custom_commands ADD COLUMN additional_responses JSON DEFAULT '[]'",
            "event_trigger": "ALTER TABLE custom_commands ADD COLUMN event_trigger VARCHAR DEFAULT 'prefix_command'",
            "trigger_config": "ALTER TABLE custom_commands ADD COLUMN trigger_config JSON DEFAULT '{}'",
            "actions": "ALTER TABLE custom_commands ADD COLUMN actions JSON DEFAULT '[]'",
        }.items():
            if col not in cc:
                all_stmts.append(stmt)

        # custom_embed_messages
        cem = cols("custom_embed_messages")
        for col, stmt in {
            "content": "ALTER TABLE custom_embed_messages ADD COLUMN content TEXT",
            "webhook_username": "ALTER TABLE custom_embed_messages ADD COLUMN webhook_username VARCHAR",
            "webhook_avatar_url": "ALTER TABLE custom_embed_messages ADD COLUMN webhook_avatar_url VARCHAR",
            "thread_name": "ALTER TABLE custom_embed_messages ADD COLUMN thread_name VARCHAR",
            "embeds": "ALTER TABLE custom_embed_messages ADD COLUMN embeds JSON DEFAULT '[]'",
            "components": "ALTER TABLE custom_embed_messages ADD COLUMN components JSON DEFAULT '[]'",
            "flags": "ALTER TABLE custom_embed_messages ADD COLUMN flags JSON DEFAULT '{}'",
            "allowed_mentions": "ALTER TABLE custom_embed_messages ADD COLUMN allowed_mentions JSON DEFAULT '{}'",
        }.items():
            if col not in cem:
                all_stmts.append(stmt)

        # products
        pr = cols("products")
        if "emoji" not in pr:
            all_stmts.append("ALTER TABLE products ADD COLUMN emoji VARCHAR")
        if "category_id" not in pr:
            all_stmts.append("ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL")

        # orders
        ord_ = cols("orders")
        for col, stmt in {
            "currency": "ALTER TABLE orders ADD COLUMN currency VARCHAR DEFAULT 'VND'",
            "payment_method": "ALTER TABLE orders ADD COLUMN payment_method VARCHAR",
            "payment_id": "ALTER TABLE orders ADD COLUMN payment_id VARCHAR",
            "expires_at": "ALTER TABLE orders ADD COLUMN expires_at TIMESTAMP",
        }.items():
            if col not in ord_:
                all_stmts.append(stmt)

        # coupons
        cp = cols("coupons")
        for col, stmt in {
            "discount_type": "ALTER TABLE coupons ADD COLUMN discount_type VARCHAR DEFAULT 'percent'",
            "buy_x": "ALTER TABLE coupons ADD COLUMN buy_x INTEGER",
            "get_y": "ALTER TABLE coupons ADD COLUMN get_y INTEGER",
            "apply_mode": "ALTER TABLE coupons ADD COLUMN apply_mode VARCHAR DEFAULT 'all'",
            "apply_category_id": "ALTER TABLE coupons ADD COLUMN apply_category_id INTEGER",
            "apply_product_id": "ALTER TABLE coupons ADD COLUMN apply_product_id INTEGER",
            "customer_mode": "ALTER TABLE coupons ADD COLUMN customer_mode VARCHAR DEFAULT 'all'",
            "customer_ids": "ALTER TABLE coupons ADD COLUMN customer_ids JSON DEFAULT '[]'",
        }.items():
            if col not in cp:
                all_stmts.append(stmt)

        # staff_permissions
        sp = cols("staff_permissions")
        for col, stmt in {
            "can_ai": "ALTER TABLE staff_permissions ADD COLUMN can_ai BOOLEAN DEFAULT FALSE",
            "can_forms": "ALTER TABLE staff_permissions ADD COLUMN can_forms BOOLEAN DEFAULT FALSE",
            "can_reminders": "ALTER TABLE staff_permissions ADD COLUMN can_reminders BOOLEAN DEFAULT FALSE",
        }.items():
            if col not in sp:
                all_stmts.append(stmt)
        # Drop stale column
        if "can_verification" in sp:
            all_stmts.append("ALTER TABLE staff_permissions DROP COLUMN can_verification")

        # orders — delivery + fraud columns
        ord_ = cols("orders")
        for col, stmt in {
            "delivered_at":   "ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMP",
            "delivery_note":  "ALTER TABLE orders ADD COLUMN delivery_note TEXT",
        }.items():
            if col not in ord_:
                all_stmts.append(stmt)

        # users — CRM fields
        usr = cols("users")
        for col, stmt in {
            "loyalty_tier":    "ALTER TABLE users ADD COLUMN loyalty_tier VARCHAR",
            "tier_updated_at": "ALTER TABLE users ADD COLUMN tier_updated_at TIMESTAMP",
            "reputation_score":"ALTER TABLE users ADD COLUMN reputation_score INTEGER DEFAULT 0",
            "dispute_count":   "ALTER TABLE users ADD COLUMN dispute_count INTEGER DEFAULT 0",
            "chargeback_count":"ALTER TABLE users ADD COLUMN chargeback_count INTEGER DEFAULT 0",
            "tags":            "ALTER TABLE users ADD COLUMN tags JSON DEFAULT '[]'",
            "internal_notes":  "ALTER TABLE users ADD COLUMN internal_notes TEXT",
            "blacklisted":     "ALTER TABLE users ADD COLUMN blacklisted BOOLEAN DEFAULT FALSE",
            "last_order_at":   "ALTER TABLE users ADD COLUMN last_order_at TIMESTAMP",
        }.items():
            if col not in usr:
                all_stmts.append(stmt)

        # inventory_items — delivery tracking
        inv = cols("inventory_items")
        for col, stmt in {
            "delivered_at":             "ALTER TABLE inventory_items ADD COLUMN delivered_at TIMESTAMP",
            "delivered_to_discord_id":  "ALTER TABLE inventory_items ADD COLUMN delivered_to_discord_id VARCHAR",
        }.items():
            if col not in inv:
                all_stmts.append(stmt)

        # order_logs — metadata column
        ol = cols("order_logs")
        if "metadata" not in ol:
            all_stmts.append("ALTER TABLE order_logs ADD COLUMN metadata JSON DEFAULT '{}'")

        # orders — fraud columns
        for col, stmt in {
            "flagged":          "ALTER TABLE orders ADD COLUMN flagged BOOLEAN DEFAULT FALSE",
            "flag_reason":      "ALTER TABLE orders ADD COLUMN flag_reason VARCHAR",
            "delivered_item_id":"ALTER TABLE orders ADD COLUMN delivered_item_id INTEGER REFERENCES inventory_items(id)",
        }.items():
            if col not in ord_:
                all_stmts.append(stmt)

        # orders — fraud & delivery cols
        ord_ = cols("orders")
        for col, stmt in {
            "flagged":           "ALTER TABLE orders ADD COLUMN flagged BOOLEAN DEFAULT FALSE",
            "flag_reason":       "ALTER TABLE orders ADD COLUMN flag_reason VARCHAR",
            "delivered_item_id": "ALTER TABLE orders ADD COLUMN delivered_item_id INTEGER REFERENCES inventory_items(id)",
        }.items():
            if col not in ord_:
                all_stmts.append(stmt)

        # inventory_items — delivery tracking
        inv = cols("inventory_items")
        for col, stmt in {
            "delivered_at":            "ALTER TABLE inventory_items ADD COLUMN delivered_at TIMESTAMP",
            "delivered_to_discord_id": "ALTER TABLE inventory_items ADD COLUMN delivered_to_discord_id VARCHAR",
            "serial_number":           "ALTER TABLE inventory_items ADD COLUMN serial_number VARCHAR",
        }.items():
            if col not in inv:
                all_stmts.append(stmt)

        # users — CRM cols
        usr = cols("users")
        for col, stmt in {
            "loyalty_tier":     "ALTER TABLE users ADD COLUMN loyalty_tier VARCHAR",
            "tier_updated_at":  "ALTER TABLE users ADD COLUMN tier_updated_at TIMESTAMP",
            "reputation_score": "ALTER TABLE users ADD COLUMN reputation_score INTEGER DEFAULT 0",
            "dispute_count":    "ALTER TABLE users ADD COLUMN dispute_count INTEGER DEFAULT 0",
            "chargeback_count": "ALTER TABLE users ADD COLUMN chargeback_count INTEGER DEFAULT 0",
            "tags":             "ALTER TABLE users ADD COLUMN tags JSON DEFAULT '[]'",
            "internal_notes":   "ALTER TABLE users ADD COLUMN internal_notes TEXT",
            "blacklisted":      "ALTER TABLE users ADD COLUMN blacklisted BOOLEAN DEFAULT FALSE",
        }.items():
            if col not in usr:
                all_stmts.append(stmt)

        # ── Execute all ALTERs in one transaction ──
        if all_stmts:
            logger.info(f"[init_db] Running {len(all_stmts)} migration(s): {all_stmts}")
            with engine.begin() as connection:
                for stmt in all_stmts:
                    logger.info(f"[init_db] Executing: {stmt}")
                    connection.execute(text(stmt))
            logger.info("[init_db] Migrations complete.")
        else:
            logger.info("[init_db] No migrations needed — schema is up to date.")
