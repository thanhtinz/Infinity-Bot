import os
import ssl
from typing import AsyncGenerator
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, sessionmaker

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
        if "shard_count" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN shard_count INTEGER")
        if "language" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN language VARCHAR DEFAULT 'en'")
        if "vpn_api_key" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN vpn_api_key VARCHAR")
        if "vpn_api_provider" not in sc:
            all_stmts.append("ALTER TABLE system_config ADD COLUMN vpn_api_provider VARCHAR DEFAULT 'proxycheck'")

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

        # verification_configs — VPN per-guild
        vc = cols("verification_configs")
        for col, stmt in {
            "vpn_api_key": "ALTER TABLE verification_configs ADD COLUMN vpn_api_key VARCHAR",
            "vpn_api_provider": "ALTER TABLE verification_configs ADD COLUMN vpn_api_provider VARCHAR DEFAULT 'proxycheck'",
            "block_mobile": "ALTER TABLE verification_configs ADD COLUMN block_mobile BOOLEAN DEFAULT FALSE",
            "block_scammers": "ALTER TABLE verification_configs ADD COLUMN block_scammers BOOLEAN DEFAULT FALSE",
            "deny_alt_role": "ALTER TABLE verification_configs ADD COLUMN deny_alt_role BOOLEAN DEFAULT FALSE",
            "auto_ban_alts": "ALTER TABLE verification_configs ADD COLUMN auto_ban_alts BOOLEAN DEFAULT FALSE",
            "no_save_ip": "ALTER TABLE verification_configs ADD COLUMN no_save_ip BOOLEAN DEFAULT FALSE",
            "guild_join_enabled": "ALTER TABLE verification_configs ADD COLUMN guild_join_enabled BOOLEAN DEFAULT TRUE",
            "force_all_permissions": "ALTER TABLE verification_configs ADD COLUMN force_all_permissions BOOLEAN DEFAULT FALSE",
            "notify_success_role_id": "ALTER TABLE verification_configs ADD COLUMN notify_success_role_id VARCHAR",
            "notify_blocked_role_id": "ALTER TABLE verification_configs ADD COLUMN notify_blocked_role_id VARCHAR",
            "gateway_guild_id": "ALTER TABLE verification_configs ADD COLUMN gateway_guild_id VARCHAR",
            "verify_passwords": "ALTER TABLE verification_configs ADD COLUMN verify_passwords JSON DEFAULT '[]'",
            "banner_url": "ALTER TABLE verification_configs ADD COLUMN banner_url VARCHAR",
            "cursor_url": "ALTER TABLE verification_configs ADD COLUMN cursor_url VARCHAR",
            "font_family": "ALTER TABLE verification_configs ADD COLUMN font_family VARCHAR DEFAULT 'Inter'",
            "bg_effect": "ALTER TABLE verification_configs ADD COLUMN bg_effect VARCHAR DEFAULT 'none'",
            "bg_color": "ALTER TABLE verification_configs ADD COLUMN bg_color VARCHAR DEFAULT '#0b0d14'",
            "text_color": "ALTER TABLE verification_configs ADD COLUMN text_color VARCHAR DEFAULT '#ffffff'",
            "btn_color": "ALTER TABLE verification_configs ADD COLUMN btn_color VARCHAR DEFAULT '#5865F2'",
            "btn_border_color": "ALTER TABLE verification_configs ADD COLUMN btn_border_color VARCHAR DEFAULT '#5865F2'",
            "card_border_color": "ALTER TABLE verification_configs ADD COLUMN card_border_color VARCHAR DEFAULT '#1a1d2e'",
            "card_bg_color": "ALTER TABLE verification_configs ADD COLUMN card_bg_color VARCHAR DEFAULT '#1a1d2e'",
            "typewriter_effect": "ALTER TABLE verification_configs ADD COLUMN typewriter_effect BOOLEAN DEFAULT FALSE",
            "glow_effect": "ALTER TABLE verification_configs ADD COLUMN glow_effect BOOLEAN DEFAULT FALSE",
            "tilt_effect": "ALTER TABLE verification_configs ADD COLUMN tilt_effect BOOLEAN DEFAULT FALSE",
            "bio_description": "ALTER TABLE verification_configs ADD COLUMN bio_description TEXT",
            "socials": "ALTER TABLE verification_configs ADD COLUMN socials JSON DEFAULT '{}'",
            "custom_domain": "ALTER TABLE verification_configs ADD COLUMN custom_domain VARCHAR",
            "music_url": "ALTER TABLE verification_configs ADD COLUMN music_url VARCHAR",
            "pull_cooldown_hours": "ALTER TABLE verification_configs ADD COLUMN pull_cooldown_hours INTEGER DEFAULT 10",
        }.items():
            if col not in vc:
                all_stmts.append(stmt)

        # ── Thực thi tất cả ALTER trong 1 transaction ──
        if all_stmts:
            with engine.begin() as connection:
                for stmt in all_stmts:
                    connection.execute(text(stmt))
