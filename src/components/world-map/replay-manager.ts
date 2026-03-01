import type { Trace } from '#/actions/adsbexchange/traces'

type TrackSeries = {
  t: Float64Array
  lat: Float32Array
  lon: Float32Array
  trk: Float32Array | null
  lastIdx: number
  minTimestamp: number
  maxTimestamp: number
}

type ReplaySnapshot = {
  position: [number, number]
  angle: number | null
}

export type ReplayManager = {
  clear: () => void
  getIcaos: () => string[]
  getLoadedRange: () => [number, number] | null
  getPosition: (icao: string, tsMs: number) => [number, number] | null
  getAngle: (icao: string, tsMs: number) => number | null
  setTraces: (traces: Trace[]) => void
}

function normalizeTimestampMs(baseTimestampSec: number, sampleTimestamp: number) {
  const absoluteTimestampSec =
    sampleTimestamp < 10_000_000 ? baseTimestampSec + sampleTimestamp : sampleTimestamp

  return absoluteTimestampSec * 1000
}

function lerp(start: number, end: number, alpha: number) {
  return start + (end - start) * alpha
}

function lerpAngle(start: number, end: number, alpha: number) {
  const delta = ((end - start + 540) % 360) - 180
  return (start + delta * alpha + 360) % 360
}

function lerpLongitude(start: number, end: number, alpha: number) {
  let adjustedEnd = end
  while (adjustedEnd - start > 180) adjustedEnd -= 360
  while (adjustedEnd - start < -180) adjustedEnd += 360

  const next = lerp(start, adjustedEnd, alpha)
  return ((next + 540) % 360) - 180
}

function normalizeTrace(trace: Trace): TrackSeries | null {
  const sampleCount = trace.trace.length
  if (sampleCount === 0) return null

  const timestamps = new Float64Array(sampleCount)
  const latitudes = new Float32Array(sampleCount)
  const longitudes = new Float32Array(sampleCount)
  const tracks = new Float32Array(sampleCount)

  let validCount = 0

  for (const row of trace.trace) {
    const timestampMs = normalizeTimestampMs(trace.timestamp, row[0])
    const latitude = row[1]
    const longitude = row[2]
    const track = row[5]

    if (
      !Number.isFinite(timestampMs) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue
    }

    timestamps[validCount] = timestampMs
    latitudes[validCount] = latitude
    longitudes[validCount] = longitude
    tracks[validCount] = Number.isFinite(track) ? track : Number.NaN
    validCount += 1
  }

  if (validCount === 0) return null

  const normalizedTimestamps = timestamps.slice(0, validCount)
  const normalizedLatitudes = latitudes.slice(0, validCount)
  const normalizedLongitudes = longitudes.slice(0, validCount)
  const normalizedTracks = tracks.slice(0, validCount)

  return {
    t: normalizedTimestamps,
    lat: normalizedLatitudes,
    lon: normalizedLongitudes,
    trk: normalizedTracks,
    lastIdx: 0,
    minTimestamp: normalizedTimestamps[0],
    maxTimestamp: normalizedTimestamps[validCount - 1],
  }
}

function findBracketIndex(series: TrackSeries, timestampMs: number) {
  const lastBracketStart = Math.min(
    series.lastIdx,
    Math.max(0, series.t.length - 2),
  )
  const quickLow = Math.max(0, lastBracketStart - 8)
  const quickHigh = Math.min(series.t.length - 2, lastBracketStart + 8)

  for (let index = quickLow; index <= quickHigh; index += 1) {
    if (series.t[index] <= timestampMs && timestampMs <= series.t[index + 1]) {
      series.lastIdx = index
      return index
    }
  }

  let low = 0
  let high = series.t.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const midValue = series.t[mid]

    if (midValue === timestampMs) {
      const nextIndex = Math.min(mid, series.t.length - 2)
      series.lastIdx = nextIndex
      return nextIndex
    }

    if (midValue < timestampMs) {
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  const nextIndex = Math.max(0, Math.min(low - 1, series.t.length - 2))
  series.lastIdx = nextIndex
  return nextIndex
}

function getSnapshotForSeries(
  series: TrackSeries,
  timestampMs: number,
): ReplaySnapshot | null {
  if (timestampMs < series.minTimestamp || timestampMs > series.maxTimestamp) {
    return null
  }

  if (series.t.length === 1) {
    const firstTrack = series.trk?.[0] ?? Number.NaN
    return {
      position: [series.lon[0], series.lat[0]],
      angle: Number.isFinite(firstTrack) ? firstTrack : null,
    }
  }

  const bracketIndex = findBracketIndex(series, timestampMs)
  const nextIndex = Math.min(bracketIndex + 1, series.t.length - 1)
  const startTimestamp = series.t[bracketIndex]
  const endTimestamp = series.t[nextIndex]

  if (endTimestamp <= startTimestamp) {
    const track = series.trk?.[bracketIndex] ?? Number.NaN
    return {
      position: [series.lon[bracketIndex], series.lat[bracketIndex]],
      angle: Number.isFinite(track) ? track : null,
    }
  }

  const alpha = (timestampMs - startTimestamp) / (endTimestamp - startTimestamp)
  const startTrack = series.trk?.[bracketIndex] ?? Number.NaN
  const endTrack = series.trk?.[nextIndex] ?? Number.NaN

  return {
    position: [
      lerpLongitude(series.lon[bracketIndex], series.lon[nextIndex], alpha),
      lerp(series.lat[bracketIndex], series.lat[nextIndex], alpha),
    ],
    angle:
      Number.isFinite(startTrack) && Number.isFinite(endTrack)
        ? lerpAngle(startTrack, endTrack, alpha)
        : Number.isFinite(startTrack)
          ? startTrack
          : Number.isFinite(endTrack)
            ? endTrack
            : null,
  }
}

export function createReplayManager(): ReplayManager {
  const seriesByIcao = new Map<string, TrackSeries>()
  let loadedRange: [number, number] | null = null

  return {
    clear() {
      seriesByIcao.clear()
      loadedRange = null
    },

    getIcaos() {
      return Array.from(seriesByIcao.keys())
    },

    getLoadedRange() {
      return loadedRange
    },

    getPosition(icao, timestampMs) {
      return (
        getSnapshot(seriesByIcao.get(icao.toLowerCase()) ?? null, timestampMs)
          ?.position ?? null
      )
    },

    getAngle(icao, timestampMs) {
      return (
        getSnapshot(seriesByIcao.get(icao.toLowerCase()) ?? null, timestampMs)
          ?.angle ?? null
      )
    },

    setTraces(traces) {
      seriesByIcao.clear()
      loadedRange = null

      let minTimestamp = Number.POSITIVE_INFINITY
      let maxTimestamp = Number.NEGATIVE_INFINITY

      for (const trace of traces) {
        const series = normalizeTrace(trace)
        if (!series) continue

        const icao = trace.icao.toLowerCase()
        seriesByIcao.set(icao, series)
        minTimestamp = Math.min(minTimestamp, series.minTimestamp)
        maxTimestamp = Math.max(maxTimestamp, series.maxTimestamp)
      }

      if (Number.isFinite(minTimestamp) && Number.isFinite(maxTimestamp)) {
        loadedRange = [minTimestamp, maxTimestamp]
      }
    },
  }
}

function getSnapshot(series: TrackSeries | null, timestampMs: number) {
  if (!series) return null
  return getSnapshotForSeries(series, timestampMs)
}
