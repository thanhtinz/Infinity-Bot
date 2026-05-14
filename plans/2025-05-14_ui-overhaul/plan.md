# Plan: Professional UI Overhaul — Embeds, TempVoice, Channel/Role Dropdowns, Ticket Polish

## Context
User muốn dashboard chuyên nghiệp giống ticketbot.app và discohook.org:
1. EmbedsManager cuộn ngang khó dùng — cần Discohook-style vertical layout
2. TempVoice chỉ có 3 fields (enable, category, join channel) — cần thêm nhiều config
3. Channel/Role ID text inputs → dropdown selectors (dùng API sẵn có)
4. Ticket pages — verify multi-panel hoạt động đúng

## Scope

### In scope
1. **Channel/Role Dropdowns** — Tạo shared component `ChannelSelect` + `RoleSelect`, thay tất cả text input
2. **EmbedsManager redesign** — Vertical tabs (sidebar left) thay vì horizontal scroll
3. **TempVoice config mở rộng** — user limit, bitrate, naming format, auto-delete timer
4. **Ticket multi-panel verify** — kiểm tra flow tạo/sửa panel với nhiều buttons

### Out of scope
- Discohook full clone (components v2, webhooks) — chỉ cải thiện UX hiện tại
- Ticket reaction panels (cần Discord gateway logic phức tạp)

---

## Phase 1: Shared Channel/Role Select Components

### Files to create:
**`src/components/ChannelSelect.tsx`** — reusable dropdown cho Discord channels
- Props: `value`, `onChange`, `placeholder`, `filter?: "text" | "voice" | "category" | "all"`
- Fetches from `GET /api/discord/channels/all` (already exists)
- Groups by type (text/voice/category), shows `#channel-name` with type icon
- Fallback to text input if no channels loaded

**`src/components/RoleSelect.tsx`** — reusable dropdown cho Discord roles
- Props: `value`, `onChange`, `placeholder`, `multiple?: boolean`
- Fetches from `GET /api/discord/roles` (already exists)
- Shows `@role-name` with color dot

### Files to update (replace text inputs with dropdowns):
| File | Field | Component |
|------|-------|-----------|
| `TicketConfig.tsx` | `log_channel_id` | ChannelSelect (text) |
| `TicketConfig.tsx` | `category_id` | ChannelSelect (category) |
| `TicketConfig.tsx` | `support_role_ids` | RoleSelect (multiple) |
| `TicketClaiming.tsx` | `notify_channel_id` | ChannelSelect (text) |
| `TicketPanels.tsx` | `channel_id` | ChannelSelect (text) |
| `TicketPanels.tsx` | button `category_id` | ChannelSelect (category) |
| `TicketTeams.tsx` | role_id field | RoleSelect |
| `StickyManager.tsx` | `channel_id` | ChannelSelect (text) |
| `OrdersManager.tsx` | channel_id | ChannelSelect (text) |

### Backend:
- `GET /api/discord/channels/all` already returns `{id, name, type}` — type 0=text, 2=voice, 4=category
- `GET /api/discord/roles` already returns `{id, name}`
- No changes needed

---

## Phase 2: EmbedsManager Redesign (Discohook-style)

### Current UX (bad):
- Mobile: horizontal scroll tabs
- Desktop: left sidebar with horizontal category pills
- Each embed: basic title/description/color inputs

### Target UX:
- **Left sidebar**: vertical list of events grouped by category (Đơn hàng, Cộng đồng, Ticket, Kiểm duyệt)
- **Right panel**: Full embed editor for selected event:
  - Author (name + icon URL)
  - Title
  - Description (multiline)
  - Color (preset swatches + hex)
  - Fields (add/remove/reorder, name + value + inline toggle)
  - Image URL + Thumbnail URL
  - Footer (text + icon URL)
  - **Discord Live Preview** at bottom (already partially exists)
  - Enable/disable toggle per embed

