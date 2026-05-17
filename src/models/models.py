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
    # ── Security / VPN detection API config ──
    vpn_api_key = Column(String, nullable=True)
    vpn_api_provider = Column(String, default="proxycheck")  # proxycheck | ipqualityscore
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

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    discord_id = Column(String, unique=True, index=True)
    username = Column(String)
    total_spent = Column(Float, default=0)
    guild_id = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    orders = relationship("Order", back_populates="user")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=True, index=True)
    name = Column(String)
    description = Column(Text, nullable=True)
    note = Column(Text, nullable=True)          # ghi chú nội bộ / hướng dẫn sau khi mua
    image_url = Column(String, nullable=True)
    emoji = Column(String, nullable=True)       # emoji icon for dropdown (Unicode or custom :name:id)
    price = Column(Float, default=0)  # kept for compat, use packages instead
    packages = Column(JSON, default=list)  # [{"name": str, "price": float, "active": bool}]
    active = Column(Boolean, default=True)

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
    data = Column(JSON)  # { discord: {...}, bot_config: {...}, verified_members: [...] }
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
    include_verified_members = Column(Boolean, default=True)
    last_backup_at = Column(DateTime, nullable=True)
    next_backup_at = Column(DateTime, nullable=True)


class VerifiedMember(Base):
    """Members verified via OAuth2 — used for pull/restore after nuke."""
    __tablename__ = "verified_members"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, index=True)
    discord_id = Column(String, index=True)
    username = Column(String, nullable=True)
    discriminator = Column(String, nullable=True)
    avatar = Column(String, nullable=True)
    email = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    roles = Column(JSON, default=list)
    access_token = Column(String, nullable=True)
    refresh_token = Column(String, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    verified_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_seen = Column(DateTime, nullable=True)
    is_blacklisted = Column(Boolean, default=False)
    risk_score = Column(Integer, default=0)
    metadata_ = Column("metadata", JSON, default=dict)  # connected accounts, etc.
    __table_args__ = (UniqueConstraint("guild_id", "discord_id"),)


class MemberPull(Base):
    """Track member pull (rejoin) operations."""
    __tablename__ = "member_pulls"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, index=True)
    status = Column(String, default="pending")  # pending | in_progress | completed | failed
    total_members = Column(Integer, default=0)
    pulled_members = Column(Integer, default=0)
    failed_members = Column(Integer, default=0)
    restore_roles = Column(Boolean, default=True)
    join_delay_seconds = Column(Integer, default=1)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error = Column(Text, nullable=True)
    log = Column(JSON, default=list)


class VerificationConfig(Base):
    """Per-guild verification page configuration."""
    __tablename__ = "verification_configs"
    id = Column(Integer, primary_key=True)
    guild_id = Column(String, unique=True, index=True)
    enabled = Column(Boolean, default=False)
    verified_role_id = Column(String, nullable=True)
    unverified_role_id = Column(String, nullable=True)
    verify_channel_id = Column(String, nullable=True)
    log_channel_id = Column(String, nullable=True)
    # Branding
    page_title = Column(String, default="Verify")
    page_description = Column(Text, nullable=True)
    page_color = Column(String, default="#5865F2")
    page_logo_url = Column(String, nullable=True)
    page_background_url = Column(String, nullable=True)
    button_text = Column(String, default="Verify with Discord")
    success_message = Column(Text, default="You have been verified!")
    # Security
    captcha_enabled = Column(Boolean, default=False)
    min_account_age_days = Column(Integer, default=0)
    block_vpn = Column(Boolean, default=False)
    kick_on_deauth = Column(Boolean, default=False)
    close_page_after_verify = Column(Boolean, default=True)
    # Extra branding
    page_footer_text = Column(String, nullable=True)
    page_theme = Column(String, default="dark")       # dark | light | glass
    custom_css = Column(Text, nullable=True)
    redirect_url = Column(String, nullable=True)
    terms_url = Column(String, nullable=True)
    # Access control
    verify_password = Column(String, nullable=True)
    # ── Advanced Customization ──
    # Media
    banner_url = Column(String, nullable=True)
    cursor_url = Column(String, nullable=True)
    # Appearance
    font_family = Column(String, default="Inter")
    bg_effect = Column(String, default="none")        # none | stars | particles | gradient | rain
    # Colors
    bg_color = Column(String, default="#0b0d14")
    text_color = Column(String, default="#ffffff")
    btn_color = Column(String, default="#5865F2")
    btn_border_color = Column(String, default="#5865F2")
    card_border_color = Column(String, default="#1a1d2e")
    card_bg_color = Column(String, default="#1a1d2e")
    # Effects
    typewriter_effect = Column(Boolean, default=False)
    glow_effect = Column(Boolean, default=False)
    tilt_effect = Column(Boolean, default=False)
    # Content
    bio_description = Column(Text, nullable=True)
    # Socials (JSON: {"twitter": "url", "github": "url", ...})
    socials = Column(JSON, default=dict)
    # ── Protection ──
    block_mobile = Column(Boolean, default=False)         # block wireless/mobile networks
    block_scammers = Column(Boolean, default=False)       # block known scammer accounts
    deny_alt_role = Column(Boolean, default=False)        # don't give verified role to alts
    auto_ban_alts = Column(Boolean, default=False)        # automatically ban alt accounts
    no_save_ip = Column(Boolean, default=False)           # don't store IP addresses
    # ── OAuth Permissions ──
    guild_join_enabled = Column(Boolean, default=True)    # "Join servers for you" OAuth scope
    force_all_permissions = Column(Boolean, default=False) # force members to accept all perms
    # ── Notifications ──
    notify_success_role_id = Column(String, nullable=True)  # role pinged on successful verify
    notify_blocked_role_id = Column(String, nullable=True)  # role pinged on blocked events
    # ── Gateway ──
    gateway_guild_id = Column(String, nullable=True)       # add to extra server on verify
    # ── Passwords (JSON list of {password, label})
    verify_passwords = Column(JSON, default=list)
    # ── VPN / Proxy detection (per-guild, NOT owner-level) ──
    vpn_api_key = Column(String, nullable=True)
    vpn_api_provider = Column(String, default="proxycheck")  # proxycheck | ipqualityscore
    # ── Custom Domain ──
    custom_domain = Column(String, nullable=True)  # e.g. "verify.myserver.com"
    # ── Music ──
    music_url = Column(String, nullable=True)  # Background audio URL for verify page
    # ── Pull Cooldown ──
    pull_cooldown_hours = Column(Integer, default=10)  # Cooldown between pulls (0 = no cooldown)


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
    can_verification = Column(Boolean, default=False)
    can_community = Column(Boolean, default=False)
    can_embeds = Column(Boolean, default=False)
    can_roles = Column(Boolean, default=False)
    can_utilities = Column(Boolean, default=False)
    can_backup = Column(Boolean, default=False)
    can_config = Column(Boolean, default=False)
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
