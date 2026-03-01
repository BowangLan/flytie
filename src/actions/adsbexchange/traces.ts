import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { getOrSetMany } from '#/lib/cache'

const BASE_URL = 'https://samples.adsbexchange.com'

export type Trace = {
  icao: string
  r: string
  t: string
  dbFlags: number
  desc: string
  ownOp: string
  year: string
  timestamp: number
  trace: [
    number,    // timestamp (seconds since epoch or relative day time)
    number,    // latitude
    number,    // longitude
    number | string | null, // altitude (feet, can be null or missing)
    number,    // ground speed (knots?)
    number,    // track (degrees)
    number,    // vertical rate (ft/min)
    number | null, // barometric vertical rate (ft/min, can be null)
    any,       // mode-s/adsb msg or object (can be null or object with msg data)
    string,    // type ("adsb_icao" etc)
    number | null, // geometric altitude
    number | null, // vertical rate (duplicate or spare?)
    any,       // reserved / unknown, often null
    any        // reserved / unknown, often null
  ][]
}

type TraceIndex = {
  traces: string[]
}

function getDatePath(year: number, month: number, day: number) {
  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
}

async function getTraceIndex(year: number, month: number, day: number) {
  const datePath = getDatePath(year, month, day)
  const url = `${BASE_URL}/traces/${datePath}/index.json`
  const response = await fetch(url, {
    headers: { 'Accept-Encoding': 'identity' },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch trace index: ${response.status} ${response.statusText}`,
    )
  }

  try {
    const data = await response.json()
    if (
      !data ||
      typeof data !== 'object' ||
      !('traces' in data) ||
      !Array.isArray(data.traces)
    ) {
      throw new Error('Invalid trace index data')
    }
    return data as TraceIndex
  } catch (error) {
    throw new Error(`Failed to parse trace index: ${error}`)
  }
}

function traceCacheKey(icao24: string, year: number, month: number, day: number) {
  const icao = icao24.toLowerCase()
  return `trace:${icao}:${year}:${month}:${day}`
}

async function fetchTraces(
  icao24: string,
  year: number,
  month: number,
  day: number,
): Promise<Trace> {
  const dateStr = getDatePath(year, month, day)
  const xx = icao24.slice(-2).toLowerCase()
  const icao = icao24.toLowerCase()
  const url = `${BASE_URL}/traces/${dateStr}/${xx}/trace_full_${icao}.json`

  const response = await fetch(url, {
    headers: { 'Accept-Encoding': 'identity' },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch traces: ${response.status} ${response.statusText}`,
    )
  }

  try {
    const data = await response.json()
    if (!data || typeof data !== 'object' || !('trace' in data)) {
      throw new Error('Invalid traces data')
    }
    return data as Trace
  } catch (error) {
    throw new Error(`Failed to parse traces: ${error}`)
  }
}

export const getTracesAction = createServerFn()
  .inputValidator(
    z.object({
      icao24: z.array(z.string()),
      year: z.number(),
      month: z.number(),
      day: z.number(),
    }),
  )
  .handler(async ({ data }) => {
    const traces = await getOrSetMany(
      data.icao24.map((icao24) => ({
        key: traceCacheKey(icao24, data.year, data.month, data.day),
        fetcher: () => fetchTraces(icao24, data.year, data.month, data.day),
      })),
    )
    console.log(`[getTracesAction] Loaded ${traces.length} traces`)
    return traces
  })

export const getTracesIndexAction = createServerFn()
  .inputValidator(
    z.object({
      year: z.number(),
      month: z.number(),
      day: z.number(),
    }),
  )
  .handler(async ({ data }) => {
    const index = await getTraceIndex(data.year, data.month, data.day)
    console.log(`[getTracesIndexAction] Loaded ${index.traces.length} traces`)
    return index.traces
  })
