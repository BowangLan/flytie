import { useAction } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { AdsbAircraft } from './flights'
import type { Feature } from './country'
import { createWorldMapDataSource } from './data-source'
import type {
  WorldMapDataSnapshot,
  WorldMapDataSource,
} from './data-source'
import { useFlightsStore } from '#/store/flights-store'
import { useSelectedFlightStore } from '#/store/selected-flight.store'

function createDefaultWorldMapDataSource(
  fetchAircraftAll: () => Promise<string>,
): WorldMapDataSource {
  return createWorldMapDataSource({
    loadAircraft: async () => {
      const response = await fetchAircraftAll()
      const data = JSON.parse(response) as { ac: AdsbAircraft[] }
      return data.ac
    },
  })
}

export function useWorldMapData(
  dataSource?: WorldMapDataSource,
): WorldMapDataSnapshot {
  const fetchAircraftAll = useAction(api.lib.adbsexchange.fetchAircraftAll)
  const selectedIcao24 = useSelectedFlightStore((state) => state.selectedIcao24)
  const [features, setFeatures] = useState<Feature[]>([])
  const [aircraft, setAircraft] = useState<AdsbAircraft[]>([])

  const resolvedDataSource = useMemo(
    () => dataSource ?? createDefaultWorldMapDataSource(fetchAircraftAll),
    [dataSource, fetchAircraftAll],
  )

  useEffect(() => {
    let cancelled = false

    const loadAircraft = async () => {
      try {
        const nextAircraft = await resolvedDataSource.loadAircraft()
        if (!cancelled) {
          setAircraft(nextAircraft)
        }
      } catch (error) {
        console.error('ADSBExchange fetch failed:', error)
      }
    }

    loadAircraft()

    return () => {
      cancelled = true
    }
  }, [resolvedDataSource])

  useEffect(() => {
    const controller = new AbortController()

    resolvedDataSource
      .loadFeatures(controller.signal)
      .then(setFeatures)
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error('World map GeoJSON fetch failed:', error)
      })

    return () => {
      controller.abort()
    }
  }, [resolvedDataSource])

  useEffect(() => {
    useFlightsStore.getState().setFlightsFromViewport(aircraft, selectedIcao24)
  }, [aircraft, selectedIcao24])

  return { aircraft, features }
}
