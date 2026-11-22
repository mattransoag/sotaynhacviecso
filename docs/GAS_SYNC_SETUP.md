# Kết nối giao diện V2 với Google Sheets và Zalo Bot

**Đã có mã nguồn trên GitHub**, nhưng cần cài đặt vào **GAS hiện có** để trang đồng bộ hoạt động. Việc thêm mã lên GitHub không tự triển khai GAS.

## Vì sao có 2 địa chỉ?

- **GitHub Pages**: https://mattransoag.github.io/sotaynhacviecso/ — trang công khai, công việc lưu trong trình duyệt (khóa localStorage: `sotaynhacviecso.tasks.v1`). Không để lộ token.
- **GAS**: giao diện V2 đăng nhập riêng, dữ liệu công việc thật được tạo/sửa trong Google Sheets, giúp `zrCheckReminders` đọc cùng nguồn dữ liệu và gửi Zalo khi lịch nhắc đã được bật.

Tách biệt như vậy để **không tạo API ghi dữ liệu công khai trên GitHub Pages**. Địa chỉ GAS cần triển khai giới hạn `Only myself`.

## Cài đặt

1. Mở dự án Google Apps Script đã có `ZaloReminders.gs`, `Dashboard.gs`, `DashboardUI.html`, `SetupWorkSheet.gs` và bảng `CongViec`.
2. Nhấn dấu `+` → **Tập lệnh**, tạo tệp tên **TaskApi**; dán toàn bộ [TaskApi.gs](../gas/TaskApi.gs).
3. Nhấn `+` → **HTML**, tạo tệp **TaskManagerUI**; dán toàn bộ [TaskManagerUI.html](../gas/TaskManagerUI.html). Không nhập `.html` lúc tạo.
4. Tìm hàm `doGet(e)` đang có. **Chỉ giữ một hàm doGet**, thêm điều kiện dưới đây vào đầu hàm và giữ nguyên các nhánh cũ:

```javascript
function doGet(e) {
  if (e && e.parameter && e.parameter.page === 'tasks') {
    return zrTaskManagerView();
  }
  if (e && e.parameter && e.parameter.page === 'dashboard') {
    return zrDashboardView();
  }
  // Giữ nguyên return / xử lý khác của ứng dụng gốc bên dưới.
  return zrDashboardView();
}
```

Đoạn trên minh họa trường hợp `doGet` hiện tại chỉ phục vụ Dashboard Zalo. Nếu `doGet` đang có logic riêng, **không thay toàn bộ**; chỉ chèn nhánh `page=tasks`.

5. Kiểm tra Script Properties: `ZR_ADMIN_EMAIL` là email quản trị đã dùng thành công cho Dashboard; `SPREADSHEET_ID` và `TASK_SHEET_NAME=CongViec` đúng bảng Sheets. Không sao chép `ZALO_BOT_TOKEN` vào code.
6. **Lưu → Triển khai → Quản lý lượt triển khai → Chỉnh sửa → Phiên bản mới → Triển khai**, đặt **Thực thi với tư cách: Tôi** và **Quyền truy cập: Chỉ mình tôi**.
7. Mở `<URL_GAS_EXEC>?page=tasks`. Nếu URL đã có dấu `?` thì dùng `&page=tasks`.
8. Tạo thử một công việc, kiểm tra tab `CongViec` có dòng mới và thay đổi trạng thái có cập nhật.
9. Quay lại Dashboard Zalo, kiểm tra gửi tin thử và chạy `zrCheckReminders` có giám sát. Chỉ khi nguồn dữ liệu và Zalo chính xác mới chạy `zrInstallTrigger` một lần.

**Link mở tham khảo sau khi GAS đã cập nhật đúng deployment:**
https://script.google.com/macros/s/AKfycbyG7h14b6gJJYL_8n3O9c6jhQj5NeRDlMesLLBO8HA3YecLUpfsdLKGjop1sruoWdAh/exec?page=tasks

## Chuyển công việc từ website GitHub Pages

- Trên website công khai, chọn **Sao lưu JSON**.
- Trên giao diện GAS mới `?page=tasks`, chọn **Nhập JSON từ bản web cũ** và chọn tệp đã tải.
- Giới hạn 100 công việc / lần nhập. Hệ thống tạo ID mới trong Google Sheets, **không xóa công việc có sẵn**. Nếu nhập lại lần nữa sẽ tạo bản ghi trùng; hãy kiểm tra trước khi nhập.
- Dữ liệu localStorage cũ tiếp tục tồn tại trên website Pages, không tự xóa.

## Bảo mật

- Không triển khai GAS quản trị ở chế độ `Anyone`, `Anyone with Google account` nếu chưa thiết kế phân quyền riêng.
- Tất cả thao tác CRUD gọi `zrDashboardGuard_`, có kiểm tra email từ `ZR_ADMIN_EMAIL`.
- Không đưa token vào HTML, JavaScript công khai, GitHub, query string hay localStorage.
- Có thể lưu phiên bản web tĩnh trong repo Public, **nhưng mã GAS vẫn cần duy trì bí mật cấu hình chỉ tại Script Properties**.

## Chức năng

Đọc công việc; thêm/sửa/xóa; đánh dấu hoàn thành; lọc và Kanban; xuất CSV, sao lưu JSON, nhập bản cũ. Bảng công việc phải có 9 tiêu đề do `SetupWorkSheet.gs` tạo, với định dạng ngày giờ thực.

## Giới hạn hiện tại

Dù dữ liệu đã lưu chung trong Google Sheets, **Zalo Bot sẽ không tự gửi tin** nếu chưa chạy và xác minh trigger `zrCheckReminders`. Chưa triển khai đồng bộ trực tiếp từ trang công khai vào Sheets — trang công khai chỉ có nút mở giao diện GAS an toàn.
