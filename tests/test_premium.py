"""
Tests for premium billing routes.

Strategy:
  - One SQLite in-memory DB (shared cache URI so all connections see same data)
  - Each test runs inside a SAVEPOINT; the fixture rolls back after the test
    so the DB is always clean without needing to drop/recreate tables.
  - The TestClient's `override_get_db` yields the SAME session as the test
    fixture so both see uncommitted fixture data.
"""
import datetime
import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session

# Import ALL models so every table is registered on Base.metadata
import src.models.models  # noqa: F401
from src.database.config import Base, get_db
from src.models.models import (
    SystemConfig, PremiumPlan, GuildSubscription, SubscriptionPayment
)
from src.api.routes.premium import router
from src.api import deps as _deps

# ── Engine (shared-cache in-memory SQLite) ────────────────────────────────────
engine = create_engine(
    "sqlite:///file:testpremium?mode=memory&cache=shared&uri=true",
    connect_args={"check_same_thread": False},
)

@event.listens_for(engine, "connect")
def _fk_pragma(dbapi_conn, _):
    dbapi_conn.execute("PRAGMA foreign_keys=ON")

Base.metadata.create_all(bind=engine)

# Session factory — new session per test (not shared global)
SessionFactory = sessionmaker(bind=engine, autocommit=False, autoflush=False)

# ── Current test session (injected per test by the fixture) ──────────────────
_current_session: Session | None = None


def override_get_db():
    """Yield the same session the test fixture is using."""
    assert _current_session is not None, "No test session active"
    yield _current_session


# ── FastAPI test app ──────────────────────────────────────────────────────────
app = FastAPI()
app.include_router(router, prefix="/api")
app.dependency_overrides[get_db] = override_get_db

# ── Auth overrides ────────────────────────────────────────────────────────────
def _owner():
    return {"sub": "owner_user", "is_owner": True}

def _user():
    return {"sub": "normal_user", "is_owner": False}

def _anon():
    from fastapi import HTTPException
    raise HTTPException(status_code=401, detail="Not logged in")

def _forbidden():
    from fastapi import HTTPException
    raise HTTPException(status_code=403, detail="Owner access required")


def set_auth(role: str):
    if role == "owner":
        app.dependency_overrides[_deps.require_owner] = _owner
        app.dependency_overrides[_deps.require_auth]  = _owner
    elif role == "user":
        app.dependency_overrides[_deps.require_owner] = _forbidden
        app.dependency_overrides[_deps.require_auth]  = _user
    else:
        app.dependency_overrides[_deps.require_owner] = _anon
        app.dependency_overrides[_deps.require_auth]  = _anon


set_auth("owner")
client = TestClient(app, raise_server_exceptions=False)


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def test_session():
    """
    Create a fresh session per test.
    Roll back at the end so every test starts clean.
    """
    global _current_session
    session = SessionFactory()
    _current_session = session
    # Truncate tables before each test (faster than drop/create)
    session.execute(__import__("sqlalchemy").text("DELETE FROM subscription_payments"))
    session.execute(__import__("sqlalchemy").text("DELETE FROM guild_subscriptions"))
    session.execute(__import__("sqlalchemy").text("DELETE FROM premium_plans"))
    session.execute(__import__("sqlalchemy").text("DELETE FROM system_config"))
    session.commit()
    yield
    session.rollback()
    session.close()
    _current_session = None
    set_auth("owner")  # reset auth after each test


@pytest.fixture
def db():
    return _current_session


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def db():
    return _current_session


@pytest.fixture
def seed_config(db):
    cfg = SystemConfig(
        currency="VND", currency_symbol="₫",
        payment_methods=["manual"],
        premium_default_renewal_days=7,
    )
    db.add(cfg)
    db.commit()
    return cfg


