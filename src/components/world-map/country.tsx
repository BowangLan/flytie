import { Text } from '@react-three/drei'
import earcut from 'earcut'
import { memo, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { WORLD_MAP_COLORS } from '@/lib/world-map-colors'

export type LonLat = [number, number]

export interface Feature {
  properties?: { name?: string }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][][] | number[][][]
  }
}

export type GetColorFn = (feature: Feature) => string

export function countryToMesh(
  feature: Feature,
  color: string = WORLD_MAP_COLORS.countryFallback,
  z = 0,
): { geometry: THREE.BufferGeometry; color: string }[] | null {
  const { type, coordinates } = feature.geometry

  const polygons: number[][][][] =
    type === 'Polygon'
      ? [coordinates as number[][][]]
      : (coordinates as number[][][][])

  const result: { geometry: THREE.BufferGeometry; color: string }[] = []

  for (const polygonRings of polygons) {
    const flat2d: number[] = []
    const holeIndices: number[] = []
    let offset = 0

    // Exterior ring
    const exterior = polygonRings[0] as unknown as LonLat[]
    for (const [lon, lat] of exterior) {
      flat2d.push(lon, lat)
    }
    offset += exterior.length

    // Holes
    for (let h = 1; h < polygonRings.length; h++) {
      holeIndices.push(offset)
      const hole = polygonRings[h] as unknown as LonLat[]
      for (const [lon, lat] of hole) {
        flat2d.push(lon, lat)
      }
      offset += hole.length
    }

    const indices = earcut(
      flat2d,
      holeIndices.length > 0 ? holeIndices : undefined,
      2,
    )
    const positions: number[] = []
    for (let i = 0; i < flat2d.length; i += 2) {
      positions.push(flat2d[i], flat2d[i + 1], z)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setIndex(indices)
    geo.computeVertexNormals()

    result.push({ geometry: geo, color })
  }

  return result
}

export function buildCountryGeometry(features: Feature[]) {
  const positions: number[] = []
  for (const feature of features) {
    const { type, coordinates } = feature.geometry
    const polygons: number[][][][] =
      type === 'Polygon'
        ? [coordinates as number[][][]]
        : (coordinates as number[][][][])
    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (let i = 0; i < ring.length - 1; i++) {
          positions.push(
            ring[i][0],
            ring[i][1],
            0,
            ring[i + 1][0],
            ring[i + 1][1],
            0,
          )
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(positions), 3),
  )
  return geo
}

export function getFeatureCentroid(feature: Feature): [number, number] {
  const { type, coordinates } = feature.geometry
  const polygons: number[][][][] =
    type === 'Polygon'
      ? [coordinates as number[][][]]
      : (coordinates as number[][][][])
  let sumLon = 0
  let sumLat = 0
  let count = 0
  for (const polygon of polygons) {
    const ring = polygon[0]
    for (const pt of ring) {
      sumLon += pt[0]
      sumLat += pt[1]
      count++
    }
  }
  return count > 0 ? [sumLon / count, sumLat / count] : [0, 0]
}

function CountriesImpl({
  features,
  getColor,
}: {
  features: Feature[]
  getColor?: GetColorFn
}) {
  const meshes = useMemo(
    () =>
      features.flatMap((feature, i) => {
        const color = getColor?.(feature) ?? WORLD_MAP_COLORS.countryDefault
        const countryMeshes = countryToMesh(feature, color)
        if (!countryMeshes) return []
        return countryMeshes.map((mesh, j) => ({
          key: `${i}-${j}`,
          ...mesh,
        }))
      }),
    [features, getColor],
  )

  useEffect(
    () => () => {
      for (const mesh of meshes) {
        mesh.geometry.dispose()
      }
    },
    [meshes],
  )

  return (
    <>
      {meshes.map((mesh) => {
        return (
          <mesh key={mesh.key} geometry={mesh.geometry}>
            <meshBasicMaterial color={mesh.color} side={THREE.DoubleSide} />
          </mesh>
        )
      })}
    </>
  )
}

export const Countries = memo(CountriesImpl)

function CountryOutlinesImpl({ features }: { features: Feature[] }) {
  const geo = useMemo(
    () => (features.length > 0 ? buildCountryGeometry(features) : null),
    [features],
  )

  useEffect(
    () => () => {
      geo?.dispose()
    },
    [geo],
  )

  if (!geo) return null

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={WORLD_MAP_COLORS.outline} />
    </lineSegments>
  )
}

export const CountryOutlines = memo(CountryOutlinesImpl)

function CountryLabelsImpl({ features }: { features: Feature[] }) {
  const labels = useMemo(
    () =>
      features.flatMap((feature, i) => {
        const name = feature.properties?.name
        if (!name || name === 'Antarctica') return []
        const [lon, lat] = getFeatureCentroid(feature)
        return [{ key: i, name, lon, lat }]
      }),
    [features],
  )

  return (
    <>
      {labels.map((label) => {
        return (
          <Text
            key={label.key}
            position={[label.lon, label.lat, 0.5]}
            fontSize={0.8}
            color={WORLD_MAP_COLORS.label}
            anchorX="center"
            anchorY="middle"
            fontStyle="italic"
          >
            {label.name}
          </Text>
        )
      })}
    </>
  )
}

export const CountryLabels = memo(CountryLabelsImpl)
