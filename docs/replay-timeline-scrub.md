# Replay Timeline

The replay system renders historical aircraft positions from ADS-B Exchange daily trace files instead of replaying buffered live map state. When replay is active, the live aircraft layers are hidden and the map renders replay-only points derived from trace interpolation.

## Overview

- Purpose: scrub or play through one day's historical aircraft traces.
- Data source: ADS-B Exchange `traces/yyyy/mm/dd/...` files.
- Rendering model: large trace arrays live in a ref-backed replay manager, not in React or Zustand.
- UI: bottom timeline with day picker, optional custom slider time window, play/pause, and replay speed controls.

## Current Architecture

| File | Role |
|------|------|
| `src/components/world-map/index.tsx` | Loads replay traces for the selected day and switches between live layers and replay layers |
| `src/components/world-map/replay-timeline.tsx` | Timeline UI, day controls, custom time window controls, play/pause, speed dropdown |
| `src/components/world-map/replay-manager.ts` | Normalizes traces into typed arrays and interpolates positions/angles per ICAO |
| `src/components/world-map/world-map-layers.ts` | Deck.gl replay marker layers |
| `src/store/replay-timeline-store.tsx` | Small replay UI state in Zustand |
| `src/actions/adsbexchange/traces.ts` | Server functions for trace index loading and day trace loading |

## Data Flow

1. The user enables replay with the toolbar toggle.
2. `useReplayTimelineStore` holds replay UI state: active flag, current timestamp, selected date, loading state, loaded range, custom time window, and playback state.
3. When the replay date changes, `WorldMap` reloads replay data in an effect.
4. The current implementation calls `getTracesByDateAction` on the server for the selected day.
5. The server function fetches the day's `index.json`, then fetches trace files in batches and returns a bounded set of `Trace[]`.
6. `ReplayManager.setTraces()` normalizes each trace into typed arrays:
   - `t: Float64Array`
   - `lat: Float32Array`
   - `lon: Float32Array`
   - `trk: Float32Array`
7. `ReplayManager` stores the normalized series in a `Map<string, TrackSeries>`.
8. When the slider timestamp changes, the replay deck layer asks the manager for each ICAO's interpolated position and angle.
9. Deck.gl rerenders replay markers directly from those accessors.

## Trace Loading

Replay trace loading lives in `src/actions/adsbexchange/traces.ts`.

- `getTracesIndexAction`
  Returns the list of ICAOs present for a given day from `traces/yyyy/mm/dd/index.json`.

- `getTracesAction`
  Fetches detailed trace files for a provided list of ICAOs.

- `getTracesByDateAction`
  Current replay loader path. It:
  - loads the daily index
  - caps total trace files loaded with `MAX_TRACES_PER_DAY`
  - fetches trace files in batches
  - returns `Trace[]`

The current server-side limit is:

```ts
const MAX_TRACES_PER_DAY = 800
```

That cap exists to keep replay payload size manageable.

## Timestamp Model

Trace tuple timestamps are not assumed to already be full epoch milliseconds.

- `Trace.timestamp` is the base timestamp for the day/trace.
- Each tuple's first element (`row[0]`) may be a relative timestamp.
- `ReplayManager` converts all timestamps to epoch milliseconds once during normalization so they match the slider/store timestamps.

## Interpolation

Interpolation lives in `src/components/world-map/replay-manager.ts`.

Per ICAO:

- the manager keeps a `lastIdx` cache for faster scrubbing
- it first tries a small local search around `lastIdx`
- it falls back to binary search for larger jumps

For a target timestamp:

1. Find the bracket samples `[i, i + 1]`
2. Compute `alpha = (ts - t0) / (t1 - t0)`
3. Interpolate latitude linearly
4. Interpolate longitude with anti-wrap handling across `±180`
5. Interpolate track using shortest-angle interpolation

If the timestamp is outside that ICAO's available trace range, the manager returns `null` and the replay point disappears.

## Rendering

Replay rendering lives in `createReplayMapLayers()` in `src/components/world-map/world-map-layers.ts`.

- Data passed to the replay layer is only the ICAO list.
- The trace arrays themselves are not passed through React props.
- `getPosition` calls `replayManager.getPosition(icao, timestampMs)`
- `getAngle` calls `replayManager.getAngle(icao, timestampMs)`

Replay markers currently update immediately on timestamp changes. Replay-specific deck transitions were removed so points snap to the new interpolated position while dragging.

When replay is active:

- live aircraft layers are not rendered
- replay marker layers are rendered instead
- live hover/tooltip state is cleared

## Timeline UI

The replay timeline currently includes:

- Day selector
  - previous day button
  - native date input
  - next day button
- Optional custom slider window
  - toggle to enable limiting the slider range
  - start time input
  - end time input
- Playback controls
  - play/pause button
  - speed dropdown with labels `1min`, `2min`, `5min`, `10min`, `15min`, `30min`, `60min`
- Slider
  - updates `currentTimestamp` directly on pointer drag
  - uses either the loaded replay range or the custom time window when enabled

The current replay timestamp label uses a 24-hour date-time format.

## Playback

Playback runs inside `ReplayTimeline` with `requestAnimationFrame`.

- `isPlaying` and `playbackSpeed` live in Zustand.
- Playback advances `currentTimestamp` every frame.
- Effective replay speed is `playbackSpeed * 60`.
  - Example: `1min` means `60x`
  - Example: `60min` means `3600x`
- Playback stops automatically when it reaches the active range end.
- If playback starts while the timestamp is already at the end, it resets to the start of the current slider range first.

## Slider Range Rules

The active slider range is:

1. Custom time window range, if enabled
2. Otherwise `loadedRange` from replay traces
3. Otherwise a trivial fallback around the current timestamp

Whenever the selected day, loaded range, or custom time window changes, the store clamps `currentTimestamp` back into the active range.

## Store Shape

The replay Zustand store currently contains:

```ts
active: boolean
currentTimestamp: number
isPlaying: boolean
playbackSpeed: number
date: { year: number; month: number; day: number }
loading: boolean
loadedRange: [number, number] | null
timeWindow: {
  enabled: boolean
  startTime: string
  endTime: string
}
```

## Important Differences From The Old Replay Design

This is no longer the old "buffer live positions and scrub local history" model.

The current system:

- does not use `use-world-map-data` replay buffering
- does not build replay aircraft objects in React state
- does not render live aircraft while replay is active
- does use day-scoped server-fetched traces
- does use a ref-backed replay manager for heavy data

## Current Constraints

- Replay payloads can still be large for busy days.
- The current server path caps traces per day to avoid runaway payloads.
- The selected date is interpreted using UTC-based day/time composition in the replay timeline and store helpers.
- Playback logic currently lives in the timeline component rather than a dedicated controller.

## Future Improvements

- Move playback ticking out of the UI component if replay controls grow more complex.
- Add viewport-aware or search-based ICAO filtering before loading full-day traces.
- Replace the current hard server-side day cap with a more intentional paging or filtering strategy.
- Add restart/skip controls and better playback end-of-range behavior.
