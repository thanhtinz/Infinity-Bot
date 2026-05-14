# Plan: Mở rộng Discord Bot Builder — 40+ Tính năng mới

## Context
Bot hiện có: Shop system, Ticket system, Giveaway, Invite tracking, Moderation (warn/ban/kick/timeout), Sticky messages, Temp voice, Welcome/Goodbye, Feedback. Cần mở rộng thêm ~40 tính năng mới, **tất cả cấu hình qua Dashboard** (không cần code bot riêng cho mỗi server).

### Codebase hiện tại
- **Models**: `src/models/models.py` (394 lines) — SQLAlchemy + Neon PostgreSQL
- **API**: `src/api/routes.py` (2186 lines) — FastAPI, đã rất lớn → cần tách file
- **Bot cogs**: `src/bot/cogs/` — 8 cogs hiện tại
- **Dashboard pages**: `src/pages/` — 28 pages
- **Embeds**: 32 events trong `embed_utils.py` + `EmbedsManager.tsx`
- **Sidebar**: 5 groups (Shop, Ticket, Cộng đồng, Tiện ích, Cấu hình)
- **Components**: `ChannelSelect.tsx`, `RoleSelect.tsx` — reusable cho config pages
- **Pattern**: Dashboard-only config → API CRUD → Bot đọc config từ DB runtime

### Constraint quan trọng
- `create_all()` chỉ tạo bảng mới, KHÔNG alter → cần ALTER TABLE cho cột mới
- Mỗi tính năng phải có embed events trong `embed_utils.py` + `EmbedsManager.tsx`
- `routes.py` 2186 dòng → **PHẢI tách thành router modules** trước khi thêm tính năng

## Scope

### Phase 0: Refactor (prerequisite)
Tách `routes.py` thành modules trước khi thêm tính năng:
- `src/api/routes/__init__.py` — main router, include sub-routers
- `src/api/routes/config.py` — setup, config, discord endpoints
- `src/api/routes/shop.py` — products, orders, coupons, feedback
- `src/api/routes/tickets.py` — ticket CRUD, panels, forms, teams
- `src/api/routes/community.py` — giveaways, invites, warnings, sticky
- `src/api/routes/embeds.py` — embed CRUD
- Các route mới sẽ thêm vào module tương ứng

### Phase 1: Auto Moderation & Security 🔴
**Models** (`src/models/models.py`):
```
AutoModConfig — guild_id, anti_spam(bool), anti_link(bool), anti_raid(bool), 
    spam_threshold(int), spam_interval(int), link_whitelist(JSON), 
    raid_threshold(int), raid_interval(int), raid_action(str),
    banned_words(JSON), caps_threshold(int), duplicate_threshold(int)
AntiNukeConfig — guild_id, enabled, role_protect, channel_protect, webhook_protect, bot_protect,
    action(str: kick/ban/strip), whitelist_role_ids(JSON), whitelist_user_ids(JSON)
JailConfig — guild_id, enabled, jail_role_id, jail_channel_id, jail_log_channel_id
JailCase — guild_id, user_id, mod_id, reason, jailed_at, unjailed_at, active(bool)
```

**Bot cog**: `src/bot/cogs/automod.py`
- on_message listener: check spam, links, banned words, caps, duplicates
- anti-raid: on_member_join rate limit detection
- Jail: `/jail`, `/unjail` commands
- Anti-nuke: on_guild_role_delete, on_guild_channel_delete, on_webhooks_update, on_member_join (bot detect)

**Dashboard pages**:
- `AutoModConfig.tsx` — toggles + thresholds cho spam/link/raid/words/caps
- `AntiNukeConfig.tsx` — protection toggles + whitelist management
- `JailManager.tsx` — jail config + active jail cases list

**API routes**: `src/api/routes/automod.py`
- GET/PUT `/api/automod` — config CRUD
- GET/PUT `/api/antinuke` — config CRUD  
- GET/PUT `/api/jail/config`, GET `/api/jail/cases`, POST `/api/jail/unjail/{id}`

**Embed events** (8 mới):
- `automod_spam`, `automod_link`, `automod_word`, `automod_raid`
- `jail`, `unjail`
- `antinuke_alert`, `antinuke_action`

