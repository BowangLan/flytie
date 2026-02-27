import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MapControls } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { MapControls as MapControlsImpl } from 'three-stdlib'
import { useServerFn } from '@tanstack/react-start'
import { WORLD_MAP_COLORS } from '@/lib/world-map-colors'
import {
  type Feature,
  type GetColorFn,
  Countries,
  CountryOutlines,
  CountryLabels,
} from './country'
import { type Flight, fetchFlights } from './flights'
import { FlightMarkers } from './flight-markers'

const GEOJSON_URL =
  'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson'

/** How often to re-fetch flight positions (ms). Anonymous OpenSky accounts
 *  are limited to 400 credits/day, so keep this conservatively long. */
const FLIGHT_POLL_INTERVAL_MS = 5_000 // 5 seconds

const WORLD_X = 180
const WORLD_Y = 90

function CameraConstraints({
  controlsRef,
}: {
  controlsRef: React.RefObject<MapControlsImpl | null>
}) {
  const { camera, size } = useThree()

  useFrame(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return

    // Minimum zoom: world fits in view on at least one axis
    const minZoom = Math.min(size.width / (WORLD_X * 2), size.height / (WORLD_Y * 2))
    if (camera.zoom < minZoom) {
      camera.zoom = minZoom
      camera.updateProjectionMatrix()
    }

    const halfW = size.width / (2 * camera.zoom)
    const halfH = size.height / (2 * camera.zoom)

    // If visible half-extent >= world half-extent on an axis, lock to center
    const cx =
      halfW >= WORLD_X ? 0 : Math.max(-WORLD_X + halfW, Math.min(WORLD_X - halfW, camera.position.x))
    const cy =
      halfH >= WORLD_Y ? 0 : Math.max(-WORLD_Y + halfH, Math.min(WORLD_Y - halfH, camera.position.y))

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

function WorldScene({ getColor }: { getColor?: GetColorFn }) {
  const [features, setFeatures] = useState<Feature[]>([])
  const [flights, setFlights] = useState<Flight[]>([])
  const controlsRef = useRef<MapControlsImpl>(null)
  const fetchFlightsFn = useServerFn(fetchFlights)

  // Load GeoJSON country data once.
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then((r) => r.json())
      .then((d: { features: Feature[] }) => setFeatures(d.features))
      .catch(console.error)
  }, [])

  // Poll OpenSky for live flight positions.
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const data = await fetchFlightsFn()
        console.log(`Flights`, data)
        if (!cancelled) setFlights(data)
      } catch {
        // Silently retain the previous snapshot on network/rate-limit errors.
      }
    }

    void load()
    const id = setInterval(() => void load(), FLIGHT_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <>
      {/* Filled country areas */}
      <Countries features={features} getColor={getColor} />

      {/* Country outlines */}
      <CountryOutlines features={features} />

      {/* Country labels */}
      <CountryLabels features={features} />

      {/* Live flight markers — blue = airborne, amber = on ground */}
      <FlightMarkers flights={flights} />

      <MapControls
        ref={controlsRef}
        enableRotate={false}
        minZoom={6}
        maxZoom={500}
        dampingFactor={0.2}
        screenSpacePanning
        enablePan
      />
      <CameraConstraints controlsRef={controlsRef} />
    </>
  )
}

export default function WorldMap({ getColor }: { getColor?: GetColorFn }) {
  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 100], zoom: 16 }}
        gl={{ antialias: true }}
        style={{ background: WORLD_MAP_COLORS.background }}
      >
        <WorldScene getColor={getColor} />
      </Canvas>
    </div>
  )
}