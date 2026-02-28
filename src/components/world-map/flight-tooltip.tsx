import type { AdsbAircraft } from './flights'

// ─── Tooltip ──────────────────────────────────────────────────────────────────

export type TooltipData = { aircraft: AdsbAircraft; x: number; y: number }

function fmt(n: number) {
  if (isNaN(n)) return 'N/A'
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function FlightTooltip({
  aircraft,
  x,
  y,
  onMouseEnter,
  onMouseLeave,
}: TooltipData & { onMouseEnter?: () => void; onMouseLeave?: () => void }) {
  const callsign = aircraft.flight?.trim() ?? ''
  const icao24 = aircraft.hex.toUpperCase()
  const altFt = fmt(aircraft.alt_baro)
  const spdKts = fmt(aircraft.gs)
  const vrFpm = Math.round(aircraft.baro_rate)
  const vrArrow = vrFpm > 50 ? '▲' : vrFpm < -50 ? '▼' : '→'

  // Flip tooltip left/up when near right/bottom edge
  const flipX = x > window.innerWidth * 0.65
  const flipY = y > window.innerHeight * 0.65

  return (
    <div
      className="fixed z-50 min-w-36 rounded border border-neutral-700 bg-neutral-900/95 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-sm"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        left: flipX ? x - 12 : x + 12,
        top: flipY ? y - 12 : y + 12,
        transform: `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`,
      }}
    >
      {/* Header: callsign + ICAO */}
      <div className="flex items-baseline gap-2">
        <span className="font-mono font-bold">{callsign || icao24}</span>
        {callsign && (
          <span className="font-mono text-neutral-500">{icao24}</span>
        )}
      </div>

      {/* Registration / type */}
      {(aircraft.r || aircraft.t) && (
        <div className="mt-0.5 text-neutral-400">
          {[aircraft.r, aircraft.t].filter(Boolean).join(' · ')}
        </div>
      )}

      {/* Altitude · speed · vertical rate */}
      {(altFt || spdKts || vrArrow) && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums text-neutral-300">
          {altFt && <span>{altFt} ft</span>}
          {spdKts && <span>{spdKts} kts</span>}
          {vrArrow && vrFpm != null && (
            <span>
              {vrArrow} {fmt(Math.abs(vrFpm))} ft/min
            </span>
          )}
        </div>
      )}

      {/* ADBS does not provide route info */}
      <div className="mt-2 rounded border border-neutral-700/80 bg-neutral-800/60 px-2.5 py-2 text-neutral-500 text-[10px]">
        No route information available
      </div>
    </div>
  )
}
