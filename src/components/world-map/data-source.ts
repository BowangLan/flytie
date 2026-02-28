import type { AdsbAircraft } from './flights'

export type WorldMapDataSnapshot = {
  aircraft: AdsbAircraft[]
}

export type WorldMapDataSource = {
  loadAircraft: () => Promise<AdsbAircraft[]>
}

export function createWorldMapDataSource({
  loadAircraft,
}: Partial<WorldMapDataSource> &
  Pick<WorldMapDataSource, 'loadAircraft'>): WorldMapDataSource {
  return {
    loadAircraft,
  }
}
