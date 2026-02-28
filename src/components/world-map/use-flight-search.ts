import { useMemo } from 'react'
import type { AdsbAircraft } from './flights'

function normalizeFlightNumber(value: string) {
  return value.replace(/\s+/g, '').toUpperCase()
}

function normalizeQuery(value: string) {
  return value.trim().toUpperCase()
}

export function useFlightSearchIndex(aircraft: AdsbAircraft[]) {
  return useMemo(
    () =>
      aircraft.filter((item) => !!item).map((item) => ({
        aircraft: item,
        icao24: item.hex.trim().toUpperCase(),
        flightNumber: normalizeFlightNumber(item.flight ?? ""),
      })),
    [aircraft],
  )
}

export function searchFlightsLocally(
  index: ReturnType<typeof useFlightSearchIndex>,
  query: string,
) {
  const normalizedQuery = normalizeQuery(query)
  if (!normalizedQuery) return index.slice(0, 8)

  return index
    .filter(
      (item) =>
        item.icao24.includes(normalizedQuery) ||
        item.flightNumber.includes(normalizedQuery),
    )
    .sort((a, b) => {
      const scoreDiff =
        getSearchScore(a, normalizedQuery) - getSearchScore(b, normalizedQuery)
      if (scoreDiff !== 0) return scoreDiff
      return a.icao24.localeCompare(b.icao24)
    })
    .slice(0, 12)
}

function getSearchScore(
  item: ReturnType<typeof useFlightSearchIndex>[number],
  query: string,
) {
  if (item.icao24 === query) return 0
  if (item.flightNumber === query) return 1
  if (item.icao24.startsWith(query)) return 2
  if (item.flightNumber.startsWith(query)) return 3
  if (item.icao24.includes(query)) return 4
  return 5
}
