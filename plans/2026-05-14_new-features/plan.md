# Plan: 7 New Features + Giveaway Reaction Refactor

## Context
Discord bot builder dashboard cần bổ sung 7 features mới và refactor giveaway từ button sang reaction. Project đang có 36 models, 46 embed events, 12 cog files. Cần thêm models/cogs/routes/pages cho mỗi feature + embed events theo convention.

## Scope
### In Scope
1. **Giveaway Refactor** — chuyển từ Button sang Reaction (🎉 emoji)
2. **Auto Mod** — anti-spam, anti-link, bad words, caps lock, mention spam
3. **Reaction Roles** — react emoji → gán role
4. **Scheduled Messages** — hẹn giờ gửi tin nhắn/embed
5. **Custom Commands** — tạo command text response từ dashboard
6. **Starboard** — ghim tin nhắn nhiều ⭐ vào kênh riêng
7. **AFK System** — đặt trạng thái AFK, auto-reply khi mention
8. **Backup & Restore** — export/import cấu hình server

### Non-Goals
- Leveling/XP system (deferred)
- Music bot features
- AI integration cho mod

## Implementation Plan

### Phase 1: Giveaway Reaction Refactor
**Files:** `src/bot/cogs/giveaway.py`, `src/pages/GiveawaysManager.tsx`

- Xóa `GiveawayJoinView` (discord.ui.View + Button)
- Thay bằng: bot add reaction 🎉 vào message sau khi gửi embed
- Listen `on_raw_reaction_add` / `on_raw_reaction_remove` để track entries
- Khi user react 🎉 → thêm GiveawayEntry, khi unreact → xóa
- Vẫn check GiveawayBanned
- `end_giveaway()` → đọc entries từ DB (ko đổi)
- Dashboard GiveawaysManager: bỏ mention "button", UI giữ nguyên

### Phase 2: Auto Mod
**New files:**
- Model: `AutoModConfig` trong `models.py`
- Cog: `src/bot/cogs/automod.py`
- Route: `src/api/routes/automod.py` (+ register trong `__init__.py`)
- Page: `src/pages/AutoModConfig.tsx`
- Sidebar: thêm vào group "Kiểm duyệt"

**Model `AutoModConfig`:**
```
guild_id (unique), enabled (bool)
anti_spam_enabled, anti_spam_max_messages (int, default 5), anti_spam_interval (int seconds, default 5), anti_spam_action (warn/mute/kick)
anti_link_enabled, anti_link_whitelist (JSON list of domains)
bad_words_enabled, bad_words_list (JSON list of strings)
caps_lock_enabled, caps_lock_min_length (int, default 10), caps_lock_percentage (int, default 70)
mention_spam_enabled, mention_spam_max (int, default 5), mention_spam_action (warn/mute/kick)
ignored_channels (JSON), ignored_roles (JSON)
log_channel_id (str)
```

**Cog logic:**
- `on_message` listener → check each filter in order
- Anti-spam: track message timestamps per user (in-memory dict), if >max in interval → action
- Anti-link: regex match URLs, check whitelist
- Bad words: substring match (case-insensitive)
- Caps lock: % uppercase > threshold for messages > min_length
- Mention spam: count mentions in message
- Action: delete message + warn/mute/kick based on config
- Skip: bot messages, ignored channels, ignored roles, admin

**Embed events (4):**
- `automod_warn` — cảnh báo automod
- `automod_mute` — mute automod
- `automod_kick` — kick automod
- `automod_delete` — xóa tin nhắn

**Dashboard page:**
- Toggle cards for each filter module
- Config fields per module (max messages, interval, word list, etc.)
- Ignored channels/roles multi-select
- Log channel select

### Phase 3: Reaction Roles
**New files:**
- Model: `ReactionRole` trong `models.py`
- Cog: listener trong `src/bot/cogs/roles.py` (add to existing)
- Route: thêm endpoints trong existing routes hoặc new `src/api/routes/roles.py`
- Page: `src/pages/ReactionRoles.tsx`
- Sidebar: thêm vào group "Chào mừng" (cùng Button/Select Roles)

