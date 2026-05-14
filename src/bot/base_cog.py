"""Base cog with feature toggle support for event listeners."""
from src.bot.feature_utils import feature_enabled


def check_feature(cog) -> bool:
    """Quick check if the cog's feature is enabled. Use at top of listeners:
    
        if not check_feature(self):
            return
    """
    key = getattr(cog, "feature_key", None)
    if key is None:
        return True
    return feature_enabled(key)
