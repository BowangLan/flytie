import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MapControls } from '@react-three/drei'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { MapControls as MapControlsImpl } from 'three-stdlib'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { WORLD_MAP_COLORS } from '@/lib/world-map-colors'
import {
  type Feature,
  type GetColorFn,
  Countries,
  CountryOutlines,
  CountryLabels,
} from './country'
import { FlightMarkers } from './flight-markers'
import { FlightTooltip, type TooltipData } from './flight-tooltip'
import { SelectedFlightRoute } from './selected-flight-route'
import type { State } from 'convex/statesTypes'
import { SelectedFlightSheet } from './selected-flight-sheet'
import { useSelectedFlightStore } from '#/store/selected-flight.store'
import { useFlightsStore } from '#/store/flights-store'
import { MapLegend, type CameraState } from './map-legend'

const GEOJSON_URL =
  'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson'

const WORLD_X = 180
const WORLD_Y = 90
const MAX_ZOOM = 600

/** 'wheel' — two-finger scroll pans, pinch zooms.
 *  'drag'  — left-click drag pans, scroll wheel zooms. */
const PAN_MODE: 'wheel' | 'drag' = 'drag'

function CameraConstraints({
  controlsRef,
}: {
  controlsRef: React.RefObject<MapControlsImpl | null>
}) {
  const { camera, size } = useThree()

  useFrame(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return

    // Minimum zoom: world fits in view on at least one axis
    const minZoom = Math.min(
      size.width / (WORLD_X * 2),
      size.height / (WORLD_Y * 2),
    )
    if (camera.zoom < minZoom) {
      camera.zoom = minZoom
      camera.updateProjectionMatrix()
    }

    const halfW = size.width / (2 * camera.zoom)
    const halfH = size.height / (2 * camera.zoom)

    // If visible half-extent >= world half-extent on an axis, lock to center
    const cx =
      halfW >= WORLD_X
        ? 0
        : Math.max(
            -WORLD_X + halfW,
            Math.min(WORLD_X - halfW, camera.position.x),
          )
    const cy =
      halfH >= WORLD_Y
        ? 0
        : Math.max(
            -WORLD_Y + halfH,
            Math.min(WORLD_Y - halfH, camera.position.y),
          )

    camera.position.x = cx
    camera.position.y = cy

    // Sync controls target so damping doesn't snap back past the boundary
    if (controlsRef.current) {
      controlsRef.current.target.x = cx
      controlsRef.current.target.y = cy
    }
  })

  return null
}

/**
 * Intercepts wheel events on the canvas so that two-finger scroll pans the map
 * and pinch (ctrlKey) zooms it. MapControls' built-in zoom must be disabled to
 * prevent double-handling.
 */
