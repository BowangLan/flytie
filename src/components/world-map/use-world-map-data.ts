import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { getAircraftAllAction, getNearbyAircraftAction } from '#/actions/adsbexchange/aircraft'
import type { AdsbAircraft } from './flights'
import { createWorldMapDataSource } from './data-source'
import type { WorldMapDataSnapshot, WorldMapDataSource } from './data-source'
import { createNormalFlightManager } from './normal-flight-manager'
import { useFlightsStore } from '#/store/flights-store'
import { useSelectedFlightStore } from '#/store/selected-flight.store'
import { toast } from 'sonner'
import { REFRESH_INTERVAL_MS } from './world-map-config'
import { useCameraStateStore } from '#/store/camera-state-store'
import type { CameraState } from './map-legend'

function getViewportAircraftParams(cameraState: CameraState): {
  lat: number
  lon: number
  dist: number
} {
  const { lon, lat } = cameraState
  const centerLat = (lat[0] + lat[1]) / 2
  const centerLon = (lon[0] + lon[1]) / 2
  const latSpanKm = Math.abs(lat[1] - lat[0]) * 111.32
  const lonSpanKm =
    Math.abs(lon[1] - lon[0]) * 111.32 * Math.cos((centerLat * Math.PI) / 180)
  const dist = Math.max(
    50,
    Math.sqrt((latSpanKm / 2) ** 2 + (lonSpanKm / 2) ** 2) * 1.2,
  )
  return { lat: centerLat, lon: centerLon, dist }
}

function createDefaultWorldMapDataSource(): WorldMapDataSource {
  return createWorldMapDataSource({
    loadAircraft: async ({ lat, lon, dist }: { lat: number, lon: number, dist: number }) => {
      const now = performance.now()
      // toast.info('Fetching nearby aircraft...')
      try {
        const aircraft = await getNearbyAircraftAction({ data: { lat, lon, dist } })
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
        const cameraState = useCameraStateStore.getState().cameraState
        const params = getViewportAircraftParams(cameraState)
        const nextAircraft = await resolvedDataSource.loadAircraft(params)
        // const nextAircraft = await resolvedDataSource.loadAircraft({ lat: 38, lon: 6, dist: 500 })
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
