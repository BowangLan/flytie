import type { PickingInfo } from '@deck.gl/core'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import type { MapRef, ViewStateChangeEvent } from 'react-map-gl/maplibre'
import { useCameraStateStore } from '#/store/camera-state-store'
import { useReplayTimelineStore } from '#/store/replay-timeline-store'
import { useTooltipStore } from '#/store/tooltip-store'
import { useReplayData } from './use-replay-data'
import { FlightTooltip } from './flight-tooltip'
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
import { applyMapStyleOverrides } from './world-map-style'
import {
  AIRSPACE_BOUNDARIES_DATA_URL,
  AIRSPACE_BOUNDARIES_SOURCE_ID,
  AIRSPACE_BOUNDARY_GLOW_LAYER,
  AIRSPACE_BOUNDARY_LINE_LAYER,
} from './airspace'
import { FlightSearchDialog } from './flight-search-dialog'
import { WorldMapToolbar } from './world-map-toolbar'
import { useFlightsStore } from '#/store/flights-store'
import { toast } from 'sonner'

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
  const {
    aircraft,
    lastUpdatedTimestamp,
    normalFlightIcaos,
    normalFlightManager,
  } = useWorldMapData(dataSource)
  const { replayManager, replayIcaos } = useReplayData()
  const isClient = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false,
  )
  const setCameraState = useCameraStateStore((s) => s.setCameraState)
  const setCursorCoord = useCameraStateStore((s) => s.setCursorCoord)
  const setTooltip = useTooltipStore((s) => s.setTooltip)
  const scheduleHide = useTooltipStore((s) => s.scheduleHide)
  const cancelScheduledHide = useTooltipStore((s) => s.cancelScheduledHide)
  const hoveredIcao24 = useTooltipStore((s) => s.hoveredIcao24)
  const setHoveredIcao24 = useTooltipStore((s) => s.setHoveredIcao24)
  const mapRef = useRef<MapRef | null>(null)
  const setSelectedIcao24 = useSelectedFlightStore(
    (state) => state.setSelectedIcao24,
  )
  const selectedIcao24 = useSelectedFlightStore((state) => state.selectedIcao24)
  const aerodataFlight = useSelectedFlightStore((state) => state.aerodataFlight)
  const replayActive = useReplayTimelineStore((state) => state.active)
  const replayTimestamp = useReplayTimelineStore(
    (state) => state.currentTimestamp,
  )
  const { data: weatherTileUrl } = useWeatherRadar(isClient, WEATHER_TILE_SIZE)
  const deferredAircraft = useDeferredValue(aircraft)

  const syncCameraState = useCallback((zoom: number) => {
    const nextCameraState = getCameraState(mapRef.current, zoom)
    // toast.info(`Update camera state to Lat: [${nextCameraState?.lat[0].toFixed(2)}, ${nextCameraState?.lat[1].toFixed(2)}], Lon: [${nextCameraState?.lon[0].toFixed(4)}, ${nextCameraState?.lon[1].toFixed(4)}]`)
    setCameraState(nextCameraState)
  }, [setCameraState])

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

  const selectedAircraft = useFlightsStore((state) => selectedIcao24 ? state.map.get(selectedIcao24) ?? null : null)

  // const routeSegments: RouteSegment[] = [];
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

  const handleHover = useEffectEvent((info: PickingInfo<string>) => {
    const aircraftObject = info.object
      ? normalFlightManager.getAircraft(info.object)
      : null
    const nextHoveredIcao24 = aircraftObject?.hex.toLowerCase() ?? null

    setHoveredIcao24((current) =>
      current === nextHoveredIcao24 ? current : nextHoveredIcao24,
    )
    document.body.style.cursor = aircraftObject ? 'pointer' : ''

    if (aircraftObject && Number.isFinite(info.x) && Number.isFinite(info.y)) {
      setTooltip({
        aircraft: aircraftObject,
        x: info.x,
        y: info.y,
      })
      return
    }

    scheduleHide()
  })

  const selectAndCenterOnAircraft = useCallback((icao24: string) => {
    setSelectedIcao24(icao24)
    const selectedFlightAircraft = useFlightsStore.getState().map.get(icao24)
    if (selectedFlightAircraft) {
      mapRef.current?.easeTo({
        center: [selectedFlightAircraft.lon, selectedFlightAircraft.lat],
        duration: 700,
        essential: true,
      })
    }
  }, [setSelectedIcao24])

  const layers = useMemo(() => {
    if (lastUpdatedTimestamp === 0) return []

    if (replayActive) {
      return createReplayMapLayers({
        hoveredIcao24,
        replayIcaos,
        replayManager,
        selectedIcao24,
        timestampMs: replayTimestamp,
      })
    }

    return createWorldMapLayers({
      hoveredIcao24,
      lastUpdatedTimestamp,
      normalFlightIcaos,
      normalFlightManager,
      onHover: handleHover,
      onSelect: setSelectedIcao24,
      routeSegments,
      selectedAircraft,
      selectedIcao24,
    })
  }, [
    handleHover,
    hoveredIcao24,
    lastUpdatedTimestamp,
    normalFlightIcaos,
    normalFlightManager,

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
      cancelScheduledHide()
    }
  }, [cancelScheduledHide])

  useEffect(() => {
    if (!replayActive) return

    setTooltip(null)
    setHoveredIcao24(null)
    document.body.style.cursor = ''
  }, [replayActive, setTooltip, setHoveredIcao24])

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
      <FlightTooltip />
      {/* <MapLegend /> */}
      <div className="pointer-events-none fixed top-5 left-5 z-20">
        <FlightSearchDialog
          aircraft={deferredAircraft}
          onSelectIcao24={selectAndCenterOnAircraft}
        />
      </div>
      <WorldMapToolbar />
      <ReplayTimeline />
      <SelectedFlightSheet />
    </>
  )
}
