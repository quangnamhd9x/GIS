import { useMemo, useState } from 'react';
import {
  MapContainer, TileLayer, Polygon, Polyline, CircleMarker, Tooltip, useMapEvents,
} from 'react-leaflet';
import { saveZone } from './farmMapApi';
import {
  DEFAULT_CENTER, SATELLITE_LAYER, STATUSES, formatArea, formatHa, polygonAreaM2,
} from './farmMapUtils';
import useFarmData from './useFarmData';
import { FlyToLot, LotLayer } from './mapLayers';
import './farmMap.css';

/** Bắt sự kiện click trên bản đồ để thêm đỉnh */
function ClickToAddPoint({ onAdd }) {
  useMapEvents({
    click: (e) => onAdd([+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)]),
  });
  return null;
}

const btn = 'rounded-md px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const btnGhost = `${btn} border border-[#164E33] text-emerald-100 hover:bg-[#164E33]/50`;
const field = 'rounded-md border border-[#164E33] bg-[#0b0c0a] px-3 py-2 text-sm text-emerald-50 placeholder:text-emerald-100/40 focus:border-emerald-400 focus:outline-none';

/**
 * Màn hình Admin: click lên bản đồ để vẽ ranh giới lô thửa, bấm Lưu để gửi API.
 * @param onSave  hàm nhận object phân khu, mặc định POST /zones
 */
