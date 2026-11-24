# Bếp Phố Logistics — Game Quản Lý Nhà Hàng & Giao Nhận 3D Isometric

Game quản lý nhà hàng kết hợp logistics phong cách mô hình 3D Isometric nhẹ nhàng, xây dựng bằng **HTML5 + Three.js + Tailwind CSS**, không cần bước build (chạy trực tiếp trên **GitHub Pages**).

## Cấu trúc mã nguồn

```text
bep-pho-logistics/
├── index.html          # Trang chính của game
├── .nojekyll           # Tắt Jekyll khi deploy GitHub Pages
├── css/
│   ├── style.css       # Giao diện HUD, hiệu ứng kính mờ, responsive
│   └── tailwind.css    # Tailwind đã biên dịch sẵn (không tải từ CDN)
├── vendor/
│   └── three.min.js    # Three.js r128 (bản cục bộ, game chạy không cần mạng)
└── js/
    ├── config.js       # GAME_CONFIG: thông số phòng, lưới đất, đơn hàng
    ├── audio.js        # Âm thanh tổng hợp bằng Web Audio API
    ├── state.js        # Trạng thái game, lưu/tải LocalStorage
    ├── textures.js     # Vân sàn gỗ/gạch/bê tông & tranh tường tạo tự động
    ├── scene.js        # Camera 3D Isometric, ánh sáng, đổ bóng, lưới đất
    ├── builders.js     # Dựng mô hình 3D nội thất & nhân vật cho từng phòng
    ├── customers.js    # Khách thật: xếp hàng, ngồi bàn, ăn, trả tiền; nồi nước dùng & bồn rửa
    ├── staff.js        # Nhân viên có tên & tính cách, ngủ gật, người rửa bát
    ├── dishes.js       # Món ăn: giá, thời gian chuẩn bị, nâng sao, công thức từ khách quen
    ├── decor.js        # Trang trí, 3 điểm Không gian/Phục vụ/Món ăn và hạng quán
    ├── menu.js         # Nút Menu duy nhất: tab Công trình và Nhân viên
    ├── simulation.js   # Vòng lặp sản xuất, di chuyển nhân vật, hiệu ứng
    ├── ui.js           # Thanh tài nguyên, đơn hàng, bảng nâng cấp/xây mới
    └── main.js         # Điều khiển chuột/cảm ứng/phím tắt và khởi chạy
```

## Hướng dẫn Deploy lên GitHub Pages

1. Tạo repository mới trên GitHub (ví dụ: `bep-pho-logistics`).
2. Giải nén toàn bộ thư mục này và đẩy các tệp (`index.html`, `.nojekyll`, `css/`, `js/`) lên nhánh `main`.
3. Vào **Settings → Pages → Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` / `/ (root)` → nhấn **Save**.
4. Chờ khoảng 1 phút để truy cập game tại `https://<username>.github.io/bep-pho-logistics/`.

## Vòng chơi nhà hàng

- Khách đi từ phố vào **Phòng Ăn**, xếp hàng (có thanh kiên nhẫn), ngồi vào ghế trống, chờ món từ quầy bếp, ăn rồi trả tiền và để lại một bát bẩn. Chờ quá lâu thì khách bỏ về và quán mất 1 Uy tín.
- Số ghế theo cấp Phòng Ăn (Lv.1: 4 ghế, Lv.2: 6, Lv.4: 8). Uy tín càng cao khách đến càng đông.
- **Bếp** cần nước dùng: mỗi bát dùng 1 phần từ nồi. Hết nồi thì nhân viên tự ninh nồi mới (tốn Kho, mất vài giây); có thể ninh sớm trong bảng Bếp.
- **Bồn rửa** đầy bát bẩn thì bếp dừng. Nhân viên bếp rửa chậm; nhấn bong bóng 🧽 trên Bếp để rửa nhanh.
- **Nhân viên** mỗi người có tên và một tính cách (Chăm chỉ, Nhanh nhẹn, Chu đáo, Hay ngủ gật). Bồi bàn ở Phòng Ăn tự lấy bát ở quầy và bưng ra tận bàn. Người hay ngủ gật thỉnh thoảng gục xuống: nhấn bong bóng 💤 trên phòng để đánh thức.
- **Người rửa bát** thuê riêng trong bảng Bếp (tối đa 2 mỗi bếp), rửa bát bẩn liên tục.
- **Kho nguyên liệu** có sức chứa; kho đầy thì Kho Nguyên Liệu tạm ngừng nhập.
- **Món ăn** (nút 📖 Món ăn): khách gọi một món chính, đôi khi kèm trà đá hoặc quẩy, và trả đúng giá món. Mỗi món nâng được từ 1 đến 5 sao (+20% giá mỗi sao, được gọi nhiều hơn). Phục vụ đủ số khách thì một khách quen kể công thức món mới (Quẩy, Phở gà, Phở nạm gầu, Phở cuốn, Phở đặc biệt).
- **Trang trí & Hạng quán** (bấm ô hạng quán trên thanh trên cùng): mua đồ trang trí cho vỉa hè, sảnh ăn và bếp (ghế nhựa, cây, biển hiệu, khay gia vị, quạt trần, tranh phố cổ, đèn lồng, kệ bát, nồi lớn, máy hút mùi). Mỗi món có hiệu ứng riêng và hiện ra trong cảnh 3D. Điểm Không gian, Phục vụ và Món ăn cộng lại thành hạng quán, từ Gánh hàng rong đến Chuỗi phở. Hạng cao thì khách đến nhiều hơn, giá bán cao hơn và thu nhập offline được giữ lâu hơn (3 đến 12 giờ).
- Thông số nằm ở `GAME_CONFIG.restaurant`, `GAME_CONFIG.staff`, `GAME_CONFIG.dishes` và `GAME_CONFIG.dishStars` trong `js/config.js`.

