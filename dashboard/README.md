# Dashboard riêng cho Sổ tay nhắc việc số

Giao diện trực quan quản trị Zalo Bot, Chat ID, gửi thử, xem trước dữ liệu Google Sheets. Không sử dụng AI.

## Cài đặt

1. Mở dự án Apps Script có `ZaloReminders.gs` đang hoạt động.
2. Thêm tệp script `Dashboard.gs` và tệp **HTML** tên `Dashboard` (`Dashboard.html`) theo nội dung thư mục này.
3. Chỉ thêm `DashboardEntry.gs` khi dự án **chưa có** `doGet(e)`. Nếu đã có `doGet(e)`, tích hợp nhánh `?page=dashboard` vào `doGet` sẵn có (ví dụ: `if(e.parameter.page==='dashboard')return zrDashboardView();`). Không tạo hai hàm doGet cùng tên.
4. Trong Project Settings → Script Properties: đặt `ZR_ADMIN_EMAIL` = email Google đăng nhập dự án; giữ `ZALO_BOT_TOKEN` ở Script Properties (không ghi token vào code).
5. Deploy → New deployment → Web app → Execute as **Me** → Who has access **Only myself**. Mở đường dẫn web app đã được cấp bằng tài khoản được cấu hình.
6. Bấm **Kiểm tra Bot Token** → gửi `/start` cho bot → **Tìm Chat ID mới** → **Lưu Chat ID** → **Gửi thử đến Zalo**.
7. Cài `SPREADSHEET_ID`, `TASK_SHEET_NAME` và `TASK_HEADER_*` đúng dữ liệu thật; thử **Đọc danh sách công việc**. Chỉ sau đó mới chạy `zrInstallTrigger`.

**Quan trọng:** Giá trị `Session.getActiveUser().getEmail()` phải có sẵn cho người dùng đã đăng nhập. Trong một số cấu hình Apps Script có thể trống: Dashboard sẽ từ chối truy cập an toàn. Hãy dùng bản triển khai chỉ mình tôi, không tắt kiểm tra để mở public.

## Lấy Chat ID không cần xem log

Dashboard dùng getUpdates và đọc object `result.message.chat.id`. Chỉ nhận được tin mới khi bot đang ở chế độ polling. Nếu hiện timeout thì nhắn tin mới cho bot rồi thử lại. Nếu bot đang dùng webhook, cần chuyển sang cơ chế lấy Chat ID tại webhook hoặc nhập thủ công Chat ID đã xác minh. Dashboard không tự xóa webhook.

## Giới hạn

Dashboard chưa được cài đặt vào GAS của người dùng; chỉ mới có mã trên GitHub. Vì `/exec` không mở được mã nguồn GAS nên không thể tự động đẩy sang dự án. Để dùng độc lập, cần cài `ZaloReminders.gs` cùng dự án hoặc điều chỉnh giao tiếp server cho dự án riêng. Dashboard không hiển thị token, không tự chỉnh sửa dữ liệu Google Sheets. Không chia sẻ đường dẫn Dashboard triển khai công khai.
