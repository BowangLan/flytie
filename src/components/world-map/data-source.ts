import type { AdsbAircraft } from './flights'
import type { NormalFlightManager } from './normal-flight-manager'

export type WorldMapDataSnapshot = {
  aircraft: AdsbAircraft[]
  lastUpdatedTimestamp: number
  normalFlightIcaos: string[]
  normalFlightManager: NormalFlightManager
}

export type WorldMapDataSource = {
  loadAircraft: ({ lat, lon, dist }: { lat: number, lon: number, dist: number }) => Promise<AdsbAircraft[]>
}

export function createWorldMapDataSource({
  loadAircraft,
}: Partial<WorldMapDataSource> &
  Pick<WorldMapDataSource, 'loadAircraft'>): WorldMapDataSource {
  return {
    loadAircraft,
  }
}
