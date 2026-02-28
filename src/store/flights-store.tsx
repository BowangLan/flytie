import type { AdsbAircraft } from '#/components/world-map/flights'
import { create } from 'zustand'

export type FlightsState = {
  map: Map<string, AdsbAircraft> // icao24 -> aircraft
}

export type FlightsAction = {
  addFlights: (aircraft: AdsbAircraft[]) => void
  /** Replaces store with viewport aircraft; preserves the selected flight if it's no longer in view. */
  setFlightsFromViewport: (
    aircraft: AdsbAircraft[],
    preserveIcao24?: string | null,
  ) => void
  removeFlight: (icao24: string) => void
  clear: () => void
}

export const useFlightsStore = create<FlightsState & FlightsAction>()(
  (set) => ({
    map: new Map(),
    addFlights: (aircraft) =>
      set((state) => {
        const newMap = new Map(state.map)
        for (const ac of aircraft) {
          newMap.set(ac.hex.toLowerCase(), ac)
        }
        return { map: newMap }
      }),
    setFlightsFromViewport: (aircraft, preserveIcao24) =>
      set((state) => {
        const newMap = new Map<string, AdsbAircraft>()
        for (const ac of aircraft) {
          newMap.set(ac.hex.toLowerCase(), ac)
        }
        if (preserveIcao24) {
          const preserved = state.map.get(preserveIcao24)
          if (preserved && !newMap.has(preserveIcao24)) {
            newMap.set(preserveIcao24, preserved)
          }
        }
        return { map: newMap }
      }),
    removeFlight: (icao24) =>
      set((state) => {
        const newMap = new Map(state.map)
        newMap.delete(icao24)
        return { map: newMap }
      }),
    clear: () => set({ map: new Map() }),
  }),
)
