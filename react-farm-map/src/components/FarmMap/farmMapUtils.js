// Cấu hình & hàm tiện ích dùng chung cho bản đồ vùng trồng

// Trạng thái sơ chế -> màu vùng trên bản đồ
export const STATUS_COLORS = {
  'Chờ sơ chế': '#f59e0b',
  'Đang sơ chế': '#38bdf8',
  'Đã sơ chế': '#4ade80',
};
export const STATUSES = Object.keys(STATUS_COLORS);
export const statusColor = (status) => STATUS_COLORS[status] ?? '#4ade80';

// Ảnh vệ tinh Esri World Imagery (không cần API key)
export const SATELLITE_LAYER = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Ảnh vệ tinh &copy; Esri',
  maxZoom: 19,
};

// Tâm mặc định: KD Green Farm, xã Vụ Bổn, Đắk Lắk
export const DEFAULT_CENTER = [12.7234, 108.3456];

/** Diện tích đa giác trên mặt cầu (m²). coords = [[lat, lng], ...] */
export function polygonAreaM2(coords) {
  const R = 6378137;
  const rad = Math.PI / 180;
  let sum = 0;
  for (let i = 0; i < coords.length; i++) {
    const [lat1, lng1] = coords[i];
    const [lat2, lng2] = coords[(i + 1) % coords.length];
    sum += (lng2 - lng1) * rad * (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
  }
  return Math.abs((sum * R * R) / 2);
}

export const formatArea = (m2) =>
  m2 >= 10000
    ? `${(m2 / 10000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ha`
    : `${Math.round(m2).toLocaleString('vi-VN')} m²`;

/** Diện tích hiển thị của một phân khu: ưu tiên số từ DB, không có thì tự tính */
export const zoneAreaM2 = (zone) =>
  zone.areaHa != null ? zone.areaHa * 10000 : polygonAreaM2(zone.coordinates);
