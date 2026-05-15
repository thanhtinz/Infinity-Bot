import os
import ssl
from typing import AsyncGenerator
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, sessionmaker

# Get DB config from Neon
# Workshop's DB injection standard: use standard env vars injected by workshop platform
DATABASE_URL = os.environ.get("DB8624B53A_DATABASE_URL")

# Try dropping asyncpg and using sync psycopg2 driver since asyncpg has bug
if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    pass # Use native postgresql driver

engine = None
async_session = None

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

        inspector = inspect(engine)
        existing_columns = {column["name"] for column in inspector.get_columns("system_config")}
        missing_columns = []

        if "discord_client_id" not in existing_columns:
            missing_columns.append("ALTER TABLE system_config ADD COLUMN discord_client_id VARCHAR")
        if "discord_client_secret" not in existing_columns:
            missing_columns.append("ALTER TABLE system_config ADD COLUMN discord_client_secret VARCHAR")
        if "public_app_url" not in existing_columns:
            missing_columns.append("ALTER TABLE system_config ADD COLUMN public_app_url VARCHAR")

        if missing_columns:
            with engine.begin() as connection:
                for statement in missing_columns:
                    connection.execute(text(statement))

        # Add response_mode + text_template to embed_templates if missing
        if inspector.has_table("embed_templates"):
            embed_cols = {c["name"] for c in inspector.get_columns("embed_templates")}
            alter_stmts = []
            if "response_mode" not in embed_cols:
                alter_stmts.append("ALTER TABLE embed_templates ADD COLUMN response_mode VARCHAR DEFAULT 'embed'")
            if "text_template" not in embed_cols:
                alter_stmts.append("ALTER TABLE embed_templates ADD COLUMN text_template TEXT")
            if alter_stmts:
                with engine.begin() as connection:
                    for stmt in alter_stmts:
                        connection.execute(text(stmt))

        # Add voice_buttons to temp_voice_config if missing
        if inspector.has_table("temp_voice_config"):
            tv_cols = {c["name"] for c in inspector.get_columns("temp_voice_config")}
            tv_stmts = []
            if "voice_buttons" not in tv_cols:
                tv_stmts.append("ALTER TABLE temp_voice_config ADD COLUMN voice_buttons JSON DEFAULT '[]'")
            if tv_stmts:
                with engine.begin() as connection:
                    for stmt in tv_stmts:
                        connection.execute(text(stmt))


        # Add panel refs to temp_voice_rooms if missing

        # Add newer ticket message columns if existing installs are missing them
        if inspector.has_table("ticket_configs"):
            tc_cols = {c["name"] for c in inspector.get_columns("ticket_configs")}
            tc_stmts = []
            for col, stmt in {
                "open_message_title": "ALTER TABLE ticket_configs ADD COLUMN open_message_title VARCHAR",
                "open_message_body": "ALTER TABLE ticket_configs ADD COLUMN open_message_body TEXT",
                "close_message_title": "ALTER TABLE ticket_configs ADD COLUMN close_message_title VARCHAR",
                "close_message_body": "ALTER TABLE ticket_configs ADD COLUMN close_message_body TEXT",
                "claim_message_title": "ALTER TABLE ticket_configs ADD COLUMN claim_message_title VARCHAR",
                "claim_message_body": "ALTER TABLE ticket_configs ADD COLUMN claim_message_body TEXT",
            }.items():
                if col not in tc_cols:
                    tc_stmts.append(stmt)
            if tc_stmts:
                with engine.begin() as connection:
                    for stmt in tc_stmts:
                        connection.execute(text(stmt))

        if inspector.has_table("ticket_panels"):
            tp_cols = {c["name"] for c in inspector.get_columns("ticket_panels")}
            tp_stmts = []
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
                if col not in tp_cols:
                    tp_stmts.append(stmt)
            if tp_stmts:
                with engine.begin() as connection:
                    for stmt in tp_stmts:
                        connection.execute(text(stmt))

        if inspector.has_table("temp_voice_rooms"):
            tvr_cols = {c["name"] for c in inspector.get_columns("temp_voice_rooms")}
            tvr_stmts = []
            if "panel_channel_id" not in tvr_cols:
                tvr_stmts.append("ALTER TABLE temp_voice_rooms ADD COLUMN panel_channel_id VARCHAR")
            if "panel_message_id" not in tvr_cols:
                tvr_stmts.append("ALTER TABLE temp_voice_rooms ADD COLUMN panel_message_id VARCHAR")
            if tvr_stmts:
                with engine.begin() as connection:
                    for stmt in tvr_stmts:
                        connection.execute(text(stmt))

        # Add newer leveling columns if existing installs are missing them
        if inspector.has_table("leveling_configs"):
            lvl_cols = {c["name"] for c in inspector.get_columns("leveling_configs")}
            lvl_stmts = []
            for col, stmt in {
                "gain_xp_from_commands": "ALTER TABLE leveling_configs ADD COLUMN gain_xp_from_commands BOOLEAN DEFAULT FALSE",
                "remove_old_reward_roles": "ALTER TABLE leveling_configs ADD COLUMN remove_old_reward_roles BOOLEAN DEFAULT FALSE",
                "stack_reward_roles": "ALTER TABLE leveling_configs ADD COLUMN stack_reward_roles BOOLEAN DEFAULT TRUE",
                "rank_card_config": "ALTER TABLE leveling_configs ADD COLUMN rank_card_config JSON DEFAULT '{}'",
            }.items():
                if col not in lvl_cols:
                    lvl_stmts.append(stmt)
            if lvl_stmts:
                with engine.begin() as connection:
                    for stmt in lvl_stmts:
                        connection.execute(text(stmt))

        # Add rank_card_bg to member_xp if missing
        if inspector.has_table("member_xp"):
            mxp_cols = {c["name"] for c in inspector.get_columns("member_xp")}
            if "rank_card_bg" not in mxp_cols:
                with engine.begin() as connection:
                    connection.execute(text("ALTER TABLE member_xp ADD COLUMN rank_card_bg VARCHAR"))

        if inspector.has_table("custom_commands"):
            cc_cols = {c["name"] for c in inspector.get_columns("custom_commands")}
            cc_stmts = []
            if "aliases" not in cc_cols:
                cc_stmts.append("ALTER TABLE custom_commands ADD COLUMN aliases JSON DEFAULT '[]'")
            if "cooldown" not in cc_cols:
                cc_stmts.append("ALTER TABLE custom_commands ADD COLUMN cooldown INTEGER DEFAULT 0")
            if "allowed_channels" not in cc_cols:
                cc_stmts.append("ALTER TABLE custom_commands ADD COLUMN allowed_channels JSON DEFAULT '[]'")
            if "delete_trigger" not in cc_cols:
                cc_stmts.append("ALTER TABLE custom_commands ADD COLUMN delete_trigger BOOLEAN DEFAULT FALSE")
            if "auto_react" not in cc_cols:
                cc_stmts.append("ALTER TABLE custom_commands ADD COLUMN auto_react VARCHAR")
            if cc_stmts:
                with engine.begin() as connection:
                    for stmt in cc_stmts:
                        connection.execute(text(stmt))

        # custom_embed_messages: thêm các cột Discohook-style
        if inspector.has_table("custom_embed_messages"):
            cem_cols = {c["name"] for c in inspector.get_columns("custom_embed_messages")}
            cem_stmts = []
            if "content" not in cem_cols:
                cem_stmts.append("ALTER TABLE custom_embed_messages ADD COLUMN content TEXT")
            if "webhook_username" not in cem_cols:
                cem_stmts.append("ALTER TABLE custom_embed_messages ADD COLUMN webhook_username VARCHAR")
            if "webhook_avatar_url" not in cem_cols:
                cem_stmts.append("ALTER TABLE custom_embed_messages ADD COLUMN webhook_avatar_url VARCHAR")
            if "thread_name" not in cem_cols:
                cem_stmts.append("ALTER TABLE custom_embed_messages ADD COLUMN thread_name VARCHAR")
            if "embeds" not in cem_cols:
                cem_stmts.append("ALTER TABLE custom_embed_messages ADD COLUMN embeds JSON DEFAULT '[]'")
            if "components" not in cem_cols:
                cem_stmts.append("ALTER TABLE custom_embed_messages ADD COLUMN components JSON DEFAULT '[]'")
            if "flags" not in cem_cols:
                cem_stmts.append("ALTER TABLE custom_embed_messages ADD COLUMN flags JSON DEFAULT '{}'")
            if "allowed_mentions" not in cem_cols:
                cem_stmts.append("ALTER TABLE custom_embed_messages ADD COLUMN allowed_mentions JSON DEFAULT '{}'")
            if cem_stmts:
                with engine.begin() as connection:
                    for stmt in cem_stmts:
                        connection.execute(text(stmt))
