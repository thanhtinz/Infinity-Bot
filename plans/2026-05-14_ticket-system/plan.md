# Ticket System — Implementation Plan

## Context

Bổ sung hệ thống ticket hoàn chỉnh cho Discord bot + dashboard quản lý.  
Project stack: React + TypeScript frontend, FastAPI + SQLAlchemy backend, py-cord bot.  
Hiện tại chưa có bất kỳ ticket code nào.

---

## Scope & Non-Goals

**Trong scope:**
- Bot: `/ticket` group + `/panel` group + `/transcript` + auto-close bg task
- DB: 5 bảng mới (TicketConfig, TicketPanel, Ticket, TicketBlacklist, TicketNote)
- API: CRUD endpoints cho dashboard
- Dashboard: trang TicketManager (danh sách ticket, panels, cấu hình, stats)
- Admin commands ẩn với user thường (via `default_member_permissions`)

**Ngoài scope (defer):**
- `/ticket merge`, `/ticket split`, `/ticket escalate` — quá phức tạp
- `/faq`, `/review`, `/response` — không liên quan ticket core
- Real-time transcript streaming
- Multi-panel phức tạp (mỗi panel 1 loại ticket khác nhau)

---

## Database Models (5 bảng mới)

### `ticket_configs`
```python
guild_id: String (unique)
category_id: String          # Discord category chứa ticket channels
log_channel_id: String       # channel ghi log ticket
support_role_ids: JSON        # [role_id, ...] — staff có thể thao tác ticket
ticket_limit: Integer = 1    # max open tickets / user
cooldown_minutes: Integer = 0
auto_close_hours: Integer = 0 # 0 = tắt
naming_format: String = "ticket-{number}"  # hoặc ticket-{username}
```

### `ticket_panels`
```python
guild_id: String
name: String
channel_id: String           # channel panel được gửi vào
message_id: String           # message chứa button
title, description, color: String
button_label: String = "Tạo Ticket"
button_emoji: String = "🎫"
button_style: String = "primary"
category_id: String          # override category riêng cho panel này
created_at: DateTime
```

### `tickets`
```python
guild_id: String
channel_id: String           # ticket channel Discord ID
creator_id: String           # Discord user ID
claimed_by: String           # staff Discord ID (nullable)
status: String = "open"      # open | closed | deleted
priority: String = "normal"  # low | normal | high | urgent
subject: String              # tên ticket
panel_id: Integer FK(ticket_panels) nullable
close_reason: String
members: JSON = []           # list Discord IDs được add vào
tags: JSON = []
created_at, closed_at: DateTime
```

### `ticket_blacklists`
```python
guild_id: String
discord_id: String
reason: String
added_by: String
created_at: DateTime
```

### `ticket_notes`
```python
ticket_id: Integer FK(tickets)
author_id: String
content: Text
created_at: DateTime
```

---

## Bot Implementation (`src/bot/cogs/ticket.py`)

### Slash Command Groups
```
ticket_group = SlashCommandGroup("ticket", "Hệ thống ticket")
panel_group  = SlashCommandGroup("panel",  "Quản lý ticket panel")
```

### `/ticket` commands

| Command | Permission | Mô tả |
|---|---|---|
| `create [subject]` | Mọi user | Tạo ticket channel mới |
| `close [reason]` | creator hoặc staff | Đóng ticket, archive channel |
| `reopen` | staff (manage_channels) | Mở lại ticket đã đóng |
| `delete` | administrator | Xóa channel ticket khỏi Discord |
| `rename <name>` | manage_channels | Đổi tên channel ticket |
| `move <category_id>` | administrator | Di chuyển sang category khác |
| `claim` | manage_channels | Nhận xử lý ticket |
| `unclaim` | manage_channels | Bỏ claim |
| `add @user` | manage_channels | Thêm user vào ticket channel |
| `remove @user` | manage_channels | Xóa user khỏi ticket channel |
| `blacklist @user [reason]` | administrator | Cấm user tạo ticket |
| `whitelist @user` | administrator | Bỏ cấm |
| `priority <low/normal/high/urgent>` | manage_channels | Đặt priority |
| `transfer @staff` | manage_channels | Chuyển claim sang staff khác |
| `notes [content]` | manage_channels | Xem / thêm note cho ticket |
| `pin` | manage_channels | Pin / unpin ticket |
| `history [@user]` | mọi user (own) | Lịch sử ticket |
| `stats` | mọi user | Thống kê ticket của mình |
| `setup` | administrator | Cấu hình hệ thống ticket |
| `settings` | administrator | Xem / sửa cấu hình |
| `limit <n>` | administrator | Set limit ticket/user |
| `cooldown <minutes>` | administrator | Set cooldown |
| `logs [n]` | administrator | Xem log gần nhất |

