import { IconLayer, PathLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import type { AdsbAircraft } from './flights'
import { WORLD_MAP_COLORS } from '@/lib/world-map-colors'

const MARKER_SIZE_PX = 22
const MARKER_MIN_SIZE_PX = 18
const MARKER_MAX_SIZE_PX = 28
const ANGLE_OFFSET = -0
const ROUTE_STEPS = 64

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

export type RouteSegment = {
  path: [number, number][]
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

export function buildRouteSegments(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): RouteSegment[] {
  const points: [number, number][] = []

  for (let i = 0; i <= ROUTE_STEPS; i++) {
    points.push(greatCirclePoint(lon1, lat1, lon2, lat2, i / ROUTE_STEPS))
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

export function createWorldMapLayers({
  hoveredIcao24,
  onHover,
  onSelect,
  routeSegments,
  selectedAircraft,
  selectedIcao24,
  unselectedAircraft,
}: {
  hoveredIcao24: string | null
  onHover: HoverHandler
  onSelect: SelectHandler
  routeSegments: RouteSegment[]
  selectedAircraft: AdsbAircraft | null
  selectedIcao24: string | null
  unselectedAircraft: AdsbAircraft[]
}) {
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
      id: 'flight-markers',
      data: unselectedAircraft,
      pickable: true,
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
      onHover,
      onClick: (info) => {
        const aircraftObject = info.object
        onSelect(aircraftObject ? aircraftObject.hex.toLowerCase() : null)
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
      pickable: true,
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
      onHover,
      onClick: (info) => {
        const aircraftObject = info.object
        if (!aircraftObject) return
        onSelect(aircraftObject.hex.toLowerCase())
      },
    }),
  ]
}
