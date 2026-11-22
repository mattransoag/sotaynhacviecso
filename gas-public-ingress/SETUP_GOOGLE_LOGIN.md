# Nâng cấp đăng nhập Google — không cần nhập khóa kết nối dài

**Trạng thái:** Mã trên GitHub đã nâng cấp, **chưa tự cài vào dự án GAS của bạn**. Đây là cổng **ghi dữ liệu một chiều**, dùng riêng với GitHub Pages, không thay thế GAS Zalo Bot.

## 1. Tạo Google OAuth Client ID (không phải Client Secret)

1. Mở [Google Cloud Console](https://console.cloud.google.com/apis/credentials), chọn hoặc tạo một Google Cloud project thuộc tài khoản của bạn.
2. Trong **Google Auth Platform**, hoàn thiện Branding / OAuth consent screen nếu Google yêu cầu. Nếu ứng dụng để chế độ **Testing**, thêm chính email Google của bạn vào **Test users**.
3. Vào **Clients → Create client → Web application** (hoặc **APIs & Services → Credentials → Create credentials → OAuth client ID**).
4. Ở **Authorized JavaScript origins**, thêm **chính xác**: `https://mattransoag.github.io` (không thêm đường dẫn `/sotaynhacviecso/`).
5. Lưu, sao chép **Client ID** dạng `123456789-xxxx.apps.googleusercontent.com`. Đây là mã định danh công khai; không sử dụng hoặc đăng Client Secret.
6. Nếu Google yêu cầu Authorized domains, làm theo quy trình chính thức trong Cloud Console. GitHub Pages sử dụng miền `github.io`, không phải miền do cá nhân bạn sở hữu; cần tuân theo quy định của Google về miền được phép.

Tham khảo [Google Identity Services: Client ID](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) và [Google Identity Services: JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference).

## 2. Cài mã GAS mới vào DỰ ÁN CỔNG ĐỒNG BỘ RIÊNG

**Chỉ thay dự án `CONG DONG BO SO TAY NHAC VIEC`. Không thay dự án Zalo Bot chứa `ZaloReminders.gs`.**

1. Mở dự án GAS cổng đồng bộ.
2. Sao chép **toàn bộ** [Code.gs](Code.gs) phiên bản Google Login vào `Code.gs`, thay bản nhận `ZR_INGRESS_KEY` cũ.
3. Trong **Project Settings → Script Properties**, thêm:

| Tên thuộc tính | Giá trị |
|---|---|
| `SPREADSHEET_ID` | ID bảng Google Sheets `CongViec` đang hoạt động |
| `ZR_OAUTH_CLIENT_ID` | Client ID vừa tạo ở Google Cloud |
| `ZR_ALLOWED_EMAIL` | Email Gmail/Workspace **của chính bạn** được phép ghi công việc |
| `ZR_ALLOWED_SUB` | Tùy chọn: Google subject ID cố định của bạn, ưu tiên hơn email khi có |

**Lưu ý:** `ZR_ALLOWED_SUB` an toàn hơn email và đặc biệt nên dùng nếu email không phải Gmail/Workspace. Không tự đoán hoặc điền Bot ID / Zalo Chat ID vào trường này. Với tài khoản Gmail cá nhân, có thể để trống `ZR_ALLOWED_SUB` và dùng `ZR_ALLOWED_EMAIL`.

4. **Xóa thuộc tính `ZR_INGRESS_KEY` cũ sau khi đã chuyển sang Google Login**, vì bản mới không cần khóa đó.
5. Chọn **Triển khai → Quản lý các lượt triển khai → Chỉnh sửa → Phiên bản mới → Triển khai**. Giữ nguyên `Execute as: Me`, `Who has access: Anyone` **chỉ cho dự án cổng ghi**.
6. Kiểm tra và vô hiệu hóa các lượt triển khai GAS cổng cũ không sử dụng để tránh endpoint nhận khóa cũ vẫn hoạt động. GAS quản trị Zalo vẫn là **Only myself**.

## 3. Kết nối website GitHub Pages

1. Mở https://mattransoag.github.io/sotaynhacviecso/ và tải lại **Ctrl + F5** để có giao diện mới.
2. Kéo xuống **Đăng nhập Google · Đồng bộ Google Sheets → Zalo**.
3. URL cổng GAS đã được điền sẵn (kiểm tra là URL cổng `/exec` của dự án riêng).
4. Dán **Google OAuth Client ID** vào ô tương ứng (chỉ một lần trên thiết bị này; đây không phải Client Secret).
5. Nhấn **Thiết lập đăng nhập Google**, sau đó nhấn nút **Sign in with Google / Đăng nhập bằng Google** vừa xuất hiện.
6. Chọn đúng tài khoản trong `ZR_ALLOWED_EMAIL`. ID token chỉ được giữ trong bộ nhớ tab, không lưu vào localStorage. Sau khi hết hạn token, đăng nhập lại bằng nút Google; không phải nhập khóa dài.
7. Tạo công việc thử trên website hoặc nhấn **Gửi lại thao tác chờ**. Đợi **“GAS đã xác nhận lưu vào Google Sheets”**. Mở bảng `CongViec` để kiểm tra.
8. Sau khi xác nhận Sheets, kiểm tra trigger `zrCheckReminders` ở dự án GAS Zalo Bot đã bật và thử một công việc sắp đến hạn.

## 4. Lưu ý quan trọng

- Không có cách đăng nhập Google an toàn nào chỉ bằng cách đặt một email vào mã JavaScript công khai rồi coi đó là xác thực. Cổng GAS phải xác thực ID token ở phía máy chủ và kiểm tra `aud`, `iss`, `exp`, `email_verified`, `sub/email`.
- Mẫu GAS này sử dụng Google `tokeninfo` cho mức sử dụng cá nhân/lưu lượng thấp. Google nêu đây là endpoint phục vụ phát triển và chẩn đoán; với hệ thống dùng nhiều người hoặc yêu cầu bảo mật cao, nên dùng backend có thư viện xác thực JWT chính thức và quản lý phiên phía máy chủ, thay vì phụ thuộc tokeninfo.
- Website **không lưu mã ID token lâu dài**; chỉ lưu `Client ID` công khai và URL cổng GAS ở localStorage. Không bao giờ thêm Bot Token, Client Secret hoặc khóa bí mật vào GitHub.
- Đồng bộ hiện tại **một chiều** từ website sang Google Sheets; phần GAS Zalo nhắc việc vẫn dựa trên Sheets và trigger.
- Nếu sử dụng máy tính dùng chung, không nhập dữ liệu nhạy cảm và nên đăng xuất Google khi hoàn tất.
- Nếu trang báo lỗi khi đăng nhập Google, kiểm tra **Authorized JavaScript origins**, OAuth Consent Screen/Test users và các tiện ích chặn popup/cookie.
- Nếu trang báo không nhận được xác nhận lưu, mở **Executions** của dự án GAS cổng, tìm `doPost` và xem bảng Sheets có bản ghi chưa. Không gửi ID token hoặc ảnh có token cho người khác.

## 5. Cấu trúc và trạng thái

`GitHub Pages → Sign in with Google → GAS cổng ghi (xác minh token) → Google Sheets CongViec → GAS Zalo Bot (trigger) → Zalo cá nhân`

**Mã đã cập nhật trên GitHub. Chưa xác nhận chạy end-to-end bằng tài khoản Google của bạn vì OAuth Client ID và cấu hình GAS còn cần bạn thực hiện.**
