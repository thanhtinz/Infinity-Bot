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
    # Defaults for new voice rooms
    default_user_limit = Column(Integer, default=0)         # 0 = unlimited
    default_bitrate = Column(Integer, default=64000)         # in bps
    naming_format = Column(String, default="{user}'s Channel")
    # Behavior
    auto_delete_seconds = Column(Integer, default=0)         # 0 = when empty
    # Permission toggles
    allow_rename = Column(Boolean, default=True)
    allow_limit = Column(Boolean, default=True)
    allow_lock = Column(Boolean, default=True)
    allow_hide = Column(Boolean, default=True)
    # Interface channel for control panel buttons
    interface_channel_id = Column(String, nullable=True)
    # New fields
    default_user_limit = Column(Integer, default=0)          # 0 = unlimited
    default_bitrate = Column(Integer, default=64000)         # in bps
    naming_format = Column(String, default="{user}'s Channel")
    auto_delete_seconds = Column(Integer, default=0)         # 0 = delete when empty
    allow_rename = Column(Boolean, default=True)
    allow_limit = Column(Boolean, default=True)
    allow_lock = Column(Boolean, default=True)
    allow_hide = Column(Boolean, default=True)
    interface_channel_id = Column(String, nullable=True)     # control panel channel

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


# ── Sticky Message System ────────────────────────────────────────────────────

class StickyMessage(Base):
    __tablename__ = "sticky_messages"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    channel_id = Column(String, nullable=False, unique=True)  # one sticky per channel
    # Content (plain or embed)
    content = Column(Text, nullable=True)           # plain text content
    embed_enabled = Column(Boolean, default=False)
    embed_title = Column(String, nullable=True)
    embed_description = Column(Text, nullable=True)
    embed_color = Column(String, default="#5865F2")
    embed_footer = Column(String, nullable=True)
    embed_image_url = Column(String, nullable=True)
    embed_thumbnail_url = Column(String, nullable=True)
    # Trigger settings
    message_count_trigger = Column(Integer, default=1)  # resend after N new messages
    current_count = Column(Integer, default=0)          # counter since last resend
    interval_minutes = Column(Integer, default=0)       # 0 = off; resend every N minutes
    last_sent = Column(DateTime, nullable=True)
    # Discord tracking
    last_message_id = Column(String, nullable=True)     # Discord msg ID of current sticky
    is_enabled = Column(Boolean, default=True)
    is_pinned = Column(Boolean, default=False)
    created_by = Column(String, nullable=True)          # discord user ID
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)        # auto-disable after this time
    resend_count = Column(Integer, default=0)           # total times resent (analytics)


# ── Ticket System ─────────────────────────────────────────────────────────────

class TicketConfig(Base):
    __tablename__ = "ticket_configs"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False, unique=True)
    category_id = Column(String, nullable=True)          # Discord category chứa ticket channels
    log_channel_id = Column(String, nullable=True)       # channel ghi log
    support_role_ids = Column(JSON, default=list)        # [role_id, ...] — staff
    ticket_limit = Column(Integer, default=1)            # max open tickets / user
    cooldown_minutes = Column(Integer, default=0)
    auto_close_hours = Column(Integer, default=0)        # 0 = tắt
    naming_format = Column(String, default="ticket-{number}")  # hoặc ticket-{username}
    # ── Tin nhắn tự động ──
    open_message_title = Column(String, nullable=True)
    open_message_body = Column(Text, nullable=True)
    close_message_title = Column(String, nullable=True)
    close_message_body = Column(Text, nullable=True)
    claim_message_title = Column(String, nullable=True)
    claim_message_body = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TicketPanel(Base):
    __tablename__ = "ticket_panels"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    channel_id = Column(String, nullable=True)           # channel panel được gửi vào
    message_id = Column(String, nullable=True)           # Discord message ID
    title = Column(String, default="Hỗ trợ")
    description = Column(Text, default="Nhấn nút bên dưới để tạo ticket hỗ trợ.")
    color = Column(String, default="#5865F2")
    button_label = Column(String, default="Tạo Ticket")  # legacy single-button
    button_emoji = Column(String, default="🎫")           # legacy single-button
    button_style = Column(String, default="primary")      # legacy single-button
    category_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    buttons = relationship("PanelButton", back_populates="panel", cascade="all, delete-orphan", order_by="PanelButton.sort_order")


class PanelButton(Base):
    __tablename__ = "panel_buttons"
    id = Column(Integer, primary_key=True, index=True)
    panel_id = Column(Integer, ForeignKey("ticket_panels.id", ondelete="CASCADE"), nullable=False)
    label = Column(String, nullable=False, default="Tạo Ticket")
    emoji = Column(String, nullable=True)
    style = Column(String, default="primary")             # primary | secondary | success | danger
    category_id = Column(String, nullable=True)           # override category cho button này
    form_id = Column(String, nullable=True)               # liên kết với ticket form
    sort_order = Column(Integer, default=0)
    panel = relationship("TicketPanel", back_populates="buttons")

class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    channel_id = Column(String, nullable=True)           # ticket channel Discord ID
    creator_id = Column(String, nullable=False)          # Discord user ID
    claimed_by = Column(String, nullable=True)           # staff Discord ID
    status = Column(String, default="open")              # open | closed | deleted
    priority = Column(String, default="normal")          # low | normal | high | urgent
    subject = Column(String, nullable=True)
    panel_id = Column(Integer, ForeignKey("ticket_panels.id"), nullable=True)
    close_reason = Column(String, nullable=True)
    members = Column(JSON, default=list)                 # list Discord user IDs được add
    tags = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)

class TicketBlacklist(Base):
    __tablename__ = "ticket_blacklists"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    discord_id = Column(String, nullable=False)
    reason = Column(Text, nullable=True)
    added_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TicketNote(Base):
    __tablename__ = "ticket_notes"
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    author_id = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TicketForm(Base):
    __tablename__ = "ticket_forms"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    panel_id = Column(Integer, ForeignKey("ticket_panels.id"), nullable=True)
    name = Column(String, nullable=False, default="Form mặc định")
    questions = Column(JSON, default=list)  # [{label, placeholder, required, style: short|paragraph}]
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TicketTeam(Base):
    __tablename__ = "ticket_teams"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    role_ids = Column(JSON, default=list)   # Discord role IDs
    panel_ids = Column(JSON, default=list)  # TicketPanel IDs assigned to this team
    color = Column(String, default="#5865F2")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TicketFeedback(Base):
    __tablename__ = "ticket_feedback"
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    guild_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TicketTranscript(Base):
    __tablename__ = "ticket_transcripts"
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False, unique=True)
    guild_id = Column(String, nullable=False)
    channel_name = Column(String, nullable=True)
    message_count = Column(Integer, default=0)
    participants = Column(JSON, default=list)  # list Discord user IDs
    content_html = Column(Text, nullable=True)  # stored transcript HTML
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TicketFeedbackConfig(Base):
    __tablename__ = "ticket_feedback_configs"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False, unique=True)
    enabled = Column(Boolean, default=False)
    channel_id = Column(String, nullable=True)

class TicketClaimConfig(Base):
    __tablename__ = "ticket_claim_configs"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False, unique=True)
    enabled = Column(Boolean, default=True)
    exclusive = Column(Boolean, default=False)
    notify = Column(Boolean, default=True)
    notify_channel_id = Column(String, nullable=True)
