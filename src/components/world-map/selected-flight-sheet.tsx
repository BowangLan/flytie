import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Building2,
  Clock,
  Compass,
  Gauge,
  Loader2,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  TowerControl,
  X,
} from 'lucide-react'
import { useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { AerodataboxFlight } from '../../../convex/lib/aerodatabox'
import type { AdsbAircraft } from '#/components/world-map/flights'
import { useFlightsStore } from '#/store/flights-store'
import { useSelectedFlightStore } from '#/store/selected-flight.store'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { Button } from '#/components/ui/button'

function fmtNumber(n: number, digits = 0) {
  if (isNaN(n)) return 'N/A'
  return n.toLocaleString(undefined, { maximumFractionDigits: digits })
}

function fmtRelativeTime(secondsAgo: number) {
  if (secondsAgo < 0) return 'N/A'
  if (secondsAgo < 60) return `${Math.round(secondsAgo)}s ago`
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`
  return `${Math.floor(secondsAgo / 3600)}h ago`
}

/** Extract HH:MM from "YYYY-MM-DD HH:MM" or ISO string */
function extractTime(s: string): string {
  const m = s.match(/(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : s
}

/** Parse UTC string to Date, or null */
function parseUtc(s: string): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/** Format minutes as "Xh Ym" */
function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
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

type SectionProps = {
  aerodataFlight: AerodataboxFlight | null
  selectedAircraft: AdsbAircraft | null
}

/** Derive status from Aerodatabox when available, else ADS-B altitude */
function getStatusLabel(
  aerodataFlight: AerodataboxFlight | null,
  selectedAircraft: AdsbAircraft | null,
): string {
  if (aerodataFlight?.status?.trim()) {
    return aerodataFlight.status.trim()
  }
  const isOnGround = (selectedAircraft?.alt_baro ?? 0) < 500
  return isOnGround ? 'On Ground' : 'Airborne'
}

/** Map status string to badge variant */
function getStatusBadgeVariant(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('cancel') || s.includes('divert') || s.includes('incident'))
    return 'border-rose-300/40 bg-rose-300/15 text-rose-100'
  if (
    s.includes('land') ||
    s.includes('ground') ||
    s.includes('arrived') ||
    s.includes('arrival')
  )
    return 'border-amber-300/40 bg-amber-300/15 text-amber-100'
  if (
    s.includes('active') ||
    s.includes('airborne') ||
    s.includes('enroute') ||
    s.includes('departed')
  )
    return 'border-emerald-300/40 bg-emerald-300/15 text-emerald-100'
  return 'border-cyan-300/40 bg-cyan-300/15 text-cyan-100'
}

function HeaderSection({ aerodataFlight, selectedAircraft, onClose }: SectionProps & { onClose: () => void }) {
  const callsign =
    selectedAircraft?.flight?.trim() ?? aerodataFlight?.callSign?.trim() ?? ''
  const icao24 =
    selectedAircraft?.hex.toUpperCase() ??
    aerodataFlight?.aircraft?.modeS?.toUpperCase() ??
    ''
  const statusLabel = getStatusLabel(aerodataFlight, selectedAircraft)
  const hasStatus =
    aerodataFlight?.status?.trim() || selectedAircraft != null

  return (
    <>
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 flex flex-col gap-2">
          <SheetTitle className="font-mono text-xl font-semibold text-white">
            {callsign || icao24 || 'Selected Flight'}
          </SheetTitle>
          <div className="flex flex-col items-start gap-1">
            <div className="text-xs text-neutral-500">
              ICAO24: <span className="font-mono text-foreground/80 font-semibold">{icao24}</span>
            </div>
            {aerodataFlight?.aircraft?.model?.trim() && (
              <div className="text-xs text-neutral-500">
                Type: <span className="text-foreground/80 font-semibold">
                  {aerodataFlight.aircraft.model.trim()}
                </span>
              </div>
            )}
          </div>
        </div>

        {hasStatus && (
          <span
            className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase ${getStatusBadgeVariant(statusLabel)}`}
          >
            {statusLabel}
          </span>
        )}

        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {(selectedAircraft?.r || selectedAircraft?.t) && (
        <div className="relative mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs text-neutral-400">
          <Plane className="size-3.5 text-neutral-500" />
          {[selectedAircraft.r, selectedAircraft.t].filter(Boolean).join(' · ')}
        </div>
      )}
    </>
  )
}

