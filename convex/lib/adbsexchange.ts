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
