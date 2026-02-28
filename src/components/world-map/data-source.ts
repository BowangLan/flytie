import type { AdsbAircraft } from './flights'
import type { Feature } from './country'

export const GEOJSON_URL =
  'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson'

export type WorldMapDataSnapshot = {
  aircraft: AdsbAircraft[]
  features: Feature[]
}

export type WorldMapDataSource = {
  loadAircraft: () => Promise<AdsbAircraft[]>
  loadFeatures: (signal?: AbortSignal) => Promise<Feature[]>
}

export async function fetchWorldFeatures(signal?: AbortSignal) {
  const response = await fetch(GEOJSON_URL, { signal })
  const data = (await response.json()) as { features: Feature[] }
  return data.features
}

export function createWorldMapDataSource({
  loadAircraft,
  loadFeatures = fetchWorldFeatures,
}: Partial<WorldMapDataSource> & Pick<WorldMapDataSource, 'loadAircraft'>): WorldMapDataSource {
  return {
    loadAircraft,
    loadFeatures,
  }
}
