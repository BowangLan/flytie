/** OpenSky Network REST API — /states/all
 *  Docs: https://openskynetwork.github.io/opensky-api/rest.html
 *  Rate limit (anonymous): 400 credits/day, 10-second data resolution.
 */

import { createServerFn } from '@tanstack/react-start'

const OPENSKY_API_URL = 'https://opensky-network.org/api/states/all'

// ─── Enums ────────────────────────────────────────────────────────────────────

/** Source that produced the position. */
export const enum PositionSource {
  ADSB = 0,
  ASTERIX = 1,
  MLAT = 2,
  FLARM = 3,
}

// ─── Raw API shape ─────────────────────────────────────────────────────────────

/**
 * 18-element array returned by the OpenSky API for each aircraft.
 * Indices map directly to the field order documented in the spec.
 */
type RawStateVector = [
  /* 0  */ icao24: string,
  /* 1  */ callsign: string | null,
  /* 2  */ originCountry: string,
  /* 3  */ timePosition: number | null,
  /* 4  */ lastContact: number,
  /* 5  */ longitude: number | null,
  /* 6  */ latitude: number | null,
  /* 7  */ baroAltitude: number | null,
  /* 8  */ onGround: boolean,
  /* 9  */ velocity: number | null,
  /* 10 */ trueTrack: number | null,
  /* 11 */ verticalRate: number | null,
  /* 12 */ sensors: number[] | null,
  /* 13 */ geoAltitude: number | null,
  /* 14 */ squawk: string | null,
  /* 15 */ spi: boolean,
  /* 16 */ positionSource: PositionSource,
  /* 17 */ category: number,
]

interface OpenSkyResponse {
  /** Unix timestamp associated with the state vectors. */
  time: number
  /** Null when no states are available. */
  states: RawStateVector[] | null
}

// ─── Parsed domain type ────────────────────────────────────────────────────────

/**
 * A single aircraft state vector with named, typed fields.
 * Only aircraft with a known position are represented (lon/lat are non-null).
 */
export interface Flight {
  /** ICAO 24-bit transponder address (hex string). */
  icao24: string
  /** 8-character callsign, trimmed. Null if unknown. */
  callsign: string | null
  /** Country name derived from ICAO address. */
  originCountry: string
  /** Unix timestamp of the last position update. Null if unavailable. */
  timePosition: number | null
  /** Unix timestamp of the most recent message from this transponder. */
  lastContact: number
  /** WGS-84 longitude in decimal degrees (−180 … 180). */
  longitude: number
  /** WGS-84 latitude in decimal degrees (−90 … 90). */
  latitude: number
  /** Barometric altitude in meters. Null if unavailable. */
  baroAltitude: number | null
  /** True when a surface position report is active. */
  onGround: boolean
  /** Ground speed in m/s. Null if unavailable. */
  velocity: number | null
  /** Track angle in degrees clockwise from north (0–360). Null if unavailable. */
  trueTrack: number | null
  /** Vertical rate in m/s (positive = climbing). Null if unavailable. */
  verticalRate: number | null
  /** IDs of the ADS-B receivers that contributed to this vector. Null if unavailable. */
  sensors: number[] | null
  /** Geometric (GNSS) altitude in meters. Null if unavailable. */
  geoAltitude: number | null
  /** Mode S transponder squawk code. Null if unavailable. */
  squawk: string | null
  /** Special Purpose Indicator flag. */
  spi: boolean
  /** Source of the position data. */
  positionSource: PositionSource
  /** ICAO aircraft category code (0 = unknown). */
  category: number
}

// ─── Parsing ───────────────────────────────────────────────────────────────────

/**
 * Converts a raw state-vector array into a typed {@link Flight}.
 * Returns `null` for aircraft without a known position.
 */
function parseStateVector(raw: RawStateVector): Flight | null {
  const longitude = raw[5]
  const latitude = raw[6]
  if (longitude === null || latitude === null) return null

  return {
    icao24: raw[0],
    callsign: raw[1]?.trim() || null,
    originCountry: raw[2],
    timePosition: raw[3],
    lastContact: raw[4],
    longitude,
    latitude,
    baroAltitude: raw[7],
    onGround: raw[8],
    velocity: raw[9],
    trueTrack: raw[10],
    verticalRate: raw[11],
    sensors: raw[12],
    geoAltitude: raw[13],
    squawk: raw[14],
    spi: raw[15],
    positionSource: raw[16],
    category: raw[17],
  }
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/** Fetches all current aircraft state vectors from the OpenSky Network API. */
export const fetchFlights = createServerFn({ method: 'GET' }).handler(async () => {
  const res = await fetch(OPENSKY_API_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${process.env.OPENSKY_ACCESS_TOKEN!}`,
    },
  })
  
  // status code
  // console.log(`Status code: ${res.status}`)

  if (!res.ok) throw new Error(`OpenSky API responded with ${res.status}`)

  const data = (await res.json()) as OpenSkyResponse

  if (!data.states) return []

  return data.states.flatMap((raw) => {
    const flight = parseStateVector(raw)
    return flight !== null ? [flight] : []
  })
})
