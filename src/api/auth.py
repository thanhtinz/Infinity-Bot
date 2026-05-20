import os
import logging
import httpx
import jwt
import datetime
from fastapi import APIRouter, Request, Depends, HTTPException, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from src.database.config import get_db
from src.models.models import SystemConfig

logger = logging.getLogger(__name__)

router = APIRouter()

JWT_SECRET = os.environ.get("JWT_SECRET_KEY") or os.environ.get("GEMINI_WORKSHOP_API_KEY")
if not JWT_SECRET:
    # Derive stable secret from DATABASE_URL so sessions survive restarts
    _db_url = os.environ.get("DATABASE_URL") or os.environ.get("DB8624B53A_DATABASE_URL")
    if _db_url:
        import hashlib
        JWT_SECRET = hashlib.sha256(f"jwt-salt-{_db_url}".encode()).hexdigest()
        logger.info("JWT_SECRET_KEY not set — derived stable secret from DATABASE_URL.")
    else:
        import secrets as _secrets
        JWT_SECRET = _secrets.token_hex(32)
        logger.warning("JWT_SECRET_KEY env var not set — using ephemeral random secret. Sessions will be invalidated on restart.")


def get_public_base_url(request: Request) -> str:
    # 1. Env var (most reliable — set by platform)
    custom_domain = os.environ.get("WORKSHOP_CUSTOM_DOMAIN")
    if custom_domain:
        return f"https://{custom_domain}".rstrip("/")

    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    forwarded_proto = request.headers.get("x-forwarded-proto")
    forwarded_host = request.headers.get("x-forwarded-host")
    host = request.headers.get("host")

    # 2. Origin header (present on XHR/fetch, not on navigations)
    if origin and "discord.com" not in origin:
        return origin.rstrip("/")

    # 3. x-forwarded-host (set by Cloudflare/proxy)
    if forwarded_host:
        proto = forwarded_proto or "https"
        return f"{proto}://{forwarded_host}".rstrip("/")

    # 4. Host header (usually set, includes proxy host)
    if host and "localhost" not in host and "127.0.0.1" not in host:
        proto = forwarded_proto or "https"
        return f"{proto}://{host}".rstrip("/")

    # 5. Referer (skip if from discord.com — OAuth callback)
    if referer and "discord.com" not in referer:
        from urllib.parse import urlsplit
        parsed = urlsplit(referer)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")

    # 6. Fallback
    base_url = str(request.base_url).rstrip("/")
    if base_url.startswith("http://localhost") or base_url.startswith("http://127.0.0.1"):
        vercel_url = os.environ.get("VERCEL_URL")
        if vercel_url:
            if not vercel_url.startswith("http"):
                vercel_url = f"https://{vercel_url}"
            return vercel_url.rstrip("/")

    return base_url


def get_discord_oauth_config(db, request: Request | None = None):
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

    client_id = client_id or os.environ.get("DISCORD_CLIENT_ID")
    client_secret = client_secret or os.environ.get("DISCORD_CLIENT_SECRET")

    # Derive public_app_url from the CURRENT request so redirects
    # always match the domain the user is actually browsing from.
    # Fall back to DB / env only if request detection fails.
    if request:
        public_app_url = get_public_base_url(request)
    if not public_app_url and config:
        public_app_url = config.public_app_url
    if not public_app_url:
        public_app_url = os.environ.get("PUBLIC_APP_URL")

    return config, client_id, client_secret, discord_token, public_app_url

OWNER_ID = "847746890808164383"  # Legacy fallback — will be removed after first deploy

@router.get("/auth/login")
async def login(request: Request, db = Depends(get_db)):
    _, client_id, client_secret, _, public_app_url = get_discord_oauth_config(db, request)
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Discord OAuth is not configured")
    if not public_app_url:
        raise HTTPException(status_code=500, detail="Public app URL is not configured")

    domain = public_app_url.rstrip("/")
    redirect_uri = f"{domain}/api/auth/callback"
    logger.info(f"[auth/login] domain={domain} redirect_uri={redirect_uri}")
    discord_auth_url = (
        f"https://discord.com/api/oauth2/authorize"
        f"?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope=identify%20guilds"
    )
    return RedirectResponse(discord_auth_url)

@router.get("/auth/callback")
async def auth_callback(code: str, request: Request, response: Response, db = Depends(get_db)):
    config, client_id, client_secret, discord_token, public_app_url = get_discord_oauth_config(db, request)
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Discord OAuth is not configured")
    if not public_app_url:
        raise HTTPException(status_code=500, detail="Public app URL is not configured")

    domain = public_app_url.rstrip("/")
    redirect_uri = f"{domain}/api/auth/callback"
    logger.info(f"[auth/callback] domain={domain} redirect_uri={redirect_uri} host={request.headers.get('host')} fwd_host={request.headers.get('x-forwarded-host')}")

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
        
        # 3. Check Authorization — multi-guild: check across ALL guilds bot is in
        is_authorized = False
        is_owner = False

        # Legacy fallback: hardcoded owner ID
        if discord_id == OWNER_ID:
            is_authorized = True
            is_owner = True

        if not is_authorized and discord_token:
            # Lấy tất cả SystemConfig rows (1 per guild)
            all_configs = db.execute(select(SystemConfig).where(SystemConfig.guild_id.isnot(None))).scalars().all()
            
            for guild_cfg in all_configs:
                if not guild_cfg.guild_id:
                    continue
                # Check owner: fetch guild info
                try:
                    guild_res = await client.get(
                        f"https://discord.com/api/guilds/{guild_cfg.guild_id}",
                        headers={"Authorization": f"Bot {discord_token}"}
                    )
                    if guild_res.status_code == 200:
                        guild_data = guild_res.json()
                        if guild_data.get("owner_id") == discord_id:
                            is_authorized = True
                            is_owner = True
                            break
                except Exception:
                    pass
                
                # Check admin role trong guild này
                if guild_cfg.admin_role_id:
                    try:
                        member_res = await client.get(
                            f"https://discord.com/api/guilds/{guild_cfg.guild_id}/members/{discord_id}",
                            headers={"Authorization": f"Bot {discord_token}"}
                        )
                        if member_res.status_code == 200:
                            member_data = member_res.json()
                            roles = member_data.get("roles", [])
                            if guild_cfg.admin_role_id in roles:
                                is_authorized = True
                                break
                    except Exception:
                        pass
        
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
        
        response = RedirectResponse(f"{domain}/select-guild")
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
