"""Discord API proxy routes — guilds, channels, roles, emojis."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
import httpx

from src.database.config import get_db
from src.models.models import SystemConfig, ManagedEmoji
from src.api.deps import get_guild_id, _decode_session

router = APIRouter()


def _get_bot_token(db) -> str:
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not config.discord_token:
        raise HTTPException(status_code=400, detail="Bot token chưa được cấu hình")
    return config.discord_token


# ── Discord API proxy ────────────────────────────────────────────────────────

@router.get("/discord/guilds")
async def get_discord_guilds(db=Depends(get_db)):
    token = _get_bot_token(db)
    async with httpx.AsyncClient() as client:
        res = await client.get(
            "https://discord.com/api/users/@me/guilds",
            headers={"Authorization": f"Bot {token}"}
        )
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail="Không thể lấy danh sách server")
        return res.json()


@router.get("/discord/channels")
async def get_discord_channels(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    token = _get_bot_token(db)
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{guild_id}/channels",
            headers={"Authorization": f"Bot {token}"}
        )
        if res.status_code != 200:
            return []
        channels = res.json()
        return [{"id": c["id"], "name": c["name"]} for c in channels if c.get("type") == 0]


@router.get("/discord/channels/all")
async def get_discord_all_channels(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    token = _get_bot_token(db)
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{guild_id}/channels",
            headers={"Authorization": f"Bot {token}"}
        )
        if res.status_code != 200:
            return []
        channels = res.json()
        return [{"id": c["id"], "name": c["name"], "type": c.get("type", 0), "parent_id": c.get("parent_id"), "position": c.get("position", 0)} for c in channels]


@router.get("/discord/roles")
async def get_discord_roles(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    token = _get_bot_token(db)
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{guild_id}/roles",
            headers={"Authorization": f"Bot {token}"}
        )
        if res.status_code != 200:
            return []
        roles = res.json()
        return [{"id": r["id"], "name": r["name"], "color": r.get("color", 0)} for r in roles if r.get("name") != "@everyone"]


@router.get("/discord/emojis")
async def get_discord_emojis(db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    token = _get_bot_token(db)
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{guild_id}/emojis",
            headers={"Authorization": f"Bot {token}"}
        )
        if res.status_code != 200:
            return []
        emojis = res.json()
        return [
            {
                "id": e["id"],
                "name": e["name"],
                "animated": e.get("animated", False),
                "url": f"https://cdn.discordapp.com/emojis/{e['id']}.{'gif' if e.get('animated') else 'png'}",
                "usage": f"<{'a' if e.get('animated') else ''}:{e['name']}:{e['id']}>",
            }
            for e in emojis
        ]


@router.post("/discord/emojis")
async def upload_discord_emoji(body: dict, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    token = _get_bot_token(db)
    emoji_name = body.get("name", "").strip()
    image_b64 = body.get("image_base64", "")
    if not emoji_name or not image_b64:
        raise HTTPException(status_code=400, detail="Thiếu name hoặc image_base64")
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"https://discord.com/api/guilds/{guild_id}/emojis",
            headers={"Authorization": f"Bot {token}", "Content-Type": "application/json"},
            json={"name": emoji_name, "image": image_b64},
        )
        if res.status_code not in (200, 201):
            detail = res.json().get("message", "Lỗi upload emoji")
            raise HTTPException(status_code=400, detail=detail)
        e = res.json()
        animated = e.get("animated", False)
        url = f"https://cdn.discordapp.com/emojis/{e['id']}.{'gif' if animated else 'png'}"
        # Save to managed emojis DB
        existing = db.execute(select(ManagedEmoji).where(ManagedEmoji.discord_id == str(e["id"]))).scalars().first()
        if not existing:
            db.add(ManagedEmoji(discord_id=str(e["id"]), name=e["name"], animated=animated, url=url, guild_id=guild_id))
            db.commit()
        return {
            "id": e["id"],
            "name": e["name"],
            "animated": animated,
            "url": url,
            "usage": f"<{'a' if animated else ''}:{e['name']}:{e['id']}>",
        }


@router.delete("/discord/emojis/{emoji_id}")
async def delete_discord_emoji(emoji_id: str, db=Depends(get_db), guild_id: str = Depends(get_guild_id)):
    token = _get_bot_token(db)
    async with httpx.AsyncClient() as client:
        res = await client.delete(
            f"https://discord.com/api/guilds/{guild_id}/emojis/{emoji_id}",
            headers={"Authorization": f"Bot {token}"},
        )
        if res.status_code not in (200, 204):
            raise HTTPException(status_code=400, detail="Xóa emoji thất bại")
    # Also remove from managed emojis DB
    managed = db.execute(select(ManagedEmoji).where(ManagedEmoji.discord_id == str(emoji_id))).scalars().first()
    if managed:
        db.delete(managed)
        db.commit()
    return {"ok": True}


@router.get("/discord/member-roles")
async def get_member_roles(
    request: Request,
    db=Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    """Return the Discord role IDs of the currently logged-in user in this guild."""
    payload = _decode_session(request)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session")

    token = _get_bot_token(db)
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://discord.com/api/guilds/{guild_id}/members/{user_id}",
            headers={"Authorization": f"Bot {token}"},
        )
        if res.status_code != 200:
            return {"roles": []}
        member_data = res.json()
        return {"roles": member_data.get("roles", [])}
