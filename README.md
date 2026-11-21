# SỔ TAY NHẮC VIỆC SỐ — Zalo Bot + Google Apps Script

Hệ thống nhắc công việc từ Google Sheets qua tài khoản **Zalo Bot** chính thức, **không sử dụng AI**.

- Mã tích hợp: [gas/ZaloReminders.gs](gas/ZaloReminders.gs)
- Phần mềm nguồn (GAS đã triển khai): https://script.google.com/macros/s/AKfycbw93F_saU8Vw6Wd-Lg9qOYv_THGK1p8YNilJU8M933OuOP9QavproWmTMtAjMYOg7KRmA/exec

## Trạng thái

✅ Đã đưa module nhắc việc lên GitHub.  
⏳ Chưa cài module vào dự án GAS thực tế, chưa xác minh cấu trúc dữ liệu Sheet, chưa có token và chat_id; vì vậy **chưa gửi được nhắc việc thật**.

Không sửa `doGet`, `doPost`, giao diện hay dữ liệu hiện có.

## Thiết lập nhanh

1. Mở phần mềm nguồn bằng trình chỉnh sửa **Google Apps Script** (cần quyền chỉnh sửa dự án, không phải chỉ URL `/exec`).
2. Thêm tệp Script mới tên `ZaloReminders`. Sao chép nội dung từ `gas/ZaloReminders.gs` vào đó. KHÔNG xóa tệp cũ.
3. Trong **Project Settings → Script Properties**, thêm:
   - `ZALO_BOT_TOKEN`: token lấy từ Zalo Bot Manager (giữ bí mật).
   - `TASK_SHEET_NAME`: tên tab Sheet đang lưu công việc.
   - `SPREADSHEET_ID`: ID Google Spreadsheet nếu dự án GAS không gắn với Sheet.
   - `TASK_HEADER_ID`, `TASK_HEADER_TITLE`, `TASK_HEADER_DUE`, `TASK_HEADER_STATUS`: tên các cột tương ứng. Mặc định: `ID`, `Công việc`, `Hạn hoàn thành`, `Trạng thái`.
4. Vào cuộc trò chuyện với bot vừa tạo bằng tài khoản Zalo muốn nhận tin, gửi chữ **chào**.
5. Trong GAS chọn chạy `zrDiscoverChatId` rồi mở **Executions / Execution log** để xem `chat_id`. Nếu bot đã đăng ký webhook, `getUpdates` có thể không hoạt động; cần chọn một cơ chế nhận tin và không tùy ý xóa webhook đang sử dụng.
6. Thêm `ZALO_CHAT_ID` trong Script Properties với `chat_id` đã tìm được.
7. Chạy `zrSendTest`; xác nhận tin thử đã đến Zalo.
8. Chạy `zrCheckReminders` một lần để kiểm tra Sheet và cách đọc dữ liệu; kiểm tra Executions. Khi mọi thứ đúng, chạy `zrInstallTrigger` một lần để quét 15 phút/lần.

**Không đăng token lên GitHub, không gửi token trong tin nhắn hoặc chụp màn hình chia sẻ công khai.** Hãy chỉ nhập token vào Script Properties.

## Dữ liệu cần có

Module đọc dòng đầu làm tiêu đề, và yêu cầu ít nhất 4 trường:

| ID | Công việc | Hạn hoàn thành | Trạng thái |
|---|---|---|---|
| CV001 | Nộp báo cáo | 25/11/2026 16:30 | Chưa hoàn thành |
| CV002 | Họp tổ | 26/11/2026 08:00 | Hoàn thành |

Nếu phần mềm thực tế có cột, cấu trúc hay cách lưu khác, cần **điều chỉnh mapping trên phiên bản đã kiểm tra**, không tự tạo bảng mới đè lên bảng hiện có. Cần xác định công việc của người nhận trước khi triển khai nhiều người.

## Cơ chế

- Mỗi lần trigger chạy, đọc dữ liệu nguồn.
- Gửi tin công việc chưa hoàn thành khi còn từ 0–60 phút trước hạn.
- Gửi cảnh báo quá hạn trong 24 giờ đầu sau hạn.
- Dùng Script Properties ghi khóa đã gửi theo ID, hạn và loại nhắc. Nếu lỗi gửi, chưa ghi khóa.
- Chỉ gửi đến một `ZALO_CHAT_ID` được chỉ định. Nếu nhiều người cần nhận, phải bổ sung ánh xạ người phụ trách/nhóm và quy tắc phân quyền.

## Các lưu ý kỹ thuật

- Trigger GAS 15 phút/lần có thể chạy lệch thời điểm; không đảm bảo nhắc đúng giây.
- Công việc có hạn rất xa trong quá khứ không được nhắc lại.
- Dữ liệu ngày tháng nên là ô ngày giờ thực của Google Sheets; nếu là chữ, hỗ trợ `dd/MM/yyyy HH:mm` hoặc ISO.
- Chống trùng bằng Script Properties có giới hạn lưu trữ, bản đầu dành cho quy mô nhỏ. Với nhiều nhiệm vụ cần thêm sheet `LichSuGui` hoặc CSDL.
- Không sử dụng phần mềm này để gửi tin không mong muốn hay thông tin nhạy cảm đến người không đăng ký nhận tin.
- Zalo Bot API có chính sách và hạn chế riêng; xem tài liệu chính thức: https://docs.zaloplatforms.com/zalo-bot
