# SỔ TAY NHẮC VIỆC SỐ V3 — CHỈ MỘT WEB GAS, KHÔNG AI

Ngày cập nhật: 22/11/2026.

## Những gì được nâng cấp

- Dashboard nhỏ gọn hơn; thêm "Việc cần chú ý" ở đầu màn hình.
- Mỗi công việc tự chọn **nhiều** mốc nhắc: 1, 2, 5, 10, 15, 30, 60 phút hoặc 1 ngày trước hạn.
- Bật/tắt Zalo cho từng công việc và toàn hệ thống.
- GAS quét **mỗi 1 phút** (không bảo đảm chính xác từng giây); cố gắng xử lý sai lệch tối đa khoảng 3 phút, không gửi dồn các mốc đã lỡ từ lâu.
- Trạng thái đã gửi được ghi vào 1 cột của `CongViec`, nhật ký gửi nằm trong tab `NhatKyNhac`.
- Trong màn hình Zalo, có **Kiểm tra kết nối**, **Gửi tin thử**, **Bật lịch 1 phút**, **Tắt/Bật nhắc Zalo**, **Đổi Bot Token và Chat ID**. Khi đổi bot, kiểm tra API và gửi thử trước khi lưu.
- Không tích hợp AI, không cần GitHub Pages cho vận hành hằng ngày.

## QUAN TRỌNG: Sao lưu trước khi triển khai

1. Mở Google Sheets hiện có, chọn **Tệp → Tạo bản sao**. Không xóa hoặc đổi tên bảng hiện có.
2. Tại dự án Apps Script chính, sao lưu các tệp `TaskApi.gs`, `ZaloReminders.gs`, `TaskManagerUI.html` đang chạy.
3. Chỉ cập nhật **DỰ ÁN GAS CHÍNH** chứa `ZaloReminders.gs`, `TaskApi.gs`, `Dashboard.gs`. KHÔNG áp dụng tại dự án `CONG DONG BO SO TAY NHAC VIEC` (ingress riêng).

## Cập nhật đúng 3 tệp

Sao chép toàn bộ **nội dung** (không phải liên kết) từ ba tệp sau của GitHub vào tệp tương ứng trong dự án GAS chính:

- [TaskApi.gs](TaskApi.gs)
- [ZaloReminders.gs](ZaloReminders.gs)
- [TaskManagerUI.html](TaskManagerUI.html)

Giữ nguyên `Dashboard.gs`, `DashboardUI.html`, `SetupWorkSheet.gs` và các Script Properties khác. Không khai báo thêm `doGet` thứ hai.

Để URL `/exec` đưa thẳng tới giao diện V3, thay **nội dung hàm `doGet(e)` hiện hữu** bằng định tuyến sau (chỉ nếu dự án không cần nhánh doGet khác):

```javascript
function doGet(e) {
  if(e && e.parameter && e.parameter.page === 'dashboard') return zrDashboardView();
  return zrTaskManagerView();
}
```

Nếu `doGet(e)` hiện hữu còn có chức năng khác, chỉ thêm nhánh `page=tasks` để tránh mất chức năng cũ; URL `/exec?page=tasks` sẽ là trang V3.

## Cột Google Sheets

Giữ nguyên **9 cột hiện có** ở `CongViec`:
`ID`, `Công việc`, `Hạn hoàn thành`, `Trạng thái`, `Người phụ trách`, `Mức ưu tiên`, `Ghi chú`, `Ngày tạo`, `Ngày hoàn thành`.

V3 **chỉ nối thêm 3 cột ở cuối** (tự động khi sử dụng màn hình V3):
- `Nhắc trước (phút)` — chẳng hạn `5,2,1`.
- `Bật nhắc Zalo` — TRUE/FALSE.
- `Đã nhắc các mốc` — dấu đã gửi theo thời hạn và mốc, tránh gửi lại cùng mốc.

