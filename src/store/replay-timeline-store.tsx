import { create } from 'zustand'

export const REPLAY_HISTORY_WINDOW_MS = 2 * 60 * 60 * 1000
export const TIMELINE_FUTURE_WINDOW_MS = 6 * 60 * 60 * 1000

export type ReplayDate = {
  year: number
  month: number
  day: number
}

export type ReplayTimeWindow = {
  enabled: boolean
  startTime: string
  endTime: string
}

type ReplayTimelineState = {
  active: boolean
  setActive: (active: boolean) => void

  currentTimestamp: number
  setCurrentTimestamp: (timestamp: number) => void

  isPlaying: boolean
  setIsPlaying: (isPlaying: boolean) => void

  playbackSpeed: number
  setPlaybackSpeed: (playbackSpeed: number) => void

  date: ReplayDate
  setDate: (date: ReplayDate) => void

  loading: boolean
  setLoading: (loading: boolean) => void

  loadedRange: [number, number] | null
  setLoadedRange: (range: [number, number] | null) => void

  timeWindow: ReplayTimeWindow
  setTimeWindowEnabled: (enabled: boolean) => void
  setTimeWindowStartTime: (startTime: string) => void
  setTimeWindowEndTime: (endTime: string) => void
}

const INITIAL_DATE = {
  year: 2026,
  month: 2,
  day: 1,
} satisfies ReplayDate

const INITIAL_TIME_WINDOW = {
  enabled: false,
  startTime: '00:00',
  endTime: '23:59',
} satisfies ReplayTimeWindow

function parseTimeValue(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return { hours, minutes }
}

function getTimeWindowRangeMs(
  date: ReplayDate,
  timeWindow: ReplayTimeWindow,
): [number, number] | null {
  const start = parseTimeValue(timeWindow.startTime)
  const end = parseTimeValue(timeWindow.endTime)
  if (!start || !end) return null

  const startTimestamp = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    start.hours,
    start.minutes,
  )
  const endTimestamp = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    end.hours,
    end.minutes,
  )

  if (endTimestamp <= startTimestamp) {
    return [startTimestamp, startTimestamp + 60_000]
  }

  return [startTimestamp, endTimestamp]
}

function clampTimestampToActiveRange(state: {
  currentTimestamp: number
  date: ReplayDate
  loadedRange: [number, number] | null
  timeWindow: ReplayTimeWindow
}) {
  const activeRange = state.timeWindow.enabled
    ? getTimeWindowRangeMs(state.date, state.timeWindow)
    : state.loadedRange

  if (!activeRange) return state.currentTimestamp

  const [minTimestamp, maxTimestamp] = activeRange
  return Math.min(maxTimestamp, Math.max(minTimestamp, state.currentTimestamp))
}

export const useReplayTimelineStore = create<ReplayTimelineState>()((set) => ({
  active: false,
  setActive: (active) => set({ active }),

  currentTimestamp: Date.now(),
  setCurrentTimestamp: (timestamp) => set({ currentTimestamp: timestamp }),

  isPlaying: false,
  setIsPlaying: (isPlaying) => set({ isPlaying }),

  playbackSpeed: 1,
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),

  date: INITIAL_DATE,
  setDate: (date) =>
    set((state) => {
      const nextState = { ...state, date }
      return {
        currentTimestamp: clampTimestampToActiveRange(nextState),
        date,
      }
    }),

  loading: false,
  setLoading: (loading) => set({ loading }),

  loadedRange: null,
  setLoadedRange: (loadedRange) =>
    set((state) => {
      if (!loadedRange) return { loadedRange }

      const [minTimestamp, maxTimestamp] = loadedRange
      const nextTimestamp =
        state.currentTimestamp < minTimestamp || state.currentTimestamp > maxTimestamp
          ? minTimestamp
          : state.currentTimestamp

      return {
        currentTimestamp: state.timeWindow.enabled
          ? clampTimestampToActiveRange(state)
          : nextTimestamp,
        loadedRange,
      }
    }),

  timeWindow: INITIAL_TIME_WINDOW,
  setTimeWindowEnabled: (enabled) =>
    set((state) => {
      const timeWindow = { ...state.timeWindow, enabled }
      return {
        currentTimestamp: clampTimestampToActiveRange({ ...state, timeWindow }),
        timeWindow,
      }
    }),
  setTimeWindowStartTime: (startTime) =>
    set((state) => {
      const timeWindow = { ...state.timeWindow, startTime }
      return {
        currentTimestamp: clampTimestampToActiveRange({ ...state, timeWindow }),
        timeWindow,
      }
    }),
  setTimeWindowEndTime: (endTime) =>
    set((state) => {
      const timeWindow = { ...state.timeWindow, endTime }
      return {
        currentTimestamp: clampTimestampToActiveRange({ ...state, timeWindow }),
        timeWindow,
      }
    }),
}))

export const useReplayDataLoader = () => {

}
