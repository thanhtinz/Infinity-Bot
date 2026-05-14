# Plan: Feature Improvements — PayOS Test, Sticky Embed, Ticket Messages Config

## Context
User yêu cầu nhiều cải thiện:
1. PayOS — thêm nút test kết nối 
2. Sticky — embed cần chuyên nghiệp hơn (Discord preview)
3. Ticket — thiếu nhiều tính năng: cấu hình nội dung tin nhắn khi mở/đóng/claim ticket, Feedback page thiếu trong nav

## Scope
### In scope
- **PayOS**: Thêm nút "Test kết nối" gọi API PayOS test endpoint → backend tạo route `POST /api/payos/test`
- **Sticky embed**: Thêm Discord-style live preview trong dialog form (giống TicketPanels preview), color picker presets
- **Ticket Messages**: Thêm section trong TicketConfig cho: open_message, close_message, claim_message (nội dung embed khi ticket mở/đóng/claim)
- **Ticket Feedback**: Thêm vào nav (đang có route nhưng thiếu nav item)

### Out of scope (deferred)
- Ticket reaction panels (Discord reaction-based, cần bot logic phức tạp)
- TicketBot level automation workflows

## Implementation Plan

### Phase 1: Quick fixes
**Files**: `src/App.tsx`
- Thêm nav item cho Ticket Feedback (Star icon, label "Feedback") vào ticket group

### Phase 2: PayOS Test Connection
**Files**: `src/api/routes.py`, `src/pages/ConfigPayOS.tsx`

**Backend** — `POST /api/payos/test`:
```python
@router.post("/payos/test")
def test_payos(db=Depends(get_db)):
    config = db.execute(select(SystemConfig).limit(1)).scalars().first()
    if not config or not all([config.payos_client_id, config.payos_api_key, config.payos_checksum_key]):
        raise HTTPException(400, "PayOS chưa cấu hình")
    try:
        payos = PayOS(client_id=config.payos_client_id, api_key=config.payos_api_key, checksum_key=config.payos_checksum_key)
        # Call getPaymentLinkInformation with a dummy order to verify creds
        return {"ok": True, "message": "Kết nối thành công"}
    except Exception as e:
        raise HTTPException(400, f"Lỗi: {str(e)}")
```

**Frontend** — ConfigPayOS.tsx:
- Add "Test kết nối" button below form
- Show success/error toast
- Button disabled khi config chưa có

### Phase 3: Sticky Embed — Discord Preview
**Files**: `src/pages/StickyManager.tsx`

- Thêm `DiscordPreview` component (giống TicketPanels) vào dialog form
- Show preview below embed fields khi `embed_enabled` = true
- Color picker: 6 preset colors (same PRESET_COLORS array)
- Preview hiển thị: embed title, description, footer, color bar, thumbnail/image

### Phase 4: Ticket Messages Config
**Files**: `src/models/models.py`, `src/api/routes.py`, `src/pages/TicketConfig.tsx`

**Model** — Thêm fields vào `TicketConfig`:
```python
open_message_title = Column(String, nullable=True)      # Embed title khi ticket mở
open_message_body = Column(Text, nullable=True)          # Embed body
close_message_title = Column(String, nullable=True)
close_message_body = Column(Text, nullable=True)
claim_message_title = Column(String, nullable=True)
claim_message_body = Column(Text, nullable=True)
```

**Backend** — Update `PUT /api/ticket-config` để nhận thêm 6 fields mới

**Frontend** — TicketConfig.tsx:
- Thêm Section "Tin nhắn tự động" với 3 card:
  1. Khi mở ticket: title + body (Textarea) + preview Discord embed
  2. Khi đóng ticket: title + body + preview
  3. Khi claim ticket: title + body + preview
- Hỗ trợ biến: `{user}`, `{staff}`, `{ticket_id}`, `{channel}`
- Discord-style preview cho mỗi card

## Verification
- PayOS: Click "Test kết nối" → toast success/error
- Sticky: Tạo/sửa sticky → thấy Discord preview cập nhật live
- Ticket Config: Điền tin nhắn → preview Discord hiển thị đúng
- Nav: Ticket Feedback xuất hiện trong menu
- Build: `bunx --bun vite build` → ✓ clean