## Hướng dẫn Mở rộng Game

- **Thêm loại phòng mới:**
  1. Thêm 1 mục mới vào `GAME_CONFIG.rooms` trong `js/config.js` (tên, giá, đầu vào `requires`, hàm sản xuất `produce`, màu sàn/tường).
  2. Thêm hàm dựng nội thất 3D tương ứng vào `ROOM_BUILDERS` trong `js/builders.js`.
- **Mở rộng bản đồ đất:** Tăng `GRID_COLS` và `GRID_ROWS` trong `js/config.js` (mặc định `4 x 4 = 16` ô).
- **Thêm đơn hàng / nhiệm vụ:** Thêm phần tử mới vào mảng `GAME_CONFIG.contracts` trong `js/config.js`.

## Thư viện cục bộ

Game không tải thư viện từ CDN nữa. Three.js nằm ở `vendor/three.min.js`, Tailwind được biên dịch sẵn vào `css/tailwind.css`, và font Baloo 2 (giấy phép SIL OFL) nằm ở `vendor/fonts/`.

Khi thêm class Tailwind mới vào `index.html` hoặc `js/`, biên dịch lại CSS (cần Node.js):

```bash
npx tailwindcss@3.4.17 --content "./index.html,./js/**/*.js" -o css/tailwind.css --minify
```

## Phong cách hình ảnh

Game theo hướng "3D hoạt hình ấm":

- Mọi vật thể dùng `toonMat()` trong `js/scene.js` (đổ bóng kiểu hoạt hình 3 bậc) và có viền mực nâu bằng `addOutline()`.
- Bảng màu được làm ấm và đậm hơn qua `artColor()`; chỉnh độ đậm và viền ở hằng `ART` trong cùng file.
- Nhân vật chibi (`createMiniCharacter`) có đầu to, mắt, má hồng, tóc, mũ đầu bếp hoặc băng đô phục vụ.
- Giao diện dùng viền đậm, nền giấy kem và nút nổi bấm lún. Toàn bộ nằm ở phần "CARTOON UI THEME" cuối `css/style.css`.

## Phiên bản file lưu

`GAME_CONFIG.SAVE_VERSION` (trong `js/config.js`) ghi phiên bản của file lưu. Khi đổi cấu trúc lưu hoặc kinh tế, tăng số này và thêm một bước chuyển đổi vào `SAVE_MIGRATIONS` trong `js/state.js` để bản lưu cũ vẫn chơi tiếp được.

## Quán Phở 2D

Mở `quan-pho.html` hoặc chọn **Menu → Cài đặt → Thử Quán Phở 2D** trong Bếp Phố Logistics. Bản thử 2D có một quán, bốn bàn, ba món và tiến trình lưu riêng.

Chạy `python -m http.server 8000` từ thư mục repo, rồi mở `http://localhost:8000/quan-pho.html`. Kiểm tra logic bằng `node --test tests/quan.test.mjs`.

Để chạy kịch bản trình duyệt với seed cố định, dùng một phiên Playwright riêng vì test đặt lại bản lưu 2D trong phiên đó:

```sh
npx --yes --package @playwright/cli playwright-cli -s=bep-pho-test open http://localhost:8000/quan-pho.html
npx --yes --package @playwright/cli playwright-cli -s=bep-pho-test run-code --filename tests/quan.browser.js
```

Xem [brief Quán Phở 2D](design/game-brief.md) để biết phạm vi bản thử.
