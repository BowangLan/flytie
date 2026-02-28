import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import type { AdsbAircraft } from './flights'
import { WORLD_MAP_COLORS } from '@/lib/world-map-colors'
import { useSelectedFlightStore } from '@/store/selected-flight.store'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Z-offset so markers render above country fills. */
const MARKER_Z = 1

/** Half-span of the plane silhouette in world units (degrees). */
const MARKER_SIZE = 0.7

/** Maximum screen size of a marker in pixels — prevents markers from growing
 *  indefinitely as the user zooms in. */
const MAX_MARKER_SCREEN_PX = 14

/** Normal fill color for markers. */

const COLOR_MARKER = new THREE.Color(WORLD_MAP_COLORS.marker)
const COLOR_MARKER_HOVER = new THREE.Color(WORLD_MAP_COLORS.markerHover)
const COLOR_MARKER_SELECTED = new THREE.Color(WORLD_MAP_COLORS.markerSelected)

/** Border color for markers (sea-ink). */
const COLOR_BORDER = new THREE.Color('#0a0a0a')

/** Scale factor for border mesh — slightly larger than fill to create outline. */
const BORDER_SCALE = 1.12

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
    SVGLoader.createShapes(path).forEach((s) => shapes.push(s))
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
  geo.setAttribute(
    'color',
    new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3),
  )

  return geo
}

// ─── Component ────────────────────────────────────────────────────────────────

interface FlightMarkersProps {
  aircraft: AdsbAircraft[]
  onHover?: (aircraft: AdsbAircraft | null, x: number, y: number) => void
  onClick?: (icao24: string) => void
}

/**
 * Renders all aircraft as instanced filled plane silhouettes on the world map.
 * Each plane is rotated to match the aircraft's true track.
 */
export function FlightMarkers({
  aircraft,
  onHover,
  onClick,
}: FlightMarkersProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const borderMeshRef = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(buildMarkerGeometry, [])
  const { camera } = useThree()

  // Keep aircraft accessible inside useFrame without a stale closure.
  const aircraftRef = useRef(aircraft)
  aircraftRef.current = aircraft

  const onHoverRef = useRef(onHover)
  onHoverRef.current = onHover

  const onClickRef = useRef(onClick)
  onClickRef.current = onClick

  const selectedIcao24 = useSelectedFlightStore((state) => state.selectedIcao24)
  const selectedIcao24Ref = useRef(selectedIcao24)
  selectedIcao24Ref.current = selectedIcao24

  // Dirty flag: set when states change OR when zoom crosses a scale threshold.
  const dirtyRef = useRef(true)
  const lastScaleRef = useRef(1)

  /** Index of the currently hovered instance, or -1 for none. */
  const hoveredIndexRef = useRef(-1)

  // Mark dirty whenever the aircraft array or selection changes.
  // Also reset hover state so it doesn't get stuck if onPointerLeave didn't fire
  // (e.g. when the sheet closed without the pointer actually leaving the marker).
  useEffect(() => {
    hoveredIndexRef.current = -1
    dirtyRef.current = true
  }, [aircraft, selectedIcao24])

  useFrame(() => {
    const mesh = meshRef.current
    const borderMesh = borderMeshRef.current
    if (!mesh || !borderMesh || !(camera instanceof THREE.OrthographicCamera))
      return

    // Scale so markers never exceed MAX_MARKER_SCREEN_PX pixels.
    const scale = Math.min(
      1,
      MAX_MARKER_SCREEN_PX / (camera.zoom * MARKER_SIZE),
    )

    if (Math.abs(scale - lastScaleRef.current) > 0.001) {
      dirtyRef.current = true
      lastScaleRef.current = scale
    }

    if (!dirtyRef.current) return
    dirtyRef.current = false

    const cur = aircraftRef.current
    for (let i = 0; i < cur.length; i++) {
      const ac = cur[i]

      scratch.position.set(ac.lon, ac.lat, MARKER_Z)
      // track is clockwise from north; Three.js Z-rotation is counter-clockwise.
      scratch.rotation.z = -THREE.MathUtils.degToRad(ac.track)

      // Border: slightly larger, rendered behind
      scratch.scale.setScalar(lastScaleRef.current * BORDER_SCALE)
      scratch.updateMatrix()
      borderMesh.setMatrixAt(i, scratch.matrix)
      borderMesh.setColorAt(i, COLOR_BORDER)

      // Fill: normal scale, highlight if selected or hovered (selected takes precedence)
      scratch.scale.setScalar(lastScaleRef.current)
      scratch.updateMatrix()
      mesh.setMatrixAt(i, scratch.matrix)
      const isSelected = ac.hex.toLowerCase() === selectedIcao24Ref.current
      const isHovered = i === hoveredIndexRef.current
      const fillColor = isSelected
        ? COLOR_MARKER_SELECTED
        : isHovered
          ? COLOR_MARKER_HOVER
          : COLOR_MARKER
      mesh.setColorAt(i, fillColor)
    }

    borderMesh.instanceMatrix.needsUpdate = true
    if (borderMesh.instanceColor) borderMesh.instanceColor.needsUpdate = true
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  if (aircraft.length === 0) return null

  return (
    <>
      {/* Border: rendered first so it appears behind the fill */}
      <instancedMesh
        ref={borderMeshRef}
        args={[geometry, undefined, aircraft.length]}
        frustumCulled={false}
        raycast={() => {}}
      >
        <meshBasicMaterial side={THREE.DoubleSide} vertexColors />
      </instancedMesh>
      {/* Fill — pointer events for hover detection */}
      <instancedMesh
        ref={meshRef}
        args={[geometry, undefined, aircraft.length]}
        frustumCulled={false}
        onPointerMove={(e) => {
          e.stopPropagation()
          const idx = e.instanceId ?? -1
          if (idx === hoveredIndexRef.current) return
          hoveredIndexRef.current = idx
          dirtyRef.current = true
          document.body.style.cursor = idx >= 0 ? 'pointer' : ''
          const ac = idx >= 0 ? aircraftRef.current[idx] : null
          onHoverRef.current?.(ac ?? null, e.clientX, e.clientY)
        }}
        onPointerLeave={() => {
          if (hoveredIndexRef.current === -1) return
          hoveredIndexRef.current = -1
          dirtyRef.current = true
          document.body.style.cursor = ''
          onHoverRef.current?.(null, 0, 0)
        }}
        onClick={(e) => {
          e.stopPropagation()
          const idx = e.instanceId ?? -1
          if (idx >= 0) {
            const ac = aircraftRef.current[idx]
            if (ac) onClickRef.current?.(ac.hex.toLowerCase())
          }
        }}
      >
        <meshBasicMaterial side={THREE.DoubleSide} vertexColors />
      </instancedMesh>
    </>
  )
}
