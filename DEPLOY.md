# 🚀 Hướng dẫn Deploy Infinity Bot lên VPS

> Dành cho người mới — từng bước rõ ràng từ VPS trắng đến bot chạy ổn định.

---

## Mục lục

1. [Chuẩn bị trước khi bắt đầu](#1-chuẩn-bị-trước-khi-bắt-đầu)
2. [Cài môi trường VPS](#2-cài-môi-trường-vps)
3. [Clone project](#3-clone-project)
4. [Cấu hình biến môi trường](#4-cấu-hình-biến-môi-trường)
5. [Chạy thử lần đầu](#5-chạy-thử-lần-đầu)
6. [Cấu hình Admin trên Dashboard](#6-cấu-hình-admin-trên-dashboard)
7. [Chạy nền bằng systemd (khuyến nghị)](#7-chạy-nền-bằng-systemd-khuyến-nghị)
8. [Cấu hình Nginx + HTTPS (tùy chọn)](#8-cấu-hình-nginx--https-tùy-chọn)
9. [Cập nhật bot](#9-cập-nhật-bot)
10. [Xử lý lỗi thường gặp](#10-xử-lý-lỗi-thường-gặp)

---

## 1. Chuẩn bị trước khi bắt đầu

Bạn cần có sẵn:

### Discord Application
1. Vào [Discord Developer Portal](https://discord.com/developers/applications)
2. Nhấn **New Application** → đặt tên → vào tab **Bot**
3. Bật **Privileged Gateway Intents** (tất cả 3 cái: Presence, Server Members, Message Content)
4. Copy **Bot Token** — lưu lại
5. Vào **OAuth2** → copy **Client ID** và **Client Secret** — lưu lại
6. Thêm Redirect URI: `http://IP_VPS:8000/api/auth/callback` (hoặc domain nếu có)

### PostgreSQL (Neon - miễn phí)
1. Đăng ký tại [neon.tech](https://neon.tech)
2. Tạo project mới → copy **Connection String** dạng:
   ```
   postgresql://user:password@host/dbname?sslmode=require
   ```

### PayOS (nếu dùng tính năng shop)
1. Đăng ký tại [payos.vn](https://payos.vn)
2. Lấy **Client ID**, **API Key**, **Checksum Key**

---

## 2. Cài môi trường VPS

SSH vào VPS của bạn:

```bash
ssh root@IP_VPS
```

### Cài Python 3.12

```bash
apt update && apt upgrade -y
apt install -y software-properties-common
add-apt-repository ppa:deadsnakes/ppa -y
apt update
apt install -y python3.12 python3.12-venv python3.12-dev build-essential
```

### Cài uv (quản lý Python deps)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc   # hoặc logout rồi login lại
uv --version       # kiểm tra: uv 0.x.x
```

### Cài Bun (runtime Node.js nhanh)

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version      # kiểm tra: 1.x.x
```

### Cài Git

```bash
apt install -y git
```

---

## 3. Clone project

```bash
cd /opt
git clone https://github.com/thanhtinz/Infinity-Bot.git infinity-bot
cd infinity-bot
```

---

## 4. Cấu hình biến môi trường

Tạo file `.env`:

```bash
nano .env
```

Dán nội dung sau và điền thông tin của bạn:

```env
# ─── Database (Neon PostgreSQL) ───────────────────────────
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# ─── Discord OAuth (để đăng nhập Dashboard) ──────────────
DISCORD_CLIENT_ID=123456789012345678
DISCORD_CLIENT_SECRET=abc123xyz...
# URL dashboard (VD: http://123.456.789.0:8000 hoặc https://bot.example.com)
PUBLIC_APP_URL=http://IP_VPS:8000

# ─── JWT Secret (tự tạo, ít nhất 32 ký tự ngẫu nhiên) ───
JWT_SECRET=thay_bang_chuoi_ngau_nhien_dai_it_nhat_32_ky_tu

# ─── Discord Bot Token ────────────────────────────────────
DISCORD_BOT_TOKEN=Bot_Token_cua_ban

# ─── Server port ─────────────────────────────────────────
PORT=8000
```

> ⚠️ **Không bao giờ commit file `.env` lên GitHub!** File này đã có trong `.gitignore`.

### Tạo JWT Secret ngẫu nhiên

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Copy output đó dán vào `JWT_SECRET=...`

---

## 5. Chạy thử lần đầu

```bash
chmod +x start_vps.sh
./start_vps.sh
```

Script sẽ tự động:
- Cài Python dependencies (`uv sync`)
- Cài Node dependencies (`bun install`)
- Build React frontend (`bun run build`)
- Khởi động FastAPI server tại `http://0.0.0.0:8000`

Mở trình duyệt vào `http://IP_VPS:8000` — nếu thấy màn hình login Discord là thành công.

Nhấn `Ctrl+C` để dừng, rồi chuyển sang bước 6.

---

## 6. Cấu hình Admin trên Dashboard

Sau khi đăng nhập dashboard lần đầu:

### 6.1 Thiết lập Bot

Vào **Cài đặt** (Settings) → **Cấu hình Bot**:

| Trường | Giá trị |
|--------|---------|
| Bot Token | Token từ Discord Developer Portal |
| Server ID | ID server Discord của bạn (bật Developer Mode → chuột phải server → Copy ID) |
| Admin User ID | Discord ID của bạn (chuột phải avatar → Copy ID) |

Nhấn **Lưu** → **Khởi động Bot**.

### 6.2 Mời Bot vào Server

Vào [Discord Developer Portal](https://discord.com/developers/applications) → OAuth2 → URL Generator:
- Scopes: `bot`, `applications.commands`
- Permissions: `Administrator` (hoặc chọn từng quyền cần thiết)

Copy URL → mở trình duyệt → mời bot vào server.

### 6.3 Cấu hình PayOS (nếu dùng shop)

Vào **Cài đặt** → **PayOS**:
- Client ID, API Key, Checksum Key từ payos.vn
- Webhook URL: `http://IP_VPS:8000/api/payos/webhook`
  (Dán URL này vào phần Webhook trên dashboard PayOS)

### 6.4 Cấu hình OAuth Dashboard

Vào [Discord Developer Portal](https://discord.com/developers/applications) → OAuth2 → Redirects:
- Thêm: `http://IP_VPS:8000/api/auth/callback`

---

## 7. Chạy nền bằng systemd (khuyến nghị)

Để bot tự chạy khi VPS khởi động và tự restart khi crash:

### Tạo file service

```bash
nano /etc/systemd/system/infinity-bot.service
```

Dán nội dung:

```ini
[Unit]
Description=Infinity Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/infinity-bot
EnvironmentFile=/opt/infinity-bot/.env
ExecStartPre=/bin/bash -c 'source /root/.bashrc; /root/.local/bin/uv sync --frozen --compile-bytecode'
ExecStartPre=/bin/bash -c 'source /root/.bashrc; /root/.bun/bin/bun install --frozen-lockfile'
ExecStartPre=/bin/bash -c 'source /root/.bashrc; /root/.bun/bin/bun run build'
ExecStart=/bin/bash -c 'source /root/.bashrc; /root/.local/bin/uv run uvicorn app:asgi --host 0.0.0.0 --port ${PORT:-8000}'
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### Kích hoạt service

```bash
systemctl daemon-reload
systemctl enable infinity-bot
systemctl start infinity-bot
```

### Kiểm tra trạng thái

```bash
systemctl status infinity-bot

# Xem log real-time
journalctl -u infinity-bot -f
```

### Lệnh quản lý thường dùng

```bash
systemctl start infinity-bot    # Khởi động
systemctl stop infinity-bot     # Dừng
systemctl restart infinity-bot  # Khởi động lại
systemctl status infinity-bot   # Xem trạng thái
journalctl -u infinity-bot -n 100   # Xem 100 dòng log gần nhất
```

---

## 8. Cấu hình Nginx + HTTPS (tùy chọn)

Nếu bạn có domain, cấu hình Nginx để dùng HTTPS:

### Cài Nginx và Certbot

```bash
apt install -y nginx certbot python3-certbot-nginx
```

### Cấu hình Nginx

```bash
nano /etc/nginx/sites-available/infinity-bot
```

```nginx
server {
    listen 80;
    server_name bot.example.com;  # Thay bằng domain của bạn

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 20M;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/infinity-bot /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### Cấp SSL miễn phí

```bash
certbot --nginx -d bot.example.com
```

Sau đó cập nhật `.env`:
```env
PUBLIC_APP_URL=https://bot.example.com
```

Và cập nhật Redirect URI trên Discord Developer Portal → `https://bot.example.com/api/auth/callback`

---

## 9. Cập nhật bot

Khi có phiên bản mới:

```bash
cd /opt/infinity-bot
git pull origin master
systemctl restart infinity-bot
```

> Script tự động cài deps mới và rebuild frontend khi restart.

---

## 10. Xử lý lỗi thường gặp

### ❌ `ModuleNotFoundError`
```bash
cd /opt/infinity-bot
uv sync --frozen
```

### ❌ Bot không online sau khi lưu token
- Kiểm tra token đúng chưa (không có khoảng trắng thừa)
- Kiểm tra đã bật đủ Intents trong Discord Developer Portal chưa
- Xem log: `journalctl -u infinity-bot -n 50`

### ❌ Không đăng nhập được Dashboard
- Kiểm tra `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` đúng chưa
- Kiểm tra Redirect URI trên Discord Developer Portal khớp với `PUBLIC_APP_URL`
- Đảm bảo port 8000 mở trên firewall VPS:
  ```bash
  ufw allow 8000
  ```

### ❌ PayOS webhook không nhận được
- Đảm bảo URL webhook đúng: `http://IP:PORT/api/payos/webhook`
- VPS phải có IP public (không dùng localhost)
- Kiểm tra firewall không chặn port

### ❌ Lỗi database
- Kiểm tra `DATABASE_URL` đúng định dạng chưa
- Neon free tier có thể tạm dừng sau vài ngày không dùng — vào neon.tech để wake up

### 📋 Xem log chi tiết
```bash
journalctl -u infinity-bot --since "1 hour ago"
```

---

## 📞 Hỗ trợ

- **Email:** thanhtinz23072003@gmail.com
- **GitHub Issues:** https://github.com/thanhtinz/Infinity-Bot/issues

---

*Tài liệu này được viết cho Ubuntu 22.04/24.04 LTS. Các distro khác có thể khác lệnh cài đặt.*
