# Discord Bot Builder — Full Feature Plan

## Context
Bot thương mại Discord tích hợp dashboard quản lý (React + FastAPI). Nền tảng hiện tại đã có:
- Shop bot: `/status`, `/account`, `/san_pham`, `/tao_don` (PayOS QR)
- Dashboard: Sản phẩm (gói giá, ảnh), Đơn hàng, Coupon, Stats
- DB: `system_config`, `users`, `products`, `orders`, `coupons`
- Auth: Discord OAuth2, JWT cookie

Yêu cầu mở rộng toàn diện thành bot đa chức năng + admin panel đầy đủ.

---

## Scope & Non-Goals

### Trong scope (4 phase)
- Phase 1: Shop bot hoàn chỉnh
- Phase 2: Giveaway + Moderation
- Phase 3: Temp Voice
- Phase 4: Dashboard nâng cao + Invite Tracking

### Ngoài scope (cần VPS riêng)
- **Music Bot + Lavalink** — Lavalink là Java server độc lập, không thể chạy trong sandbox Workshop. Sẽ hướng dẫn cách kết nối sau khi user tự host Lavalink.

---

## Phase 1 — Shop Bot Hoàn Chỉnh

### 1.1 DB Schema thêm mới
```sql
-- Feedback
CREATE TABLE feedback (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  product_id INT REFERENCES products(id),
  stars INT CHECK (stars BETWEEN 1 AND 5),
  content TEXT,
  discord_message_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Warnings
CREATE TABLE warnings (
  id SERIAL PRIMARY KEY,
  discord_id VARCHAR NOT NULL,
  guild_id VARCHAR NOT NULL,
  reason TEXT,
  moderator_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 1.2 Bot Slash Commands

| Lệnh | Mô tả |
|------|-------|
| `/help` | Embed danh sách lệnh chia nhóm |
| `/status` | Trạng thái bot (đã có, cải tiến) |
| `/account` | Tổng chi tiêu + 5 đơn gần nhất (đã có, cải tiến) |
| `/orders` | 5 đơn hàng gần nhất của user |
| `/orders [id]` | Chi tiết 1 đơn cụ thể |
| `/support` | Embed hướng dẫn liên hệ (lấy từ config) |
| `/feedback` | Modal: chọn sản phẩm → chọn sao → nhập nội dung → gửi embed đến feedback channel |
| `/bxh [type] [time]` | Bảng xếp hạng: `chi_tieu`/`don_hang`, `daily`/`7days`/`30days` |

**`/tao_don` nâng cấp (Admin):**
- Option: `user` (Member), `product_id` (int), `package_name` (str), `quantity` (int, default=1)
- Sau tạo đơn → gửi embed đến `don_hang_channel` với:
  - QR PayOS + nút **Nhập Coupon** (Button → Modal nhập code → verify → update embed với giá mới + QR mới)
  - Nút **Hủy đơn** (Admin only)
- Background task: sau 15 phút nếu vẫn PENDING → xóa embed, gửi embed lỗi "Hết hạn thanh toán"
- Khi PAID (webhook) → update embed màu xanh "✅ Đã thanh toán"

### 1.3 Order Status Flow (Dashboard)
Thêm trạng thái: `CREATED → PAID → DELIVERING → DELIVERED → CANCELLED → ERROR`

- `DELIVERING`: Admin bấm "Giao hàng" → form nhập nội dung DM → bot gửi DM cho user + update embed
- `CANCELLED`/`ERROR`: tự động thêm tag "(Hoàn tiền)" vào embed

### 1.4 Dashboard — Order Management nâng cấp
Trang Orders: thêm nút "Giao hàng" mở Dialog nhập nội dung DM, confirm → gọi `PUT /api/orders/{id}/deliver`

### 1.5 Files thay đổi
- `src/models/models.py` — thêm `Feedback`, `Warning`, cột `status` thêm values mới cho `Order`
- `src/bot/manager.py` — thêm 7 slash commands, cải tiến `/tao_don` với View/Button/Modal
- `src/api/routes.py` — `/orders/deliver`, `/feedback`, `/bxh`
- `src/pages/OrdersManager.tsx` — thêm nút Giao hàng + Dialog DM

---

## Phase 2 — Giveaway + Moderation

### 2.1 DB Schema
```sql
CREATE TABLE giveaways (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR NOT NULL,
  channel_id VARCHAR NOT NULL,
  message_id VARCHAR,
  title VARCHAR NOT NULL,
  description TEXT,
  prize VARCHAR NOT NULL,
  winners_count INT DEFAULT 1,
  ends_at TIMESTAMP NOT NULL,
  ended BOOLEAN DEFAULT FALSE,
  banned_users TEXT[] DEFAULT '{}',  -- discord IDs
  host_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE giveaway_entries (
  id SERIAL PRIMARY KEY,
  giveaway_id INT REFERENCES giveaways(id) ON DELETE CASCADE,
  discord_id VARCHAR NOT NULL,
  UNIQUE(giveaway_id, discord_id)
);
```

### 2.2 Bot Slash Commands

**Giveaway:**
| Lệnh | Mô tả |
|------|-------|
| `/giveaway [title] [prize] [winners] [duration] [description]` | Tạo giveaway, bot gửi embed + nút 🎉 Tham gia |
| `/giveaway reroll [id]` | Chọn lại người thắng |
| `/giveaway list` | Danh sách giveaway đang chạy |
| `/giveaway end [id]` | Kết thúc sớm |
| `/giveaway ban [id] @user` | Ban user khỏi giveaway |
| `/giveaway unban [id] @user` | Unban |

**Moderation:**
| Lệnh | Mô tả |
|------|-------|
| `/ban @user [reason]` | Ban user |
| `/unban [user_id] [reason]` | Unban |
| `/kick @user [reason]` | Kick user |
| `/warn @user [reason]` | Cảnh cáo (lưu DB, gửi DM) |
| `/unwarn @user [id]` | Xóa cảnh cáo |
| `/warnings @user` | Xem lịch sử cảnh cáo |

### 2.3 Giveaway Logic
- Khi `/giveaway` → tạo embed + Button "🎉 Tham gia (0)"
- Click button → thêm vào `giveaway_entries`, update count trên button
- Background task (`asyncio`) kiểm tra `ends_at` mỗi 30s → khi hết giờ: random pick winners → edit embed → mention winners
- `/giveaway reroll` → pick lại từ entries, exclude người đã thắng

### 2.4 Files thay đổi
- `src/models/models.py` — thêm `Giveaway`, `GiveawayEntry`, `Warning`
- `src/bot/manager.py` — thêm GiveawayView (persistent), background task, moderation commands
- `src/api/routes.py` — `/giveaways` CRUD, `/warnings`
- Dashboard: trang Giveaway (xem list, kết thúc sớm), trang Moderation (warnings list)

---

## Phase 3 — Temp Voice

### 3.1 DB Schema
```sql
CREATE TABLE temp_voice_config (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR UNIQUE,
  join_channel_id VARCHAR,   -- "Join to Create" channel ID
  category_id VARCHAR,       -- category để tạo room mới
  enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE temp_voice_rooms (
  id SERIAL PRIMARY KEY,
  channel_id VARCHAR UNIQUE,
  owner_id VARCHAR,
  guild_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3.2 Logic
- Dashboard setup: chọn guild → chọn category → bot tạo "Join to Create" channel
- `on_voice_state_update`: user join "Join to Create" → bot tạo channel mới trong cùng category → move user vào
- Khi channel rỗng → bot xóa channel + xóa record DB
- Owner có thể dùng slash commands để quản lý room của mình

### 3.3 Bot Slash Commands (25 lệnh)
Nhóm `/room`: `lock`, `unlock`, `hide`, `unhide`, `rename`, `limit`, `bitrate`, `region`, `private`, `public`, `nsfw`, `slowmode`, `claim`, `transfer`, `owner`, `permit`, `reject`, `kick`, `mute`, `unmute`, `deafen`, `undeafen`

### 3.4 Files thay đổi
- `src/models/models.py` — `TempVoiceConfig`, `TempVoiceRoom`
- `src/bot/manager.py` — `on_voice_state_update`, 22 slash commands
- `src/api/routes.py` — `/tempvoice/setup`, `/tempvoice/config`
- Dashboard: tab "Temp Voice" trong BotConfig — chọn category, xem rooms đang có

---

## Phase 4 — Dashboard Nâng Cao + Invite Tracking

### 4.1 Embed Customizer (Dashboard)
- Trang `/embeds` trong dashboard
- UI tương tự Discohook: nhập Title, Description, Color, Author, Footer, Fields, Thumbnail, Image
- Hỗ trợ biến: `{user}`, `{user.id}`, `{user.mention}`, `{order.id}`, `{order.total}`, `{product.name}`, `{package}`, `{date}`, `{server}`
- Lưu template vào DB (`embed_templates` table)
- Các embed có thể gán vào: đơn hàng mới, thanh toán thành công, giao hàng, feedback, giveaway

### 4.2 Dashboard — Quản lý Users
- Trang `/users`: danh sách user đã dùng bot
- Xem lịch sử đơn hàng từng user
- Xem tổng chi tiêu, số đơn
- Ban/unban user khỏi shop

### 4.3 Invite Tracking
```sql
CREATE TABLE invite_tracking (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR,
  inviter_id VARCHAR,
  invitee_id VARCHAR,
  invite_code VARCHAR,
  joined_at TIMESTAMP DEFAULT NOW(),
  is_fake BOOLEAN DEFAULT FALSE
);
```
- `on_member_join`: check invite dùng so sánh before/after snapshot
- `on_member_remove`: đánh dấu invite là "left"
- Lệnh: `/invites`, `/inviteinfo`, `/leaderboard invites`, `/bonus add/remove`
- Dashboard: bảng thống kê invites

### 4.4 Files thay đổi
- `src/models/models.py` — `EmbedTemplate`, `InviteTracking`, `BannedShopUser`
- `src/bot/manager.py` — `on_member_join/remove`, invite commands
- `src/api/routes.py` — `/embeds` CRUD, `/users` management, `/invites`
- Dashboard: trang `/embeds`, `/users`, cập nhật BotConfig với Temp Voice setup

---

## Thứ tự triển khai

```
Phase 1 (ưu tiên cao):
  [1-A] DB migration: feedback, warnings, order status mở rộng
  [1-B] Bot: /help, /orders, /support, /feedback, /bxh
  [1-C] Bot: /tao_don nâng cấp (coupon button, timeout task, update embed)
  [1-D] Dashboard: Orders — delivery flow, DM form

Phase 2:
  [2-A] DB: giveaways, giveaway_entries
  [2-B] Bot: Giveaway system (create, join button, auto-end task, reroll)
  [2-C] Bot: Moderation commands
  [2-D] Dashboard: Giveaway list, warnings

Phase 3:
  [3-A] DB: temp_voice tables
  [3-B] Bot: on_voice_state_update + room creation/deletion
  [3-C] Bot: /room commands (22 lệnh)
  [3-D] Dashboard: Temp Voice setup tab

Phase 4:
  [4-A] DB: embed_templates, invite_tracking
  [4-B] Dashboard: Embed Customizer UI
  [4-C] Dashboard: Users Manager
  [4-D] Bot: Invite tracking (on_member_join/remove, commands)
```

---

## Verification mỗi phase
- Python syntax: `uv run python -c "import app; print('OK')"`
- Bot commands: test từng lệnh trên Discord server thật
- API: curl test với auth token
- Frontend: Vite HMR không có lỗi đỏ
