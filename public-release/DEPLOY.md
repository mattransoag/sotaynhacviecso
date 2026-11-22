# Gói website công khai — Sổ tay nhắc việc số

Đây là nguồn website tĩnh đã tách khỏi hệ thống Zalo Bot và Google Apps Script. Nội dung triển khai công khai chỉ cần **index.html**.

## Đưa lên GitHub Pages

1. Tạo repository **Public** mới tên `sotay-web` dưới tài khoản `mattransoag`.
2. Sao chép `public-release/index.html` từ repository Private sang `index.html` ở **thư mục gốc** của repository Public (nhánh `main`).
3. Vào repository Public → Settings → Pages → **Deploy from a branch** → `main` / `/(root)` → Save.
4. Khi Pages hoàn tất xuất bản, website dự kiến tại `https://mattransoag.github.io/sotay-web/`.

## Giới hạn

- Công việc được lưu trong localStorage của trình duyệt, không tự đồng bộ thiết bị khác.
- Có thể sao lưu/nhập JSON và xuất CSV để nhập thủ công vào Google Sheets.
- Không chứa Bot Token, Chat ID, mã xử lý GAS và không có quyền quản trị bot.
- Chỉ chuyển **index.html** sang repository Public, **không sao chép** thư mục `gas`, `dashboard`, `.github` hoặc các dữ liệu khác từ repository Private.
