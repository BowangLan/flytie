# Flytie Project Write-Up

## Project Summary

Original project requirements document:

- Lark wiki: <https://vjpy1wmaye58.jp.larksuite.com/wiki/EcBKwo5JQivmiFkKhOBjqc3ypac>

This write-up is a retrospective on what I actually built, the problems I ran into, and what I learned while working from that original requirements doc.

Flytie is a flight-tracking web app centered around an interactive world map. The core experience is:

- seeing live aircraft positions across the globe
- selecting a flight to view richer flight details
- visualizing route progress and projected routing
- searching for flights quickly
- replaying historical movement for a given day

The app is built with:

- TanStack Start and React
- Zustand for local app state
- deck.gl + MapLibre for map rendering
- ADS-B Exchange sample data for live-ish aircraft state and historical traces
- AeroDataBox for richer flight metadata
- Redis/Upstash-backed caching for heavier replay requests

## What I Built

This project started around the night of Feb 27, 2026.

At a high level, I built a flight-tracking map that lets users:

- view live aircraft positions globally
- select flights and inspect richer flight details
- see route progress and visual routing
- search for flights quickly
- replay historical aircraft movement for a selected day

## Implementation Timeline

### February 27, 2026

- Initialized the app and landing route
- Set up the first world map and flight rendering
- Added tooltip, selected-flight state, detail sheet, and route work
- Tried multiple approaches for departure/destination data
- Switched away from OpenSky and introduced ADS-B Exchange + AeroDataBox
- Refactored the world map data flow

### February 28, 2026

- Switched rendering to deck.gl and MapLibre
- Improved detail-sheet and legend UI
- Added weather overlay
- Refactored world-map layers and styling
- Tried adding ARTCC/airspace boundaries
- Fixed marker angle issues
- Improved selected-flight lookup and route calculations
- Added early timeline scrub support
- Added search dialog

### March 1, 2026

- Implemented replay using ADS-B Exchange historical traces
- Optimized replay fetching and timeline behavior
- Added more caching
- Changed route rendering to use great-circle logic
- Moved selected-aircraft lookup into the flights store
- Added hit-target layers for marker interaction
- Fixed flight-marker flicker
- Tuned interaction constants and layer ordering

## Main Problems I Ran Into

### 1. No single clean flight-data source

Different APIs exposed different parts of the problem:

- live aircraft positions/state vectors
- departure and destination data
- all state vectors (positions & angles) for an active flight
- airport metadata
- full-day or historical traces

OpenSky was useful at first, but it did not reliably give me the complete shape of data I wanted for the product. In particular:

- departure/destination coverage was incomplete from `/status/all` endpoint response
- `/flights` data was constrained and not a good match for frequent global refreshes
- `/flights` only allows fetching on a 2-hour interval
- from logs, each `/flights` fetch only returned around 5-30 flights, which left most state vectors without departure/destination data
- I repeatedly ran into `429 Too Many Requests`

That pushed me toward a multi-source architecture.

### 2. Inconsistent data across providers

Even after switching providers, data alignment was messy. I ran into mismatches between ADS-B Exchange aircraft state and AeroDataBox flight metadata, which affected:

- selected-flight matching
- flight route rendering
- progress calculation
- departure/arrival interpretation

This showed up as cases where the visual route looked wrong or where provider data disagreed with external references such as PlaneFinder.

### 3. Early rendering approach did not scale well

The first rendering direction used `react-three-fiber` and a more custom map treatment with data from a github repo. That caused multiple issues:

- hover and click interaction stopped working reliably after updates because of how `react-three-fiber` works
- frame rate dropped when moving around and zooming while rendering thousands of flights
- the hand-drawn map direction looked very rough especially when zoomed in

The switch to deck.gl + MapLibre solved a large part of this.

### 4. Marker interaction was harder than expected

Rendering thousands of small moving aircraft markers introduced a surprisingly stubborn interaction problem:

