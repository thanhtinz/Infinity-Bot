from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
import datetime
from src.database.config import Base

class SystemConfig(Base):
    __tablename__ = "system_config"
    id = Column(Integer, primary_key=True, index=True)
    discord_token = Column(String, nullable=True)
    discord_client_id = Column(String, nullable=True)
    discord_client_secret = Column(String, nullable=True)
    public_app_url = Column(String, nullable=True)
    payos_client_id = Column(String, nullable=True)
    payos_api_key = Column(String, nullable=True)
    payos_checksum_key = Column(String, nullable=True)
    guild_id = Column(String, nullable=True)
    admin_role_id = Column(String, nullable=True)
    don_hang_channel_id = Column(String, nullable=True)
    feedback_channel_id = Column(String, nullable=True)
    coupon_channel_id = Column(String, nullable=True)
    bang_gia_channel_id = Column(String, nullable=True)
    welcome_channel_id = Column(String, nullable=True)
    bot_status = Column(String, default="offline") # offline, running

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    discord_id = Column(String, unique=True, index=True)
    username = Column(String)
    total_spent = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    orders = relationship("Order", back_populates="user")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    description = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    price = Column(Float, default=0)  # kept for compat, use packages instead
    packages = Column(JSON, default=list)  # [{"name": str, "price": float, "active": bool}]
    active = Column(Boolean, default=True)

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, default=1)
    total_price = Column(Float)
    status = Column(String, default="PENDING") # PENDING, PAID, DELIVERED, CANCELLED, ERROR
    payos_order_code = Column(String, nullable=True) # orderCode from payos (must be unique integer mapped to string)
    checkout_url = Column(String, nullable=True)     # PayOS checkout link, lưu để hiện trên dashboard
    discord_message_id = Column(String, nullable=True)
    discord_channel_id = Column(String, nullable=True)
    package_name = Column(String, nullable=True)  # tên gói đã mua
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User", back_populates="orders")
    product = relationship("Product")

class Coupon(Base):
    __tablename__ = "coupons"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)
    discount_percent = Column(Float, nullable=True)
    discount_amount = Column(Float, nullable=True)
    max_uses = Column(Integer, default=1)
    used_count = Column(Integer, default=0)
    is_public = Column(Boolean, default=False)

class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    stars = Column(Integer)
    content = Column(Text, nullable=True)
    discord_message_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user = relationship("User", foreign_keys=[user_id])
    product = relationship("Product", foreign_keys=[product_id])

class Warning(Base):
    __tablename__ = "warnings"
    id = Column(Integer, primary_key=True, index=True)
    discord_id = Column(String, nullable=False)
    guild_id = Column(String, nullable=False)
    reason = Column(Text, nullable=True)
    moderator_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Giveaway(Base):
    __tablename__ = "giveaways"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    channel_id = Column(String, nullable=False)
    message_id = Column(String, nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    prize = Column(String, nullable=False)
    winners_count = Column(Integer, default=1)
    ends_at = Column(DateTime, nullable=False)
    ended = Column(Boolean, default=False)
    host_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    entries = relationship("GiveawayEntry", back_populates="giveaway", cascade="all, delete-orphan")

class GiveawayEntry(Base):
    __tablename__ = "giveaway_entries"
    id = Column(Integer, primary_key=True, index=True)
    giveaway_id = Column(Integer, ForeignKey("giveaways.id", ondelete="CASCADE"))
    discord_id = Column(String, nullable=False)
    giveaway = relationship("Giveaway", back_populates="entries")

class GiveawayBanned(Base):
    __tablename__ = "giveaway_banned"
    giveaway_id = Column(Integer, ForeignKey("giveaways.id", ondelete="CASCADE"), primary_key=True)
    discord_id = Column(String, nullable=False, primary_key=True)

class TempVoiceConfig(Base):
    __tablename__ = "temp_voice_config"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, unique=True)
    join_channel_id = Column(String, nullable=True)
    category_id = Column(String, nullable=True)
    enabled = Column(Boolean, default=True)

class TempVoiceRoom(Base):
    __tablename__ = "temp_voice_rooms"
    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(String, unique=True)
    owner_id = Column(String, nullable=True)
    guild_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class EmbedTemplate(Base):
    __tablename__ = "embed_templates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)           # e.g. "don_hang_moi", "thanh_toan", "giao_hang", "feedback", "giveaway"
    event_type = Column(String, nullable=True)      # bind to event
    title = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    color = Column(String, default="#5865F2")       # hex color
    author = Column(String, nullable=True)
    footer = Column(String, nullable=True)
    thumbnail_url = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    fields = Column(JSON, default=list)             # [{"name": str, "value": str, "inline": bool}]
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class InviteTracking(Base):
    __tablename__ = "invite_tracking"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    inviter_id = Column(String, nullable=False)
    invitee_id = Column(String, nullable=False)
    invite_code = Column(String, nullable=True)
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)
    left = Column(Boolean, default=False)
    is_fake = Column(Boolean, default=False)

class BannedShopUser(Base):
    __tablename__ = "banned_shop_users"
    id = Column(Integer, primary_key=True, index=True)
    discord_id = Column(String, unique=True, nullable=False)
    reason = Column(Text, nullable=True)
    banned_by = Column(String, nullable=True)
    banned_at = Column(DateTime, default=datetime.datetime.utcnow)
