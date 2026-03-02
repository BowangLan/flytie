import { create } from 'zustand'
import type { AdsbAircraft } from '#/components/world-map/flights'

export type TooltipData = { aircraft: AdsbAircraft; x: number; y: number }

const HIDE_DELAY_MS = 120

type TooltipState = {
  tooltip: TooltipData | null
  setTooltip: (data: TooltipData | null) => void
  scheduleHide: (delay?: number) => void
  cancelScheduledHide: () => void
  hoveredIcao24: string | null
  setHoveredIcao24: (icao24: string | null | ((prev: string | null) => string | null)) => void
}

export const useTooltipStore = create<TooltipState>()((set) => {
  let hideTimerId: ReturnType<typeof setTimeout> | null = null

  const cancelScheduledHide = () => {
    if (hideTimerId) {
      clearTimeout(hideTimerId)
      hideTimerId = null
    }
  }

  return {
    tooltip: null,
    hoveredIcao24: null,
    setTooltip: (data) => {
      cancelScheduledHide()
      set({ tooltip: data })
    },
    scheduleHide: (delay = HIDE_DELAY_MS) => {
      cancelScheduledHide()
      hideTimerId = setTimeout(() => {
        hideTimerId = null
        set({ tooltip: null })
      }, delay)
    },
    cancelScheduledHide,
    setHoveredIcao24: (icao24) =>
      set((state) => ({
        hoveredIcao24:
          typeof icao24 === 'function' ? icao24(state.hoveredIcao24) : icao24,
      })),
  }
})
