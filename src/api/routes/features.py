"""Feature toggles API — enable/disable features for guild."""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.models.models import FeatureToggle
from src.api.deps import get_guild_id

router = APIRouter()

# ── Feature definitions ──────────────────────────────────────────────────────
# key → (label, description, cog_names)
# cog_names: bot cogs to load/unload when toggled
FEATURE_DEFS: list[dict] = [
    {"key": "shop",            "label": "Shop",                "desc": "Products, orders, coupons, feedback, leaderboard", "icon": "ShoppingBag",   "cogs": ["ShopCog", "AdminShopCog"]},
    {"key": "giveaway",        "label": "Giveaway",            "desc": "Create and manage giveaways",               "icon": "Gift",          "cogs": ["GiveawayCog"]},
    {"key": "invite_tracking", "label": "Invite Tracking",     "desc": "Track invites, invite leaderboard",         "icon": "Link2",         "cogs": ["InviteTrackingCog"]},
    {"key": "moderation",      "label": "Moderation",          "desc": "Ban, kick, warn, automod, logging",         "icon": "Shield",        "cogs": ["ModerationCog", "AutoModCog", "LoggingCog"]},
    {"key": "sticky",          "label": "Sticky Message",      "desc": "Auto-pinned sticky messages",               "icon": "Pin",           "cogs": ["StickyCog"]},
    {"key": "utility",         "label": "Utility",             "desc": "Avatar, serverinfo, poll, QR, AFK",         "icon": "Wrench",        "cogs": ["UtilityCog", "AFKCog"]},
    {"key": "custom_commands", "label": "Custom Commands",     "desc": "Create custom commands",                    "icon": "Terminal",      "cogs": ["CustomCommandsCog"]},
    {"key": "autoresponder",  "label": "Auto Responder",      "desc": "Auto-reply based on keywords",              "icon": "MessageCircleReply", "cogs": ["AutoResponderCog"]},
    {"key": "scheduler",       "label": "Scheduled Messages",  "desc": "Send messages on a schedule",               "icon": "Clock",         "cogs": ["SchedulerCog"]},
    {"key": "interactions",    "label": "Interactions",        "desc": "Anime GIF interaction commands (hug, kiss, slap…)", "icon": "Heart",   "cogs": ["InteractionCog"]},
    {"key": "fun",             "label": "Fun",                 "desc": "Fun & mini-game commands",                  "icon": "Smile",         "cogs": ["FunCog"]},
]


class FeatureUpdate(BaseModel):
    features: dict[str, bool]  # key → enabled


@router.get("/features")
def get_features(db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    toggles = db.execute(
        select(FeatureToggle).where(FeatureToggle.guild_id == guild_id)
    ).scalars().all()
    toggle_map = {t.feature_key: t.enabled for t in toggles}

    result = []
    for fd in FEATURE_DEFS:
        result.append({
            **fd,
            "enabled": toggle_map.get(fd["key"], True),  # default ON
        })
    return result


@router.put("/features")
def update_features(body: FeatureUpdate, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    for key, enabled in body.features.items():
        toggle = db.execute(
            select(FeatureToggle).where(
                FeatureToggle.guild_id == guild_id,
                FeatureToggle.feature_key == key,
            )
        ).scalars().first()
        if toggle:
            toggle.enabled = enabled
        else:
            db.add(FeatureToggle(guild_id=guild_id, feature_key=key, enabled=enabled))
    db.commit()

    # Invalidate bot-side cache
    try:
        from src.bot.feature_utils import invalidate_cache
        invalidate_cache()
    except Exception:
        pass

    # Return updated state
    return get_features(db)
