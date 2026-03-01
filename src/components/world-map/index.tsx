import type { PickingInfo } from '@deck.gl/core'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import type { MapRef, ViewStateChangeEvent } from 'react-map-gl/maplibre'
import {
  getTracesIndexAction,
  getTracesAction,
} from '#/actions/adsbexchange/traces'
import type { Trace } from '#/actions/adsbexchange/traces'
import { useReplayTimelineStore } from '#/store/replay-timeline-store'
import { createReplayManager } from './replay-manager'
import type { AdsbAircraft } from './flights'
import { FlightTooltip } from './flight-tooltip'
import type { TooltipData } from './flight-tooltip'
import { SelectedFlightSheet } from './selected-flight-sheet'
import { useSelectedFlightStore } from '#/store/selected-flight.store'
import { MapLegend } from './map-legend'
import type { CameraState } from './map-legend'
import type { WorldMapDataSource } from './data-source'
import { useWorldMapData } from './use-world-map-data'
import {
  buildRouteSegments,
  createReplayMapLayers,
  createWorldMapLayers,
} from './world-map-layers'
import type { RouteSegment } from './world-map-layers'
import { useWeatherRadar } from './use-weather-radar'
import { WorldMapDeckOverlay } from './world-map-deck-overlay'
import { ReplayTimeline } from './replay-timeline'
import {
  INITIAL_VIEW_STATE,
  MAP_STYLE,
  MAX_ZOOM,
  MIN_ZOOM,
  WEATHER_LAYER_ID,
  WEATHER_MAX_ZOOM,
  WEATHER_SOURCE_ID,
  WEATHER_TILE_OPACITY,
  WEATHER_TILE_SIZE,
  WORLD_MAP_BACKGROUND_STYLE,
} from './world-map-config'
import type { CursorCoord } from './world-map-config'
import { applyMapStyleOverrides } from './world-map-style'
import {
  AIRSPACE_BOUNDARIES_DATA_URL,
  AIRSPACE_BOUNDARIES_SOURCE_ID,
  AIRSPACE_BOUNDARY_GLOW_LAYER,
  AIRSPACE_BOUNDARY_LINE_LAYER,
} from './airspace'
import { FlightSearchDialog } from './flight-search-dialog'
import { WorldMapToolbar } from './world-map-toolbar'
import { jsonObjSize, roughObjectSize } from '#/lib/utils'

const REPLAY_MAX_TRACES_PER_DAY = 2000
const REPLAY_BATCH_SIZE = 50
const REPLAY_CONCURRENT_REQUESTS = 4

function chunkIcaos(icaos: readonly string[], size: number) {
  const chunks: string[][] = []

  for (let index = 0; index < icaos.length; index += size) {
    chunks.push(icaos.slice(index, index + size))
  }

  return chunks
}

function isSameCameraState(a: CameraState, b: CameraState) {
  return (
    a.lon[0] === b.lon[0] &&
    a.lon[1] === b.lon[1] &&
    a.lat[0] === b.lat[0] &&
    a.lat[1] === b.lat[1] &&
    a.zoom === b.zoom
  )
}

function getCameraState(map: MapRef | null, zoom: number): CameraState | null {
  if (!map) return null
  const bounds = map.getBounds()

  return {
    lon: [bounds.getWest(), bounds.getEast()],
    lat: [bounds.getSouth(), bounds.getNorth()],
    zoom: 2 ** zoom,
  }
}