### Phase 2: Verification System 🔴
**Models**:
```
VerificationConfig — guild_id, method(button/captcha/oauth), 
    verified_role_id, unverified_role_id, channel_id, log_channel_id,
    captcha_difficulty(str), anti_alt_enabled(bool), min_account_age_days(int),
    dm_welcome_enabled(bool), dm_welcome_message(Text)
VerificationLog — guild_id, user_id, method, passed(bool), timestamp, details(JSON)
```

**Bot cog**: `src/bot/cogs/verification.py`
- Button verify: send panel embed with button → grant role
- Captcha verify: generate captcha image → DM → verify response
- Anti-alt: check account creation date on join
- OAuth verify: redirect to dashboard OAuth flow

**Dashboard pages**:
- `VerificationConfig.tsx` — method picker, role config, anti-alt settings

**API routes**: `src/api/routes/verification.py`
- GET/PUT `/api/verification` — config
- GET `/api/verification/logs` — verification logs

**Embed events** (4 mới):
- `verify_success`, `verify_fail`, `anti_alt_block`, `verify_panel`

### Phase 3: Welcome & Autorole 🟡
**Models**:
```
WelcomeConfig — guild_id, welcome_enabled, welcome_channel_id, welcome_message(Text),
    welcome_embed_enabled, welcome_dm_enabled, welcome_dm_message(Text),
    goodbye_enabled, goodbye_channel_id, goodbye_message(Text), goodbye_embed_enabled,
    auto_nickname_template(str), join_card_enabled, join_card_bg_url(str)
AutoRoleConfig — guild_id, join_roles(JSON), bot_roles(JSON)
ButtonRole — guild_id, channel_id, message_id, label, emoji, role_id, style(str), row(int)
SelectMenuRole — guild_id, channel_id, message_id, placeholder(str), 
    options(JSON: [{label, emoji, role_id, description}]), min_values, max_values
ColorRole — guild_id, role_id, name, hex_color, emoji
NotificationRole — guild_id, role_id, name, description, emoji, channel_id
```

**Bot cog**: `src/bot/cogs/welcome.py` (mở rộng existing), `src/bot/cogs/roles.py` (mới)
- Welcome: enhanced on_member_join with DM, card generation, auto-nickname
- Button roles: persistent view with role toggle buttons
- Select menu roles: dropdown role picker
- Color/notification roles: slash commands + dashboard config

**Dashboard pages**:
- `WelcomeConfig.tsx` — welcome/goodbye/DM/card/autonick settings
- `AutoRoleConfig.tsx` — join roles, bot roles
- `ButtonRoles.tsx` — builder for button role panels
- `SelectMenuRoles.tsx` — builder for select menu panels
- `ColorRoles.tsx` — color role management
- `NotificationRoles.tsx` — notification role management

**API routes**: `src/api/routes/welcome.py`, `src/api/routes/roles.py`

**Embed events** (6 mới):
- `welcome` (đã có — mở rộng vars), `goodbye` (đã có — mở rộng), 
- `dm_welcome`, `join_card`, `button_role_panel`, `select_role_panel`

### Phase 4: Logging System 🔴
**Models**:
```
LoggingConfig — guild_id, 
    message_log_channel_id, voice_log_channel_id, mod_log_channel_id,
    invite_log_channel_id, nickname_log_channel_id, role_log_channel_id,
    member_log_channel_id, server_log_channel_id,
    ignored_channels(JSON), ignored_roles(JSON)
SnipeCache — (in-memory dict, not DB — last deleted/edited message per channel)
```

**Bot cog**: `src/bot/cogs/logging.py`
- on_message_delete, on_message_edit → message log channel
- on_voice_state_update → voice log channel
- on_member_update (nick, roles) → nick/role log channel
- on_member_join, on_member_remove → member log channel
- Snipe: `/snipe`, `/editsnipe` — read from in-memory cache

**Dashboard pages**:
- `LoggingConfig.tsx` — channel pickers cho mỗi log type + ignored channels/roles

**API routes**: `src/api/routes/logging.py`

**Embed events** (12 mới):
- `log_message_delete`, `log_message_edit`, `log_message_bulk_delete`
- `log_voice_join`, `log_voice_leave`, `log_voice_move`
- `log_member_join`, `log_member_leave`
- `log_nickname_change`, `log_role_update`
- `log_channel_create`, `log_channel_delete`

