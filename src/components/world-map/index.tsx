import type { PickingInfo } from '@deck.gl/core'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  startTransition,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import type { MapRef, ViewStateChangeEvent } from 'react-map-gl/maplibre'
import type { AdsbAircraft } from './flights'
import { FlightTooltip } from './flight-tooltip'
import type { TooltipData } from './flight-tooltip'
import { SelectedFlightSheet } from './selected-flight-sheet'
import { useSelectedFlightStore } from '#/store/selected-flight.store'
import { MapLegend } from './map-legend'
import type { CameraState } from './map-legend'
import type { WorldMapDataSource } from './data-source'
import { useWorldMapData } from './use-world-map-data'
import { createWorldMapLayers, buildRouteSegments } from './world-map-layers'
import type { RouteSegment } from './world-map-layers'
import { useWeatherRadar } from './use-weather-radar'
import { WorldMapDeckOverlay } from './world-map-deck-overlay'
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
  const [isClient, setIsClient] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [cursorCoord, setCursorCoord] = useState<CursorCoord>(null)
  const [hoveredIcao24, setHoveredIcao24] = useState<string | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>({
    lon: [0, 0],
    lat: [0, 0],
    zoom: 2 ** INITIAL_VIEW_STATE.zoom,
  })
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mapRef = useRef<MapRef | null>(null)
  const cameraStateRef = useRef(cameraState)
  const setSelectedIcao24 = useSelectedFlightStore(
    (state) => state.setSelectedIcao24,
  )
  const selectedIcao24 = useSelectedFlightStore((state) => state.selectedIcao24)
  const aerodataFlight = useSelectedFlightStore((state) => state.aerodataFlight)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const { data: weatherTileUrl } = useWeatherRadar(isClient, WEATHER_TILE_SIZE)

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
    syncCameraState(viewState.zoom)
  }, [syncCameraState, viewState.zoom])

  const handleStyleData = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map || !map.isStyleLoaded()) return
    applyMapStyleOverrides(map)
  }, [])

  const selectedAircraft = useMemo(
    () =>
      selectedIcao24
        ? (aircraft.find((item) => item.hex.toLowerCase() === selectedIcao24) ??
          null)
        : null,
    [aircraft, selectedIcao24],
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

  const unselectedAircraft = useMemo(
    () =>
      selectedIcao24
        ? aircraft.filter((item) => item.hex.toLowerCase() !== selectedIcao24)
        : aircraft,
    [aircraft, selectedIcao24],
  )

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
    return createWorldMapLayers({
      hoveredIcao24,
      onHover: handleHover,
      onSelect: setSelectedIcao24,
      routeSegments,
      selectedAircraft,
      selectedIcao24,
      unselectedAircraft,
    })
  }, [
    handleHover,
    hoveredIcao24,
    routeSegments,
    selectedAircraft,
    selectedIcao24,
    setSelectedIcao24,
    unselectedAircraft,
  ])

  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

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
          longitude={viewState.longitude}
          latitude={viewState.latitude}
          zoom={viewState.zoom}
          bearing={viewState.bearing}
          pitch={viewState.pitch}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          dragRotate={false}
          touchPitch={false}
          attributionControl={false}
          style={{ width: '100%', height: '100%' }}
          onLoad={handleMapLoad}
          onStyleData={handleStyleData}
          onMove={(event: ViewStateChangeEvent) => {
            setViewState(event.viewState)
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
      <SelectedFlightSheet />
    </>
  )
}
