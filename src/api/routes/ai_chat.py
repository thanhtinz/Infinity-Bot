"""AI Chat routes — per-guild AI assistant configuration, training docs, history."""
import logging
import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select, delete, func
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.api.deps import get_guild_id
from src.models.models import AIChatConfig, AITrainingDoc, AIChatHistory

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai-chat", tags=["ai-chat"])

PROVIDER_MODELS = {
    "groq": [
        {"value": "llama-3.3-70b-versatile", "label": "LLaMA 3.3 70B"},
        {"value": "llama-3.1-8b-instant", "label": "LLaMA 3.1 8B (Fast)"},
        {"value": "mixtral-8x7b-32768", "label": "Mixtral 8x7B"},
        {"value": "gemma2-9b-it", "label": "Gemma 2 9B"},
    ],
    "gemini": [
        {"value": "gemini-2.0-flash", "label": "Gemini 2.0 Flash"},
        {"value": "gemini-1.5-pro", "label": "Gemini 1.5 Pro"},
        {"value": "gemini-1.5-flash", "label": "Gemini 1.5 Flash"},
    ],
    "openai": [
        {"value": "gpt-4o", "label": "GPT-4o"},
        {"value": "gpt-4o-mini", "label": "GPT-4o Mini"},
        {"value": "gpt-3.5-turbo", "label": "GPT-3.5 Turbo"},
    ],
    "deepsearch": [
        {"value": "sonar", "label": "Sonar (Web Search)"},
        {"value": "sonar-pro", "label": "Sonar Pro"},
        {"value": "sonar-reasoning", "label": "Sonar Reasoning"},
    ],
}

IMAGE_PROVIDERS = {
    "gemini": [
        {"value": "imagen-3.0-generate-002", "label": "Imagen 3"},
        {"value": "imagen-3.0-fast-generate-001", "label": "Imagen 3 Fast"},
    ],
    "openai": [
        {"value": "dall-e-3", "label": "DALL·E 3"},
        {"value": "dall-e-2", "label": "DALL·E 2"},
    ],
}


def _mask_key(key: str | None) -> str | None:
    """Mask API key for display — show first 6 + last 4 chars."""
    if not key:
        return None
    if len(key) <= 10:
        return "••••••••"
    return key[:6] + "••••••••" + key[-4:]


def _config_to_dict(cfg: AIChatConfig, mask: bool = True) -> dict:
    return {
        "enabled": cfg.enabled,
        "provider": cfg.provider,
        "model": cfg.model,
        "api_key": _mask_key(cfg.api_key) if mask else cfg.api_key,
        "api_key_set": bool(cfg.api_key),
        "system_prompt": cfg.system_prompt,
        "listen_channels": cfg.listen_channels or [],
        "ai_manager_role": cfg.ai_manager_role,
        "respond_to_mention": cfg.respond_to_mention,
        "respond_prefix": cfg.respond_prefix,
        "ticket_auto_reply": cfg.ticket_auto_reply,
        "ticket_category_ids": cfg.ticket_category_ids or [],
        "ticket_reply_mode": cfg.ticket_reply_mode or "first_msg",
        "image_gen_enabled": cfg.image_gen_enabled,
        "image_provider": cfg.image_provider,
        "image_api_key": _mask_key(cfg.image_api_key) if mask else cfg.image_api_key,
        "image_api_key_set": bool(cfg.image_api_key),
        "max_history": cfg.max_history,
    }


# ── Config ───────────────────────────────────────────────────────────────────

