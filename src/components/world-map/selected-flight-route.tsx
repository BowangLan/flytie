import { useMemo } from 'react'
import * as THREE from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { useSelectedFlightStore } from '#/store/selected-flight.store'
import { WORLD_MAP_COLORS } from '@/lib/world-map-colors'

/** Number of segments along the great-circle path. */
const SEGMENTS = 64

/** Z-offset so route renders above country fills. */
const ROUTE_Z = 0.5

/** Line width in pixels. */
const ROUTE_LINEWIDTH = 2

/**
 * Interpolate a point along the great circle (geodesic) between two lon/lat positions.
 * Uses spherical linear interpolation on the unit sphere.
 */
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

  const dot = x1 * x2 + y1 * y2 + z1 * z2
  const clamped = Math.max(-1, Math.min(1, dot))

  let wx: number
  let wy: number
  let wz: number
  if (clamped > 0.9995) {
    wx = x1 + t * (x2 - x1)
    wy = y1 + t * (y2 - y1)
    wz = z1 + t * (z2 - z1)
  } else {
    const omega = Math.acos(clamped)
    const sinOmega = Math.sin(omega)
    const a = Math.sin((1 - t) * omega) / sinOmega
    const b = Math.sin(t * omega) / sinOmega
    wx = a * x1 + b * x2
    wy = a * y1 + b * y2
    wz = a * z1 + b * z2
  }

  const len = Math.sqrt(wx * wx + wy * wy + wz * wz)
  wx /= len
  wy /= len
  wz /= len

  const lat = 90 - (Math.acos(wz) * 180) / Math.PI
  const lon = (Math.atan2(wy, wx) * 180) / Math.PI
  return [lon, lat]
}

/**
 * Build positions for a great-circle polyline between origin and destination.
 * Map uses (lon, lat) as (x, y). Uses segment pairs so antimeridian crossings
 * (where lon jumps by ~360°) are simply skipped rather than drawing a horizontal
 * line across the entire map.
 */
function buildRoutePositions(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number[] {
  const points: Array<[number, number]> = []
  for (let i = 0; i <= SEGMENTS; i++) {
    points.push(greatCirclePoint(lon1, lat1, lon2, lat2, i / SEGMENTS))
  }

  const positions: number[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const [lonA, latA] = points[i]
    const [lonB, latB] = points[i + 1]
    // Skip segments that cross the antimeridian (±180°) to avoid horizontal artifacts.
    if (Math.abs(lonB - lonA) > 180) continue
    positions.push(lonA, latA, ROUTE_Z, lonB, latB, ROUTE_Z)
  }
  return positions
}

export function SelectedFlightRoute() {
  const aerodataFlight = useSelectedFlightStore((state) => state.aerodataFlight)

  const lineObject = useMemo(() => {
    if (!aerodataFlight) return null
    const dep = aerodataFlight.departure?.airport?.location
    const arr = aerodataFlight.arrival?.airport?.location
    if (!dep || !arr) return null

    const lon1 = dep.lon
    const lat1 = dep.lat
    const lon2 = arr.lon
    const lat2 = arr.lat

    const positions = buildRoutePositions(lon1, lat1, lon2, lat2)
    if (positions.length === 0) return null

    const geometry = new LineSegmentsGeometry()
    geometry.setPositions(positions)

    const material = new LineMaterial({
      color: WORLD_MAP_COLORS.route,
      linewidth: ROUTE_LINEWIDTH,
      resolution: new THREE.Vector2(
        typeof window !== 'undefined' ? window.innerWidth : 1,
        typeof window !== 'undefined' ? window.innerHeight : 1,
      ),
    })

    return new LineSegments2(geometry, material)
  }, [aerodataFlight])

  if (!lineObject) return null

  return <primitive object={lineObject} />
}
