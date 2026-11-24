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
- Thông số nằm ở `GAME_CONFIG.restaurant` trong `js/config.js`.

## Hướng dẫn Mở rộng Game

- **Thêm loại phòng mới:**
  1. Thêm 1 mục mới vào `GAME_CONFIG.rooms` trong `js/config.js` (tên, giá, đầu vào `requires`, hàm sản xuất `produce`, màu sàn/tường).
  2. Thêm hàm dựng nội thất 3D tương ứng vào `ROOM_BUILDERS` trong `js/builders.js`.
- **Mở rộng bản đồ đất:** Tăng `GRID_COLS` và `GRID_ROWS` trong `js/config.js` (mặc định `4 x 4 = 16` ô).
- **Thêm đơn hàng / nhiệm vụ:** Thêm phần tử mới vào mảng `GAME_CONFIG.contracts` trong `js/config.js`.

## Thư viện cục bộ

Game không tải thư viện từ CDN nữa. Three.js nằm ở `vendor/three.min.js` và Tailwind được biên dịch sẵn vào `css/tailwind.css`.

Khi thêm class Tailwind mới vào `index.html` hoặc `js/`, biên dịch lại CSS (cần Node.js):

```bash
npx tailwindcss@3.4.17 --content "./index.html,./js/**/*.js" -o css/tailwind.css --minify
```

## Phiên bản file lưu

`GAME_CONFIG.SAVE_VERSION` (trong `js/config.js`) ghi phiên bản của file lưu. Khi đổi cấu trúc lưu hoặc kinh tế, tăng số này và thêm một bước chuyển đổi vào `SAVE_MIGRATIONS` trong `js/state.js` để bản lưu cũ vẫn chơi tiếp được.
