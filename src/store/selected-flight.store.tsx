import { create } from 'zustand'
import { useMemo } from 'react'
import type { AerodataboxFlight } from '#/actions/aerodatabox/flight'

export type SelectedFlightState = {
  selectedIcao24: string | null
  setSelectedIcao24: (icao24: string | null) => void
  aerodataFlight: AerodataboxFlight | null
  aerodataLoading: boolean
  aerodataError: string | null
  setAerodataFlight: (flight: AerodataboxFlight | null) => void
  setAerodataLoading: (loading: boolean) => void
  setAerodataError: (error: string | null) => void
}

export const useSelectedFlightStore = create<SelectedFlightState>()((set) => ({
  selectedIcao24: null,
  setSelectedIcao24: (icao24) => set({ selectedIcao24: icao24 }),
  aerodataFlight: null,
  aerodataLoading: false,
  aerodataError: null,
  setAerodataFlight: (flight) => set({ aerodataFlight: flight }),
  setAerodataLoading: (loading) => set({ aerodataLoading: loading }),
  setAerodataError: (error) => set({ aerodataError: error }),
}))

export const useIsFlightSelected = (icao24: string) => {
  const selectedIcao24 = useSelectedFlightStore((state) => state.selectedIcao24)
  return useMemo(() => selectedIcao24 === icao24, [selectedIcao24, icao24])
}
