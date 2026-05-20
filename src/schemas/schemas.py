from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class SystemConfigBase(BaseModel):
    discord_token: Optional[str] = None
    discord_client_id: Optional[str] = None
    discord_client_secret: Optional[str] = None
    public_app_url: Optional[str] = None
    support_server_url: Optional[str] = None
    payos_client_id: Optional[str] = None
    payos_api_key: Optional[str] = None
    payos_checksum_key: Optional[str] = None
    guild_id: Optional[str] = None
    admin_role_id: Optional[str] = None
    don_hang_channel_id: Optional[str] = None
    feedback_channel_id: Optional[str] = None
    coupon_channel_id: Optional[str] = None
    bang_gia_channel_id: Optional[str] = None
    welcome_channel_id: Optional[str] = None
    command_prefix: Optional[str] = "!"
    bot_invisible: Optional[bool] = None
    language: Optional[str] = "en"
    
class SystemConfigResponse(SystemConfigBase):
    """Full response — dùng nội bộ (không expose qua API public)."""
    id: int
    bot_status: str
    class Config:
        from_attributes = True


class SystemConfigSafe(BaseModel):
    """Safe response — does not expose secrets, used for GET /api/config."""
    id: int
    bot_status: str
    # Non-secret fields
    discord_client_id: Optional[str] = None
    public_app_url: Optional[str] = None
    support_server_url: Optional[str] = None
    payos_client_id: Optional[str] = None
    guild_id: Optional[str] = None
    admin_role_id: Optional[str] = None
    don_hang_channel_id: Optional[str] = None
    feedback_channel_id: Optional[str] = None
    coupon_channel_id: Optional[str] = None
    bang_gia_channel_id: Optional[str] = None
    welcome_channel_id: Optional[str] = None
    command_prefix: Optional[str] = "!"
    # Booleans for secrets
    has_discord_token: bool = False
    has_discord_client_secret: bool = False
    has_payos_api_key: bool = False
    has_payos_checksum_key: bool = False
    bot_invisible: bool = False
    language: str = "en"
    # Currency & Payment
    currency: str = "VND"
    currency_symbol: str = "₫"
    payment_methods: Optional[List[str]] = []
    has_paypal_client_id: bool = False
    has_paypal_client_secret: bool = False
    paypal_mode: str = "sandbox"
    has_crypto_api_key: bool = False
    crypto_provider: str = "nowpayments"
    manual_qr_image_id: Optional[str] = None
    manual_bank_name: Optional[str] = None
    manual_account_holder: Optional[str] = None
    manual_account_number: Optional[str] = None
    manual_instructions: Optional[str] = None
    # Flash Sale + BXH + Inventory
    flash_sale_channel_id: Optional[str] = None
    spending_leaderboard_channel_id: Optional[str] = None
    spending_leaderboard_schedule: Optional[str] = None
    spending_leaderboard_time: Optional[str] = None
    inventory_low_stock_threshold: int = 5

    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    note: Optional[str] = None
    image_url: Optional[str] = None
    emoji: Optional[str] = None
    category_id: Optional[int] = None
    packages: Optional[List[dict]] = []  # [{"name": str, "price": float, "active": bool}]
    active: bool = True

class ProductResponse(ProductBase):
    id: int
    price: float = 0  # legacy field
    class Config:
        from_attributes = True

class OrderResponse(BaseModel):
    id: int
    user_id: int
    product_id: int
    quantity: int
    total_price: float
    status: str
    payos_order_code: Optional[str] = None
    checkout_url: Optional[str] = None
    package_name: Optional[str] = None
    created_at: datetime
    # Joined info
    user_discord_id: Optional[str] = None
    user_username: Optional[str] = None
    product_name: Optional[str] = None
    class Config:
        from_attributes = True
