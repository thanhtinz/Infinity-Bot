"""Payment provider abstraction layer.

Supports: PayOS (VND bank transfer), PayPal, Crypto (NOWPayments), Manual QR.
Each guild can enable multiple payment methods independently.
"""
from __future__ import annotations

import asyncio
import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)


# ── Result types ──────────────────────────────────────────────────────────

@dataclass
class CheckoutResult:
    """Returned by create_checkout — contains payment URL/info."""
    checkout_url: str | None = None      # redirect URL for PayOS/PayPal
    payment_id: str | None = None        # external payment ID
    qr_url: str | None = None            # QR code image URL (PayOS / manual)
    order_code: str | None = None        # PayOS order code
    crypto_address: str | None = None    # crypto wallet address
    crypto_amount: str | None = None     # amount in crypto
    crypto_currency: str | None = None   # e.g. BTC, ETH
    raw: dict | None = None              # raw provider response


@dataclass
class PaymentStatus:
    """Returned by verify_payment."""
    paid: bool = False
    status: str = "unknown"              # paid | pending | expired | cancelled
    raw: dict | None = None


# ── Base class ────────────────────────────────────────────────────────────

class PaymentProvider(ABC):
    @abstractmethod
    async def create_checkout(
        self,
        amount: float,
        currency: str,
        order_id: int,
        description: str,
        return_url: str,
        cancel_url: str,
        config: Any,
    ) -> CheckoutResult:
        ...

    @abstractmethod
    async def verify_payment(self, payment_id: str, config: Any) -> PaymentStatus:
        ...


# ── PayOS ─────────────────────────────────────────────────────────────────

class PayOSProvider(PaymentProvider):
    async def create_checkout(self, amount, currency, order_id, description,
                              return_url, cancel_url, config) -> CheckoutResult:
        from payos import PayOS
        from payos.type import ItemData, PaymentData

        if not all([config.payos_client_id, config.payos_api_key, config.payos_checksum_key]):
            raise ValueError("PayOS not configured")

        payos = PayOS(
            client_id=config.payos_client_id,
            api_key=config.payos_api_key,
            checksum_key=config.payos_checksum_key,
        )

        order_code = int(time.time() * 1000) % 2_147_483_647
        payment_data = PaymentData(
            orderCode=order_code,
            amount=int(amount),
            description=description[:25] or f"Order #{order_id}",
            items=[ItemData(name=description[:50], quantity=1, price=int(amount))],
            cancelUrl=cancel_url,
            returnUrl=return_url,
        )

        payos_res = await asyncio.to_thread(payos.createPaymentLink, payment_data)
        return CheckoutResult(
            checkout_url=payos_res.checkoutUrl,
            qr_url=payos_res.checkoutUrl,
            order_code=str(order_code),
            payment_id=str(order_code),
            raw={"checkout_url": payos_res.checkoutUrl},
        )

    async def verify_payment(self, payment_id: str, config) -> PaymentStatus:
        from payos import PayOS

        payos = PayOS(
            client_id=config.payos_client_id,
            api_key=config.payos_api_key,
            checksum_key=config.payos_checksum_key,
        )
        info = await asyncio.to_thread(payos.getPaymentLinkInformation, int(payment_id))
        paid = getattr(info, "status", "") == "PAID"
        return PaymentStatus(paid=paid, status=getattr(info, "status", "unknown"))


# ── PayPal ────────────────────────────────────────────────────────────────

