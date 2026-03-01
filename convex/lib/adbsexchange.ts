import { action } from '../_generated/server'
import { v } from 'convex/values'
import { api } from '../_generated/api'

const RAPIDAPI_KEY = '543928b6e4msheab5962d2d44babp1975f5jsndd8044f6469f'
const RAPIDAPI_HOST = 'adsbexchange-com1.p.rapidapi.com'

/** Aircraft from ADS-B Exchange API (v2) */
export interface AdsbAircraft {
  /** Alert/emergency flag (0 = none) */
  alert: number
  /** Barometric altitude in feet */
  alt_baro: number
  /** Geometric (GNSS) altitude in feet */
  alt_geom: number
  /** Vertical rate (barometric) in ft/min; positive = climbing */
  baro_rate: number
  /** ICAO aircraft category (e.g. A3 = 15–19m wingspan, jet) */
  category: string
  /** Emergency state (e.g. "none") */
  emergency: string
  /** Flight callsign (8 chars, may be padded) */
  flight: string
  /** Geometric vertical rate in ft/min */
  geom_rate: number
  /** Ground speed in knots */
  gs: number
  /** GNSS vertical accuracy (meters) */
  gva: number
  /** ICAO 24-bit transponder address (hex) */
  hex: string
  /** Indicated airspeed in knots */
  ias: number
  /** Latitude (WGS-84) */
  lat: number
  /** Longitude (WGS-84) */
  lon: number
  /** Mach number */
  mach: number
  /** Magnetic heading in degrees */
  mag_heading: number
  /** Total message count from this transponder */
  messages: number
  /** Multilateration timestamps */
  mlat: unknown[]
  /** Navigation Accuracy Category – position (0–11) */
  nac_p: number
  /** Navigation Accuracy Category – velocity (0–2) */
  nac_v: number
  /** FMS-selected altitude in feet */
  nav_altitude_fms?: number
  /** MCP-selected altitude in feet */
  nav_altitude_mcp?: number
  /** Selected heading in degrees */
  nav_heading?: number
  /** QNH barometric setting (hPa) */
  nav_qnh?: number
  /** Navigation Integrity Category (0–11) */
  nic: number
  /** Barometric NIC */
  nic_baro: number
  /** Outside air temperature in °C */
  oat?: number
  /** Aircraft registration (e.g. EC-ORK) */
  r: string
  /** Receiver/antenna channel identifier */
  rc: number
  /** Roll angle in degrees */
  roll: number
  /** Received signal strength (dBm) */
  rssi: number
  /** System design assurance */
  sda: number
  /** Seconds since last message */
  seen: number
  /** Seconds since last position update */
  seen_pos: number
  /** Source Integrity Level (0–3) */
  sil: number
  /** SIL type: "perhour" or "perflight" */
  sil_type: string
  /** Special Purpose Indicator (0 = off) */
  spi: number
  /** Mode S transponder squawk code */
  squawk: string
  /** ICAO aircraft type code (e.g. B38M, A320) */
  t: string
  /** True airspeed in knots */
  tas: number
  /** Total air temperature in °C */
  tat?: number
  /** TIS-B (Traffic Information Service) data */
  tisb: unknown[]
  /** Ground track in degrees (0–360, clockwise from north) */
  track: number
  /** Track rate in deg/s */
  track_rate: number
  /** True heading in degrees */
  true_heading: number
  /** Position source type (e.g. "adsb_icao") */
  type: string
  /** ADS-B version (0–2) */
  version: number
  /** Wind direction in degrees */
  wd?: number
  /** Wind speed in knots */
  ws?: number
}

export interface AdsbExchangeResponse {
  ac: AdsbAircraft[]
}

/**
 * Fetches aircraft nearby a given latitude/longitude from ADS-B Exchange.
 * NOTE: RapidAPI key is hardcoded for demo—move to environment for production.
 */
export const fetchNearbyAircraft = action({
  args: {
    lat: v.number(),
    lon: v.number(),
    dist: v.number(), // distance in NM
  },
  handler: async (ctx, { lat, lon, dist }): Promise<string> => {
    console.log('[fetchNearbyAircraft] fetching aircraft nearby:', {
      lat,
      lon,
      dist,
    })
    const url = `https://adsbexchange-com1.p.rapidapi.com/v2/lat/${lat}/lon/${lon}/dist/${dist}/`
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok)
      throw new Error(
        `ADSBExchange API error: ${res.status}: ${await res.text()}`,
      )
    const data = (await res.json()) as AdsbExchangeResponse
    console.log(
      '[fetchNearbyAircraft] fetched aircraft nearby:',
      data.ac.length,
    )
    return JSON.stringify(data)
  },
})

