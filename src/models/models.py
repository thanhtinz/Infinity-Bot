from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, Text, JSON, LargeBinary, UniqueConstraint
from sqlalchemy.orm import relationship
import datetime
from src.database.config import Base


class UploadedFile(Base):
    """Store uploaded images in DB (survives ephemeral deploys like Railway)."""
    __tablename__ = "uploaded_files"
    id = Column(String, primary_key=True)          # UUID hex
    filename = Column(String, nullable=False)       # original filename
    content_type = Column(String, nullable=False)   # e.g. image/png
    data = Column(LargeBinary, nullable=False)      # raw file bytes
    size = Column(Integer, nullable=False)           # bytes
    guild_id = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class SystemConfig(Base):
    __tablename__ = "system_config"
    id = Column(Integer, primary_key=True, index=True)
    discord_token = Column(String, nullable=True)
    discord_client_id = Column(String, nullable=True)
    discord_client_secret = Column(String, nullable=True)
    public_app_url = Column(String, nullable=True)
    support_server_url = Column(String, nullable=True)
    payos_client_id = Column(String, nullable=True)
    payos_api_key = Column(String, nullable=True)
    payos_checksum_key = Column(String, nullable=True)
    guild_id = Column(String, nullable=True)
    admin_role_id = Column(String, nullable=True)
    don_hang_channel_id = Column(String, nullable=True)
    feedback_channel_id = Column(String, nullable=True)
    coupon_channel_id = Column(String, nullable=True)
    bang_gia_channel_id = Column(String, nullable=True)
    bang_gia_message_id = Column(String, nullable=True)
    welcome_channel_id = Column(String, nullable=True)
    bot_status = Column(String, default="offline")
    command_prefix = Column(String, default="!")
    bot_invisible = Column(Boolean, default=False)
    guild_name = Column(String, nullable=True)
    guild_icon = Column(String, nullable=True)
    shard_count = Column(Integer, nullable=True)  # None = auto
    shop_leaderboard_reset_at = Column(DateTime, nullable=True)
    language = Column(String, default="en")
    # ── Currency & Payment ──
    currency = Column(String, default="VND")            # ISO 4217
    currency_symbol = Column(String, default="₫")
    payment_methods = Column(JSON, default=list)        # enabled: payos, paypal, crypto, manual
    # PayPal
    paypal_client_id = Column(String, nullable=True)
    paypal_client_secret = Column(String, nullable=True)
    paypal_mode = Column(String, default="sandbox")     # sandbox | live
    # Crypto (NOWPayments)
    crypto_api_key = Column(String, nullable=True)
    crypto_provider = Column(String, default="nowpayments")  # nowpayments | coingate
    # Manual / QR Payment
    manual_qr_image_id = Column(String, nullable=True)  # UploadedFile ID
    manual_bank_name = Column(String, nullable=True)
    manual_account_holder = Column(String, nullable=True)
    manual_account_number = Column(String, nullable=True)
    manual_instructions = Column(Text, nullable=True)
    # ── Premium / Billing config ──
    premium_payment_instructions = Column(Text, nullable=True)      # shown to buyers on renewal page
    premium_default_renewal_days = Column(Integer, default=7)       # reminder window for all subs
    premium_renewal_channel_id = Column(String, nullable=True)      # channel for bot renewal reminders
    # ── Flash Sale + BXH + Inventory ──
    flash_sale_channel_id = Column(String, nullable=True)
    spending_leaderboard_channel_id = Column(String, nullable=True)
    spending_leaderboard_schedule = Column(String, nullable=True)   # "daily"|"weekly"|"monthly"
    spending_leaderboard_time = Column(String, nullable=True)       # "HH:MM" UTC
    inventory_low_stock_threshold = Column(Integer, default=5)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    discord_id = Column(String, unique=True, index=True)
    username = Column(String)
    total_spent = Column(Float, default=0)
    guild_id = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    orders = relationship("Order", back_populates="user")

