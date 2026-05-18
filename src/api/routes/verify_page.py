"""Public Verify Page routes — OAuth2 verification flow for members.

These routes are PUBLIC (no dashboard auth required).
Flow: /verify/{guild_id} → Discord OAuth2 → callback → save member → assign role.
"""
import logging
import hashlib
import secrets
import time
import httpx
from datetime import datetime, timedelta
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.models.models import SystemConfig, VerificationConfig, VerifiedMember, FirewallRule, FirewallLog, GuildBot
from src.api.auth import get_public_base_url, get_discord_oauth_config

logger = logging.getLogger(__name__)
router = APIRouter()

# ── In-memory captcha token store (short-lived, max 10 min) ──
_captcha_tokens: dict[str, float] = {}  # token → expiry timestamp
_CAPTCHA_TTL = 600  # 10 minutes


def _issue_captcha_token() -> str:
    """Issue a one-time captcha token valid for 10 minutes."""
    # Cleanup expired
    now = time.time()
    expired = [k for k, v in _captcha_tokens.items() if v < now]
    for k in expired:
        _captcha_tokens.pop(k, None)
    token = secrets.token_urlsafe(32)
    _captcha_tokens[token] = now + _CAPTCHA_TTL
    return token


def _validate_captcha_token(token: str) -> bool:
    """Validate and consume a captcha token (one-time use)."""
    expiry = _captcha_tokens.pop(token, None)
    if expiry is None:
        return False
    return time.time() < expiry


def _get_oauth_config(db: Session, guild_id: str = None):
    """Get Discord OAuth2 config — guild-specific bot first, fallback to main bot."""
    # Try guild-specific bot
    if guild_id:
        gbot = db.execute(
            select(GuildBot).where(GuildBot.guild_id == guild_id, GuildBot.status == "active")
        ).scalars().first()
        if gbot and gbot.client_id and gbot.client_secret and gbot.bot_token:
            cfg = db.execute(select(SystemConfig).limit(1)).scalars().first()
            public_url = cfg.public_app_url if cfg else None
            return gbot.client_id, gbot.client_secret, gbot.bot_token, public_url

    # Fallback to main bot
    cfg = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not cfg:
        return None, None, None, None
    return cfg.discord_client_id, cfg.discord_client_secret, cfg.discord_token, cfg.public_app_url


def _get_vpn_api_key(db: Session, guild_id: str) -> tuple[str | None, str]:
    """Get VPN API key from per-guild VerificationConfig."""
    cfg = db.execute(
        select(VerificationConfig).where(VerificationConfig.guild_id == guild_id)
    ).scalars().first()
    if cfg and getattr(cfg, "vpn_api_key", None):
        return cfg.vpn_api_key, getattr(cfg, "vpn_api_provider", "proxycheck") or "proxycheck"
    # Fallback to SystemConfig for backward compat
    sc = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if sc and sc.vpn_api_key:
        return sc.vpn_api_key, getattr(sc, "vpn_api_provider", "proxycheck") or "proxycheck"
    return None, "proxycheck"


# ── Custom domain → guild_id lookup (no auth) ──
@router.get("/verify/by-domain")
def get_guild_by_domain(host: str, db: Session = Depends(get_db)):
    """Resolve a custom domain to a guild_id. Used by the frontend for custom-domain verify pages."""
    host = host.strip().lower().removeprefix("https://").removeprefix("http://").split("/")[0]
    cfg = db.execute(
        select(VerificationConfig).where(
            func.lower(VerificationConfig.custom_domain) == host
        )
    ).scalars().first()
    if not cfg:
        raise HTTPException(404, "No guild configured for this domain")
    return {"guild_id": cfg.guild_id}


@router.get("/verify/by-slug/{slug}")
def get_guild_by_slug(slug: str, db: Session = Depends(get_db)):
    """Resolve a custom slug (e.g. /verify/myserver) to a guild_id."""
    cfg = db.execute(
        select(VerificationConfig).where(
            func.lower(VerificationConfig.verify_slug) == slug.strip().lower()
        )
    ).scalars().first()
    if not cfg:
        raise HTTPException(404, "No guild configured for this slug")
    return {"guild_id": cfg.guild_id}


