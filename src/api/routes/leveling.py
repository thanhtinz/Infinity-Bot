"""Leveling API — config, leaderboard, rewards, multipliers."""
import os
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.api.deps import get_guild_id
from src.models.models import LevelingConfig, MemberXP, LevelReward, LevelMultiplier
from src.bot.rank_card import demo_rank_card, make_rank_card

router = APIRouter()

RANK_CARD_BG_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "static", "uploads")


def _get_or_create_config(db: Session, guild_id: str) -> LevelingConfig:
    cfg = db.execute(select(LevelingConfig).where(LevelingConfig.guild_id == guild_id)).scalars().first()
    if not cfg:
        cfg = LevelingConfig(guild_id=guild_id)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def _cfg_dict(cfg: LevelingConfig) -> dict:
    return {
        "enabled": cfg.enabled,
        "xp_min": cfg.xp_min,
        "xp_max": cfg.xp_max,
        "cooldown_seconds": cfg.cooldown_seconds,
        "level_formula": cfg.level_formula,
        "level_up_channel_id": cfg.level_up_channel_id,
        "level_up_mode": cfg.level_up_mode,
        "ignored_channels": cfg.ignored_channels or [],
        "ignored_roles": cfg.ignored_roles or [],
        "ignored_users": cfg.ignored_users or [],
        "whitelist_channels": cfg.whitelist_channels or [],
        "use_channel_whitelist": cfg.use_channel_whitelist,
        "gain_xp_from_commands": cfg.gain_xp_from_commands,
        "remove_old_reward_roles": cfg.remove_old_reward_roles,
        "stack_reward_roles": cfg.stack_reward_roles,
        "rank_card_config": cfg.rank_card_config or {},
    }


def _rank_card_settings(cfg: LevelingConfig | None) -> dict:
    base = {
        "accent": "#7C8CFF",
        "secondary_accent": "#7AF4D3",
        "background": "aurora",
        "panel_style": "glass",
        "progress_style": "gradient",
        "avatar_shape": "circle",
        "card_radius": 36,
        "panel_opacity": 34,
        "glow_strength": 1.0,
        "avatar_size": 178,
        "show_avatar_ring": True,
        "show_progress_bar": True,
        "show_username": True,
        "show_server": True,
        "show_total_xp": True,
        "show_percent": True,
        "show_rank": True,
        "show_level": True,
        "rank_label": "Rank",
        "level_label": "Level",
        "xp_label": "XP",
        "layout_config": {},
        "username": "lunar.dev",
        "display_name": "Lunar Architect",
        "server": "Infinity Mall",
        "custom_bg_url": None,
    }
    if cfg and isinstance(cfg.rank_card_config, dict):
        base.update(cfg.rank_card_config)
    # Resolve custom_bg_path — prefer active_bg_slug, fallback to legacy single file
    guild_id = cfg.guild_id if cfg else "0"
    active_slug = (cfg.rank_card_config or {}).get("active_bg_slug") if cfg else None
    if active_slug:
        candidate = os.path.join(RANK_CARD_BG_DIR, f"{active_slug}.png")
    else:
        candidate = os.path.join(RANK_CARD_BG_DIR, f"rank_bg_{guild_id}.png")
    if candidate and os.path.exists(candidate):
        slug_name = active_slug or f"rank_bg_{guild_id}"
        base["custom_bg_path"] = candidate
        base["custom_bg_url"] = f"/static/uploads/{slug_name}.png"
    else:
        base["custom_bg_path"] = None
        base["custom_bg_url"] = None
    return base


class RankCardConfigIn(BaseModel):
    accent: str = "#7C8CFF"
    secondary_accent: str = "#7AF4D3"
    background: str = "aurora"
    panel_style: str = "glass"
    progress_style: str = "gradient"
    avatar_shape: str = "circle"
    card_radius: int = 36
    panel_opacity: int = 34
    glow_strength: float = 1.0
    avatar_size: int = 178
    show_avatar_ring: bool = True
    show_progress_bar: bool = True
    show_username: bool = True
    show_server: bool = True
    show_total_xp: bool = True
    show_percent: bool = True
    show_rank: bool = True
    show_level: bool = True
    rank_label: str = "Rank"
    level_label: str = "Level"
    xp_label: str = "XP"
    layout_config: dict = {}
    username: str = "lunar.dev"
