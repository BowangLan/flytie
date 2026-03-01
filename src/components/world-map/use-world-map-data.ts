import { startTransition, useEffect, useMemo, useState } from 'react'
import { getAircraftAllAction } from '#/actions/adsbexchange/aircraft'
import type { AdsbAircraft } from './flights'
import { createWorldMapDataSource } from './data-source'
import type { WorldMapDataSnapshot, WorldMapDataSource } from './data-source'
import { useFlightsStore } from '#/store/flights-store'
import { useSelectedFlightStore } from '#/store/selected-flight.store'

function createDefaultWorldMapDataSource(): WorldMapDataSource {
  return createWorldMapDataSource({
    loadAircraft: async () => {
      return getAircraftAllAction()
    },
  })
}

// TODO: Make this configurable
const REFRESH_INTERVAL_MS = 10_000 // 10 seconds

export function useWorldMapData(
  dataSource?: WorldMapDataSource,
): WorldMapDataSnapshot {
  const selectedIcao24 = useSelectedFlightStore((state) => state.selectedIcao24)
  const [aircraft, setAircraft] = useState<AdsbAircraft[]>([])

  const resolvedDataSource = useMemo(
    () => dataSource ?? createDefaultWorldMapDataSource(),
    [dataSource],
  )

  useEffect(() => {
    let cancelled = false

    const loadAircraft = async () => {
      try {
        const nextAircraft = await resolvedDataSource.loadAircraft()
        if (!cancelled) {
          startTransition(() => {
            setAircraft(nextAircraft)
          })
        }
      } catch (error) {
        console.error('ADSBExchange fetch failed:', error)
      }
    }

    loadAircraft()
    const intervalId = setInterval(loadAircraft, REFRESH_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [resolvedDataSource])
  
  useEffect(() => {
    useFlightsStore
      .getState()
      .setFlightsFromViewport(aircraft, selectedIcao24)
  }, [aircraft, selectedIcao24])

  return { aircraft }
}