### `/panel` commands (tất cả administrator)

| Command | Mô tả |
|---|---|
| `create <name>` | Tạo panel mới (chưa gửi) |
| `edit <panel_id>` | Sửa title/desc/button |
| `delete <panel_id>` | Xóa panel |
| `send <panel_id> #channel` | Gửi embed + button vào channel |
| `list` | Liệt kê các panel |

### `/transcript` (manage_channels)
- Fetch 200 messages gần nhất từ channel ticket
- Format text: `[HH:MM] Username: content`
- Gửi file `.txt` vào channel hiện tại + log channel

### `/autoclose <hours>` (administrator)
- Set auto_close_hours trong TicketConfig

### Background task: `_auto_close_tickets`
- Check mỗi 30 phút: ticket `open`, `closed_at` = null, last message > auto_close_hours
- Tự close với reason "Ticket tự động đóng do không hoạt động"

### Persistent Panel View
```python
class PanelView(discord.ui.View):
    timeout = None  # persistent
    custom_id = "ticket_panel:{panel_id}"

# on_ready: register tất cả PanelView cho panels có message_id
```

### Channel Permission Logic (khi tạo ticket)
```
@everyone: view=False, send=False
creator:   view=True, send=True, read_history=True
support_roles: view=True, send=True, manage_messages=True
bot:       view=True, send=True, manage_channels=True
```

### Admin vs User visibility
- `default_member_permissions=discord.Permissions(administrator=True)` cho: setup, settings, delete, move, blacklist, whitelist, limit, cooldown, logs, tất cả panel commands
- `default_member_permissions=discord.Permissions(manage_channels=True)` cho: close, reopen, rename, claim, unclaim, add, remove, priority, transfer, notes, pin, transcript

---

## API Routes (thêm vào `routes.py`)

```
GET    /api/tickets                  # list tất cả tickets
GET    /api/tickets/{id}             # chi tiết + notes
PUT    /api/tickets/{id}/status      # update status (close/reopen)
DELETE /api/tickets/{id}             # xóa record

GET    /api/ticket-config            # lấy config
PUT    /api/ticket-config            # update config

GET    /api/ticket-panels            # list panels
POST   /api/ticket-panels            # tạo panel
PUT    /api/ticket-panels/{id}       # sửa panel
DELETE /api/ticket-panels/{id}       # xóa panel

GET    /api/ticket-blacklist         # list blacklisted users
POST   /api/ticket-blacklist         # thêm vào blacklist
DELETE /api/ticket-blacklist/{id}    # xóa khỏi blacklist

GET    /api/ticket-stats             # tổng hợp stats
```

---

## Frontend (`src/pages/TicketManager.tsx`)

4 tabs:

1. **Tickets** — bảng danh sách, filter by status/priority, search, click để xem notes
2. **Panels** — card grid panels, nút tạo / sửa / xóa
3. **Cấu hình** — form TicketConfig (category, log channel, support roles, limit, cooldown, auto-close)
4. **Thống kê** — stat cards + simple charts (tickets by status, by priority, response time avg)

---

## Files cần tạo / sửa

| File | Action |
|---|---|
| `src/models/models.py` | Thêm 5 class mới |
| `src/bot/cogs/ticket.py` | Tạo mới (~550 dòng) |
| `src/bot/manager.py` | Add `TicketCog` + register persistent views on_ready |
| `src/api/routes.py` | Thêm ~150 dòng routes ticket |
| `src/pages/TicketManager.tsx` | Tạo mới (~400 dòng) |
| `src/App.tsx` | Thêm nav item + route |

---

## Implementation Steps

### Phase 1 — Database
1. Thêm 5 model classes vào `models.py`
2. Chạy `ALTER TABLE` migration cho Neon

### Phase 2 — Bot Cog
3. Tạo `src/bot/cogs/ticket.py`:
   - TicketConfig helper
   - `/ticket` group commands
   - `/panel` group commands  
   - `/transcript` command
   - PanelView (persistent button)
   - Background task auto-close
4. Update `manager.py`: load TicketCog, register persistent views in on_ready

### Phase 3 — Backend API
5. Thêm ticket routes vào `routes.py`

### Phase 4 — Frontend
6. Tạo `TicketManager.tsx`
7. Update `App.tsx` (nav + route)

---

## Verification
- `python -m py_compile` tất cả file Python
- `bunx --bun vite build` không có TS error
- `/ticket setup` trên Discord: tạo được channel ticket
- Panel button persistent sau bot restart
- Dashboard hiển thị danh sách tickets
