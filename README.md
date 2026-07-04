# Main

Bot Discord đa năng kèm web dashboard chuyên nghiệp, quản lý riêng cho từng server. Gộp và viết lại từ hai dự án mã nguồn mở [Pogy-Bot](https://github.com/devrock07/Pogy-Bot) và [astryx](https://github.com/devrock07/astryx), **không bao gồm tính năng nghe nhạc**.

---

## ✨ Tính năng

| Nhóm | Mô tả |
|------|-------|
| 🛡️ **Moderation** | Ban, kick, mute, timeout, softban, tempban, temprole, lock/unlock kênh, slowmode |
| ⚠️ **Warn/Case** | `/warn`, `/case` (xem/sửa/xoá/gỡ án), `/warnpunish` — tự động mute/kick/ban khi đạt ngưỡng cảnh cáo |
| ⚔️ **Anti-Nuke** | Chống raid, phát hiện hành vi phá hoại, whitelist, tự động phản ứng |
| 🚔 **AutoMod** | Chống spam, invite link, scam, từ cấm, whitelist |
| 🎫 **Tickets** | Hệ thống hỗ trợ qua ticket, nhiều category, panel tuỳ chỉnh |
| 🎁 **Giveaways** | Tạo, kết thúc, reroll giveaway |
| 🎭 **Reaction Roles** | Gán role qua reaction |
| 👋 **Welcome/Farewell** | Tin nhắn chào mừng/tạm biệt tuỳ chỉnh |
| 📋 **Logging** | Log hoạt động server (message, member, role, channel...) |
| 🤖 **AI Chat** | Trò chuyện AI, phân tích ảnh |
| 😄 **Fun & Roleplay** | Meme, minigame, tương tác (hug/pat/slap...), Truth or Dare |
| 🔍 **Utility** | Avatar, banner, thông tin user/server, đổi đơn vị, mã hoá/giải mã |
| 📁 **Export** | Xuất dữ liệu kênh, thành viên, role |
| 🐾 **Animals · 💰 Crypto · 📚 Wikipedia · 📰 News** | Tiện ích tra cứu nhanh |
| 🔊 **Voice & Join-to-Create** | Quản lý kênh thoại, tự tạo kênh riêng |
| ⏰ **AFK · Auto-react · Auto-bump · Reminders · Todo** | Tiện ích cá nhân/server |
| 📊 **Stats Channels** | Kênh voice tự động hiển thị số thành viên/bot/boost/role |
| 🎂 **Birthday** | Lưu ngày sinh, tự động thông báo + gán role sinh nhật |
| ⭐ **Starboard** | Ghim tin nhắn nổi bật lên kênh riêng khi đủ số reaction |
| 🚪 **Verification Gate** | Cổng xác minh thành viên mới bằng nút bấm trước khi vào server |
| 🖼️ **Profile Card** | Ảnh profile tuỳ chỉnh (bio, background, social) bằng canvas |
| 🏷️ **Sticky Nickname** | Ép nickname cố định, tự khôi phục nếu bị đổi |

Toàn bộ tính năng trên **có thể cấu hình qua web dashboard**, riêng cho từng server bot tham gia.

## 🏗️ Kiến trúc

```
┌──────────────────────────────────────────────┐
│              Dashboard (React + Vite)         │
│      Đăng nhập Discord OAuth2 · 10 trang      │
│         cấu hình riêng cho từng server        │
├──────────────────────────────────────────────┤
│         Dashboard Backend (Express)           │
│   dashboard/server — API + phiên đăng nhập    │
├──────────────────────────────────────────────┤
│              Discord Bot (discord.js v14)     │
│   src/bot — lệnh slash/prefix/hybrid, events  │
│   + Bot Status API nội bộ (src/bot/dashboardApi.js) │
├──────────────────────────────────────────────┤
│              PostgreSQL (Sequelize)           │
│           src/database/models — 25+ models    │
└──────────────────────────────────────────────┘
```

Dashboard và Bot là hai tiến trình riêng biệt, giao tiếp qua:
- **Postgres dùng chung** cho dữ liệu cấu hình (đọc/ghi trực tiếp qua Sequelize).
- **Bot Status API** (bảo vệ bằng secret key) cho dữ liệu Discord "sống" (danh sách server, kênh, role, quyền thành viên) mà dashboard không thể tự lấy nếu bot không online.

## 📁 Cấu trúc project

```
Main/
├── src/
│   ├── bot/                  # Discord bot (discord.js v14)
│   │   ├── commands/         # Slash commands (moderation, warn/case, warnpunish, ...)
│   │   ├── hybrid/           # Lệnh hybrid slash+prefix (ticket, giveaway, automod, antinuke, ...)
│   │   ├── pCommands/        # Lệnh prefix
│   │   ├── events/           # Event listeners
│   │   ├── utils/, helpers/  # Tiện ích dùng chung
│   │   ├── dashboardApi.js   # Bot Status API cho dashboard
│   │   ├── config.js         # Đọc biến môi trường
│   │   └── index.js          # Entry point của bot
│   └── database/
│       ├── models/           # Sequelize models (Postgres)
│       └── sequelize.js      # Kết nối DB
├── dashboard/
│   ├── server/                # Express backend (OAuth2, API cấu hình)
│   └── src/                   # React (Vite) frontend
├── scripts/
│   ├── run-services.js        # Chạy bot + dashboard cùng lúc
│   ├── check-syntax.js        # Kiểm tra cú pháp toàn bộ source
│   └── upload-application-emojis.js
├── .env.example
└── package.json
```

## ⚙️ Tech Stack

**Bot:** Node.js · discord.js v14 · Sequelize · PostgreSQL

**Dashboard:** React 18 + Vite (frontend) · Express + Passport (Discord OAuth2) + connect-session-sequelize (backend)

**AI:** Groq / Gemini-compatible chat completions

## 🚀 Cài đặt

### 1. Cài dependencies

```bash
npm install
npm run dashboard:install
```

### 2. Tạo file môi trường

```bash
cp .env.example .env
```

Điền các giá trị bắt buộc:

| Biến | Mô tả |
|------|-------|
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL |
| `BOT_TOKEN` | Token bot Discord |
| `CLIENT_ID` | Application ID |
| `OWNER_ID` | Discord user ID của chủ bot |
| `DISCORD_CLIENT_SECRET` | Client secret (Discord Developer Portal) — cần cho dashboard đăng nhập |
| `DASHBOARD_SESSION_SECRET` | Chuỗi ngẫu nhiên ký session — tạo bằng `openssl rand -hex 32` |
| `BOT_API_SECRET` | Chuỗi ngẫu nhiên dùng chung giữa bot và dashboard — tạo bằng `openssl rand -hex 32` |

Xem đầy đủ trong [`.env.example`](.env.example) — mỗi biến đều có ghi chú giải thích.

Trong Discord Developer Portal, thêm redirect URL OAuth2:
```
http://localhost:3000/api/auth/discord/callback
```
(đổi domain khi deploy production, khớp với `DASHBOARD_CALLBACK_URL`).

### 3. Chạy

```bash
# Build dashboard trước (production)
npm run dashboard:build

# Chạy bot + dashboard cùng lúc
npm start

# Hoặc chế độ dev (bot + dashboard backend + Vite HMR)
npm run dev
```

## 📜 Scripts

| Lệnh | Mô tả |
|------|-------|
| `npm start` | Chạy bot + dashboard backend (production, cần build dashboard trước) |
| `npm run dev` | Chạy bot + dashboard backend + Vite dev server (hot reload) |
| `npm run dev:bot` | Chỉ chạy bot |
| `npm run dashboard:server` | Chỉ chạy dashboard backend |
| `npm run dashboard:dev` | Chỉ chạy Vite dev server cho frontend |
| `npm run dashboard:build` | Build frontend dashboard ra `dashboard/dist` |
| `npm run check` | Kiểm tra cú pháp toàn bộ `src/bot`, `src/database`, `dashboard/server` |
| `npm run emojis:upload` | Đồng bộ application emoji lên Discord |

## 🗺️ Roadmap (chưa triển khai ở bản này)

- Kho lệnh fun/tương tác mở rộng kiểu Pogy-Bot (~300 lệnh rate/flavor-text như `/trollrate`, `/geniusrate`...) — phần lớn tương tác phổ biến (hug/pat/kiss/slap...) đã có sẵn qua `/roleplay`, phần còn lại là các lệnh "rate" ngẫu nhiên trùng lặp, giá trị thấp nên chưa ưu tiên

## 📄 License

MIT — xem [LICENSE](LICENSE). Dự án kế thừa code từ Pogy-Bot (dùng theo sự cho phép của chủ sở hữu) và astryx (MELON Open Source License — xem ghi công bên dưới).

**Ghi công:** một phần kiến trúc bot dựa trên [astryx](https://github.com/devrock07/astryx) của itsfizys (Aegis); kiến trúc dashboard dựa trên "Zenith" của [Pogy-Bot](https://github.com/devrock07/Pogy-Bot) (devrock07).
