# Dashboard quản trị Zalo Bot

Tệp hiện hành: [Dashboard.gs](Dashboard.gs) và [DashboardUI.html](DashboardUI.html). Dùng cùng dự án Google Apps Script với [ZaloReminders.gs](../gas/ZaloReminders.gs).

## Cài đặt

1. Thêm tệp **Tập lệnh** tên `Dashboard.gs` và tệp **HTML** tên `DashboardUI.html`. Google Apps Script không cho tạo hai tệp có cùng tên gốc `Dashboard`.
2. Trong `Dashboard.gs`, `zrDashboardView()` phải gọi `HtmlService.createHtmlOutputFromFile('DashboardUI')`.
3. Nếu dự án GAS có `doGet(e)` rồi, **không tạo hàm thứ hai**. Đưa nhánh `if (e && e.parameter && e.parameter.page === 'dashboard') return zrDashboardView();` vào đầu hàm hiện tại, và giữ nguyên luồng xử lý chính.
4. Đặt `ZR_ADMIN_EMAIL` là email quản trị và `ZALO_BOT_TOKEN` trong Script Properties. Không đưa token vào GitHub.
5. Triển khai ứng dụng web bằng **Execute as: Me**, **Who has access: Only myself** (nếu ứng dụng chính cần chia sẻ công khai, hãy tách Dashboard vào dự án GAS riêng với kết nối bảo mật thay vì công khai nhánh quản trị).
6. Kiểm tra Bot Token → Tìm Chat ID mới → Chọn → Lưu Chat ID → Gửi tin thử.
7. Đọc thử công việc; hoàn thiện mapping dữ liệu trước khi bật trigger.

## Trạng thái

Theo ảnh người dùng cung cấp ngày 22/11/2026, đã xác minh Bot Token thành công và đã hiển thị một Chat ID được lấy từ Zalo. Chưa có bằng chứng từ API trong phiên làm việc này rằng trigger nhắc việc thực tế đã chạy hoặc dữ liệu công việc đã được xác minh.

## Chú ý

- Tệp `Dashboard.html` cũ được giữ lại vì lịch sử; không dùng để cài vào GAS.
- Lệnh `getWebhookInfo` có thể báo `Not Found` trong thực tế; kết quả này **không chứng minh** bot đang có webhook.
- Chat ID là mã định danh của cuộc trò chuyện, không phải Bot ID.

## Tạo nguồn dữ liệu Google Sheets mới

Nếu chưa có Google Sheets, thêm tệp [SetupWorkSheet.gs](../gas/SetupWorkSheet.gs) vào GAS. Cập nhật tệp `DashboardUI.html` từ GitHub, triển khai phiên bản GAS mới. Trong Dashboard chọn **4. Kiểm tra nguồn công việc → Tạo Google Sheets mới**. Hệ thống tự tạo và lưu `SPREADSHEET_ID` trong Script Properties, không xóa bảng có sẵn. Có thể chạy `zrCreateTaskSheetOnce` trực tiếp từ GAS để cấp quyền Google Sheets. Sau khi bảng được tạo, mở link trả về và nhập công việc rồi nhấn **Đọc danh sách công việc**. Chưa bật trigger khi chưa kiểm tra dữ liệu và gửi thử Zalo.
