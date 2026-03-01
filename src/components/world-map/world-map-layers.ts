import { IconLayer, PathLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import type { AdsbAircraft } from './flights'
import type { ReplayManager } from './replay-manager'
import { getAircraftSizeScale } from './aircraft-size'
import { WORLD_MAP_COLORS } from '@/lib/world-map-colors'

const MARKER_SIZE_PX = 22
const MARKER_MIN_SIZE_PX = 18
const MARKER_MAX_SIZE_PX = 28
const MARKER_HIT_TARGET_MULTIPLIER = 1.2
const MARKER_HIT_TARGET_ALPHA = 1
const ROUTE_STEPS = 64
const MARKER_POSITION_TRANSITION_MS = 90
const MARKER_ANGLE_TRANSITION_MS = 120

const PLANE_SVG_PATH =
  'M21 16.2632V14.3684L13.4211 9.63158V4.42105C13.4211 3.63474 12.7863 3 12 3C11.2137 3 10.5789 3.63474 10.5789 4.42105V9.63158L3 14.3684V16.2632L10.5789 13.8947V19.1053L8.68421 20.5263V21.9474L12 21L15.3158 21.9474V20.5263L13.4211 19.1053V13.8947L21 16.2632Z'
const PLANE_ATLAS_SIZE = 128
const HIT_TARGET_SQUARE_SVG_PATH = 'M2 2H22V22H2Z'

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

const HIT_TARGET_ICON_MAPPING = {
  hitTarget: {
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

const HIT_TARGET_ICON_ATLAS = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${PLANE_ATLAS_SIZE}" height="${PLANE_ATLAS_SIZE}" viewBox="0 0 24 24"><path d="${HIT_TARGET_SQUARE_SVG_PATH}" fill="black"/></svg>`,
)}`

const COLOR_MARKER = colorToRgba(WORLD_MAP_COLORS.marker, 255)
const COLOR_MARKER_HOVER = colorToRgba(WORLD_MAP_COLORS.markerHover, 255)
const COLOR_MARKER_SELECTED = colorToRgba(WORLD_MAP_COLORS.markerSelected, 255)
const COLOR_MARKER_BORDER = colorToRgba('#0a0a0a', 255)
const COLOR_MARKER_BORDER_HOVER = colorToRgba(WORLD_MAP_COLORS.label, 255)
const COLOR_MARKER_BORDER_SELECTED = colorToRgba(
  WORLD_MAP_COLORS.routeFuture,
  255,
)

export type RouteSegment = {
  path: [number, number][]
  type: 'past' | 'future'
}

type HoverHandler = (info: PickingInfo<AdsbAircraft>) => void
type SelectHandler = (icao24: string | null) => void

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
  hideSelected = false,
): Uint8Array {
  const icao24 = aircraft.hex.toLowerCase()
  if (hideSelected && icao24 === selectedIcao24) {
    return new Uint8Array([0, 0, 0, 0])
  }
  if (icao24 === selectedIcao24) {
    return new Uint8Array(COLOR_MARKER_SELECTED)
  }
  if (icao24 === hoveredIcao24) {
    return new Uint8Array(COLOR_MARKER_HOVER)
  }
  return new Uint8Array(COLOR_MARKER)
}

function getMarkerBorderColor(
  aircraft: AdsbAircraft,
  selectedIcao24: string | null,
  hoveredIcao24: string | null,
  hideSelected = false,
): Uint8Array {
  const icao24 = aircraft.hex.toLowerCase()
  if (hideSelected && icao24 === selectedIcao24) {
    return new Uint8Array([0, 0, 0, 0])
  }
  if (icao24 === selectedIcao24) {
    return new Uint8Array(COLOR_MARKER_BORDER_SELECTED)
  }
  if (icao24 === hoveredIcao24) {
    return new Uint8Array(COLOR_MARKER_BORDER_HOVER)
  }
  return new Uint8Array(COLOR_MARKER_BORDER)
}

function getMarkerSize(
  aircraft: AdsbAircraft,
  selectedIcao24: string | null,
  hoveredIcao24: string | null,
  hideSelected = false,
) {
  const icao24 = aircraft.hex.toLowerCase()
  const baseSize = MARKER_SIZE_PX * getAircraftSizeScale(aircraft.category)

  if (hideSelected && icao24 === selectedIcao24) return 0
  if (icao24 === selectedIcao24) return baseSize + 5
  if (icao24 === hoveredIcao24) return baseSize + 3
  return baseSize
}

function getMarkerHitTargetSize(
  aircraft: AdsbAircraft,
  selectedIcao24: string | null,
  hoveredIcao24: string | null,
  hideSelected = false,
) {
  return (
    getMarkerSize(aircraft, selectedIcao24, hoveredIcao24, hideSelected) *
    MARKER_HIT_TARGET_MULTIPLIER
  )
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

function pointsToSegments(
  points: [number, number][],
  type: 'past' | 'future',
): RouteSegment[] {
  const segments: RouteSegment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]
    const end = points[i + 1]
    if (Math.abs(end[0] - start[0]) > 180) continue
    segments.push({ path: [start, end], type })
  }
  return segments
}

export function buildRouteSegments(params: {
  departureLocation?: { lon: number; lat: number }
  arrivalLocation?: { lon: number; lat: number }
  currentPosition?: { lon: number; lat: number }
  track?: number
}): RouteSegment[] {
  const { departureLocation, arrivalLocation, currentPosition } = params

  const segments: RouteSegment[] = []

  if (departureLocation && currentPosition) {
    const pastPoints: [number, number][] = Array.from(
      { length: ROUTE_STEPS + 1 },
      (_, index) =>
        greatCirclePoint(
          departureLocation.lon,
          departureLocation.lat,
          currentPosition.lon,
          currentPosition.lat,
          index / ROUTE_STEPS,
        ),
    )
    segments.push(...pointsToSegments(pastPoints, 'past'))
  }

  if (currentPosition && arrivalLocation) {
    const futurePoints: [number, number][] = Array.from(
      { length: ROUTE_STEPS + 1 },
      (_, index) =>
        greatCirclePoint(
          currentPosition.lon,
          currentPosition.lat,
          arrivalLocation.lon,
          arrivalLocation.lat,
          index / ROUTE_STEPS,
        ),
    )

    segments.push(...pointsToSegments(futurePoints, 'future'))
  }

  // Fallback: full route when no current position (departure → arrival)
  if (segments.length === 0 && departureLocation && arrivalLocation) {
    const fullPoints: [number, number][] = []
    for (let i = 0; i <= ROUTE_STEPS; i++) {
      fullPoints.push(
        greatCirclePoint(
          departureLocation.lon,
          departureLocation.lat,
          arrivalLocation.lon,
          arrivalLocation.lat,
          i / ROUTE_STEPS,
        ),
      )
    }
    segments.push(...pointsToSegments(fullPoints, 'future'))
  }

  return segments
}

export function createWorldMapLayers({
  aircraft,
  hoveredIcao24,
  onHover,
  onSelect,
  routeSegments,
  selectedAircraft,
  selectedIcao24,
}: {
  aircraft: AdsbAircraft[]
  hoveredIcao24: string | null
  onHover: HoverHandler
  onSelect: SelectHandler
  routeSegments: RouteSegment[]
  selectedAircraft: AdsbAircraft | null
  selectedIcao24: string | null
}) {
  const markerTransitions = {
    getAngle: {
      duration: MARKER_ANGLE_TRANSITION_MS,
    },
    getPosition: {
      duration: MARKER_POSITION_TRANSITION_MS,
    },
  } as const
  const hideSelectedInBaseLayers = selectedAircraft != null
  const baseAircraft = aircraft
  const routeLayer = new PathLayer<RouteSegment>({
    id: 'selected-flight-route',
    data: routeSegments,
    pickable: false,
    widthUnits: 'pixels',
    widthMinPixels: 2,
    getWidth: 3,
    getColor: (segment) =>
      new Uint8Array(
        colorToRgba(
          segment.type === 'past'
            ? WORLD_MAP_COLORS.routePast
            : WORLD_MAP_COLORS.routeFuture,
          255,
        ),
      ),
    getPath: (segment) => segment.path,
  })

  return [
    new IconLayer<AdsbAircraft>({
      id: 'flight-marker-borders',
      data: baseAircraft,
      pickable: false,
      iconAtlas: PLANE_BORDER_ICON_ATLAS,
      iconMapping: PLANE_ICON_MAPPING,
      getIcon: () => 'plane',
      getPosition: (item) => [item.lon, item.lat],
      getAngle: (item) => -item.track,
      getColor: (item) =>
        getMarkerBorderColor(
          item,
          selectedIcao24,
          hoveredIcao24,
          hideSelectedInBaseLayers,
        ),
      getSize: (item) =>
        getMarkerSize(
          item,
          selectedIcao24,
          hoveredIcao24,
          hideSelectedInBaseLayers,
        ),
      sizeUnits: 'pixels',
      sizeMinPixels: MARKER_MIN_SIZE_PX,
      sizeMaxPixels: MARKER_MAX_SIZE_PX,
      alphaCutoff: 0.05,
      transitions: markerTransitions,
      updateTriggers: {
        getColor: [selectedIcao24, hoveredIcao24],
        getSize: [selectedIcao24, hoveredIcao24],
      },
    }),
    new IconLayer<AdsbAircraft>({
      id: 'flight-markers',
      data: baseAircraft,
      pickable: false,
      autoHighlight: false,
      iconAtlas: PLANE_ICON_ATLAS,
      iconMapping: PLANE_ICON_MAPPING,
      getIcon: () => 'plane',
      getPosition: (item) => [item.lon, item.lat],
      getAngle: (item) => -item.track,
      getColor: (item) =>
        getMarkerColor(
          item,
          selectedIcao24,
          hoveredIcao24,
          hideSelectedInBaseLayers,
        ),
      getSize: (item) =>
        getMarkerSize(
          item,
          selectedIcao24,
          hoveredIcao24,
          hideSelectedInBaseLayers,
        ),
      sizeUnits: 'pixels',
      sizeMinPixels: MARKER_MIN_SIZE_PX,
      sizeMaxPixels: MARKER_MAX_SIZE_PX,
      alphaCutoff: 0.05,
      transitions: markerTransitions,
      updateTriggers: {
        getColor: [selectedIcao24, hoveredIcao24],
        getSize: [selectedIcao24, hoveredIcao24],
      },
    }),
    new IconLayer<AdsbAircraft>({
      id: 'flight-marker-hit-targets',
      data: baseAircraft,
      pickable: true,
      autoHighlight: false,
      iconAtlas: HIT_TARGET_ICON_ATLAS,
      iconMapping: HIT_TARGET_ICON_MAPPING,
      getIcon: () => 'hitTarget',
      getPosition: (item) => [item.lon, item.lat],
      getColor: () => new Uint8Array([0, 0, 0, MARKER_HIT_TARGET_ALPHA]),
      getSize: (item) =>
        getMarkerHitTargetSize(
          item,
          selectedIcao24,
          hoveredIcao24,
          hideSelectedInBaseLayers,
        ),
      sizeUnits: 'pixels',
      sizeMinPixels: MARKER_MIN_SIZE_PX * MARKER_HIT_TARGET_MULTIPLIER,
      sizeMaxPixels: MARKER_MAX_SIZE_PX * MARKER_HIT_TARGET_MULTIPLIER,
      alphaCutoff: 0,
      transitions: markerTransitions,
      updateTriggers: {
        getSize: [selectedIcao24, hoveredIcao24],
      },
      onHover,
      onClick: (info) => {
        const aircraftObject = info.object
        onSelect(aircraftObject ? aircraftObject.hex.toLowerCase() : null)
      },
    }),
    routeLayer,
    new IconLayer<AdsbAircraft>({
      id: 'selected-flight-marker-border',
      data: selectedAircraft ? [selectedAircraft] : [],
      pickable: false,
      iconAtlas: PLANE_BORDER_ICON_ATLAS,
      iconMapping: PLANE_ICON_MAPPING,
      getIcon: () => 'plane',
      getPosition: (item) => [item.lon, item.lat],
      getAngle: (item) => -item.track,
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
      pickable: false,
      autoHighlight: false,
      iconAtlas: PLANE_ICON_ATLAS,
      iconMapping: PLANE_ICON_MAPPING,
      getIcon: () => 'plane',
      getPosition: (item) => [item.lon, item.lat],
      getAngle: (item) => -item.track,
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
    }),
    new IconLayer<AdsbAircraft>({
      id: 'selected-flight-marker-hit-target',
      data: selectedAircraft ? [selectedAircraft] : [],
      pickable: true,
      autoHighlight: false,
      iconAtlas: HIT_TARGET_ICON_ATLAS,
      iconMapping: HIT_TARGET_ICON_MAPPING,
      getIcon: () => 'hitTarget',
      getPosition: (item) => [item.lon, item.lat],
      getColor: () => new Uint8Array([0, 0, 0, MARKER_HIT_TARGET_ALPHA]),
      getSize: (item) =>
        getMarkerHitTargetSize(item, selectedIcao24, hoveredIcao24),
      sizeUnits: 'pixels',
      sizeMinPixels: MARKER_MIN_SIZE_PX * MARKER_HIT_TARGET_MULTIPLIER,
      sizeMaxPixels: MARKER_MAX_SIZE_PX * MARKER_HIT_TARGET_MULTIPLIER,
      alphaCutoff: 0,
      updateTriggers: {
        getSize: [selectedIcao24, hoveredIcao24],
      },
      onHover,
      onClick: (info) => {
        const aircraftObject = info.object
        if (!aircraftObject) return
        onSelect(aircraftObject.hex.toLowerCase())
      },
    }),
  ]
}

export function createReplayMapLayers({
  hoveredIcao24,
  replayIcaos,
  replayManager,
  selectedIcao24,
  timestampMs,
}: {
  hoveredIcao24: string | null
  replayIcaos: string[]
  replayManager: ReplayManager
  selectedIcao24: string | null
  timestampMs: number
}) {
  return [
    new IconLayer<string>({
      id: 'replay-flight-marker-borders',
      data: replayIcaos,
      pickable: false,
      iconAtlas: PLANE_BORDER_ICON_ATLAS,
      iconMapping: PLANE_ICON_MAPPING,
      getIcon: () => 'plane',
      getPosition: (icao) =>
        replayManager.getPosition(icao, timestampMs) ?? [0, 0],
      getAngle: (icao) => -(replayManager.getAngle(icao, timestampMs) ?? 0),
      getColor: (icao) =>
        new Uint8Array(
          icao === selectedIcao24
            ? COLOR_MARKER_BORDER_SELECTED
            : icao === hoveredIcao24
              ? COLOR_MARKER_BORDER_HOVER
              : COLOR_MARKER_BORDER,
        ),
      getSize: (icao) => {
        if (!replayManager.getPosition(icao, timestampMs)) return 0
        if (icao === selectedIcao24) return MARKER_SIZE_PX + 5
        if (icao === hoveredIcao24) return MARKER_SIZE_PX + 3
        return MARKER_SIZE_PX
      },
      sizeUnits: 'pixels',
      sizeMinPixels: MARKER_MIN_SIZE_PX,
      sizeMaxPixels: MARKER_MAX_SIZE_PX,
      alphaCutoff: 0.05,
      updateTriggers: {
        getAngle: timestampMs,
        getColor: [selectedIcao24, hoveredIcao24],
        getPosition: timestampMs,
        getSize: [timestampMs, selectedIcao24, hoveredIcao24],
      },
    }),
    new IconLayer<string>({
      id: 'replay-flight-markers',
      data: replayIcaos,
      pickable: false,
      iconAtlas: PLANE_ICON_ATLAS,
      iconMapping: PLANE_ICON_MAPPING,
      getIcon: () => 'plane',
      getPosition: (icao) =>
        replayManager.getPosition(icao, timestampMs) ?? [0, 0],
      getAngle: (icao) => -(replayManager.getAngle(icao, timestampMs) ?? 0),
      getColor: (icao) =>
        new Uint8Array(
          icao === selectedIcao24
            ? COLOR_MARKER_SELECTED
            : icao === hoveredIcao24
              ? COLOR_MARKER_HOVER
              : COLOR_MARKER,
        ),
      getSize: (icao) => {
        if (!replayManager.getPosition(icao, timestampMs)) return 0
        if (icao === selectedIcao24) return MARKER_SIZE_PX + 5
        if (icao === hoveredIcao24) return MARKER_SIZE_PX + 3
        return MARKER_SIZE_PX
      },
      sizeUnits: 'pixels',
      sizeMinPixels: MARKER_MIN_SIZE_PX,
      sizeMaxPixels: MARKER_MAX_SIZE_PX,
      alphaCutoff: 0.05,
      updateTriggers: {
        getAngle: timestampMs,
        getColor: [selectedIcao24, hoveredIcao24],
        getPosition: timestampMs,
        getSize: [timestampMs, selectedIcao24, hoveredIcao24],
      },
    }),
  ]
}