**Dòng cũ**: nếu chưa có giá trị mốc nhắc => mặc định 60 phút; ô bật nhắc trống => bật. V3 không sửa 9 cột cũ khi thực hiện mở rộng cấu trúc.

**Dữ liệu nhắc**: tab `NhatKyNhac` tự tạo khi có sự kiện gửi hoặc lỗi gửi. Không lưu Bot Token ở tab này.

## Quyền và cấu hình

Trong **Project Settings → Script Properties** dự án GAS chính:
- `ZR_ADMIN_EMAIL`: email tài khoản chủ sở hữu.
- `SPREADSHEET_ID`: ID Google Sheets hiện tại.
- `ZALO_BOT_TOKEN`, `ZALO_CHAT_ID`: giữ nguyên giá trị bot đang hoạt động.
- `ZR_APP_URL`: `https://script.google.com/macros/s/AKfycbxQmhI6Wv7UXuSQu_hfbpZjqqC2hLifiQcRrKdxhy75UM1Qw97n4NMyIfkaQHaMuEabLw/exec`
- `ZR_REMINDER_ENABLED` = `true` (có thể bật/tắt ngay trên web GAS).

Triển khai web app bằng tài khoản chủ sở hữu, **chỉ mình tôi**, không mở công khai các chức năng quản trị bot và Google Sheets.

## Bật lịch sau khi thay mã

1. Lưu ba tệp.
2. Trong GAS, chọn `zrInstallTrigger` → **Chạy** một lần → cấp quyền nếu GAS yêu cầu. Hàm này thay trigger `zrCheckReminders` của tài khoản hiện tại bằng lịch **mỗi 1 phút**.
3. Kiểm tra **Trình kích hoạt**: có một trigger `zrCheckReminders`; nếu thấy trigger trùng do tài khoản khác tạo, xử lý riêng.
4. Triển khai → Quản lý các lượt triển khai → Chỉnh sửa → **Phiên bản mới** → Triển khai.
5. Mở `/exec?page=tasks` hoặc `/exec` nếu đã đổi định tuyến.

## Thử nghiệm bắt buộc

- Thêm 1 công việc hạn sau 15 phút, bật Zalo và chọn mốc **10, 5, 2 phút**.
- Kiểm tra Google Sheets `CongViec` đã ghi các mốc nhắc.
- **Không chạy thủ công hàm `zrCheckReminders`**; chờ đến mốc, đối chiếu tin Zalo và tab `NhatKyNhac`.
- Các mốc gửi được đánh dấu ở cột `Đã nhắc các mốc` để tránh gửi lặp.
- Thử tắt nhắc Zalo ở một công việc khác; công việc đó không được gửi tin.
- Thử nút **Gửi tin nhắn thử** và thay Bot Token/Chat ID trên web khi cần đổi bot.

## Các giới hạn cần hiểu

- **Apps Script không bảo đảm đúng từng giây**: quét 1 phút chỉ là lịch yêu cầu. Nếu Google trì hoãn trigger quá lâu, một mốc ngắn có thể bị bỏ qua thay vì gửi dồn nhiều tin.
- Mỗi mốc chỉ gửi một lần theo thời hạn của công việc; có thể có thêm một cảnh báo quá hạn nếu trigger rơi vào 3 phút sau hạn.
- Nếu Zalo API đã nhận tin nhưng Google Sheets lỗi khi ghi dấu, có khả năng gửi lại ở lần tiếp theo. Kiểm tra log để phát hiện.
- Dự án GAS chạy ở tài khoản hiện tại chưa được sửa tự động: mã GitHub đã sẵn sàng, **cần dán và triển khai trong Apps Script**.
- Không gửi Bot Token/Chat ID, mật khẩu, OAuth token cho bất kỳ ai qua chat hoặc ảnh.

## Nút Xóa

Nút Xóa hiện **xóa trực tiếp không hiện hộp thoại xác nhận**, theo yêu cầu của chủ tài khoản. Nên sử dụng bản sao lưu Sheets để phòng xóa nhầm.
