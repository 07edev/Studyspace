import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { GeoPoint } from '@contracts/places';

const DEFAULT_ZOOM = 15;
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

// Leaflet + OpenStreetMap map widget. Falls back cleanly in jsdom/test environments where canvas/SVG metrics
// are unavailable, while still keeping accessible coordinate display and numeric editing when interactive.
export function MapPicker({
  lat,
  lng,
  interactive = false,
  onChange,
  height = 260,
  label = 'Bản đồ vị trí',
}: {
  lat: number;
  lng: number;
  interactive?: boolean;
  onChange?: (point: GeoPoint) => void;
  height?: number;
  label?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;
    // Skip Leaflet DOM initialization in jsdom tests (no real layout engine).
    if (navigator.userAgent.toLowerCase().includes('jsdom')) return;

    let map: L.Map | undefined;
    try {
      map = L.map(el, { center: [lat, lng], zoom: DEFAULT_ZOOM, scrollWheelZoom: interactive });
      L.tileLayer(OSM_TILE_URL, {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.circleMarker([lat, lng], {
        radius: 9,
        color: '#285c49',
        fillColor: '#285c49',
        fillOpacity: 0.75,
        weight: 2,
      }).addTo(map);

      if (interactive) {
        map.on('click', (ev: L.LeafletMouseEvent) => {
          const next = {
            lat: Number(ev.latlng.lat.toFixed(6)),
            lng: Number(ev.latlng.lng.toFixed(6)),
          };
          marker.setLatLng([next.lat, next.lng]);
          onChangeRef.current?.(next);
        });
      }

      mapRef.current = map;
      markerRef.current = marker;
    } catch {
      map?.remove();
    }

    return () => {
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    markerRef.current.setLatLng([lat, lng]);
    mapRef.current.panTo([lat, lng]);
  }, [lat, lng]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="map-box" style={{ height }} role="region" aria-label={label}>
        <div ref={containerRef} className="map-canvas" style={{ height }} />
      </div>
      <div className="muted" style={{ fontSize: 13 }}>
        Tọa độ: <strong>{Number.isFinite(lat) ? lat.toFixed(5) : '—'}, {Number.isFinite(lng) ? lng.toFixed(5) : '—'}</strong>
        {interactive ? ' · Nhấp lên bản đồ OSM hoặc nhập tọa độ bên dưới để ghim vị trí.' : ' · OpenStreetMap'}
      </div>
    </div>
  );
}