class ProductCategory(Base):
    __tablename__ = "product_categories"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    emoji = Column(String, nullable=True)
    sort_order = Column(Integer, default=0)
    __table_args__ = (UniqueConstraint("guild_id", "name"),)

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("product_categories.id", ondelete="SET NULL"), nullable=True)
    name = Column(String)
    description = Column(Text, nullable=True)
    note = Column(Text, nullable=True)          # ghi chú nội bộ / hướng dẫn sau khi mua
    image_url = Column(String, nullable=True)
    emoji = Column(String, nullable=True)       # emoji icon for dropdown (Unicode or custom :name:id)
    price = Column(Float, default=0)  # kept for compat, use packages instead
    packages = Column(JSON, default=list)  # [{"name": str, "price": float, "active": bool}]
    active = Column(Boolean, default=True)
    category = relationship("ProductCategory")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, default=1)
    total_price = Column(Float)
    status = Column(String, default="PENDING") # PENDING, PENDING_MANUAL, PAID, DELIVERED, CANCELLED, ERROR
    payos_order_code = Column(String, nullable=True)
    checkout_url = Column(String, nullable=True)
    discord_message_id = Column(String, nullable=True)
    discord_channel_id = Column(String, nullable=True)
    package_name = Column(String, nullable=True)
    # Multi-payment support
    currency = Column(String, default="VND")
    payment_method = Column(String, default="payos")  # payos | paypal | crypto | manual
    payment_id = Column(String, nullable=True)         # PayPal order ID / crypto invoice ID
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)  # PENDING order auto-expire (24h)
    
    user = relationship("User", back_populates="orders")
    product = relationship("Product")

class Coupon(Base):
    __tablename__ = "coupons"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=True, index=True)
    code = Column(String, unique=True, index=True)
    discount_percent = Column(Float, nullable=True)
    discount_amount = Column(Float, nullable=True)
    max_uses = Column(Integer, default=1)
    used_count = Column(Integer, default=0)
    is_public = Column(Boolean, default=False)

class FlashSale(Base):
    """Flash sale trên một package cụ thể của sản phẩm."""
    __tablename__ = "flash_sales"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    package_name = Column(String, nullable=False)       # tên package áp dụng
    discount_type = Column(String, default="percent")   # "percent" | "fixed"
    discount_value = Column(Float, nullable=False)
    quantity_limit = Column(Integer, nullable=True)     # None = không giới hạn
    quantity_used = Column(Integer, default=0)
    allow_coupon = Column(Boolean, default=False)
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime, nullable=False)
    active = Column(Boolean, default=True)
    channel_message_id = Column(String, nullable=True)  # tin nhắn flash sale đã gửi
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    product = relationship("Product")

class InventoryItem(Base):
    """Một item trong kho hàng — gắn với package của sản phẩm."""
    __tablename__ = "inventory_items"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    package_name = Column(String, nullable=False)
    content = Column(Text, nullable=False)              # nội dung giao hàng
    delivered_order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)  # None = chưa giao
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    product = relationship("Product")

class SpendingMilestone(Base):
    """Mốc chi tiêu — tự động gán role khi user đạt mốc."""
    __tablename__ = "spending_milestones"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False)             # e.g. "VIP", "Diamond"
    threshold = Column(Float, nullable=False)          # amount in VNĐ
    role_id = Column(String, nullable=False)           # Discord role ID to grant
    emoji = Column(String, nullable=True)              # display emoji
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    stars = Column(Integer)
    content = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    discord_message_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user = relationship("User", foreign_keys=[user_id])
    product = relationship("Product", foreign_keys=[product_id])
    order = relationship("Order", foreign_keys=[order_id])

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
    guild_id = Column(String, nullable=True, index=True)
    giveaway = relationship("Giveaway", back_populates="entries")

class GiveawayBanned(Base):
    __tablename__ = "giveaway_banned"
    giveaway_id = Column(Integer, ForeignKey("giveaways.id", ondelete="CASCADE"), primary_key=True)
    discord_id = Column(String, nullable=False, primary_key=True)
    guild_id = Column(String, nullable=True)

class EmbedTemplate(Base):
    __tablename__ = "embed_templates"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=True, index=True)
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
    response_mode = Column(String, default="embed") # "embed" or "text"
    text_template = Column(Text, nullable=True)     # Custom text template with {variables}
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class CustomEmbedMessage(Base):
    """Tin nhắn embed tùy chỉnh — tạo từ dashboard, gửi/cập nhật lên Discord."""
    __tablename__ = "custom_embed_messages"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)           # Tên hiển thị trong dashboard
    channel_id = Column(String, nullable=True)      # Discord channel ID đã gửi
    message_id = Column(String, nullable=True)      # Discord message ID
    guild_id = Column(String, nullable=True)
    # Message-level data (Discohook style)
    content = Column(Text, nullable=True)           # Plain text trước embed
    webhook_username = Column(String, nullable=True)
    webhook_avatar_url = Column(String, nullable=True)
    thread_name = Column(String, nullable=True)
    embeds = Column(JSON, default=list)             # Array of embed objects
    components = Column(JSON, default=list)         # List of ActionRow objects (buttons)
    flags = Column(JSON, default=dict)              # { suppress_embeds: bool }
    allowed_mentions = Column(JSON, default=dict)   # { parse, roles, users, replied_user }
    # Legacy flat embed data (backward compat)
    title = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    color = Column(String, default="#5865F2")
    author = Column(String, nullable=True)
    author_icon_url = Column(String, nullable=True)
    footer = Column(String, nullable=True)
    thumbnail_url = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    fields = Column(JSON, default=list)
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
    guild_id = Column(String, nullable=True, index=True)
    discord_id = Column(String, nullable=False, index=True)  # unique per guild via constraint
    __table_args__ = (UniqueConstraint("guild_id", "discord_id", name="uq_banned_shop_guild_user"),)
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


