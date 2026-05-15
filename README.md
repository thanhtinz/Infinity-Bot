# 🤖 Infinity Bot

Bot Discord đa năng với dashboard quản lý trực quan, tích hợp hệ thống shop, thanh toán PayOS, ticket, kiểm duyệt, giveaway và nhiều tính năng khác.

**Tác giả:** thanhtinz — thanhtinz23072003@gmail.com  
**License:** MIT

---

## ✨ Tính năng chính

| Module | Mô tả |
|--------|-------|
| 🛒 **Shop** | Quản lý sản phẩm, gói giá, đơn hàng, thanh toán QR (PayOS) |
| 🎟️ **Ticket** | Hệ thống ticket nhiều panel, transcript, feedback |
| 🎉 **Giveaway** | Tạo giveaway, quay số, ban/unban người tham gia |
| 🛡️ **Kiểm duyệt** | Cảnh báo, kick, ban, timeout, automod, invite tracking |
| 📈 **Leveling** | Hệ thống điểm kinh nghiệm, bảng xếp hạng |
| 📌 **Sticky Message** | Tin nhắn ghim tự động |
| 🔊 **Temp Voice** | Tạo kênh voice tạm thời |
| 😀 **Emoji & Sticker** | Upload/quản lý emoji và sticker qua dashboard |
| 🎭 **Reaction Roles** | Phân quyền qua reaction, button, select menu |
| 🌟 **Starboard** | Lưu tin nhắn nổi bật |
| ⏰ **Scheduler** | Lên lịch gửi tin nhắn tự động |
| 💬 **Auto Responder** | Tự động trả lời theo từ khóa |
| 🎨 **Embeds Manager** | Tùy chỉnh toàn bộ embed bot qua dashboard |

---

## 🖥️ Yêu cầu VPS tối thiểu

| | Tối thiểu | Khuyến nghị |
|-|-----------|-------------|
| **CPU** | 1 vCore | 2 vCore |
| **RAM** | 1 GB | 2 GB |
| **Disk** | 5 GB | 10 GB |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| **Python** | 3.12+ | 3.12+ |
| **Node / Bun** | Bun 1.0+ | Bun 1.1+ |

---

## 🚀 Hướng dẫn deploy

Xem chi tiết trong **[DEPLOY.md](DEPLOY.md)**

---

## 📁 Cấu trúc project

```
infinity-bot/
├── app.py                  # Entry point ASGI
├── routes.py               # FastAPI app factory + static serve
├── start_vps.sh            # Script chạy trên VPS
├── src/
│   ├── api/
│   │   ├── auth.py         # OAuth Discord
│   │   └── routes/         # Tất cả API endpoints
│   ├── bot/
│   │   ├── cogs/           # Các module tính năng bot
│   │   ├── embed_utils.py  # Hệ thống embed tùy chỉnh
│   │   └── manager.py      # Quản lý vòng đời bot
│   ├── database/
│   │   └── config.py       # Kết nối PostgreSQL
│   ├── models/
│   │   └── models.py       # SQLAlchemy ORM models
│   └── schemas/
│       └── schemas.py      # Pydantic schemas
├── src/pages/              # React pages (dashboard)
├── src/components/         # React components
├── pyproject.toml          # Python dependencies
└── package.json            # Node dependencies
```
