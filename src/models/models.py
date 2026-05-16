from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON, UniqueConstraint
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
    bang_gia_message_id = Column(String, nullable=True)
    welcome_channel_id = Column(String, nullable=True)
    bot_status = Column(String, default="offline")
    command_prefix = Column(String, default="!")
    bot_invisible = Column(Boolean, default=False)
    guild_name = Column(String, nullable=True)
    guild_icon = Column(String, nullable=True)
    shard_count = Column(Integer, nullable=True)  # None = auto
    shop_leaderboard_reset_at = Column(DateTime, nullable=True)

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
    guild_id = Column(String, nullable=True, index=True)
    code = Column(String, unique=True, index=True)
    discount_percent = Column(Float, nullable=True)
    discount_amount = Column(Float, nullable=True)
    max_uses = Column(Integer, default=1)
    used_count = Column(Integer, default=0)
    is_public = Column(Boolean, default=False)

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
    voice_buttons = Column(JSON, default=list)  # enabled panel buttons

class TempVoiceRoom(Base):
    __tablename__ = "temp_voice_rooms"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=True, index=True)
    channel_id = Column(String, unique=True)
    owner_id = Column(String, nullable=True)
    panel_channel_id = Column(String, nullable=True)
    panel_message_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class LevelingConfig(Base):
    __tablename__ = "leveling_configs"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, unique=True, index=True)
    enabled = Column(Boolean, default=True)
    xp_min = Column(Integer, default=15)
    xp_max = Column(Integer, default=25)
    cooldown_seconds = Column(Integer, default=60)
    level_formula = Column(String, default="quadratic")
    level_up_channel_id = Column(String, nullable=True)
    level_up_mode = Column(String, default="current")  # current | fixed | dm | off
    ignored_channels = Column(JSON, default=list)
    ignored_roles = Column(JSON, default=list)
    ignored_users = Column(JSON, default=list)
    whitelist_channels = Column(JSON, default=list)
    use_channel_whitelist = Column(Boolean, default=False)
    gain_xp_from_commands = Column(Boolean, default=False)
    remove_old_reward_roles = Column(Boolean, default=False)
    stack_reward_roles = Column(Boolean, default=True)
    rank_card_config = Column(JSON, default=dict)
    leaderboard_reset_at = Column(DateTime, nullable=True)

class MemberXP(Base):
    __tablename__ = "member_xp"
    __table_args__ = (UniqueConstraint("guild_id", "discord_id", name="uq_member_xp_guild_user"),)
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, index=True)
    discord_id = Column(String, index=True)
    username = Column(String, nullable=True)
    xp = Column(Integer, default=0)
    level = Column(Integer, default=0)
    message_count = Column(Integer, default=0)
    last_xp_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)
    rank_card_bg = Column(String, nullable=True)   # slug of selected background e.g. "rank_bg_{guild}_1"

class LevelReward(Base):
    __tablename__ = "level_rewards"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, index=True)
    level = Column(Integer, nullable=False)
    role_id = Column(String, nullable=False)
    role_name = Column(String, nullable=True)
    remove_on_higher = Column(Boolean, default=False)
    dm_user = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class LevelMultiplier(Base):
    __tablename__ = "level_multipliers"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, index=True)
    type = Column(String, nullable=False)  # global | channel | role
    target_id = Column(String, nullable=True)
    target_name = Column(String, nullable=True)
    multiplier = Column(Float, default=1.0)
    priority = Column(Integer, default=0)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

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

class TicketPanelGroup(Base):
    __tablename__ = "ticket_panel_groups"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    name = Column(String, default="Multi Panel")
    channel_id = Column(String, nullable=True)
    message_id = Column(String, nullable=True)
    title = Column(String, default="Hỗ trợ")
    description = Column(Text, nullable=True)
    color = Column(String, default="#5865F2")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    panels = relationship("TicketPanel", back_populates="group")


class TicketPanel(Base):
    __tablename__ = "ticket_panels"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    channel_id = Column(String, nullable=True)           # channel panel được gửi vào
    message_id = Column(String, nullable=True)           # Discord message ID
    group_id = Column(Integer, ForeignKey("ticket_panel_groups.id", ondelete="SET NULL"), nullable=True)
    group = relationship("TicketPanelGroup", back_populates="panels")
    title = Column(String, default="Hỗ trợ")
    description = Column(Text, default="Nhấn nút bên dưới để tạo ticket hỗ trợ.")
    color = Column(String, default="#5865F2")
    button_label = Column(String, default="Tạo Ticket")  # legacy single-button
    button_emoji = Column(String, default="🎫")           # legacy single-button
    button_style = Column(String, default="primary")      # legacy single-button
    category_id = Column(String, nullable=True)
    # ── Per-panel overrides (null = dùng global TicketConfig) ──
    naming_format = Column(String, nullable=True)
    open_message_title = Column(String, nullable=True)
    open_message_body = Column(Text, nullable=True)
    close_message_title = Column(String, nullable=True)
    close_message_body = Column(Text, nullable=True)
    claim_message_title = Column(String, nullable=True)
    claim_message_body = Column(Text, nullable=True)
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
    guild_id = Column(String, nullable=True, index=True)
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

# ── Phase 3: Welcome & Auto Role ──────────────────────────────────────────────

class WelcomeConfig(Base):
    __tablename__ = "welcome_configs"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False, unique=True)
    # Welcome
    welcome_enabled = Column(Boolean, default=False)
    welcome_channel_id = Column(String, nullable=True)
    welcome_message = Column(Text, nullable=True)
    welcome_embed_enabled = Column(Boolean, default=True)
    # DM
    welcome_dm_enabled = Column(Boolean, default=False)
    welcome_dm_message = Column(Text, nullable=True)
    # Goodbye
    goodbye_enabled = Column(Boolean, default=False)
    goodbye_channel_id = Column(String, nullable=True)
    goodbye_message = Column(Text, nullable=True)
    goodbye_embed_enabled = Column(Boolean, default=True)
    # Extras
    auto_nickname_template = Column(String, nullable=True)

class ManagedEmoji(Base):
    __tablename__ = "managed_emojis"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=True, index=True)
    discord_id = Column(String, unique=True, nullable=False)  # Discord emoji snowflake
    name = Column(String, nullable=False)
    animated = Column(Boolean, default=False)
    url = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AutoRoleConfig(Base):
    __tablename__ = "auto_role_configs"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False, unique=True)
    join_roles = Column(JSON, default=list)
    bot_roles = Column(JSON, default=list)

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
