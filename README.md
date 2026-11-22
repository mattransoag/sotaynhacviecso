# SỔ TAY NHẮC VIỆC SỐ
**Zalo Bot + Google Apps Script · Không sử dụng AI**

Đây là repository mã nguồn dành cho Dashboard quản trị và mô-đun nhắc việc tự động qua Zalo Bot. GitHub lưu trữ mã nguồn; **Google Apps Script** là nơi thực thi gửi tin và đọc công việc.

## Website GitHub Pages

Đã thêm website tĩnh vào [docs/index.html](docs/index.html) và workflow [GitHub Pages](.github/workflows/pages.yml) ở nhánh `main`.

**Để xuất bản lần đầu**: vào repository → **Settings → Pages → Build and deployment → Source: GitHub Actions**. Sau đó vào **Actions → Publish website to GitHub Pages** kiểm tra kết quả hoặc chọn **Run workflow** nếu cần. Địa chỉ dự kiến sau khi triển khai thành công: `https://mattransoag.github.io/sotaynhacviecso/`.

**Lưu ý:** Repository đang ở chế độ **Private**. Nếu tài khoản không có quyền GitHub Pages dành cho private repository, GitHub có thể yêu cầu nâng cấp gói hoặc chuyển repository sang Public. **Không đổi sang Public nếu chưa rà soát toàn bộ mã nguồn và dữ liệu**, đặc biệt mọi thông tin nhạy cảm.

Website GitHub Pages là frontend tĩnh: có thêm, lọc, đánh dấu hoàn thành, sao lưu JSON, xuất CSV và lưu dữ liệu **cục bộ trên trình duyệt**. Trang web **chưa đồng bộ tự động** dữ liệu Google Sheets và không tự gửi tin nhắn Zalo; Bot Token cần được giữ trong Script Properties của GAS. Không nhập token vào site tĩnh. Để đồng bộ đa thiết bị cần backend có xác thực được triển khai riêng.

## Trạng thái triển khai (22/11/2026)

- ✅ Mã nguồn đã lưu trong nhánh `main` của GitHub.
- ✅ Dashboard GAS đã hiển thị, theo ảnh người dùng cung cấp.
- ✅ Phương thức `getMe` xác thực Bot Token thành công.
- ✅ Dashboard đã đọc được Chat ID từ một cuộc trò chuyện Zalo cá nhân.
- ⚠️ Cần xác nhận `ZALO_CHAT_ID` **đã lưu** trong Script Properties và **tin nhắn thử đã thực sự được nhận**. Không lưu giá trị bí mật vào repository.
- ⏳ Chưa kiểm chứng cấu trúc Google Sheets chứa công việc, chưa xác nhận trigger nhắc việc được bật.
- ⏳ GitHub không tự đẩy mã vào GAS và không chạy lịch nhắc việc.

## Mã nguồn

| Tệp | Vai trò |
|---|---|
| [gas/ZaloReminders.gs](gas/ZaloReminders.gs) | Đọc công việc từ Google Sheets, gửi Zalo Bot, chống gửi trùng, cài lịch 15 phút |
| [dashboard/Dashboard.gs](dashboard/Dashboard.gs) | Xử lý Dashboard phía GAS, quản lý Chat ID và kiểm tra kết nối |
| [dashboard/DashboardUI.html](dashboard/DashboardUI.html) | Giao diện Dashboard quản trị tiếng Việt |
| [dashboard/README.md](dashboard/README.md) | Hướng dẫn cài Dashboard |

**Không dùng** `dashboard/Dashboard.html` cũ: tên gốc trùng với `Dashboard.gs` trong Apps Script. Hãy dùng tệp **DashboardUI.html**.

## Tạo Google Sheets tự động (bản cập nhật mới)

Dự án hiện có tệp [gas/SetupWorkSheet.gs](gas/SetupWorkSheet.gs) để tạo bảng công việc lần đầu, không cần tự nhập Spreadsheet ID.

**Cài trong dự án GAS hiện tại:**
1. Thêm **Tập lệnh** tên `SetupWorkSheet`, dán mã nguồn từ `gas/SetupWorkSheet.gs`.
2. Cập nhật tệp HTML `DashboardUI.html` theo [dashboard/DashboardUI.html](dashboard/DashboardUI.html) mới.
3. Lưu, **Triển khai → Quản lý các lượt triển khai → Chỉnh sửa → Phiên bản mới → Triển khai** (giữ truy cập **Chỉ mình tôi**).
4. Dashboard → **4. Kiểm tra nguồn công việc → Tạo Google Sheets mới**. Cho phép quyền Google Sheets nếu được yêu cầu. Nếu Dashboard không thể xin thêm quyền, chạy `zrCreateTaskSheetOnce` một lần trực tiếp trong trình chỉnh sửa GAS để cấp quyền.
5. Bấm **Mở Google Sheets công việc**, nhập các công việc thật rồi quay lại Dashboard → **Đọc danh sách công việc**.
6. Sau khi **Gửi tin nhắn thử** đã nhận trên Zalo và bảng được đọc đúng, mới chạy `zrInstallTrigger` trong GAS để cài lịch nhắc.

