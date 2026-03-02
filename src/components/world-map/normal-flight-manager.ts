import { toast } from 'sonner'
import type { AdsbAircraft } from './flights'

export type NormalFlightManager = {
  clear: () => void
  getAircraft: (icao: string) => AdsbAircraft | null
  getAngle: (icao: string) => number | null
  getIcaos: () => string[]
  getPosition: (icao: string) => [number, number] | null
  setAircraft: (aircraft: AdsbAircraft[]) => void
}

export function createNormalFlightManager(): NormalFlightManager {
  const aircraftByIcao = new Map<string, AdsbAircraft>()

  return {
    clear() {
      aircraftByIcao.clear()
    },

    getAircraft(icao) {
      return aircraftByIcao.get(icao.toLowerCase()) ?? null
    },

    getAngle(icao) {
      const aircraft = aircraftByIcao.get(icao.toLowerCase())
      return aircraft ? aircraft.track : null
    },

    getIcaos() {
      return Array.from(aircraftByIcao.keys())
    },

    getPosition(icao) {
      const aircraft = aircraftByIcao.get(icao.toLowerCase())
      return aircraft ? [aircraft.lon, aircraft.lat] : null
    },

    setAircraft(aircraft) {
      aircraftByIcao.clear()

      for (const item of aircraft) {
        aircraftByIcao.set(item.hex.toLowerCase(), item)
      }
    },
  }
}