function GateBadge({
  gate,
  terminal,
  variant,
}: {
  gate?: string
  terminal?: string
  variant: 'departure' | 'arrival'
}) {
  const displayGate = gate ?? '—'
  const displayTerminal = terminal
    ? terminal.toLowerCase().startsWith('terminal')
      ? terminal
      : `Terminal ${terminal}`
    : null
  const Icon = variant === 'departure' ? PlaneTakeoff : PlaneLanding

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5 rounded-2xl bg-[#FFD60A] px-3 py-2">
        <Icon className="size-4 text-black" strokeWidth={2.5} />
        <span className="font-bold text-black">{displayGate}</span>
      </div>
      {displayTerminal && (
        <span className="text-xs text-neutral-400">{displayTerminal}</span>
      )}
    </div>
  )
}

function RouteSection({ aerodataFlight, selectedAircraft }: SectionProps) {
  if (!aerodataFlight) {
    return (
      <div className="text-sm text-neutral-400">
        No route information available.
      </div>
    )
  }

  const dep = aerodataFlight.departure
  const arr = aerodataFlight.arrival
  const distKm = aerodataFlight.greatCircleDistance?.km ?? 0

  const depScheduled = dep.scheduledTime
  const depRevised = dep.revisedTime
  const arrScheduled = arr.scheduledTime
  const arrPredicted = arr.predictedTime

  const depDisplayTime = depRevised?.local ?? depScheduled?.local
  const arrDisplayTime = arrPredicted?.local ?? arrScheduled?.local

  const depTimeStr = depDisplayTime ? extractTime(depDisplayTime) : '--:--'
  const arrTimeStr = arrDisplayTime ? extractTime(arrDisplayTime) : '--:--'

  const depUtc = depScheduled?.utc ? parseUtc(depScheduled.utc) : null
  const arrUtc = arrScheduled?.utc ? parseUtc(arrScheduled.utc) : null
  const durationMinutes =
    depUtc && arrUtc
      ? Math.round((arrUtc.getTime() - depUtc.getTime()) / 60_000)
      : null
  const durationStr = durationMinutes ? fmtDuration(durationMinutes) : '—'

  const totalKm = distKm
  const remainingKm =
    selectedAircraft && totalKm > 0
      ? haversineKm(
        selectedAircraft.lat,
        selectedAircraft.lon,
        arr.airport.location.lat,
        arr.airport.location.lon,
      )
      : null
  const pct =
    totalKm > 0 && remainingKm != null
      ? Math.min(100, Math.max(0, ((totalKm - remainingKm) / totalKm) * 100))
      : null

  return (
    <div className="flex flex-col items-stretch gap-x-4 gap-y-2">
      {/* From To Section */}
      <div className="flex items-center gap-2 relative w-full">
        <div className="absolute inset-0 flex items-center justify-center z-0">
          <Plane className="size-5 text-foreground rotate-45" fill="currentColor" />
        </div>
        <div className="z-1 flex items-center justify-between w-full">
          {/* Left - Departure */}
          <div className='flex items-center gap-2 text-left text-base'>
            {/* Code */}
            <span className="font-bold text-white">
              {dep.airport.iata ?? dep.airport.icao}
            </span>
            {/* Time */}
            <span className="tabular-nums text-white">
              {depTimeStr}
            </span>
          </div>

          {/* Right - Arrival ( code + time ) */}
          <div className='flex items-center gap-2 text-right text-base'>
            {/* Time */}
            <span className="tabular-nums text-white">
              {arrTimeStr}
            </span>
            {/* Code */}
            <span className="font-bold text-white">
              {arr.airport.iata ?? arr.airport.icao}
            </span>
          </div>
        </div>
      </div>

      {/* Departure */}
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <PlaneTakeoff className="size-4 shrink-0 text-neutral-500" />
        <div className="min-w-0">
          <span className="font-bold text-white">
            {dep.airport.iata ?? dep.airport.icao}
          </span>
          <span className="text-neutral-400">
            {' '}
            • {dep.airport.shortName ?? dep.airport.name}
          </span>
        </div>
      </div>

      {/* Arrival */}
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <PlaneLanding className="size-4 shrink-0 text-neutral-500" />
        <div className="min-w-0">
          <span className="font-bold text-white">
            {arr.airport.iata ?? arr.airport.icao}
          </span>
          <span className="text-neutral-400">
            {' '}
            • {arr.airport.shortName ?? arr.airport.name}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      {pct != null && (
        <>
          <div className="h-1.5 w-full rounded-full bg-neutral-700/60 mt-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span className="font-mono tabular-nums">
              {fmtNumber(Math.round(totalKm))} km total
            </span>
            <span className="font-mono tabular-nums">
              {fmtNumber(Math.round(remainingKm!))} km remaining
            </span>
          </div>
        </>
      )}

      {/* Times & duration */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
        <span className="flex items-center gap-1.5 text-sm text-neutral-500 font-mono">
          <Clock className="size-4" />
          {durationStr}
        </span>
      </div>
    </div>
  )
}

function MetricsSection({ selectedAircraft }: SectionProps) {
  const altitudeFt =
    selectedAircraft?.alt_baro != null
      ? fmtNumber(selectedAircraft.alt_baro)
      : 'N/A'
  const speedKts =
    selectedAircraft?.gs != null ? fmtNumber(selectedAircraft.gs) : 'N/A'
  const trackDeg =
    selectedAircraft?.track != null
      ? `${fmtNumber(selectedAircraft.track)}°`
      : 'N/A'
  const vrFpm = selectedAircraft?.baro_rate ?? null
  const verticalRate = vrFpm == null ? 'N/A' : `${fmtNumber(vrFpm)} ft/min`

  return (
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
  )
}

function AirlineSection({ aerodataFlight }: SectionProps) {
  if (!aerodataFlight?.airline) return null

  const airline = aerodataFlight.airline
  const codes = [airline.iata, airline.icao].filter(Boolean).join(' · ')

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900/70 p-3.5">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
        <Building2 className="size-3.5" />
        Airline
      </div>
      <div className="space-y-1.5">
        <div className="text-base font-semibold text-white">{airline.name}</div>
        {codes && (
          <div className="text-xs font-mono text-neutral-500">{codes}</div>
        )}
        {aerodataFlight.isCargo && (
          <span className="inline-block rounded border border-amber-300/40 bg-amber-300/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-200">
            Cargo
          </span>
        )}
      </div>
    </div>
  )
}

