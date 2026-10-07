import { useEffect, useState } from 'react';
import { fetchFarmData } from './farmMapApi';

/**
 * Tải dữ liệu lô một lần cho cả Viewer & Admin.
 * lots: mảng lô { ...thuộc tính Excel, viTri: [lat, lng], geometry }
 */
export default function useFarmData(load = fetchFarmData) {
  const [state, setState] = useState({ status: 'loading', lots: [], plan: null, report: null, error: '' });

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then(({ lots, plan, report }) => {
        const list = lots.features
          .map((f) => ({ ...f.properties, geometry: f.geometry }))
          .sort((a, b) => a.lo - b.lo);
        setState({ status: 'ready', lots: list, plan, report, error: '' });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setState((s) => ({ ...s, status: 'error', error: err.message }));
      });
    return () => controller.abort();
  }, [load]);

  return state;
}

/** GeoJSON [lng, lat] -> Leaflet [lat, lng] cho Polygon/MultiPolygon */
export function toLatLngs(geometry) {
  const flip = (ring) => ring.map(([lng, lat]) => [lat, lng]);
  if (geometry.type === 'Polygon') return geometry.coordinates.map(flip);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((p) => p.map(flip));
  return null;
}
