import { create } from 'zustand'

export const REPLAY_HISTORY_WINDOW_MS = 2 * 60 * 60 * 1000
export const TIMELINE_FUTURE_WINDOW_MS = 6 * 60 * 60 * 1000

type ReplayTimelineState = {
  scrubbedTimestamp: number | null
  setScrubbedTimestamp: (timestamp: number | null) => void
  resetToLive: () => void
}

export const useReplayTimelineStore = create<ReplayTimelineState>()((set) => ({
  scrubbedTimestamp: null,
  setScrubbedTimestamp: (timestamp) => set({ scrubbedTimestamp: timestamp }),
  resetToLive: () => set({ scrubbedTimestamp: null }),
}))
