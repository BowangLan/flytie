import { action } from '../_generated/server'
import { v } from 'convex/values'

/** NOTE: RapidAPI key is hardcoded for demo—move to environment for production. */

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

  /**
   * Flight progress status.
   * 
   * Possible values:
   *   0 - Unknown: Status is not available for this flight
   *   1 - Expected: Expected
   *   2 - EnRoute: En route
   *   3 - CheckIn: Check-in is open
   *   4 - Boarding: Boarding in progress / Last call
   *   5 - GateClosed: Gate closed
   *   6 - Departed: Departed
   *   7 - Delayed: Delayed
   *   8 - Approaching: On approach to destination
   *   9 - Arrived: Arrived
   *   10 - Canceled: Cancelled
   *   11 - Diverted: Diverted to another destination
   *   12 - CanceledUncertain: Status of the flight is uncertain, may be cancelled
   * 
   * Allowed string values:
   *   "Unknown"
   *   "Expected"
   *   "EnRoute"
   *   "CheckIn"
   *   "Boarding"
   *   "GateClosed"
   *   "Departed"
   *   "Delayed"
   *   "Approaching"
   *   "Arrived"
   *   "Canceled"
   *   "Diverted"
   *   "CanceledUncertain"
   */
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

const RAPIDAPI_KEY = '543928b6e4msheab5962d2d44babp1975f5jsndd8044f6469f'
const RAPIDAPI_HOST = 'aerodatabox.p.rapidapi.com'

/**
 * Fetches flight(s) by ICAO 24-bit transponder address from AeroDataBox.
 * @see https://doc.aerodatabox.com/rapidapi.html#/operations/GetFlight_FlightNearest
 */
export const fetchFlightByIcao24 = action({
  args: {
    icao24: v.string(),
    dateLocalRole: v.optional(
      v.union(v.literal('Departure'), v.literal('Arrival'), v.literal('Both')),
    ),
    withAircraftImage: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { icao24, dateLocalRole = 'Both', withAircraftImage = true },
  ) => {
    const params = new URLSearchParams({
      dateLocalRole,
      withAircraftImage: String(withAircraftImage),
    })
    const url = `https://${RAPIDAPI_HOST}/flights/Icao24/${icao24}?${params}`
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
    })
    if (!res.ok)
      throw new Error(
        `AeroDataBox API error: ${res.status}: ${await res.text()}`,
      )
    try {
      const data = (await res.json()) as AerodataboxFlightByIcao24Response
      return data
    } catch (error) {
      console.error('[fetchFlightByIcao24] error parsing response:', error)
      throw error
    }
  },
})