- hard-to-hit markers
- flicker during updates
- z-index/layer-order issues
- mismatch between visual marker size and usable interaction area

The eventual solution was not one single fix. It came from combining:

- dedicated hit-target layers
- marker alpha and multiplier tuning
- better selected-aircraft state ownership
- z-index adjustments
- explicit flicker fixes

### 5. Replay data is expensive

Replay introduced a very different scale problem from the live map.

I'm using `Traces Files` from ADS-B Exchange.s historical API. Limitations of this API:

- only provide sample data, specifically the first day of every month since ~2016 for free. 
- Needs to fetch data for each icao & day in a separate requeset. One day has ~10,000+ icaos, making fetching these data during request time impossible. 

To overcome this, I implemented batch fetching on both the frontend (`src/components/world-map/index.tsx:310`) and backend (`src/actions/adsbexchange/traces.ts`), enabling concurrent requests. My initial approach was to fetch all ICAOs in a single request, but I quickly ran into a maximum response size limit at around 800 ICAOs. To work around this, I split the requests—each now fetches data for 50 ICAOs at a time, with up to 4 requests running concurrently via `Promise.all`.

I also put a hard-coded limit on max icaos to be loaded to 2,000 to avoid blowing up memory inside the browser. 

But it still took around half a minite for loading 2,000 icaos for a day. So I added a Redis instance to cache icao & day data as well as day + icao array. This reduced the loading time for 2,000 icaos for a day to ~10s. 

## Key Technical Decisions

### Multi-source data strategy

I chose to use different providers for different jobs instead of forcing one API to do everything:

- ADS-B Exchange for aircraft positions and traces
- AeroDataBox for richer flight details
- airport datasets where needed for geographic metadata

This added integration complexity, but it made the product much more feasible.

### deck.gl + MapLibre over react-three-fiber

This was probably the most important architecture decision in the project. Once the app became map-heavy and data-dense, the GPU-friendly layered map stack was simply a better fit.

### Replay manager outside React state

For replay, I avoided putting all trace data in React or Zustand. Instead, the heavy replay data lives in a ref-backed manager and the UI store only keeps lightweight replay state such as:

- whether replay is active
- current timestamp
- loaded range
- playback settings

That separation was necessary for performance and scrubbing responsiveness.

## Lessons I Learned

### 1. Map rendering technology matters a lot

For a globe/map product with many moving entities, choosing the right rendering stack early matters. `react-three-fiber` was flexible but kind of an overkill, and it was not the right long-term fit for this kind of dense 2D geospatial interaction. deck.gl and MapLibre matched the problem better.

### 2. Data modeling is as important as UI

Most of the complexity in this project did not come from drawing markers. It came from reconciling different notions of:

- aircraft
- flights
- state vectors
- routes
- historical traces

I learned that flight-tracking UI quality depends heavily on how cleanly those concepts are separated.

### 4. Historical replay is a separate product problem

Replay is not just "live map plus a slider." It needs its own data pipeline, loading strategy, interpolation model, and UI rules. Treating replay as a first-class system instead of a small extension was the right choice.

### 5. External APIs define product boundaries

The capabilities and limitations of external data providers directly shaped what I could build. Rate limits, incomplete metadata, and provider disagreement forced architectural decisions that were just as important as any UI decision.

## What Worked Well

- Splitting live position data from richer flight-detail data
- Moving to deck.gl + MapLibre
- Using Zustand for focused UI state
- Keeping replay heavy data outside React state
- Adding caching layers for replay workloads
- Iterating quickly through interaction bugs using small targeted commits

## Data Sources

### OpenSky (no longer using)

- decent docs
- useful early on for `/states/all`
- often ran into `429 Too Many Requests`
- did not provide reliable departure/destination data for the product I wanted to build

### ADS-B Exchange

