# TRIỂN KHAI SỔ TAY NHẮC VIỆC SỐ TRỰC TIẾP TRÊN GAS

**Mục tiêu:** Một website GAS để nhập việc, xem thống kê, sửa/xóa, kiểm tra Zalo và bật lịch nhắc. Không cần đăng nhập OAuth trên GitHub Pages để vận hành hằng ngày.

## Giữ nguyên hệ thống đang chạy

- Dự án GAS chính: **HE THONG NHAC VIEC SO** (có `ZaloReminders.gs`, `TaskApi.gs`, `TaskManagerUI.html`, `Dashboard.gs` và `DashboardUI.html`).
- Google Sheets: tab `CongViec`, không tạo lại và không xóa.
- Script Properties trong GAS chính: `ZALO_BOT_TOKEN`, `ZALO_CHAT_ID`, `SPREADSHEET_ID`, `TASK_SHEET_NAME` (mặc định `CongViec`). Không chuyển token ra GitHub hoặc HTML.
- GAS cổng công khai `CONG DONG BO SO TAY NHAC VIEC` chỉ cần khi vẫn muốn dùng trang GitHub Pages. Nếu bỏ GitHub Pages, ngừng sử dụng và vô hiệu hóa các deployment công khai **sau khi** xác nhận GAS chính vận hành ổn định.

## 1. Cập nhật 2 tệp trong dự án GAS chính

1. Mở [TaskApi.gs](../gas/TaskApi.gs), sao chép **toàn bộ mã** vào tệp cùng tên đang có của dự án `HE THONG NHAC VIEC SO`.
2. Mở [TaskManagerUI.html](../gas/TaskManagerUI.html), sao chép **toàn bộ HTML** vào tệp cùng tên.
3. Giữ nguyên `ZaloReminders.gs`, `Dashboard.gs`, `DashboardUI.html`, `SetupWorkSheet.gs`. Không tạo thêm `doGet` hoặc `doPost`.
4. Đảm bảo `doGet(e)` trong dự án GAS chính đã có nhánh:

```javascript
if (e && e.parameter && e.parameter.page === 'tasks') {
  return zrTaskManagerView();
}
```

5. Bấm **Lưu**, sau đó **Triển khai → Quản lý lượt triển khai → Chỉnh sửa → Phiên bản mới → Triển khai**. Chọn **Thực thi với tư cách Tôi**, **Chỉ mình tôi** để giữ an toàn cho trang quản lý.
6. Mở URL `/exec?page=tasks`. Nếu URL hiện đã có dấu `?`, dùng `&page=tasks`.

## 2. Kiểm tra các nút

- Nhấn **Kiểm tra kết nối**: thấy Bot Token đã có, Chat ID đã có, số trigger và số công việc trong Sheets.
- Nhấn **Gửi tin nhắn thử**: kiểm tra Zalo cá nhân nhận được tin. Kết quả trên website chỉ xác nhận lệnh API đã gửi, không chứng minh điện thoại đã nhận.
- Nhấn **Bật nhắc việc 5 phút**: tạo trigger `zrCheckReminders`. Chỉ thực hiện một lần. Chức năng sẽ thay các trigger cùng hàm mà tài khoản đang thực thi quản lý được; nếu có người khác từng cài trigger, phải kiểm tra thêm để tránh lịch trùng.
- Thêm công việc với hạn còn khoảng 30–45 phút, kiểm tra dòng mới trong Google Sheets `CongViec`. Bot hiện nhắc tối đa 60 phút trước hạn hoặc quá hạn trong 24 giờ.
- Nếu chưa nhận tin, chạy `zrDiagnoseReminders` trong dự án GAS chính để kiểm tra đúng bảng Sheets, có Chat ID và công việc có đủ điều kiện nhắc hay không.

## 3. Bảo mật và lưu ý

- **Không triển khai GAS chính ở chế độ Anyone**. Phiên bản này gọi `google.script.run` từ giao diện được kiểm soát bởi `zrDashboardGuard_`.
- GitHub chỉ là kho mã nguồn; trang GAS là nơi làm việc thực tế.
- Không xóa Google Sheets hoặc Script Properties đã có.
- Tần suất 5 phút dùng API định kỳ, không đảm bảo chạy chính xác đến từng giây.
- Tính năng hiện hỗ trợ một `ZALO_CHAT_ID` mặc định. Nhiều người nhận cần thiết kế phân quyền và danh sách người nhận riêng.
- Bản mã trên GitHub đã cập nhật, **không thể tự triển khai vào tài khoản GAS** khi chưa được kết nối quyền chỉnh sửa dự án đó.

## 4. Website GAS chính

https://script.google.com/macros/s/AKfycbyG7h14b6gJJYL_8n3O9c6jhQj5NeRDlMesLLBO8HA3YecLUpfsdLKGjop1sruoWdAh/exec?page=tasks

**Chỉ xem liên kết sau khi đã cập nhật đủ hai tệp và triển khai phiên bản GAS mới.**
