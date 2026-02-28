import { WORLD_MAP_COLORS } from '@/lib/world-map-colors'

export interface CameraState {
  lon: [number, number]
  lat: [number, number]
  zoom: number
}

/** Rounds to the nearest "cartographic nice" value: 1/2/5 × 10^n. */
function niceKm(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / mag
  if (n < 1.5) return mag
  if (n < 3.5) return 2 * mag
  if (n < 7.5) return 5 * mag
  return 10 * mag
}

function formatCoord(v: number, pos: string, neg: string): string {
  return `${Math.abs(v).toFixed(2)}\u00B0\u202f${v >= 0 ? pos : neg}`
}

function formatRange(
  min: number,
  max: number,
  pos: string,
  neg: string,
): string {
  return `${formatCoord(min, pos, neg)} - ${formatCoord(max, pos, neg)}`
}

export function MapLegend({
  lon,
  lat,
  zoom,
  cursor,
}: CameraState & {
  cursor?: { lon: number; lat: number } | null
}) {
  const centerLat = (lat[0] + lat[1]) / 2
  // km per pixel at the current latitude (horizontal, along a parallel)
  const kmPerPx = (1 / zoom) * 111.32 * Math.cos((centerLat * Math.PI) / 180)
  const km = niceKm(Math.max(1, 100 * kmPerPx))
  const barPx = Math.round(km / kmPerPx)
  const kmLabel = km >= 1000 ? `${km / 1000} km` : `${km} km`

  return (
    <div
      className="fixed bottom-4 left-4 z-10 flex flex-col gap-2 select-none rounded px-3 py-2 text-xs font-mono"
      style={{
        background: 'rgba(10,10,10,0.78)',
        color: WORLD_MAP_COLORS.label,
        border: `1px solid ${WORLD_MAP_COLORS.outline}`,
      }}
    >
      <div className="flex flex-col gap-1">
        <span>Lat: {formatRange(lat[0], lat[1], 'N', 'S')}</span>
        <span>Lon: {formatRange(lon[0], lon[1], 'E', 'W')}</span>
      </div>

      {cursor && (
        <div className="flex flex-col gap-1 border-t border-white/10 pt-1">
          <span>
            Cursor: {formatCoord(cursor.lat, 'N', 'S')},{' '}
            {formatCoord(cursor.lon, 'E', 'W')}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div
          style={{
            width: barPx,
            height: 3,
            background: WORLD_MAP_COLORS.label,
            borderRadius: 1,
          }}
        />
        <span>{kmLabel}</span>
      </div>
    </div>
  )
}
