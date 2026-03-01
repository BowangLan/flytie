# Flytie

Flytie is a flight-tracking web app built around a live world map, fast flight lookup, and historical replay for a selected day.

The current app combines:

- live-ish aircraft positions from ADS-B Exchange
- richer selected-flight metadata from AeroDataBox
- a GPU-rendered map stack with deck.gl + MapLibre
- replay trace loading with optional Redis caching
- a TanStack Start + React frontend with Convex-backed actions

This README reflects the current codebase and the implementation notes in [`docs/write-up.md`](/Users/bowanglan/Dev/flytie/docs/write-up.md), [`docs/write-up-2.md`](/Users/bowanglan/Dev/flytie/docs/write-up-2.md), and [`docs/replay-timeline-scrub.md`](/Users/bowanglan/Dev/flytie/docs/replay-timeline-scrub.md).

## Features

- Live global aircraft map
- Flight hover tooltip and selected-flight detail sheet
- Flight search dialog with keyboard shortcut support (`Ctrl/Cmd + K`)
- Route visualization for the selected flight
- Weather radar tile overlay
- Replay mode for historical ADS-B Exchange traces
- Replay timeline with day picker, scrubbing, play/pause, and speed controls
- Early ARTCC airspace boundary support

## Stack

- Bun
- TanStack Start
- React 19
- TanStack Router
- TanStack Query
- Convex
- Zustand
- deck.gl
- MapLibre GL
- Tailwind CSS v4

## Project Structure

- [`src/routes`](/Users/bowanglan/Dev/flytie/src/routes): app routes
- [`src/components/world-map`](/Users/bowanglan/Dev/flytie/src/components/world-map): live map, replay, layers, toolbar, tooltip, selected-flight UI
- [`src/store`](/Users/bowanglan/Dev/flytie/src/store): Zustand stores for flights, selection, and replay timeline state
- [`src/actions/adsbexchange/traces.ts`](/Users/bowanglan/Dev/flytie/src/actions/adsbexchange/traces.ts): server functions for replay trace loading
- [`convex`](/Users/bowanglan/Dev/flytie/convex): backend functions and schema
- [`scripts`](/Users/bowanglan/Dev/flytie/scripts): data prep and ADS-B sample-data exploration scripts
- [`docs`](/Users/bowanglan/Dev/flytie/docs): implementation notes and replay write-ups

## Local Development

Install dependencies:

```bash
bun install
```

Start the frontend:

```bash
bun --bun run dev
```

The dev server runs on `http://localhost:3000`.

If you want the Convex backend running locally as well, start it in a second terminal:

```bash
bunx --bun convex dev
```

## Environment

The current codebase expects:

```bash
VITE_CONVEX_URL=...
CONVEX_DEPLOYMENT=...
```

Optional:

```bash
REDIS_URL=...
OPENSKY_CLIENT_ID=...
OPENSKY_CLIENT_SECRET=...
```

Notes:

- `VITE_CONVEX_URL` is required by the Convex React provider.
- `CONVEX_DEPLOYMENT` is typically set by `convex init` / `convex dev`.
- `REDIS_URL` enables caching for replay trace fetching. Without it, replay still works but falls back to uncached fetches.
- OpenSky credentials are only relevant for older OpenSky-related code paths still present in `convex/`.

Initialize Convex if needed:

```bash
bunx --bun convex init
```

## Scripts

Core app scripts:

```bash
bun --bun run dev
bun --bun run build
bun --bun run preview
bun --bun run test
bun --bun run lint
bun --bun run format
bun --bun run check
```

ADS-B exploration / replay scripts:

```bash
bun run scripts/test-adsb-traces.ts
bun run scripts/test-adsb-hires-traces.ts
bun run scripts/test-adsb-readsb-hist.ts
bun run scripts/adsb-save-day-traces.ts --year 2026 --month 2 --day 1
```

Data-generation scripts:

```bash
bun run scripts/airports-csv-to-jsonl.ts
node scripts/generate-artcc-geojson.mjs
```

## Replay Architecture

Replay is not implemented as buffered live state. It uses ADS-B Exchange daily trace files directly.

Current replay behavior:

- loads the selected day's ICAO index from ADS-B Exchange sample data
- fetches trace files in batches from the server
- caches traces when Redis is available
- stores heavy normalized trace data in a ref-backed replay manager
- keeps only lightweight replay UI state in Zustand
- hides live layers while replay is active and renders replay-only markers

Useful references:

- [`docs/replay-timeline-scrub.md`](/Users/bowanglan/Dev/flytie/docs/replay-timeline-scrub.md)
- [`src/components/world-map/replay-manager.ts`](/Users/bowanglan/Dev/flytie/src/components/world-map/replay-manager.ts)
- [`src/components/world-map/replay-timeline.tsx`](/Users/bowanglan/Dev/flytie/src/components/world-map/replay-timeline.tsx)

## Data Sources

- ADS-B Exchange
  - live aircraft state
  - historical trace replay
- AeroDataBox
  - selected-flight metadata such as airports and schedule details
- OurAirports
  - airport import data used by local scripts / older Convex data paths
- NOAA / NWS
  - ARTCC boundary source used to generate the included GeoJSON

## Known Constraints

- Replay payloads are still expensive for busy days.
- The current replay implementation caps loaded traces per day in the UI.
- Data from ADS-B Exchange and AeroDataBox can disagree, which can affect route accuracy.
- Some legacy OpenSky and airport-import code remains in the repo even though the main live map path now uses ADS-B Exchange.

## Repo Docs

- [`docs/write-up.md`](/Users/bowanglan/Dev/flytie/docs/write-up.md): implementation notes, problems encountered, and feature status
- [`docs/write-up-2.md`](/Users/bowanglan/Dev/flytie/docs/write-up-2.md): project retrospective and architecture decisions
- [`docs/replay-timeline-scrub.md`](/Users/bowanglan/Dev/flytie/docs/replay-timeline-scrub.md): replay system architecture and data flow
- [`CLAUDE.md`](/Users/bowanglan/Dev/flytie/CLAUDE.md): project-specific development notes
