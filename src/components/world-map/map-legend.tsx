import { WORLD_MAP_COLORS } from '@/lib/world-map-colors'

export interface CameraState {
  lon: [number, number]
  lat: [number, number]
  zoom: number
}

const LEGEND_WIDTH_PX = 240
const SCALE_TRACK_PX = 110

/** Rounds down to a "cartographic nice" value: 1/2/5 × 10^n. */
function niceKm(raw: number): number {
  if (raw <= 1) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / mag
  if (n >= 5) return 5 * mag
  if (n >= 2) return 2 * mag
  return mag
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
  const km = niceKm(Math.max(1, SCALE_TRACK_PX * kmPerPx))
  const barPx = Math.round(km / kmPerPx)
  const kmLabel = km >= 1000 ? `${km / 1000} km` : `${km} km`

  return (
    <div
      className="fixed bottom-3 bg-neutral-900/80 left-3 z-10 select-none overflow-hidden rounded-xl border border-neutral-800 text-[11px] font-mono"
      style={{
        width: LEGEND_WIDTH_PX,
        color: WORLD_MAP_COLORS.label,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="border-b px-3 py-2"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-[0.2em] text-white/45">
            World View
          </span>
          <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] text-white/60">
            {zoom.toFixed(1)}x
          </span>
        </div>
      </div>

      <div className="grid gap-2 px-3 py-3">
        <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-2 gap-y-1.5 tabular-nums">
          <span className="uppercase text-white/35">Lat</span>
          <span className="truncate text-white/80">
            {formatRange(lat[0], lat[1], 'N', 'S')}
          </span>
          <span className="uppercase text-white/35">Lon</span>
          <span className="truncate text-white/80">
            {formatRange(lon[0], lon[1], 'E', 'W')}
          </span>

          {/* Cursor */}
          <span className="uppercase text-white/35">Cursor</span>
          <span className="truncate text-white/80">
            {cursor ? (
              <span className="block leading-tight">
                {formatCoord(cursor.lat, 'N', 'S')},{' '}
                {formatCoord(cursor.lon, 'E', 'W')}
              </span>
            ) : (
              <span className="block leading-tight text-white/34">
                Move across the map to inspect coordinates.
              </span>
            )}
          </span>
        </div>

        <div
          className="rounded-lg border px-2.5 py-1.5"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="uppercase text-white/35">Scale</span>
            <span className="tabular-nums text-white/75">{kmLabel}</span>
          </div>

          <div className="flex items-end gap-2">
            <div
              className="relative shrink-0"
              style={{ width: SCALE_TRACK_PX, height: 14 }}
            >
              <div
                className="absolute inset-x-0 bottom-0.5 h-px"
                style={{ background: 'rgba(255,255,255,0.16)' }}
              />
              <div
                className="absolute bottom-0.5 left-0 h-1.5 w-px rounded-full"
                style={{ background: WORLD_MAP_COLORS.label }}
              />
              <div
                className="absolute bottom-0.5 left-0 h-0.5 rounded-full"
                style={{
                  width: barPx,
                  background: WORLD_MAP_COLORS.route,
                }}
              />
              <div
                className="absolute bottom-0.5 h-1.5 w-px rounded-full"
                style={{
                  left: Math.max(barPx - 1, 0),
                  background: WORLD_MAP_COLORS.label,
                }}
              />
            </div>

            <span className="text-[9px] uppercase text-white/28">Ground</span>
          </div>
        </div>
      </div>
    </div>
  )
}
