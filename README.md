# Infinity Bot — AI Assistant

Bot Discord trợ lý AI cá nhân. Mỗi người dùng tự cấu hình API key AI của riêng mình (Gemini, OpenAI, Claude) — bot không dùng chung một key trả phí cho tất cả mọi người.

## Tính năng

| Lệnh | Mô tả |
|------|-------|
| `/aiconfig setkey\|use\|remove\|status` | Quản lý API key AI cá nhân (Gemini/OpenAI/Claude), mã hoá AES-256-GCM tại chỗ |
| `/chat <message>` | Hỏi AI cơ bản |
| `/aichannel enable\|disable` | Biến 1 kênh thành kênh chat AI 24/7 — nói chuyện bình thường không cần lệnh |
| `/imagine <prompt>` | Tạo hình ảnh bằng AI (DALL-E / Gemini Imagen tuỳ provider đang dùng) |
| `/createfile <description> [format]` | Tạo file bằng AI — txt/md/docx (thật)/pdf (thật)/code |
| `/remind add\|list\|cancel` | Nhắc lịch — hỗ trợ "30m/2h/1d" hoặc ngôn ngữ tự nhiên (cần AI key) |
| `/task add\|list\|complete\|remove` | Quản lý công việc cá nhân |
| `/expense add\|list\|summary` | Quản lý chi tiêu, AI gợi ý category, tổng hợp theo khoảng thời gian |
| `/research <topic> [depth]` | Trợ lý nghiên cứu — tóm tắt nhanh hoặc chuyên sâu |
| `/study <question> [subject]` | Hỗ trợ học tập kiểu gia sư — giải thích từng bước |
| `/webhelp <description> [language]` | Hỗ trợ code web — HTML/CSS/JS/React |
| `/phatnguoi <biển số> [loại xe]` | Tra phạt nguội — xem [PHATNGUOI_SETUP.md](PHATNGUOI_SETUP.md) (chưa có API chính thức, cần tự cấu hình dịch vụ hợp pháp nếu muốn dùng thật) |

Chat 24/7: nhắn tin trực tiếp (DM) với bot lúc nào cũng được trả lời; trong server, bật bằng `/aichannel enable` ở kênh mong muốn.

## Kiến trúc

- `src/bot/utils/ai/` — lớp trừu tượng AI provider (Gemini/OpenAI/Claude), dễ thêm provider mới, mỗi user dùng key riêng
- `src/database/models/` — Sequelize/PostgreSQL: `UserAIConfig` (key mã hoá), `Reminder`, `Task`, `Expense`, `ChatChannel`
- `src/bot/commands/` — mỗi lệnh 1 thư mục, tự động nạp bởi `commandLoader.js`
- `src/bot/utils/reminderScheduler.js` — vòng lặp 20s kiểm tra nhắc lịch đến hạn

Toàn bộ nền tảng, mã hoá key, và từng lệnh đều đã được test thật với PostgreSQL cục bộ trong quá trình xây dựng (trừ các lệnh gọi API AI thật — cần API key thật của người dùng để test đầu-cuối).

## Cài đặt

```bash
npm install
cp .env.example .env   # điền BOT_TOKEN, CLIENT_ID, OWNER_ID, DATABASE_URL, ENCRYPTION_KEY
npm start
```

`ENCRYPTION_KEY` dùng để mã hoá API key AI của người dùng — tạo bằng `openssl rand -hex 32`, giữ bí mật và không đổi sau khi đã có dữ liệu (đổi key sẽ khiến các key đã lưu không giải mã được nữa).

## License

Dự án cá nhân, không phát hành công khai.
