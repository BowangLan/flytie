import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import type { Flight } from './flights'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Z-offset so markers render above country fills. */
const MARKER_Z = 1

/** Half-span of the plane silhouette in world units (degrees). */
const MARKER_SIZE = 0.7

/** White — flight markers. */
const COLOR_MARKER = new THREE.Color('#ffffff')

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Reusable scratch object for computing instance matrices (never rendered). */
const scratch = new THREE.Object3D()

/**
 * Lucide "plane" icon — 24×24 viewBox, single closed contour.
 * Nose points toward upper-right (~45° CW from north) in SVG screen coords.
 */
const PLANE_SVG_PATH =
  'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'

/**
 * Parses the Lucide plane SVG path into a filled Three.js BufferGeometry.
 *
 * Transforms applied in order:
 *   1. Center at origin   — SVG 24×24 grid, center at (12, 12)
 *   2. Flip Y + scale     — SVG Y-down → Three.js Y-up, scaled to MARKER_SIZE
 *   3. Rotate 45° CCW     — aligns the nose from northeast to north (+Y)
 */
function buildMarkerGeometry(): THREE.BufferGeometry {
  const loader = new SVGLoader()
  const parsed = loader.parse(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${PLANE_SVG_PATH}"/></svg>`,
  )

  const shapes: THREE.Shape[] = []
  for (const path of parsed.paths) {
    SVGLoader.createShapes(path).forEach(s => shapes.push(s))
  }
  if (shapes.length === 0) return new THREE.BufferGeometry()

  const geo = new THREE.ShapeGeometry(shapes)

  // Center, flip Y (SVG Y-down → Three.js Y-up), and scale
  const s = MARKER_SIZE / 12
  geo.translate(-12, -12, 0)
  geo.scale(s, -s, 1)

  // Nose is northeast in Three.js coords (~45° CW from north).
  // Rotate 45° CCW to align it with north (+Y).
  geo.rotateZ(Math.PI / 4)

  // White vertex colors
  const count = geo.getAttribute('position').count
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3))

  return geo
}

// ─── Component ────────────────────────────────────────────────────────────────

interface FlightMarkersProps {
  flights: Flight[]
}

/**
 * Renders all aircraft as instanced filled plane silhouettes on the world map.
 * Each plane is rotated to match the aircraft's true track.
 */
export function FlightMarkers({ flights }: FlightMarkersProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(buildMarkerGeometry, [])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    for (let i = 0; i < flights.length; i++) {
      const flight = flights[i]!

      scratch.position.set(flight.longitude, flight.latitude, MARKER_Z)
      // trueTrack is clockwise from north; Three.js Z-rotation is counter-clockwise.
      scratch.rotation.z = -THREE.MathUtils.degToRad(flight.trueTrack ?? 0)
      scratch.scale.setScalar(1)
      scratch.updateMatrix()

      mesh.setMatrixAt(i, scratch.matrix)
      mesh.setColorAt(i, COLOR_MARKER)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [flights])

  if (flights.length === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, flights.length]}>
      <meshBasicMaterial side={THREE.DoubleSide} vertexColors />
    </instancedMesh>
  )
}