**Model `ReactionRole`:**
```
id, guild_id, channel_id, message_id (sent message)
name (panel name)
embed_title, embed_description, embed_color
mappings (JSON): [{emoji: "🎮", role_id: "123", label: "Gamer"}, ...]
created_at
```

**Cog logic:**
- Khi tạo panel → bot gửi embed + add reactions (các emoji trong mappings)
- `on_raw_reaction_add` → check message_id matches → gán role
- `on_raw_reaction_remove` → xóa role
- Handle cả unicode emoji và custom emoji (từ Emoji Manager)

**Embed events (1):**
- `reaction_role_panel` — embed hiển thị panel

**Dashboard page:**
- List panels (CRUD)
- Edit panel: embed builder (title/desc/color) + emoji↔role mappings
- "Gửi Panel" button → API → bot sends to channel
- EmojiPicker integration cho chọn emoji

### Phase 4: Scheduled Messages
**New files:**
- Model: `ScheduledMessage` trong `models.py`
- Cog: `src/bot/cogs/scheduler.py`
- Route: thêm vào `src/api/routes/community.py` hoặc new file
- Page: `src/pages/ScheduledMessages.tsx`
- Sidebar: thêm vào group "Tiện ích"

**Model `ScheduledMessage`:**
```
id, guild_id, channel_id
content (text), embed_data (JSON, optional)
send_at (datetime, one-time) OR cron_expression (str, recurring)
repeat_type: none/hourly/daily/weekly/monthly
timezone (str, default "Asia/Ho_Chi_Minh")
sent (bool), last_sent_at (datetime)
enabled (bool)
created_by (str, discord_id)
created_at
```

**Cog logic:**
- `tasks.loop(minutes=1)` → check for messages where `send_at <= now` and not sent
- For recurring: after send, calculate next `send_at`
- Send as plain text or embed based on data
- Mark sent=True for one-time

**Dashboard page:**
- List scheduled messages (upcoming/sent/recurring)
- Create/edit: channel select, content textarea, embed builder (optional), datetime picker, repeat options
- Toggle enable/disable
- Delete

### Phase 5: Custom Commands
**New files:**
- Model: `CustomCommand` trong `models.py`
- Cog: `src/bot/cogs/custom_commands.py`
- Route: `src/api/routes/custom_commands.py`
- Page: `src/pages/CustomCommands.tsx`
- Sidebar: thêm vào group "Tiện ích"

**Model `CustomCommand`:**
```
id, guild_id
name (str, unique per guild, the /command name)
description (str)
response_type: text/embed
response_text (text)
response_embed (JSON, embed data)
ephemeral (bool, default False)
required_roles (JSON, list role_ids)
enabled (bool)
created_at
```

**Cog logic:**
- On bot startup + on command create/update → register slash commands dynamically
- Use `bot.create_application_command()` or prefix commands
- **Simpler approach**: use a catch-all prefix command (`!commandname`) instead of dynamic slash commands
- Or: use `on_message` listener to detect `!name` prefix → respond
- Check required_roles before responding
- Variable substitution: `{user}`, `{user.mention}`, `{server}`, `{channel}`, `{member_count}`

**Dashboard page:**
- List commands with toggle
- Create/edit: name, description, response type (text/embed), response content
- Embed builder for embed type
- Role restriction multi-select
- Preview response

### Phase 6: Starboard
**New files:**
- Model: `StarboardConfig`, `StarboardEntry` trong `models.py`
- Cog: `src/bot/cogs/starboard.py`
- Route: thêm endpoints
- Page: `src/pages/StarboardConfig.tsx`
- Sidebar: thêm vào group "Cộng đồng"

**Model `StarboardConfig`:**
```
guild_id (unique), channel_id (starboard channel)
emoji (str, default "⭐")
threshold (int, default 3, minimum stars to pin)
self_star (bool, default False, allow self-star)
ignored_channels (JSON)
enabled (bool)
```

