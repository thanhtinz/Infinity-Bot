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

        # embed_templates
        et = cols("embed_templates")
        if "response_mode" not in et:
            all_stmts.append("ALTER TABLE embed_templates ADD COLUMN response_mode VARCHAR DEFAULT 'embed'")
        if "text_template" not in et:
            all_stmts.append("ALTER TABLE embed_templates ADD COLUMN text_template TEXT")

        # temp_voice_config
        tv = cols("temp_voice_config")
        if "voice_buttons" not in tv:
            all_stmts.append("ALTER TABLE temp_voice_config ADD COLUMN voice_buttons JSON DEFAULT '[]'")
        for col, stmt in {
            "default_visibility": "ALTER TABLE temp_voice_config ADD COLUMN default_visibility VARCHAR DEFAULT 'public'",
            "inactive_cleanup_minutes": "ALTER TABLE temp_voice_config ADD COLUMN inactive_cleanup_minutes INTEGER DEFAULT 0",
            "max_rooms_per_user": "ALTER TABLE temp_voice_config ADD COLUMN max_rooms_per_user INTEGER DEFAULT 0",
            "max_rooms_per_guild": "ALTER TABLE temp_voice_config ADD COLUMN max_rooms_per_guild INTEGER DEFAULT 0",
            "rename_cooldown_seconds": "ALTER TABLE temp_voice_config ADD COLUMN rename_cooldown_seconds INTEGER DEFAULT 0",
            "allow_invite": "ALTER TABLE temp_voice_config ADD COLUMN allow_invite BOOLEAN DEFAULT TRUE",
            "allow_kick": "ALTER TABLE temp_voice_config ADD COLUMN allow_kick BOOLEAN DEFAULT TRUE",
            "allow_transfer": "ALTER TABLE temp_voice_config ADD COLUMN allow_transfer BOOLEAN DEFAULT TRUE",
            "allow_claim": "ALTER TABLE temp_voice_config ADD COLUMN allow_claim BOOLEAN DEFAULT TRUE",
            "bypass_role_ids": "ALTER TABLE temp_voice_config ADD COLUMN bypass_role_ids JSON DEFAULT '[]'",
            "blacklist_role_ids": "ALTER TABLE temp_voice_config ADD COLUMN blacklist_role_ids JSON DEFAULT '[]'",
        }.items():
            if col not in tv:
                all_stmts.append(stmt)

        # ticket_configs
        tc = cols("ticket_configs")
        for col, stmt in {
            "open_message_title": "ALTER TABLE ticket_configs ADD COLUMN open_message_title VARCHAR",
            "open_message_body": "ALTER TABLE ticket_configs ADD COLUMN open_message_body TEXT",
            "close_message_title": "ALTER TABLE ticket_configs ADD COLUMN close_message_title VARCHAR",
            "close_message_body": "ALTER TABLE ticket_configs ADD COLUMN close_message_body TEXT",
            "claim_message_title": "ALTER TABLE ticket_configs ADD COLUMN claim_message_title VARCHAR",
            "claim_message_body": "ALTER TABLE ticket_configs ADD COLUMN claim_message_body TEXT",
        }.items():
            if col not in tc:
                all_stmts.append(stmt)

        # ticket_panels
        tp = cols("ticket_panels")
        for col, stmt in {
            "group_id": "ALTER TABLE ticket_panels ADD COLUMN group_id INTEGER",
            "naming_format": "ALTER TABLE ticket_panels ADD COLUMN naming_format VARCHAR",
            "open_message_title": "ALTER TABLE ticket_panels ADD COLUMN open_message_title VARCHAR",
            "open_message_body": "ALTER TABLE ticket_panels ADD COLUMN open_message_body TEXT",
            "close_message_title": "ALTER TABLE ticket_panels ADD COLUMN close_message_title VARCHAR",
            "close_message_body": "ALTER TABLE ticket_panels ADD COLUMN close_message_body TEXT",
            "claim_message_title": "ALTER TABLE ticket_panels ADD COLUMN claim_message_title VARCHAR",
            "claim_message_body": "ALTER TABLE ticket_panels ADD COLUMN claim_message_body TEXT",
        }.items():
            if col not in tp:
                all_stmts.append(stmt)

        # temp_voice_rooms
        tvr = cols("temp_voice_rooms")
        if "panel_channel_id" not in tvr:
            all_stmts.append("ALTER TABLE temp_voice_rooms ADD COLUMN panel_channel_id VARCHAR")
        if "panel_message_id" not in tvr:
            all_stmts.append("ALTER TABLE temp_voice_rooms ADD COLUMN panel_message_id VARCHAR")
        if "room_name" not in tvr:
            all_stmts.append("ALTER TABLE temp_voice_rooms ADD COLUMN room_name VARCHAR")
        if "peak_members" not in tvr:
            all_stmts.append("ALTER TABLE temp_voice_rooms ADD COLUMN peak_members INTEGER DEFAULT 0")

        # leveling_configs
        lvl = cols("leveling_configs")
        for col, stmt in {
            "gain_xp_from_commands": "ALTER TABLE leveling_configs ADD COLUMN gain_xp_from_commands BOOLEAN DEFAULT FALSE",
            "remove_old_reward_roles": "ALTER TABLE leveling_configs ADD COLUMN remove_old_reward_roles BOOLEAN DEFAULT FALSE",
            "stack_reward_roles": "ALTER TABLE leveling_configs ADD COLUMN stack_reward_roles BOOLEAN DEFAULT TRUE",
            "rank_card_config": "ALTER TABLE leveling_configs ADD COLUMN rank_card_config JSON DEFAULT '{}'",
            "leaderboard_reset_at": "ALTER TABLE leveling_configs ADD COLUMN leaderboard_reset_at TIMESTAMP",
            "voice_xp_enabled": "ALTER TABLE leveling_configs ADD COLUMN voice_xp_enabled BOOLEAN DEFAULT TRUE",
            "voice_xp_per_minute": "ALTER TABLE leveling_configs ADD COLUMN voice_xp_per_minute INTEGER DEFAULT 5",
            "voice_afk_timeout": "ALTER TABLE leveling_configs ADD COLUMN voice_afk_timeout INTEGER DEFAULT 5",
            "voice_solo_xp": "ALTER TABLE leveling_configs ADD COLUMN voice_solo_xp BOOLEAN DEFAULT FALSE",
            "voice_stream_bonus": "ALTER TABLE leveling_configs ADD COLUMN voice_stream_bonus FLOAT DEFAULT 1.5",
            "voice_camera_bonus": "ALTER TABLE leveling_configs ADD COLUMN voice_camera_bonus FLOAT DEFAULT 1.2",
            "voice_ignored_channels": "ALTER TABLE leveling_configs ADD COLUMN voice_ignored_channels JSON DEFAULT '[]'",
            "weekly_reset_day": "ALTER TABLE leveling_configs ADD COLUMN weekly_reset_day INTEGER DEFAULT 1",
        }.items():
            if col not in lvl:
                all_stmts.append(stmt)

        # member_xp
        mxp = cols("member_xp")
        if "rank_card_bg" not in mxp:
            all_stmts.append("ALTER TABLE member_xp ADD COLUMN rank_card_bg VARCHAR")
        for col, stmt in {
            "voice_xp": "ALTER TABLE member_xp ADD COLUMN voice_xp INTEGER DEFAULT 0",
            "voice_minutes": "ALTER TABLE member_xp ADD COLUMN voice_minutes INTEGER DEFAULT 0",
            "voice_streak_days": "ALTER TABLE member_xp ADD COLUMN voice_streak_days INTEGER DEFAULT 0",
            "voice_last_active": "ALTER TABLE member_xp ADD COLUMN voice_last_active TIMESTAMP",
            "weekly_xp": "ALTER TABLE member_xp ADD COLUMN weekly_xp INTEGER DEFAULT 0",
            "weekly_voice_minutes": "ALTER TABLE member_xp ADD COLUMN weekly_voice_minutes INTEGER DEFAULT 0",
            "weekly_messages": "ALTER TABLE member_xp ADD COLUMN weekly_messages INTEGER DEFAULT 0",
            "last_message_at": "ALTER TABLE member_xp ADD COLUMN last_message_at TIMESTAMP",
            "rep_score": "ALTER TABLE member_xp ADD COLUMN rep_score INTEGER DEFAULT 0",
            "rep_given": "ALTER TABLE member_xp ADD COLUMN rep_given INTEGER DEFAULT 0",
            "social_links": "ALTER TABLE member_xp ADD COLUMN social_links JSON DEFAULT '{}'",
        }.items():
            if col not in mxp:
                all_stmts.append(stmt)

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

        # ── Thực thi tất cả ALTER trong 1 transaction ──
        if all_stmts:
            with engine.begin() as connection:
                for stmt in all_stmts:
                    connection.execute(text(stmt))
