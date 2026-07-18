# Infinity Bot — AI Assistant

Bot Discord trợ lý AI cá nhân. Mỗi người dùng tự cấu hình API key AI của riêng mình (Gemini, OpenAI, Claude) — bot không dùng chung một key trả phí cho tất cả mọi người.

## Đã có (nền tảng)

- Kết nối PostgreSQL (Sequelize), command loader tự động
- Lớp trừu tượng AI provider (`src/bot/utils/ai`) hỗ trợ Gemini / OpenAI / Claude, dễ thêm provider mới
- API key người dùng được **mã hoá tại chỗ** (AES-256-GCM) trước khi lưu DB — đã test round-trip encrypt/decrypt thật
- `/aiconfig setkey|use|remove|status` — quản lý API key cá nhân
- `/chat <message>` — hỏi AI cơ bản

## Đang xây (roadmap)

- Tạo file (docx/pdf/txt/code) bằng AI
- Tạo hình ảnh (DALL-E / Gemini Imagen)
- Nhắc lịch, quản lý task, quản lý chi tiêu
- Nghiên cứu, hỗ trợ học tập, hỗ trợ code web
- Tra phạt nguội (tra cứu vi phạm giao thông Việt Nam)
- Chat AI 24/7 trong kênh/DM

## Cài đặt

```bash
npm install
cp .env.example .env   # điền BOT_TOKEN, CLIENT_ID, OWNER_ID, DATABASE_URL, ENCRYPTION_KEY
npm start
```

`ENCRYPTION_KEY` dùng để mã hoá API key AI của người dùng — tạo bằng `openssl rand -hex 32`, giữ bí mật và không đổi sau khi đã có dữ liệu (đổi key sẽ khiến các key đã lưu không giải mã được nữa).

## License

Dự án cá nhân, không phát hành công khai.