class ManagedEmoji(Base):
    __tablename__ = "managed_emojis"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=True, index=True)
    discord_id = Column(String, unique=True, nullable=False)  # Discord emoji snowflake
    name = Column(String, nullable=False)
    animated = Column(Boolean, default=False)
    url = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ButtonRole(Base):
    __tablename__ = "button_roles"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    channel_id = Column(String, nullable=True)
    message_id = Column(String, nullable=True)
    name = Column(String, nullable=False, default="Button Role Panel")
    buttons = Column(JSON, default=list)
    embed_title = Column(String, nullable=True)
    embed_description = Column(Text, nullable=True)
    embed_color = Column(String, default="#5865F2")
    embed_footer = Column(String, nullable=True)
    embed_image_url = Column(String, nullable=True)
    embed_thumbnail_url = Column(String, nullable=True)
    embed_fields = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class SelectMenuRole(Base):
    __tablename__ = "select_menu_roles"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    channel_id = Column(String, nullable=True)
    message_id = Column(String, nullable=True)
    name = Column(String, nullable=False, default="Select Role Panel")
    placeholder = Column(String, default="Chọn role...")
    options = Column(JSON, default=list)
    min_values = Column(Integer, default=0)
    max_values = Column(Integer, default=1)
    embed_title = Column(String, nullable=True)
    embed_description = Column(Text, nullable=True)
    embed_color = Column(String, default="#5865F2")
    embed_footer = Column(String, nullable=True)
    embed_image_url = Column(String, nullable=True)
    embed_thumbnail_url = Column(String, nullable=True)
    embed_fields = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

# ── Phase 4: Logging System ───────────────────────────────────────────────────

class LoggingConfig(Base):
    __tablename__ = "logging_configs"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False, unique=True)
    message_log_channel_id = Column(String, nullable=True)
    voice_log_channel_id = Column(String, nullable=True)
    mod_log_channel_id = Column(String, nullable=True)
    member_log_channel_id = Column(String, nullable=True)
    server_log_channel_id = Column(String, nullable=True)
    ignored_channels = Column(JSON, default=list)
    ignored_roles = Column(JSON, default=list)

class LogEntry(Base):
    __tablename__ = "log_entries"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False, index=True)
    event_type = Column(String, nullable=False, index=True)  # log_message_delete, log_voice_join, etc.
    category = Column(String, nullable=False, index=True)    # message, voice, mod, member, server
    actor_id = Column(String, nullable=True)       # Discord user ID who triggered
    actor_name = Column(String, nullable=True)
    actor_avatar = Column(String, nullable=True)
    target_id = Column(String, nullable=True)       # Target channel/user/role ID
    target_name = Column(String, nullable=True)
    description = Column(Text, nullable=True)       # Human-readable summary
    details = Column(JSON, nullable=True)           # Extra structured data
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

# ── Phase 5: New Features ─────────────────────────────────────────────────────

class AFKStatus(Base):
    __tablename__ = "afk_statuses"
    guild_id = Column(String, primary_key=True)
    user_id = Column(String, primary_key=True)
    reason = Column(String, default="AFK")
    set_at = Column(DateTime, default=datetime.datetime.utcnow)