# ── Public config for verify page branding (no auth) ──
@router.get("/verify/{guild_id}/debug-appearance")
def debug_appearance(guild_id: str, db: Session = Depends(get_db)):
    """Debug endpoint: returns raw appearance column values from DB (no auth)."""
    cfg = db.execute(
        select(VerificationConfig).where(VerificationConfig.guild_id == guild_id)
    ).scalars().first()
    if not cfg:
        return {"error": "No config row found for this guild_id"}
    return {
        "guild_id": guild_id,
        "enabled": cfg.enabled,
        "bg_effect": getattr(cfg, "bg_effect", "__missing__"),
        "bg_color": getattr(cfg, "bg_color", "__missing__"),
        "text_color": getattr(cfg, "text_color", "__missing__"),
        "btn_color": getattr(cfg, "btn_color", "__missing__"),
        "btn_border_color": getattr(cfg, "btn_border_color", "__missing__"),
        "card_bg_color": getattr(cfg, "card_bg_color", "__missing__"),
        "card_border_color": getattr(cfg, "card_border_color", "__missing__"),
        "typewriter_effect": getattr(cfg, "typewriter_effect", "__missing__"),
        "glow_effect": getattr(cfg, "glow_effect", "__missing__"),
        "tilt_effect": getattr(cfg, "tilt_effect", "__missing__"),
        "font_family": getattr(cfg, "font_family", "__missing__"),
    }


@router.get("/verify/{guild_id}/config")
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
        "success_message": getattr(cfg, "success_message", "") or "",
        "captcha_enabled": cfg.captcha_enabled,
        "captcha_type": getattr(cfg, "captcha_type", "none") or "none",
        "captcha_difficulty": getattr(cfg, "captcha_difficulty", "medium") or "medium",
        "page_footer_text": getattr(cfg, "page_footer_text", "") or "",
        "server_name": guild_name,
        "server_icon": guild_icon,
        # Advanced customization
        "banner_url": getattr(cfg, "banner_url", "") or "",
        "cursor_url": getattr(cfg, "cursor_url", "") or "",
        "font_family": getattr(cfg, "font_family", "Inter") or "Inter",
        "bg_effect": getattr(cfg, "bg_effect", "none") or "none",
        "bg_color": getattr(cfg, "bg_color", "#0b0d14") or "#0b0d14",
        "text_color": getattr(cfg, "text_color", "#ffffff") or "#ffffff",
        "btn_color": getattr(cfg, "btn_color", "") or "",
        "btn_border_color": getattr(cfg, "btn_border_color", "") or "",
        "card_border_color": getattr(cfg, "card_border_color", "#1a1d2e") or "#1a1d2e",
        "card_bg_color": getattr(cfg, "card_bg_color", "#1a1d2e") or "#1a1d2e",
        "card_opacity": getattr(cfg, "card_opacity", 95) if getattr(cfg, "card_opacity", None) is not None else 95,
        "typewriter_effect": getattr(cfg, "typewriter_effect", False),
        "typewriter_desc_effect": getattr(cfg, "typewriter_desc_effect", False),
        "glow_effect": getattr(cfg, "glow_effect", False),
        "tilt_effect": getattr(cfg, "tilt_effect", False),
        "bio_description": getattr(cfg, "bio_description", "") or "",
        "socials": getattr(cfg, "socials", {}) or {},
        "music_url": getattr(cfg, "music_url", "") or "",
        "terms_url": getattr(cfg, "terms_url", "") or "",
        "custom_css": getattr(cfg, "custom_css", "") or "",
    }


# ── Captcha challenge generation & validation ──
import random

