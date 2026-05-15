"""Feature toggles API — enable/disable features for guild."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.models.models import FeatureToggle, SystemConfig

router = APIRouter()

# ── Feature definitions ──────────────────────────────────────────────────────
# key → (label, description, cog_names)
# cog_names: bot cogs to load/unload when toggled
FEATURE_DEFS: list[dict] = [
    {"key": "shop",            "label": "Shop",                "desc": "Sản phẩm, đơn hàng, coupon, feedback, BXH", "icon": "ShoppingBag",   "cogs": ["ShopCog", "AdminShopCog"]},
    {"key": "ticket",          "label": "Ticket",              "desc": "Hệ thống ticket hỗ trợ",                    "icon": "Ticket",        "cogs": ["TicketCog"]},
    {"key": "giveaway",        "label": "Giveaway",            "desc": "Tạo và quản lý giveaway",                   "icon": "Gift",          "cogs": ["GiveawayCog"]},
    {"key": "invite_tracking", "label": "Invite Tracking",     "desc": "Theo dõi invite, BXH mời",                  "icon": "Link2",         "cogs": ["InviteTrackingCog"]},
    {"key": "leveling",        "label": "Leveling",            "desc": "XP, rank, leaderboard, role rewards",        "icon": "Trophy",        "cogs": ["LevelingCog"]},
    {"key": "moderation",      "label": "Kiểm duyệt",         "desc": "Ban, kick, warn, automod, logging",          "icon": "Shield",        "cogs": ["ModerationCog", "AutoModCog", "LoggingCog"]},
    {"key": "welcome",         "label": "Chào mừng & Roles",   "desc": "Welcome/goodbye, auto role, button/select/reaction roles", "icon": "Hand", "cogs": ["WelcomeCog", "RolesCog", "ReactionRolesCog"]},
    {"key": "starboard",       "label": "Starboard",           "desc": "Ghim tin nhắn nhiều reaction",               "icon": "Star",          "cogs": ["StarboardCog"]},
    {"key": "temp_voice",      "label": "Temp Voice",          "desc": "Phòng voice tạm thời",                       "icon": "Mic",           "cogs": ["TempVoiceCog"]},
    {"key": "sticky",          "label": "Sticky Message",      "desc": "Ghim tin nhắn tự động",                      "icon": "Pin",           "cogs": ["StickyCog"]},
    {"key": "utility",         "label": "Tiện ích",            "desc": "Avatar, serverinfo, poll, QR, AFK",          "icon": "Wrench",        "cogs": ["UtilityCog", "AFKCog"]},
    {"key": "custom_commands", "label": "Custom Commands",     "desc": "Tạo lệnh tùy chỉnh",                        "icon": "Terminal",      "cogs": ["CustomCommandsCog"]},
    {"key": "autoresponder",  "label": "Auto Responder",      "desc": "Tự động trả lời theo keyword",               "icon": "MessageCircleReply", "cogs": ["AutoResponderCog"]},
    {"key": "scheduler",       "label": "Tin nhắn hẹn giờ",   "desc": "Gửi tin nhắn theo lịch",                     "icon": "Clock",         "cogs": ["SchedulerCog"]},
    {"key": "interactions",    "label": "Tương tác",          "desc": "Lệnh tương tác anime GIF (hug, kiss, slap…)",  "icon": "Heart",             "cogs": ["InteractionCog"]},
]


class FeatureUpdate(BaseModel):
    features: dict[str, bool]  # key → enabled


@router.get("/features")
def get_features(db: Session = Depends(get_db)):
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    guild_id = config.guild_id if config else "0"

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
def update_features(body: FeatureUpdate, db: Session = Depends(get_db)):
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    guild_id = config.guild_id if config else "0"

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
