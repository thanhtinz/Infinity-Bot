from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class SystemConfigBase(BaseModel):
    discord_token: Optional[str] = None
    discord_client_id: Optional[str] = None
    discord_client_secret: Optional[str] = None
    public_app_url: Optional[str] = None
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
    
class SystemConfigResponse(SystemConfigBase):
    id: int
    bot_status: str
    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
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
