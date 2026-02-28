import { useEffect, useMemo, useRef, useState } from 'react'
import { Radio, SkipForward } from 'lucide-react'
import {
  REPLAY_HISTORY_WINDOW_MS,
  TIMELINE_FUTURE_WINDOW_MS,
  useReplayTimelineStore,
} from '#/store/replay-timeline-store'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatAxisLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)
}

function formatActiveTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(timestamp)
}

function formatReplayOffset(timestamp: number, now: number) {
  const diffMinutes = Math.round((timestamp - now) / 60_000)
  if (diffMinutes === 0) return 'Live'
  const absMinutes = Math.abs(diffMinutes)
  const hours = Math.floor(absMinutes / 60)
  const minutes = absMinutes % 60
  const amount = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  return diffMinutes < 0 ? `${amount} behind live` : `${amount} ahead`
}

export function ReplayTimeline() {
  const scrubbedTimestamp = useReplayTimelineStore(
    (state) => state.scrubbedTimestamp,
  )
  const setScrubbedTimestamp = useReplayTimelineStore(
    (state) => state.setScrubbedTimestamp,
  )
  const resetToLive = useReplayTimelineStore((state) => state.resetToLive)
  const [now, setNow] = useState(() => Date.now())
  const railRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  const windowStart = now - REPLAY_HISTORY_WINDOW_MS
  const windowEnd = now + TIMELINE_FUTURE_WINDOW_MS
  const activeTimestamp = scrubbedTimestamp ?? now
  const replayTimestamp = Math.min(activeTimestamp, now)
  const activeRatio = clamp(
    (activeTimestamp - windowStart) / (windowEnd - windowStart),
    0,
    1,
  )
  const nowRatio = clamp((now - windowStart) / (windowEnd - windowStart), 0, 1)

  const ticks = useMemo(() => {
    const stepMs = 60 * 60 * 1000
    const firstTick =
      Math.ceil(windowStart / stepMs) * stepMs
    const values: number[] = []
    for (let value = firstTick; value <= windowEnd; value += stepMs) {
      values.push(value)
    }
    return values
  }, [windowEnd, windowStart])

  const updateFromPointer = (clientX: number) => {
    const rail = railRef.current
    if (!rail) return
    const bounds = rail.getBoundingClientRect()
    const ratio = clamp((clientX - bounds.left) / bounds.width, 0, 1)
    const nextTimestamp = windowStart + ratio * (windowEnd - windowStart)
    setScrubbedTimestamp(nextTimestamp >= now ? null : nextTimestamp)
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-4 sm:px-6">
      <div className="pointer-events-auto mx-auto max-w-6xl rounded-3xl border border-white/10 bg-neutral-950/88 p-4 shadow-[0_-16px_48px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
              <Radio className="size-3.5 text-cyan-300" />
              World replay
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-sm text-white">
                {formatActiveTimestamp(activeTimestamp)}
              </span>
              <span className="text-xs text-neutral-400">
                {formatReplayOffset(replayTimestamp, now)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={resetToLive}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300/60 hover:bg-cyan-300/15"
          >
            <SkipForward className="size-3.5" />
            Live
          </button>
        </div>

        <div
          ref={railRef}
          className="relative h-16 touch-none select-none"
          onPointerDown={(event) => {
            updateFromPointer(event.clientX)
            const target = event.currentTarget
            target.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
            updateFromPointer(event.clientX)
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
          }}
        >
          <div className="absolute inset-x-0 top-6 h-2 rounded-full bg-white/8" />
          <div
            className="absolute top-6 h-2 rounded-full bg-gradient-to-r from-cyan-500/50 to-cyan-300/25"
            style={{ left: 0, width: `${nowRatio * 100}%` }}
          />
          <div
            className="absolute top-4 bottom-0 w-px bg-cyan-300/80"
            style={{ left: `${nowRatio * 100}%` }}
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-cyan-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-950">
              Now
            </div>
          </div>
          <div
            className="absolute top-2 h-10 w-3 -translate-x-1/2 rounded-full border border-white/20 bg-white shadow-[0_0_24px_rgba(255,255,255,0.2)]"
            style={{ left: `${activeRatio * 100}%` }}
          />

          {ticks.map((tick) => {
            const ratio = clamp(
              (tick - windowStart) / (windowEnd - windowStart),
              0,
              1,
            )
            return (
              <div
                key={tick}
                className="absolute top-5 h-7"
                style={{ left: `${ratio * 100}%` }}
              >
                <div className="h-3 w-px bg-white/20" />
                <div className="mt-2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium tabular-nums text-neutral-500">
                  {formatAxisLabel(tick)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
