# Bếp Phố Logistics — Game Quản Lý Nhà Hàng & Giao Nhận 3D Isometric

Game quản lý nhà hàng kết hợp logistics phong cách mô hình 3D Isometric nhẹ nhàng, xây dựng bằng **HTML5 + Three.js + Tailwind CSS**, không cần bước build (chạy trực tiếp trên **GitHub Pages**).

## Cấu trúc mã nguồn

```text
bep-pho-logistics/
├── index.html          # Trang chính của game
├── .nojekyll           # Tắt Jekyll khi deploy GitHub Pages
├── css/
│   └── style.css       # Giao diện HUD, hiệu ứng kính mờ, responsive
└── js/
    ├── config.js       # GAME_CONFIG: thông số phòng, lưới đất, đơn hàng
    ├── audio.js        # Âm thanh tổng hợp bằng Web Audio API
    ├── state.js        # Trạng thái game, lưu/tải LocalStorage
    ├── textures.js     # Vân sàn gỗ/gạch/bê tông & tranh tường tạo tự động
    ├── scene.js        # Camera 3D Isometric, ánh sáng, đổ bóng, lưới đất
    ├── builders.js     # Dựng mô hình 3D nội thất & nhân vật cho từng phòng
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

## Hướng dẫn Mở rộng Game

- **Thêm loại phòng mới:**
  1. Thêm 1 mục mới vào `GAME_CONFIG.rooms` trong `js/config.js` (tên, giá, đầu vào `requires`, hàm sản xuất `produce`, màu sàn/tường).
  2. Thêm hàm dựng nội thất 3D tương ứng vào `ROOM_BUILDERS` trong `js/builders.js`.
- **Mở rộng bản đồ đất:** Tăng `GRID_COLS` và `GRID_ROWS` trong `js/config.js` (mặc định `4 x 4 = 16` ô).
- **Thêm đơn hàng / nhiệm vụ:** Thêm phần tử mới vào mảng `GAME_CONFIG.contracts` trong `js/config.js`.
