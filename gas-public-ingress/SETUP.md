# Cổng đồng bộ GitHub Pages → Google Sheets → Zalo Bot

**Trạng thái:** Mã nguồn đã có trên GitHub, **chưa cài vào tài khoản Google của bạn**. Cần làm các bước dưới đây để công việc nhập trên GitHub Pages được lưu vào Google Sheets.

## Vì sao phải tạo dự án GAS RIÊNG?

Dashboard Zalo hiện tại dùng quyền **Chỉ mình tôi** và có quyền truy cập token bot. **Không được** chuyển Dashboard đó sang chế độ `Anyone`. Thay vào đó cần một dự án Apps Script mới, chỉ có tệp `Code.gs` của cổng nhận ghi dữ liệu; không sao chép tệp ZaloReminders.gs hoặc TaskApi.gs vào dự án mới. Cổng không trả về danh sách công việc, không có token bot.

## Các bước cài đặt

1. Mở https://script.google.com/home/projects/create (đăng nhập cùng Google account có quyền chỉnh sửa Google Sheets).
2. Đặt tên: `CONG DONG BO SO TAY NHAC VIEC`.
3. Xóa mã mẫu `myFunction` trong `Code.gs`, dán toàn bộ mã tại [Code.gs](Code.gs). Chỉ để duy nhất mã cổng nhận trong dự án mới. **Không cài cùng dự án GAS Zalo hiện có**.
4. Mở **Project Settings → Script Properties** và thêm:
    - `SPREADSHEET_ID`: ID của bảng Sheets đã tạo bằng `SetupWorkSheet.gs`. Lấy ở URL bảng tính, phần giữa `/d/` và `/edit`.
    - `ZR_INGRESS_KEY`: một khóa mới **tối thiểu 32 ký tự ngẫu nhiên**, khác hoàn toàn Bot Token, không đưa vào GitHub. Nên dùng trình tạo mật khẩu của trình quản lý mật khẩu để tạo chuỗi ngẫu nhiên 40–64 ký tự.
5. Nhấn Lưu. Chọn **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy, cho phép quyền truy cập Google Sheets nếu Google yêu cầu.
6. Sao chép URL `https://script.google.com/macros/s/…/exec` của **cổng nhận MỚI**.
7. Trên https://mattransoag.github.io/sotaynhacviecso/ mở mục **Đồng bộ Google Sheets → Zalo**. Dán URL mới vào ô cổng nhận và nhập `ZR_INGRESS_KEY` vào ô khóa. Nhấn **Kết nối đồng bộ**.
8. Tạo một công việc thử, chờ thông báo **GAS đã xác nhận lưu vào Google Sheets**, rồi mở bảng tính `CongViec` để kiểm tra dòng mới. Nếu chỉ báo “chưa xác nhận lưu”, hãy kiểm tra trình duyệt, cấu hình, và mục Executions trong dự án GAS cổng.
9. Nếu đã có công việc lưu cục bộ từ trước, dùng nút **Gửi toàn bộ công việc đang có** một lần. ID giống nhau được cập nhật thay vì tạo dòng mới, nhưng nên sao lưu JSON trước.
10. Quay lại dự án GAS Zalo (riêng tư), xác nhận `ZALO_CHAT_ID`, thử `zrSendTest`, thử `zrCheckReminders`; chỉ sau đó mới chạy `zrInstallTrigger` để kích hoạt lịch 15 phút/lần.

**Lưu ý:** Trang Pages dùng cổng gửi dữ liệu theo một chiều, không tự tải các thay đổi thực hiện trực tiếp trong GAS/Sheets về trang Pages. Bạn nên quản lý công việc chủ yếu từ một nơi để tránh xung đột. Nội dung nhập trên web vẫn lưu trong trình duyệt, có thể sao lưu ra JSON.

## Khi website báo “Đang gửi yêu cầu tới Google Sheets…” quá lâu

1. Mở **dự án GAS cổng đồng bộ riêng** → **Lượt thực thi (Executions)**, kiểm tra có hàm `doPost` chạy vào thời điểm vừa nhấn gửi không.
2. Nếu không có `doPost`, kiểm tra URL `/exec`, quyền Web App `Anyone`, cửa sổ trình duyệt và các tiện ích chặn nội dung.
3. Nếu `doPost` chạy nhưng website vẫn không hiện xác nhận, cập nhật lại [Code.gs](Code.gs) từ GitHub. Bản mới có `setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)` cho trang xác nhận ngắn. Sau đó chọn **Triển khai → Quản lý lượt triển khai → Chỉnh sửa → Phiên bản mới → Triển khai**.
4. Nếu `doPost` thất bại, kiểm tra thuộc tính `SPREADSHEET_ID`, `ZR_INGRESS_KEY` và quyền truy cập Sheets (không chia sẻ khóa bí mật).
5. Kiểm tra trực tiếp tab `CongViec`. Nếu công việc đã tồn tại, không cần tạo lại công việc thử; chỉ xử lý trường hợp website chưa nhận xác nhận.

Lưu ý: Khóa đồng bộ đã nhập không có nghĩa là API đã xác thực xong; cần một thao tác thực tế và kết quả lưu trong Sheets. Khi gửi theo iframe bị giới hạn bởi trình duyệt, hệ thống có thể không nhận được xác nhận dù Sheets đã được ghi.

## Bảo mật

- Website GitHub Pages là công khai; **không viết ZR_INGRESS_KEY hoặc Bot Token vào mã nguồn**.
- `ZR_INGRESS_KEY` chỉ nhập lúc kết nối, giữ trong bộ nhớ tab và không tự lưu vào localStorage. Sau khi tải lại trang, nhập lại khóa.
- URL cổng (không phải khóa) được lưu cục bộ trong trình duyệt. Nếu truy cập bằng máy dùng chung, không nhập thông tin nhạy cảm.
- Tất cả yêu cầu ghi phải có khóa mạnh và dùng HTTPS. Đường dẫn chỉ nhận `POST`, `doGet` không đọc dữ liệu hay cung cấp bí mật.
- Cổng dùng ID ổn định để tránh ghi trùng khi gửi lại; các thao tác được đưa vào hàng đợi ở trình duyệt. **Chỉ coi là gửi thành công khi GAS đã phản hồi xác nhận.**
- Nếu bạn cần nhiều tài khoản người dùng, chia quyền theo người, nhật ký thay đổi và đồng bộ hai chiều, cần nâng cấp lên xác thực OAuth/OIDC và API phù hợp; khóa chia sẻ này dành cho **một người quản trị cá nhân**.

## Sơ đồ

`GitHub Pages (nhập việc) → GAS cổng ghi riêng (khóa mạnh) → Google Sheets CongViec → GAS Zalo Bot (trigger 15 phút) → Zalo cá nhân`

**Giới hạn:** Google Apps Script có thể bị trình duyệt chặn trong iframe bởi chính sách cookie hoặc bảo mật. Khi không nhận được thông báo xác nhận, công việc vẫn ở hàng đợi để gửi lại; không được mặc định xem là đã lưu hay đã được Zalo nhắc. Bản mã này chưa được kiểm chứng end-to-end trên tài khoản của bạn.
