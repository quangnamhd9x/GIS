import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import { fetchZones as defaultFetchZones } from './farmMapApi';
import {
  BASE_LAYERS, COLOR_MODES, DEFAULT_CENTER, buildLegend, distanceM, formatArea, formatHa, formatInt,
  lotsToCsv, searchLots, statusColor, zoneAreaM2,
} from './farmMapUtils';
import useFarmData from './useFarmData';
import { FitToLots, FlyToLot, LotLayer, PLAN_STYLE, PlanLayer, lotContains } from './mapLayers';
import LotDetail from './LotDetail';
import './farmMap.css';

const chip = (on) =>
  `rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
    on ? 'border-emerald-400 bg-[#164E33] text-white' : 'border-[#164E33] text-emerald-100/70 hover:text-emerald-50'
  }`;
const iconBtn = 'rounded-md border border-[#164E33] bg-[#131411]/90 px-3 py-2 text-xs font-semibold text-emerald-50 shadow-lg backdrop-blur hover:bg-[#164E33]';

const toggle = (set, v) => {
  const next = new Set(set);
  next.has(v) ? next.delete(v) : next.add(v);
  return next;
};

/** Bay tới vị trí người dùng khi có */
function FlyToUser({ pos }) {
  const map = useMap();
  useEffect(() => { if (pos) map.flyTo(pos, 17, { duration: 0.6 }); }, [map, pos]);
  return null;
}

/**
 * Màn hình Viewer: bản đồ lô KDGF + tìm kiếm, lọc, tô màu, chi tiết lô.
 * @param fetchZones  hàm (signal) => Promise<zone[]> lấy vùng vẽ thủ công (mặc định GET /zones)
 * @param refreshKey  đổi giá trị để tải lại vùng vẽ (VD sau khi Admin lưu)
 */