@router.get("/config")
def get_config(db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cfg = db.execute(
        select(AIChatConfig).where(AIChatConfig.guild_id == guild_id)
    ).scalars().first()
    if not cfg:
        return {
            "enabled": False, "provider": "gemini", "model": None,
            "api_key": None, "api_key_set": False,
            "system_prompt": None, "listen_channels": [],
            "ai_manager_role": None, "respond_to_mention": True,
            "respond_prefix": "?", "ticket_auto_reply": False,
            "ticket_category_ids": [], "ticket_reply_mode": "first_msg",
            "image_gen_enabled": False, "image_provider": None,
            "image_api_key": None, "image_api_key_set": False,
            "max_history": 10,
        }
    return _config_to_dict(cfg)


@router.post("/config")
def upsert_config(body: dict, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    cfg = db.execute(
        select(AIChatConfig).where(AIChatConfig.guild_id == guild_id)
    ).scalars().first()

    if not cfg:
        cfg = AIChatConfig(guild_id=guild_id)
        db.add(cfg)

    SIMPLE_FIELDS = [
        "enabled", "provider", "model", "system_prompt",
        "listen_channels", "ai_manager_role", "respond_to_mention",
        "respond_prefix", "ticket_auto_reply", "ticket_category_ids",
        "ticket_reply_mode", "image_gen_enabled",
        "image_provider", "max_history",
    ]
    for f in SIMPLE_FIELDS:
        if f in body:
            setattr(cfg, f, body[f])

    # Only update keys if a new non-masked value is provided
    if "api_key" in body and body["api_key"] and "••" not in body["api_key"]:
        cfg.api_key = body["api_key"]
    if "image_api_key" in body and body["image_api_key"] and "••" not in body["image_api_key"]:
        cfg.image_api_key = body["image_api_key"]

    cfg.updated_at = datetime.datetime.utcnow()
    db.commit()
    return _config_to_dict(cfg)


@router.get("/models")
def get_models():
    return {"providers": PROVIDER_MODELS, "image_providers": IMAGE_PROVIDERS}


@router.post("/test-connection")
async def test_connection(body: dict, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Test API key validity by sending a minimal request."""
    provider = body.get("provider", "gemini")
    api_key = body.get("api_key", "")

    # If masked → use stored key
    if "••" in api_key:
        cfg = db.execute(
            select(AIChatConfig).where(AIChatConfig.guild_id == guild_id)
        ).scalars().first()
        api_key = cfg.api_key if cfg else ""

    if not api_key:
        raise HTTPException(400, "API key not provided")

    model = body.get("model") or (PROVIDER_MODELS[provider][0]["value"] if provider in PROVIDER_MODELS else "")

    try:
        if provider == "groq":
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": model, "messages": [{"role": "user", "content": "hi"}], "max_tokens": 5},
                )
                if r.status_code == 200:
                    return {"ok": True, "message": "Connection successful"}
                raise HTTPException(400, f"Groq error {r.status_code}: {r.text[:200]}")

        elif provider == "gemini":
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
                    json={"contents": [{"parts": [{"text": "hi"}]}]},
                )
                if r.status_code == 200:
                    return {"ok": True, "message": "Connection successful"}
                raise HTTPException(400, f"Gemini error {r.status_code}: {r.text[:200]}")

        elif provider == "openai":
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": model, "messages": [{"role": "user", "content": "hi"}], "max_tokens": 5},
                )
                if r.status_code == 200:
                    return {"ok": True, "message": "Connection successful"}
                raise HTTPException(400, f"OpenAI error {r.status_code}: {r.text[:200]}")

        elif provider == "deepsearch":
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(
                    "https://api.perplexity.ai/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": model or "sonar", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 5},
                )
                if r.status_code == 200:
                    return {"ok": True, "message": "Connection successful"}
                raise HTTPException(400, f"Perplexity error {r.status_code}: {r.text[:200]}")

        raise HTTPException(400, f"Unknown provider: {provider}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Connection failed: {str(e)}")


# ── Training Docs ─────────────────────────────────────────────────────────────

@router.get("/training")
def list_training_docs(db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    docs = db.execute(
        select(AITrainingDoc).where(AITrainingDoc.guild_id == guild_id)
        .order_by(AITrainingDoc.created_at.desc())
    ).scalars().all()
    return [
        {
            "id": d.id,
            "title": d.title,
            "doc_type": d.doc_type,
            "filename": d.filename,
            "enabled": d.enabled,
            "content_preview": d.content[:200] + "..." if len(d.content) > 200 else d.content,
            "char_count": len(d.content),
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]


@router.post("/training")
def create_training_doc(body: dict, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    title = body.get("title", "").strip()
    content = body.get("content", "").strip()
    if not title or not content:
        raise HTTPException(400, "title and content required")

    doc = AITrainingDoc(
        guild_id=guild_id,
        title=title,
        content=content,
        doc_type="text",
        enabled=True,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "ok": True}


@router.post("/training/upload")
async def upload_training_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    """Upload a txt/md/pdf file as training document."""
    allowed = {"text/plain", "text/markdown", "application/pdf"}
    content_type = file.content_type or ""

    raw = await file.read()

    if content_type == "application/pdf" or file.filename.endswith(".pdf"):
        try:
            import pypdf
            import io
            reader = pypdf.PdfReader(io.BytesIO(raw))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except ImportError:
            text = raw.decode("utf-8", errors="ignore")
    else:
        text = raw.decode("utf-8", errors="ignore")

    text = text.strip()
    if not text:
        raise HTTPException(400, "File is empty or could not be parsed")

    title = file.filename or "Uploaded file"
    doc = AITrainingDoc(
        guild_id=guild_id,
        title=title,
        content=text[:50000],  # cap at 50k chars
        doc_type="file",
        filename=file.filename,
        enabled=True,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "ok": True, "char_count": len(text)}


@router.patch("/training/{doc_id}")
def update_training_doc(doc_id: int, body: dict, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    doc = db.execute(
        select(AITrainingDoc).where(AITrainingDoc.id == doc_id, AITrainingDoc.guild_id == guild_id)
    ).scalars().first()
    if not doc:
        raise HTTPException(404, "Not found")
    if "enabled" in body:
        doc.enabled = bool(body["enabled"])
    if "title" in body:
        doc.title = body["title"]
    if "content" in body:
        doc.content = body["content"]
    db.commit()
    return {"ok": True}


@router.delete("/training/{doc_id}")
def delete_training_doc(doc_id: int, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    doc = db.execute(
        select(AITrainingDoc).where(AITrainingDoc.id == doc_id, AITrainingDoc.guild_id == guild_id)
    ).scalars().first()
    if not doc:
        raise HTTPException(404, "Not found")
    db.delete(doc)
    db.commit()
    return {"ok": True}


# ── History ──────────────────────────────────────────────────────────────────

@router.get("/history")
def get_history(
    db: Session = Depends(get_db),
    guild_id: str = Depends(get_guild_id),
    limit: int = 100,
    user_id: str | None = None,
):
    q = select(AIChatHistory).where(AIChatHistory.guild_id == guild_id)
    if user_id:
        q = q.where(AIChatHistory.user_id == user_id)
    q = q.order_by(AIChatHistory.timestamp.desc()).limit(limit)
    rows = db.execute(q).scalars().all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "username": r.username,
            "channel_id": r.channel_id,
            "role": r.role,
            "content": r.content,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        }
        for r in rows
    ]


@router.get("/history/stats")
def history_stats(db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    total = db.execute(
        select(func.count(AIChatHistory.id)).where(AIChatHistory.guild_id == guild_id)
    ).scalar() or 0
    users = db.execute(
        select(func.count(func.distinct(AIChatHistory.user_id))).where(
            AIChatHistory.guild_id == guild_id,
            AIChatHistory.role == "user",
        )
    ).scalar() or 0
    return {"total_messages": total, "unique_users": users}


@router.delete("/history")
def clear_history(
    db: Session = Depends(get_db),
    guild_id: str = Depends(get_guild_id),
    user_id: str | None = None,
):
    q = delete(AIChatHistory).where(AIChatHistory.guild_id == guild_id)
    if user_id:
        q = q.where(AIChatHistory.user_id == user_id)
    db.execute(q)
    db.commit()
    return {"ok": True}
