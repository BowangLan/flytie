import { useEffect } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useSelectedFlightStore } from '#/store/selected-flight.store'

/**
 * Fetches Aerodatabox flight data when a flight is selected by ICAO24.
 * Updates aerodataFlight, aerodataLoading, and aerodataError in the selected-flight store.
 */
export function useSelectedFlightData() {
  const selectedIcao24 = useSelectedFlightStore((state) => state.selectedIcao24)
  const setAerodataFlight = useSelectedFlightStore(
    (state) => state.setAerodataFlight,
  )
  const setAerodataLoading = useSelectedFlightStore(
    (state) => state.setAerodataLoading,
  )
  const setAerodataError = useSelectedFlightStore(
    (state) => state.setAerodataError,
  )
  const fetchFlightByIcao24 = useAction(api.lib.aerodatabox.fetchFlightByIcao24)

  useEffect(() => {
    if (!selectedIcao24) {
      setAerodataFlight(null)
      setAerodataError(null)
      return
    }
    setAerodataLoading(true)
    setAerodataError(null)
    setAerodataFlight(null)
    fetchFlightByIcao24({ icao24: selectedIcao24 })
      .then((flights) => {
        // Prefer ongoing/active flights (specific statuses); fallback to first if none found.
        // const activeFlight = flights?.find(
        //   (flight) =>
        //     flight.status === 'Departed' ||
        //     flight.status === 'EnRoute' ||
        //     flight.status === 'Approaching' ||
        //     flight.status === 'Delayed' ||
        //     flight.status === 'Diverted',
        // )
        flights.sort((a, b) => {
          const aTime = a.departure.revisedTime?.utc ?? a.departure.scheduledTime?.utc
          const bTime = b.departure.revisedTime?.utc ?? b.departure.scheduledTime?.utc
          if (!aTime && !bTime) return 0
          if (!aTime) return 1
          if (!bTime) return -1
          return aTime.localeCompare(bTime)
        })
        const activeFlight = flights.filter((flight) => {
          // time looks like "2026-02-28 20:55Z"
          // filter out future flights & past flights
          const depTime = flight.departure.revisedTime?.utc ?? flight.departure.scheduledTime?.utc
          const arrTime = flight.arrival.revisedTime?.utc ?? flight.arrival.scheduledTime?.utc
          if (!depTime || !arrTime) return false
          const depDate = new Date(depTime)
          const arrDate = new Date(arrTime)
          return depDate < new Date() && arrDate > new Date()
        })
        if (activeFlight.length === 0) {
          console.warn('[useSelectedFlightData] no active flights found', flights)
        }
        setAerodataFlight(activeFlight[0] ?? flights[0] ?? null)
      })
      .catch((err) => {
        setAerodataError(err instanceof Error ? err.message : 'Failed to load')
        setAerodataFlight(null)
      })
      .finally(() => setAerodataLoading(false))
  }, [
    selectedIcao24,
    fetchFlightByIcao24,
    setAerodataFlight,
    setAerodataLoading,
    setAerodataError,
  ])
}
