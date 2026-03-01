import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { getOrSet } from '#/lib/cache'

/** AeroDataBox airport location (lat/lon) */
export interface AerodataboxLocation {
  lat: number
  lon: number
}

/** AeroDataBox airport */
export interface AerodataboxAirport {
  countryCode: string
  iata?: string | null
  icao: string
  localCode?: string | null
  location: AerodataboxLocation
  municipalityName?: string | null
  name: string
  shortName?: string | null
  timeZone: string
}

/** AeroDataBox time with local and UTC */
export interface AerodataboxTime {
  local: string
  utc: string
}

/** AeroDataBox aircraft image (when withAircraftImage=true) */
export interface AerodataboxAircraftImage {
  author: string
  description: string
  htmlAttributions: string[]
  license: string
  title: string
  url: string
  webUrl: string
}

/** AeroDataBox aircraft (optional on flight; reg/modeS/model nullable when present) */
export interface AerodataboxAircraft {
  image?: AerodataboxAircraftImage
  modeS?: string | null
  model?: string | null
  reg?: string | null
}

/** AeroDataBox airline */
export interface AerodataboxAirline {
  iata?: string | null
  icao?: string | null
  name: string
}

/** AeroDataBox arrival segment */
export interface AerodataboxArrival {
  airport: AerodataboxAirport
  baggageBelt?: string | null
  checkInDesk?: string | null
  gate?: string | null
  predictedTime?: AerodataboxTime
  quality: string[]
  runway?: string | null
  runwayTime?: AerodataboxTime
  revisedTime?: AerodataboxTime
  scheduledTime?: AerodataboxTime
  terminal?: string | null
}

/** AeroDataBox departure segment */
export interface AerodataboxDeparture {
  airport: AerodataboxAirport
  checkInDesk?: string | null
  gate?: string | null
  predictedTime?: AerodataboxTime
  quality: string[]
  revisedTime?: AerodataboxTime
  runway?: string | null
  runwayTime?: AerodataboxTime
  scheduledTime?: AerodataboxTime
  terminal?: string | null
}

/** AeroDataBox great circle distance */
export interface AerodataboxGreatCircleDistance {
  feet: number
  km: number
  meter: number
  mile: number
  nm: number
}

/** Distance unit (altitude, great circle, etc.) */
export interface AerodataboxDistanceUnit {
  feet: number
  km: number
  meter: number
  mile: number
  nm: number
}

/** Speed unit (airspeed, ground speed) */
export interface AerodataboxSpeedUnit {
  kt: number
  kmPerHour: number
  miPerHour: number
  meterPerSecond: number
}

/** Angle unit (true track) */
export interface AerodataboxAngleUnit {
  deg: number
  rad: number
}

/** Pressure unit */
export interface AerodataboxPressureUnit {
  hPa: number
  inHg: number
  mmHg: number
}

/** Flight plan (when withFlightPlan=true) */
export interface AerodataboxFlightPlan {
  altitude?: {
    assigned?: AerodataboxDistanceUnit
    requested?: AerodataboxDistanceUnit
  }
  airspeed?: {
    assigned?: AerodataboxSpeedUnit
    requested?: AerodataboxSpeedUnit
  }
  flightRules?: 'IFR' | 'VFR'
  flightType?: 'Other' | 'General' | 'Scheduled' | 'NonScheduled' | 'Military'
  lastUpdatedUtc: string
  revisionNo?: number | null
  route: string
  status?: 'Proposed' | 'Active' | 'Dropped' | 'Cancelled' | 'Completed'
}

/** Real-time positional data (when withLocation=true) */
export interface AerodataboxFlightLocation {
  altitude: AerodataboxDistanceUnit
  groundSpeed: AerodataboxSpeedUnit
  lat: number
  lon: number
  pressure: AerodataboxPressureUnit
  pressureAltitude: AerodataboxDistanceUnit
  reportedAtUtc: string
  trueTrack: AerodataboxAngleUnit
  vsiFpm?: number | null
}

/** AeroDataBox flight (flights by ICAO24 response item) */
export interface AerodataboxFlight {
  aircraft?: AerodataboxAircraft
  airline: AerodataboxAirline
  arrival: AerodataboxArrival
  callSign?: string | null
  codeshareStatus: string
  departure: AerodataboxDeparture
  flightPlan?: AerodataboxFlightPlan
  greatCircleDistance?: AerodataboxGreatCircleDistance
  isCargo: boolean
  lastUpdatedUtc: string
  location?: AerodataboxFlightLocation
  number: string
  status:
    | 'Unknown'
    | 'Expected'
    | 'EnRoute'
    | 'CheckIn'
    | 'Boarding'
    | 'GateClosed'
    | 'Departed'
    | 'Delayed'
    | 'Approaching'
    | 'Arrived'
    | 'Canceled'
    | 'Diverted'
    | 'CanceledUncertain'
}

export type AerodataboxFlightByIcao24Response = AerodataboxFlight[]

function getRapidApiConfig() {
  const key = process.env.RAPIDAPI_KEY
  const host = process.env.RAPIDAPI_HOST_AERODATABOX
  if (!key || !host) {
    throw new Error(
      'Missing RAPIDAPI_KEY or RAPIDAPI_HOST_AERODATABOX environment variables',
    )
  }
  return { key, host }
}

/**
 * Fetches flight(s) by ICAO 24-bit transponder address from AeroDataBox.
 * @see https://doc.aerodatabox.com/rapidapi.html#/operations/GetFlight_FlightNearest
 */
export const getFlightByIcao24Action = createServerFn()
  .inputValidator(
    z.object({
      icao24: z.string(),
      dateLocalRole: z.enum(['Departure', 'Arrival', 'Both']).optional(),
      withAircraftImage: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const dateLocalRole = data.dateLocalRole ?? 'Both'
    const withAircraftImage = data.withAircraftImage ?? true
    const cacheKey = `aerodatabox:flight:icao24:${data.icao24}:${dateLocalRole}:${withAircraftImage}`

    return getOrSet<AerodataboxFlightByIcao24Response>(
      cacheKey,
      async () => {
        const { key, host } = getRapidApiConfig()
        const params = new URLSearchParams({
          dateLocalRole,
          withAircraftImage: String(withAircraftImage),
        })
        const url = `https://${host}/flights/Icao24/${data.icao24}?${params}`
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-RapidAPI-Key': key,
            'X-RapidAPI-Host': host,
          },
        })
        if (!res.ok) {
          throw new Error(
            `AeroDataBox API error: ${res.status}: ${await res.text()}`,
          )
        }

        const text = await res.text()
        try {
          const flights = JSON.parse(text) as AerodataboxFlightByIcao24Response
          return flights
        } catch (error) {
          console.error('[getFlightByIcao24Action] error parsing response:', error)
          throw error
        }
      },
      2,
    )
  })
