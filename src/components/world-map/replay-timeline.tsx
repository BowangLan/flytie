import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  RadarIcon,
  PauseIcon,
  PlayIcon,
} from 'lucide-react'
import type { ReplayDate } from '#/store/replay-timeline-store'
import { useReplayTimelineStore } from '#/store/replay-timeline-store'
import { cn } from '#/lib/utils'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '../ui/button'

const PLAYBACK_SPEED_OPTIONS = [1, 2, 5, 10, 15, 30, 60] as const

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function replayDurationLabel(rangeMs: number) {
  const totalMinutes = Math.max(0, Math.round(rangeMs / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes}m window`
  if (minutes === 0) return `${hours}h window`
  return `${hours}h ${minutes}m window`
}

function formatReplayTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(timestamp)
}

function formatDateValue(date: { year: number; month: number; day: number }) {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(
    date.day,
  ).padStart(2, '0')}`
}

function shiftReplayDate(
  date: { year: number; month: number; day: number },
  dayOffset: number,
) {
  const nextDate = new Date(Date.UTC(date.year, date.month - 1, date.day))
  nextDate.setUTCDate(nextDate.getUTCDate() + dayOffset)

  return {
    year: nextDate.getUTCFullYear(),
    month: nextDate.getUTCMonth() + 1,
    day: nextDate.getUTCDate(),
  }
}

function parseTimeValue(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return { hours, minutes }
}

function getTimeWindowRangeMs(
  date: ReplayDate,
  startTime: string,
  endTime: string,
): [number, number] | null {
  const start = parseTimeValue(startTime)
  const end = parseTimeValue(endTime)
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

export function ReplayTimeline() {
  const active = useReplayTimelineStore((state) => state.active)
  const currentTimestamp = useReplayTimelineStore((state) => state.currentTimestamp)
  const isPlaying = useReplayTimelineStore((state) => state.isPlaying)
  const playbackSpeed = useReplayTimelineStore((state) => state.playbackSpeed)
  const replayDate = useReplayTimelineStore((state) => state.date)
  const loadedRange = useReplayTimelineStore((state) => state.loadedRange)
  const loading = useReplayTimelineStore((state) => state.loading)
  const timeWindow = useReplayTimelineStore((state) => state.timeWindow)
  const setDate = useReplayTimelineStore((state) => state.setDate)
  const setIsPlaying = useReplayTimelineStore((state) => state.setIsPlaying)
  const setPlaybackSpeed = useReplayTimelineStore(
    (state) => state.setPlaybackSpeed,
  )
  const setCurrentTimestamp = useReplayTimelineStore((state) => state.setCurrentTimestamp)
  const setTimeWindowEnabled = useReplayTimelineStore(
    (state) => state.setTimeWindowEnabled,
  )
  const setTimeWindowStartTime = useReplayTimelineStore(
    (state) => state.setTimeWindowStartTime,
  )
  const setTimeWindowEndTime = useReplayTimelineStore(
    (state) => state.setTimeWindowEndTime,
  )
  const trackRef = useRef<HTMLDivElement>(null)
  const playbackFrameRef = useRef<number | null>(null)
  const playbackLastTimeRef = useRef<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const customRange = timeWindow.enabled
    ? getTimeWindowRangeMs(replayDate, timeWindow.startTime, timeWindow.endTime)
    : null
  const minTs = customRange?.[0] ?? loadedRange?.[0] ?? currentTimestamp
  const maxTs = customRange?.[1] ?? loadedRange?.[1] ?? currentTimestamp + 1
  const rangeMs = maxTs - minTs
  const percent = clamp(
    rangeMs <= 0 ? 0 : ((currentTimestamp - minTs) / rangeMs) * 100,
    0,
    100,
  )

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const x = clientX - rect.left
      const pct = clamp(x / rect.width, 0, 1)
      const ts = minTs + pct * rangeMs
      setCurrentTimestamp(ts)
    },
    [minTs, rangeMs, setCurrentTimestamp],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      trackRef.current?.setPointerCapture(e.pointerId)
      setIsDragging(true)
      updateFromClientX(e.clientX)
    },
    [updateFromClientX],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      updateFromClientX(e.clientX)
    },
    [isDragging, updateFromClientX],
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    trackRef.current?.releasePointerCapture(e.pointerId)
    setIsDragging(false)
  }, [])

  const handleDateInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const [year, month, day] = event.target.value.split('-').map(Number)
      if (!year || !month || !day) return
      setDate({ year, month, day })
    },
    [setDate],
  )

  const sliderDisabled = !(timeWindow.enabled || loadedRange)
  const hasLoadedData = Boolean(loadedRange)
  const showLoadingState = loading
  const showEmptyState = !loading && !hasLoadedData
  const statusLabel = showLoadingState
    ? 'Loading replay traces...'
    : showEmptyState
      ? 'No replay data found'
      : formatReplayTimestamp(currentTimestamp)
  const secondaryStatusLabel = showLoadingState
    ? 'Building the timeline window from replay traces.'
    : showEmptyState
      ? timeWindow.enabled
        ? 'No traces matched the current date and time range.'
        : 'Try a different date or narrow the visible time window.'
      : `${replayDurationLabel(rangeMs)}${timeWindow.enabled ? ' (custom)' : ''}`

  useEffect(() => {
    if (!active || loading || sliderDisabled || !isPlaying) {
      if (playbackFrameRef.current != null) {
        cancelAnimationFrame(playbackFrameRef.current)
        playbackFrameRef.current = null
      }
      playbackLastTimeRef.current = null
      return
    }

    const tick = (frameTime: number) => {
      const previousFrameTime = playbackLastTimeRef.current ?? frameTime
      const elapsedMs = frameTime - previousFrameTime
      playbackLastTimeRef.current = frameTime

      const nextTimestamp = currentTimestamp + elapsedMs * playbackSpeed * 60
      if (nextTimestamp >= maxTs) {
        setCurrentTimestamp(maxTs)
        setIsPlaying(false)
        playbackFrameRef.current = null
        playbackLastTimeRef.current = null
        return
      }

      setCurrentTimestamp(nextTimestamp)
      playbackFrameRef.current = requestAnimationFrame(tick)
    }

    playbackFrameRef.current = requestAnimationFrame(tick)

    return () => {
      if (playbackFrameRef.current != null) {
        cancelAnimationFrame(playbackFrameRef.current)
        playbackFrameRef.current = null
      }
      playbackLastTimeRef.current = null
    }
  }, [
    active,
    currentTimestamp,
    isPlaying,
    loading,
    maxTs,
    playbackSpeed,
    setCurrentTimestamp,
    setIsPlaying,
    sliderDisabled,
  ])

  return (
    <AnimatePresence mode="wait" initial={false}>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          data-state="open"
          className={cn(
            "pointer-events-none",
            "fixed inset-x-0 bottom-0 z-20",
            "px-4 pb-4 sm:px-6",
          )}
        >
          <div className="pointer-events-auto mx-auto max-w-6xl rounded-3xl border border-white/10 bg-neutral-950/88 p-4 shadow-[0_-16px_48px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            {showLoadingState ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="overflow-hidden rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(255,255,255,0.03))] p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full border border-cyan-200/25 bg-cyan-300/12 p-2 text-cyan-100">
                    <LoaderCircleIcon className="size-4 animate-spin" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">
                      Building replay timeline
                    </div>
                    <p className="mt-1 text-sm text-cyan-50/75">
                      Fetching traces for {formatDateValue(replayDate)}
                      {timeWindow.enabled
                        ? ` between ${timeWindow.startTime} and ${timeWindow.endTime}.`
                        : '.'}
                    </p>
                    <div className="mt-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="h-10 rounded-xl bg-white/6 motion-safe:animate-pulse" />
                        <div className="h-10 rounded-xl bg-white/6 motion-safe:animate-pulse [animation-delay:120ms]" />
                        <div className="h-10 rounded-xl bg-white/6 motion-safe:animate-pulse [animation-delay:240ms]" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <>
                <div className="mb-3 flex flex-col gap-3 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
                  {/* Date selector */}
                  <div className="flex flex-row items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setDate(shiftReplayDate(replayDate, -1))}
                      >
                        <ChevronLeftIcon />
                      </Button>
                      <input
                        type="date"
                        value={formatDateValue(replayDate)}
                        onChange={handleDateInputChange}
                        className={cn(
                          'h-8 rounded-md border border-white/10 bg-neutral-900 px-2 text-sm text-white',
                          'outline-none focus-visible:border-white/30',
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setDate(shiftReplayDate(replayDate, 1))}
                      >
                        <ChevronRightIcon />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-sm text-white">
                        <input
                          type="checkbox"
                          checked={timeWindow.enabled}
                          onChange={(event) =>
                            setTimeWindowEnabled(event.target.checked)
                          }
                          className="size-4 rounded border-white/10 bg-neutral-900"
                        />
                        Limit slider range
                      </label>
                      <input
                        type="time"
                        value={timeWindow.startTime}
                        onChange={(event) =>
                          setTimeWindowStartTime(event.target.value)
                        }
                        disabled={!timeWindow.enabled}
                        className={cn(
                          'h-8 rounded-md border border-white/10 bg-neutral-900 px-2 text-sm text-white',
                          'outline-none focus-visible:border-white/30 disabled:opacity-50',
                        )}
                      />
                      <span className="text-neutral-500">to</span>
                      <input
                        type="time"
                        value={timeWindow.endTime}
                        onChange={(event) => setTimeWindowEndTime(event.target.value)}
                        disabled={!timeWindow.enabled}
                        className={cn(
                          'h-8 rounded-md border border-white/10 bg-neutral-900 px-2 text-sm text-white',
                          'outline-none focus-visible:border-white/30 disabled:opacity-50',
                        )}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={sliderDisabled || loading}
                        onClick={() => {
                          if (!isPlaying && currentTimestamp >= maxTs) {
                            setCurrentTimestamp(minTs)
                          }
                          setIsPlaying(!isPlaying)
                        }}
                      >
                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                        {isPlaying ? 'Pause' : 'Play'}
                      </Button>
                      <select
                        value={String(playbackSpeed)}
                        disabled={loading}
                        onChange={(event) =>
                          setPlaybackSpeed(Number(event.target.value))
                        }
                        className={cn(
                          'h-8 rounded-md border border-white/10 bg-neutral-900 px-2 text-sm text-white',
                          'outline-none focus-visible:border-white/30 disabled:opacity-50',
                        )}
                      >
                        {PLAYBACK_SPEED_OPTIONS.map((speedOption) => (
                          <option key={speedOption} value={speedOption}>
                            {speedOption}min
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 text-right sm:items-end">
                    <span className='font-mono text-sm'>
                      {statusLabel}
                    </span>
                    <span className='font-mono text-sm'>
                      {secondaryStatusLabel}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <AnimatePresence mode="wait" initial={false}>
                    {showEmptyState ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="rounded-2xl border border-amber-200/14 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(255,255,255,0.03))] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full border border-amber-200/20 bg-amber-300/10 p-2 text-amber-100">
                        <RadarIcon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white">
                          No replay traces in this view
                        </div>
                        <p className="mt-1 text-sm text-amber-50/80">
                          {timeWindow.enabled
                            ? `No traces matched ${formatDateValue(replayDate)} from ${timeWindow.startTime} to ${timeWindow.endTime}.`
                            : `No replay traces were loaded for ${formatDateValue(replayDate)}.`}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/45">
                          Try another date or widen the time range.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                    ) : null}
                  </AnimatePresence>

                <div
                  ref={trackRef}
                  role="slider"
                  aria-valuemin={minTs}
                  aria-valuemax={maxTs}
                  aria-valuenow={currentTimestamp}
                  tabIndex={0}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className={cn(
                    "relative h-4 w-full cursor-pointer select-none rounded-full transition-opacity",
                    "bg-neutral-800",
                    (sliderDisabled || showEmptyState) &&
                      "pointer-events-none opacity-50",
                  )}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.4),rgba(255,255,255,0.12))]"
                    style={{ width: `${percent}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 -ml-px rounded-full bg-white shadow-sm"
                    style={{ left: `${percent}%` }}
                  />
                </div>
              </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
