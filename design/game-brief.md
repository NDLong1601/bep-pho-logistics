# Bếp Phố · Quán Phở

Một game quản lý quán phở Việt Nam nhìn chéo từ trên xuống. Người chơi xếp khách và điều phối một ca ngắn. Mục tiêu là nhìn cảnh quán và biết nên xử lý hàng chờ, bếp, quầy ra món hay bàn bẩn.

## Bản chơi bước 2

- Một quán, bốn bàn, ba món có giá và thời gian nấu riêng.
- Cô Ba nấu, Minh ghi món, mang món và dọn bàn. An tính tiền.
- Chạm bàn trống để xếp khách. Có thể bật tự xếp bàn và tùy chọn tự nhận việc của từng nhân viên.
- Nguyên liệu trừ khi bắt đầu nấu. Tiền và lượt phục vụ được ghi khi hóa đơn đã thanh toán.
- Người chơi có thể nhập kho và đào tạo nhân viên. Ca dừng đón khách sau 100 giây hoặc khi người chơi yêu cầu, sau đó phục vụ hết khách và dọn các bàn còn lại.

## Lượt chơi thử

Trong phút đầu, xếp khách ở hai bàn và quan sát một đơn đi đến thanh toán. Thử tắt tự làm của Minh trong lúc bếp đang nấu để thấy món chờ tại quầy, rồi chạm bàn để giao việc. Trên điện thoại, các trạng thái bàn và khu vực chờ cần đọc được ngay trên cảnh quán.

Ca có seed cố định được kiểm tra bằng `node --test tests/quan.test.mjs`. Luồng chơi thật được kiểm tra trên Chromium ở kích thước máy tính và điện thoại.

Trang trí, mở quán, logistics trong vòng chơi mới và mở rộng thực đơn thuộc các bước sau.
