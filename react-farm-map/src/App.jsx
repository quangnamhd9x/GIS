import { useState } from 'react';
import { AdminDrawMap, ViewerMap, saveZone } from './components/FarmMap';

const TABS = [
  { id: 'viewer', label: 'Hiển thị phân khu' },
  { id: 'admin', label: 'Vẽ vùng (Admin)' },
];

// Trang demo: 2 tab Viewer / Admin. Trong Dashboard thật, đặt mỗi component vào route riêng.
export default function App() {
  const [tab, setTab] = useState('viewer');
  const [refreshKey, setRefreshKey] = useState(0);

  // Lưu xong thì Viewer tải lại dữ liệu ở lần mở sau
  const handleSave = async (zone) => {
    const saved = await saveZone(zone);
    setRefreshKey((k) => k + 1);
    return saved;
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 text-emerald-50">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Bản đồ vùng trồng KD Green Farm</h1>
          <p className="text-sm text-emerald-100/60">Xã Vụ Bổn, Đắk Lắk · Ảnh vệ tinh Esri</p>
        </div>
        <div className="flex rounded-lg bg-[#042918] p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
                tab === t.id ? 'bg-[#164E33] text-white' : 'text-emerald-100/60 hover:text-emerald-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'viewer' ? <ViewerMap refreshKey={refreshKey} /> : <AdminDrawMap onSave={handleSave} />}
    </main>
  );
}
