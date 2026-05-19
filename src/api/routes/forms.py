"""Forms / Application API routes."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import Session, joinedload
import datetime

from src.database.config import get_db
from src.models.models import FormTemplate, FormSubmission
from src.api.deps import get_guild_id, require_staff_perm

router = APIRouter(prefix="/forms", tags=["forms"], dependencies=[Depends(require_staff_perm("can_forms"))])


class TemplateCreate(BaseModel):
    title: str
    description: str | None = None
    questions: list = []
    response_channel_id: str | None = None
    review_role_id: str | None = None


class TemplateUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    questions: list | None = None
    response_channel_id: str | None = None
    review_role_id: str | None = None
    active: bool | None = None


class ReviewBody(BaseModel):
    status: str  # approved | rejected
    review_note: str | None = None


# ── Templates ────────────────────────────────────────────────────────────────

@router.get("/templates")
def list_templates(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    rows = db.execute(
        select(FormTemplate).where(FormTemplate.guild_id == guild_id).order_by(FormTemplate.created_at.desc())
    ).scalars().all()
    return [
        {"id": t.id, "title": t.title, "description": t.description,
         "questions": t.questions or [], "response_channel_id": t.response_channel_id,
         "review_role_id": t.review_role_id, "active": t.active,
         "created_at": t.created_at.isoformat() if t.created_at else None}
        for t in rows
    ]


@router.post("/templates")
def create_template(body: TemplateCreate, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    t = FormTemplate(guild_id=guild_id, **body.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "status": "created"}


@router.patch("/templates/{tid}")
def update_template(tid: int, body: TemplateUpdate, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    t = db.execute(select(FormTemplate).where(FormTemplate.id == tid, FormTemplate.guild_id == guild_id)).scalars().first()
    if not t:
        return {"error": "not found"}
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(t, k, v)
    db.commit()
    return {"status": "updated"}


@router.delete("/templates/{tid}")
def delete_template(tid: int, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    t = db.execute(select(FormTemplate).where(FormTemplate.id == tid, FormTemplate.guild_id == guild_id)).scalars().first()
    if t:
        db.delete(t)
        db.commit()
    return {"status": "deleted"}


# ── Submissions ──────────────────────────────────────────────────────────────

@router.get("/submissions")
def list_submissions(
    template_id: int | None = None,
    status: str | None = None,
    guild_id: str = Depends(get_guild_id),
    db: Session = Depends(get_db),
):
    q = select(FormSubmission).options(joinedload(FormSubmission.template)).where(FormSubmission.guild_id == guild_id)
    if template_id:
        q = q.where(FormSubmission.template_id == template_id)
    if status:
        q = q.where(FormSubmission.status == status)
    rows = db.execute(q.order_by(FormSubmission.created_at.desc()).limit(100)).unique().scalars().all()
    return [
        {"id": s.id, "template_id": s.template_id,
         "template_title": s.template.title if s.template else None,
         "user_id": s.user_id, "username": s.username,
         "answers": s.answers or [], "status": s.status,
         "reviewer_id": s.reviewer_id, "review_note": s.review_note,
         "reviewed_at": s.reviewed_at.isoformat() if s.reviewed_at else None,
         "created_at": s.created_at.isoformat() if s.created_at else None}
        for s in rows
    ]


@router.get("/submissions/stats")
def submission_stats(guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    total = db.execute(select(func.count(FormSubmission.id)).where(FormSubmission.guild_id == guild_id)).scalar() or 0
    pending = db.execute(select(func.count(FormSubmission.id)).where(FormSubmission.guild_id == guild_id, FormSubmission.status == "pending")).scalar() or 0
    approved = db.execute(select(func.count(FormSubmission.id)).where(FormSubmission.guild_id == guild_id, FormSubmission.status == "approved")).scalar() or 0
    rejected = db.execute(select(func.count(FormSubmission.id)).where(FormSubmission.guild_id == guild_id, FormSubmission.status == "rejected")).scalar() or 0
    return {"total": total, "pending": pending, "approved": approved, "rejected": rejected}


@router.patch("/submissions/{sid}/review")
def review_submission(sid: int, body: ReviewBody, guild_id: str = Depends(get_guild_id), db: Session = Depends(get_db)):
    s = db.execute(select(FormSubmission).where(FormSubmission.id == sid, FormSubmission.guild_id == guild_id)).scalars().first()
    if not s:
        return {"error": "not found"}
    s.status = body.status
    s.review_note = body.review_note
    s.reviewed_at = datetime.datetime.utcnow()
    db.commit()
    return {"status": "updated"}
