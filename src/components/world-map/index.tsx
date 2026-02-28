import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox'
import { IconLayer, PathLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Map, {
  useControl,
  type MapRef,
  type ViewState,
  type ViewStateChangeEvent,
} from 'react-map-gl/maplibre'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { AdsbAircraft } from './flights'
import { COLORS } from '@/lib/colors'
import { WORLD_MAP_COLORS } from '@/lib/world-map-colors'
import { FlightTooltip } from './flight-tooltip'
import type { TooltipData } from './flight-tooltip'
import { SelectedFlightSheet } from './selected-flight-sheet'
import { useSelectedFlightStore } from '#/store/selected-flight.store'
import { MapLegend, type CameraState } from './map-legend'
import type { WorldMapDataSource } from './data-source'
import { useWorldMapData } from './use-world-map-data'

const INITIAL_VIEW_STATE: ViewState = {
  longitude: 0,
  latitude: 20,
  zoom: 4,
  bearing: 0,
  pitch: 0,
  padding: { top: 0, bottom: 0, left: 0, right: 0 },
}
const MIN_ZOOM = 1
const MAX_ZOOM = 8
const MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const MAP_BACKGROUND = COLORS.NEUTRAL_1000
const MAP_OCEAN = COLORS.NEUTRAL_1000
const MAP_OCEAN_LINE = COLORS.NEUTRAL_800
const MAP_LAND = COLORS.NEUTRAL_800
const MAP_BOUNDARY = COLORS.NEUTRAL_700
const MAP_COUNTRY_LABEL = COLORS.NEUTRAL_500
const MAP_PLACE_LABEL = COLORS.NEUTRAL_400
const MAP_WATER_LABEL = COLORS.NEUTRAL_600
const MARKER_SIZE_PX = 22
const MARKER_MIN_SIZE_PX = 18
const MARKER_MAX_SIZE_PX = 28
const ANGLE_OFFSET = -180

const PLANE_SVG_PATH =
  'M21 16.2632V14.3684L13.4211 9.63158V4.42105C13.4211 3.63474 12.7863 3 12 3C11.2137 3 10.5789 3.63474 10.5789 4.42105V9.63158L3 14.3684V16.2632L10.5789 13.8947V19.1053L8.68421 20.5263V21.9474L12 21L15.3158 21.9474V20.5263L13.4211 19.1053V13.8947L21 16.2632Z'

const PLANE_ATLAS_SIZE = 128
const PLANE_ICON_MAPPING = {
  plane: {
    x: 0,
    y: 0,
    width: PLANE_ATLAS_SIZE,
    height: PLANE_ATLAS_SIZE,
    anchorX: PLANE_ATLAS_SIZE / 2,
    anchorY: PLANE_ATLAS_SIZE / 2,
    mask: true,
  },
}

const PLANE_ICON_ATLAS = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${PLANE_ATLAS_SIZE}" height="${PLANE_ATLAS_SIZE}" viewBox="0 0 24 24" fill="black"><path d="${PLANE_SVG_PATH}"/></svg>`,
)}`

const PLANE_BORDER_ICON_ATLAS = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${PLANE_ATLAS_SIZE}" height="${PLANE_ATLAS_SIZE}" viewBox="0 0 24 24"><path d="${PLANE_SVG_PATH}" fill="black" stroke="black" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
)}`

type CursorCoord = { lon: number; lat: number } | null

type RouteSegment = {
  path: [number, number][]
}

const FILL_OVERRIDES = [
  ['background', 'background-color', MAP_BACKGROUND],
  ['landcover', 'fill-color', MAP_LAND],
  ['landuse', 'fill-color', MAP_LAND],
  ['landuse_residential', 'fill-color', 'rgba(38, 38, 38, 0.45)'],
  ['water', 'fill-color', MAP_OCEAN],
  ['water_shadow', 'fill-color', 'rgba(10, 10, 10, 0.9)'],
  ['waterway', 'line-color', MAP_OCEAN_LINE],
  ['boundary_country_outline', 'line-color', 'rgba(10, 10, 10, 0.96)'],
  ['boundary_country_inner', 'line-color', MAP_BOUNDARY],
] as const

