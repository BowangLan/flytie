import { create } from 'zustand'
import type { OpenSkyRouteDetail } from '../../convex/states'
import { useMemo } from 'react'

export type SelectedFlightState = {
  selectedIcao24: string | null
  setSelectedIcao24: (icao24: string | null) => void
  flightDetail: OpenSkyRouteDetail | null
  setFlightDetail: (detail: OpenSkyRouteDetail | null) => void
  isFetchingFlightDetail: boolean
  setIsFetchingFlightDetail: (v: boolean) => void
}

export const useSelectedFlightStore = create<SelectedFlightState>()((set) => ({
  selectedIcao24: null,
  setSelectedIcao24: (icao24) =>
    set({
      selectedIcao24: icao24,
      ...(icao24 === null && {
        flightDetail: null,
        isFetchingFlightDetail: false,
      }),
    }),
  flightDetail: null,
  setFlightDetail: (detail) => set({ flightDetail: detail }),
  isFetchingFlightDetail: false,
  setIsFetchingFlightDetail: (v) => set({ isFetchingFlightDetail: v }),
}))

export const useIsFlightSelected = (icao24: string) => {
  const selectedIcao24 = useSelectedFlightStore((state) => state.selectedIcao24)
  return useMemo(() => selectedIcao24 === icao24, [selectedIcao24, icao24]) ?? false
}