"""Social Feeds API routes."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.models.models import SocialFeed
from src.api.deps import get_guild_id, require_staff_perm

router = APIRouter(prefix="/social-feeds", tags=["social_feeds"], dependencies=[Depends(require_staff_perm("can_utilities"))])


class FeedCreate(BaseModel):
    platform: str
    feed_url: str
    discord_channel_id: str
    custom_message: str | None = None


class FeedUpdate(BaseModel):
    feed_url: str | None = None
    discord_channel_id: str | None = None
    custom_message: str | None = None
    enabled: bool | None = None


@router.get("")
def list_feeds(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    rows = db.execute(
        select(SocialFeed).where(SocialFeed.guild_id == guild_id).order_by(SocialFeed.created_at.desc())
    ).scalars().all()
    return [
        {"id": f.id, "platform": f.platform, "feed_url": f.feed_url,
         "discord_channel_id": f.discord_channel_id, "custom_message": f.custom_message,
         "enabled": f.enabled, "last_checked": f.last_checked.isoformat() if f.last_checked else None,
         "created_at": f.created_at.isoformat() if f.created_at else None}
        for f in rows
    ]


@router.post("")
def create_feed(body: FeedCreate, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    f = SocialFeed(guild_id=guild_id, **body.model_dump())
    db.add(f)
    db.commit()
    db.refresh(f)
    return {"id": f.id, "status": "created"}


@router.patch("/{fid}")
def update_feed(fid: int, body: FeedUpdate, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    f = db.execute(select(SocialFeed).where(SocialFeed.id == fid, SocialFeed.guild_id == guild_id)).scalars().first()
    if not f:
        return {"error": "not found"}
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(f, k, v)
    db.commit()
    return {"status": "updated"}


@router.delete("/{fid}")
def delete_feed(fid: int, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    f = db.execute(select(SocialFeed).where(SocialFeed.id == fid, SocialFeed.guild_id == guild_id)).scalars().first()
    if f:
        db.delete(f)
        db.commit()
    return {"status": "deleted"}
