import { create } from 'zustand'

type FlightSearchState = {
  open: boolean
  setOpen: (open: boolean) => void
  toggleOpen: () => void
}

export const useFlightSearchStore = create<FlightSearchState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggleOpen: () => set((state) => ({ open: !state.open })),
}))
