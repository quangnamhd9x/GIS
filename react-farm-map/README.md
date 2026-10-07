# Bản đồ vùng trồng KD Green Farm (React + Vite + Leaflet)

## Chạy thử

```bash
npm install
npm run dev        # mở http://localhost:5173
```

Khi chạy `npm run dev` có sẵn API giả lập `/api/zones` (file `mock/zones.json`, lưu trong RAM).
Nối backend thật: đặt `VITE_API_URL` trong `.env` (xem `.env.example`) và xóa plugin `mockZonesApi` trong `vite.config.js`.

## Tính năng

**Màn hình Bản đồ lô** (`ViewerMap`)
- Tìm lô: gõ số lô mới (`54`), lô cũ (`A12`), mã lô hoặc giống. Bấm Enter để bay tới lô.
- Lọc theo Cụm, Đội, Giống. Ô tổng hợp phía trên cập nhật theo bộ lọc: số lô, diện tích, số cây.
- Tô màu theo Cụm, Đội, Giống, Tuổi cây hoặc Trạng thái.
- Bấm vào lô để xem thẻ chi tiết: giống, ngày trồng, tuổi cây, diện tích, số cây, mật độ thực tế, tỷ lệ cây còn, tái canh, người phụ trách. Thẻ có 3 nút:
  - **Chỉ đường**: mở Google Maps dẫn đường tới lô.
  - **Chép tọa độ**.
  - **Chia sẻ**: chép link dạng `?lo=54`. Mở link là vào thẳng lô đó.
- **Vị trí của tôi**: cho biết người dùng đang đứng ở lô nào, hoặc lô gần nhất cách bao xa.
- Lớp bản đồ: Lô, Vùng vẽ thủ công, Kế hoạch 2026 (thu hồi GĐ1/2/3, cao su, trại heo, cao tốc). Đổi nền giữa Vệ tinh và Bản đồ.
- Xuất danh sách đang lọc ra CSV, mở được bằng Excel.
- Mục Cảnh báo dữ liệu: liệt kê lô thiếu giống, lô gộp, số lô bị thiếu…

**Màn hình Vẽ vùng (Admin)** (`AdminDrawMap`)
- Chọn lô cần vẽ: bản đồ bay tới lô đó, các lô khác hiện mờ làm nền.
- Click để chấm ranh giới. Diện tích tự tính và so với diện tích trong Excel. Lệch trên 15% thì chữ chuyển màu cam.
- Bấm Lưu để gửi `POST /zones` với dữ liệu `{ lo, batchCode, status, areaHa, coordinates }`.

## Cập nhật dữ liệu lô

Dữ liệu trong `public/data/` được sinh từ file gốc của nông trường bằng script Python:

```bash
pip install openpyxl pymupdf shapely pyproj
python tools/build_farm_data.py \
  --excel "30.09.2026_KDGF_Định danh vườn cây.xlsx" \
  --lots  "Bản đồ thể hiện cụm A,B và tên lô mới.pdf" \
  --plan  "Bản đồ dự kiến bàn giao KD 3 giai đoạn năm 2026.pdf" \
  --out react-farm-map/public/data --js data/lots.js
```

Script tạo ra các file sau:

| File | Nội dung |
| --- | --- |
| `lots.geojson` | Mỗi lô một bản ghi. Polygon nếu ranh giới trên PDF khớp diện tích Excel (±20%). Ngược lại chỉ có điểm tâm lô. |
| `plan-2026.geojson` | Các vùng của bản đồ bàn giao 2026. |
| `data-report.json` | Tổng hợp số liệu và danh sách cảnh báo. |
| `data/lots.js` | Bản rút gọn cho trang `index.html` tĩnh. |

**Về độ chính xác:**
- Tọa độ được quy đổi từ lưới VN-2000 trên khung bản đồ (kinh tuyến trục 108°30').
- Hai bản đồ PDF được quy đổi độc lập và khớp nhau khoảng 20 m, nhưng chưa được đối chiếu với điểm GPS ngoài thực địa.
- Khi có file gốc (Shapefile, DWG hoặc QGIS) của bộ phận GIS, nên thay phần đọc PDF để có ranh giới chính xác.