export default function ViewerMap({ fetchZones = defaultFetchZones, refreshKey, className = '' }) {
  const { status, lots, plan, report, error } = useFarmData();

  // ---- Bộ lọc & hiển thị
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [cum, setCum] = useState(new Set());
  const [doi, setDoi] = useState(new Set());
  const [giong, setGiong] = useState('');
  const [colorMode, setColorMode] = useState('cum');
  // Mở sẵn lô từ link chia sẻ ?lo=54
  const [selectedLo, setSelectedLo] = useState(() => Number(new URLSearchParams(location.search).get('lo')) || null);
  const [base, setBase] = useState('satellite');
  const [showLots, setShowLots] = useState(true);
  const [planVisible, setPlanVisible] = useState([]);
  const [showZones, setShowZones] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);

  // ---- Vùng vẽ thủ công từ API
  const [zones, setZones] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    fetchZones(controller.signal)
      .then((d) => setZones((Array.isArray(d) ? d : []).filter((z) => z?.coordinates?.length >= 3)))
      .catch(() => setZones([]));
    return () => controller.abort();
  }, [fetchZones, refreshKey]);

  // ---- Vị trí người dùng
  const [userPos, setUserPos] = useState(null);
  const [locateMsg, setLocateMsg] = useState('');

  // Ghi lô đang chọn lên URL để chia sẻ / tải lại trang không mất
  useEffect(() => {
    const url = new URL(location.href);
    selectedLo ? url.searchParams.set('lo', selectedLo) : url.searchParams.delete('lo');
    history.replaceState(null, '', url);
  }, [selectedLo]);

  const options = useMemo(() => ({
    cum: [...new Set(lots.map((l) => l.cum))].sort(),
    doi: [...new Set(lots.map((l) => l.doi))].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true })),
    giong: [...new Set(lots.map((l) => l.giong).filter(Boolean))].sort(),
  }), [lots]);

  const filtered = useMemo(() => lots.filter((l) =>
    (!cum.size || cum.has(l.cum)) && (!doi.size || doi.has(l.doi)) && (!giong || l.giong === giong)), [lots, cum, doi, giong]);

  const legend = useMemo(() => buildLegend(colorMode, lots), [colorMode, lots]);
  const colorOf = useMemo(() => {
    const map = Object.fromEntries(legend.map((g) => [g.label, g.color]));
    return (lot) => map[COLOR_MODES[colorMode].value(lot)] ?? '#9ca3af';
  }, [legend, colorMode]);

  const summary = useMemo(() => ({
    lo: filtered.length,
    ha: filtered.reduce((s, l) => s + (l.dienTichHienHuu || 0), 0),
    cay: filtered.reduce((s, l) => s + (l.soCayHienHuu || 0), 0),
  }), [filtered]);

  const results = useMemo(() => searchLots(lots, query).slice(0, 8), [lots, query]);
  const selected = lots.find((l) => l.lo === selectedLo) ?? null;
  const filtersOn = cum.size || doi.size || giong;

  const pick = (lot) => {
    setSelectedLo(lot.lo);
    setQuery('');
    setSearchOpen(false);
  };

  function locate() {
    if (!navigator.geolocation) return setLocateMsg('Thiết bị không hỗ trợ định vị.');
    setLocateMsg('Đang lấy vị trí…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos = [coords.latitude, coords.longitude];
        setUserPos(pos);
        const inside = lots.find((l) => lotContains(l, pos));
        if (inside) {
          setSelectedLo(inside.lo);
          setLocateMsg(`Bạn đang ở Lô ${inside.lo}`);
          return;
        }
        const near = lots.reduce((b, l) => {
          const d = distanceM(pos, l.viTri);
          return !b || d < b.d ? { l, d } : b;
        }, null);
        setLocateMsg(near ? `Lô gần nhất: Lô ${near.l.lo}, cách ${formatInt(Math.round(near.d))} m` : '');
      },
      () => setLocateMsg('Không lấy được vị trí. Hãy cho phép truy cập vị trí.'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function exportCsv() {
    const blob = new Blob([lotsToCsv(filtered)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `danh-sach-lo-kdgf${filtersOn ? '-loc' : ''}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className={`grid gap-4 text-emerald-50 lg:grid-cols-[340px_minmax(0,1fr)] ${className}`}>
      {/* ================= THANH BÊN ================= */}
      <aside className="order-2 flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#164E33] bg-[#131411] lg:order-1 lg:h-[680px]">
        {/* Tổng hợp theo bộ lọc */}
        <div className="grid grid-cols-3 divide-x divide-[#164E33] border-b border-[#164E33] bg-[#042918] text-center">
          {[['Lô', formatInt(summary.lo)], ['Diện tích', formatHa(summary.ha)], ['Số cây', formatInt(summary.cay)]].map(([k, v]) => (
            <div key={k} className="px-2 py-3">
              <div className="text-base font-bold tabular-nums">{v}</div>
              <div className="text-[11px] uppercase tracking-wider text-emerald-100/55">{k}</div>
            </div>
          ))}
        </div>

        {/* Bộ lọc */}
        <div className="space-y-3 border-b border-[#164E33] p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-12 text-xs text-emerald-100/55">Cụm</span>
            {options.cum.map((c) => (
              <button key={c} type="button" className={chip(cum.has(c))} onClick={() => setCum(toggle(cum, c))}>Cụm {c}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-12 text-xs text-emerald-100/55">Đội</span>
            {options.doi.map((d) => (
              <button key={d} type="button" className={chip(doi.has(d))} onClick={() => setDoi(toggle(doi, d))}>{d.replace('Đội ', '')}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-giong" className="w-12 text-xs text-emerald-100/55">Giống</label>
            <select
              id="filter-giong"
              value={giong}
              onChange={(e) => setGiong(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-[#164E33] bg-[#0b0c0a] px-2 py-1.5 text-xs"
            >
              <option value="">Tất cả giống</option>
              {options.giong.map((g) => <option key={g}>{g}</option>)}
            </select>
            {filtersOn ? (
              <button type="button" className="text-xs text-emerald-300 hover:underline" onClick={() => { setCum(new Set()); setDoi(new Set()); setGiong(''); }}>
                Bỏ lọc
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-12 text-xs text-emerald-100/55">Tô màu</span>
            {Object.entries(COLOR_MODES).map(([k, m]) => (
              <button key={k} type="button" className={chip(colorMode === k)} onClick={() => setColorMode(k)}>{m.label}</button>
            ))}
          </div>
          {/* Chú giải màu */}
          <ul className="flex flex-wrap gap-x-3 gap-y-1 pl-12 text-[11px] text-emerald-100/75">
            {legend.map((g) => (
              <li key={g.label} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: g.color }} />{g.label}</li>
            ))}
            <li className="flex items-center gap-1.5 text-emerald-100/50"><span className="size-2.5 rounded-full border border-emerald-100/60" />Chấm tròn: lô chưa có ranh giới</li>
          </ul>
        </div>

        {/* Danh sách lô */}
        <ul className="min-h-0 flex-1 divide-y divide-[#164E33]/50 overflow-y-auto max-lg:max-h-80" aria-label="Danh sách lô">
          {filtered.map((l) => (
            <li key={l.lo}>
              <button
                type="button"
                onClick={() => setSelectedLo(l.lo)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[#164E33]/40 ${l.lo === selectedLo ? 'bg-[#164E33]/60' : ''}`}
              >
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: colorOf(l) }} />
                <span className="w-14 font-semibold">Lô {l.lo}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-emerald-100/60">{l.doi} · {l.giong ?? 'chưa ghi giống'}</span>
                <span className="text-xs tabular-nums text-emerald-100/80">
                  {/* Lô đã hủy / chờ tái canh không còn diện tích chăm sóc: hiện trạng thái thay vì "0 ha" */}
                  {l.dienTichHienHuu > 0 ? formatHa(l.dienTichHienHuu) : <span className="text-amber-300">{l.trangThai ?? '—'}</span>}
                </span>
              </button>
            </li>
          ))}
          {status === 'ready' && !filtered.length && <li className="p-4 text-sm text-emerald-100/60">Không có lô nào khớp bộ lọc.</li>}
          {status === 'loading' && <li className="p-4 text-sm text-emerald-100/60">Đang tải dữ liệu lô…</li>}
          {status === 'error' && <li className="p-4 text-sm text-red-300">Không tải được dữ liệu lô: {error}</li>}
        </ul>

        {/* Thao tác */}
        <div className="flex gap-2 border-t border-[#164E33] p-3">
          <button type="button" onClick={exportCsv} disabled={!filtered.length} className="flex-1 rounded-md bg-[#164E33] px-3 py-2 text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40">
            Xuất Excel (CSV)
          </button>
          {report?.canhBao?.length ? (
            <button type="button" onClick={() => setIssuesOpen(true)} className="rounded-md border border-amber-400/40 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/10">
              {report.canhBao.length} cảnh báo dữ liệu
            </button>
          ) : null}
        </div>
      </aside>

      {/* ================= BẢN ĐỒ ================= */}
      <section className="relative order-1 h-[70vh] min-h-[460px] overflow-hidden rounded-xl border border-[#164E33] lg:order-2 lg:h-[680px]">
        <MapContainer center={DEFAULT_CENTER} zoom={14} className="farm-map h-full w-full" zoomControl={false}>
          <TileLayer key={base} {...BASE_LAYERS[base]} />
          <ZoomControl position="bottomright" />
          <PlanLayer data={plan} visible={planVisible} />
          {showLots && (
            <LotLayer lots={filtered} colorOf={colorOf} selectedLo={selectedLo} onSelect={(l) => setSelectedLo(l.lo)} />
          )}
          {showZones && zones.map((z) => (
            <Polygon key={z.id ?? z.batchCode} positions={z.coordinates} pathOptions={{ color: statusColor(z.status), weight: 2, dashArray: '4 4', fillOpacity: 0.2 }}>
              <Popup>
                <b>{z.batchCode}</b>{z.lo ? ` · Lô ${z.lo}` : ''}<br />
                {z.status} · {formatArea(zoneAreaM2(z))}
              </Popup>
            </Polygon>
          ))}
          {userPos && <CircleMarker center={userPos} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1 }} />}
          <FitToLots lots={lots} />
          <FlyToLot lot={selected} />
          <FlyToUser pos={userPos} />
        </MapContainer>

        {/* Ô tìm lô */}
        <div className="absolute left-3 top-3 z-[1000] w-[calc(100%-168px)] max-w-[320px]">
          <input
            id="lot-search"
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) pick(results[0]);
              if (e.key === 'Escape') setQuery('');
            }}
            placeholder="Tìm lô (VD: 54, A12)"
            aria-label="Tìm lô"
            className="w-full rounded-lg border border-[#164E33] bg-[#131411]/95 px-3 py-2.5 text-sm text-emerald-50 shadow-lg backdrop-blur placeholder:text-emerald-100/40 focus:border-emerald-400 focus:outline-none"
          />
          {searchOpen && query && (
            <ul className="mt-1 overflow-hidden rounded-lg border border-[#164E33] bg-[#131411]/95 text-sm shadow-xl backdrop-blur">
              {results.length ? results.map((l) => (
                <li key={l.lo}>
                  <button type="button" onMouseDown={() => pick(l)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#164E33]">
                    <span className="size-2.5 rounded-sm" style={{ background: colorOf(l) }} />
                    <b>Lô {l.lo}</b>
                    <span className="truncate text-xs text-emerald-100/60">lô cũ {l.loCu.join(' + ')} · {l.doi}</span>
                  </button>
                </li>
              )) : <li className="px-3 py-2 text-emerald-100/60">Không tìm thấy lô “{query}”.</li>}
            </ul>
          )}
        </div>

        {/* Nút điều khiển bên phải */}
        <div className="absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2">
          <div className="flex overflow-hidden rounded-md border border-[#164E33] shadow-lg">
            {Object.entries(BASE_LAYERS).map(([k, b]) => (
              <button key={k} type="button" onClick={() => setBase(k)} className={`px-3 py-2 text-xs font-semibold ${base === k ? 'bg-[#164E33] text-white' : 'bg-[#131411]/90 text-emerald-100/70'}`}>
                {b.label}
              </button>
            ))}
          </div>
          <button type="button" className={iconBtn} onClick={() => setLayersOpen((o) => !o)} aria-expanded={layersOpen}>Lớp bản đồ</button>
          {layersOpen && (
            <div className="w-56 space-y-2 rounded-lg border border-[#164E33] bg-[#131411]/95 p-3 text-xs shadow-xl backdrop-blur">
              <label className="flex items-center gap-2"><input type="checkbox" checked={showLots} onChange={(e) => setShowLots(e.target.checked)} /> Lô trồng chuối</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={showZones} onChange={(e) => setShowZones(e.target.checked)} /> Vùng vẽ thủ công ({zones.length})</label>
              {plan && (
                <div className="border-t border-[#164E33] pt-2">
                  <div className="mb-1.5 font-semibold text-emerald-100/70">Kế hoạch 2026</div>
                  {Object.entries(PLAN_STYLE).map(([k, s]) => (
                    <label key={k} className="flex items-center gap-2 py-0.5">
                      <input type="checkbox" checked={planVisible.includes(k)} onChange={() => setPlanVisible((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]))} />
                      <span className="size-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <button type="button" className={iconBtn} onClick={locate}>Vị trí của tôi</button>
          {locateMsg && <div className="max-w-56 rounded-md bg-[#042918]/95 px-3 py-2 text-xs shadow-lg">{locateMsg}</div>}
        </div>

        {/* Chi tiết lô */}
        {selected && (
          <div className="absolute inset-x-3 bottom-3 z-[1001] max-h-[55%] sm:inset-x-auto sm:left-3 sm:w-80 sm:max-h-[70%]">
            <LotDetail lot={selected} color={colorOf(selected)} onClose={() => setSelectedLo(null)} />
          </div>
        )}
      </section>

      {/* ================= CẢNH BÁO DỮ LIỆU ================= */}
      {issuesOpen && report && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/60 p-4" onClick={() => setIssuesOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl border border-[#164E33] bg-[#131411]" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-[#164E33] bg-[#042918] px-4 py-3">
              <h3 className="font-bold">Cảnh báo dữ liệu</h3>
              <button type="button" onClick={() => setIssuesOpen(false)} className="text-xl leading-none text-emerald-100/60">×</button>
            </header>
            <div className="max-h-[60vh] overflow-y-auto p-4 text-sm">
              <p className="mb-3 text-emerald-100/60">
                {report.tongLo} lô · {report.coRanhGioi} lô có ranh giới từ bản đồ PDF · {report.chiCoViTri} lô mới có vị trí.
                Nguồn: {report.nguon.excel} (cập nhật {report.taoLuc.replace('T', ' ')}).
              </p>
              <ul className="space-y-1.5">
                {report.canhBao.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber-300">•</span>
                    {c.lo ? (
                      <button type="button" className="text-left hover:underline" onClick={() => { setSelectedLo(c.lo); setIssuesOpen(false); }}>{c.noiDung}</button>
                    ) : <span>{c.noiDung}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
