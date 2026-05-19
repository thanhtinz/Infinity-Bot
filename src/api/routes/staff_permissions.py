"""Staff permissions routes — role-based access to dashboard sections."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from src.database.config import get_db
from src.api.deps import get_guild_id
from src.models.models import StaffPermission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/staff-permissions", tags=["staff-permissions"])

PERM_FIELDS = [
    "can_shop", "can_moderation", "can_community",
    "can_embeds", "can_roles", "can_utilities", "can_backup", "can_config", "can_ai",
    "can_forms", "can_reminders",
]


@router.get("")
def list_staff_permissions(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    rows = db.execute(
        select(StaffPermission).where(StaffPermission.guild_id == guild_id)
    ).scalars().all()
    return [
        {
            "id": sp.id,
            "role_id": sp.role_id,
            "role_name": sp.role_name,
            **{f: getattr(sp, f) for f in PERM_FIELDS},
        }
        for sp in rows
    ]


@router.post("")
def create_staff_permission(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    role_id = body.get("role_id")
    if not role_id:
        raise HTTPException(400, "role_id required")

    # Check for duplicate
    existing = db.execute(
        select(StaffPermission).where(
            StaffPermission.guild_id == guild_id,
            StaffPermission.role_id == role_id,
        )
    ).scalars().first()
    if existing:
        raise HTTPException(409, "Permission entry already exists for this role")

    sp = StaffPermission(
        guild_id=guild_id,
        role_id=role_id,
        role_name=body.get("role_name"),
    )
    for f in PERM_FIELDS:
        if f in body:
            setattr(sp, f, bool(body[f]))
    db.add(sp)
    db.commit()
    db.refresh(sp)
    return {
        "id": sp.id,
        "role_id": sp.role_id,
        "role_name": sp.role_name,
        **{f: getattr(sp, f) for f in PERM_FIELDS},
    }


@router.put("/{perm_id}")
def update_staff_permission(perm_id: int, body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    sp = db.execute(
        select(StaffPermission).where(
            StaffPermission.id == perm_id,
            StaffPermission.guild_id == guild_id,
        )
    ).scalars().first()
    if not sp:
        raise HTTPException(404, "Not found")

    for f in PERM_FIELDS:
        if f in body:
            setattr(sp, f, bool(body[f]))
    if "role_name" in body:
        sp.role_name = body["role_name"]
    db.commit()
    return {"ok": True}


@router.delete("/{perm_id}")
def delete_staff_permission(perm_id: int, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    sp = db.execute(
        select(StaffPermission).where(
            StaffPermission.id == perm_id,
            StaffPermission.guild_id == guild_id,
        )
    ).scalars().first()
    if not sp:
        raise HTTPException(404, "Not found")
    db.delete(sp)
    db.commit()
    return {"ok": True}


@router.get("/check")
def check_permissions(role_ids: str, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Check what permissions a set of role IDs has. Used by dashboard to show/hide sections."""
    ids = [r.strip() for r in role_ids.split(",") if r.strip()]
    if not ids:
        return {f: False for f in PERM_FIELDS}

    perms = db.execute(
        select(StaffPermission).where(
            StaffPermission.guild_id == guild_id,
            StaffPermission.role_id.in_(ids),
        )
    ).scalars().all()

    # Merge — if ANY matching role has a permission, grant it
    result = {f: False for f in PERM_FIELDS}
    for sp in perms:
        for f in PERM_FIELDS:
            if getattr(sp, f):
                result[f] = True
    return result
