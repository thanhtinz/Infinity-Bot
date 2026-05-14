# Plan: Major UX Improvements — EmbedsManager, TempVoice, Channel/Role Dropdowns, Ticket Polish

## Context
User muốn:
1. **EmbedsManager** — redesign giống Discohook (hiện cuộn ngang trên mobile, UX chưa pro)
2. **Channel/Role dropdowns** — tất cả trang dùng text input cho channel/role → đổi sang dropdown select
3. **TempVoice** — cần nhiều cấu hình hơn (user limit, naming format, permission presets...)
4. **Ticket** — verify multi-panel support đầy đủ

## Current State Analysis

### EmbedsManager (1140 lines)
- Layout: 3-column (mobile: horizontal event scroll, editor, preview)
- Mobile: cuộn ngang chọn event → UX kém
- Editor: title, description, author, footer, color, image, thumbnail, fields array
- Preview: Discord-style embed preview
- **Plan**: Discohook-style = vertical sidebar (event list) + editor + live preview. Mobile: bottom sheet or tabs thay cuộn ngang

### Channel/Role Dropdowns — Trang cần fix:
Backend đã có: `GET /api/discord/channels`, `GET /api/discord/channels/all`, `GET /api/discord/roles`

| Page | Field | Current | Target |
|------|-------|---------|--------|
| TicketConfig | log_channel_id | text input | channel dropdown |
| TicketConfig | category_id | text input | category dropdown |
| TicketConfig | support_role_ids | text input (comma) | multi-role select |
| TicketClaiming | notify_channel_id | text input | channel dropdown |
| TicketPanels | channel_id (panel) | text input | channel dropdown |
| TicketPanels | category_id (button) | text input | category dropdown |
| StickyManager | channel_id | text input | channel dropdown |

ConfigVoice already uses dropdowns ✅

### TempVoice (226 lines) — Currently only:
- Enable toggle
- Join channel (dropdown)
- Category (dropdown)

**Missing features** (like typical tempvoice bots):
- Default user limit (0-99)
- Default room naming format: `{username}'s Room`, `Room #{number}`, custom
- Bitrate default (8-384 kbps)
- Allow owner to: lock, rename, set limit, kick, whitelist (permission toggles)
- Auto-delete empty rooms after X seconds
- Blacklist roles (can't create rooms)

### Ticket Multi-Panel
- TicketPanels already supports multi-button per panel ✅ (up to 5 buttons)
- Each button has label, emoji, style, category_id, form_id
- Backend has PanelButton table ✅

## Scope & Priority

### Phase 1: Channel/Role Dropdowns (shared hook)
Create a reusable hook `useDiscordData()` that fetches channels, categories, roles. Then create `<ChannelSelect>`, `<CategorySelect>`, `<RoleSelect>` reusable components.

**Files to create:**
- `src/hooks/useDiscordData.ts` — hook fetching `/api/discord/channels/all`, `/api/discord/roles`
- `src/components/ChannelSelect.tsx` — dropdown for text channels
- `src/components/CategorySelect.tsx` — dropdown for categories
- `src/components/RoleSelect.tsx` — dropdown for roles (single + multi)

**Files to update** (replace text inputs → dropdowns):
- `src/pages/TicketConfig.tsx` — log_channel, category, support_roles
- `src/pages/TicketClaiming.tsx` — notify_channel_id
- `src/pages/TicketPanels.tsx` — channel_id, category_id
- `src/pages/StickyManager.tsx` — channel_id (already uses dropdown from discord/channels, but may need update)

### Phase 2: TempVoice Enhanced Config
**Model** — add fields to `TempVoiceConfig`:
```python
default_user_limit = Column(Integer, default=0)       # 0 = unlimited
default_bitrate = Column(Integer, default=64000)      # 64kbps default
naming_format = Column(String, default="{username}'s Room")
auto_delete_seconds = Column(Integer, default=0)      # 0 = instant
allow_rename = Column(Boolean, default=True)
allow_limit = Column(Boolean, default=True)
allow_lock = Column(Boolean, default=True)
allow_kick = Column(Boolean, default=True)
```

**Backend** — update GET/POST `/api/tempvoice/config` to include new fields
**Frontend** — expand ConfigVoice with new settings sections

### Phase 3: EmbedsManager Redesign
Redesign to Discohook-style layout:
- **Desktop**: Left sidebar (event list grouped by category) + Right editor (tabbed: Content / Author / Images / Fields) + Bottom live preview
- **Mobile**: Top tabs for event list vs editor, bottom preview
- Remove horizontal scroll on mobile
- Color picker with presets (like StickyManager)
- Fields editor: add/remove/reorder, inline toggle

### Non-goals (deferred)
- Ticket reaction panels (emoji-based, Discord API specific)
- EmbedsManager full JSON editor mode
- Custom embed variables system

## Verification
- All channel/role fields use dropdowns instead of text inputs
- TempVoice has 8+ config options
- EmbedsManager works smoothly on mobile without horizontal scroll
- Build passes: `bunx --bun vite build` → ✓
- All existing features still work
