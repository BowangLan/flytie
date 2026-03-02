import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { getAircraftAllAction } from '#/actions/adsbexchange/aircraft'
import type { AdsbAircraft } from './flights'
import { createWorldMapDataSource } from './data-source'
import type { WorldMapDataSnapshot, WorldMapDataSource } from './data-source'
import { createNormalFlightManager } from './normal-flight-manager'
import { useFlightsStore } from '#/store/flights-store'
import { useSelectedFlightStore } from '#/store/selected-flight.store'
import { toast } from 'sonner'

function createDefaultWorldMapDataSource(): WorldMapDataSource {
  return createWorldMapDataSource({
    loadAircraft: async () => {
      const now = performance.now()
      // toast.info('Fetching nearby aircraft...')
      try {
        const aircraft = await getAircraftAllAction()
        const duration = performance.now() - now
        // toast.success(`Nearby aircraft fetched successfully in ${(duration / 1000).toFixed(2)}s`)
        return aircraft
      } catch (error) {
        const duration = performance.now() - now
        toast.error(`Failed to fetch nearby aircraft in ${(duration / 1000).toFixed(2)}s`)
        return []
      }
    },
  })
}

// TODO: Make this configurable
const REFRESH_INTERVAL_MS = 2_000 // 10 seconds

export function useWorldMapData(
  dataSource?: WorldMapDataSource,
): WorldMapDataSnapshot {
  const selectedIcao24 = useSelectedFlightStore((state) => state.selectedIcao24)
  const [aircraft, setAircraft] = useState<AdsbAircraft[]>([])
  const [lastUpdatedTimestamp, setLastUpdatedTimestamp] = useState(0)
  const [normalFlightIcaos, setNormalFlightIcaos] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const resolvedDataSource = useMemo(
    () => dataSource ?? createDefaultWorldMapDataSource(),
    [dataSource],
  )
  const normalFlightManagerRef = useRef(createNormalFlightManager())

  useEffect(() => {
    if (loading) return

    let cancelled = false

    // toast("useEffect[WorldMapData] triggered")

    const loadAircraft = async () => {
      try {
        setLoading(true)
        const nextAircraft = await resolvedDataSource.loadAircraft()
        const nextUpdatedTimestamp = Date.now()
        if (!cancelled) {
          normalFlightManagerRef.current.setAircraft(nextAircraft)
          startTransition(() => {
            setAircraft(nextAircraft)
            setNormalFlightIcaos(normalFlightManagerRef.current.getIcaos())
            setLastUpdatedTimestamp(nextUpdatedTimestamp)
          })
        }
      } catch (error) {
        console.error('ADSBExchange fetch failed:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAircraft()
    const intervalId = setInterval(loadAircraft, REFRESH_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
      normalFlightManagerRef.current.clear()
    }
  }, [resolvedDataSource])

  useEffect(() => {
    useFlightsStore
      .getState()
      .setFlightsFromViewport(aircraft, selectedIcao24)
  }, [aircraft, selectedIcao24])

  return {
    aircraft,
    lastUpdatedTimestamp,
    normalFlightIcaos,
    normalFlightManager: normalFlightManagerRef.current,
  }
}