class AutoModConfig(Base):
    __tablename__ = "automod_configs"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False, unique=True)
    enabled = Column(Boolean, default=False)
    # Anti-spam
    anti_spam_enabled = Column(Boolean, default=False)
    anti_spam_max_messages = Column(Integer, default=5)
    anti_spam_interval = Column(Integer, default=5)  # seconds
    anti_spam_action = Column(String, default="warn")  # warn/mute/kick
    # Anti-link
    anti_link_enabled = Column(Boolean, default=False)
    anti_link_whitelist = Column(JSON, default=list)  # allowed domains
    # Bad words
    bad_words_enabled = Column(Boolean, default=False)
    bad_words_list = Column(JSON, default=list)
    # Caps lock
    caps_lock_enabled = Column(Boolean, default=False)
    caps_lock_min_length = Column(Integer, default=10)
    caps_lock_percentage = Column(Integer, default=70)
    # Mention spam
    mention_spam_enabled = Column(Boolean, default=False)
    mention_spam_max = Column(Integer, default=5)
    mention_spam_action = Column(String, default="warn")
    # Filters
    ignored_channels = Column(JSON, default=list)
    ignored_roles = Column(JSON, default=list)
    log_channel_id = Column(String, nullable=True)

class ReactionRole(Base):
    __tablename__ = "reaction_roles"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    channel_id = Column(String, nullable=True)
    message_id = Column(String, nullable=True)
    name = Column(String, nullable=False, default="Reaction Role Panel")
    embed_title = Column(String, nullable=True)
    embed_description = Column(Text, nullable=True)
    embed_color = Column(String, default="#5865F2")
    embed_footer = Column(String, nullable=True)
    embed_image_url = Column(String, nullable=True)
    embed_thumbnail_url = Column(String, nullable=True)
    embed_fields = Column(JSON, default=list)
    mappings = Column(JSON, default=list)  # [{emoji, role_id, label}, ...]
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class StarboardConfig(Base):
    __tablename__ = "starboard_configs"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False, unique=True)
    channel_id = Column(String, nullable=True)
    emoji = Column(String, default="⭐")
    threshold = Column(Integer, default=3)
    self_star = Column(Boolean, default=False)
    ignored_channels = Column(JSON, default=list)
    enabled = Column(Boolean, default=True)

class StarboardEntry(Base):
    __tablename__ = "starboard_entries"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    source_message_id = Column(String, nullable=False, unique=True)
    source_channel_id = Column(String, nullable=False)
    starboard_message_id = Column(String, nullable=True)
    star_count = Column(Integer, default=0)
    author_id = Column(String, nullable=True)

class ScheduledMessage(Base):
    __tablename__ = "scheduled_messages"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    channel_id = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    embed_data = Column(JSON, nullable=True)
    send_at = Column(DateTime, nullable=False)
    repeat_type = Column(String, default="none")  # none/hourly/daily/weekly/monthly
    sent = Column(Boolean, default=False)
    last_sent_at = Column(DateTime, nullable=True)
    enabled = Column(Boolean, default=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class FeatureToggle(Base):
    __tablename__ = "feature_toggles"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    feature_key = Column(String, nullable=False)  # e.g. "shop", "ticket", "giveaway"
    enabled = Column(Boolean, default=True)


class CustomCommand(Base):
    __tablename__ = "custom_commands"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    name = Column(String, nullable=False)  # command trigger (e.g. "rules")
    description = Column(String, nullable=True)
    response_type = Column(String, default="text")  # text/embed
    response_text = Column(Text, nullable=True)
    response_embed = Column(JSON, nullable=True)
    ephemeral = Column(Boolean, default=False)
    required_roles = Column(JSON, default=list)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    # Phase 2 fields
    aliases = Column(JSON, default=list)           # alternative trigger names
    cooldown = Column(Integer, default=0)          # seconds between uses per user
    allowed_channels = Column(JSON, default=list)  # restrict to specific channels (empty = all)
    delete_trigger = Column(Boolean, default=False)  # delete the user's !command message
    auto_react = Column(String, nullable=True)     # emoji to react to the response
    # Phase 3 fields — Dyno-style expansion
    silent = Column(Boolean, default=False)        # suppress bot default response
    dm_response = Column(Boolean, default=False)   # DM the response to user
    no_everyone = Column(Boolean, default=False)   # disable @everyone/@here/role pings
    allowed_roles = Column(JSON, default=list)     # roles allowed to use (empty = all)
    ignored_roles = Column(JSON, default=list)     # roles blocked from using
    ignored_channels = Column(JSON, default=list)  # channels blocked from using
    response_channel_id = Column(String, nullable=True)  # override response channel
    delete_after = Column(Integer, default=0)      # delete bot response after N seconds (0 = never)
    required_args = Column(Integer, default=0)     # minimum number of $N args required
    additional_responses = Column(JSON, default=list)  # [{type: "text"|"embed", content: ..., embed: {...}}]
    # Phase 4 — trigger system
    event_trigger = Column(String, default="prefix_command")  # one of 86 trigger_type values
    trigger_config = Column(JSON, default=dict)   # per-trigger config (keyword, channel_filter, etc.)
    actions = Column(JSON, default=list)          # [{type: "add_role", config: {...}}] executed after responses
    # Phase 4 fields — Event triggers + System actions
    event_trigger = Column(String, default="prefix_command")   # trigger_type from TRIGGER_TYPES (86 values)
    trigger_config = Column(JSON, default=dict)                 # per-trigger config {keyword, match_type, channel_id, ...}
    actions = Column(JSON, default=list)                        # [{type: "add_role", config: {role_id: "..."}}]


# ── Advanced Moderation System ─────────────────────────────────────────────────

class ModerationCase(Base):
    """Unified mod log — one row per mod action (warn, kick, ban, mute, softban, etc.)."""
    __tablename__ = "moderation_cases"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False, index=True)
    case_number = Column(Integer, nullable=False)          # auto-increment per guild
    action = Column(String, nullable=False)                # warn, kick, ban, unban, mute, unmute, softban, deafen, undeafen, timeout, rolepersist, temprole
    target_id = Column(String, nullable=False, index=True) # Discord user ID
    target_name = Column(String, nullable=True)
    moderator_id = Column(String, nullable=True)
    moderator_name = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
    duration = Column(Integer, nullable=True)              # seconds (for timed actions)
    expires_at = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True)                 # for timed mutes/bans
    role_id = Column(String, nullable=True)                # for rolepersist/temprole
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

