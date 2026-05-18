"""Serve and upload files stored in Neon DB."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Header
from fastapi.responses import Response
from sqlalchemy import select

from src.database.config import get_db
from src.models.models import UploadedFile

router = APIRouter()

# 8 MB max upload size
MAX_UPLOAD_BYTES = 8 * 1024 * 1024

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/wave",
    "audio/x-wav", "audio/webm", "audio/aac", "audio/x-m4a", "audio/mp4",
    "audio/flac", "audio/x-flac",
}


@router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    x_guild_id: str | None = Header(None),
    db=Depends(get_db),
):
    """Upload an image or audio file; returns {url, id}."""
    content_type = file.content_type or ""

    # Fallback: detect by extension if MIME type is missing or generic
    EXTENSION_MAP = {
        ".mp3": "audio/mpeg",
        ".ogg": "audio/ogg",
        ".wav": "audio/wav",
        ".webm": "audio/webm",
        ".aac": "audio/aac",
        ".m4a": "audio/mp4",
        ".flac": "audio/flac",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
    }
    if content_type not in ALLOWED_TYPES and file.filename:
        ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext in EXTENSION_MAP:
            content_type = EXTENSION_MAP[ext]

    if content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large (max 8 MB)")

    file_id = uuid.uuid4().hex
    row = UploadedFile(
        id=file_id,
        filename=file.filename or "upload",
        content_type=content_type,
        data=data,
        size=len(data),
        guild_id=x_guild_id,
    )
    db.add(row)
    db.commit()

    return {"id": file_id, "url": f"/api/files/{file_id}", "size": len(data)}


@router.get("/files/{file_id}")
def serve_file(file_id: str, db=Depends(get_db)):
    """Serve an uploaded file by its UUID."""
    f = db.execute(select(UploadedFile).where(UploadedFile.id == file_id)).scalars().first()
    if not f:
        raise HTTPException(404, "File not found")
    return Response(
        content=f.data,
        media_type=f.content_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": f'inline; filename="{f.filename}"',
        },
    )