export const fetchAircraftAll = action({
  args: {},
  handler: async (ctx) => {
    const data: string = await ctx.runAction(
      api.lib.adbsexchange.fetchNearbyAircraft,
      {
        lat: 0,
        lon: 0,
        dist: 1000000,
      },
    )
    return data
  },
})


/**
 * Adsb Exchange API: traces
 * 
 * "Trace Files" – Activity by individual ICAO hex code for all aircraft during a 24-hour period.
 * Files are stored in subdirectories named by the last two digits of the hex code.
 * Example: For ICAO hex "ABCD12", the file will be found under "12/trace_full_abcd12.json".
 * 
 * @see https://www.adsbexchange.com/products/historical-data
 */


export type AdsbExchangeTrace = {
  icao: string
  r: string
  t: string
  dbFlags: number
  desc: string
  ownOp: string
  year: string
  timestamp: number
  trace: [
    number,    // timestamp (seconds since epoch or relative day time)
    number,    // latitude
    number,    // longitude
    number | string | null, // altitude (feet, can be null or missing)
    number,    // ground speed (knots?)
    number,    // track (degrees)
    number,    // vertical rate (ft/min)
    number | null, // barometric vertical rate (ft/min, can be null)
    any,       // mode-s/adsb msg or object (can be null or object with msg data)
    string,    // type ("adsb_icao" etc)
    number | null, // geometric altitude
    number | null, // vertical rate (duplicate or spare?)
    any,       // reserved / unknown, often null
    any        // reserved / unknown, often null
  ][]
}


type AdsbExchangeTraceIndex = {
  traces: string[]
}


const BASE_URL = "https://samples.adsbexchange.com"

function getDatePath(year: number, month: number, day: number) {
  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
}

async function getAdsbExchangeTraceIndexByDay(year: number, month: number, day: number) {
  const datePath = getDatePath(year, month, day)
  const url = `${BASE_URL}/traces/${datePath}/index.json`
  const response = await fetch(url, {
    headers: { 'Accept-Encoding': 'identity' },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch trace index: ${response.status} ${response.statusText}`,
    )
  }

  try {
    const data = await response.json()
    if (
      !data ||
      typeof data !== 'object' ||
      !('traces' in data) ||
      !Array.isArray(data.traces)
    ) {
      throw new Error('Invalid trace index data')
    }
    return data as AdsbExchangeTraceIndex
  } catch (error) {
    throw new Error(`Failed to parse trace index: ${error}`)
  }
}

async function getAdsbExchangeTracesByDayAndIcao(
  icao24: string,
  year: number,
  month: number,
  day: number,
) {
  const dateStr = getDatePath(year, month, day)
  const xx = icao24.slice(-2).toLowerCase()
  const icao = icao24.toLowerCase()
  const url = `${BASE_URL}/traces/${dateStr}/${xx}/trace_full_${icao}.json`

  const response = await fetch(url, {
    headers: { 'Accept-Encoding': 'identity' },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch traces: ${response.status} ${response.statusText}`,
    )
  }

  try {
    const data = await response.json()
    if (!data || typeof data !== 'object' || !('trace' in data)) {
      throw new Error('Invalid traces data')
    }
    return data as AdsbExchangeTrace
  } catch (error) {
    throw new Error(`Failed to parse traces: ${error}`)
  }
}

export const fetchTracesByDayAndIcaos = action({
  args: {
    year: v.number(),
    month: v.number(),
    day: v.number(),
    icaos: v.array(v.string()),
  },
  handler: async (ctx, { year, month, day, icaos }) => {
    const BATCH_SIZE = 10
    const traces: AdsbExchangeTrace[] = []
    for (let i = 0; i < icaos.length; i += BATCH_SIZE) {
      const batch = icaos.slice(i, i + BATCH_SIZE)
      console.log(`[fetchTracesByDayAndIcaos] fetching batch ${i} of ${icaos.length}`)
      const batchTraces = await Promise.all(
        batch.map(icao => getAdsbExchangeTracesByDayAndIcao(icao, year, month, day))
      )
      traces.push(...batchTraces)
    }
    return traces
  },
})

export const fetchTraceDayIndex = action({
  args: {
    year: v.number(),
    month: v.number(),
    day: v.number(),
  },
  handler: async (ctx, { year, month, day }) => {
    return await getAdsbExchangeTraceIndexByDay(year, month, day)
  },
})
