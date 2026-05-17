"""Server Alerts API — per-guild nuke/raid detection configuration."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database.config import get_db
from src.api.dependencies import get_guild_id
from src.models.models import ServerAlert, AlertHistory

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

DEFAULT_ALERT_TYPES = [
    {"type": "mass_ban", "label": "Mass Ban", "threshold": 5, "window": 5},
    {"type": "mass_kick", "label": "Mass Kick", "threshold": 5, "window": 5},
    {"type": "channel_delete", "label": "Channel Delete Storm", "threshold": 3, "window": 5},
    {"type": "role_delete", "label": "Role Delete Storm", "threshold": 3, "window": 5},
    {"type": "nuke_detect", "label": "Nuke Detection", "threshold": 3, "window": 2},
]


@router.get("/config")
def get_alert_config(db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    alerts = db.execute(
        select(ServerAlert).where(ServerAlert.guild_id == guild_id)
    ).scalars().all()

    alert_map = {a.alert_type: a for a in alerts}
    result = []
    for d in DEFAULT_ALERT_TYPES:
        existing = alert_map.get(d["type"])
        result.append({
            "id": existing.id if existing else None,
            "alert_type": d["type"],
            "label": d["label"],
            "enabled": existing.enabled if existing else False,
            "threshold": existing.threshold if existing else d["threshold"],
            "window_minutes": existing.window_minutes if existing else d["window"],
            "webhook_url": existing.webhook_url if existing else None,
        })
    return result


@router.post("/config")
def save_alert_config(body: dict, db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    alerts_data = body.get("alerts", [])
    webhook_url = body.get("webhook_url")

    for ad in alerts_data:
        alert_type = ad.get("alert_type")
        if not alert_type:
            continue
        existing = db.execute(
            select(ServerAlert).where(
                ServerAlert.guild_id == guild_id,
                ServerAlert.alert_type == alert_type,
            )
        ).scalars().first()

        if existing:
            existing.enabled = ad.get("enabled", existing.enabled)
            existing.threshold = ad.get("threshold", existing.threshold)
            existing.window_minutes = ad.get("window_minutes", existing.window_minutes)
            if webhook_url is not None:
                existing.webhook_url = webhook_url
        else:
            new_alert = ServerAlert(
                guild_id=guild_id,
                alert_type=alert_type,
                enabled=ad.get("enabled", False),
                threshold=ad.get("threshold", 3),
                window_minutes=ad.get("window_minutes", 5),
                webhook_url=webhook_url,
            )
            db.add(new_alert)

    db.commit()
    return {"ok": True}


@router.get("/history")
def get_alert_history(
    alert_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    guild_id: str = Depends(get_guild_id),
):
    q = select(AlertHistory).where(AlertHistory.guild_id == guild_id)
    if alert_type:
        q = q.where(AlertHistory.alert_type == alert_type)
    q = q.order_by(AlertHistory.created_at.desc()).limit(limit).offset(offset)
    entries = db.execute(q).scalars().all()
    return [
        {
            "id": e.id,
            "alert_type": e.alert_type,
            "actor_id": e.actor_id,
            "actor_name": e.actor_name,
            "details": e.details,
            "severity": e.severity,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in entries
    ]


@router.post("/test")
def test_alert(db: Session = Depends(get_db), guild_id: str = Depends(get_guild_id)):
    """Send a test alert entry to verify webhook/config works."""
    entry = AlertHistory(
        guild_id=guild_id,
        alert_type="test",
        actor_name="System",
        details={"message": "This is a test alert"},
        severity="info",
    )
    db.add(entry)
    db.commit()
    return {"ok": True, "message": "Test alert created"}
