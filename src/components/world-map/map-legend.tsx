import { WORLD_MAP_COLORS } from '@/lib/world-map-colors'

export interface CameraState {
  lon: [number, number]
  lat: [number, number]
  zoom: number
}

const LEGEND_WIDTH_PX = 304
const SCALE_TRACK_PX = 136

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
      className="fixed bottom-4 left-4 z-10 select-none overflow-hidden rounded-2xl border text-[11px] font-mono"
      style={{
        width: LEGEND_WIDTH_PX,
        background:
          'linear-gradient(180deg, rgba(8,10,12,0.94) 0%, rgba(12,14,18,0.84) 100%)',
        color: WORLD_MAP_COLORS.label,
        borderColor: WORLD_MAP_COLORS.outline,
        boxShadow: '0 18px 40px rgba(0,0,0,0.28)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="border-b px-4 py-3"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.28em] text-white/45">
            World View
          </span>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/60">
            z{zoom.toFixed(1)}
          </span>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-3">
        <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-3 gap-y-1.5 tabular-nums">
          <span className="uppercase tracking-[0.2em] text-white/35">Lat</span>
          <span className="truncate text-white/82">
            {formatRange(lat[0], lat[1], 'N', 'S')}
          </span>
          <span className="uppercase tracking-[0.2em] text-white/35">Lon</span>
          <span className="truncate text-white/82">
            {formatRange(lon[0], lon[1], 'E', 'W')}
          </span>
        </div>

        <div
          className="rounded-xl border px-3 py-2"
          style={{
            borderColor: 'rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="uppercase tracking-[0.22em] text-white/35">
              Cursor
            </span>
            <span className="text-[10px] text-white/35">
              {cursor ? 'Live' : 'Idle'}
            </span>
          </div>

          <div className="min-h-[30px] tabular-nums text-white/78">
            {cursor ? (
              <span className="block leading-4">
                {formatCoord(cursor.lat, 'N', 'S')},{' '}
                {formatCoord(cursor.lon, 'E', 'W')}
              </span>
            ) : (
              <span className="block leading-4 text-white/34">
                Move across the map to inspect coordinates.
              </span>
            )}
          </div>
        </div>

        <div
          className="rounded-xl border px-3 py-2"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="uppercase tracking-[0.22em] text-white/35">
              Scale
            </span>
            <span className="tabular-nums text-white/75">{kmLabel}</span>
          </div>

          <div className="flex items-end gap-3">
            <div
              className="relative shrink-0"
              style={{ width: SCALE_TRACK_PX, height: 18 }}
            >
              <div
                className="absolute inset-x-0 bottom-1 h-px"
                style={{ background: 'rgba(255,255,255,0.16)' }}
              />
              <div
                className="absolute bottom-1 left-0 h-2 w-px rounded-full"
                style={{ background: WORLD_MAP_COLORS.label }}
              />
              <div
                className="absolute bottom-1 left-0 h-0.5 rounded-full"
                style={{
                  width: barPx,
                  background: WORLD_MAP_COLORS.route,
                }}
              />
              <div
                className="absolute bottom-1 h-2 w-px rounded-full"
                style={{
                  left: Math.max(barPx - 1, 0),
                  background: WORLD_MAP_COLORS.label,
                }}
              />
            </div>

            <span className="text-[10px] uppercase tracking-[0.18em] text-white/28">
              Ground
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
