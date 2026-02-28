import { IconLayer, PathLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import type { AdsbAircraft } from './flights'
import { WORLD_MAP_COLORS } from '@/lib/world-map-colors'

const MARKER_SIZE_PX = 22
const MARKER_MIN_SIZE_PX = 18
const MARKER_MAX_SIZE_PX = 28
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
  type: 'past' | 'future'
}

type HoverHandler = (info: PickingInfo<AdsbAircraft>) => void
type SelectHandler = (icao24: string | null) => void

const EARTH_RADIUS_KM = 6371
const TRACK_CURVE_MIN_KM = 40
const TRACK_CURVE_MAX_KM = 320

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeLongitude(lon: number) {

  return ((lon + 540) % 360) - 180
}

function unwrapLongitude(lon: number, referenceLon: number) {
  let nextLon = lon
  while (nextLon - referenceLon > 180) nextLon -= 360
  while (nextLon - referenceLon < -180) nextLon += 360
  return nextLon
}

/** Compute a point at distance d (km) from (lon, lat) along bearing (degrees, 0=N) */
function pointAlongBearing(
  lon: number,
  lat: number,
  bearingDeg: number,
  distanceKm: number,
): [number, number] {
  const toRad = Math.PI / 180
  const latRad = lat * toRad
  const lonRad = lon * toRad
  const brngRad = bearingDeg * toRad
  const d = distanceKm / EARTH_RADIUS_KM

  const lat2 = Math.asin(
    Math.sin(latRad) * Math.cos(d) +
      Math.cos(latRad) * Math.sin(d) * Math.cos(brngRad),
  )
  const lon2 =
    lonRad +
    Math.atan2(
      Math.sin(brngRad) * Math.sin(d) * Math.cos(latRad),
      Math.cos(d) - Math.sin(latRad) * Math.sin(lat2),
    )

  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]
}

function haversineDistanceKm(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
) {
  const toRad = Math.PI / 180
  const dLat = (lat2 - lat1) * toRad
  const dLon = (lon2 - lon1) * toRad
  const lat1Rad = lat1 * toRad
  const lat2Rad = lat2 * toRad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function initialBearing(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
) {
  const toRad = Math.PI / 180
  const toDeg = 180 / Math.PI
  const lat1Rad = lat1 * toRad
  const lat2Rad = lat2 * toRad
  const deltaLonRad = (lon2 - lon1) * toRad
  const y = Math.sin(deltaLonRad) * Math.cos(lat2Rad)
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLonRad)

  return (Math.atan2(y, x) * toDeg + 360) % 360
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
    return colorToRgba(WORLD_MAP_COLORS.routeFuture, 255)
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

function buildCubicCurvePoints(
  start: [number, number],
  startControl: [number, number],
  endControl: [number, number],
  end: [number, number],
): [number, number][] {
  const unwrappedStartLon = start[0]
  const unwrappedStartControlLon = unwrapLongitude(
    startControl[0],
    unwrappedStartLon,
  )
  const unwrappedEndControlLon = unwrapLongitude(
    endControl[0],
    unwrappedStartControlLon,
  )
  const unwrappedEndLon = unwrapLongitude(end[0], unwrappedEndControlLon)
  const points: [number, number][] = []

  for (let i = 0; i <= ROUTE_STEPS; i++) {
    const t = i / ROUTE_STEPS
    const oneMinusT = 1 - t
    const lon =
      oneMinusT ** 3 * unwrappedStartLon +
      3 * oneMinusT * oneMinusT * t * unwrappedStartControlLon +
      3 * oneMinusT * t * t * unwrappedEndControlLon +
      t ** 3 * unwrappedEndLon
    const lat =
      oneMinusT ** 3 * start[1] +
      3 * oneMinusT * oneMinusT * t * startControl[1] +
      3 * oneMinusT * t * t * endControl[1] +
      t ** 3 * end[1]

    points.push([normalizeLongitude(lon), lat])
  }

  return points
}

export function buildRouteSegments(params: {
  departureLocation?: { lon: number; lat: number }
  arrivalLocation?: { lon: number; lat: number }
  currentPosition?: { lon: number; lat: number }
  track?: number
}): RouteSegment[] {
  const { departureLocation, arrivalLocation, currentPosition, track } = params

  const segments: RouteSegment[] = []
  const hasTrack = track != null && Number.isFinite(track)
  const getCurveDistance = (distanceKm: number) =>
    clamp(distanceKm * 0.18, TRACK_CURVE_MIN_KM, TRACK_CURVE_MAX_KM)

  if (departureLocation && currentPosition) {
    // Constraint: the past section always runs departure -> current position.
    // When track is available, keep the final tangent aligned with the plane
    // while keeping the curve on the rear side of the aircraft.
    const pastPoints: [number, number][] = hasTrack
      ? buildCubicCurvePoints(
          [departureLocation.lon, departureLocation.lat],
          pointAlongBearing(
            departureLocation.lon,
            departureLocation.lat,
            initialBearing(
              departureLocation.lon,
              departureLocation.lat,
              currentPosition.lon,
              currentPosition.lat,
            ),
            getCurveDistance(
              haversineDistanceKm(
                departureLocation.lon,
                departureLocation.lat,
                currentPosition.lon,
                currentPosition.lat,
              ),
            ),
          ),
          pointAlongBearing(
            currentPosition.lon,
            currentPosition.lat,
            track + 180,
            getCurveDistance(
              haversineDistanceKm(
                departureLocation.lon,
                departureLocation.lat,
                currentPosition.lon,
                currentPosition.lat,
              ),
            ),
          ),
          [currentPosition.lon, currentPosition.lat],
        )
      : Array.from({ length: ROUTE_STEPS + 1 }, (_, index) =>
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
    // Constraint: the future section always runs current position -> arrival.
    // When track is available, keep the initial tangent aligned with the plane
    // while keeping the curve on the forward side of the aircraft.
    const futurePoints: [number, number][] = hasTrack
      ? buildCubicCurvePoints(
          [currentPosition.lon, currentPosition.lat],
          pointAlongBearing(
            currentPosition.lon,
            currentPosition.lat,
            track,
            getCurveDistance(
              haversineDistanceKm(
                currentPosition.lon,
                currentPosition.lat,
                arrivalLocation.lon,
                arrivalLocation.lat,
              ),
            ),
          ),
          pointAlongBearing(
            arrivalLocation.lon,
            arrivalLocation.lat,
            initialBearing(
              arrivalLocation.lon,
              arrivalLocation.lat,
              currentPosition.lon,
              currentPosition.lat,
            ),
            getCurveDistance(
              haversineDistanceKm(
                currentPosition.lon,
                currentPosition.lat,
                arrivalLocation.lon,
                arrivalLocation.lat,
              ),
            ),
          ),
          [arrivalLocation.lon, arrivalLocation.lat],
        )
      : Array.from({ length: ROUTE_STEPS + 1 }, (_, index) =>
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
      getColor: (segment) =>
        colorToRgba(
          segment.type === 'past'
            ? WORLD_MAP_COLORS.routePast
            : WORLD_MAP_COLORS.routeFuture,
          255,
        ),
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