class ModerationNote(Base):
    """Notes about a member, visible to staff only."""
    __tablename__ = "moderation_notes"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False, index=True)
    target_id = Column(String, nullable=False, index=True)  # Discord user ID
    author_id = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class RolePersist(Base):
    """Roles that persist if a member leaves and rejoins."""
    __tablename__ = "role_persists"
    __table_args__ = (UniqueConstraint("guild_id", "target_id", "role_id", name="uq_rolepersist"),)
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False, index=True)
    target_id = Column(String, nullable=False, index=True)
    role_id = Column(String, nullable=False)
    assigned_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TempRole(Base):
    """Temporary role assignments — auto-removed after expiry."""
    __tablename__ = "temp_roles"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False, index=True)
    target_id = Column(String, nullable=False, index=True)
    role_id = Column(String, nullable=False)
    assigned_by = Column(String, nullable=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ModerationConfig(Base):
    """Per-guild moderation settings."""
    __tablename__ = "moderation_configs"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False, unique=True)
    mute_role_id = Column(String, nullable=True)
    mod_log_channel_id = Column(String, nullable=True)
    lockdown_channels = Column(JSON, default=list)       # channel IDs for /lockdown
    ignored_users = Column(JSON, default=list)
    ignored_roles = Column(JSON, default=list)
    ignored_channels = Column(JSON, default=list)
    dm_on_action = Column(Boolean, default=True)         # DM user on mod actions
    show_mod_in_dm = Column(Boolean, default=False)      # show mod name in DM
    auto_dehoist = Column(Boolean, default=False)         # auto-fix hoisted names
    starboard_enabled = Column(Boolean, default=False)


class AutoResponder(Base):
    __tablename__ = "auto_responders"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    trigger_type = Column(String, default="contains")  # exact, contains, startswith, endswith, regex, wildcard
    trigger_text = Column(String, nullable=False)
    ignore_case = Column(Boolean, default=True)
    response_type = Column(String, default="text")  # text, embed, react, text+react, embed+react
    response_text = Column(Text, nullable=True)
    response_embed = Column(JSON, nullable=True)
    reaction_emojis = Column(JSON, default=list)
    reply_to_message = Column(Boolean, default=True)
    delete_trigger = Column(Boolean, default=False)
    send_dm = Column(Boolean, default=False)
    cooldown = Column(Integer, default=0)
    cooldown_type = Column(String, default="per_user")  # per_user, per_channel, global
    allowed_channels = Column(JSON, default=list)
    blocked_channels = Column(JSON, default=list)
    allowed_roles = Column(JSON, default=list)
    blocked_roles = Column(JSON, default=list)
    ignore_bots = Column(Boolean, default=True)
    enabled = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ═══════════════════════════════════════════════════════════════
# ── Security & Recovery ──
# ═══════════════════════════════════════════════════════════════

