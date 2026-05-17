"""Public Verify Page routes — OAuth2 verification flow for members.

These routes are PUBLIC (no dashboard auth required).
Flow: /verify/{guild_id} → Discord OAuth2 → callback → save member → assign role.
"""
import logging
import httpx
from datetime import datetime, timedelta
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.models.models import SystemConfig, VerificationConfig, VerifiedMember
from src.api.auth import get_public_base_url

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_oauth_config(db: Session):
    """Get Discord OAuth2 config from SystemConfig."""
    cfg = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not cfg:
        return None, None, None, None
    return cfg.discord_client_id, cfg.discord_client_secret, cfg.discord_token, cfg.public_app_url


def _get_vpn_api_key(db: Session) -> str | None:
    """Get VPN API key from SystemConfig."""
    cfg = db.execute(select(SystemConfig).limit(1)).scalars().first()
    return cfg.vpn_api_key if cfg else None


# ── Public config for verify page branding (no auth) ──
@router.get("/api/verify/{guild_id}/config")
def get_verify_page_config(guild_id: str, db: Session = Depends(get_db)):
    cfg = db.execute(
        select(VerificationConfig).where(VerificationConfig.guild_id == guild_id)
    ).scalars().first()
    if not cfg or not cfg.enabled:
        raise HTTPException(404, "Verification not enabled for this server")

    # Get guild info
    sys_cfg = db.execute(select(SystemConfig).limit(1)).scalars().first()
    guild_name = sys_cfg.guild_name if sys_cfg else None
    guild_icon = sys_cfg.guild_icon if sys_cfg else None

    return {
        "guild_id": guild_id,
        "guild_name": guild_name,
        "guild_icon": guild_icon,
        "page_title": cfg.page_title,
        "page_description": cfg.page_description,
        "page_color": cfg.page_color,
        "page_logo_url": cfg.page_logo_url,
        "page_background_url": cfg.page_background_url,
        "button_text": cfg.button_text,
        "captcha_enabled": cfg.captcha_enabled,
    }


# ── Start OAuth2 flow ──
@router.get("/api/verify/{guild_id}/start")
def start_verification(guild_id: str, request: Request, db: Session = Depends(get_db)):
    cfg = db.execute(
        select(VerificationConfig).where(VerificationConfig.guild_id == guild_id)
    ).scalars().first()
    if not cfg or not cfg.enabled:
        raise HTTPException(404, "Verification not enabled")

    client_id, client_secret, _, public_app_url = _get_oauth_config(db)
    if not client_id or not client_secret:
        raise HTTPException(500, "Discord OAuth not configured")

    base_url = public_app_url or get_public_base_url(request)
    redirect_uri = f"{base_url.rstrip('/')}/api/verify/{guild_id}/callback"

    # Scopes: identify (user info) + email + guilds.join (add to server)
    scopes = "identify email guilds.join"
    params = urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scopes,
        "state": guild_id,
    })
    return RedirectResponse(f"https://discord.com/api/oauth2/authorize?{params}")


