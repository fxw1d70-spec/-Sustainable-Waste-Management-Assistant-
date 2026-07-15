import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import { fetchCenters } from '../api.js'

const TYPE_META = {
  recycling: { color: '#10b981', label: 'Recycling' },
  'e-waste': { color: '#8b5cf6', label: 'E-Waste' },
  organic: { color: '#f59e0b', label: 'Organic' },
  hazardous: { color: '#ef4444', label: 'Hazardous' },
}

// Build a small colored pin as a divIcon so we don't rely on Leaflet's
// default marker image assets (which break under bundlers).
function pinIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:22px;height:22px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);
      border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -20],
  })
}

export default function MapPage() {
  const [centers, setCenters] = useState([])
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchCenters('all')
      .then(setCenters)
      .catch(() =>
        setError('Could not load collection centers. Is the backend running?'),
      )
  }, [])

  const visible = useMemo(
    () => (filter === 'all' ? centers : centers.filter((c) => c.type === filter)),
    [centers, filter],
  )

  const center = centers.length
    ? [centers[0].lat, centers[0].lng]
    : [12.9716, 77.5946]

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800">Collection Centers</h2>
      <p className="mt-1 text-sm text-slate-500">
        Find nearby recycling, e-waste, organic and hazardous-waste facilities.
      </p>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-2">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </FilterButton>
        {Object.entries(TYPE_META).map(([key, meta]) => (
          <FilterButton
            key={key}
            active={filter === key}
            color={meta.color}
            onClick={() => setFilter(key)}
          >
            {meta.label}
          </FilterButton>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl shadow-sm lg:col-span-2">
          <MapContainer
            center={center}
            zoom={12}
            style={{ height: '460px', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {visible.map((c) => (
              <Marker
                key={c.id}
                position={[c.lat, c.lng]}
                icon={pinIcon((TYPE_META[c.type] || {}).color || '#64748b')}
                eventHandlers={{ click: () => setSelected(c) }}
              >
                <Popup>
                  <strong>{c.name}</strong>
                  <br />
                  {c.address}
                  <br />
                  🕒 {c.hours}
                  <br />
                  📞 {c.contact}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Center list / details */}
        <div className="space-y-3">
          {selected && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: (TYPE_META[selected.type] || {}).color }}
                />
                <h3 className="font-bold text-slate-800">{selected.name}</h3>
              </div>
              <dl className="mt-2 space-y-1 text-sm text-slate-600">
                <div>📍 {selected.address}</div>
                <div>🕒 {selected.hours}</div>
                <div>📞 {selected.contact}</div>
                <div>♻️ Accepts: {selected.accepted.join(', ')}</div>
              </dl>
            </div>
          )}

          <div className="max-h-[380px] space-y-2 overflow-y-auto">
            {visible.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm transition hover:ring-2 hover:ring-brand-200"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: (TYPE_META[c.type] || {}).color }}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-700">
                    {c.name}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {c.address}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterButton({ active, color, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-brand-600 text-white'
          : 'bg-white text-slate-600 shadow-sm hover:bg-slate-50'
      }`}
    >
      {color && (
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      )}
      {children}
    </button>
  )
}