function WheelPan({
  controlsRef,
}: {
  controlsRef: React.RefObject<MapControlsImpl | null>
}) {
  const { camera, gl } = useThree()

  useEffect(() => {
    const el = gl.domElement

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (!(camera instanceof THREE.OrthographicCamera)) return

      if (e.ctrlKey) {
        // Pinch gesture — zoom around cursor position
        const factor = Math.pow(0.999, e.deltaY)
        camera.zoom = Math.min(MAX_ZOOM, camera.zoom * factor)
        camera.updateProjectionMatrix()
      } else {
        // Two-finger scroll — pan
        const dx = e.deltaX / camera.zoom
        const dy = e.deltaY / camera.zoom
        camera.position.x += dx
        camera.position.y -= dy
        if (controlsRef.current) {
          controlsRef.current.target.x += dx
          controlsRef.current.target.y -= dy
        }
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [camera, gl, controlsRef])

  return null
}

/** Reads camera position+zoom each frame; calls onUpdate only when values change. */
function CameraInfo({ onUpdate }: { onUpdate: (s: CameraState) => void }) {
  const { camera } = useThree()
  const prev = useRef<CameraState>({ lon: [0, 0], lat: [0, 0], zoom: 0 })

  useFrame(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return
    const halfW = camera.right / camera.zoom
    const halfH = camera.top / camera.zoom
    const lon: [number, number] = [
      Math.max(-WORLD_X, camera.position.x - halfW),
      Math.min(WORLD_X, camera.position.x + halfW),
    ]
    const lat: [number, number] = [
      Math.max(-WORLD_Y, camera.position.y - halfH),
      Math.min(WORLD_Y, camera.position.y + halfH),
    ]
    const { zoom } = camera
    const p = prev.current
    if (
      Math.abs(lon[0] - p.lon[0]) > 0.01 ||
      Math.abs(lon[1] - p.lon[1]) > 0.01 ||
      Math.abs(lat[0] - p.lat[0]) > 0.01 ||
      Math.abs(lat[1] - p.lat[1]) > 0.01 ||
      Math.abs(zoom - p.zoom) > 0.1
    ) {
      prev.current = { lon, lat, zoom }
      onUpdate({ lon, lat, zoom })
    }
  })

  return null
}

// ─── Scene ────────────────────────────────────────────────────────────────────

function tryParseJson<T>(json: unknown): T | null {
  if (typeof json !== 'string') return null
  return JSON.parse(json) as T
}

function WorldScene({
  getColor,
  onHover,
  onCameraUpdate,
  onFlightClick,
}: {
  getColor?: GetColorFn
  onHover?: (state: State | null, x: number, y: number) => void
  onCameraUpdate?: (s: CameraState) => void
  onFlightClick?: (icao24: string) => void
}) {
  const [features, setFeatures] = useState<Feature[]>([])
  const controlsRef = useRef<MapControlsImpl>(null)
  const wheelPan = PAN_MODE === 'wheel'

  // Live flight data via Convex — auto-updates when the DB changes.
  const statesRaw = useQuery(api.states.list) ?? '[]'
  const states = tryParseJson<State[]>(statesRaw) ?? []

  // Load GeoJSON country data once.
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then((r) => r.json())
      .then((d: { features: Feature[] }) => setFeatures(d.features))
      .catch(console.error)
  }, [])

  useEffect(() => {
    // sync it to flights store
    const flightsStore = useFlightsStore.getState()
    flightsStore.addFlights(states)
  }, [states])

  console.log(
    'states with departure and arrival',
    states.filter(
      (state) => state.estDepartureAirport || state.estArrivalAirport,
    ),
  )

  // Trigger the Convex refresh action on an interval.
  // All connected clients share the result via the Convex query subscription.
  // useEffect(() => {
  //   void refreshStates()
  //   const id = setInterval(() => void refreshStates(), FLIGHT_POLL_INTERVAL_MS)
  //   return () => clearInterval(id)
  // }, [refreshStates])

  return (
    <>
      {/* Filled country areas */}
      <Countries features={features} getColor={getColor} />

      {/* Country outlines */}
      <CountryOutlines features={features} />

      {/* Country labels */}
      <CountryLabels features={features} />

      {/* Selected flight route line (departure → destination) */}
      <SelectedFlightRoute />

      {/* Live flight markers */}
      <FlightMarkers
        states={states}
        onHover={onHover}
        onClick={onFlightClick}
      />

      <MapControls
        ref={controlsRef}
        enableRotate={false}
        enableZoom={!wheelPan}
        dampingFactor={0.5}
        screenSpacePanning
        enablePan
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />
      {wheelPan && <WheelPan controlsRef={controlsRef} />}
      <CameraConstraints controlsRef={controlsRef} />
      {onCameraUpdate && <CameraInfo onUpdate={onCameraUpdate} />}
    </>
  )
}

export default function WorldMap({ getColor }: { getColor?: GetColorFn }) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>({
    lon: [0, 0],
    lat: [0, 0],
    zoom: 16,
  })
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setSelectedIcao24 = useSelectedFlightStore(
    (state) => state.setSelectedIcao24,
  )

  const handleHover = useCallback(
    (state: State | null, x: number, y: number) => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
      if (state) {
        setTooltip({ state, x, y })
      } else {
        hideTimerRef.current = setTimeout(() => setTooltip(null), 120)
      }
    },
    [],
  )

  const handleCameraUpdate = useCallback((s: CameraState) => {
    setCameraState(s)
  }, [])

  const handleFlightClick = useCallback(
    (icao24: string) => {
      setSelectedIcao24(icao24)
    },
    [setSelectedIcao24],
  )

  return (
    <>
      <div className="fixed inset-0 z-0">
        <Canvas
          orthographic
          camera={{ position: [0, 0, 100], zoom: 16 }}
          gl={{ antialias: true }}
          style={{ background: WORLD_MAP_COLORS.background }}
        >
          <WorldScene
            getColor={getColor}
            onHover={handleHover}
            onCameraUpdate={handleCameraUpdate}
            onFlightClick={handleFlightClick}
          />
        </Canvas>
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
      <MapLegend {...cameraState} />

      <SelectedFlightSheet />
    </>
  )
}