# ── OAuth2 callback ──
@router.get("/api/verify/{guild_id}/callback")
async def verify_callback(
    guild_id: str,
    code: str,
    request: Request,
    db: Session = Depends(get_db),
):
    cfg = db.execute(
        select(VerificationConfig).where(VerificationConfig.guild_id == guild_id)
    ).scalars().first()
    if not cfg or not cfg.enabled:
        raise HTTPException(404, "Verification not enabled")

    client_id, client_secret, bot_token, public_app_url = _get_oauth_config(db)
    if not client_id or not client_secret:
        raise HTTPException(500, "Discord OAuth not configured")

    base_url = public_app_url or get_public_base_url(request)
    redirect_uri = f"{base_url.rstrip('/')}/api/verify/{guild_id}/callback"
    verify_page = f"{base_url.rstrip('/')}/verify/{guild_id}"

    async with httpx.AsyncClient() as client:
        # 1. Exchange code for tokens
        token_res = await client.post(
            "https://discord.com/api/oauth2/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if token_res.status_code != 200:
            logger.error(f"Token exchange failed: {token_res.text}")
            return RedirectResponse(f"{verify_page}?error=auth_failed")

        token_data = token_res.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 604800)

        # 2. Get user info
        user_res = await client.get(
            "https://discord.com/api/users/@me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if user_res.status_code != 200:
            return RedirectResponse(f"{verify_page}?error=user_fetch_failed")
        user_info = user_res.json()
        discord_id = user_info["id"]

        # 3. Check min account age
        if cfg.min_account_age_days > 0:
            # Discord snowflake → creation timestamp
            created_ts = ((int(discord_id) >> 22) + 1420070400000) / 1000
            created_at = datetime.utcfromtimestamp(created_ts)
            age_days = (datetime.utcnow() - created_at).days
            if age_days < cfg.min_account_age_days:
                return RedirectResponse(f"{verify_page}?error=account_too_new")

        # 4. Check blacklist
        existing = db.execute(
            select(VerifiedMember).where(
                VerifiedMember.guild_id == guild_id,
                VerifiedMember.discord_id == discord_id,
            )
        ).scalars().first()
        if existing and existing.is_blacklisted:
            return RedirectResponse(f"{verify_page}?error=blacklisted")

        # 5. Get IP address
        ip_address = request.headers.get("cf-connecting-ip") or \
                     request.headers.get("x-forwarded-for", "").split(",")[0].strip() or \
                     (request.client.host if request.client else None)

        # 5a. VPN/Proxy detection
        if cfg.block_vpn and ip_address:
            vpn_key = _get_vpn_api_key(db)
            if vpn_key:
                try:
                    # Use proxycheck.io by default (matches SystemConfig.vpn_api_provider)
                    sys_cfg_vpn = db.execute(select(SystemConfig).limit(1)).scalars().first()
                    provider = sys_cfg_vpn.vpn_api_provider if sys_cfg_vpn else "proxycheck"

                    is_vpn = False
                    if provider == "ipqualityscore":
                        vpn_res = await client.get(
                            f"https://ipqualityscore.com/api/json/ip/{vpn_key}/{ip_address}",
                            timeout=5.0,
                        )
                        if vpn_res.status_code == 200:
                            data = vpn_res.json()
                            is_vpn = data.get("vpn") or data.get("proxy") or data.get("tor")
                    else:
                        # proxycheck.io
                        vpn_res = await client.get(
                            f"https://proxycheck.io/v2/{ip_address}",
                            params={"key": vpn_key, "vpn": "1", "asn": "1"},
                            timeout=5.0,
                        )
                        if vpn_res.status_code == 200:
                            data = vpn_res.json()
                            ip_data = data.get(ip_address, {})
                            is_vpn = ip_data.get("proxy") == "yes" or ip_data.get("type") == "VPN"

                    if is_vpn:
                        logger.info(f"VPN/Proxy blocked for {discord_id} from {ip_address}")
                        return RedirectResponse(f"{verify_page}?error=vpn_detected")
                except Exception as e:
                    logger.warning(f"VPN check failed (allowing): {e}")

        # 5b. Alt detection — check if IP already used by another verified member
        risk_score = 0
        alt_of = None
        if ip_address:
            ip_matches = db.execute(
                select(VerifiedMember).where(
                    VerifiedMember.guild_id == guild_id,
                    VerifiedMember.ip_address == ip_address,
                    VerifiedMember.discord_id != discord_id,
                    VerifiedMember.is_blacklisted == False,
                )
            ).scalars().all()
            if ip_matches:
                risk_score = min(50 + len(ip_matches) * 25, 100)
                alt_of = ip_matches[0].discord_id

        # 5c. Check email reuse across accounts
        user_email = user_info.get("email")
        if user_email:
            email_matches = db.execute(
                select(VerifiedMember).where(
                    VerifiedMember.guild_id == guild_id,
                    VerifiedMember.email == user_email,
                    VerifiedMember.discord_id != discord_id,
                )
            ).scalars().all()
            if email_matches:
                risk_score = max(risk_score, 75)

        # 6. Save/update verified member
        if existing:
            existing.username = user_info.get("username")
            existing.discriminator = user_info.get("discriminator")
            existing.avatar = user_info.get("avatar")
            existing.email = user_info.get("email")
            existing.ip_address = ip_address
            existing.access_token = access_token
            existing.refresh_token = refresh_token
            existing.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            existing.verified_at = datetime.utcnow()
            existing.risk_score = max(existing.risk_score, risk_score)
            if alt_of:
                meta = existing.metadata_ or {}
                meta["alt_of"] = alt_of
                existing.metadata_ = meta
        else:
            meta = {}
            if alt_of:
                meta["alt_of"] = alt_of
            member = VerifiedMember(
                guild_id=guild_id,
                discord_id=discord_id,
                username=user_info.get("username"),
                discriminator=user_info.get("discriminator"),
                avatar=user_info.get("avatar"),
                email=user_info.get("email"),
                ip_address=ip_address,
                access_token=access_token,
                refresh_token=refresh_token,
                token_expires_at=datetime.utcnow() + timedelta(seconds=expires_in),
                risk_score=risk_score,
                metadata_=meta,
            )
            db.add(member)

        # 7. Add user to guild (if not already a member) via guilds.join
        if bot_token:
            try:
                join_data = {"access_token": access_token}
                if cfg.verified_role_id:
                    join_data["roles"] = [cfg.verified_role_id]
                join_res = await client.put(
                    f"https://discord.com/api/guilds/{guild_id}/members/{discord_id}",
                    json=join_data,
                    headers={"Authorization": f"Bot {bot_token}"},
                )
                if join_res.status_code == 204:
                    # Member already in guild, just assign role
                    if cfg.verified_role_id:
                        await client.put(
                            f"https://discord.com/api/guilds/{guild_id}/members/{discord_id}/roles/{cfg.verified_role_id}",
                            headers={"Authorization": f"Bot {bot_token}"},
                        )
                    # Remove unverified role if set
                    if cfg.unverified_role_id:
                        await client.delete(
                            f"https://discord.com/api/guilds/{guild_id}/members/{discord_id}/roles/{cfg.unverified_role_id}",
                            headers={"Authorization": f"Bot {bot_token}"},
                        )
            except Exception as e:
                logger.error(f"Guild join/role assign error: {e}")

        db.commit()

    return RedirectResponse(f"{verify_page}?success=true")