@router.post("/verify/{guild_id}/captcha/generate")
def generate_captcha(guild_id: str, db: Session = Depends(get_db)):
    """Generate a captcha challenge based on guild config."""
    cfg = db.execute(
        select(VerificationConfig).where(VerificationConfig.guild_id == guild_id)
    ).scalars().first()
    if not cfg or not cfg.enabled:
        raise HTTPException(404, "Verification not enabled")

    captcha_type = getattr(cfg, "captcha_type", "none") or "none"
    difficulty = getattr(cfg, "captcha_difficulty", "medium") or "medium"

    if captcha_type == "none":
        # No captcha — issue token immediately
        return {"type": "none", "token": _issue_captcha_token()}

    if captcha_type == "button":
        # Simple button click (easiest)
        return {"type": "button", "message": "Click the button to verify you are human"}

    if captcha_type == "emoji":
        # Pick N emojis, ask user to select the correct one
        all_emojis = ["🍎", "🍊", "🍋", "🍇", "🍓", "🍒", "🍑", "🥭", "🍍", "🥥",
                      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
                      "⭐", "🌙", "☀️", "🌈", "❄️", "🔥", "💧", "⚡", "🌸", "🍀"]
        target = random.choice(all_emojis)
        count = {"easy": 4, "medium": 6, "hard": 9}[difficulty]
        options = random.sample([e for e in all_emojis if e != target], count - 1) + [target]
        random.shuffle(options)
        # Store answer hash in challenge_id
        answer_hash = hashlib.sha256(f"{guild_id}:{target}:{time.time()//60}".encode()).hexdigest()[:16]
        return {
            "type": "emoji",
            "message": f"Select the {target} emoji",
            "target": target,
            "options": options,
            "challenge_id": answer_hash,
        }

    if captcha_type == "math":
        # Math problem
        if difficulty == "easy":
            a, b = random.randint(1, 10), random.randint(1, 10)
            op = random.choice(["+", "-"])
        elif difficulty == "hard":
            a, b = random.randint(10, 99), random.randint(10, 99)
            op = random.choice(["+", "-", "×"])
        else:  # medium
            a, b = random.randint(1, 50), random.randint(1, 50)
            op = random.choice(["+", "-", "×"])
        answer = a + b if op == "+" else (a - b if op == "-" else a * b)
        return {
            "type": "math",
            "question": f"{a} {op} {b} = ?",
            "answer_hash": hashlib.sha256(str(answer).encode()).hexdigest()[:16],
        }

    if captcha_type == "slider":
        # Slider verification — user must drag to a target position
        target = random.randint(60, 90)  # percentage
        return {
            "type": "slider",
            "target": target,
            "tolerance": {"easy": 10, "medium": 5, "hard": 3}[difficulty],
        }

    return {"type": "none", "token": _issue_captcha_token()}


@router.post("/verify/{guild_id}/captcha/validate")
def validate_captcha(guild_id: str, body: dict, db: Session = Depends(get_db)):
    """Validate captcha answer and return a one-time token."""
    cfg = db.execute(
        select(VerificationConfig).where(VerificationConfig.guild_id == guild_id)
    ).scalars().first()
    if not cfg or not cfg.enabled:
        raise HTTPException(404, "Verification not enabled")

    captcha_type = getattr(cfg, "captcha_type", "none") or "none"

    if captcha_type == "none":
        return {"valid": True, "token": _issue_captcha_token()}

    if captcha_type == "button":
        # Button click — just issue token
        return {"valid": True, "token": _issue_captcha_token()}

    if captcha_type == "emoji":
        selected = body.get("selected")
        target = body.get("target")
        if selected == target:
            return {"valid": True, "token": _issue_captcha_token()}
        return {"valid": False, "error": "Wrong emoji selected"}

    if captcha_type == "math":
        answer = str(body.get("answer", "")).strip()
        answer_hash = body.get("answer_hash", "")
        if hashlib.sha256(answer.encode()).hexdigest()[:16] == answer_hash:
            return {"valid": True, "token": _issue_captcha_token()}
        return {"valid": False, "error": "Wrong answer"}

    if captcha_type == "slider":
        value = body.get("value", 0)
        target = body.get("target", 75)
        tolerance = body.get("tolerance", 5)
        if abs(value - target) <= tolerance:
            return {"valid": True, "token": _issue_captcha_token()}
        return {"valid": False, "error": "Try again"}

    return {"valid": True, "token": _issue_captcha_token()}