class PayPalProvider(PaymentProvider):
    def _base_url(self, config) -> str:
        mode = getattr(config, "paypal_mode", "sandbox")
        if mode == "live":
            return "https://api-m.paypal.com"
        return "https://api-m.sandbox.paypal.com"

    async def _get_access_token(self, config) -> str:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{self._base_url(config)}/v1/oauth2/token",
                data={"grant_type": "client_credentials"},
                auth=(config.paypal_client_id, config.paypal_client_secret),
            )
            res.raise_for_status()
            return res.json()["access_token"]

    async def create_checkout(self, amount, currency, order_id, description,
                              return_url, cancel_url, config) -> CheckoutResult:
        if not config.paypal_client_id or not config.paypal_client_secret:
            raise ValueError("PayPal not configured")

        token = await self._get_access_token(config)
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{self._base_url(config)}/v2/checkout/orders",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "intent": "CAPTURE",
                    "purchase_units": [{
                        "reference_id": str(order_id),
                        "description": description[:127],
                        "amount": {
                            "currency_code": currency,
                            "value": f"{amount:.2f}",
                        },
                    }],
                    "application_context": {
                        "return_url": return_url,
                        "cancel_url": cancel_url,
                        "brand_name": "Shop",
                        "user_action": "PAY_NOW",
                    },
                },
            )
            res.raise_for_status()
            data = res.json()

        approve_link = next(
            (l["href"] for l in data.get("links", []) if l["rel"] == "approve"), None
        )
        return CheckoutResult(
            checkout_url=approve_link,
            payment_id=data["id"],
            raw=data,
        )

    async def verify_payment(self, payment_id: str, config) -> PaymentStatus:
        token = await self._get_access_token(config)
        async with httpx.AsyncClient() as client:
            # Capture the order
            res = await client.post(
                f"{self._base_url(config)}/v2/checkout/orders/{payment_id}/capture",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            )
            if res.status_code == 201 or res.status_code == 200:
                data = res.json()
                status = data.get("status", "")
                return PaymentStatus(paid=status == "COMPLETED", status=status, raw=data)
            # Already captured or error — check status
            res2 = await client.get(
                f"{self._base_url(config)}/v2/checkout/orders/{payment_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            data = res2.json()
            status = data.get("status", "unknown")
            return PaymentStatus(paid=status == "COMPLETED", status=status, raw=data)


# ── Crypto (NOWPayments) ─────────────────────────────────────────────────

class CryptoProvider(PaymentProvider):
    BASE_URL = "https://api.nowpayments.io/v1"

    async def create_checkout(self, amount, currency, order_id, description,
                              return_url, cancel_url, config) -> CheckoutResult:
        if not config.crypto_api_key:
            raise ValueError("Crypto payment not configured")

        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{self.BASE_URL}/invoice",
                headers={"x-api-key": config.crypto_api_key, "Content-Type": "application/json"},
                json={
                    "price_amount": float(amount),
                    "price_currency": currency.lower(),
                    "order_id": str(order_id),
                    "order_description": description[:150],
                    "success_url": return_url,
                    "cancel_url": cancel_url,
                },
            )
            res.raise_for_status()
            data = res.json()

        return CheckoutResult(
            checkout_url=data.get("invoice_url"),
            payment_id=str(data.get("id", "")),
            raw=data,
        )

    async def verify_payment(self, payment_id: str, config) -> PaymentStatus:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{self.BASE_URL}/payment/{payment_id}",
                headers={"x-api-key": config.crypto_api_key},
            )
            if res.status_code != 200:
                return PaymentStatus(paid=False, status="error")
            data = res.json()
            status = data.get("payment_status", "")
            return PaymentStatus(
                paid=status in ("finished", "confirmed"),
                status=status,
                raw=data,
            )


# ── Manual QR ─────────────────────────────────────────────────────────────

class ManualProvider(PaymentProvider):
    """Manual payment: admin uploads QR, buyer pays offline, admin confirms."""

    async def create_checkout(self, amount, currency, order_id, description,
                              return_url, cancel_url, config) -> CheckoutResult:
        # No external checkout — returns bank info for embed
        return CheckoutResult(
            checkout_url=None,
            payment_id=f"manual_{order_id}",
            qr_url=None,  # QR image is fetched from config.manual_qr_image_id
            raw={
                "bank_name": getattr(config, "manual_bank_name", None),
                "account_holder": getattr(config, "manual_account_holder", None),
                "account_number": getattr(config, "manual_account_number", None),
                "instructions": getattr(config, "manual_instructions", None),
                "qr_image_id": getattr(config, "manual_qr_image_id", None),
            },
        )

    async def verify_payment(self, payment_id: str, config) -> PaymentStatus:
        # Manual payments are confirmed by admin — always pending until confirmed
        return PaymentStatus(paid=False, status="pending_manual")


# ── Factory ───────────────────────────────────────────────────────────────

_PROVIDERS: dict[str, type[PaymentProvider]] = {
    "payos": PayOSProvider,
    "paypal": PayPalProvider,
    "crypto": CryptoProvider,
    "manual": ManualProvider,
}


def get_provider(method: str) -> PaymentProvider:
    cls = _PROVIDERS.get(method)
    if not cls:
        raise ValueError(f"Unknown payment method: {method}")
    return cls()