export default function WorldMap({
  dataSource,
}: {
  dataSource?: WorldMapDataSource
}) {
  'use no memo'

  const { aircraft } = useWorldMapData(dataSource)
  const isClient = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false,
  )
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [cursorCoord, setCursorCoord] = useState<CursorCoord>(null)
  const [hoveredIcao24, setHoveredIcao24] = useState<string | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>({
    lon: [0, 0],
    lat: [0, 0],
    zoom: 2 ** INITIAL_VIEW_STATE.zoom,
  })
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mapRef = useRef<MapRef | null>(null)
  const cameraStateRef = useRef(cameraState)
  const replayRef = useRef(createReplayManager())
  const [replayIcaos, setReplayIcaos] = useState<string[]>([])
  const setSelectedIcao24 = useSelectedFlightStore(
    (state) => state.setSelectedIcao24,
  )
  const selectedIcao24 = useSelectedFlightStore((state) => state.selectedIcao24)
  const aerodataFlight = useSelectedFlightStore((state) => state.aerodataFlight)
  const replayActive = useReplayTimelineStore((state) => state.active)
  const replayDate = useReplayTimelineStore((state) => state.date)
  const replayTimestamp = useReplayTimelineStore(
    (state) => state.currentTimestamp,
  )
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

  const { data: weatherTileUrl } = useWeatherRadar(isClient, WEATHER_TILE_SIZE)
  const deferredAircraft = useDeferredValue(aircraft)
  const aircraftForRender = replayActive ? [] : aircraft

  const syncCameraState = useCallback((zoom: number) => {
    const nextCameraState = getCameraState(mapRef.current, zoom)
    if (!nextCameraState) return
    if (isSameCameraState(cameraStateRef.current, nextCameraState)) return
    cameraStateRef.current = nextCameraState
    startTransition(() => {
      setCameraState(nextCameraState)
    })
  }, [])

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    applyMapStyleOverrides(map)
    syncCameraState(map.getZoom())
  }, [syncCameraState])

  const handleStyleData = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map || !map.isStyleLoaded()) return
    applyMapStyleOverrides(map)
  }, [])

  const selectedAircraft = useMemo(
    () =>
      selectedIcao24
        ? (aircraftForRender.find((item) => item.hex.toLowerCase() === selectedIcao24) ??
          null)
        : null,
    [aircraftForRender, selectedIcao24],
  )

  const routeSegments = useMemo<RouteSegment[]>(() => {
    const departure = aerodataFlight?.departure.airport.location
    const arrival = aerodataFlight?.arrival.airport.location
    const currentPosition = selectedAircraft
      ? { lon: selectedAircraft.lon, lat: selectedAircraft.lat }
      : undefined
    const track = selectedAircraft?.track

    if (!departure && !arrival) return []
    if (!departure && !currentPosition) return []
    if (!arrival && !currentPosition) return []

    return buildRouteSegments({
      departureLocation: departure,
      arrivalLocation: arrival,
      currentPosition,
      track,
    })
  }, [aerodataFlight, selectedAircraft])

  const handleHover = useEffectEvent((info: PickingInfo<AdsbAircraft>) => {
    const aircraftObject = info.object ?? null
    const nextHoveredIcao24 = aircraftObject?.hex.toLowerCase() ?? null

    setHoveredIcao24((current) =>
      current === nextHoveredIcao24 ? current : nextHoveredIcao24,
    )
    document.body.style.cursor = aircraftObject ? 'pointer' : ''

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }

    if (aircraftObject && Number.isFinite(info.x) && Number.isFinite(info.y)) {
      setTooltip({
        aircraft: aircraftObject,
        x: info.x,
        y: info.y,
      })
      return
    }

    hideTimerRef.current = setTimeout(() => setTooltip(null), 120)
  })

  const layers = useMemo(() => {
    if (replayActive) {
      return createReplayMapLayers({
        hoveredIcao24,
        replayIcaos,
        replayManager: replayRef.current,
        selectedIcao24,
        timestampMs: replayTimestamp,
      })
    }

    return createWorldMapLayers({
      aircraft: aircraftForRender,
      hoveredIcao24,
      onHover: handleHover,
      onSelect: setSelectedIcao24,
      routeSegments,
      selectedAircraft,
      selectedIcao24,
    })
  }, [
    aircraftForRender,
    handleHover,
    hoveredIcao24,
    replayActive,
    replayIcaos,
    replayTimestamp,
    routeSegments,
    selectedAircraft,
    selectedIcao24,
    setSelectedIcao24,
  ])

  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!replayActive) return

    setTooltip(null)
    setHoveredIcao24(null)
    document.body.style.cursor = ''
  }, [replayActive])

  useEffect(() => {
    if (!isClient) return

    let cancelled = false

    async function loadReplayData() {
      setReplayLoading(true)

      console.log(`[Replay] Loading traces for ${replayDate.day}/${replayDate.month}/${replayDate.year}`)

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
          if (cancelled) return
          console.log(`[Replay] Loading traces ${i} of ${max}`)
          const batchPromises = Array.from({ length: REPLAY_CONCURRENT_REQUESTS }, (_, j) => {
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
          })
          const results = await Promise.all(batchPromises)
          traces.push(...results.flat())
          const loaded = Math.min(
            i + REPLAY_BATCH_SIZE * REPLAY_CONCURRENT_REQUESTS,
            max,
          )
          setReplayLoadingProgress({ loaded, total: max })
        }

        console.log(`[Replay] Loaded ${traces.length} icaos for ${replayDate.day}/${replayDate.month}/${replayDate.year}`)

        // log total data size in MB
        // const totalSize = roughObjectSize(traces)
        // console.log(`[Replay] Total data size: ${totalSize / 1024 / 1024} MB`)
        // // log total data size in string length
        // const totalStringLength = JSON.stringify(traces).length
        // console.log(`[Replay] Total string length: ${totalStringLength} characters`)
        // // log total string length in bytes calculated from the string length
        // const jsonSize = jsonObjSize(traces)
        // console.log(`[Replay] Total string length in bytes: ${jsonSize} bytes (${jsonSize / 1024 / 1024} MB)`)

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

    void loadReplayData()

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

  useEffect(() => {
    if (!selectedAircraft || !mapRef.current) return

    mapRef.current.easeTo({
      center: [selectedAircraft.lon, selectedAircraft.lat],
      duration: 700,
      essential: true,
    })
  }, [selectedAircraft])

  if (!isClient) {
    return (
      <>
        <div className="fixed inset-0 z-0" style={WORLD_MAP_BACKGROUND_STYLE} />
        <SelectedFlightSheet />
      </>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-0" style={WORLD_MAP_BACKGROUND_STYLE}>
        <Map
          ref={mapRef}
          reuseMaps
          mapLib={maplibregl}
          mapStyle={MAP_STYLE}
          initialViewState={INITIAL_VIEW_STATE}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          dragRotate={false}
          touchPitch={false}
          attributionControl={false}
          style={{ width: '100%', height: '100%' }}
          onLoad={handleMapLoad}
          onStyleData={handleStyleData}
          onMove={(event: ViewStateChangeEvent) => {
            syncCameraState(event.viewState.zoom)
          }}
          onMouseMove={(event) => {
            setCursorCoord({
              lon: event.lngLat.lng,
              lat: event.lngLat.lat,
            })
          }}
          onMouseLeave={() => setCursorCoord(null)}
        >
          {weatherTileUrl ? (
            <Source
              id={WEATHER_SOURCE_ID}
              type="raster"
              tiles={[weatherTileUrl]}
              tileSize={WEATHER_TILE_SIZE}
              attribution='<a href="https://www.rainviewer.com/" target="_blank" rel="noopener noreferrer">RainViewer</a>'
            >
              <Layer
                id={WEATHER_LAYER_ID}
                type="raster"
                paint={{ 'raster-opacity': WEATHER_TILE_OPACITY }}
                maxzoom={WEATHER_MAX_ZOOM}
              />
            </Source>
          ) : null}
          <Source
            id={AIRSPACE_BOUNDARIES_SOURCE_ID}
            type="geojson"
            data={AIRSPACE_BOUNDARIES_DATA_URL}
          >
            <Layer {...AIRSPACE_BOUNDARY_GLOW_LAYER} />
            <Layer {...AIRSPACE_BOUNDARY_LINE_LAYER} />
          </Source>
          <WorldMapDeckOverlay layers={layers} interleaved />
        </Map>
      </div>
      {tooltip && (
        <FlightTooltip
          {...tooltip}
          onMouseEnter={() => {
            if (hideTimerRef.current) {
              clearTimeout(hideTimerRef.current)
              hideTimerRef.current = null
            }
          }}
          onMouseLeave={() => {
            hideTimerRef.current = setTimeout(() => setTooltip(null), 120)
          }}
        />
      )}
      <MapLegend {...cameraState} cursor={cursorCoord} />
      <div className="pointer-events-none fixed top-5 left-5 z-20">
        <FlightSearchDialog
          aircraft={deferredAircraft}
          onSelectIcao24={setSelectedIcao24}
        />
      </div>
      <WorldMapToolbar />
      <ReplayTimeline />
      <SelectedFlightSheet />
    </>
  )
}
