"""
feature_utils.py — Check if a feature is enabled for the guild.

Usage in cogs:
    from src.bot.feature_utils import feature_enabled

    # In a command:
    if not feature_enabled("shop", session, guild_id):
        return await ctx.respond("❌ Tính năng này đã bị tắt.", ephemeral=True)

    # Or as a cog_check in __init__:
    async def cog_check(self, ctx):
        return feature_enabled_sync(self.feature_key, str(ctx.guild.id))
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database.config import SessionLocal
from src.models.models import FeatureToggle, SystemConfig

# In-memory cache to avoid DB hits on every command
_cache: dict[str, bool] = {}
_cache_ts: float = 0
_CACHE_TTL = 30  # seconds


def _load_cache():
    """Load all feature toggles into memory."""
    import time
    global _cache, _cache_ts
    session = SessionLocal()
    try:
        config = session.execute(select(SystemConfig).limit(1)).scalars().first()
        guild_id = config.guild_id if config else "0"
        toggles = session.execute(
            select(FeatureToggle).where(FeatureToggle.guild_id == guild_id)
        ).scalars().all()
        _cache = {t.feature_key: t.enabled for t in toggles}
        _cache_ts = time.time()
    finally:
        session.close()


def feature_enabled(feature_key: str) -> bool:
    """Check if a feature is enabled. Returns True by default (not configured = on)."""
    import time
    if time.time() - _cache_ts > _CACHE_TTL:
        _load_cache()
    return _cache.get(feature_key, True)


def invalidate_cache():
    """Force cache refresh on next check (call after PUT /features)."""
    global _cache_ts
    _cache_ts = 0
