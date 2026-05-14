import os
import ssl
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

async def inject_secrets():
    DATABASE_URL = os.environ.get("DB8624B53A_DATABASE_URL")
    if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
        
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        connect_args={"ssl": ssl_context, "channel_binding": ""} # Fix for sqlalchemy channel_binding bug
    )

    async_session = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        # Check if table exists
        try:
            await session.execute(text("""
                INSERT INTO system_config (id, discord_token)
                VALUES (1, 'None')
                ON CONFLICT (id) DO NOTHING;
            """))
            await session.commit()
            print("Ensured system_config row 1 exists")
        except Exception as e:
            print(f"Error (maybe table not created yet): {e}")

asyncio.run(inject_secrets())
