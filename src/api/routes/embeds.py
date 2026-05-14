"""Embed template CRUD routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
import datetime

from src.database.config import get_db
from src.models.models import EmbedTemplate

router = APIRouter()


@router.get("/embeds")
def list_embeds(db=Depends(get_db)):
    rows = db.execute(select(EmbedTemplate).order_by(EmbedTemplate.id)).scalars().all()
    return [
        {
            "id": r.id, "name": r.name, "event_type": r.event_type,
            "title": r.title, "description": r.description, "color": r.color,
            "author": r.author, "footer": r.footer,
            "thumbnail_url": r.thumbnail_url, "image_url": r.image_url,
            "fields": r.fields or [], "enabled": r.enabled,
            "response_mode": r.response_mode or "embed",
            "text_template": r.text_template,
        }
        for r in rows
    ]


@router.post("/embeds")
def create_embed(body: dict, db=Depends(get_db)):
    e = EmbedTemplate(
        name=body.get("name", ""),
        event_type=body.get("event_type"),
        title=body.get("title"),
        description=body.get("description"),
        color=body.get("color", "#5865F2"),
        author=body.get("author"),
        footer=body.get("footer"),
        thumbnail_url=body.get("thumbnail_url"),
        image_url=body.get("image_url"),
        fields=body.get("fields", []),
        enabled=body.get("enabled", True),
        response_mode=body.get("response_mode", "embed"),
        text_template=body.get("text_template"),
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return {"id": e.id, "name": e.name}


@router.put("/embeds/{embed_id}")
def update_embed(embed_id: int, body: dict, db=Depends(get_db)):
    e = db.get(EmbedTemplate, embed_id)
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    for k in ("name", "event_type", "title", "description", "color", "author",
              "footer", "thumbnail_url", "image_url", "fields", "enabled",
              "response_mode", "text_template"):
        if k in body:
            setattr(e, k, body[k])
    e.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.delete("/embeds/{embed_id}")
def delete_embed(embed_id: int, db=Depends(get_db)):
    e = db.get(EmbedTemplate, embed_id)
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(e)
    db.commit()
    return {"ok": True}
