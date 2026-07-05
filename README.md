# Infinity Bot

Infinity Bot là bot Discord đa năng, tích hợp đầy đủ các hệ thống quản lý server hiện đại kèm theo web dashboard chuyên nghiệp, cấu hình riêng cho từng server.

## ✨ Tính năng

| Nhóm | Mô tả |
|------|-------|
| 🛡️ **Moderation** | Ban, kick, mute, timeout, softban, tempban, temprole, lock/unlock kênh, slowmode |
| ⚠️ **Warn/Case** | Hệ thống cảnh cáo, quản lý án phạt, tự động mute/kick/ban khi đạt ngưỡng cảnh cáo |
| ⚔️ **Anti-Nuke** | Chống raid, phát hiện hành vi phá hoại, whitelist, tự động phản ứng |
| 🚔 **AutoMod** | Chống spam, invite link, scam, từ cấm, whitelist |
| 🎫 **Tickets** | Hệ thống hỗ trợ qua ticket, nhiều category, panel tuỳ chỉnh |
| 🎁 **Giveaways** | Tạo, kết thúc, reroll giveaway |
| 🎭 **Reaction Roles** | Gán role qua reaction |
| 👋 **Welcome/Farewell** | Tin nhắn chào mừng/tạm biệt tuỳ chỉnh |
| 📋 **Logging** | Log hoạt động server (message, member, role, channel...) |
| 🤖 **AI Chat** | Trò chuyện AI, phân tích ảnh |
| 😄 **Fun & Roleplay** | Meme, minigame, tương tác (hug/pat/slap...), Truth or Dare, hàng trăm lệnh giải trí |
| 🔍 **Utility** | Avatar, banner, thông tin user/server, đổi đơn vị, mã hoá/giải mã |
| 📁 **Export** | Xuất dữ liệu kênh, thành viên, role |
| 🐾 **Animals · 💰 Crypto · 📚 Wikipedia · 📰 News** | Tiện ích tra cứu nhanh |
| 🔊 **Voice & Join-to-Create** | Quản lý kênh thoại, tự tạo kênh riêng |
| ⏰ **AFK · Auto-react · Auto-bump · Reminders · Todo** | Tiện ích cá nhân/server |
| 📊 **Stats Channels** | Kênh voice tự động hiển thị số thành viên/bot/boost/role |
| 🎂 **Birthday** | Lưu ngày sinh, tự động thông báo + gán role sinh nhật |
| ⭐ **Starboard** | Ghim tin nhắn nổi bật lên kênh riêng khi đủ số reaction |
| 🚪 **Verification Gate** | Cổng xác minh thành viên mới bằng nút bấm trước khi vào server |
| 🖼️ **Profile Card** | Ảnh profile tuỳ chỉnh (bio, background, social) |
| 🏷️ **Sticky Nickname** | Ép nickname cố định, tự khôi phục nếu bị đổi |

Toàn bộ tính năng trên có thể cấu hình qua web dashboard, riêng cho từng server bot tham gia.

## 🌐 Ngôn ngữ / Language

Bot hỗ trợ song ngữ **Tiếng Việt** và **English** cho phần lõi (core) — mỗi server tự chọn ngôn ngữ riêng bằng lệnh `/language set <en|vi>` (xem ngôn ngữ hiện tại bằng `/language view`, cần quyền **Manage Server** để đổi).

Các module đã được dịch đầy đủ (song ngữ EN/VI):
- Moderation (ban, kick, mute, lock, slowmode, softban, tempban, temprole, role give/remove, unban, unlock, unmute)
- Warn / Case / Warnpunish
- AutoMod
- Anti-Nuke
- Tickets
- Giveaways
- Welcome / Farewell
- Logging
- Verification
- Reaction Roles
- Menu `/help`

Các lệnh khác (fun, roleplay/reactions, utility converters, animals/crypto/wiki/news, AI chat, profile card, stats channel, birthday, starboard, sticky nickname, các lệnh owner...) **hiện chỉ có tiếng Anh** — chúng vẫn hoạt động bình thường, chỉ chưa được bản địa hoá trong đợt này.

Framework dịch (i18n) nằm ở `src/bot/i18n/en.json` / `src/bot/i18n/vi.json` và `src/bot/utils/i18n.js`, dễ dàng mở rộng thêm ngôn ngữ hoặc module mới trong tương lai.

---

The bot supports bilingual **English** and **Vietnamese** replies for its core feature set — each server picks its own language with `/language set <en|vi>` (view the current setting with `/language view`; changing it requires **Manage Server** permission).

Fully localized (EN/VI) modules: moderation, warn/case/warnpunish, automod, antinuke, tickets, giveaways, welcome/farewell, logging, verification, reaction roles, and the `/help` menu.

Everything else (fun, roleplay/reactions, utility converters, animals/crypto/wiki/news, AI chat, profile cards, stats channels, birthday, starboard, sticky nickname, owner commands) is **English-only for now** — these commands still work normally, they just haven't been translated yet.

### ✏️ Customizing bot replies (Owner Admin Panel)

The bot owner can override the exact wording of any already-bilingual reply/embed template from the **Messages** page in the Owner Admin Panel (`owner-admin/`) — search or filter the ~567-key catalog by category, edit the English and/or Vietnamese text per key (with a list of `{placeholder}` variables you can insert), save, or reset a key back to its default. This is scoped to the same modules listed above (moderation, warn/case/warnpunish, automod, antinuke, tickets, giveaways, welcome/farewell, logging, verification, reaction roles, `/help`) — it does **not** cover the ~800 other, not-yet-bilingual commands. Saved overrides are stored in the `MessageOverride` table and take effect on the live bot within seconds (short in-memory cache, invalidated immediately on save) — no restart needed.

## 📄 License

Dự án cá nhân, không phát hành công khai.
