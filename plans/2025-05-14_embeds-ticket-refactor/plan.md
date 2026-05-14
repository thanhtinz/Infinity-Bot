# Plan: EmbedsManager Discohook-style + Ticket Per-Panel Architecture

## Context
1. **EmbedsManager** — Layout 3 cột (sidebar 280px + editor flex-1 + preview 400px) squeeze editor trên màn hình nhỏ. User muốn giống Discohook: editor bên trái, preview bên phải, event selector là dropdown ở trên (không phải sidebar).
2. **Ticket architecture** — Messages tự động (open/close/claim), naming format đang global trong `TicketConfig`. Cần chuyển sang per-panel. Cần thêm multi-panel grouping (1 embed message chứa nhiều panel buttons).
3. **Uptime emoji** — ✅ Đã fix (`⏱️` removed from BotStatus).

## Scope

### In scope
- EmbedsManager: redesign thành 2 cột (Discohook-style)  
- Ticket: migrate message config + naming từ global → per-panel
- Ticket: multi-panel grouping (gộp nhiều panel vào 1 message)

### Out of scope
- Discohook full clone (webhooks, multiple messages, components v2)
- Ticket forms redesign

---

## Phase 1: EmbedsManager Redesign (Discohook-style)

### Problem
Layout 3 cột: sidebar (280px fixed) + editor (flex-1) + preview (400px fixed) = 680px fixed width, editor bị squeeze khi viewport hẹp.

### Solution
Chuyển thành 2 cột giống Discohook:
- **Top bar**: Event selector (Select dropdown) + Enable toggle + Reset button + Save button — luôn visible
- **Left column (55%)**: Editor fields — scrollable, collapsible sections
- **Right column (45%)**: Discord preview — sticky
- **Mobile**: single column, editor → preview stacked

### Files to modify:
- `src/pages/EmbedsManager.tsx` (~1160 lines) — full layout rewrite

### Layout structure:
```
┌─────────────────────────────────────────────────────┐
│ [Event Dropdown ▼] [Bật/Tắt] [Reset] [Lưu thay đổi]│
├──────────────────────────┬──────────────────────────┤
│ Editor (scroll)          │ Preview (sticky)          │
│ ┌─ Body ──────────────┐  │ ┌─ Discord ───────────┐  │
│ │ Title               │  │ │                     │  │
│ │ Description         │  │ │   Live embed        │  │
│ │ Color               │  │ │   preview           │  │
│ │ Footer              │  │ │                     │  │
│ └─────────────────────┘  │ └─────────────────────┘  │
│ ▸ Author                 │                          │
│ ▸ Images                 │  * Variables hint        │
│ ▸ Fields (3)             │                          │
│ ▸ Variables              │                          │
└──────────────────────────┴──────────────────────────┘
```

### Key changes:
1. Remove entire left sidebar panel (280px)
2. Move event selector to top bar as Select dropdown (same as current mobile)
3. Top bar: event dropdown | spacer | enable toggle | reset btn | save btn
4. Below top bar: 2-column `grid grid-cols-1 lg:grid-cols-[1fr_400px]`
5. Left: editor with `overflow-y-auto`, collapsible sections (Author, Images, Fields, Variables)
6. Right: Discord preview with `lg:sticky lg:top-0` + Variables reference
7. Mobile: single column, preview below editor

---

## Phase 2: Ticket Per-Panel Messages & Naming

### Current state
- `TicketConfig` (global): `naming_format`, `open_message_title/body`, `close_message_title/body`, `claim_message_title/body`
- `TicketPanel`: chỉ có embed config (title, description, color) + buttons
- `Ticket` model: có `panel_id` FK → biết ticket thuộc panel nào

### Target state
Mỗi `TicketPanel` có riêng:
- `naming_format` — tên kênh ticket (e.g. "support-{number}", "billing-{username}")
- `open_message_title/body` — tin nhắn khi mở ticket
- `close_message_title/body` — tin nhắn khi đóng
- `claim_message_title/body` — tin nhắn khi staff claim

