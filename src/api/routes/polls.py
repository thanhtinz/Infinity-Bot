"""Polls API routes."""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.models.models import Poll, PollVote
from src.api.deps import get_guild_id, require_staff_perm

router = APIRouter(prefix="/polls", tags=["polls"], dependencies=[Depends(require_staff_perm("can_community"))])


@router.get("")
def list_polls(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Poll).where(Poll.guild_id == guild_id).order_by(Poll.created_at.desc()).limit(50)
    ).scalars().all()
    result = []
    for p in rows:
        vote_counts = {}
        votes = db.execute(
            select(PollVote.option_index, func.count(PollVote.id))
            .where(PollVote.poll_id == p.id)
            .group_by(PollVote.option_index)
        ).all()
        for idx, cnt in votes:
            vote_counts[idx] = cnt
        total = sum(vote_counts.values())
        result.append({
            "id": p.id, "question": p.question, "options": p.options or [],
            "vote_counts": vote_counts, "total_votes": total,
            "end_time": p.end_time.isoformat() if p.end_time else None,
            "anonymous": p.anonymous, "multiple_choice": p.multiple_choice,
            "ended": p.ended, "creator_id": p.creator_id,
            "channel_id": p.channel_id, "message_id": p.message_id,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    return result


@router.get("/stats")
def poll_stats(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    total = db.execute(select(func.count(Poll.id)).where(Poll.guild_id == guild_id)).scalar() or 0
    active = db.execute(select(func.count(Poll.id)).where(Poll.guild_id == guild_id, Poll.ended == False)).scalar() or 0
    return {"total": total, "active": active}