# ── Start OAuth2 flow ──
@router.get("/verify/{guild_id}/start")
def start_verification(guild_id: str, request: Request, fp: str = "", captcha_token: str = "", db: Session = Depends(get_db)):
    cfg = db.execute(
        select(VerificationConfig).where(VerificationConfig.guild_id == guild_id)
    ).scalars().first()
    if not cfg or not cfg.enabled:
        raise HTTPException(404, "Verification not enabled")

    # Validate captcha token if captcha is enabled
    captcha_type = getattr(cfg, "captcha_type", "none") or "none"
    if captcha_type != "none":
        if not captcha_token or not _validate_captcha_token(captcha_token):
            raise HTTPException(403, "Captcha required")

    # Get OAuth credentials — guild-specific bot first, fallback to main bot
    # Use get_discord_oauth_config for public_app_url with full fallback chain (DB → env → request)
    gbot = db.execute(
        select(GuildBot).where(GuildBot.guild_id == guild_id, GuildBot.status == "active")
    ).scalars().first()

    if gbot and gbot.client_id and gbot.client_secret:
        # Custom bot — use their client creds but get public_app_url from main config
        _, _, _, _, public_app_url = get_discord_oauth_config(db, request)
        client_id, client_secret = gbot.client_id, gbot.client_secret
    else:
        _, client_id, client_secret, _, public_app_url = get_discord_oauth_config(db, request)

    if not client_id or not client_secret:
        raise HTTPException(500, "Discord OAuth not configured")
    if not public_app_url:
        raise HTTPException(500, "Public app URL not configured — set it in Bot Settings")

    redirect_uri = f"{public_app_url.rstrip('/')}/api/verify/callback"

    # Encode guild_id + fingerprint in state: "guild_id:fp"
    state = f"{guild_id}:{fp}"  # always include guild_id so callback can recover it

    # Scopes: identify (user info) + email + guilds.join (add to server)
    scopes = "identify email guilds.join"
    params = urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scopes,
        "state": state,
    })
    return RedirectResponse(f"https://discord.com/api/oauth2/authorize?{params}")


