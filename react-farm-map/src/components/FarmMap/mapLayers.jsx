// Các lớp bản đồ dùng chung cho Viewer & Admin
import { useEffect, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, GeoJSON, Polygon, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { toLatLngs } from './useFarmData';

/** Theo dõi mức zoom hiện tại */
export function useZoom() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  return zoom;
}

/**
 * Vẽ các lô: lô có ranh giới -> Polygon, lô chỉ có vị trí -> chấm tròn.
 * Nhãn số lô tự hiện khi phóng to (zoom >= labelZoom).
 */
export function LotLayer({ lots, colorOf, selectedLo, onSelect, interactive = true, dim = false, labelZoom = 16 }) {
  const zoom = useZoom();
  const showLabel = zoom >= labelZoom;

  return lots.map((lot) => {
    const color = colorOf(lot);
    const selected = lot.lo === selectedLo;
    const style = {
      color: selected ? '#ffffff' : color,
      weight: selected ? 3 : 1.5,
      fillColor: color,
      fillOpacity: dim ? 0.12 : selected ? 0.55 : 0.35,
      opacity: dim ? 0.5 : 1,
    };
    const handlers = interactive ? { click: () => onSelect?.(lot) } : undefined;
    const label = showLabel && (
      <Tooltip permanent direction="center" className="farm-map__lot-label">{lot.lo}</Tooltip>
    );
    const positions = toLatLngs(lot.geometry);

    // key gồm trạng thái nhãn để Tooltip permanent gắn/gỡ đúng lúc
    return positions ? (
      <Polygon key={`${lot.lo}-${showLabel}`} positions={positions} pathOptions={style} interactive={interactive} eventHandlers={handlers}>
        {label}
      </Polygon>
    ) : (
      <CircleMarker
        key={`${lot.lo}-${showLabel}`}
        center={lot.viTri}
        radius={selected ? 10 : 7}
        pathOptions={{ ...style, fillOpacity: dim ? 0.3 : 0.85, color: selected ? '#fff' : '#0b0c0a' }}
        interactive={interactive}
        eventHandlers={handlers}
      >
        {label}
      </CircleMarker>
    );
  });
}

// Màu lớp kế hoạch 2026
export const PLAN_STYLE = {
  gd1: { color: '#22d3ee', label: 'Thu hồi GĐ1' },
  gd2: { color: '#facc15', label: 'Thu hồi GĐ2' },
  gd3: { color: '#fb7185', label: 'Thu hồi GĐ3' },
  chuoi: { color: '#86efac', label: 'Đã trồng chuối' },
  caoSuDucLoc: { color: '#fdba74', label: 'Cao su Đức Lộc' },
  caoSuLK: { color: '#fcd34d', label: 'Cao su giao khoán LK' },
  traiHeo: { color: '#f472b6', label: 'Trại heo' },
  caoToc: { color: '#c2410c', label: 'Cao tốc BMT–KH' },
};

/** Lớp kế hoạch thu hồi / hiện trạng 2026, chỉ hiện các loại trong `visible` */
export function PlanLayer({ data, visible }) {
  if (!data) return null;
  const features = data.features.filter((f) => visible.includes(f.properties.loai));
  return (
    <GeoJSON
      key={visible.join(',')}
      data={{ type: 'FeatureCollection', features }}
      style={(f) => {
        const c = PLAN_STYLE[f.properties.loai]?.color ?? '#fff';
        const isPlan = f.properties.loai.startsWith('gd');
        return { color: c, weight: isPlan ? 2 : 1, dashArray: isPlan ? '6 4' : null, fillColor: c, fillOpacity: isPlan ? 0.35 : 0.15 };
      }}
      onEachFeature={(f, layer) => {
        const p = f.properties;
        layer.bindPopup(
          `<b>${p.ten}</b>${p.dienTichChuGiai ? `<br>Diện tích theo bản đồ: ${String(p.dienTichChuGiai).replace('.', ',')} ha` : ''}`,
        );
      }}
    />
  );
}

/** Bay tới lô được chọn */
export function FlyToLot({ lot }) {
  const map = useMap();
  useEffect(() => {
    if (!lot) return;
    const positions = toLatLngs(lot.geometry);
    if (positions) map.flyToBounds(L.polygon(positions).getBounds(), { maxZoom: 17, padding: [60, 60], duration: 0.6 });
    else map.flyTo(lot.viTri, 17, { duration: 0.6 });
  }, [map, lot]);
  return null;
}

/** Phóng bản đồ vừa khít toàn bộ lô (chạy 1 lần khi có dữ liệu) */
export function FitToLots({ lots }) {
  const map = useMap();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (done || !lots.length) return;
    map.fitBounds(L.latLngBounds(lots.map((l) => l.viTri)), { padding: [30, 30] });
    setDone(true);
  }, [map, lots, done]);
  return null;
}

/** Kiểm tra điểm [lat, lng] nằm trong lô (ray casting trên GeoJSON) */
export function lotContains(lot, [lat, lng]) {
  const polys = lot.geometry.type === 'Polygon' ? [lot.geometry.coordinates]
    : lot.geometry.type === 'MultiPolygon' ? lot.geometry.coordinates : [];
  return polys.some(([outer]) => {
    let inside = false;
    for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
      const [xi, yi] = outer[i];
      const [xj, yj] = outer[j];
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  });
}