class ServerBackup(Base):
    """Full server snapshot: Discord structure + bot config + verified members."""
    __tablename__ = "server_backups"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, index=True)
    backup_type = Column(String, default="manual")       # manual | scheduled | auto
    status = Column(String, default="in_progress")        # in_progress | completed | failed
    data = Column(JSON)  # { discord: {...}, bot_config: {...} }
    channel_count = Column(Integer, default=0)
    role_count = Column(Integer, default=0)
    member_count = Column(Integer, default=0)
    config_count = Column(Integer, default=0)
    message_count = Column(Integer, default=0)
    size_bytes = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)


class BackupSchedule(Base):
    """Auto-backup schedule per guild."""
    __tablename__ = "backup_schedules"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, unique=True, index=True)
    enabled = Column(Boolean, default=False)
    interval_hours = Column(Integer, default=24)
    max_backups = Column(Integer, default=5)
    include_messages = Column(Boolean, default=True)
    message_limit = Column(Integer, default=100)
    include_bot_config = Column(Boolean, default=True)
    last_backup_at = Column(DateTime, nullable=True)
    next_backup_at = Column(DateTime, nullable=True)


class StaffPermission(Base):
    """Per-guild staff permission overrides — role-based access to dashboard sections."""
    __tablename__ = "staff_permissions"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, index=True)
    role_id = Column(String, nullable=False)
    role_name = Column(String, nullable=True)  # cached for display
    # Granular permissions (each is a feature section)
    can_shop = Column(Boolean, default=False)
    can_moderation = Column(Boolean, default=False)
    can_community = Column(Boolean, default=False)
    can_embeds = Column(Boolean, default=False)
    can_roles = Column(Boolean, default=False)
    can_utilities = Column(Boolean, default=False)
    can_backup = Column(Boolean, default=False)
    can_config = Column(Boolean, default=False)
    can_ai = Column(Boolean, default=False)
    can_forms = Column(Boolean, default=False)
    can_reminders = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    __table_args__ = (UniqueConstraint("guild_id", "role_id"),)


# ── Firewall System ───────────────────────────────────────────────────────

class FirewallRule(Base):
    __tablename__ = "firewall_rules"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, index=True)
    rule_type = Column(String, nullable=False)       # block | allow
    target_type = Column(String, nullable=False)     # user_id | ip | country | email_domain | asn
    target_value = Column(String, nullable=False)
    reason = Column(String, nullable=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class FirewallLog(Base):
    __tablename__ = "firewall_logs"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, index=True)
    discord_id = Column(String, nullable=True)
    username = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    country = Column(String, nullable=True)
    blocked_by = Column(String, nullable=False)      # vpn | alt | firewall | age | captcha
    rule_id = Column(Integer, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ── Server Alerts ─────────────────────────────────────────────────────────

class ServerAlert(Base):
    __tablename__ = "server_alerts"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, index=True)
    alert_type = Column(String, nullable=False)      # nuke_detect | mass_ban | mass_kick | channel_delete | role_delete
    enabled = Column(Boolean, default=True)
    webhook_url = Column(String, nullable=True)
    threshold = Column(Integer, default=3)
    window_minutes = Column(Integer, default=5)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class AlertHistory(Base):
    __tablename__ = "alert_history"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, index=True)
    alert_type = Column(String, nullable=False)
    actor_id = Column(String, nullable=True)
    actor_name = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    severity = Column(String, default="warning")     # info | warning | critical
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ── Premium / Billing ─────────────────────────────────────────────────────

class PremiumPlan(Base):
    """Owner-defined subscription tiers (Basic, Pro, Enterprise, etc.)."""
    __tablename__ = "premium_plans"
    id = Column(Integer, primary_key=True)
    code = Column(String, unique=True, nullable=False)          # machine key: "pro", "enterprise"
    name = Column(String, nullable=False)                       # display name
    description = Column(Text, nullable=True)
    price = Column(Float, default=0.0)
    currency = Column(String, default="VND")
    interval = Column(String, default="monthly")                # monthly | quarterly | yearly | lifetime
    active = Column(Boolean, default=True)
    is_public = Column(Boolean, default=True)                   # show on pricing page
    sort_order = Column(Integer, default=0)
    badge_text = Column(String, nullable=True)                  # "Popular", "Best Value"
    color = Column(String, default="#6366f1")                   # accent color for UI
    features = Column(JSON, default=dict)                       # {"custom_bot": true, "backup_retention": 30, ...}
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class GuildSubscription(Base):
    """Active / historical subscription for a guild."""
    __tablename__ = "guild_subscriptions"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, index=True, nullable=False)
    plan_id = Column(Integer, ForeignKey("premium_plans.id"), nullable=False)
    status = Column(String, default="active")                   # trial | active | past_due | expired | cancelled | manual_review
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    current_period_start = Column(DateTime, default=datetime.datetime.utcnow)
    current_period_end = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)
    auto_renew = Column(Boolean, default=True)
    renewal_reminder_days = Column(Integer, default=7)          # days before expiry to send reminder
    last_reminder_at = Column(DateTime, nullable=True)
    payment_provider = Column(String, default="manual")         # payos | paypal | crypto | manual
    external_subscription_id = Column(String, nullable=True)
    external_customer_id = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(String, nullable=True)                  # discord user id of admin who activated
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    plan = relationship("PremiumPlan", foreign_keys=[plan_id])