- became my main source for latest aircraft state vectors
- also became the source for historical replay traces
- nearly no documentation compared with AeroDataBox
- RapidAPI playground: <https://rapidapi.com/adsbx/api/adsbexchange-com1/playground/>
- historical data reference: <https://www.adsbexchange.com/products/historical-data>

### AeroDataBox

- used for flight detail such as departure/arrival airports and times
- much nicer API/documentation experience to work with
- docs: <https://doc.aerodatabox.com/>
- RapidAPI playground: <https://rapidapi.com/aedbx-aedbx/api/aerodatabox/playground>
- endpoint I used as a reference: <https://rapidapi.com/aedbx-aedbx/api/aerodatabox/playground/apiendpoint_37f1f719-ef9e-4596-abf6-b3f882435e4e>

### Airport Data (no longer using)

- I also used airport data for geo location, name, and code metadata
- sources included OurAirports and AeroDataBox
- OurAirports: <https://ourairports.com/data/>

## Rendering Libraries

- MapLibre GL JS: <https://github.com/maplibre/maplibre-gl-js/>
- deck.gl with MapLibre examples: <https://deck.gl/examples/maplibre>

## Features

### Flight Map

Related query:

- get all latest flights in the form of their latest state vectors across the globe

Data-source options:

- OpenSky: `/states/all`
  - worked, but I often ran into `429`
  - no departure/destination data
- ADS-B Exchange (my choice)
  - no departure/destination data
  - better fit for broad aircraft coverage

Current/targeted map features:

- [ ] Flight marker hover tooltip
- [ ] Aircraft icon distinguished by aircraft type, altitude, etc.
- [x] Weather overlay: rough implementation using image tiles from RainViewer
- [ ] Airspace boundaries: partially implemented

### Selected Flights

Related query:

- get flight detail, including departure and arrival location/time

Data-source choice:

- AeroDataBox `GetFlight_FlightNearest`
- reason: it was much nicer to work with than the alternatives

Implemented selected-flight features:

- [x] Flight progress indicator
- [x] Flight number, airline, aircraft type
- [x] Origin and destination airports with IATA/ICAO codes
- [x] Departure and arrival times, including scheduled vs actual/estimated
- [x] Current altitude, speed, heading
- [x] Past visual route
- [x] Predicted flight path/route

### Timeline

Data source:

- ADS-B Exchange historical data

Implemented/known timeline status:

- [x] Implemented data fetching from ADS-B Exchange sample data, cached in Redis by `yyyy-mm-dd-icao`
- [x] Smooth time slider and flight-marker position/angle updates
- [ ] Tooltip and detail sheet for replay flight marker

Known timeline limitations:

- loading data for over roughly 2000 flights in a day can cause issues in server action responses
- even with cache, fetching can take around 10-20 seconds at that scale
- replay still needs better optimization in both cache strategy and returned data shape

## Remaining Gaps / Future Work

- [ ] airspace boundaries are only partially implemented
- [ ] replay still needs stronger filtering or paging for busy days
- [ ] route accuracy can still be affected by provider mismatch
- [ ] tooltip/detail support for replay markers is still incomplete
- [ ] aircraft differentiation could go further by type/category
- [ ] richer airline/branding data is still missing
- [ ] import or create airline data with images
- [ ] hook past visual route up to actual ADS-B Exchange History API data, which likely requires paid access

## Bugs

- visual flight route seems wrong sometimes
  - root cause: mismatch between state vector data from ADS-B Exchange and AeroDataBox flight data
- flight marker flashes when flight positions are updated from polling

## Future Goals

My next steps would be:

1. make replay loading more selective, likely viewport- or search-driven
2. improve flight identity matching across providers
3. finish replay marker tooltip/detail interactions
4. complete airspace overlays
5. connect route history to higher-quality historical path data

## Terms

Different API platforms use different terms to describe the same thing, so in this document I’m using:

- **Aircraft**: aerial objects such as planes or helicopters
- **Flight**: a trip by an aircraft
- **State Vector**: the time, position, velocity, and related state for a flight at a given time
