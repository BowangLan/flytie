import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { State } from 'convex/statesTypes'

// ─── Tooltip ──────────────────────────────────────────────────────────────────

export type TooltipData = { state: State; x: number; y: number }

/** Format airport for display: "Name (IATA)" or "Name" or fallback to code. */
function fmtAirport(
  code: string,
  airport: { name: string; iata_code?: string } | null | undefined,
) {
  if (!airport) return code
  const suffix = airport.iata_code ? ` (${airport.iata_code})` : ''
  return `${airport.name}${suffix}`
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function fmtTime(unixSec?: number) {
  if (unixSec == null) return null
  return new Date(unixSec * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function FlightTooltip({
  state,
  x,
  y,
  onMouseEnter,
  onMouseLeave,
}: TooltipData & { onMouseEnter?: () => void; onMouseLeave?: () => void }) {
  const depAirport = useQuery(
    api.airports.getByCode,
    state.estDepartureAirport ? { code: state.estDepartureAirport } : 'skip',
  )
  const arrAirport = useQuery(
    api.airports.getByCode,
    state.estArrivalAirport ? { code: state.estArrivalAirport } : 'skip',
  )

  const altM = state.baroAltitude ?? state.geoAltitude
  const altFt = altM != null ? fmt(altM * 3.28084) : null
  const spdKts = state.velocity != null ? fmt(state.velocity * 1.94384) : null
  const vrFpm = state.verticalRate != null ? Math.round(state.verticalRate * 196.85) : null
  const vrArrow = vrFpm == null ? null : vrFpm > 50 ? '▲' : vrFpm < -50 ? '▼' : '→'

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
        <span className="font-mono font-bold">{state.callsign ?? state.icao24.toUpperCase()}</span>
        {state.callsign && (
          <span className="font-mono text-neutral-500">{state.icao24}</span>
        )}
      </div>

      {/* Country */}
      <div className="mt-0.5 text-neutral-400">{state.originCountry}</div>

      {/* Altitude · speed · vertical rate */}
      {(altFt || spdKts || vrArrow) && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums text-neutral-300">
          {altFt && <span>{altFt} ft</span>}
          {spdKts && <span>{spdKts} kts</span>}
          {vrArrow && vrFpm != null && (
            <span>{vrArrow} {fmt(Math.abs(vrFpm))} ft/min</span>
          )}
        </div>
      )}

      {/* Route: departure → destination */}
      {(state.estDepartureAirport || state.estArrivalAirport) ? (
        <div className="mt-2 rounded border border-neutral-700/80 bg-neutral-800/60 px-2.5 py-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">From</div>
              <div className="font-mono font-semibold text-white truncate" title={state.estDepartureAirport}>
                {state.estDepartureAirport
                  ? fmtAirport(state.estDepartureAirport, depAirport)
                  : '—'}
              </div>
              {fmtTime(state.firstSeen) && (
                <div className="text-[10px] text-neutral-500 tabular-nums">
                  {fmtTime(state.firstSeen)}
                </div>
              )}
            </div>
            <div className="shrink-0 text-neutral-600" aria-hidden>
              →
            </div>
            <div className="flex-1 min-w-0 text-right">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">To</div>
              <div className="font-mono font-semibold text-white truncate" title={state.estArrivalAirport}>
                {state.estArrivalAirport
                  ? fmtAirport(state.estArrivalAirport, arrAirport)
                  : '—'}
              </div>
              {fmtTime(state.lastSeen) && (
                <div className="text-[10px] text-neutral-500 tabular-nums">
                  {fmtTime(state.lastSeen)}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 rounded border border-neutral-700/80 bg-neutral-800/60 px-2.5 py-2">
          No route information available
        </div>
      )}
    </div>
  )
}
