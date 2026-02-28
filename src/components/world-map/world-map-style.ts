import type { Map as MapLibreMap } from 'maplibre-gl'
import { COLORS } from '@/lib/colors'
import {
  MAP_BACKGROUND,
  MAP_BOUNDARY,
  MAP_COUNTRY_LABEL,
  MAP_LAND,
  MAP_OCEAN,
  MAP_OCEAN_LINE,
  MAP_PLACE_LABEL,
  MAP_WATER_LABEL,
} from './world-map-config'

const FILL_OVERRIDES = [
  ['background', 'background-color', MAP_BACKGROUND],
  ['landcover', 'fill-color', MAP_LAND],
  ['landuse', 'fill-color', MAP_LAND],
  ['landuse_residential', 'fill-color', 'rgba(38, 38, 38, 0.45)'],
  ['water', 'fill-color', MAP_OCEAN],
  ['water_shadow', 'fill-color', 'rgba(10, 10, 10, 0.9)'],
  ['waterway', 'line-color', MAP_OCEAN_LINE],
  ['boundary_country_outline', 'line-color', 'rgba(10, 10, 10, 0.96)'],
  ['boundary_country_inner', 'line-color', MAP_BOUNDARY],
] as const

const LABEL_OVERRIDES = [
  ['place_country_1', MAP_COUNTRY_LABEL, 'rgba(10, 10, 10, 0.96)', 1.2],
  ['place_country_2', MAP_COUNTRY_LABEL, 'rgba(10, 10, 10, 0.96)', 1.2],
  ['place_state', COLORS.NEUTRAL_600, 'rgba(10, 10, 10, 0.96)', 1],
  ['place_continent', COLORS.NEUTRAL_700, 'rgba(10, 10, 10, 0.96)', 1],
  ['place_city_r6', MAP_PLACE_LABEL, 'rgba(10, 10, 10, 0.96)', 1],
  ['place_city_r5', MAP_PLACE_LABEL, 'rgba(10, 10, 10, 0.96)', 1],
  ['place_town', COLORS.NEUTRAL_500, 'rgba(10, 10, 10, 0.94)', 1],
  ['place_villages', COLORS.NEUTRAL_600, 'rgba(10, 10, 10, 0.94)', 1],
  ['place_suburbs', COLORS.NEUTRAL_600, 'rgba(10, 10, 10, 0.94)', 1],
  ['place_hamlet', COLORS.NEUTRAL_700, 'rgba(10, 10, 10, 0.94)', 1],
  ['watername_ocean', MAP_WATER_LABEL, 'rgba(10, 10, 10, 0.96)', 1.1],
  ['watername_sea', MAP_WATER_LABEL, 'rgba(10, 10, 10, 0.96)', 1.1],
  ['watername_lake', COLORS.NEUTRAL_600, 'rgba(10, 10, 10, 0.96)', 1],
  ['watername_lake_line', COLORS.NEUTRAL_600, 'rgba(10, 10, 10, 0.96)', 1],
  ['waterway_label', COLORS.NEUTRAL_600, 'rgba(10, 10, 10, 0.96)', 1],
] as const

export function applyMapStyleOverrides(map: MapLibreMap) {
  const style = map.getStyle()
  const layerIds = new Set(style.layers.map((layer) => layer.id))

  for (const [layerId, prop, value] of FILL_OVERRIDES) {
    if (!layerIds.has(layerId)) continue
    map.setPaintProperty(layerId, prop, value)
  }

  for (const [layerId, textColor, haloColor, haloWidth] of LABEL_OVERRIDES) {
    if (!layerIds.has(layerId)) continue
    map.setPaintProperty(layerId, 'text-color', textColor)
    map.setPaintProperty(layerId, 'text-halo-color', haloColor)
    map.setPaintProperty(layerId, 'text-halo-width', haloWidth)
  }
}
