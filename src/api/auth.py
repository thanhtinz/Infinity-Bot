import os
import httpx
import jwt
import datetime
from fastapi import APIRouter, Request, Depends, HTTPException, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from src.database.config import get_db
from src.models.models import SystemConfig

router = APIRouter()

JWT_SECRET = os.environ.get("GEMINI_WORKSHOP_API_KEY", "fallback-secret-for-jwt-1234")


def get_public_base_url(request: Request) -> str:
    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    forwarded_proto = request.headers.get("x-forwarded-proto")
    forwarded_host = request.headers.get("x-forwarded-host")

    if origin:
        return origin.rstrip("/")

    if referer:
        from urllib.parse import urlsplit

        parsed = urlsplit(referer)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")

    if forwarded_host:
        proto = forwarded_proto or "https"
        return f"{proto}://{forwarded_host}".rstrip("/")

    base_url = str(request.base_url).rstrip("/")
    if base_url.startswith("http://localhost") or base_url.startswith("http://127.0.0.1"):
        vercel_url = os.environ.get("VERCEL_URL")
        if vercel_url:
            if not vercel_url.startswith("http"):
                vercel_url = f"https://{vercel_url}"
            return vercel_url.rstrip("/")

    return base_url


def get_discord_oauth_config(db):
    result = db.execute(select(SystemConfig).limit(1))
    config = result.scalars().first()

    client_id = None
    client_secret = None
    discord_token = None
    public_app_url = None

    if config:
        client_id = config.discord_client_id
        client_secret = config.discord_client_secret
        discord_token = config.discord_token
        public_app_url = config.public_app_url

    client_id = client_id or os.environ.get("DISCORD_CLIENT_ID")
    client_secret = client_secret or os.environ.get("DISCORD_CLIENT_SECRET")
    public_app_url = public_app_url or os.environ.get("PUBLIC_APP_URL")

    return config, client_id, client_secret, discord_token, public_app_url

OWNER_ID = "847746890808164383"

@router.get("/auth/login")
async def login(request: Request, db = Depends(get_db)):
    _, client_id, client_secret, _, public_app_url = get_discord_oauth_config(db)
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Discord OAuth is not configured")
    if not public_app_url:
        raise HTTPException(status_code=500, detail="Public app URL is not configured")

    domain = public_app_url.rstrip("/")
    redirect_uri = f"{domain}/api/auth/callback"
    discord_auth_url = (
        f"https://discord.com/api/oauth2/authorize"
        f"?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope=identify%20guilds"
    )
    return RedirectResponse(discord_auth_url)

@router.get("/auth/callback")
async def auth_callback(code: str, request: Request, response: Response, db = Depends(get_db)):
    config, client_id, client_secret, discord_token, public_app_url = get_discord_oauth_config(db)
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Discord OAuth is not configured")
    if not public_app_url:
        raise HTTPException(status_code=500, detail="Public app URL is not configured")

    domain = public_app_url.rstrip("/")
    redirect_uri = f"{domain}/api/auth/callback"
    
    # 1. Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://discord.com/api/oauth2/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if token_res.status_code != 200:
            return RedirectResponse(f"{domain}/login?error=discord_auth_failed")
            
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        
        # 2. Get User Info
        user_res = await client.get(
            "https://discord.com/api/users/@me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        user_info = user_res.json()
        discord_id = user_info.get("id")
        
        # 3. Check Authorization
        is_authorized = False
        is_owner = (discord_id == OWNER_ID)
        
        if is_owner:
            is_authorized = True
        else:
            if config and config.guild_id and config.admin_role_id:
                # Fetch user's member info in that guild to check roles
                # Requires bot token to check member roles if OAuth scope doesn't provide it
                # For simplicity with OAuth "guilds" scope, we can check if user is in guild
                # and maybe rely on bot logic or fetch /users/@me/guilds
                # *We will trust the owner to set this up, but strictly speaking,
                # we need bot token to check member roles.*
                
                if discord_token:
                    member_res = await client.get(
                        f"https://discord.com/api/guilds/{config.guild_id}/members/{discord_id}",
                        headers={"Authorization": f"Bot {discord_token}"}
                    )
                    if member_res.status_code == 200:
                        member_data = member_res.json()
                        roles = member_data.get("roles", [])
                        if config.admin_role_id in roles:
                            is_authorized = True
        
        if not is_authorized:
            return RedirectResponse(f"{domain}/login?error=unauthorized")
        # 4. Create JWT Cookie
        payload = {
            "sub": discord_id,
            "username": user_info.get("username"),
            "avatar": user_info.get("avatar"),
            "is_owner": is_owner,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
        
        response = RedirectResponse(f"{domain}/")
        response.set_cookie(
            key="dashboard_session", 
            value=token, 
            httponly=True, 
            max_age=7*24*60*60,
            samesite="none",
            secure=True
        )
        return response

@router.get("/auth/me")
async def get_me(request: Request):
    token = request.cookies.get("dashboard_session")
    if not token:
        raise HTTPException(status_code=401, detail="Not logged in")
        
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return {
            "id": payload.get("sub"),
            "username": payload.get("username"),
            "avatar": payload.get("avatar"),
            "is_owner": payload.get("is_owner")
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("dashboard_session")
    return {"status": "ok"}
