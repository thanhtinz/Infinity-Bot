"""Serve uploaded files from Neon DB."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select

from src.database.config import get_db
from src.models.models import UploadedFile

router = APIRouter()


@router.get("/files/{file_id}")
def serve_file(file_id: str, db=Depends(get_db)):
    """Serve an uploaded file by its UUID."""
    f = db.execute(select(UploadedFile).where(UploadedFile.id == file_id)).scalars().first()
    if not f:
        # Debug: check if table has any rows
        from sqlalchemy import text
        count = db.execute(text("SELECT count(*) FROM uploaded_files")).scalar()
        raise HTTPException(404, f"File not found (total files: {count})")
    return Response(
        content=f.data,
        media_type=f.content_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": f'inline; filename="{f.filename}"',
        },
    )
