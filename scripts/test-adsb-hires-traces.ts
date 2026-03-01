#!/usr/bin/env bun
// Run: bun run scripts/test-adsb-hires-traces.ts
/**
 * Tests hires-traces: same as trace files but 2x per second sample rate.
 * - index.json: { traces: string[] } — list of ICAOs for the day
 * - trace_full_{icao}.json: detail data under .../xx/ where xx = last 2 chars of ICAO
 * https://samples.adsbexchange.com/hires-traces/yyyy/mm/dd/index.json
 * https://samples.adsbexchange.com/hires-traces/yyyy/mm/dd/xx/trace_full_{icao}.json
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

const BASE_URL = 'https://samples.adsbexchange.com'

const DATE = { year: 2026, month: 2, day: 1 }
const DATE_STR = `${DATE.year}/${String(DATE.month).padStart(2, '0')}/${String(DATE.day).padStart(2, '0')}`

const ICAO24 = 'ad7cec'
const XX = ICAO24.slice(-2).toLowerCase()

const OUT_DIR = join(import.meta.dirname, '../.adsb-sample-output/hires-traces')
mkdirSync(OUT_DIR, { recursive: true })

const FETCH_OPTS: RequestInit = { headers: { 'Accept-Encoding': 'identity' } }

function save(name: string, data: unknown) {
  const path = join(OUT_DIR, `${name}.json`)
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`  Saved: ${path}`)
}

async function main() {
  console.log('hires-traces tester')
  console.log(`Index: ${BASE_URL}/hires-traces/${DATE_STR}/index.json`)
  console.log(`ICAO24: ${ICAO24} (xx=${XX})`)
  console.log(`Output: ${OUT_DIR}\n`)

  const indexUrl = `${BASE_URL}/hires-traces/${DATE_STR}/index.json`
  const indexRes = await fetch(indexUrl, FETCH_OPTS)
  console.log(`Index status: ${indexRes.status} ${indexRes.statusText}`)

  const indexData = (await indexRes.json()) as { traces: string[] }
  const traces = indexData.traces ?? []
  console.log(`ICAOs count: ${traces.length}`)
  save('index', indexData)

  const icaoUrl = `${BASE_URL}/hires-traces/${DATE_STR}/${XX}/trace_full_${ICAO24.toLowerCase()}.json`
  console.log(`\nFetching ICAO hires-trace: ${icaoUrl}`)
  const icaoRes = await fetch(icaoUrl, FETCH_OPTS)
  const icaoBuf = Buffer.from(await icaoRes.arrayBuffer())

  console.log(`  Status: ${icaoRes.status} ${icaoRes.statusText}`)
  if (icaoRes.ok && icaoBuf.length > 2 && icaoBuf[0] === 0x1f && icaoBuf[1] === 0x8b) {
    const decompressed = gunzipSync(icaoBuf)
    const text = decompressed.toString('utf-8')
    try {
      const parsed = JSON.parse(text) as { traces?: unknown[]; trace?: unknown[] }
      console.log(`  Decompressed: ${decompressed.length} bytes`)
      const traceCount = parsed.trace?.length ?? 0
      console.log(`  Traces for this ICAO: ${traceCount}`)
      save('icao-hires-trace', parsed)
    } catch {
      save('icao-hires-trace', { _raw: text.slice(0, 5000), _length: text.length })
    }
  } else if (icaoRes.ok) {
    const text = icaoBuf.toString('utf-8')
    try {
      const parsed = JSON.parse(text) as { traces?: unknown[]; trace?: unknown[] }
      const traceCount = parsed.trace?.length ?? 0
      console.log(`  Traces for this ICAO: ${traceCount}`)
      save('icao-hires-trace', parsed)
    } catch {
      save('icao-hires-trace', { status: icaoRes.status, bodyPreview: text.slice(0, 500) })
    }
  } else {
    save('icao-hires-trace', { status: icaoRes.status, bodyPreview: icaoBuf.toString('utf-8').slice(0, 500) })
  }

  console.log('\nDone.')
}

main().catch(console.error)
