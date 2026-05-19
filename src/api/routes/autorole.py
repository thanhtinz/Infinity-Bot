"""Auto Role API routes."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.models.models import AutoRole
from src.api.deps import get_guild_id, require_staff_perm

router = APIRouter(prefix="/autorole", tags=["autorole"], dependencies=[Depends(require_staff_perm("can_utilities"))])


class AutoRoleCreate(BaseModel):
    role_id: str
    trigger: str = "join"
    delay_seconds: int = 0


class AutoRoleUpdate(BaseModel):
    enabled: bool | None = None
    trigger: str | None = None
    delay_seconds: int | None = None


@router.get("")
def list_autoroles(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    rows = db.execute(
        select(AutoRole).where(AutoRole.guild_id == guild_id).order_by(AutoRole.created_at.desc())
    ).scalars().all()
    return [
        {"id": r.id, "role_id": r.role_id, "trigger": r.trigger,
         "delay_seconds": r.delay_seconds, "enabled": r.enabled,
         "created_at": r.created_at.isoformat() if r.created_at else None}
        for r in rows
    ]


@router.post("")
def create_autorole(body: AutoRoleCreate, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    ar = AutoRole(guild_id=guild_id, role_id=body.role_id, trigger=body.trigger, delay_seconds=body.delay_seconds)
    db.add(ar)
    db.commit()
    db.refresh(ar)
    return {"id": ar.id, "status": "created"}


@router.patch("/{ar_id}")
def update_autorole(ar_id: int, body: AutoRoleUpdate, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    ar = db.execute(select(AutoRole).where(AutoRole.id == ar_id, AutoRole.guild_id == guild_id)).scalars().first()
    if not ar:
        return {"error": "not found"}
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(ar, k, v)
    db.commit()
    return {"status": "updated"}


@router.delete("/{ar_id}")
def delete_autorole(ar_id: int, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    ar = db.execute(select(AutoRole).where(AutoRole.id == ar_id, AutoRole.guild_id == guild_id)).scalars().first()
    if ar:
        db.delete(ar)
        db.commit()
    return {"status": "deleted"}