Global `TicketConfig` vẫn giữ làm **fallback defaults** — nếu panel không set, dùng global.

### Model changes (`src/models/models.py`):
Add to `TicketPanel`:
```python
# Per-panel ticket settings (override global TicketConfig)
naming_format = Column(String, nullable=True)          # null = dùng global
open_message_title = Column(String, nullable=True)
open_message_body = Column(Text, nullable=True)
close_message_title = Column(String, nullable=True)
close_message_body = Column(Text, nullable=True)
claim_message_title = Column(String, nullable=True)
claim_message_body = Column(Text, nullable=True)
```

### Backend changes (`src/api/routes.py`):
- `GET /api/ticket-panels` — return 7 new fields
- `POST /api/ticket-panels` — accept 7 new fields
- `PUT /api/ticket-panels/{id}` — update 7 new fields
- Add helper: `GET /api/ticket-panels/{id}/resolved-config` — returns merged config (panel override → global fallback)

### Frontend changes:
- `src/pages/TicketPanels.tsx` — Add "Cấu hình Ticket" tab in edit Sheet:
  - Tab 1: Embed (existing)
  - Tab 2: Buttons (existing)
  - Tab 3: **Cấu hình** (NEW) — naming format, open/close/claim messages
  - Each field shows placeholder text from global config when empty (visual fallback hint)
  
- `src/pages/TicketConfig.tsx` — Keep Section 4 & 5 (naming + messages) nhưng add note: "Đây là cấu hình mặc định. Mỗi panel có thể ghi đè riêng."

---

## Phase 3: Multi-Panel Grouping

### Problem
Hiện tại mỗi panel = 1 Discord message riêng. User muốn gộp nhiều panel buttons vào 1 message (như ticketbot.app).

### Solution
Add `panel_group_id` concept:
- `TicketPanelGroup` model mới: `id`, `guild_id`, `name`, `channel_id`, `message_id`, `title`, `description`, `color`
- `TicketPanel` thêm: `group_id` FK (nullable) — panel thuộc group nào
- Panels trong cùng group → buttons gộp vào 1 embed message
- Panel không có group_id → hoạt động độc lập như hiện tại

### Model (`src/models/models.py`):
```python
class TicketPanelGroup(Base):
    __tablename__ = "ticket_panel_groups"
    id = Column(Integer, primary_key=True, index=True)
    guild_id = Column(String, nullable=False)
    name = Column(String, default="Multi Panel")
    channel_id = Column(String, nullable=True)
    message_id = Column(String, nullable=True)
    title = Column(String, default="Hỗ trợ")
    description = Column(Text, nullable=True)
    color = Column(String, default="#5865F2")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    panels = relationship("TicketPanel", back_populates="group")

# Add to TicketPanel:
group_id = Column(Integer, ForeignKey("ticket_panel_groups.id"), nullable=True)
group = relationship("TicketPanelGroup", back_populates="panels")
```

### Backend:
- `GET /api/ticket-panel-groups` — list groups with nested panels
- `POST /api/ticket-panel-groups` — create group
- `PUT /api/ticket-panel-groups/{id}` — update group + assign/unassign panels
- `DELETE /api/ticket-panel-groups/{id}` — delete group (panels become standalone)
- `POST /api/ticket-panel-groups/{id}/send` — send grouped embed to Discord channel

### Frontend:
- New section in TicketPanels page: "Multi-Panel Groups"
- UI: drag panels into groups, configure group embed (title, desc, color)
- Group card shows all member panels' buttons in Discord preview

---

## Verification

1. **EmbedsManager**: Select event → edit all fields → preview updates live → save → reload → data persists. Works on mobile (single col) and desktop (2 col).
2. **Per-panel messages**: Create panel → set custom naming/messages → create ticket → verify panel-specific messages used → delete custom → verify fallback to global.
3. **Multi-panel groups**: Create group → add 3 panels → send to channel → verify 1 message with all buttons → click button → creates ticket with correct panel_id.
