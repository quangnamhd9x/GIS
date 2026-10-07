// Gọi API phân khu vùng trồng. Đổi VITE_API_URL trong file .env cho khớp backend.
// Định dạng một phân khu:
// { id, batchCode, status, areaHa, coordinates: [[lat, lng], ...] }

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

async function request(path, options) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`Máy chủ trả lỗi ${res.status}`);
  return res.json();
}

/** Lấy danh sách phân khu để vẽ lên bản đồ */
export const fetchZones = (signal) => request('/zones', { signal });

/** Lưu một phân khu mới vẽ */
export const saveZone = (zone) =>
  request('/zones', { method: 'POST', body: JSON.stringify(zone) });
