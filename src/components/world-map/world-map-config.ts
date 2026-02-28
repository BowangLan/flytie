import type { ViewState } from 'react-map-gl/maplibre'
import { COLORS } from '@/lib/colors'
import { WORLD_MAP_COLORS } from '@/lib/world-map-colors'

export const INITIAL_VIEW_STATE: ViewState = {
  longitude: 0,
  latitude: 20,
  zoom: 4,
  bearing: 0,
  pitch: 0,
  padding: { top: 0, bottom: 0, left: 0, right: 0 },
}

export const MIN_ZOOM = 1
export const MAX_ZOOM = 20
export const MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

export const MAP_BACKGROUND = COLORS.NEUTRAL_800
export const MAP_OCEAN = COLORS.NEUTRAL_600
export const MAP_OCEAN_LINE = COLORS.NEUTRAL_700
export const MAP_LAND = COLORS.NEUTRAL_800
export const MAP_BOUNDARY = COLORS.NEUTRAL_700
export const MAP_COUNTRY_LABEL = COLORS.NEUTRAL_500
export const MAP_PLACE_LABEL = COLORS.NEUTRAL_500
export const MAP_WATER_LABEL = COLORS.NEUTRAL_600

export const WEATHER_SOURCE_ID = 'weather-radar'
export const WEATHER_LAYER_ID = 'weather-radar-layer'
export const WEATHER_TILE_SIZE = 256
export const WEATHER_TILE_OPACITY = 0.38
export const WEATHER_MAX_ZOOM = 20

export type CursorCoord = { lon: number; lat: number } | null

export const WORLD_MAP_BACKGROUND_STYLE = {
  background: WORLD_MAP_COLORS.background,
}
