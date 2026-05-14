# Project Context: Discord Bot Builder Dashboard

## Architecture
- **Frontend**: React + TypeScript + shadcn/ui + Tailwind (Vite dev server)
- **Backend**: FastAPI (Python) with SQLAlchemy ORM + Neon PostgreSQL
- **Bot**: discord.py (py-cord) with cogs system
- `verbatimModuleSyntax: true` — type-only imports MUST use `import type`
- `create_all()` only creates new tables, doesn't ALTER existing → use ALTER TABLE for new columns

## Key Convention: Embed Builder for EVERY Feature
**CRITICAL RULE**: When implementing ANY new feature/command, ALWAYS:
1. Add embed event(s) to `src/bot/embed_utils.py` DEFAULTS dict
2. Add corresponding event(s) to `src/pages/EmbedsManager.tsx`:
   - `EMBED_EVENTS` array (key, label, icon, desc)
   - `EVENT_GROUPS` (add to existing group or create new)
   - `DEFAULTS` object (default template with title, description, color, fields, etc.)
3. Add any new variables to `VARIABLES` array in EmbedsManager.tsx and ensure `build_embed()` in bot code passes matching vars
4. Use `build_embed("event_type", session, vars={...})` in bot cog instead of hardcoded `discord.Embed()`

## Embed System Flow
- `build_embed()` checks DB first (user-customized via dashboard) → falls back to hardcoded DEFAULTS
- Dashboard EmbedsManager lets user customize any embed with live Discord preview
- Variables like `{user.mention}`, `{order.id}` are substituted at runtime
- Hardcoded `discord.Embed()` is OK for UI/info displays (command lists, stats, personal queries) — NOT for event notifications

## File Locations
- Embed defaults (bot): `src/bot/embed_utils.py` → `DEFAULTS` dict
- Embed UI (dashboard): `src/pages/EmbedsManager.tsx` → `EMBED_EVENTS`, `EVENT_GROUPS`, `DEFAULTS`, `VARIABLES`
- Bot cogs: `src/bot/cogs/*.py`
- Models: `src/models/models.py`
- API routes: `src/api/routes.py`

## Current Embed Events (32)
Đơn hàng: don_hang_moi, qr_thanh_toan, thanh_toan, giao_hang, don_hang_het_han, don_hang_chi_tiet, san_pham, coupon, ban_shop, unban_shop
Cộng đồng: giveaway, ket_qua_giveaway, giveaway_banned, welcome, goodbye, feedback
Ticket: ticket_mo, ticket_dong, ticket_nhan, ticket_unclaim, ticket_transcript, ticket_panel, ticket_feedback
Kiểm duyệt: canh_bao, kick, ban, unban, timeout, invite_join, invite_leaderboard
Tiện ích: sticky_message, tempvoice_create

## UI Patterns
- Full-screen Dialog (not Sheet) for edit panels across all pages
- EmbedsManager: Discohook-style single-column, collapsible sections with colored left border
- Ticket config: per-panel (naming format + messages), not global
- Multi-panel grouping for ticket panels
