#!/usr/bin/env bun
// Run: bun run scripts/test-adsb-readsb-hist.ts
/**
 * Tests readsb-hist: snapshots of all global airborne traffic (every 5s from May 2020, 60s prior).
 * URL format: https://samples.adsbexchange.com/readsb-hist/yyyy/mm/dd/{HHMMSS}Z.json.gz
 * Example: https://samples.adsbexchange.com/readsb-hist/2026/02/01/001545Z.json.gz
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

const BASE_URL = 'https://samples.adsbexchange.com'

const DATE = { year: 2026, month: 2, day: 1 }
const TIME_UTC = '001545' // HHMMSS
const DATE_STR = `${DATE.year}/${String(DATE.month).padStart(2, '0')}/${String(DATE.day).padStart(2, '0')}`

const OUT_DIR = join(import.meta.dirname, '../.adsb-sample-output/readsb-hist')
mkdirSync(OUT_DIR, { recursive: true })

const FETCH_OPTS: RequestInit = { headers: { 'Accept-Encoding': 'identity' } }

function save(name: string, data: unknown) {
  const path = join(OUT_DIR, `${name}.json`)
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`  Saved: ${path}`)
}

async function main() {
  const sampleUrl = `${BASE_URL}/readsb-hist/${DATE_STR}/${TIME_UTC}Z.json.gz`
  console.log('readsb-hist tester')
  console.log(`URL: ${sampleUrl}`)
  console.log(`Output: ${OUT_DIR}\n`)

  const fileRes = await fetch(sampleUrl, FETCH_OPTS)
  const fileBuf = Buffer.from(await fileRes.arrayBuffer())

  console.log(`Status: ${fileRes.status} ${fileRes.statusText}`)

  if (fileRes.ok) {
    let text: string
    if (fileBuf.length > 2 && fileBuf[0] === 0x1f && fileBuf[1] === 0x8b) {
      text = gunzipSync(fileBuf).toString('utf-8')
      console.log(`  Decompressed: ${text.length} bytes`)
    } else {
      text = fileBuf.toString('utf-8')
      console.log(`  Raw: ${text.length} bytes`)
    }
    const data = JSON.parse(text) as { aircraft?: unknown[] }
    console.log('data.aircraft.length:', data.aircraft?.length ?? 0)
    save('sample', data)
  } else {
    save('sample-error', { status: fileRes.status, url: sampleUrl, body: fileBuf.toString('utf-8').slice(0, 500) })
  }

  console.log('\nDone.')
}

main().catch(console.error)
