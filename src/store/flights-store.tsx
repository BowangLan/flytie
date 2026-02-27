import type { Flight } from '#/components/world-map/flights'
import { create } from 'zustand'

export type FlightsState = {
  map: Map<string, Flight> // icao24 -> Flight
}

export type FlightsAction = {
  addFlights: (flights: Flight[]) => void
  removeFlight: (icao24: string) => void
  clear: () => void
}

export const useFlightsStore = create<FlightsState & FlightsAction>()((set) => ({
  map: new Map(),
  addFlights: (flights) => set((state) => {
    const newMap = new Map(state.map)
    for (const flight of flights) {
      newMap.set(flight.icao24, flight)
    }
    return { map: newMap }
  }),
  removeFlight: (icao24) => set((state) => {
    const newMap = new Map(state.map)
    newMap.delete(icao24)
    return { map: newMap }
  }),
  clear: () => set({ map: new Map() }),
}))