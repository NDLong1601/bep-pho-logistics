# Bếp Phố

Bước 2 đưa vào bản chơi **Quán Phở 2D** với bốn bàn, ba món và ba vai trò nhân viên. Phiên bản **Logistics 3D** mở từ liên kết cuối trang hoặc `logistics.html`. Hai phiên bản có tiến trình riêng trong trình duyệt.

## Chạy tại máy

Game dùng HTML, CSS và JavaScript, không cần bước build. Khởi chạy từ thư mục repo:

```sh
python -m http.server 8000
```

Mở `http://localhost:8000/` để chơi Quán Phở. Bấm **Mở cửa**, rồi chạm một bàn có nhãn **Xếp khách**. Nhân viên sẽ tự nhận việc. Chạm bàn để giao việc thủ công khi tắt tự làm. Có thể bật **Tự xếp bàn**, nhập thêm nguyên liệu và đào tạo nhân viên giữa các lượt phục vụ.

Chạy bộ kiểm tra logic trên Node.js:

```sh
node --test tests/quan.test.mjs
```

Kịch bản Playwright dùng seed 2026. Dùng một phiên trình duyệt thử riêng vì test đặt lại dữ liệu Quán Phở của phiên đó:

```sh
npx --yes --package @playwright/cli playwright-cli -s=bep-pho-test open http://localhost:8000/
npx --yes --package @playwright/cli playwright-cli -s=bep-pho-test run-code --filename tests/quan.browser.js
```

Luật và dữ liệu nằm ở `quan/game.js`. Cảnh Canvas ở `quan/scene.js`, giao diện ở `quan/app.js` và `quan/style.css`. Phạm vi và kịch bản chơi thử nằm trong [brief bước 2](design/game-brief.md).

## Đưa lên GitHub Pages

Chọn nhánh muốn phát hành và thư mục `/ (root)` trong cấu hình Pages. Trang gốc sẽ mở Quán Phở 2D. Bản Logistics 3D yêu cầu kết nối để tải các thư viện CDN của nó.

### Source Logistics 3D

Dữ liệu phòng, đơn và sự kiện ở `js/config.js`. Khi thêm loại phòng, đăng ký bộ dựng trong `js/builders.js`. Các giới hạn mở rộng bản đồ nằm trong `GAME_CONFIG.gridTiers`; nhiệm vụ theo mốc nằm trong `GAME_CONFIG.contracts`.
