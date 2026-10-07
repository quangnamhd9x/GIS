// Cấu hình & hàm tiện ích dùng chung cho bản đồ vùng trồng

// Trạng thái sơ chế (vùng vẽ thủ công) -> màu
export const STATUS_COLORS = {
  'Chờ sơ chế': '#f59e0b',
  'Đang sơ chế': '#38bdf8',
  'Đã sơ chế': '#4ade80',
};
export const STATUSES = Object.keys(STATUS_COLORS);
export const statusColor = (status) => STATUS_COLORS[status] ?? '#4ade80';

// Nền bản đồ (không cần API key)
export const BASE_LAYERS = {
  satellite: {
    label: 'Vệ tinh',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Ảnh vệ tinh &copy; Esri',
    maxZoom: 19,
  },
  street: {
    label: 'Bản đồ',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    maxZoom: 19,
  },
};
export const SATELLITE_LAYER = BASE_LAYERS.satellite;

// Tâm mặc định: KD Green Farm, xã Vụ Bổn, Đắk Lắk (tính từ bản đồ VN-2000)
export const DEFAULT_CENTER = [12.643, 108.468];

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

export const formatHa = (ha) => `${(ha ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ha`;
export const formatInt = (n) => (n ?? 0).toLocaleString('vi-VN');
export const formatDate = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');

/** Diện tích hiển thị của một vùng vẽ thủ công: ưu tiên số từ DB, không có thì tự tính */
export const zoneAreaM2 = (zone) =>
  zone.areaHa != null ? zone.areaHa * 10000 : polygonAreaM2(zone.coordinates);

/** Khoảng cách 2 điểm [lat, lng] (m) */
export function distanceM([lat1, lng1], [lat2, lng2]) {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

// ------------------------------------------------------------------ Dữ liệu lô
/** Tuổi cây (tháng) tính từ ngày trồng gần nhất (tái canh nếu có) */
export function lotAgeMonths(lot, today = new Date()) {
  const last = lot.taiCanh?.at(-1)?.ngay ?? lot.ngayTrong;
  if (!last) return null;
  const d = new Date(last);
  return Math.max(0, (today.getFullYear() - d.getFullYear()) * 12 + today.getMonth() - d.getMonth());
}

const AGE_GROUPS = [
  { max: 6, label: 'Dưới 6 tháng', color: '#bef264' },
  { max: 12, label: '6–12 tháng', color: '#4ade80' },
  { max: 24, label: '12–24 tháng', color: '#22d3ee' },
  { max: Infinity, label: 'Trên 24 tháng', color: '#a78bfa' },
];

const PALETTE = ['#a78bfa', '#fb923c', '#38bdf8', '#f472b6', '#facc15', '#4ade80', '#f87171', '#2dd4bf'];

/** Các cách tô màu lô. value(lot) -> nhãn nhóm; color(nhãn) -> màu */
export const COLOR_MODES = {
  cum: {
    label: 'Cụm',
    value: (l) => `Cụm ${l.cum}`,
    // Giữ màu giống bản đồ giấy: Cụm A tím, Cụm B cam
    fixed: { 'Cụm A': '#a78bfa', 'Cụm B': '#fb923c' },
  },
  doi: { label: 'Đội', value: (l) => l.doi },
  giong: { label: 'Giống', value: (l) => l.giong ?? 'Chưa ghi giống' },
  tuoi: {
    label: 'Tuổi cây',
    value: (l) => {
      const m = lotAgeMonths(l);
      return m == null ? 'Chưa rõ' : AGE_GROUPS.find((g) => m < g.max).label;
    },
    fixed: Object.fromEntries([...AGE_GROUPS.map((g) => [g.label, g.color]), ['Chưa rõ', '#9ca3af']]),
    order: [...AGE_GROUPS.map((g) => g.label), 'Chưa rõ'],
  },
  trangThai: {
    label: 'Trạng thái',
    value: (l) => l.trangThai ?? 'Chưa rõ',
    fixed: { 'Đã trồng': '#4ade80', 'Chưa trồng': '#facc15', 'Đã hủy': '#f87171', 'Chưa rõ': '#9ca3af' },
  },
};

/** Danh sách nhóm + màu cho chế độ tô màu hiện tại (dùng cho chú giải) */
export function buildLegend(mode, lots) {
  const m = COLOR_MODES[mode];
  const groups = [...new Set(lots.map(m.value))];
  const order = m.order ?? groups.sort((a, b) => String(a).localeCompare(String(b), 'vi', { numeric: true }));
  return order
    .filter((g) => groups.includes(g))
    .map((g, i) => ({ label: g, color: m.fixed?.[g] ?? PALETTE[i % PALETTE.length] }));
}

/** Chuẩn hóa chuỗi để tìm kiếm không dấu, không phân biệt hoa thường */
export const normalize = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();

/** Tìm lô theo: "54", "lô 54", tên lô cũ "A12", mã lô. Kết quả khớp chính xác xếp trước. */
export function searchLots(lots, query) {
  const q = normalize(query).replace(/^lo\s*/, '');
  if (!q) return [];
  const scored = [];
  for (const l of lots) {
    const num = String(l.lo);
    const old = l.loCu.map(normalize);
    let score = 0;
    if (num === q) score = 100;
    else if (old.includes(q)) score = 90;
    else if (num.startsWith(q)) score = 60;
    else if (old.some((o) => o.startsWith(q))) score = 50;
    else if (normalize(l.maLo).includes(q) || normalize(l.giong).includes(q)) score = 20;
    if (score) scored.push([score, l]);
  }
  return scored.sort((a, b) => b[0] - a[0] || a[1].lo - b[1].lo).map(([, l]) => l);
}

/** Xuất danh sách lô ra CSV (Excel mở được tiếng Việt nhờ BOM) */
export function lotsToCsv(lots) {
  const cols = [
    ['Lô mới', (l) => l.lo], ['Lô cũ', (l) => l.loCu.join(' + ')], ['Cụm', (l) => l.cum], ['Đội', (l) => l.doi],
    ['Nông trường cũ', (l) => l.nongTruong], ['Giống', (l) => l.giong ?? ''], ['Ngày trồng', (l) => formatDate(l.ngayTrong)],
    ['Tuổi (tháng)', (l) => lotAgeMonths(l) ?? ''], ['DT hiện hữu (ha)', (l) => l.dienTichHienHuu],
    ['Số cây hiện hữu', (l) => l.soCayHienHuu], ['Trạng thái', (l) => l.trangThai ?? ''],
    ['Phụ trách', (l) => l.phuTrach ?? ''], ['Vĩ độ', (l) => l.viTri?.[0] ?? ''], ['Kinh độ', (l) => l.viTri?.[1] ?? ''],
  ];
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  return '﻿' + [cols.map((c) => esc(c[0])).join(','), ...lots.map((l) => cols.map((c) => esc(c[1](l))).join(','))].join('\n');
}
