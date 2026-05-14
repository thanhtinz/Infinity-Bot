# Kế hoạch Xây dựng Hệ thống Discord Bot & Dashboard Toàn diện

## Ngữ cảnh (Context)
Dự án là một hệ thống Discord Bot đa năng kết hợp với Web Dashboard quản trị (React + FastAPI). 

**Quyết định Công nghệ:**
- **Thư viện Discord**: `py-cord`.
- **Trọng tâm hiện tại**: Giai đoạn 1 (Core) và Giai đoạn 2 (Bot Bán hàng & Dashboard).
- **Thanh toán**: Sử dụng PayOS để tạo mã QR thanh toán.
- **Quản lý Bot**: Token Bot, các cấu hình (kênh, PayOS keys) đều được lưu trữ và cấu hình từ Dashboard. Dashboard cung cấp các nút Start, Stop, Restart và theo dõi trạng thái Bot (Online/Offline).

## Phạm vi (Scope) hiện tại (Giai đoạn 1 & 2)
- Thiết lập Database cho Hệ thống (SystemConfig), Sản phẩm, Đơn hàng, Người dùng.
- Xây dựng Dashboard (React + FastAPI) quản lý toàn diện cấu hình và vòng đời của Bot.
- Tích hợp Pycord chạy động dưới sự kiểm soát của FastAPI.
- Tích hợp API PayOS để sinh QR thanh toán khi tạo đơn.

## Kế hoạch Triển khai Chi tiết (Implementation Plan)

**Bước 1: Setup Môi trường & Database**
- Cài đặt `py-cord`, `payos` (nếu có SDK) hoặc dùng `httpx` gọi REST API PayOS.
- Thiết kế Database (Neon Postgres):
  - `SystemConfig`: Lưu Discord Token, PayOS Client ID, API Key, Checksum Key, các cấu hình kênh (don_hang, feedback, v.v.).
  - `User`, `Product`, `Order`, `Coupon`.

**Bước 2: Quản lý Vòng đời Bot (Bot Lifecycle Management)**
- Backend FastAPI sẽ cung cấp các endpoint: `/api/bot/status`, `/api/bot/start`, `/api/bot/stop`, `/api/bot/restart`.
- Khi người dùng nhập Token trên Dashboard và bấm Start, FastAPI sẽ spawn một `asyncio.Task` để chạy Pycord bot với token lấy từ DB.
- Lắng nghe các event của Bot (`on_ready`, `on_disconnect`) để cập nhật trạng thái realtime về Dashboard.

**Bước 3: Xây dựng Dashboard Quản trị (Backend & Frontend)**
- **UI Dashboard**: 
  - Trang Tổng quan (Trạng thái Bot, nút Start/Stop/Restart).
  - Trang Cấu hình (Nhập Token, PayOS keys, chọn/nhập ID các kênh log).
  - Trang Quản lý Sản phẩm, Đơn hàng.
- **Backend API**: Các route CRUD tương ứng phục vụ UI.

**Bước 4: Tính năng Bot Bán hàng (Discord)**
- Lệnh `/account`, `/orders`: Fetch dữ liệu từ DB.
- Lệnh `/tao_don` (Admin): Admin chọn user, sản phẩm, và số lượng. 
  - Bot gọi PayOS để tạo payment link.
  - Bot gửi tin nhắn Embed kèm ảnh mã QR thanh toán từ PayOS, có nút Button "Nhập Coupon" cho user.
  - Xử lý Webhook từ PayOS: Khi thanh toán thành công, cập nhật trạng thái DB và chỉnh sửa (edit) tin nhắn Embed báo thành công.

## Xác minh (Verification)
- Lưu Token trên Dashboard và bật Bot thành công (Bot sáng đèn trên Discord).
- Bấm Stop bot tắt ngay lập tức.
- Tạo một sản phẩm trên Dashboard.
- Dùng lệnh `/tao_don` -> nhận Embed có QR PayOS. Quét thanh toán hoặc test webhook PayOS trả về -> Embed tự động update trạng thái.