# ── OAuth2 callback (fixed URL — no guild_id in path) ──
@router.get("/verify/callback")
async def verify_callback(
    code: str,
    request: Request,
    state: str = "",
    db: Session = Depends(get_db),
):
    # Extract guild_id + fingerprint from state: "guild_id:fp"
    parts = state.split(":", 1)
    guild_id = parts[0] if parts else ""
    _fp_from_state = parts[1] if len(parts) > 1 else ""

    if not guild_id:
        raise HTTPException(400, "Invalid state — missing guild_id")

    cfg = db.execute(
        select(VerificationConfig).where(VerificationConfig.guild_id == guild_id)
    ).scalars().first()
    if not cfg or not cfg.enabled:
        raise HTTPException(404, "Verification not enabled")

    # Get OAuth credentials — same logic as start_verification
    gbot = db.execute(
        select(GuildBot).where(GuildBot.guild_id == guild_id, GuildBot.status == "active")
    ).scalars().first()

    if gbot and gbot.client_id and gbot.client_secret:
        _, _, _, _, public_app_url = get_discord_oauth_config(db, request)
        client_id, client_secret = gbot.client_id, gbot.client_secret
        bot_token = gbot.bot_token
    else:
        _, client_id, client_secret, bot_token, public_app_url = get_discord_oauth_config(db, request)

    if not client_id or not client_secret:
        raise HTTPException(500, "Discord OAuth not configured")
    if not public_app_url:
        raise HTTPException(500, "Public app URL not configured")

    redirect_uri = f"{public_app_url.rstrip('/')}/api/verify/callback"
    verify_page = f"{public_app_url.rstrip('/')}/verify/{guild_id}"

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
            vpn_key, provider = _get_vpn_api_key(db, guild_id)
            if vpn_key:
                try:
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

        # 5a2. Firewall rule enforcement (IP, ASN, Country, user_id, email_domain)
        ip_country = None
        ip_asn = None
        if ip_address:
            # Try to get country/ASN from proxycheck or ipapi
            try:
                geo_res = await client.get(f"http://ip-api.com/json/{ip_address}?fields=countryCode,as", timeout=3.0)
                if geo_res.status_code == 200:
                    geo = geo_res.json()
                    ip_country = geo.get("countryCode")
                    ip_asn = geo.get("as", "").split()[0] if geo.get("as") else None  # e.g. "AS13335"
            except Exception:
                pass

        # Check firewall block rules
        block_rules = db.execute(
            select(FirewallRule).where(
                FirewallRule.guild_id == guild_id,
                FirewallRule.rule_type == "block",
            )
        ).scalars().all()

        user_email = user_info.get("email")
        email_domain = user_email.split("@")[1] if user_email and "@" in user_email else None

        for rule in block_rules:
            matched = False
            if rule.target_type == "user_id" and rule.target_value == discord_id:
                matched = True
            elif rule.target_type == "ip" and rule.target_value == ip_address:
                matched = True
            elif rule.target_type == "country" and ip_country and rule.target_value.upper() == ip_country.upper():
                matched = True
            elif rule.target_type == "asn" and ip_asn and rule.target_value.upper() == ip_asn.upper():
                matched = True
            elif rule.target_type == "email_domain" and email_domain and rule.target_value.lower() == email_domain.lower():
                matched = True

            if matched:
                # Log the block
                log = FirewallLog(
                    guild_id=guild_id,
                    discord_id=discord_id,
                    username=user_info.get("username"),
                    avatar_url=f"https://cdn.discordapp.com/avatars/{discord_id}/{user_info.get('avatar')}.png" if user_info.get("avatar") else None,
                    ip_address=ip_address,
                    country=ip_country,
                    blocked_by="firewall",
                    rule_id=rule.id,
                    details={"rule_type": rule.target_type, "rule_value": rule.target_value, "reason": rule.reason},
                )
                db.add(log)
                db.commit()
                logger.info(f"Firewall blocked {discord_id}: {rule.target_type}={rule.target_value}")
                return RedirectResponse(f"{verify_page}?error=blocked")

        # 5a3. Browser fingerprint for alt detection
        fingerprint = _fp_from_state or request.query_params.get("fp", "")  # From OAuth state or query param

        # 5b. Alt detection — check if IP or fingerprint already used by another verified member
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

        # Fingerprint-based alt detection
        if fingerprint and not alt_of:
            fp_matches = db.execute(
                select(VerifiedMember).where(
                    VerifiedMember.guild_id == guild_id,
                    VerifiedMember.discord_id != discord_id,
                    VerifiedMember.is_blacklisted == False,
                ).filter(
                    VerifiedMember.metadata_.op("->>")("fingerprint") == fingerprint
                )
            ).scalars().all()
            if fp_matches:
                risk_score = max(risk_score, min(60 + len(fp_matches) * 20, 100))
                if not alt_of:
                    alt_of = fp_matches[0].discord_id

        # 5c. Check email reuse across accounts
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
            existing.ip_address = ip_address if not getattr(cfg, "no_save_ip", False) else None
            existing.access_token = access_token
            existing.refresh_token = refresh_token
            existing.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            existing.verified_at = datetime.utcnow()
            existing.risk_score = max(existing.risk_score, risk_score)
            meta = existing.metadata_ or {}
            if alt_of:
                meta["alt_of"] = alt_of
            if fingerprint:
                meta["fingerprint"] = fingerprint
            if ip_country:
                meta["country"] = ip_country
            if ip_asn:
                meta["asn"] = ip_asn
            existing.metadata_ = meta
        else:
            meta = {}
            if alt_of:
                meta["alt_of"] = alt_of
            if fingerprint:
                meta["fingerprint"] = fingerprint
            if ip_country:
                meta["country"] = ip_country
            if ip_asn:
                meta["asn"] = ip_asn
            member = VerifiedMember(
                guild_id=guild_id,
                discord_id=discord_id,
                username=user_info.get("username"),
                discriminator=user_info.get("discriminator"),
                avatar=user_info.get("avatar"),
                email=user_info.get("email"),
                ip_address=ip_address if not getattr(cfg, "no_save_ip", False) else None,
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