### Phase 5: Community Features 🟡
**Models**:
```
StarboardConfig — guild_id, channel_id, threshold(int), emoji(str), self_star(bool), ignored_channels(JSON)
StarredMessage — guild_id, original_message_id, original_channel_id, starboard_message_id, star_count(int)
SuggestionConfig — guild_id, channel_id, thread_enabled(bool), anonymous(bool),
    approved_channel_id, denied_channel_id, upvote_emoji, downvote_emoji
Suggestion — guild_id, message_id, user_id, content(Text), status(str: pending/approved/denied), 
    mod_id, mod_reason, vote_count(int), thread_id
HighlightConfig — guild_id, channel_id, threshold(int), timeframe_minutes(int)
```

**Bot cog**: `src/bot/cogs/community.py`
- Starboard: on_raw_reaction_add/remove → check threshold → post to starboard
- Suggestions: `/suggest` → post embed → voting → approve/deny
- Highlight: auto-detect hot messages → repost to highlight channel

**Dashboard pages**:
- `StarboardConfig.tsx` — channel, threshold, emoji, ignored
- `SuggestionConfig.tsx` — channels, voting config, thread toggle
- `SuggestionList.tsx` — manage pending suggestions

**Embed events** (5 mới):
- `starboard_post`, `suggestion_new`, `suggestion_approved`, `suggestion_denied`, `highlight_post`

### Phase 6: Scheduling & Events 🟡
**Models**:
```
ScheduledMessage — guild_id, channel_id, content(Text), embed_data(JSON), 
    cron_expression(str), next_run(DateTime), active(bool), created_by(str)
Reminder — guild_id, user_id, channel_id, message(Text), remind_at(DateTime), sent(bool)
CountdownEvent — guild_id, channel_id, message_id, name(str), target_date(DateTime), active(bool)
```

**Bot cog**: `src/bot/cogs/scheduler.py`
- Background task loop: check scheduled messages, reminders, countdowns
- `/remind` command, `/countdown` command

**Dashboard pages**:
- `ScheduledMessages.tsx` — CRUD cho scheduled messages with cron builder
- `RemindersManager.tsx` — view/manage active reminders

**API routes**: `src/api/routes/scheduler.py`

**Embed events** (3 mới):
- `scheduled_message`, `reminder`, `countdown_complete`

### Phase 7: Utility Slash Commands 🟢
**Bot cog**: `src/bot/cogs/utility.py`
- `/avatar [user]` — show avatar/banner
- `/serverinfo` — server stats embed
- `/userinfo [user]` — user info embed
- `/translate <text> <lang>` — Google Translate API
- `/qr <text>` — QR code generation
- `/poll <question> <options>` — reaction-based polls

**Dashboard**: Không cần page mới (slash commands chỉ cần bot cog)

**Embed events**: 0 mới (utility responses dùng hardcoded embeds — theo convention)

### Phase 8: Dashboard Review & Polish
- Review tất cả pages hiện tại cho UX consistency
- Error handling + loading states
- Mobile responsiveness check
- Sidebar restructure cho ~40 items mới

## Non-Goals (deferred)
- Phone/email verify (cần SMS/email service provider)
- OAuth verify (phức tạp, cần OAuth2 flow riêng)
- Join background card (cần image processing — canvas/pillow)
- Media showcase (cần file storage)

## Implementation Order
```
Phase 0 (Refactor routes.py) → Phase 7 (Utility — nhỏ, warm-up)
→ Phase 3 (Welcome/Roles) → Phase 4 (Logging) 
→ Phase 1 (AutoMod) → Phase 5 (Community) 
→ Phase 6 (Scheduling) → Phase 2 (Verification) 
→ Phase 8 (Polish)
```

Lý do: Refactor trước để scalable → Utility dễ nhất → Welcome/Roles phổ biến nhất → Logging cần thiết cho moderation → AutoMod core feature → Community/Scheduling bổ sung → Verification phức tạp nhất → Polish cuối.

## New Embed Events Summary (38 mới, tổng 70)
| Phase | Events |
|-------|--------|
| 1 - AutoMod | automod_spam, automod_link, automod_word, automod_raid, jail, unjail, antinuke_alert, antinuke_action |
| 2 - Verify | verify_success, verify_fail, anti_alt_block, verify_panel |
| 3 - Welcome | dm_welcome, join_card, button_role_panel, select_role_panel |
| 4 - Logging | log_message_delete, log_message_edit, log_message_bulk_delete, log_voice_join, log_voice_leave, log_voice_move, log_member_join, log_member_leave, log_nickname_change, log_role_update, log_channel_create, log_channel_delete |
| 5 - Community | starboard_post, suggestion_new, suggestion_approved, suggestion_denied, highlight_post |
| 6 - Scheduling | scheduled_message, reminder, countdown_complete |

