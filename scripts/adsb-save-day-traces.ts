#!/usr/bin/env bun
// Run: bun run scripts/adsb-save-day-traces.ts [--year YYYY] [--month MM] [--day DD] [--limit N] [--condense]
// e.g. bun run scripts/adsb-save-day-traces.ts --year 2026 --month 2 --day 1
/**
 * Saves all traces for a day to a single condensed JSON file.
 * - Fetches index.json for the day (all ICAOs)
 * - Fetches each trace from traces/yyyy/mm/dd/xx/trace_full_<icao>.json
 * - Writes to .adsb-sample-output/traces/traces-YYYY-MM-DD.json
 *
 * Options:
 *   --limit N    Only fetch first N ICAOs (for testing)
 *   --condense   Strip verbose fields from trace points (keep t, lat, lon, alt, gs, track only)
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = 'https://samples.adsbexchange.com'
const FETCH_OPTS: RequestInit = { headers: { 'Accept-Encoding': 'identity' } }

function getDatePath(year: number, month: number, day: number) {
  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
}

type TracePoint = [
  number, // timestamp
  number, // lat
  number, // lon
  number | string | null, // alt
  number, // ground speed
  number, // track
  number, // vertical rate
  number | null,
  unknown,
  string,
  number | null,
  number | null,
  unknown,
  unknown,
]

type Trace = {
  icao: string
  r?: string
  t?: string
  dbFlags?: number
  desc?: string
  ownOp?: string
  year?: string
  timestamp?: number
  trace: TracePoint[]
}

type CondensedPoint = [number, number, number, number | null, number, number]

function condensePoint(p: TracePoint): CondensedPoint {
  return [p[0], p[1], p[2], typeof p[3] === 'number' ? p[3] : null, p[4], p[5]]
}

async function fetchTraceIndex(year: number, month: number, day: number) {
  const datePath = getDatePath(year, month, day)
  const url = `${BASE_URL}/traces/${datePath}/index.json`
  const res = await fetch(url, FETCH_OPTS)
  if (!res.ok) {
    throw new Error(`Failed to fetch index: ${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as { traces?: string[] }
  if (!data?.traces || !Array.isArray(data.traces)) {
    throw new Error('Invalid trace index data')
  }
  return data.traces
}

async function fetchTrace(
  icao24: string,
  year: number,
  month: number,
  day: number,
): Promise<Trace | null> {
  const dateStr = getDatePath(year, month, day)
  const xx = icao24.slice(-2).toLowerCase()
  const icao = icao24.toLowerCase()
  const url = `${BASE_URL}/traces/${dateStr}/${xx}/trace_full_${icao}.json`

  const res = await fetch(url, FETCH_OPTS)
  if (!res.ok) {
    return null
  }
  try {
    const data = (await res.json()) as Trace
    if (!data?.trace) return null
    return data
  } catch {
    return null
  }
}

async function main() {
  const args = process.argv.slice(2)
  let year = 2026
  let month = 2
  let day = 1
  let limit: number | undefined
  let condense = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--year' && args[i + 1]) {
      year = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--month' && args[i + 1]) {
      month = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--day' && args[i + 1]) {
      day = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--condense') {
      condense = true
    }
  }

  const dateStr = getDatePath(year, month, day)
  const outDir = join(import.meta.dirname, '../.adsb-sample-output/traces')
  mkdirSync(outDir, { recursive: true })
  const outFile = join(outDir, `traces-${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}.json`)

  console.log('save-day-traces')
  console.log(`Date: ${dateStr}`)
  console.log(`Output: ${outFile}`)
  if (limit) console.log(`Limit: first ${limit} ICAOs`)
  if (condense) console.log('Condensed trace format (t, lat, lon, alt, gs, track)')
  console.log('')

  const icaos = await fetchTraceIndex(year, month, day)
  const toFetch = limit ? icaos.slice(0, limit) : icaos
  console.log(`Fetching ${toFetch.length} traces (of ${icaos.length} total)...`)

  const BATCH_SIZE = 10
  const traces: Trace[] = []
  let fetched = 0
  let failed = 0

  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map((icao) => fetchTrace(icao, year, month, day)),
    )
    for (const t of results) {
      if (t) {
        traces.push(t)
        fetched++
      } else {
        failed++
      }
    }
    if ((i + BATCH_SIZE) % 100 === 0 || i + BATCH_SIZE >= toFetch.length) {
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, toFetch.length)}/${toFetch.length}`)
    }
  }

  const output = condense
    ? traces.map((t) => ({
        icao: t.icao,
        r: t.r,
        t: t.t,
        desc: t.desc,
        trace: t.trace.map(condensePoint),
      }))
    : traces

  writeFileSync(outFile, JSON.stringify(output), 'utf-8')
  console.log(`\nSaved ${traces.length} traces to ${outFile}`)
  if (failed > 0) {
    console.log(`  (${failed} ICAOs failed or missing)`)
  }
}

main().catch(console.error)