### Layout:
```
┌──────────────┬────────────────────────────────────────┐
│ Categories   │ Embed Editor                           │
│              │                                        │
│ ▸ Đơn hàng  │ [Enable toggle]     [Reset to default] │
│   ├ Mới     │                                        │
│   ├ Thanh   │ Author: [___________] [icon url]       │
│   ├ Giao    │ Title:  [___________]                  │
│   └ Hết hạn │ Description: [textarea]                │
│              │ Color:  [●●●●●●] [#hex]               │
│ ▸ Cộng đồng │ Fields: [add field]                    │
│   ├ Welcome │   [name] [value] [inline ☑]            │
│   ├ Giveaway│ Image:  [url]                          │
│   └ ...     │ Thumb:  [url]                          │
│              │ Footer: [text] [icon url]              │
│ ▸ Ticket    │                                        │
│              │ ── Discord Preview ──                  │
│ ▸ Kiểm duyệt│ [live preview]                         │
└──────────────┴────────────────────────────────────────┘
```

### Mobile:
- Select dropdown instead of sidebar
- Editor below

### Implementation:
- Rewrite `EmbedsManager.tsx` with new layout
- Keep existing API endpoints (`GET/PUT /api/embeds`, `POST /api/embeds/reset`)
- Keep existing data model (`EmbedTemplate` with fields JSON)
- Improve Discord preview to show fields grid, author, footer with icon

---

## Phase 3: TempVoice Config Expansion

### Current model fields:
```python
class TempVoiceConfig:
    guild_id, join_channel_id, category_id, enabled
```

### New fields to add:
```python
default_user_limit = Column(Integer, default=0)         # 0 = unlimited
default_bitrate = Column(Integer, default=64000)         # 64kbps default
naming_format = Column(String, default="{user}'s Channel")
auto_delete_seconds = Column(Integer, default=0)         # 0 = when empty
allow_rename = Column(Boolean, default=True)
allow_limit = Column(Boolean, default=True)
allow_lock = Column(Boolean, default=True)
allow_hide = Column(Boolean, default=True)
interface_channel_id = Column(String, nullable=True)     # channel for control buttons
```

### Frontend ConfigVoice.tsx:
Add sections after existing fields:
1. **Mặc định kênh** — user limit (slider 0-99), bitrate (dropdown: 8/32/64/96/128/256/384 kbps), naming format
2. **Quyền người dùng** — toggles: allow rename/limit/lock/hide
3. **Kênh điều khiển** — ChannelSelect for interface_channel_id
4. **Tự động xóa** — slider/input for auto_delete_seconds

### Backend:
- Update `TempVoiceConfig` model
- Update `GET/PUT /api/tempvoice/config` routes

---

## Phase 4: Ticket Multi-panel Verify

### Check:
- TicketPanels frontend sends `buttons[]` in POST/PUT
- Backend creates/updates `PanelButton` records
- GET returns `buttons[]` array
- Panel card renders all buttons
- Edit sheet loads existing buttons correctly

### Existing code status:
- **Frontend** (`TicketPanels.tsx`, 1120 lines): Has multi-button types (`TicketButton[]`), sheet with Embed/Buttons tabs, add/edit/remove per button
- **Backend** (`routes.py`): Updated with `PanelButton` model, joinedload, CRUD with buttons array, legacy fallback
- **Model** (`models.py`): `PanelButton` table with `panel_id`, `label`, `emoji`, `style`, `category_id`, `form_id`, `sort_order`

Status: **Already implemented**. Just needs verification test.

---

## Verification

1. **Channel/Role selects**: Navigate to TicketConfig, Claiming, Panels → verify dropdowns load channels/roles
2. **EmbedsManager**: Select embed from sidebar → edit all fields → preview updates live → save → reload → data persists
3. **TempVoice**: Change all new settings → save → reload → verify
4. **Ticket Panels**: Create panel with 3 buttons → save → reload → verify buttons persist → edit panel → modify buttons → save
