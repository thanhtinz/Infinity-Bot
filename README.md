# 🤖 Infinity Bot

Bot Discord đa năng với dashboard quản lý trực quan — hệ thống shop, thanh toán (PayOS/PayPal/Crypto), kiểm duyệt, giveaway, AI chat, và 29 module tính năng.

**Tác giả:** thanhtinz — thanhtinz23072003@gmail.com  
**License:** MIT

---

## ✨ Tính năng chính

| Module | Mô tả |
|--------|-------|
| 🛒 **Shop** | Sản phẩm, danh mục, đơn hàng, thanh toán QR (PayOS), PayPal, Crypto, coupon, flash sale |
| 🎉 **Giveaway** | Tạo giveaway, quay số tự động, ban/unban người tham gia |
| 🛡️ **Moderation** | Warn, kick, ban, timeout, softban, lockdown, role persist, temp role |
| 🤖 **Moderation Ext** | Bulk delete, slowmode, channel lock nâng cao |
| 🔍 **AutoMod** | Tự động xóa/kick/mute/warn khi vi phạm |
| 📊 **Invite Tracking** | Theo dõi invite, leaderboard mời |
| 📋 **Logging** | Log message, voice, member, role, channel events |
| 📌 **Sticky Message** | Tin nhắn ghim tự động |
| 💤 **AFK** | Đặt trạng thái AFK, thông báo khi mention |
| 🎭 **Reaction Roles** | Phân role qua reaction, button, select menu |
| 🔄 **Auto Role** | Tự động gán role khi member join |
| ⏰ **Scheduler** | Lên lịch gửi tin nhắn tự động |
| 💬 **Auto Responder** | Tự động trả lời theo từ khóa/regex |
| 🧩 **Custom Commands** | Tạo lệnh tùy chỉnh qua dashboard |
| 📝 **Forms** | Tạo form đăng ký, duyệt/từ chối submissions |
| 🗳️ **Polls** | Tạo bình chọn với nhiều tùy chọn |
| ⏲️ **Reminders** | Đặt nhắc nhở cá nhân |
| 📡 **Social Feeds** | Theo dõi và đăng feed từ mạng xã hội |
| 📊 **Stats Channels** | Kênh hiển thị thống kê server tự động |
| 🤗 **Interactions** | Hug, pat, kiss, slap... 70+ tương tác |
| 🎮 **Fun** | Mini games, random commands |
| 🛠️ **Utility** | Info, avatar, server info, /report |
| 📢 **Channel Admin** | Quản lý kênh nâng cao |
| 👋 **Onboarding** | Welcome embed, /language command |
| 🤖 **AI Chat** | Chat AI (Gemini), tạo ảnh, training docs |
| 💎 **Premium** | Gói subscription, coupon, payment tracking |
| 🎨 **Embeds Manager** | Tùy chỉnh 151 embed events qua dashboard |
| ❓ **Help** | Help menu, category, command details |
| ⚡ **Prefix Commands** | Hỗ trợ prefix commands |

---

## 🏗️ Kiến trúc

```
┌──────────────────────────────────────────────────┐
│                   Dashboard                       │
│         React 19 + TypeScript + shadcn/ui         │
│              112 pages · Tailwind CSS             │
├──────────────────────────────────────────────────┤
│                   Backend API                     │
│           FastAPI + SQLAlchemy ORM                │
│          30 route modules · JWT Auth              │
├──────────────────────────────────────────────────┤
│                   Discord Bot                     │
│           py-cord · 29 cogs loaded                │
│       151 customizable embed events               │
├──────────────────────────────────────────────────┤
│                   Database                        │
│              Neon PostgreSQL                      │
│              63 models                            │
└──────────────────────────────────────────────────┘
```

---

## 🖥️ Yêu cầu

| | Tối thiểu | Khuyến nghị |
|-|-----------|-------------|
| **CPU** | 1 vCore | 2 vCore |
| **RAM** | 1 GB | 2 GB |
| **Disk** | 5 GB | 10 GB |
| **Python** | 3.12+ | 3.12+ |
| **Node** | 22+ (build only) | 22+ |
| **Bun** | 1.0+ (build only) | 1.1+ |

---

## 🚀 Deploy

### Railway / Cloud

1. Push code lên GitHub
2. Kết nối Railway / Render với repo
3. Set environment variables:
   - `DATABASE_URL` — PostgreSQL connection string
   - `DISCORD_TOKEN` — Bot token (hoặc config qua dashboard)
   - `JWT_SECRET_KEY` — (optional, tự generate từ DATABASE_URL nếu không set)
   - `PUBLIC_APP_URL` — URL public của dashboard (cho payment links)
4. Deploy tự động qua Dockerfile

### VPS

```bash
chmod +x start_vps.sh
./start_vps.sh
```

Chi tiết trong **[DEPLOY.md](DEPLOY.md)**

---

## 📁 Cấu trúc project

```
infinity-bot/
├── app.py                  # Entry point ASGI
├── routes.py               # FastAPI app factory + static serve
├── Dockerfile              # Multi-stage build (Node → Python)
├── start_vps.sh            # Script chạy trên VPS
├── src/
│   ├── api/
│   │   ├── auth.py         # OAuth Discord + JWT
│   │   ├── deps.py         # Dependencies (auth, guild, permissions)
│   │   └── routes/         # 30 API route modules
│   ├── bot/
│   │   ├── cogs/           # 29 bot modules
│   │   ├── embed_utils.py  # Embed system (151 events + DB override)
│   │   ├── i18n.py         # Đa ngôn ngữ (EN/VI)
│   │   └── manager.py      # Bot lifecycle management
│   ├── database/
│   │   └── config.py       # PostgreSQL connection
│   ├── models/
│   │   └── models.py       # 63 SQLAlchemy models
│   └── schemas/
│       └── schemas.py      # Pydantic schemas
├── src/pages/              # 112 React dashboard pages
├── src/components/         # Shared React components
├── pyproject.toml          # Python dependencies
└── package.json            # Frontend dependencies
```

---

## 🎨 Hệ thống Embed

Bot sử dụng hệ thống embed tùy chỉnh hoàn toàn:

- **151 embed events** — đơn hàng, kiểm duyệt, logging, giveaway, AI, alerts...
- **Dashboard editor** — preview Discord embed real-time, kéo thả fields
- **Variables** — `{user.mention}`, `{order.id}`, `{product.name}`...
- **DB override** — user customize qua dashboard → lưu DB, fallback về defaults
- **Đa ngôn ngữ** — mỗi event có template VI/EN

---

## 🌐 Ngôn ngữ

- **Dashboard**: Tiếng Việt
- **Bot**: Cấu hình per-guild (EN/VI) qua `/language` command hoặc dashboard Bot Settings

---

## ⚙️ Tech Stack

**Frontend:** React 19 · TypeScript · Tailwind CSS · shadcn/ui · TanStack Query · React Router 7 · Recharts · Zod 4

**Backend:** FastAPI · SQLAlchemy · py-cord · asyncpg · PyJWT · Pillow

**Database:** Neon PostgreSQL

**Build:** Bun (frontend) · uv (Python) · Docker multi-stage

**Deploy:** Railway / Render / VPS