@pytest.fixture
def seed_plan(db):
    plan = PremiumPlan(
        code="pro", name="Pro", price=99000,
        currency="VND", interval="monthly",
        features={"custom_bot": True, "backup_retention": 30},
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@pytest.fixture
def seed_sub(db, seed_plan):
    now = datetime.datetime.utcnow()
    sub = GuildSubscription(
        guild_id="111",
        plan_id=seed_plan.id,
        status="active",
        started_at=now,
        current_period_start=now,
        current_period_end=now + datetime.timedelta(days=30),
        auto_renew=True,
        renewal_reminder_days=7,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


# ═══════════════════════════════════════════════════════════════════════════════
# Config tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestPremiumConfig:
    def test_get_config_empty_returns_empty(self):
        r = client.get("/api/premium/config")
        assert r.status_code == 200
        assert r.json() == {}

    def test_get_config_returns_fields(self, seed_config):
        r = client.get("/api/premium/config")
        assert r.status_code == 200
        data = r.json()
        assert data["currency"] == "VND"
        assert data["premium_default_renewal_days"] == 7

    def test_save_config_ok(self, seed_config):
        r = client.post("/api/premium/config", json={
            "premium_payment_instructions": "Bank transfer only",
            "premium_default_renewal_days": 5,
            "manual_bank_name": "VCB",
        })
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_save_config_invalid_renewal_days(self, seed_config):
        r = client.post("/api/premium/config", json={"premium_default_renewal_days": -1})
        assert r.status_code == 400

    def test_save_config_renewal_days_too_large(self, seed_config):
        r = client.post("/api/premium/config", json={"premium_default_renewal_days": 999})
        assert r.status_code == 400

    def test_save_config_requires_owner(self, seed_config):
        set_auth("user")
        r = client.post("/api/premium/config", json={"premium_payment_instructions": "x"})
        assert r.status_code in (401, 403)

    def test_get_config_requires_auth(self):
        set_auth("anon")
        r = client.get("/api/premium/config")
        assert r.status_code == 401

    def test_save_config_ignores_unknown_keys(self, seed_config):
        """Mass-assignment protection: unknown keys silently ignored."""
        r = client.post("/api/premium/config", json={
            "discord_token": "LEAKED",
            "premium_payment_instructions": "ok"
        })
        assert r.status_code == 200
        cfg = _current_session.query(SystemConfig).first()
        assert cfg.discord_token is None


# ═══════════════════════════════════════════════════════════════════════════════
# Plans tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestPremiumPlans:
    def test_list_plans_empty(self):
        r = client.get("/api/premium/plans")
        assert r.status_code == 200
        assert r.json() == []

    def test_create_plan_ok(self):
        r = client.post("/api/premium/plans", json={
            "code": "basic", "name": "Basic",
            "price": 49000, "currency": "VND", "interval": "monthly",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == "basic"
        assert data["price"] == 49000.0

    def test_create_plan_duplicate_code(self):
        client.post("/api/premium/plans", json={"code": "x", "name": "X", "price": 0, "interval": "monthly"})
        r = client.post("/api/premium/plans", json={"code": "x", "name": "X2", "price": 0, "interval": "monthly"})
        assert r.status_code == 400

    def test_create_plan_invalid_interval(self):
        r = client.post("/api/premium/plans", json={"code": "y", "name": "Y", "price": 0, "interval": "weekly"})
        assert r.status_code == 400

    def test_create_plan_negative_price(self):
        r = client.post("/api/premium/plans", json={"code": "z", "name": "Z", "price": -1, "interval": "monthly"})
        assert r.status_code == 400

    def test_create_plan_missing_name(self):
        r = client.post("/api/premium/plans", json={"code": "noname", "price": 0, "interval": "monthly"})
        assert r.status_code == 400

    def test_update_plan_ok(self, seed_plan):
        r = client.put(f"/api/premium/plans/{seed_plan.id}", json={"name": "Pro Plus", "price": 150000})
        assert r.status_code == 200
        assert r.json()["name"] == "Pro Plus"

    def test_update_plan_not_found(self):
        r = client.put("/api/premium/plans/99999", json={"name": "X"})
        assert r.status_code == 404

    def test_archive_plan(self, seed_plan):
        r = client.delete(f"/api/premium/plans/{seed_plan.id}")
        assert r.status_code == 200
        plans = client.get("/api/premium/plans").json()
        assert any(p["id"] == seed_plan.id and not p["active"] for p in plans)

    def test_public_plans_only_active_public(self, db):
        db.add(PremiumPlan(code="pub", name="Public", price=0, interval="monthly", active=True, is_public=True))
        db.add(PremiumPlan(code="priv", name="Private", price=0, interval="monthly", active=True, is_public=False))
        db.add(PremiumPlan(code="arch", name="Archived", price=0, interval="monthly", active=False, is_public=True))
        db.commit()
        set_auth("anon")  # public endpoint — no auth needed
        r = client.get("/api/premium/plans/public")
        assert r.status_code == 200
        codes = {p["code"] for p in r.json()}
        assert codes == {"pub"}

    def test_list_plans_requires_owner(self):
        set_auth("anon")
        r = client.get("/api/premium/plans")
        assert r.status_code == 401

    def test_plan_code_max_length(self):
        r = client.post("/api/premium/plans", json={"code": "x" * 65, "name": "N", "price": 0, "interval": "monthly"})
        assert r.status_code == 400


# ═══════════════════════════════════════════════════════════════════════════════
# Subscriptions tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestSubscriptions:
    def test_create_subscription_ok(self, seed_plan):
        r = client.post("/api/premium/subscriptions", json={
            "guild_id": "123", "plan_id": seed_plan.id,
            "status": "active", "payment_provider": "manual",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["guild_id"] == "123"
        assert data["status"] == "active"
        assert data["plan"] is not None

    def test_create_subscription_with_payment(self, seed_plan, db):
        r = client.post("/api/premium/subscriptions", json={
            "guild_id": "124", "plan_id": seed_plan.id,
            "amount": 99000, "currency": "VND",
        })
        assert r.status_code == 200
        db.expire_all()
        pmts = db.query(SubscriptionPayment).filter_by(guild_id="124").all()
        assert len(pmts) == 1
        assert pmts[0].amount == 99000

    def test_create_subscription_invalid_plan(self):
        r = client.post("/api/premium/subscriptions", json={
            "guild_id": "125", "plan_id": 99999
        })
        assert r.status_code == 404

    def test_create_subscription_invalid_status(self, seed_plan):
        r = client.post("/api/premium/subscriptions", json={
            "guild_id": "126", "plan_id": seed_plan.id, "status": "hacked"
        })
        assert r.status_code == 400

    def test_create_subscription_negative_amount(self, seed_plan):
        r = client.post("/api/premium/subscriptions", json={
            "guild_id": "127", "plan_id": seed_plan.id, "amount": -100
        })
        assert r.status_code == 400

    def test_get_guild_subscription(self, seed_sub):
        r = client.get("/api/premium/subscriptions/guild", headers={"X-Guild-ID": "111"})
        assert r.status_code == 200
        data = r.json()
        assert data["guild_id"] == "111"
        assert data["plan"]["code"] == "pro"

    def test_get_guild_subscription_missing_header(self):
        r = client.get("/api/premium/subscriptions/guild")
        assert r.status_code == 400

    def test_get_guild_subscription_unknown_guild(self, seed_sub):
        r = client.get("/api/premium/subscriptions/guild", headers={"X-Guild-ID": "999"})
        assert r.status_code == 200
        assert r.json() is None

    def test_list_subscriptions_requires_owner(self):
        set_auth("user")
        r = client.get("/api/premium/subscriptions")
        assert r.status_code in (401, 403)

    def test_extend_subscription_ok(self, seed_sub):
        r = client.post(f"/api/premium/subscriptions/{seed_sub.id}/extend", json={"days": 30})
        assert r.status_code == 200
        end = datetime.datetime.fromisoformat(r.json()["current_period_end"])
        diff = end - datetime.datetime.utcnow()
        assert 55 < diff.days < 65

    def test_extend_subscription_zero_days(self, seed_sub):
        r = client.post(f"/api/premium/subscriptions/{seed_sub.id}/extend", json={"days": 0})
        assert r.status_code == 400

    def test_extend_subscription_negative_days(self, seed_sub):
        r = client.post(f"/api/premium/subscriptions/{seed_sub.id}/extend", json={"days": -5})
        assert r.status_code == 400

    def test_cancel_subscription_immediately(self, seed_sub):
        r = client.post(f"/api/premium/subscriptions/{seed_sub.id}/cancel", json={"immediately": True})
        assert r.status_code == 200
        assert r.json()["status"] == "cancelled"
        assert r.json()["auto_renew"] is False

    def test_cancel_subscription_at_period_end(self, seed_sub):
        r = client.post(f"/api/premium/subscriptions/{seed_sub.id}/cancel", json={"immediately": False})
        assert r.status_code == 200
        assert r.json()["cancel_at_period_end"] is True

    def test_update_subscription_invalid_status(self, seed_sub):
        r = client.put(f"/api/premium/subscriptions/{seed_sub.id}", json={"status": "bogus"})
        assert r.status_code == 400

    def test_update_subscription_bad_date(self, seed_sub):
        r = client.put(f"/api/premium/subscriptions/{seed_sub.id}", json={"current_period_end": "not-a-date"})
        assert r.status_code == 400


# ═══════════════════════════════════════════════════════════════════════════════
# Payments tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestPayments:
    def test_record_payment_ok(self, seed_plan):
        r = client.post("/api/premium/payments", json={
            "guild_id": "200", "amount": 99000,
            "payment_method": "manual", "plan_id": seed_plan.id,
        })
        assert r.status_code == 200
        data = r.json()
        assert data["amount"] == 99000
        assert data["status"] == "paid"
        assert data["paid_at"] is not None

    def test_record_payment_invalid_method(self):
        r = client.post("/api/premium/payments", json={
            "guild_id": "201", "amount": 100, "payment_method": "bitcoin"
        })
        assert r.status_code == 400

    def test_record_payment_missing_amount(self):
        r = client.post("/api/premium/payments", json={"guild_id": "202"})
        assert r.status_code == 400

    def test_record_payment_negative_amount(self):
        r = client.post("/api/premium/payments", json={"guild_id": "203", "amount": -50})
        assert r.status_code == 400

    def test_record_payment_bad_period_date(self):
        r = client.post("/api/premium/payments", json={
            "guild_id": "204", "amount": 0, "period_start": "bad-date"
        })
        assert r.status_code == 400

    def test_get_guild_payments(self, db, seed_plan):
        db.add(SubscriptionPayment(
            guild_id="300", plan_id=seed_plan.id,
            amount=50000, currency="VND", payment_method="manual",
        ))
        db.commit()
        r = client.get("/api/premium/payments/guild", headers={"X-Guild-ID": "300"})
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_update_payment_status(self, db, seed_plan):
        pmt = SubscriptionPayment(
            guild_id="301", plan_id=seed_plan.id,
            amount=10, currency="VND", payment_method="manual", status="pending",
        )
        db.add(pmt)
        db.commit()
        db.refresh(pmt)
        r = client.put(f"/api/premium/payments/{pmt.id}", json={"status": "paid"})
        assert r.status_code == 200
        assert r.json()["status"] == "paid"
        assert r.json()["paid_at"] is not None

    def test_update_payment_invalid_status(self, db, seed_plan):
        pmt = SubscriptionPayment(
            guild_id="302", plan_id=seed_plan.id,
            amount=10, currency="VND", payment_method="manual", status="pending",
        )
        db.add(pmt)
        db.commit()
        db.refresh(pmt)
        r = client.put(f"/api/premium/payments/{pmt.id}", json={"status": "bogus"})
        assert r.status_code == 400

    def test_list_payments_requires_owner(self):
        set_auth("user")
        r = client.get("/api/premium/payments")
        assert r.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════════════════════════
# Entitlements tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestEntitlements:
    def test_no_subscription_returns_free(self):
        r = client.get("/api/premium/entitlements", headers={"X-Guild-ID": "400"})
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "free"
        assert data["features"] == {}

    def test_active_subscription_returns_features(self, seed_sub):
        r = client.get("/api/premium/entitlements", headers={"X-Guild-ID": "111"})
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "active"
        assert data["features"]["custom_bot"] is True
        assert data["features"]["backup_retention"] == 30

    def test_expired_subscription_returns_free(self, db, seed_plan):
        now = datetime.datetime.utcnow()
        sub = GuildSubscription(
            guild_id="401", plan_id=seed_plan.id, status="expired",
            started_at=now, current_period_start=now,
            current_period_end=now - datetime.timedelta(days=1),
        )
        db.add(sub)
        db.commit()
        r = client.get("/api/premium/entitlements", headers={"X-Guild-ID": "401"})
        assert r.status_code == 200
        assert r.json()["status"] == "free"

    def test_entitlements_requires_auth(self):
        set_auth("anon")
        r = client.get("/api/premium/entitlements", headers={"X-Guild-ID": "400"})
        assert r.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════════
# Reminder scan tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestReminderScan:
    def test_scan_empty(self):
        r = client.post("/api/premium/reminders/scan")
        assert r.status_code == 200
        assert r.json()["scanned"] == 0

    def test_scan_marks_expired(self, db, seed_plan):
        now = datetime.datetime.utcnow()
        sub = GuildSubscription(
            guild_id="500", plan_id=seed_plan.id, status="active",
            started_at=now, current_period_start=now,
            current_period_end=now - datetime.timedelta(days=1),
            renewal_reminder_days=7,
        )
        db.add(sub)
        db.commit()
        client.post("/api/premium/reminders/scan")
        db.expire_all()
        db.refresh(sub)
        assert sub.status == "expired"

    def test_scan_returns_due_reminders(self, db, seed_plan):
        now = datetime.datetime.utcnow()
        sub = GuildSubscription(
            guild_id="501", plan_id=seed_plan.id, status="active",
            started_at=now, current_period_start=now,
            current_period_end=now + datetime.timedelta(days=3),
            renewal_reminder_days=7,
        )
        db.add(sub)
        db.commit()
        r = client.post("/api/premium/reminders/scan")
        data = r.json()
        assert data["scanned"] == 1
        assert len(data["reminders_due"]) == 1
        assert data["reminders_due"][0]["days_left"] <= 3   # floor division may give 2

    def test_scan_no_duplicate_same_day(self, db, seed_plan):
        """Second scan same day must NOT duplicate reminder."""
        now = datetime.datetime.utcnow()
        sub = GuildSubscription(
            guild_id="502", plan_id=seed_plan.id, status="active",
            started_at=now, current_period_start=now,
            current_period_end=now + datetime.timedelta(days=3),
            renewal_reminder_days=7,
        )
        db.add(sub)
        db.commit()
        client.post("/api/premium/reminders/scan")
        r2 = client.post("/api/premium/reminders/scan")
        assert len(r2.json()["reminders_due"]) == 0

    def test_scan_not_due_far_future(self, db, seed_plan):
        now = datetime.datetime.utcnow()
        sub = GuildSubscription(
            guild_id="503", plan_id=seed_plan.id, status="active",
            started_at=now, current_period_start=now,
            current_period_end=now + datetime.timedelta(days=30),
            renewal_reminder_days=7,
        )
        db.add(sub)
        db.commit()
        r = client.post("/api/premium/reminders/scan")
        assert len(r.json()["reminders_due"]) == 0

    def test_scan_requires_owner(self):
        set_auth("user")
        r = client.post("/api/premium/reminders/scan")
        assert r.status_code in (401, 403)
