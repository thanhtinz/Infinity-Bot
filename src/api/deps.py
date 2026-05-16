"""Shared FastAPI dependencies."""
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from src.database.config import get_db


def get_guild_id(request: Request) -> str:
    """Lấy guild_id từ header X-Guild-ID. Bắt buộc với mọi route multi-guild."""
    guild_id = request.headers.get("X-Guild-ID")
    if not guild_id:
        raise HTTPException(status_code=400, detail="Missing X-Guild-ID header")
    return guild_id