class RankCardConfigIn(BaseModel):
    accent: str = "#7C8CFF"
    secondary_accent: str = "#7AF4D3"
    background: str = "aurora"
    panel_style: str = "glass"
    progress_style: str = "gradient"
    avatar_shape: str = "circle"
    card_radius: int = 36
    panel_opacity: int = 34
    glow_strength: float = 1.0
    avatar_size: int = 178
    show_avatar_ring: bool = True
    show_progress_bar: bool = True
    show_username: bool = True
    show_server: bool = True
    show_total_xp: bool = True
    show_percent: bool = True
    show_rank: bool = True
    show_level: bool = True
    rank_label: str = "Rank"
    level_label: str = "Level"
    xp_label: str = "XP"
    layout_config: dict = {}
    username: str = "lunar.dev"
    display_name: str = "Lunar Architect"
    server: str = "Infinity Mall"


class RewardIn(BaseModel):
    level: int
    role_id: str
    role_name: str | None = None
    remove_on_higher: bool = False
    dm_user: bool = False


class MultiplierIn(BaseModel):
    type: str
    target_id: str | None = None
    target_name: str | None = None
    multiplier: float = 1.0
    priority: int = 0
    enabled: bool = True


@router.get("/leveling/config")
def get_leveling_config(db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    return _cfg_dict(_get_or_create_config(db, guild_id))


@router.put("/leveling/config")
def update_leveling_config(body: dict, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cfg = _get_or_create_config(db, guild_id)
    for key in _cfg_dict(cfg).keys():
        if key in body:
            setattr(cfg, key, body[key])
    if (cfg.xp_min or 0) > (cfg.xp_max or 0):
        cfg.xp_min, cfg.xp_max = cfg.xp_max, cfg.xp_min
    db.commit()
    db.refresh(cfg)
    return _cfg_dict(cfg)


def _xp_for_level(level: int) -> int:
    return max(0, 100 * level * level)


def _progress_for(xp: int, level: int) -> tuple[int, int, int]:
    current = _xp_for_level(level)
    nxt = _xp_for_level(level + 1)
    gained = max(0, xp - current)
    needed = max(1, nxt - current)
    return gained, needed, int((gained / needed) * 100)


@router.get("/leveling/rank-card/config")
def get_rank_card_config(db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    return _rank_card_settings(_get_or_create_config(db, guild_id))


@router.put("/leveling/rank-card/config")
def update_rank_card_config(body: RankCardConfigIn, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cfg = _get_or_create_config(db, guild_id)
    current = cfg.rank_card_config if isinstance(cfg.rank_card_config, dict) else {}
    saved = {
        "accent": body.accent,
        "secondary_accent": body.secondary_accent,
        "background": body.background,
        "panel_style": body.panel_style,
        "progress_style": body.progress_style,
        "avatar_shape": body.avatar_shape,
        "card_radius": body.card_radius,
        "panel_opacity": body.panel_opacity,
        "glow_strength": body.glow_strength,
        "avatar_size": body.avatar_size,
        "show_avatar_ring": body.show_avatar_ring,
        "show_progress_bar": body.show_progress_bar,
        "show_username": body.show_username,
        "show_server": body.show_server,
        "show_total_xp": body.show_total_xp,
        "show_percent": body.show_percent,
        "show_rank": body.show_rank,
        "show_level": body.show_level,
        "rank_label": body.rank_label,
        "level_label": body.level_label,
        "xp_label": body.xp_label,
        "layout_config": body.layout_config or current.get("layout_config", {}),
        "username": body.username,
        "display_name": body.display_name,
        "server": body.server,
    }
    cfg.rank_card_config = saved
    db.commit()
    return _rank_card_settings(cfg)


@router.post("/leveling/rank-card/background")
async def upload_rank_card_background(file: UploadFile = File(...), db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Upload a custom background image — stores as next available slot."""
    allowed = {"image/png", "image/jpeg", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(400, "File phải là ảnh PNG, JPEG, WebP hoặc GIF.")
    os.makedirs(RANK_CARD_BG_DIR, exist_ok=True)
    # Find next available index
    idx = 1
    while os.path.exists(os.path.join(RANK_CARD_BG_DIR, f"rank_bg_{guild_id}_{idx}.png")):
        idx += 1
    bg_path = os.path.join(RANK_CARD_BG_DIR, f"rank_bg_{guild_id}_{idx}.png")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "File quá lớn (tối đa 10MB).")
    try:
        from PIL import Image as PILImage
        from io import BytesIO as PILBytesIO
        img = PILImage.open(PILBytesIO(content)).convert("RGBA")
        img.save(bg_path, format="PNG")
    except Exception:
        raise HTTPException(400, "Không thể xử lý file ảnh.")
    slug = f"rank_bg_{guild_id}_{idx}"
    return {"ok": True, "slug": slug, "url": f"/static/uploads/{slug}.png", "index": idx}


@router.get("/leveling/rank-card/backgrounds")
def list_rank_card_backgrounds(db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """List all uploaded backgrounds for this guild."""
    os.makedirs(RANK_CARD_BG_DIR, exist_ok=True)
    items = []
    idx = 1
    while True:
        slug = f"rank_bg_{guild_id}_{idx}"
        path = os.path.join(RANK_CARD_BG_DIR, f"{slug}.png")
        if not os.path.exists(path):
            break
        items.append({"slug": slug, "url": f"/static/uploads/{slug}.png", "index": idx})
        idx += 1
    # Also include legacy single-bg if exists
    legacy = os.path.join(RANK_CARD_BG_DIR, f"rank_bg_{guild_id}.png")
    if os.path.exists(legacy):
        items.insert(0, {"slug": f"rank_bg_{guild_id}", "url": f"/static/uploads/rank_bg_{guild_id}.png", "index": 0})
    cfg = _get_or_create_config(db, guild_id)
    active_slug = (cfg.rank_card_config or {}).get("active_bg_slug")
    return {"backgrounds": items, "active_slug": active_slug}


@router.delete("/leveling/rank-card/background/{slug}")
def delete_rank_card_background(slug: str, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Remove a specific background by slug."""
    # Safety: slug must belong to this guild
    if not slug.startswith(f"rank_bg_{guild_id}"):
        raise HTTPException(403, "Không có quyền xóa file này.")
    path = os.path.join(RANK_CARD_BG_DIR, f"{slug}.png")
    if os.path.exists(path):
        os.remove(path)
    # Clear active if it was this slug
    cfg = _get_or_create_config(db, guild_id)
    saved = dict(cfg.rank_card_config or {})
    if saved.get("active_bg_slug") == slug:
        saved.pop("active_bg_slug", None)
        cfg.rank_card_config = saved
        db.commit()
    return {"ok": True}


@router.put("/leveling/rank-card/background/active")
def set_active_background(body: dict, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Set which uploaded background is active (used for rank cards)."""
    slug = body.get("slug", "")
    cfg = _get_or_create_config(db, guild_id)
    saved = dict(cfg.rank_card_config or {})
    if slug:
        saved["active_bg_slug"] = slug
    else:
        saved.pop("active_bg_slug", None)
    cfg.rank_card_config = saved
    db.commit()
    return {"ok": True, "active_slug": slug or None}


@router.delete("/leveling/rank-card/background")
def delete_rank_card_background_legacy(db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Remove legacy single background image."""
    bg_path = os.path.join(RANK_CARD_BG_DIR, f"rank_bg_{guild_id}.png")
    if os.path.exists(bg_path):
        os.remove(bg_path)
    return {"ok": True}


@router.get("/leveling/rank-card/preview")
def preview_rank_card_get(db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    settings = _rank_card_settings(_get_or_create_config(db, guild_id))
    custom_bg = settings.pop("custom_bg_path", None)
    settings.pop("custom_bg_url", None)
    settings["layout_config"] = {}   # always use fixed layout
    card = demo_rank_card(custom_bg_path=custom_bg, **settings)
    return Response(content=card.getvalue(), media_type="image/png")


@router.post("/leveling/rank-card/preview")
def preview_rank_card_post(body: RankCardConfigIn, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Render preview with given config (for live sync in dashboard)."""
    cfg = _get_or_create_config(db, guild_id)
    db_settings = _rank_card_settings(cfg)
    custom_bg = db_settings.get("custom_bg_path")
    d = body.model_dump()
    d.pop("custom_bg_url", None)
    d.pop("custom_bg_path", None)
    d["layout_config"] = {}   # always use fixed layout for preview
    card = demo_rank_card(custom_bg_path=custom_bg, **d)
    return Response(content=card.getvalue(), media_type="image/png")


@router.get("/leveling/rank-card/{discord_id}")
def member_rank_card(discord_id: str, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    row = db.execute(select(MemberXP).where(MemberXP.guild_id == guild_id, MemberXP.discord_id == discord_id)).scalars().first()
    if not row:
        raise HTTPException(404, "Member XP not found")
    higher = db.execute(select(func.count()).select_from(MemberXP).where(MemberXP.guild_id == guild_id, MemberXP.xp > (row.xp or 0))).scalar() or 0
    gained, needed, percent = _progress_for(row.xp or 0, row.level or 0)
    settings = _rank_card_settings(_get_or_create_config(db, guild_id))
    custom_bg = settings.pop("custom_bg_path", None)
    settings.pop("custom_bg_url", None)
    card = make_rank_card(
        username=row.username or row.discord_id,
        display_name=row.username or row.discord_id,
        level=row.level or 0,
        rank=higher + 1,
        xp=row.xp or 0,
        progress=gained,
        needed=needed,
        percent=percent,
        custom_bg_path=custom_bg,
        **settings,
    )
    return Response(content=card.getvalue(), media_type="image/png")


@router.get("/leveling/leaderboard")
def get_leaderboard(page: int = 1, limit: int = 50, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cfg = _get_or_create_config(db, guild_id)
    page = max(1, page)
    limit = min(max(1, limit), 100)
    base_where = [MemberXP.guild_id == guild_id]
    if cfg.leaderboard_reset_at:
        base_where.append(MemberXP.updated_at >= cfg.leaderboard_reset_at)
    total = db.execute(select(func.count()).select_from(MemberXP).where(*base_where)).scalar() or 0
    rows = db.execute(
        select(MemberXP)
        .where(*base_where)
        .order_by(MemberXP.xp.desc(), MemberXP.level.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    ).scalars().all()
    return {
        "page": page,
        "limit": limit,
        "total": total,
        "reset_at": cfg.leaderboard_reset_at.isoformat() if cfg.leaderboard_reset_at else None,
        "items": [
            {
                "rank": (page - 1) * limit + idx + 1,
                "discord_id": row.discord_id,
                "username": row.username,
                "xp": row.xp or 0,
                "level": row.level or 0,
                "message_count": row.message_count or 0,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            }
            for idx, row in enumerate(rows)
        ],
    }


@router.put("/leveling/member/{discord_id}")
def update_member(discord_id: str, body: dict, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    row = db.execute(select(MemberXP).where(MemberXP.guild_id == guild_id, MemberXP.discord_id == discord_id)).scalars().first()
    if not row:
        row = MemberXP(guild_id=guild_id, discord_id=discord_id)
        db.add(row)
    if "xp" in body:
        row.xp = max(0, int(body["xp"]))
    if "level" in body:
        row.level = max(0, int(body["level"]))
    if "username" in body:
        row.username = body["username"]
    db.commit()
    return {"ok": True}


@router.delete("/leveling/member/{discord_id}")
def reset_member(discord_id: str, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    row = db.execute(select(MemberXP).where(MemberXP.guild_id == guild_id, MemberXP.discord_id == discord_id)).scalars().first()
    if row:
        db.delete(row)
        db.commit()
    return {"ok": True}


@router.post("/leveling/leaderboard/reset")
def reset_leaderboard(db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Đặt mốc reset — leaderboard chỉ tính XP tích lũy sau thời điểm này."""
    import datetime
    cfg = _get_or_create_config(db, guild_id)
    cfg.leaderboard_reset_at = datetime.datetime.utcnow()
    db.commit()
    return {"ok": True, "reset_at": cfg.leaderboard_reset_at.isoformat()}


@router.get("/leveling/rewards")
def list_rewards(db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rows = db.execute(select(LevelReward).where(LevelReward.guild_id == guild_id).order_by(LevelReward.level)).scalars().all()
    return [r.__dict__ | {"_sa_instance_state": None} for r in rows]


@router.post("/leveling/rewards")
def create_reward(body: RewardIn, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    row = LevelReward(guild_id=guild_id, **body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id}


@router.put("/leveling/rewards/{reward_id}")
def update_reward(reward_id: int, body: RewardIn, db: Session = Depends(get_db)):
    row = db.get(LevelReward, reward_id)
    if not row:
        raise HTTPException(404, "Reward not found")
    for k, v in body.model_dump().items():
        setattr(row, k, v)
    db.commit()
    return {"ok": True}


@router.delete("/leveling/rewards/{reward_id}")
def delete_reward(reward_id: int, db: Session = Depends(get_db)):
    row = db.get(LevelReward, reward_id)
    if row:
        db.delete(row)
        db.commit()
    return {"ok": True}


@router.get("/leveling/multipliers")
def list_multipliers(db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rows = db.execute(select(LevelMultiplier).where(LevelMultiplier.guild_id == guild_id).order_by(LevelMultiplier.type, LevelMultiplier.priority.desc())).scalars().all()
    return [r.__dict__ | {"_sa_instance_state": None} for r in rows]


@router.post("/leveling/multipliers")
def create_multiplier(body: MultiplierIn, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    if body.type not in {"global", "channel", "role"}:
        raise HTTPException(400, "Invalid multiplier type")
    row = LevelMultiplier(guild_id=guild_id, **body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id}


@router.put("/leveling/multipliers/{multiplier_id}")
def update_multiplier(multiplier_id: int, body: MultiplierIn, db: Session = Depends(get_db)):
    row = db.get(LevelMultiplier, multiplier_id)
    if not row:
        raise HTTPException(404, "Multiplier not found")
    for k, v in body.model_dump().items():
        setattr(row, k, v)
    db.commit()
    return {"ok": True}


@router.delete("/leveling/multipliers/{multiplier_id}")
def delete_multiplier(multiplier_id: int, db: Session = Depends(get_db)):
    row = db.get(LevelMultiplier, multiplier_id)
    if row:
        db.delete(row)
        db.commit()
    return {"ok": True}
