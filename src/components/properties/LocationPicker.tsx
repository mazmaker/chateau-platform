import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons (Leaflet expects them at relative paths)
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

interface LocationPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
}

/** Updates the map center when lat/lng prop changes externally */
const Recenter = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom() || 14);
  }, [lat, lng, map]);
  return null;
};

/** Captures clicks on the map and updates the marker */
const ClickHandler = ({ onChange }: { onChange: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click: (e) => {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const LocationPicker = ({ lat, lng, onChange, height = 320 }: LocationPickerProps) => {
  // Default center if no coords yet — Bangkok
  const initialLat = lat ?? 13.7563;
  const initialLng = lng ?? 100.5018;
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    const q = searchInput.trim();
    if (!q) return;
    setSearching(true);
    try {
      // Nominatim public geocoding (OpenStreetMap) — free, no API key
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat: foundLat, lon: foundLng } = data[0];
        onChange(parseFloat(foundLat), parseFloat(foundLng));
      } else {
        alert('ไม่พบสถานที่ — ลองพิมพ์ที่อยู่ละเอียดขึ้น');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
          placeholder="ค้นหาที่อยู่/ชื่อโครงการ (เช่น Sasara Hua Hin, ถนนสุขุมวิท)"
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching || !searchInput.trim()}
          className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:bg-gray-300"
        >
          {searching ? 'กำลังค้น...' : 'ค้น'}
        </button>
      </div>

      {/* Map */}
      <div className="rounded-lg overflow-hidden border-2 border-gray-200" style={{ height }}>
        <MapContainer
          center={[initialLat, initialLng]}
          zoom={lat && lng ? 15 : 6}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {lat !== null && lng !== null && (
            <>
              <Marker
                position={[lat, lng]}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const m = e.target;
                    const p = m.getLatLng();
                    onChange(p.lat, p.lng);
                  },
                }}
              />
              <Recenter lat={lat} lng={lng} />
            </>
          )}
          <ClickHandler onChange={onChange} />
        </MapContainer>
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-500">
        <strong>คลิกบนแผนที่</strong>เพื่อปักหมุด หรือ<strong>ลากหมุด</strong>เพื่อย้ายตำแหน่ง / ใช้ช่องค้นหาเพื่อหาที่อยู่
      </p>

      {/* Read-only coordinates display */}
      {lat !== null && lng !== null && (
        <p className="text-xs text-gray-700 font-mono bg-gray-50 px-2 py-1 rounded inline-block">
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </p>
      )}
    </div>
  );
};

export default LocationPicker;
