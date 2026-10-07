// Gọi API & tải dữ liệu bản đồ. Đổi VITE_API_URL trong file .env cho khớp backend.
// Định dạng một vùng vẽ thủ công:
// { id, lo?, batchCode, status, areaHa, coordinates: [[lat, lng], ...] }

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';
// Dữ liệu lô dựng từ Excel + PDF bằng tools/build_farm_data.py, nằm trong public/data
const DATA_URL = `${import.meta.env.BASE_URL}data`;

async function request(url, options) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(`Máy chủ trả lỗi ${res.status}`);
  return res.json();
}

/** Lấy danh sách vùng vẽ thủ công */
export const fetchZones = (signal) => request(`${BASE_URL}/zones`, { signal });

/** Lưu một vùng mới vẽ */
export const saveZone = (zone) =>
  request(`${BASE_URL}/zones`, { method: 'POST', body: JSON.stringify(zone) });

/** Tải lô (GeoJSON), lớp kế hoạch 2026 và báo cáo dữ liệu */
export async function fetchFarmData(signal) {
  const [lots, plan, report] = await Promise.all([
    request(`${DATA_URL}/lots.geojson`, { signal }),
    request(`${DATA_URL}/plan-2026.geojson`, { signal }).catch(() => null),
    request(`${DATA_URL}/data-report.json`, { signal }).catch(() => null),
  ]);
  return { lots, plan, report };
}
