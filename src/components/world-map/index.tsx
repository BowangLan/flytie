import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MapControls } from '@react-three/drei'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { MapControls as MapControlsImpl } from 'three-stdlib'
import { useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { AdsbAircraft } from './flights'
import { WORLD_MAP_COLORS } from '@/lib/world-map-colors'
import { Countries, CountryOutlines, CountryLabels } from './country'
import type { Feature, GetColorFn } from './country'
import { FlightMarkers } from './flight-markers'
import { FlightTooltip } from './flight-tooltip'
import type { TooltipData } from './flight-tooltip'
import { SelectedFlightRoute } from './selected-flight-route'
import { SelectedFlightSheet } from './selected-flight-sheet'
import { useSelectedFlightStore } from '#/store/selected-flight.store'
import { useFlightsStore } from '#/store/flights-store'
import { MapLegend } from './map-legend'
import type { CameraState } from './map-legend'

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

/** Converts pointer position to lon/lat and reports via callback. Uses document-level
 *  pointermove so we get events even when overlays (tooltip, sheet) may block the canvas. */
function CursorTracker({
  onCursorMove,
}: {
  onCursorMove: (coord: { lon: number; lat: number } | null) => void
}) {
  const { camera, gl } = useThree()
  const onCursorMoveRef = useRef(onCursorMove)
  onCursorMoveRef.current = onCursorMove

  useEffect(() => {
    const el = gl.domElement

    const onPointerMove = (e: PointerEvent) => {
      const cam = camera as THREE.OrthographicCamera
      if (!cam.isOrthographicCamera) return
      const rect = el.getBoundingClientRect()
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        onCursorMoveRef.current(null)
        return
      }
      const normX = (e.clientX - rect.left) / rect.width
      const normY = (e.clientY - rect.top) / rect.height
      const halfW = cam.right / cam.zoom
      const halfH = cam.top / cam.zoom
      const lon = THREE.MathUtils.clamp(
        cam.position.x - halfW + normX * (2 * halfW),
        -WORLD_X,
        WORLD_X,
      )
      const lat = THREE.MathUtils.clamp(
        cam.position.y + halfH - normY * (2 * halfH),
        -WORLD_Y,
        WORLD_Y,
      )
      onCursorMoveRef.current({ lon, lat })
    }

    document.addEventListener('pointermove', onPointerMove)
    return () => document.removeEventListener('pointermove', onPointerMove)
  }, [camera, gl])

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

function WorldScene({
  getColor,
  onHover,
  onCameraUpdate,
  onCursorMove,
  onFlightClick,
}: {
  getColor?: GetColorFn
  onHover?: (aircraft: AdsbAircraft | null, x: number, y: number) => void
  onCameraUpdate?: (s: CameraState) => void
  onCursorMove?: (coord: { lon: number; lat: number } | null) => void
  onFlightClick?: (icao24: string) => void
}) {
  const [features, setFeatures] = useState<Feature[]>([])
  const [aircraft, setAircraft] = useState<AdsbAircraft[]>([])
  const controlsRef = useRef<MapControlsImpl>(null)
  const wheelPan = PAN_MODE === 'wheel'
  const fetchAircraftAll = useAction(api.lib.adbsexchange.fetchAircraftAll)

  const fetchParamsRef = useRef<{ lat: number; lon: number; dist: number }>({
    lat: 0,
    lon: 0,
    dist: 500,
  })

  const { camera } = useThree()
  useFrame(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return
    const halfW = camera.right / camera.zoom
    const halfH = camera.top / camera.zoom
    const lat = camera.position.y
    const lon = camera.position.x
    const dist = Math.max(100, 80 * Math.max(halfW, halfH))
    fetchParamsRef.current = { lat, lon, dist }
  })

  useEffect(() => {
    let cancelled = false
    const pollTimeout: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      try {
        const res = await fetchAircraftAll()
        if (cancelled) return
        const data = JSON.parse(res) as { ac: AdsbAircraft[] }
        setAircraft(data.ac)
      } catch (e) {
        console.error('ADSBExchange fetch failed:', e)
      }
      if (!cancelled) {
        // pollTimeout = setTimeout(poll, 10_000)
      }
    }
    poll()

    return () => {
      cancelled = true
      if (pollTimeout) clearTimeout(pollTimeout)
    }
  }, [fetchAircraftAll])

  // Load GeoJSON country data once.
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then((r) => r.json())
      .then((d: { features: Feature[] }) => setFeatures(d.features))
      .catch(console.error)
  }, [])

  const selectedIcao24 = useSelectedFlightStore((state) => state.selectedIcao24)

  useEffect(() => {
    const { setFlightsFromViewport } = useFlightsStore.getState()
    setFlightsFromViewport(aircraft, selectedIcao24)
  }, [aircraft, selectedIcao24])

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
        aircraft={aircraft}
        onHover={onHover}
        onClick={onFlightClick}
      />

      <MapControls
        ref={controlsRef}
        enableRotate={false}
        enableZoom={!wheelPan}
        dampingFactor={0.5}
        zoomSpeed={0.7}
        zoomToCursor
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
      {onCursorMove && <CursorTracker onCursorMove={onCursorMove} />}
    </>
  )
}

export default function WorldMap({ getColor }: { getColor?: GetColorFn }) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [cursorCoord, setCursorCoord] = useState<{
    lon: number
    lat: number
  } | null>(null)
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
    (aircraft: AdsbAircraft | null, x: number, y: number) => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
      if (aircraft) {
        setTooltip({ aircraft, x, y })
      } else {
        hideTimerRef.current = setTimeout(() => setTooltip(null), 120)
      }
    },
    [],
  )

  const handleCameraUpdate = useCallback((s: CameraState) => {
    setCameraState(s)
  }, [])

  const handleCursorMove = useCallback(
    (coord: { lon: number; lat: number } | null) => {
      setCursorCoord(coord)
    },
    [],
  )

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
          onPointerMissed={() => setSelectedIcao24(null)}
        >
          <WorldScene
            getColor={getColor}
            onHover={handleHover}
            onCameraUpdate={handleCameraUpdate}
            onCursorMove={handleCursorMove}
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
      <MapLegend {...cameraState} cursor={cursorCoord} />

      <SelectedFlightSheet />
    </>
  )
}