const LABEL_OVERRIDES = [
  ['place_country_1', MAP_COUNTRY_LABEL, 'rgba(10, 10, 10, 0.96)', 1.2],
  ['place_country_2', MAP_COUNTRY_LABEL, 'rgba(10, 10, 10, 0.96)', 1.2],
  ['place_state', COLORS.NEUTRAL_600, 'rgba(10, 10, 10, 0.96)', 1],
  ['place_continent', COLORS.NEUTRAL_700, 'rgba(10, 10, 10, 0.96)', 1],
  ['place_city_r6', MAP_PLACE_LABEL, 'rgba(10, 10, 10, 0.96)', 1],
  ['place_city_r5', MAP_PLACE_LABEL, 'rgba(10, 10, 10, 0.96)', 1],
  ['place_town', COLORS.NEUTRAL_500, 'rgba(10, 10, 10, 0.94)', 1],
  ['place_villages', COLORS.NEUTRAL_600, 'rgba(10, 10, 10, 0.94)', 1],
  ['place_suburbs', COLORS.NEUTRAL_600, 'rgba(10, 10, 10, 0.94)', 1],
  ['place_hamlet', COLORS.NEUTRAL_700, 'rgba(10, 10, 10, 0.94)', 1],
  ['watername_ocean', MAP_WATER_LABEL, 'rgba(10, 10, 10, 0.96)', 1.1],
  ['watername_sea', MAP_WATER_LABEL, 'rgba(10, 10, 10, 0.96)', 1.1],
  ['watername_lake', COLORS.NEUTRAL_600, 'rgba(10, 10, 10, 0.96)', 1],
  ['watername_lake_line', COLORS.NEUTRAL_600, 'rgba(10, 10, 10, 0.96)', 1],
  ['waterway_label', COLORS.NEUTRAL_600, 'rgba(10, 10, 10, 0.96)', 1],
] as const

function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props))
  overlay.setProps(props)
  return null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function colorToRgba(
  color: string,
  alpha = 255,
): [number, number, number, number] {
  const hex = color.replace('#', '')
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : hex

  const int = Number.parseInt(normalized, 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255, alpha]
}

function getMarkerColor(
  aircraft: AdsbAircraft,
  selectedIcao24: string | null,
  hoveredIcao24: string | null,
) {
  const icao24 = aircraft.hex.toLowerCase()
  if (icao24 === selectedIcao24) {
    return colorToRgba(WORLD_MAP_COLORS.markerSelected, 255)
  }
  if (icao24 === hoveredIcao24) {
    return colorToRgba(WORLD_MAP_COLORS.markerHover, 255)
  }
  return colorToRgba(WORLD_MAP_COLORS.marker, 255)
}

function getMarkerBorderColor(
  aircraft: AdsbAircraft,
  selectedIcao24: string | null,
  hoveredIcao24: string | null,
) {
  const icao24 = aircraft.hex.toLowerCase()
  if (icao24 === selectedIcao24) {
    return colorToRgba(WORLD_MAP_COLORS.route, 255)
  }
  if (icao24 === hoveredIcao24) {
    return colorToRgba(WORLD_MAP_COLORS.label, 255)
  }
  return colorToRgba('#0a0a0a', 255)
}

function getMarkerSize(
  aircraft: AdsbAircraft,
  selectedIcao24: string | null,
  hoveredIcao24: string | null,
) {
  const icao24 = aircraft.hex.toLowerCase()
  if (icao24 === selectedIcao24) return MARKER_SIZE_PX + 5
  if (icao24 === hoveredIcao24) return MARKER_SIZE_PX + 3
  return MARKER_SIZE_PX
}

function greatCirclePoint(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
  t: number,
): [number, number] {
  const toRad = Math.PI / 180
  const phi1 = (90 - lat1) * toRad
  const theta1 = lon1 * toRad
  const phi2 = (90 - lat2) * toRad
  const theta2 = lon2 * toRad

  const x1 = Math.sin(phi1) * Math.cos(theta1)
  const y1 = Math.sin(phi1) * Math.sin(theta1)
  const z1 = Math.cos(phi1)

  const x2 = Math.sin(phi2) * Math.cos(theta2)
  const y2 = Math.sin(phi2) * Math.sin(theta2)
  const z2 = Math.cos(phi2)

  const dot = clamp(x1 * x2 + y1 * y2 + z1 * z2, -1, 1)

  let wx: number
  let wy: number
  let wz: number

  if (dot > 0.9995) {
    wx = x1 + t * (x2 - x1)
    wy = y1 + t * (y2 - y1)
    wz = z1 + t * (z2 - z1)
  } else {
    const omega = Math.acos(dot)
    const sinOmega = Math.sin(omega)
    const a = Math.sin((1 - t) * omega) / sinOmega
    const b = Math.sin(t * omega) / sinOmega
    wx = a * x1 + b * x2
    wy = a * y1 + b * y2
    wz = a * z1 + b * z2
  }

  const len = Math.sqrt(wx * wx + wy * wy + wz * wz)
  const nx = wx / len
  const ny = wy / len
  const nz = wz / len

  return [
    (Math.atan2(ny, nx) * 180) / Math.PI,
    90 - (Math.acos(nz) * 180) / Math.PI,
  ]
}

