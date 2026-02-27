import { useMemo } from 'react'
import * as THREE from 'three'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useSelectedFlightStore } from '#/store/selected-flight.store'
import { useFlightsStore } from '#/store/flights-store'
import { WORLD_MAP_COLORS } from '@/lib/world-map-colors'

/** Z-offset so route line renders above country fills, below flight markers. */
const ROUTE_Z = 0.5

export function SelectedFlightRoute() {
  const selectedIcao24 = useSelectedFlightStore((state) => state.selectedIcao24)
  const flightDetail = useSelectedFlightStore((state) => state.flightDetail)
  const selectedFlight = useFlightsStore((state) =>
    selectedIcao24 ? state.map.get(selectedIcao24) : null,
  )

  const depAirport = useQuery(
    api.airports.getByCode,
    selectedFlight?.estDepartureAirport && !flightDetail?.departureAirport
      ? { code: selectedFlight.estDepartureAirport }
      : 'skip',
  )
  const arrAirport = useQuery(
    api.airports.getByCode,
    selectedFlight?.estArrivalAirport && !flightDetail?.arrivalAirport
      ? { code: selectedFlight.estArrivalAirport }
      : 'skip',
  )

  const geometry = useMemo(() => {
    if (!selectedIcao24) return null

    let depLon: number | undefined
    let depLat: number | undefined
    let arrLon: number | undefined
    let arrLat: number | undefined

    if (flightDetail?.departureAirport && flightDetail?.arrivalAirport) {
      const dep = flightDetail.departureAirport
      const arr = flightDetail.arrivalAirport
      if (
        dep.longitude_deg != null &&
        dep.latitude_deg != null &&
        arr.longitude_deg != null &&
        arr.latitude_deg != null
      ) {
        depLon = dep.longitude_deg
        depLat = dep.latitude_deg
        arrLon = arr.longitude_deg
        arrLat = arr.latitude_deg
      }
    } else if (depAirport && arrAirport) {
      if (
        depAirport.longitude_deg != null &&
        depAirport.latitude_deg != null &&
        arrAirport.longitude_deg != null &&
        arrAirport.latitude_deg != null
      ) {
        depLon = depAirport.longitude_deg
        depLat = depAirport.latitude_deg
        arrLon = arrAirport.longitude_deg
        arrLat = arrAirport.latitude_deg
      }
    }

    if (
      depLon == null ||
      depLat == null ||
      arrLon == null ||
      arrLat == null
    ) {
      return null
    }

    const positions = new Float32Array([
      depLon,
      depLat,
      ROUTE_Z,
      arrLon,
      arrLat,
      ROUTE_Z,
    ])
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [
    selectedIcao24,
    flightDetail?.departureAirport,
    flightDetail?.arrivalAirport,
    depAirport,
    arrAirport,
  ])

  if (!geometry) return null

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        color={WORLD_MAP_COLORS.route}
        transparent
      />
    </lineSegments>
  )
}
