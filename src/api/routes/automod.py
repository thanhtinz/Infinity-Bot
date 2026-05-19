"""Auto Mod config routes."""
from fastapi import APIRouter, Depends
from sqlalchemy import select

from src.database.config import get_db
from src.api.deps import get_guild_id, require_staff_perm
from src.models.models import AutoModConfig

router = APIRouter(dependencies=[Depends(require_staff_perm("can_moderation"))])


AUTOMOD_FIELDS = [
    "anti_spam_enabled", "anti_spam_max_messages", "anti_spam_interval", "anti_spam_action",
    "anti_link_enabled", "anti_link_whitelist",
    "bad_words_enabled", "bad_words_list",
    "caps_lock_enabled", "caps_lock_min_length", "caps_lock_percentage",
    "mention_spam_enabled", "mention_spam_max", "mention_spam_action",
    "ignored_channels", "ignored_roles", "log_channel_id",
]


@router.get("/automod/config")
def get_automod_config(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cfg = db.execute(
        select(AutoModConfig).where(AutoModConfig.guild_id == guild_id)
    ).scalars().first()
    if not cfg:
        return {
            "anti_spam_enabled": False, "anti_spam_max_messages": 5,
            "anti_spam_interval": 5, "anti_spam_action": "warn",
            "anti_link_enabled": False, "anti_link_whitelist": [],
            "bad_words_enabled": False, "bad_words_list": [],
            "caps_lock_enabled": False, "caps_lock_min_length": 10, "caps_lock_percentage": 70,
            "mention_spam_enabled": False, "mention_spam_max": 5, "mention_spam_action": "warn",
            "ignored_channels": [], "ignored_roles": [], "log_channel_id": None,
        }
    return {f: getattr(cfg, f) for f in AUTOMOD_FIELDS}


@router.put("/automod/config")
def update_automod_config(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cfg = db.execute(
        select(AutoModConfig).where(AutoModConfig.guild_id == guild_id)
    ).scalars().first()
    if not cfg:
        cfg = AutoModConfig(guild_id=guild_id)
        db.add(cfg)

    for field in AUTOMOD_FIELDS:
        if field in body:
            setattr(cfg, field, body[field])
    db.commit()
    return {"ok": True}
