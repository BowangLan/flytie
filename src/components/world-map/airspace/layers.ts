import { WORLD_MAP_COLORS } from '@/lib/world-map-colors'

export const AIRSPACE_BOUNDARY_GLOW_LAYER = {
  id: 'artcc-boundaries-glow',
  type: 'line' as const,
  paint: {
    'line-color': WORLD_MAP_COLORS.airspaceBoundaryGlow,
    'line-width': [
      'interpolate',
      ['linear'],
      ['zoom'],
      1,
      0.75,
      4,
      1.2,
      8,
      2,
      12,
      3.5,
    ],
    'line-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      1,
      0.18,
      4,
      0.24,
      8,
      0.3,
      12,
      0.4,
    ],
    'line-blur': 0.6,
  },
  layout: {
    'line-cap': 'round' as const,
    'line-join': 'round' as const,
  },
}

export const AIRSPACE_BOUNDARY_LINE_LAYER = {
  id: 'artcc-boundaries-line',
  type: 'line' as const,
  paint: {
    'line-color': WORLD_MAP_COLORS.airspaceBoundary,
    'line-width': [
      'interpolate',
      ['linear'],
      ['zoom'],
      1,
      0.4,
      4,
      0.8,
      8,
      1.15,
      12,
      1.75,
    ],
    'line-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      1,
      0.45,
      4,
      0.58,
      8,
      0.68,
      12,
      0.82,
    ],
  },
  layout: {
    'line-cap': 'round' as const,
    'line-join': 'round' as const,
  },
}