function buildRouteSegments(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): RouteSegment[] {
  const points: [number, number][] = []

  for (let i = 0; i <= 64; i++) {
    points.push(greatCirclePoint(lon1, lat1, lon2, lat2, i / 64))
  }

  const segments: RouteSegment[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]
    const end = points[i + 1]
    if (Math.abs(end[0] - start[0]) > 180) continue
    segments.push({ path: [start, end] })
  }

  return segments
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
  if (!bounds) return null

  return {
    lon: [bounds.getWest(), bounds.getEast()],
    lat: [bounds.getSouth(), bounds.getNorth()],
    zoom: 2 ** zoom,
  }
}

function applyMapStyleOverrides(map: MapLibreMap) {
  const style = map.getStyle()
  const layerIds = new Set(style.layers?.map((layer) => layer.id) ?? [])

  for (const [layerId, prop, value] of FILL_OVERRIDES) {
    if (!layerIds.has(layerId)) continue
    map.setPaintProperty(layerId, prop, value)
  }

  for (const [layerId, textColor, haloColor, haloWidth] of LABEL_OVERRIDES) {
    if (!layerIds.has(layerId)) continue
    map.setPaintProperty(layerId, 'text-color', textColor)
    map.setPaintProperty(layerId, 'text-halo-color', haloColor)
    map.setPaintProperty(layerId, 'text-halo-width', haloWidth)
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

  const routeSegments = useMemo<RouteSegment[]>(() => {
    const departure = aerodataFlight?.departure?.airport?.location
    const arrival = aerodataFlight?.arrival?.airport?.location
    if (!departure || !arrival) return []
    return buildRouteSegments(
      departure.lon,
      departure.lat,
      arrival.lon,
      arrival.lat,
    )
  }, [aerodataFlight])

  const selectedAircraft = useMemo(
    () =>
      selectedIcao24
        ? aircraft.find((item) => item.hex.toLowerCase() === selectedIcao24) ??
          null
        : null,
    [aircraft, selectedIcao24],
  )

  const unselectedAircraft = useMemo(
    () =>
      selectedIcao24
        ? aircraft.filter((item) => item.hex.toLowerCase() !== selectedIcao24)
        : aircraft,
    [aircraft, selectedIcao24],
  )

  const handleHover = useCallback((info: PickingInfo<AdsbAircraft>) => {
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
        x: info.x as number,
        y: info.y as number,
      })
      return
    }

    hideTimerRef.current = setTimeout(() => setTooltip(null), 120)
  }, [])

  const layers = useMemo(() => {
    return [
      new PathLayer<RouteSegment>({
        id: 'selected-flight-route',
        data: routeSegments,
        pickable: false,
        widthUnits: 'pixels',
        widthMinPixels: 2,
        getWidth: 2,
        getColor: colorToRgba(WORLD_MAP_COLORS.route, 255),
        getPath: (segment) => segment.path,
      }),
      new IconLayer<AdsbAircraft>({
        id: 'flight-marker-borders',
        data: unselectedAircraft,
        pickable: false,
        iconAtlas: PLANE_BORDER_ICON_ATLAS,
        iconMapping: PLANE_ICON_MAPPING,
        getIcon: () => 'plane',
        getPosition: (item) => [item.lon, item.lat],
        getAngle: (item) => item.track - ANGLE_OFFSET,
        getColor: (item) =>
          getMarkerBorderColor(item, selectedIcao24, hoveredIcao24),
        getSize: (item) => getMarkerSize(item, selectedIcao24, hoveredIcao24),
        sizeUnits: 'pixels',
        sizeMinPixels: MARKER_MIN_SIZE_PX,
        sizeMaxPixels: MARKER_MAX_SIZE_PX,
        alphaCutoff: 0.05,
        updateTriggers: {
          getColor: [selectedIcao24, hoveredIcao24],
          getSize: [selectedIcao24, hoveredIcao24],
        },
      }),
      new IconLayer<AdsbAircraft>({
        id: 'flight-markers',
        data: unselectedAircraft,
        pickable: true,
        autoHighlight: false,
        iconAtlas: PLANE_ICON_ATLAS,
        iconMapping: PLANE_ICON_MAPPING,
        getIcon: () => 'plane',
        getPosition: (item) => [item.lon, item.lat],
        getAngle: (item) => item.track - ANGLE_OFFSET,
        getColor: (item) => getMarkerColor(item, selectedIcao24, hoveredIcao24),
        getSize: (item) => getMarkerSize(item, selectedIcao24, hoveredIcao24),
        sizeUnits: 'pixels',
        sizeMinPixels: MARKER_MIN_SIZE_PX,
        sizeMaxPixels: MARKER_MAX_SIZE_PX,
        alphaCutoff: 0.05,
        updateTriggers: {
          getColor: [selectedIcao24, hoveredIcao24],
          getSize: [selectedIcao24, hoveredIcao24],
        },
        onHover: handleHover,
        onClick: (info) => {
          const aircraftObject = info.object
          if (!aircraftObject) {
            setSelectedIcao24(null)
            return
          }
          setSelectedIcao24(aircraftObject.hex.toLowerCase())
        },
      }),
      new IconLayer<AdsbAircraft>({
        id: 'selected-flight-marker-border',
        data: selectedAircraft ? [selectedAircraft] : [],
        pickable: false,
        iconAtlas: PLANE_BORDER_ICON_ATLAS,
        iconMapping: PLANE_ICON_MAPPING,
        getIcon: () => 'plane',
        getPosition: (item) => [item.lon, item.lat],
        getAngle: (item) => item.track - ANGLE_OFFSET,
        getColor: (item) =>
          getMarkerBorderColor(item, selectedIcao24, hoveredIcao24),
        getSize: (item) => getMarkerSize(item, selectedIcao24, hoveredIcao24),
        sizeUnits: 'pixels',
        sizeMinPixels: MARKER_MIN_SIZE_PX,
        sizeMaxPixels: MARKER_MAX_SIZE_PX,
        alphaCutoff: 0.05,
        updateTriggers: {
          getColor: [selectedIcao24, hoveredIcao24],
          getSize: [selectedIcao24, hoveredIcao24],
        },
      }),
      new IconLayer<AdsbAircraft>({
        id: 'selected-flight-marker',
        data: selectedAircraft ? [selectedAircraft] : [],
        pickable: true,
        autoHighlight: false,
        iconAtlas: PLANE_ICON_ATLAS,
        iconMapping: PLANE_ICON_MAPPING,
        getIcon: () => 'plane',
        getPosition: (item) => [item.lon, item.lat],
        getAngle: (item) => item.track - ANGLE_OFFSET,
        getColor: (item) => getMarkerColor(item, selectedIcao24, hoveredIcao24),
        getSize: (item) => getMarkerSize(item, selectedIcao24, hoveredIcao24),
        sizeUnits: 'pixels',
        sizeMinPixels: MARKER_MIN_SIZE_PX,
        sizeMaxPixels: MARKER_MAX_SIZE_PX,
        alphaCutoff: 0.05,
        updateTriggers: {
          getColor: [selectedIcao24, hoveredIcao24],
          getSize: [selectedIcao24, hoveredIcao24],
        },
        onHover: handleHover,
        onClick: (info) => {
          const aircraftObject = info.object
          if (!aircraftObject) return
          setSelectedIcao24(aircraftObject.hex.toLowerCase())
        },
      }),
    ]
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
        <div
          className="fixed inset-0 z-0"
          style={{ background: WORLD_MAP_COLORS.background }}
        />
        <SelectedFlightSheet />
      </>
    )
  }

  return (
    <>
      <div
        className="fixed inset-0 z-0"
        style={{ background: WORLD_MAP_COLORS.background }}
      >
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
          <DeckGLOverlay layers={layers} interleaved />
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