## New Sidebar Structure
```
📊 Dashboard
⚡ Trạng thái Bot
─────────────
🛒 Shop (existing)
🎫 Ticket (existing)
─────────────
🛡️ Bảo mật
  ├─ Auto Mod
  ├─ Anti Nuke  
  ├─ Jail
  └─ Verification
─────────────
👋 Chào mừng
  ├─ Welcome & Goodbye
  ├─ Auto Role
  ├─ Button Roles
  ├─ Select Menu Roles
  ├─ Color Roles
  └─ Notification Roles
─────────────
📋 Logging
  └─ Log Config
─────────────
🏠 Cộng đồng
  ├─ Giveaway (existing)
  ├─ Invite (existing)
  ├─ Cảnh cáo (existing)
  ├─ Starboard
  ├─ Suggestions
  └─ Highlights
─────────────
⏰ Lập lịch
  ├─ Scheduled Messages
  └─ Reminders
─────────────
🔧 Tiện ích (existing - Sticky, Embeds, Emoji)
⚙️ Cấu hình (existing)
```

## Files to Modify/Create per Phase

### Phase 0
- MODIFY: `src/api/routes.py` → SPLIT into `src/api/routes/` package
- MODIFY: `app.py` — update router import

### Phase 1 (AutoMod)
- CREATE: `src/bot/cogs/automod.py`, `src/api/routes/automod.py`
- CREATE: `src/pages/AutoModConfig.tsx`, `AntiNukeConfig.tsx`, `JailManager.tsx`
- MODIFY: `models.py`, `embed_utils.py`, `EmbedsManager.tsx`, `App.tsx`

### Phase 2 (Verification)
- CREATE: `src/bot/cogs/verification.py`, `src/api/routes/verification.py`
- CREATE: `src/pages/VerificationConfig.tsx`
- MODIFY: `models.py`, `embed_utils.py`, `EmbedsManager.tsx`, `App.tsx`

### Phase 3 (Welcome/Roles)
- CREATE: `src/bot/cogs/roles.py`, `src/api/routes/welcome.py`, `src/api/routes/roles.py`
- CREATE: `src/pages/WelcomeConfig.tsx`, `AutoRoleConfig.tsx`, `ButtonRoles.tsx`, `SelectMenuRoles.tsx`, `ColorRoles.tsx`, `NotificationRoles.tsx`
- MODIFY: `models.py`, `embed_utils.py`, `EmbedsManager.tsx`, `App.tsx`

### Phase 4 (Logging)
- CREATE: `src/bot/cogs/logging_cog.py`, `src/api/routes/logging.py`
- CREATE: `src/pages/LoggingConfig.tsx`
- MODIFY: `models.py`, `embed_utils.py`, `EmbedsManager.tsx`, `App.tsx`

### Phase 5 (Community)
- CREATE: `src/bot/cogs/community.py`, `src/api/routes/community_new.py`
- CREATE: `src/pages/StarboardConfig.tsx`, `SuggestionConfig.tsx`, `SuggestionList.tsx`
- MODIFY: `models.py`, `embed_utils.py`, `EmbedsManager.tsx`, `App.tsx`

### Phase 6 (Scheduling)
- CREATE: `src/bot/cogs/scheduler.py`, `src/api/routes/scheduler.py`
- CREATE: `src/pages/ScheduledMessages.tsx`, `RemindersManager.tsx`
- MODIFY: `models.py`, `embed_utils.py`, `EmbedsManager.tsx`, `App.tsx`

### Phase 7 (Utility)
- CREATE: `src/bot/cogs/utility.py`
- No dashboard pages needed

## Verification
Mỗi phase verify bằng:
1. DB migration: chạy ALTER TABLE hoặc create_all() → verify tables exist
2. API test: curl các endpoints mới
3. Dashboard: mở page mới, test CRUD operations
4. Bot: test slash commands / event listeners trong Discord server thật
5. Embeds: verify event xuất hiện trong EmbedsManager và build_embed() hoạt động
