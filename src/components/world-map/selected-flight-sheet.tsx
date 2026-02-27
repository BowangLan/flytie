import { useAction, useQuery } from 'convex/react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Clock3,
  Compass,
  Gauge,
  Plane,
  Radar,
  TowerControl,
} from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { useFlightsStore } from '#/store/flights-store'
import { useSelectedFlightStore } from '#/store/selected-flight.store'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'

function fmtNumber(n: number, digits = 0) {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits })
}

function fmtTime(unixSec?: number) {
  if (unixSec == null) return null
  return new Date(unixSec * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function fmtRelativeTime(unixSec?: number) {
  if (unixSec == null) return null
  const deltaSec = Math.max(0, Math.floor(Date.now() / 1000 - unixSec))
  if (deltaSec < 60) return `${deltaSec}s ago`
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`
  return `${Math.floor(deltaSec / 3600)}h ago`
}

function fmtAirport(
  code: string,
  airport: { name: string; iata_code?: string } | null | undefined,
) {
  return code
  // if (!airport) return code
  // const suffix = airport.iata_code ? ` (${airport.iata_code})` : ''
  // return `${airport.name}${suffix}`
}

function MetricCard({
  label,
  value,
  icon,
  accent = 'text-cyan-300',
}: {
  label: string
  value: string
  icon: ReactNode
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900/65 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-neutral-400">
        <span className={accent}>{icon}</span>
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums text-neutral-100">
        {value}
      </div>
    </div>
  )
}

export function SelectedFlightSheet() {
  const selectedIcao24 = useSelectedFlightStore((state) => state.selectedIcao24)
  const setSelectedIcao24 = useSelectedFlightStore(
    (state) => state.setSelectedIcao24,
  )
  const flightDetail = useSelectedFlightStore((state) => state.flightDetail)
  const setFlightDetail = useSelectedFlightStore(
    (state) => state.setFlightDetail,
  )
  const isFetchingFlightDetail = useSelectedFlightStore(
    (state) => state.isFetchingFlightDetail,
  )
  const setIsFetchingFlightDetail = useSelectedFlightStore(
    (state) => state.setIsFetchingFlightDetail,
  )
  const selectedFlight = useFlightsStore((state) =>
    selectedIcao24 ? state.map.get(selectedIcao24) : null,
  )
  const fetchFlightDetailFromOpenSky = useAction(
    api.states.fetchFlightDetailFromOpenSky,
  )

  const hasRouteOnSelectedFlight = Boolean(
    selectedFlight?.estDepartureAirport || selectedFlight?.estArrivalAirport,
  )

  const depAirport = useQuery(
    api.airports.getByCode,
    selectedFlight?.estDepartureAirport
      ? { code: selectedFlight.estDepartureAirport }
      : 'skip',
  )
  const arrAirport = useQuery(
    api.airports.getByCode,
    selectedFlight?.estArrivalAirport
      ? { code: selectedFlight.estArrivalAirport }
      : 'skip',
  )

  useEffect(() => {
    let cancelled = false

    if (!selectedIcao24) {
      setFlightDetail(null)
      setIsFetchingFlightDetail(false)
      return () => {
        cancelled = true
      }
    }

    setIsFetchingFlightDetail(true)
    setFlightDetail(null)

    void fetchFlightDetailFromOpenSky({ icao24: selectedIcao24 })
      .then((detail) => {
        if (cancelled) return
        setFlightDetail(detail)
      })
      .catch((err) => {
        console.error(err)
        if (cancelled) return
        setFlightDetail(null)
      })
      .finally(() => {
        if (cancelled) return
        setIsFetchingFlightDetail(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    fetchFlightDetailFromOpenSky,
    hasRouteOnSelectedFlight,
    selectedIcao24,
    setFlightDetail,
    setIsFetchingFlightDetail,
  ])

  const effectiveDepartureCode =
    selectedFlight?.estDepartureAirport ?? flightDetail?.estDepartureAirport
  const effectiveArrivalCode =
    selectedFlight?.estArrivalAirport ?? flightDetail?.estArrivalAirport
  const effectiveDepartureAirport = selectedFlight?.estDepartureAirport
    ? depAirport
    : flightDetail?.departureAirport
  const effectiveArrivalAirport = selectedFlight?.estArrivalAirport
    ? arrAirport
    : flightDetail?.arrivalAirport
  const effectiveFirstSeen =
    selectedFlight?.firstSeen ?? flightDetail?.firstSeen
  const effectiveLastSeen = selectedFlight?.lastSeen ?? flightDetail?.lastSeen

  const altitudeM = selectedFlight?.baroAltitude ?? selectedFlight?.geoAltitude
  const altitudeFt = altitudeM != null ? fmtNumber(altitudeM * 3.28084) : 'N/A'
  const speedKts =
    selectedFlight?.velocity != null
      ? fmtNumber(selectedFlight.velocity * 1.94384)
      : 'N/A'
  const trackDeg =
    selectedFlight?.trueTrack != null
      ? `${fmtNumber(selectedFlight.trueTrack)}°`
      : 'N/A'
  const vrFpm =
    selectedFlight?.verticalRate != null
      ? Math.round(selectedFlight.verticalRate * 196.85)
      : null
  const verticalRate = vrFpm == null ? 'N/A' : `${fmtNumber(vrFpm)} ft/min`

  const isOnGround = !!selectedFlight?.onGround
  const statusLabel = isOnGround ? 'On Ground' : 'Airborne'

  return (
    <Sheet
      open={!!selectedIcao24}
      onOpenChange={(v) => {
        if (!v) {
          setSelectedIcao24(null)
        }
      }}
    >
      <SheetContent className="overflow-hidden p-0" showCloseButton={false}>
        <SheetHeader>
          <div className="pointer-events-none absolute -top-20 right-0 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-8 h-44 w-44 rounded-full bg-indigo-400/10 blur-3xl" />

          <div className="relative flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="font-mono text-2xl text-white">
                {selectedFlight?.callsign?.trim() ||
                  selectedFlight?.icao24.toUpperCase() ||
                  'Selected Flight'}
              </SheetTitle>
              {selectedFlight?.callsign && (
                <div className="mt-1 text-xs text-neutral-400 uppercase">
                  ICAO24:{' '}
                  <span className="font-mono">{selectedFlight.icao24}</span>
                </div>
              )}
            </div>

            {selectedFlight && (
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase ${isOnGround
                  ? 'border-amber-300/40 bg-amber-300/15 text-amber-100'
                  : 'border-emerald-300/40 bg-emerald-300/15 text-emerald-100'
                  }`}
              >
                {statusLabel}
              </span>
            )}
          </div>

          {selectedFlight?.originCountry && (
            <div className="relative mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs text-neutral-300">
              <Plane className="size-3.5 text-cyan-200" />
              {selectedFlight.originCountry}
            </div>
          )}
        </SheetHeader>

        {!selectedFlight ? (
          <div className="m-4 rounded-xl border border-dashed border-white/15 bg-neutral-900/60 p-5 text-sm text-neutral-300">
            Flight data is currently unavailable for this aircraft.
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto p-4">
            <div className="rounded-xl border border-white/10 bg-neutral-900/70 p-3.5">
              {/* <div className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
                Route
              </div> */}
              {effectiveDepartureCode || effectiveArrivalCode ? (
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="text-[10px] tracking-[0.12em] text-neutral-500 uppercase">
                      From
                    </div>
                    <div className="flex items-center gap-1">
                      <div
                        className="truncate text-lg font-bold text-neutral-100"
                        title={
                          effectiveArrivalAirport?.name ??
                          effectiveArrivalCode ??
                          ''
                        }
                        style={{
                          opacity: !!effectiveDepartureCode ? 1 : 0.5,
                        }}

                      >
                        {effectiveDepartureCode
                          ? fmtAirport(
                            effectiveDepartureCode,
                            effectiveDepartureAirport,
                          )
                          : 'N/A'}
                      </div>
                      <div className="text-lg font-mono">
                        {fmtTime(effectiveFirstSeen ?? undefined) ?? 'N/A'}
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="size-4 text-neutral-500" />

                  <div className="min-w-0 text-right">
                    <div className="text-[10px] tracking-[0.12em] text-neutral-500 uppercase">
                      To
                    </div>
                    <div className="flex flex-row-reverse items-center gap-1">
                      <div
                        className="truncate text-lg font-bold text-neutral-100"
                        title={
                          effectiveArrivalAirport?.name ??
                          effectiveArrivalCode ??
                          ''
                        }
                        style={{
                          opacity: !!effectiveArrivalCode ? 1 : 0.5,
                        }}
                      >
                        {effectiveArrivalCode
                          ? fmtAirport(
                            effectiveArrivalCode,
                            effectiveArrivalAirport,
                          )
                          : 'N/A'}
                      </div>
                      <div className="text-lg font-mono">
                        {fmtTime(effectiveLastSeen ?? undefined) ?? 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-neutral-400">
                  {isFetchingFlightDetail
                    ? 'Fetching route information from OpenSky...'
                    : 'No route information available.'}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                label="Altitude"
                value={`${altitudeFt} ft`}
                icon={<TowerControl className="size-3.5" />}
              />
              <MetricCard
                label="Speed"
                value={`${speedKts} kts`}
                icon={<Gauge className="size-3.5" />}
                accent="text-emerald-300"
              />
              <MetricCard
                label="Track"
                value={trackDeg}
                icon={<Compass className="size-3.5" />}
                accent="text-indigo-300"
              />
              <MetricCard
                label="Vertical Rate"
                value={verticalRate}
                icon={
                  vrFpm == null ? (
                    <Activity className="size-3.5" />
                  ) : vrFpm > 50 ? (
                    <ArrowUp className="size-3.5" />
                  ) : vrFpm < -50 ? (
                    <ArrowDown className="size-3.5" />
                  ) : (
                    <ArrowRight className="size-3.5" />
                  )
                }
                accent={
                  vrFpm == null
                    ? 'text-cyan-300'
                    : vrFpm > 50
                      ? 'text-emerald-300'
                      : vrFpm < -50
                        ? 'text-rose-300'
                        : 'text-amber-300'
                }
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-neutral-900/70 p-3.5">
              <div className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
                Timeline
              </div>
              <div className="space-y-2 text-sm text-neutral-300">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-neutral-500">
                    Last transponder contact
                  </span>
                  <span className="font-mono tabular-nums">
                    {fmtRelativeTime(selectedFlight.lastContact) ?? 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-neutral-500">Position timestamp</span>
                  <span className="font-mono tabular-nums">
                    {fmtRelativeTime(selectedFlight.timePosition) ?? 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-neutral-500">Data source</span>
                  <span className="font-mono">
                    #{selectedFlight.positionSource}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
