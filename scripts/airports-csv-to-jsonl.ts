#!/usr/bin/env bun
// Run: bun run scripts/airports-csv-to-jsonl.ts
/**
 * Converts OurAirports airports.csv to JSONL for Convex import.
 * Handles empty cells by omitting optional fields.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CSV_URL =
  'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv'
const OUT_PATH = join(import.meta.dir, '../convex/data/airports.jsonl')

const NUMERIC_FIELDS = new Set([
  'id',
  'latitude_deg',
  'longitude_deg',
  'elevation_ft',
])

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if (inQuotes) {
      current += c
    } else if (c === ',') {
      result.push(current)
      current = ''
    } else {
      current += c
    }
  }
  result.push(current)
  return result
}

async function main() {
  const res = await fetch(CSV_URL)
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
  const text = await res.text()
  const lines = text.split(/\r?\n/).filter(Boolean)
  const header = parseCSVLine(lines[0])
  const rows: Record<string, unknown>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, unknown> = {}
    for (let j = 0; j < header.length; j++) {
      const key = header[j]
      const raw = values[j] ?? ''
      const val = raw.trim()
      if (val === '') continue
      if (NUMERIC_FIELDS.has(key)) {
        const n = Number(val)
        if (!Number.isNaN(n)) row[key] = n
      } else {
        row[key] = val
      }
    }
    rows.push(row)
  }

  const jsonl = rows.map((r) => JSON.stringify(r)).join('\n')
  writeFileSync(OUT_PATH, jsonl, 'utf-8')
  console.log(`Wrote ${rows.length} airports to ${OUT_PATH}`)
}

main().catch(console.error)
