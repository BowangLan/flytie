import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  getTracesIndexAction,
  getTracesAction,
} from '#/actions/adsbexchange/traces'
import type { Trace } from '#/actions/adsbexchange/traces'
import { useReplayTimelineStore } from '#/store/replay-timeline-store'
import { createReplayManager } from './replay-manager'
import type { ReplayManager } from './replay-manager'

const REPLAY_MAX_TRACES_PER_DAY = 2000
const REPLAY_BATCH_SIZE = 50
const REPLAY_CONCURRENT_REQUESTS = 4

export function useReplayData(): {
  replayManager: ReplayManager
  replayIcaos: string[]
} {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const replayRef = useRef(createReplayManager())
  const [replayIcaos, setReplayIcaos] = useState<string[]>([])

  const replayDate = useReplayTimelineStore((state) => state.date)
  const setReplayLoading = useReplayTimelineStore((state) => state.setLoading)
  const setReplayLoadingProgress = useReplayTimelineStore(
    (state) => state.setLoadingProgress,
  )
  const setReplayLoadedRange = useReplayTimelineStore(
    (state) => state.setLoadedRange,
  )
  const setReplayTraceCount = useReplayTimelineStore(
    (state) => state.setTraceCount,
  )

  useEffect(() => {
    if (!isClient) return

    let cancelled = false

    async function loadReplayData() {
      setReplayLoading(true)

      console.log(
        `[Replay] Loading traces for ${replayDate.day}/${replayDate.month}/${replayDate.year}`,
      )

      try {
        if (cancelled) return
        const icaoList = await getTracesIndexAction({
          data: {
            day: replayDate.day,
            month: replayDate.month,
            year: replayDate.year,
          },
        })

        const max = Math.min(icaoList.length, REPLAY_MAX_TRACES_PER_DAY)
        const traces: Trace[] = []

        setReplayLoadingProgress({ loaded: 0, total: max })

        for (let i = 0; i < max; i += REPLAY_BATCH_SIZE * REPLAY_CONCURRENT_REQUESTS) {
          console.log(`[Replay] Loading traces ${i} of ${max}`)
          const batchPromises = Array.from(
            { length: REPLAY_CONCURRENT_REQUESTS },
            (_, j) => {
              const start = i + j * REPLAY_BATCH_SIZE
              const batch = icaoList.slice(start, start + REPLAY_BATCH_SIZE)
              return batch.length
                ? getTracesAction({
                    data: {
                      icao24: batch,
                      day: replayDate.day,
                      month: replayDate.month,
                      year: replayDate.year,
                    },
                  })
                : Promise.resolve([])
            },
          )
          const results = await Promise.all(batchPromises)
          traces.push(...results.flat())
          const loaded = Math.min(
            i + REPLAY_BATCH_SIZE * REPLAY_CONCURRENT_REQUESTS,
            max,
          )
          setReplayLoadingProgress({ loaded, total: max })
        }

        console.log(
          `[Replay] Loaded ${traces.length} icaos for ${replayDate.day}/${replayDate.month}/${replayDate.year}`,
        )

        if (cancelled) return

        replayRef.current.setTraces(traces)
        const icaos = replayRef.current.getIcaos()
        setReplayIcaos(icaos)
        setReplayLoadedRange(replayRef.current.getLoadedRange())
        setReplayTraceCount(icaos.length)
        setReplayLoading(false)
      } catch (error) {
        if (cancelled) return
        replayRef.current.clear()
        setReplayIcaos([])
        setReplayLoadedRange(null)
        setReplayTraceCount(0)
        setReplayLoading(false)
        console.error('[Replay] Failed to load replay traces', error)
      }
    }

    // void loadReplayData()

    return () => {
      cancelled = true
    }
  }, [
    isClient,
    replayDate.day,
    replayDate.month,
    replayDate.year,
    setReplayLoadedRange,
    setReplayLoading,
    setReplayLoadingProgress,
    setReplayTraceCount,
  ])

  return {
    replayManager: replayRef.current,
    replayIcaos,
  }
}