**Model `StarboardEntry`:**
```
id, guild_id, source_message_id, source_channel_id
starboard_message_id (message in starboard channel)
star_count (int)
author_id (str)
```

**Cog logic:**
- `on_raw_reaction_add` / `on_raw_reaction_remove` for starboard emoji
- Count reactions (exclude self if config), if >= threshold → post/update starboard embed
- Starboard embed: author, content preview, attachment, jump link, star count
- If star_count drops below threshold → delete from starboard
- Prevent starring starboard messages

**Embed events (1):**
- `starboard_post` — starboard entry embed

**Dashboard page:**
- Config: channel select, emoji (EmojiPicker), threshold slider, self-star toggle
- Ignored channels multi-select
- Stats: total starred messages

### Phase 7: AFK System
**New files:**
- Model: `AFKStatus` trong `models.py`
- Cog: `src/bot/cogs/afk.py`
- Route: minimal (chỉ stats)
- Page: không cần trang riêng (chỉ command)

**Model `AFKStatus`:**
```
guild_id, user_id (composite PK)
reason (str)
set_at (datetime)
```

**Cog logic:**
- `/afk [reason]` → set AFK status, add "[AFK]" prefix to nickname
- `on_message` listener:
  - If AFK user sends message → remove AFK, restore nickname
  - If someone mentions AFK user → reply "User đang AFK: {reason} (since {time})"

**Embed events (2):**
- `afk_set` — thông báo đặt AFK
- `afk_return` — thông báo trở lại

### Phase 8: Backup & Restore
**New files:**
- Route: `src/api/routes/backup.py`
- Page: `src/pages/BackupRestore.tsx`
- Sidebar: thêm vào group "Cấu hình"

**Logic (API only, no cog needed):**
- **Backup**: Export all config tables to JSON (SystemConfig, LoggingConfig, AutoModConfig, WelcomeConfig, AutoRoleConfig, ButtonRole, SelectMenuRole, ReactionRole, TicketConfig, TicketPanel, StarboardConfig, CustomCommand, ScheduledMessage, StickyMessage, EmbedTemplate)
- Exclude: transactional data (orders, users, tickets, log entries, giveaway entries)
- Return as downloadable JSON file
- **Restore**: Upload JSON → validate → replace configs
- Confirm dialog before restore (destructive)

**Dashboard page:**
- "Tạo Backup" button → download JSON
- "Khôi phục" → file upload → preview changes → confirm → apply
- Backup history (optional, store last 5 in DB)

---

## Embed Events Summary (8 new)
| Event | Group |
|---|---|
| `automod_warn` | Kiểm duyệt |
| `automod_mute` | Kiểm duyệt |
| `automod_kick` | Kiểm duyệt |
| `automod_delete` | Kiểm duyệt |
| `reaction_role_panel` | Cộng đồng |
| `starboard_post` | Cộng đồng |
| `afk_set` | Tiện ích |
| `afk_return` | Tiện ích |

## New Models Summary (8)
`AutoModConfig`, `ReactionRole`, `ScheduledMessage`, `CustomCommand`, `StarboardConfig`, `StarboardEntry`, `AFKStatus`

## Build Order
1. **Giveaway refactor** (nhỏ, chỉ sửa cog)
2. **AFK** (nhỏ, standalone)
3. **Starboard** (nhỏ, standalone)
4. **Auto Mod** (medium, standalone)
5. **Reaction Roles** (medium, reuse EmojiPicker)
6. **Custom Commands** (medium, standalone)
7. **Scheduled Messages** (medium, needs datetime picker)
8. **Backup & Restore** (cuối cùng, cần tất cả models đã có)

## Verification
Per feature:
- Model created + table migrated
- Cog loads without error (bot restart)
- API endpoints return 200 (curl test)
- Dashboard page renders + CRUD works
- Embed events added to both `embed_utils.py` and `EmbedsManager.tsx`
- Test bot command in Discord (if applicable)

End-to-end:
- All 8 features accessible from sidebar
- Backup exports all new configs
- Restore imports correctly