export default function AdminDrawMap({ onSave = saveZone, center = DEFAULT_CENTER, zoom = 15, className = '' }) {
  const { lots } = useFarmData();
  const [loInput, setLoInput] = useState('');
  const [points, setPoints] = useState([]);
  const [batchCode, setBatchCode] = useState('');
  const [status, setStatus] = useState(STATUSES[0]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'error' | 'success', text }
  const [savedJson, setSavedJson] = useState('');

  const areaM2 = useMemo(() => (points.length >= 3 ? polygonAreaM2(points) : 0), [points]);
  // Lô đang vẽ (gõ "54" hoặc chọn từ gợi ý)
  const lot = useMemo(() => lots.find((l) => String(l.lo) === loInput.replace(/\D/g, '')) ?? null, [lots, loInput]);
  const diffPct = lot && areaM2 ? Math.round(((areaM2 / 10000 - lot.dienTichBanDau) / lot.dienTichBanDau) * 100) : null;

  const addPoint = (p) => { setPoints((prev) => [...prev, p]); setMessage(null); };
  const undo = () => setPoints((prev) => prev.slice(0, -1));
  const clear = () => setPoints([]);

  async function handleSave() {
    if (points.length < 3) return setMessage({ type: 'error', text: 'Cần ít nhất 3 điểm để tạo vùng.' });
    if (!batchCode.trim()) return setMessage({ type: 'error', text: 'Nhập Mã mẻ trước khi lưu.' });

    const zone = {
      lo: lot?.lo ?? null,
      batchCode: batchCode.trim(),
      status,
      areaHa: +(areaM2 / 10000).toFixed(4),
      coordinates: points, // [[lat, lng], ...]
    };

    setSaving(true);
    try {
      await onSave(zone);
      setSavedJson(JSON.stringify(zone, null, 2).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2]'));
      setMessage({ type: 'success', text: `Đã lưu ${zone.batchCode} · ${formatArea(areaM2)}` });
      setPoints([]);
      setBatchCode('');
      setLoInput('');
    } catch (err) {
      setMessage({ type: 'error', text: `Lưu thất bại: ${err.message}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`overflow-hidden rounded-xl border border-[#164E33] bg-[#131411] text-emerald-50 ${className}`}>
      {/* Thanh công cụ */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#164E33] bg-[#042918] p-3">
        <input
          id="draw-lot"
          className={`${field} w-28`}
          list="draw-lot-options"
          placeholder="Lô, VD: 54"
          aria-label="Lô cần vẽ"
          value={loInput}
          onChange={(e) => setLoInput(e.target.value)}
        />
        <datalist id="draw-lot-options">
          {lots.map((l) => <option key={l.lo} value={l.lo}>{`Lô ${l.lo} · ${l.doi} · ${formatHa(l.dienTichBanDau)}${l.nguonRanhGioi === 'pdf' ? '' : ' · chưa có ranh giới'}`}</option>)}
        </datalist>
        <input
          id="batch-code"
          className={`${field} min-w-0 flex-1 sm:flex-none sm:w-52`}
          placeholder="Mã mẻ, VD: ME-2026-004"
          aria-label="Mã mẻ"
          value={batchCode}
          onChange={(e) => setBatchCode(e.target.value)}
        />
        <select id="batch-status" className={field} aria-label="Trạng thái sơ chế" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button type="button" className={btnGhost} onClick={undo} disabled={!points.length}>Hoàn tác</button>
        <button type="button" className={`${btnGhost} hover:text-red-300`} onClick={clear} disabled={!points.length}>Xóa</button>
        <button
          type="button"
          className={`${btn} bg-emerald-500 text-[#042918] hover:bg-emerald-400`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Đang lưu…' : 'Lưu'}
        </button>

        <span className="ml-auto text-sm tabular-nums text-emerald-100/70" role="status">
          {message ? (
            <span className={message.type === 'error' ? 'text-red-300' : 'text-emerald-300'}>{message.text}</span>
          ) : points.length >= 3 ? (
            <>
              {points.length} điểm · Diện tích <b className="text-emerald-300">{formatArea(areaM2)}</b>
              {lot && (
                <span className={Math.abs(diffPct) > 15 ? ' text-amber-300' : ''}>
                  {' '}· Excel {formatHa(lot.dienTichBanDau)} ({diffPct > 0 ? '+' : ''}{diffPct}%)
                </span>
              )}
            </>
          ) : lot ? (
            `Lô ${lot.lo}: ${lot.doi} · Excel ${formatHa(lot.dienTichBanDau)} · click để chấm ranh giới`
          ) : (
            `Click lên bản đồ để chấm ranh giới (${points.length}/3 điểm tối thiểu)`
          )}
        </span>
      </div>

      {/* Bản đồ */}
      <MapContainer
        center={center}
        zoom={zoom}
        doubleClickZoom={false}
        className="farm-map farm-map--drawing h-[420px] w-full sm:h-[520px]"
      >
        <TileLayer {...SATELLITE_LAYER} />
        {/* Các lô hiện có làm nền tham chiếu (không bắt click) */}
        <LotLayer lots={lots} colorOf={() => '#a7f3d0'} selectedLo={lot?.lo} interactive={false} dim />
        <FlyToLot lot={lot} />
        <ClickToAddPoint onAdd={addPoint} />

        {points.length >= 3 && (
          // key đổi theo số điểm để nhãn diện tích luôn nằm giữa vùng
          <Polygon key={points.length} positions={points} pathOptions={{ color: '#4ade80', weight: 2, dashArray: '6 4', fillOpacity: 0.25 }}>
            <Tooltip permanent direction="center" className="farm-map__area-label">{formatArea(areaM2)}</Tooltip>
          </Polygon>
        )}
        {points.length === 2 && <Polyline positions={points} pathOptions={{ color: '#4ade80', dashArray: '6 4' }} />}
        {points.map((p, i) => (
          <CircleMarker
            key={`${i}-${p[0]}-${p[1]}`}
            center={p}
            radius={i === 0 ? 6 : 4}
            pathOptions={{ color: '#fff', weight: 2, fillColor: '#4ade80', fillOpacity: 1 }}
          />
        ))}
      </MapContainer>

      {/* JSON vừa lưu */}
      {savedJson && (
        <div className="border-t border-[#164E33] p-3">
          <div className="mb-2 flex items-center justify-between text-sm text-emerald-100/70">
            <span>JSON phân khu vừa lưu</span>
            <button type="button" className={btnGhost} onClick={() => navigator.clipboard?.writeText(savedJson).catch(() => {})}>
              Sao chép
            </button>
          </div>
          <pre className="max-h-56 overflow-auto rounded-md bg-[#0b0c0a] p-3 text-xs text-emerald-300">{savedJson}</pre>
        </div>
      )}
    </div>
  );
}
