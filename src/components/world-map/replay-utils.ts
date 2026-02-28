import type { AdsbAircraft } from './flights'
import { REPLAY_HISTORY_WINDOW_MS } from '#/store/replay-timeline-store'

export type AircraftHistorySample = {
  timestamp: number
  lat: number
  lon: number
  track: number
  alt_baro: number
  alt_geom: number
  baro_rate: number
  geom_rate: number
  gs: number
  ias: number
  mach: number
  mag_heading: number
  nav_altitude_fms?: number
  nav_altitude_mcp?: number
  nav_heading?: number
  nav_qnh?: number
  oat?: number
  roll: number
  seen: number
  seen_pos: number
  tas: number
  track_rate: number
  true_heading: number
  wd?: number
  ws?: number
}

export type AircraftHistoryEntry = {
  latest: AdsbAircraft
  samples: AircraftHistorySample[]
}

export type AircraftHistoryMap = Map<string, AircraftHistoryEntry>

const ANGLE_KEYS = new Set([
  'track',
  'mag_heading',
  'nav_heading',
  'true_heading',
  'wd',
])

function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function createAircraftHistorySample(
  aircraft: AdsbAircraft,
  timestamp: number,
): AircraftHistorySample {
  return {
    timestamp,
    lat: aircraft.lat,
    lon: aircraft.lon,
    track: aircraft.track,
    alt_baro: aircraft.alt_baro,
    alt_geom: aircraft.alt_geom,
    baro_rate: aircraft.baro_rate,
    geom_rate: aircraft.geom_rate,
    gs: aircraft.gs,
    ias: aircraft.ias,
    mach: aircraft.mach,
    mag_heading: aircraft.mag_heading,
    nav_altitude_fms: aircraft.nav_altitude_fms,
    nav_altitude_mcp: aircraft.nav_altitude_mcp,
    nav_heading: aircraft.nav_heading,
    nav_qnh: aircraft.nav_qnh,
    oat: aircraft.oat,
    roll: aircraft.roll,
    seen: aircraft.seen,
    seen_pos: aircraft.seen_pos,
    tas: aircraft.tas,
    track_rate: aircraft.track_rate,
    true_heading: aircraft.true_heading,
    wd: aircraft.wd,
    ws: aircraft.ws,
  }
}

function interpolateAngle(start: number, end: number, t: number) {
  const delta = ((end - start + 540) % 360) - 180
  return (start + delta * t + 360) % 360
}

function interpolateLongitude(start: number, end: number, t: number) {
  let delta = end - start
  if (delta > 180) delta -= 360
  if (delta < -180) delta += 360
  const value = start + delta * t
  return ((value + 540) % 360) - 180
}

function interpolateValue(
  key: keyof AircraftHistorySample,
  start: number,
  end: number,
  t: number,
) {
  if (key === 'lon') return interpolateLongitude(start, end, t)
  if (ANGLE_KEYS.has(key)) return interpolateAngle(start, end, t)
  return start + (end - start) * t
}

function findBoundingSamples(
  samples: AircraftHistorySample[],
  timestamp: number,
): [AircraftHistorySample | null, AircraftHistorySample | null] {
  if (samples.length === 0) return [null, null]

  let low = 0
  let high = samples.length - 1

  while (low <= high) {
    const mid = (low + high) >> 1
    const sampleTimestamp = samples[mid]?.timestamp ?? 0
    if (sampleTimestamp === timestamp) {
      return [samples[mid], samples[mid]]
    }
    if (sampleTimestamp < timestamp) {
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return [samples[high] ?? null, samples[low] ?? null]
}

export function appendAircraftSnapshot(
  history: AircraftHistoryMap,
  aircraft: AdsbAircraft[],
  timestamp: number,
) {
  const cutoff = timestamp - REPLAY_HISTORY_WINDOW_MS
  const seenThisTick = new Set<string>()

  for (const item of aircraft) {
    const icao24 = item.hex.toLowerCase()
    seenThisTick.add(icao24)

    const sample = createAircraftHistorySample(item, timestamp)
    const current = history.get(icao24)
    if (!current) {
      history.set(icao24, { latest: item, samples: [sample] })
      continue
    }

    current.latest = item
    const lastSample = current.samples.at(-1)
    if (
      !lastSample ||
      lastSample.timestamp !== timestamp ||
      lastSample.lat !== sample.lat ||
      lastSample.lon !== sample.lon ||
      lastSample.track !== sample.track
    ) {
      current.samples.push(sample)
    } else {
      current.samples[current.samples.length - 1] = sample
    }

    while ((current.samples[0]?.timestamp ?? timestamp) < cutoff) {
      current.samples.shift()
    }
  }

  for (const [icao24, entry] of history) {
    while ((entry.samples[0]?.timestamp ?? timestamp) < cutoff) {
      entry.samples.shift()
    }
    if (entry.samples.length === 0 && !seenThisTick.has(icao24)) {
      history.delete(icao24)
    }
  }
}

export function buildReplayAircraft(
  history: AircraftHistoryMap,
  timestamp: number,
): AdsbAircraft[] {
  const replayedAircraft: AdsbAircraft[] = []

  for (const entry of history.values()) {
    const [previous, next] = findBoundingSamples(entry.samples, timestamp)
    if (!previous && !next) continue

    const start = previous ?? next
    const end = next ?? previous
    if (!start || !end) continue

    const duration = Math.max(1, end.timestamp - start.timestamp)
    const rawT = start === end ? 0 : (timestamp - start.timestamp) / duration
    const t = Math.min(1, Math.max(0, rawT))
    const nextAircraft = { ...entry.latest }

    const keys = Object.keys(start) as Array<keyof AircraftHistorySample>
    for (const key of keys) {
      if (key === 'timestamp') continue
      const startValue = toFiniteNumber(start[key])
      const endValue = toFiniteNumber(end[key])

      if (startValue != null && endValue != null) {
        ;(nextAircraft as Record<string, unknown>)[key] = interpolateValue(
          key,
          startValue,
          endValue,
          t,
        )
        continue
      }

      ;(nextAircraft as Record<string, unknown>)[key] =
        end[key] ?? start[key] ?? (nextAircraft as Record<string, unknown>)[key]
    }

    replayedAircraft.push(nextAircraft)
  }

  return replayedAircraft
}
