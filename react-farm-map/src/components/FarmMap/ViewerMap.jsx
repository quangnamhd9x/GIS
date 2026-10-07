import { useEffect, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Polygon, Popup, useMap } from 'react-leaflet';
import { fetchZones as defaultFetchZones } from './farmMapApi';
import {
  DEFAULT_CENTER, SATELLITE_LAYER, STATUS_COLORS, formatArea, statusColor, zoneAreaM2,
} from './farmMapUtils';
import './farmMap.css';

/** Tự phóng bản đồ vừa khít tất cả phân khu */
function FitToZones({ zones }) {
  const map = useMap();
  useEffect(() => {
    if (!zones.length) return;
    const bounds = L.latLngBounds(zones.flatMap((z) => z.coordinates));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, zones]);
  return null;
}

/**
 * Màn hình Viewer: fetch phân khu từ API, vẽ lên bản đồ, click để xem Popup.
 * @param fetchZones  hàm (signal) => Promise<zone[]>, mặc định GET /zones
 * @param refreshKey  đổi giá trị để tải lại dữ liệu (VD sau khi Admin lưu)
 */
export default function ViewerMap({ fetchZones = defaultFetchZones, refreshKey, center = DEFAULT_CENTER, zoom = 15, className = '' }) {
  const [zones, setZones] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    fetchZones(controller.signal)
      .then((data) => {
        // Chỉ giữ phân khu có đủ 3 điểm trở lên
        setZones((Array.isArray(data) ? data : []).filter((z) => z?.coordinates?.length >= 3));
        setState('ready');
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setState('error');
      });
    return () => controller.abort();
  }, [fetchZones, refreshKey]);

  return (
    <div className={`overflow-hidden rounded-xl border border-[#164E33] bg-[#131411] text-emerald-50 ${className}`}>
      {/* Thanh tiêu đề + chú giải màu */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#164E33] bg-[#042918] px-4 py-3 text-sm">
        <span className="font-semibold">
          {state === 'ready' ? `${zones.length} phân khu` : state === 'loading' ? 'Đang tải dữ liệu…' : 'Không tải được dữ liệu'}
        </span>
        <ul className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-emerald-100/70">
          {Object.entries(STATUS_COLORS).map(([label, color]) => (
            <li key={label} className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: color }} />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative">
        <MapContainer center={center} zoom={zoom} className="farm-map h-[420px] w-full sm:h-[520px]">
          <TileLayer {...SATELLITE_LAYER} />
          {zones.map((zone) => {
            const color = statusColor(zone.status);
            return (
              <Polygon
                key={zone.id ?? zone.batchCode}
                positions={zone.coordinates}
                pathOptions={{ color, weight: 2, fillOpacity: 0.3 }}
                eventHandlers={{
                  mouseover: (e) => e.target.setStyle({ fillOpacity: 0.5 }),
                  mouseout: (e) => e.target.setStyle({ fillOpacity: 0.3 }),
                }}
              >
                <Popup>
                  <h4 className="mb-2 text-base font-bold text-emerald-50">{zone.batchCode}</h4>
                  <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-[13px]">
                    <dt className="text-emerald-100/60">Diện tích</dt>
                    <dd className="font-semibold tabular-nums">{formatArea(zoneAreaM2(zone))}</dd>
                    <dt className="text-emerald-100/60">Trạng thái</dt>
                    <dd>
                      <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-[#042918]" style={{ background: color }}>
                        {zone.status}
                      </span>
                    </dd>
                  </dl>
                </Popup>
              </Polygon>
            );
          })}
          <FitToZones zones={zones} />
        </MapContainer>

        {state === 'error' && (
          <div className="absolute inset-x-3 top-3 z-[1000] rounded-md border border-red-400/40 bg-[#131411]/95 px-3 py-2 text-sm text-red-300">
            {error}. Kiểm tra kết nối API rồi tải lại trang.
          </div>
        )}
      </div>
    </div>
  );
}
