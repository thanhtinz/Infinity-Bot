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