class SubscriptionPayment(Base):
    """Individual payment records tied to a guild subscription."""
    __tablename__ = "subscription_payments"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, index=True, nullable=False)
    subscription_id = Column(Integer, ForeignKey("guild_subscriptions.id"), nullable=True)
    plan_id = Column(Integer, ForeignKey("premium_plans.id"), nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="VND")
    payment_method = Column(String, default="manual")           # payos | paypal | crypto | manual
    status = Column(String, default="pending")                  # pending | paid | failed | refunded
    provider_payment_id = Column(String, nullable=True)         # external ID from payment provider
    period_start = Column(DateTime, nullable=True)
    period_end = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    subscription = relationship("GuildSubscription", foreign_keys=[subscription_id])
    plan = relationship("PremiumPlan", foreign_keys=[plan_id])


class PremiumCoupon(Base):
    """Coupon codes that grant a guild a premium subscription for a fixed duration."""
    __tablename__ = "premium_coupons"
    id            = Column(Integer, primary_key=True)
    code          = Column(String, unique=True, nullable=False, index=True)
    plan_id       = Column(Integer, ForeignKey("premium_plans.id"), nullable=False)
    duration_days = Column(Integer, nullable=False)         # days of premium granted on redemption
    max_uses      = Column(Integer, default=1)              # 0 = unlimited
    used_count    = Column(Integer, default=0)
    expires_at    = Column(DateTime, nullable=True)         # null = never expires
    active        = Column(Boolean, default=True)
    note          = Column(Text, nullable=True)
    created_by    = Column(String, nullable=True)           # discord user id of owner who created it
    created_at    = Column(DateTime, default=datetime.datetime.utcnow)
    plan          = relationship("PremiumPlan", foreign_keys=[plan_id])


class CouponRedemption(Base):
    """Records each time a guild redeems a coupon code."""
    __tablename__ = "coupon_redemptions"
    id              = Column(Integer, primary_key=True)
    coupon_id       = Column(Integer, ForeignKey("premium_coupons.id"), nullable=False)
    guild_id        = Column(String, index=True, nullable=False)
    redeemed_by     = Column(String, nullable=True)         # discord user id
    subscription_id = Column(Integer, ForeignKey("guild_subscriptions.id"), nullable=True)
    redeemed_at     = Column(DateTime, default=datetime.datetime.utcnow)
    coupon          = relationship("PremiumCoupon", foreign_keys=[coupon_id])


# ── AI Chat ──────────────────────────────────────────────────────────────────

class AIChatConfig(Base):
    """Per-guild AI Chat configuration."""
    __tablename__ = "ai_chat_configs"
    id                  = Column(Integer, primary_key=True)
    guild_id            = Column(String, unique=True, index=True, nullable=False)
    enabled             = Column(Boolean, default=False)
    provider            = Column(String, default="gemini")       # groq|gemini|openai|deepsearch
    model               = Column(String, nullable=True)
    api_key             = Column(Text, nullable=True)             # stored obfuscated
    system_prompt       = Column(Text, nullable=True)
    listen_channels     = Column(JSON, default=list)              # list of channel IDs
    ai_manager_role     = Column(String, nullable=True)           # role ID
    respond_to_mention  = Column(Boolean, default=True)
    respond_prefix      = Column(String, default="?")
    ticket_auto_reply   = Column(Boolean, default=False)
    ticket_category_ids = Column(JSON, default=list)              # category IDs where ticket bots create channels
    ticket_reply_mode   = Column(String, default="first_msg")     # first_msg | all_msg
    image_gen_enabled   = Column(Boolean, default=False)
    image_provider      = Column(String, nullable=True)           # gemini|openai
    image_api_key       = Column(Text, nullable=True)
    max_history         = Column(Integer, default=10)
    created_at          = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.datetime.utcnow)