function TimelineSection({ selectedAircraft }: SectionProps) {
  const lastContactAgo =
    selectedAircraft?.seen != null
      ? fmtRelativeTime(selectedAircraft.seen)
      : 'N/A'
  const positionAgo =
    selectedAircraft?.seen_pos != null
      ? fmtRelativeTime(selectedAircraft.seen_pos)
      : 'N/A'
  const dataSource = selectedAircraft?.type ?? 'N/A'

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900/70 p-3.5">
      <div className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
        Timeline
      </div>
      <div className="space-y-2 text-sm text-neutral-300">
        <div className="flex items-center justify-between gap-3">
          <span className="text-neutral-500">Last transponder contact</span>
          <span className="font-mono tabular-nums">{lastContactAgo}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-neutral-500">Position update</span>
          <span className="font-mono tabular-nums">{positionAgo}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-neutral-500">Data source</span>
          <span className="font-mono">{dataSource}</span>
        </div>
      </div>
    </div>
  )
}

export function SelectedFlightSheet() {
  const selectedIcao24 = useSelectedFlightStore((state) => state.selectedIcao24)
  const setSelectedIcao24 = useSelectedFlightStore(
    (state) => state.setSelectedIcao24,
  )
  const aerodataFlight = useSelectedFlightStore((state) => state.aerodataFlight)
  const aerodataLoading = useSelectedFlightStore(
    (state) => state.aerodataLoading,
  )
  const aerodataError = useSelectedFlightStore((state) => state.aerodataError)
  const setAerodataFlight = useSelectedFlightStore(
    (state) => state.setAerodataFlight,
  )
  const setAerodataLoading = useSelectedFlightStore(
    (state) => state.setAerodataLoading,
  )
  const setAerodataError = useSelectedFlightStore(
    (state) => state.setAerodataError,
  )
  const selectedAircraft = useFlightsStore((state) =>
    selectedIcao24 ? state.map.get(selectedIcao24) : null,
  )

  const fetchFlightByIcao24 = useAction(api.lib.aerodatabox.fetchFlightByIcao24)

  const isDraggingRef = useRef(false)
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!selectedIcao24) return

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos.current = { x: e.clientX, y: e.clientY }
      isDraggingRef.current = false
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDownPos.current) return
      const d = Math.hypot(
        e.clientX - pointerDownPos.current.x,
        e.clientY - pointerDownPos.current.y,
      )
      if (d > 5) isDraggingRef.current = true
    }
    const onPointerUp = (e: PointerEvent) => {
      if (!isDraggingRef.current) {
        // Canvas clicks are handled by R3F (onClick / onPointerMissed on the Canvas).
        // Don't race with them — if we also call setSelectedIcao24(null) here,
        // React batches both updates and null (called last, after event bubbling)
        // always wins, making every marker click close the sheet.
        const target = e.target as HTMLElement
        if (target.tagName !== 'CANVAS') {
          const sheet = document.querySelector('[data-slot="sheet-content"]')
          if (sheet && !sheet.contains(target)) {
            setSelectedIcao24(null)
          }
        }
      }
      pointerDownPos.current = null
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
    }
  }, [selectedIcao24, setSelectedIcao24])

  useEffect(() => {
    if (!selectedIcao24) {
      setAerodataFlight(null)
      setAerodataError(null)
      return
    }
    setAerodataLoading(true)
    setAerodataError(null)
    fetchFlightByIcao24({ icao24: selectedIcao24 })
      .then((flights) => {
        setAerodataFlight(flights?.[0] ?? null)
      })
      .catch((err) => {
        setAerodataError(err instanceof Error ? err.message : 'Failed to load')
        setAerodataFlight(null)
      })
      .finally(() => setAerodataLoading(false))
  }, [
    selectedIcao24,
    fetchFlightByIcao24,
    setAerodataFlight,
    setAerodataLoading,
    setAerodataError,
  ])

  const sectionProps: SectionProps = {
    aerodataFlight,
    selectedAircraft: selectedAircraft ?? null,
  }

  return (
    <Sheet
      modal={false}
      open={!!selectedIcao24}
      onOpenChange={(v) => {
        if (!v) {
          setSelectedIcao24(null)
        }
      }}
    >
      <SheetContent
        className="overflow-hidden border-neutral-700/50 bg-zinc-950 p-0"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="border-b border-neutral-800 bg-zinc-950 px-4 py-4">
          <HeaderSection {...sectionProps} onClose={() => setSelectedIcao24(null)} />
        </SheetHeader>

        {!selectedAircraft ? (
          <div className="m-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-900/60 p-5 text-sm text-neutral-400">
            Flight data is currently unavailable for this aircraft.
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto p-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4">
              {aerodataLoading ? (
                <div className="flex items-center gap-2 text-sm text-neutral-400">
                  <Loader2 className="size-4 animate-spin" />
                  Loading route…
                </div>
              ) : aerodataError ? (
                <div className="text-sm text-amber-400">{aerodataError}</div>
              ) : (
                <RouteSection {...sectionProps} />
              )}
            </div>

            <AirlineSection {...sectionProps} />
            <MetricsSection {...sectionProps} />
            <TimelineSection {...sectionProps} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
