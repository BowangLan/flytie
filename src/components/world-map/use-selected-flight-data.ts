import { useEffect } from 'react'
import { getFlightByIcao24Action } from '#/actions/aerodatabox/flight'
import { useSelectedFlightStore } from '#/store/selected-flight.store'

function createAbortError() {
  return new DOMException('The request was aborted.', 'AbortError')
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal) {
  if (signal.aborted) {
    return Promise.reject(createAbortError())
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(createAbortError())

    signal.addEventListener('abort', onAbort, { once: true })

    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

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

  useEffect(() => {
    if (!selectedIcao24) {
      setAerodataLoading(false)
      setAerodataFlight(null)
      setAerodataError(null)
      return
    }

    const abortController = new AbortController()

    setAerodataLoading(true)
    setAerodataError(null)
    setAerodataFlight(null)

    void abortable(
      getFlightByIcao24Action({ data: { icao24: selectedIcao24 } }),
      abortController.signal,
    )
      .then((flights) => {
        const now = new Date()
        const sortedFlights = [...flights].sort((a, b) => {
          const aTime =
            a.departure.revisedTime?.utc ?? a.departure.scheduledTime?.utc
          const bTime =
            b.departure.revisedTime?.utc ?? b.departure.scheduledTime?.utc
          if (!aTime && !bTime) return 0
          if (!aTime) return 1
          if (!bTime) return -1
          return aTime.localeCompare(bTime)
        })

        const activeFlights = sortedFlights.filter((flight) => {
          if (flight.status === 'Arrived') return false

          const depTime =
            flight.departure.revisedTime?.utc ??
            flight.departure.scheduledTime?.utc
          const arrTime =
            flight.arrival.revisedTime?.utc ?? flight.arrival.scheduledTime?.utc
          if (!depTime || !arrTime) return false

          const depDate = new Date(depTime)
          const arrDate = new Date(arrTime)
          return depDate < now && arrDate > now
        })

        if (activeFlights.length === 0) {
          console.warn(
            '[useSelectedFlightData] no active flights found',
            sortedFlights,
          )
        }

        const fallbackFlight =
          sortedFlights.find((flight) => flight.status === 'Arrived') ??
          sortedFlights.at(0) ??
          null

        if (abortController.signal.aborted) return
        setAerodataFlight(activeFlights[0] ?? fallbackFlight)
      })
      .catch((error) => {
        if (isAbortError(error)) return

        setAerodataError(
          error instanceof Error ? error.message : 'Failed to load',
        )
        setAerodataFlight(null)
      })
      .finally(() => {
        if (abortController.signal.aborted) return
        setAerodataLoading(false)
      })

    return () => {
      abortController.abort()
    }
  }, [
    selectedIcao24,
    setAerodataFlight,
    setAerodataLoading,
    setAerodataError,
  ])
}