Hàm sẽ tạo bảng mới tên **SỔ TAY NHẮC VIỆC SỐ - DỮ LIỆU CÔNG VIỆC** với tab **CongViec**, có cột: `ID`, `Công việc`, `Hạn hoàn thành`, `Trạng thái`, `Người phụ trách`, `Mức ưu tiên`, `Ghi chú`, `Ngày tạo`, `Ngày hoàn thành`. Ô ngày phải nhập **đúng kiểu ngày giờ** để tránh nhắc sai. Bảng được tạo **trống**, không chứa dữ liệu minh họa hoặc dữ liệu tự nhập từ ứng dụng GAS khác.

Hàm tạo bảng sẽ tự ghi `SPREADSHEET_ID`, `TASK_SHEET_NAME` và `TASK_HEADER_*` vào Script Properties. Nếu `SPREADSHEET_ID` đã có, hàm **không tạo bảng mới**; chỉ trả thông tin bảng hiện có. Không sửa, xóa dữ liệu nguồn.

**Chú ý:** Nếu phần mềm GAS trước đó đã có dữ liệu lưu ở nơi khác, tạo Google Sheets không tự chuyển dữ liệu đó sang. Cần có phương án nhập/chuyển dữ liệu riêng. GitHub chỉ chứa mã nguồn, **chưa tạo Google Sheets trong Drive của bạn** cho tới khi bạn chạy hàm trên GAS.

## Hoàn tất đưa vào vận hành

1. Trong GAS, bảo đảm có ba tệp `ZaloReminders.gs`, `Dashboard.gs`, `DashboardUI.html` và tên HTML được gọi trong `Dashboard.gs` là `DashboardUI`.
2. Giữ duy nhất một hàm `doGet(e)`. Nếu dự án có giao diện ứng dụng khác, tích hợp nhánh `page=dashboard` vào hàm cũ; không ghi đè logic ứng dụng chính.
3. Trong Script Properties, lưu `ZALO_BOT_TOKEN`, `ZR_ADMIN_EMAIL`, `ZALO_CHAT_ID`. **Không commit, sao chép hoặc chia sẻ Bot Token công khai.**
4. Vào Dashboard kiểm tra ô **Chat ID đã lưu** có giá trị, chạy **Gửi tin nhắn thử** và xác nhận tin xuất hiện trên điện thoại.
5. Bấm **Đọc danh sách công việc** để xác nhận đúng dữ liệu và trạng thái. Nếu báo lỗi, xác minh `SPREADSHEET_ID`, `TASK_SHEET_NAME` và tên các cột `TASK_HEADER_ID`, `TASK_HEADER_TITLE`, `TASK_HEADER_DUE`, `TASK_HEADER_STATUS`.
6. **Chỉ sau khi nguồn dữ liệu đúng và tin nhắn thử thành công**, chạy `zrCheckReminders` có giám sát, rồi chạy `zrInstallTrigger` một lần trong trình chỉnh sửa Apps Script.
7. Kiểm tra **Triggers** và **Executions** trong Apps Script để xác nhận lịch chạy 15 phút, xử lý lỗi kịp thời.

## Định dạng bảng mặc định

| ID | Công việc | Hạn hoàn thành | Trạng thái |
|---|---|---|---|
| CV001 | Chuẩn bị báo cáo | 25/11/2026 16:30 | Chưa hoàn thành |
| CV002 | Hoàn tất biên bản | 26/11/2026 08:00 | Hoàn thành |

Đây chỉ là **dữ liệu mẫu**, không phải dữ liệu đọc từ phần mềm hiện có. Nếu bảng thực tế dùng cột khác thì đổi mapping, không tạo sheet mới ghi đè dữ liệu.

## Quy tắc nhắc việc

- Kiểm tra 15 phút/lần theo trigger GAS.
- Nhắc khi còn tối đa 60 phút trước hạn.
- Cảnh báo công việc quá hạn trong 24 giờ đầu.
- Bỏ qua công việc đã hoàn thành, tránh gửi lặp một ID + thời hạn + giai đoạn nhắc.
- Hiện chỉ hỗ trợ một Chat ID nhận thông báo. Phải kiểm tra quyền truy cập dữ liệu trước khi mở rộng nhiều người dùng.

## Bảo mật và giới hạn

- Repository nên giữ **Private**. Dashboard GAS đặt truy cập **Chỉ mình tôi** và `ZR_ADMIN_EMAIL` theo tài khoản quản trị.
- Token chỉ lưu ở Apps Script → Project Settings → Script Properties.
- Chống trùng hiện sử dụng Script Properties; khi số lượng công việc lớn cần cơ sở dữ liệu/bảng lịch sử và cơ chế dọn dẹp.
- Bản nhắc việc hiện phụ thuộc Google Sheets. Nếu ứng dụng sử dụng nguồn lưu trữ khác, phải tích hợp đúng nguồn dữ liệu, chưa thể xác nhận chỉ từ URL `/exec`.
- Không triển khai Dashboard quản trị trực tiếp trên GitHub Pages vì trang tĩnh không thể tự bảo vệ các lệnh GAS và token.