class AITrainingDoc(Base):
    """Per-guild training documents injected as system context."""
    __tablename__ = "ai_training_docs"
    id         = Column(Integer, primary_key=True)
    guild_id   = Column(String, index=True, nullable=False)
    title      = Column(String, nullable=False)
    content    = Column(Text, nullable=False)
    doc_type   = Column(String, default="text")   # text|file
    filename   = Column(String, nullable=True)
    enabled    = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class AIChatHistory(Base):
    """Conversation history per guild+user (rolling window)."""
    __tablename__ = "ai_chat_history"
    id         = Column(Integer, primary_key=True)
    guild_id   = Column(String, index=True, nullable=False)
    user_id    = Column(String, index=True, nullable=False)
    username   = Column(String, nullable=True)
    channel_id = Column(String, nullable=True)
    role       = Column(String, nullable=False)    # user|assistant
    content    = Column(Text, nullable=False)
    timestamp  = Column(DateTime, default=datetime.datetime.utcnow, index=True)


# ── Auto Role ───────────────────────────────────────────────────────────────

class AutoRole(Base):
    __tablename__ = "auto_roles"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, nullable=False, index=True)
    role_id = Column(String, nullable=False)
    trigger = Column(String, default="join")        # join | delay | bot
    delay_seconds = Column(Integer, default=0)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ── Forms / Application ────────────────────────────────────────────────────

class FormTemplate(Base):
    __tablename__ = "form_templates"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    questions = Column(JSON, default=list)           # [{label, placeholder, required, style}]
    response_channel_id = Column(String, nullable=True)
    review_role_id = Column(String, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class FormSubmission(Base):
    __tablename__ = "form_submissions"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, nullable=False, index=True)
    template_id = Column(Integer, ForeignKey("form_templates.id", ondelete="CASCADE"))
    user_id = Column(String, nullable=False)
    username = Column(String, nullable=True)
    answers = Column(JSON, default=list)             # [{question, answer}]
    status = Column(String, default="pending")       # pending | approved | rejected
    reviewer_id = Column(String, nullable=True)
    review_note = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    template = relationship("FormTemplate")


# ── Reminder / Todo ─────────────────────────────────────────────────────────

class Reminder(Base):
    __tablename__ = "reminders"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False)
    channel_id = Column(String, nullable=True)
    message = Column(Text, nullable=False)
    remind_at = Column(DateTime, nullable=False, index=True)
    recurring = Column(String, nullable=True)        # None | daily | weekly
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class TodoItem(Base):
    __tablename__ = "todo_items"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    done = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ── Poll System ─────────────────────────────────────────────────────────────

class Poll(Base):
    __tablename__ = "polls"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, nullable=False, index=True)
    channel_id = Column(String, nullable=False)
    message_id = Column(String, nullable=True)
    question = Column(Text, nullable=False)
    options = Column(JSON, default=list)             # ["option1", "option2", ...]
    end_time = Column(DateTime, nullable=True)
    anonymous = Column(Boolean, default=False)
    multiple_choice = Column(Boolean, default=False)
    creator_id = Column(String, nullable=False)
    ended = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class PollVote(Base):
    __tablename__ = "poll_votes"
    id = Column(Integer, primary_key=True)
    poll_id = Column(Integer, ForeignKey("polls.id", ondelete="CASCADE"), index=True)
    user_id = Column(String, nullable=False)
    option_index = Column(Integer, nullable=False)
    __table_args__ = (UniqueConstraint("poll_id", "user_id", "option_index", name="uq_poll_vote"),)


# ── Social Feeds ────────────────────────────────────────────────────────────

class SocialFeed(Base):
    __tablename__ = "social_feeds"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=False)        # youtube | twitch | rss
    feed_url = Column(String, nullable=False)         # channel URL or RSS URL
    discord_channel_id = Column(String, nullable=False)
    custom_message = Column(Text, nullable=True)      # template with {title}, {url}, {author}
    last_item_id = Column(String, nullable=True)
    last_checked = Column(DateTime, nullable=True)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ── Server Stats Channels ──────────────────────────────────────────────────

class StatsChannel(Base):
    __tablename__ = "stats_channels"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, nullable=False, index=True)
    channel_id = Column(String, nullable=False)
    stat_type = Column(String, nullable=False)       # members | online | boosts | roles | channels | avg_rating
    format_template = Column(String, default="{value}")  # e.g. "Members: {value}"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
