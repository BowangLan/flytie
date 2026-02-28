import { useQuery } from '@tanstack/react-query'

const WEATHER_FRAME_URL = 'https://api.rainviewer.com/public/weather-maps.json'
const WEATHER_REFRESH_MS = 10 * 60 * 1000
const WEATHER_TILE_COLOR_SCHEME = 2
const WEATHER_TILE_OPTIONS = '1_1'

type WeatherMapsResponse = {
  host?: string
  radar?: {
    past?: Array<{
      path?: string
      time?: number
    }>
  }
}

export function useWeatherRadar(enabled: boolean, tileSize: number) {
  return useQuery({
    queryKey: ['weather-radar-overlay'],
    enabled,
    refetchInterval: WEATHER_REFRESH_MS,
    queryFn: async () => {
      const response = await fetch(WEATHER_FRAME_URL)
      if (!response.ok) return null

      const data = (await response.json()) as WeatherMapsResponse
      const host = data.host
      const latestFrame = data.radar?.past?.at(-1)?.path
      if (!host || !latestFrame) return null

      return `${host}${latestFrame}/${tileSize}/{z}/{x}/{y}/${WEATHER_TILE_COLOR_SCHEME}/${WEATHER_TILE_OPTIONS}.png`
    },
  })
}
