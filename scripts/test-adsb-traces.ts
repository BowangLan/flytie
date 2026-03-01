#!/usr/bin/env bun
// Run: bun run scripts/test-adsb-traces.ts
/**
 * Tests Trace Files: activity by individual ICAO hex for all aircraft during one 24-hour period.
 * - index.json: all ICAOs for a day (https://samples.adsbexchange.com/traces/yyyy/mm/dd/index.json)
 * - Sub-organized by last two digits of hex code: traces/yyyy/mm/dd/xx/
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

const BASE_URL = 'https://samples.adsbexchange.com'

const DATE = { year: 2026, month: 2, day: 1 }
const DATE_STR = `${DATE.year}/${String(DATE.month).padStart(2, '0')}/${String(DATE.day).padStart(2, '0')}`

const ICAO24 = 'a3bb04'
const XX = ICAO24.slice(-2).toLowerCase()

const OUT_DIR = join(import.meta.dirname, '../.adsb-sample-output/traces')
mkdirSync(OUT_DIR, { recursive: true })

const FETCH_OPTS: RequestInit = { headers: { 'Accept-Encoding': 'identity' } }

function save(name: string, data: unknown) {
  const path = join(OUT_DIR, `${name}.json`)
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`  Saved: ${path}`)
}

function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = []
  const re = /<a\s+href=["']([^"']+)["']/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const href = m[1]
    if (href && href !== '../' && href !== '/' && !href.startsWith('#')) {
      links.push(href.startsWith('http') ? href : new URL(href, baseUrl.endsWith('/') ? baseUrl : baseUrl + '/').href)
    }
  }
  return links
}

async function main() {
  console.log('traces tester')
  console.log(`Date: ${DATE_STR}`)
  console.log(`ICAO24: ${ICAO24} (xx=${XX})`)
  console.log(`Output: ${OUT_DIR}\n`)

  // 1. Fetch index.json for the day (all ICAOs)
  const indexUrl = `${BASE_URL}/traces/${DATE_STR}/index.json`
  console.log(`Fetching day index: ${indexUrl}`)
  const indexRes = await fetch(indexUrl, FETCH_OPTS)
  console.log(`  Status: ${indexRes.status} ${indexRes.statusText}`)
  if (indexRes.ok) {
    const indexData = (await indexRes.json()) as { traces?: string[] }
    const icaos = indexData.traces ?? []
    console.log(`  ICAOs for day: ${icaos.length}`)
    save('day-index', { traces: icaos, count: icaos.length })
  } else {
    save('day-index', { status: indexRes.status, error: await indexRes.text().then((t) => t.slice(0, 500)) })
  }

  // 2. Fetch directory listing for xx bucket
  const dirUrl = `${BASE_URL}/traces/${DATE_STR}/${XX}/`
  console.log(`\nDir URL: ${dirUrl}`)
  const res = await fetch(dirUrl, FETCH_OPTS)
  const buffer = Buffer.from(await res.arrayBuffer())
  const html = buffer.toString('utf-8')

  console.log(`Dir status: ${res.status} ${res.statusText}`)
  const links = extractLinks(html, dirUrl)
  console.log(`Links found: ${links.length}`)
  save('dir-listing', { _links: links, _htmlPreview: html.slice(0, 2000) })

  // 3. Fetch single ICAO trace
  const icaoUrl = `${BASE_URL}/traces/${DATE_STR}/${XX}/trace_full_${ICAO24.toLowerCase()}.json`
  console.log(`\nFetching ICAO trace: ${icaoUrl}`)
  const icaoRes = await fetch(icaoUrl, FETCH_OPTS)

  console.log(`  Status: ${icaoRes.status} ${icaoRes.statusText}`)

  const resText = await icaoRes.text()
  if (icaoRes.ok) {
    const parsed = JSON.parse(resText) as { trace?: unknown[] }
    const traceCount = parsed.trace?.length ?? 0
    console.log(`  Traces for this ICAO: ${traceCount}`)
    save('icao-trace', parsed)
  } else {
    save('icao-trace', { status: icaoRes.status, bodyPreview: resText.slice(0, 500) })
  }

  console.log('\nDone.')
}

main().catch(console.error)
