/** Convex action, mutations, and query for live state data from OpenSky. */

import { action, internalMutation, query } from './_generated/server'
import { api, internal } from './_generated/api'
import { v } from 'convex/values'
import { stateDataFields } from './statesTypes'
import type { State } from './statesTypes'

const OPENSKY_API_BASE = 'https://opensky-network.org/api'
const OPENSKY_AUTH_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'

/** Fetches a fresh access token from OpenSky using client credentials. */
async function getOpenSkyToken(): Promise<string> {
  const clientId = process.env.OPENSKY_CLIENT_ID
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET must be set')
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(OPENSKY_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!res.ok) throw new Error(`OpenSky auth failed: ${res.status}`)

  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

/** Fetches from OpenSky API with a fresh token.
 *  Path is relative to /api/ (e.g. "states/all").
 *  Params are optional query string parameters.
 */
async function fetchOpenSky<T>(
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const token = await getOpenSkyToken()
  const base = `${OPENSKY_API_BASE}/${path.replace(/^\//, '')}`
  const search = params
    ? '?' +
      new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).map(([k, v]) => [k, String(v)]),
        ),
      ).toString()
    : ''
  const url = base + search

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error(`OpenSky API error: ${res.status}`)

  return (await res.json()) as T
}

// ─── OpenSky API wrappers ──────────────────────────────────────────────────────

/** Raw flight object from OpenSky /flights/all. */
interface OpenSkyFlight {
  icao24: string
  firstSeen: number
  estDepartureAirport: string | null
  lastSeen: number
  estArrivalAirport: string | null
  callsign?: string | null
  estDepartureAirportHorizDistance?: number
  estDepartureAirportVertDistance?: number
  estArrivalAirportHorizDistance?: number
  estArrivalAirportVertDistance?: number
  departureAirportCandidatesCount?: number
  arrivalAirportCandidatesCount?: number
}

type RouteAirportDetails = {
  ident: string
  name: string
  iata_code?: string
  municipality?: string
  iso_country?: string
  latitude_deg?: number
  longitude_deg?: number
}

export type OpenSkyRouteDetail = {
  icao24: string
  firstSeen: number
  lastSeen: number
  estDepartureAirport: string | null
  estArrivalAirport: string | null
  departureAirport: RouteAirportDetails | null
  arrivalAirport: RouteAirportDetails | null
}

/** Fetches flights for a time interval [begin, end]. Max 2 hours per OpenSky API. Returns [] on 404. */
async function fetchFlightsAll(
  begin: number,
  end: number,
): Promise<OpenSkyFlight[]> {
  const token = await getOpenSkyToken()
  const url = `${OPENSKY_API_BASE}/flights/all?begin=${begin}&end=${end}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`OpenSky flights API error: ${res.status}`)
  return (await res.json()) as OpenSkyFlight[]
}

/** Fetches flights for one aircraft for [begin, end]. Returns [] on 404. */
async function fetchFlightsAircraft(
  icao24: string,
  begin: number,
  end: number,
): Promise<OpenSkyFlight[]> {
  const token = await getOpenSkyToken()
  const url =
    `${OPENSKY_API_BASE}/flights/aircraft` +
    `?icao24=${encodeURIComponent(icao24)}&begin=${begin}&end=${end}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return []
  if (!res.ok)
    throw new Error(
      `OpenSky flights/aircraft API error: ${res.status}: ${await res.text()}`,
    )
  return (await res.json()) as OpenSkyFlight[]
}

/** How many states to insert / delete in a single mutation call. */
const BATCH_SIZE = 1000

// ─── Raw OpenSky types ────────────────────────────────────────────────────────

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
  /* 16 */ positionSource: number,
  /* 17 */ category: number,
]

interface OpenSkyResponse {
  time: number
  states: RawStateVector[] | null
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

/** Converts a raw OpenSky state vector into a state, or null if no position. */
function parseStateVector(raw: RawStateVector): State | null {
  const longitude = raw[5]
  const latitude = raw[6]
  if (longitude === null || latitude === null) return null

  return {
    icao24: raw[0],
    callsign: raw[1]?.trim() || undefined,
    originCountry: raw[2],
    timePosition: raw[3] ?? undefined,
    lastContact: raw[4],
    longitude,
    latitude,
    baroAltitude: raw[7] ?? undefined,
    onGround: raw[8],
    velocity: raw[9] ?? undefined,
    trueTrack: raw[10] ?? undefined,
    verticalRate: raw[11] ?? undefined,
    geoAltitude: raw[13] ?? undefined,
    squawk: raw[14] ?? undefined,
    spi: raw[15],
    positionSource: raw[16],
    ...(raw[17] != null && { category: raw[17] }),
  }
}

// ─── Query ────────────────────────────────────────────────────────────────────

/** Returns all states in the currently active snapshot. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const meta = await ctx.db.query('stateMeta').first()
    if (!meta) return []

    const docs = await ctx.db
      .query('states')
      .withIndex('by_snapshotTime', (q) =>
        q.eq('snapshotTime', meta.activeSnapshotTime),
      )
      .collect()

    const res = docs.map(
      ({ _id: _id, _creationTime: _ct, snapshotTime: _st, ...state }) => state,
    )
    return JSON.stringify(res)
  },
})

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Fetches live state data from OpenSky, merges with flight departure/arrival
 * info, stores in Convex, then atomically activates the new snapshot and cleans
 * up the previous one.
 */
export const refresh = action({
  args: {},
  handler: async (ctx) => {
    console.log('[states refresh] starting')
    const nowSec = Math.floor(Date.now() / 1000)
    const statesData = await fetchOpenSky<OpenSkyResponse>('states/all')

    const states: State[] = (statesData.states ?? []).flatMap((raw) => {
      const s = parseStateVector(raw)
      return s ? [s] : []
    })
    console.log(
      '[states refresh] fetched states/all:',
      states.length,
      'aircraft',
    )

    /** Normalize ICAO24 for lookup — pad to 6 hex chars, lowercase. */
    const normalizeIcao = (icao: string) => icao.toLowerCase().padStart(6, '0')

    /** Flight info from old states (4 fields). */
    type FlightInfo = Pick<
      State,
      'estDepartureAirport' | 'estArrivalAirport' | 'firstSeen' | 'lastSeen'
    >
    const flightInfoByIcao = new Map<string, FlightInfo>()

    const listResult = await ctx.runQuery(api.states.list)
    const oldStates: State[] = Array.isArray(listResult)
      ? listResult
      : typeof listResult === 'string'
        ? (JSON.parse(listResult) as State[])
        : []
    console.log(
      '[states refresh] loaded previous snapshot:',
      oldStates.length,
      'states',
    )
    for (const old of oldStates) {
      const key = normalizeIcao(old.icao24)
      const info: FlightInfo = {}
      if (old.estDepartureAirport)
        info.estDepartureAirport = old.estDepartureAirport
      if (old.estArrivalAirport) info.estArrivalAirport = old.estArrivalAirport
      if (old.firstSeen != null) info.firstSeen = old.firstSeen
      if (old.lastSeen != null) info.lastSeen = old.lastSeen
      if (Object.keys(info).length > 0) flightInfoByIcao.set(key, info)
    }
    console.log(
      '[states refresh] flight info from old snapshot:',
      flightInfoByIcao.size,
      'aircraft',
    )

    for (const s of states) {
      const info = flightInfoByIcao.get(normalizeIcao(s.icao24))
      if (info) {
        if (info.estDepartureAirport)
          s.estDepartureAirport = info.estDepartureAirport
        if (info.estArrivalAirport) s.estArrivalAirport = info.estArrivalAirport
        if (info.firstSeen != null) s.firstSeen = info.firstSeen
        if (info.lastSeen != null) s.lastSeen = info.lastSeen
      }
    }

    const countMissing = () =>
      states.filter((s) => !s.estDepartureAirport).length

    let missingCount = countMissing()
    let fetchCount = 0
    const MAX_FLIGHT_FETCHES = 20
    const CHUNK_HOURS = 2
    const chunkSec = CHUNK_HOURS * 60 * 60

    const withFlightInfo = states.length - missingCount
    console.log(
      '[states refresh] after merging from old:',
      withFlightInfo,
      'with flight info,',
      missingCount,
      'missing estDepartureAirport',
    )

    while (missingCount > 0 && fetchCount < MAX_FLIGHT_FETCHES) {
      const endSec = nowSec - fetchCount * chunkSec
      const beginSec = endSec - chunkSec
      const windowDesc = `${new Date(beginSec * 1000).toISOString()} → ${new Date(endSec * 1000).toISOString()}`
      console.log(
        '[states refresh] fetch',
        fetchCount + 1,
        '/',
        MAX_FLIGHT_FETCHES,
        '| window:',
        windowDesc,
        '| missing:',
        missingCount,
      )

      const flights = await fetchFlightsAll(beginSec, endSec)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const flightByIcao = new Map<string, OpenSkyFlight>()
      for (const f of flights) {
        const key = normalizeIcao(f.icao24)
        const existing = flightByIcao.get(key)
        if (!existing || f.lastSeen > (existing.lastSeen ?? 0)) {
          flightByIcao.set(key, f)
        }
      }

      const filledBefore = states.length - missingCount
      for (const s of states) {
        if (s.estDepartureAirport) continue
        const flight = flightByIcao.get(normalizeIcao(s.icao24))
        if (flight) {
          if (flight.estDepartureAirport)
            s.estDepartureAirport = flight.estDepartureAirport
          if (flight.estArrivalAirport)
            s.estArrivalAirport = flight.estArrivalAirport
          s.firstSeen = flight.firstSeen
          s.lastSeen = flight.lastSeen
        }
      }

      missingCount = countMissing()
      const filledThisIteration = states.length - missingCount - filledBefore
      console.log(
        '[states refresh]   → flights:',
        flights.length,
        '| filled this iteration:',
        filledThisIteration,
        '| still missing:',
        missingCount,
      )
      fetchCount++
    }

    console.log(
      '[states refresh] done:',
      states.length - missingCount,
      'with flight info,',
      missingCount,
      'without | fetches:',
      fetchCount,
    )

    const snapshotTime = Date.now()
    const batchCount = Math.ceil(states.length / BATCH_SIZE)
    console.log(
      '[states refresh] inserting',
      states.length,
      'states in',
      batchCount,
      'batches',
    )

    // Insert all states in batches.
    await Promise.all(
      Array.from({ length: Math.ceil(states.length / BATCH_SIZE) }, (_, idx) =>
        ctx.runMutation(internal.states.insertBatch, {
          states: states.slice(idx * BATCH_SIZE, (idx + 1) * BATCH_SIZE),
          snapshotTime,
        }),
      ),
    )

    // Atomically promote the new snapshot and get the previous snapshot time.
    const oldSnapshotTime = await ctx.runMutation(
      internal.states.activateSnapshot,
      {
        snapshotTime,
      },
    )

    // Delete old snapshot rows in batches.
    if (oldSnapshotTime !== null) {
      console.log(
        '[states refresh] cleaning up previous snapshot:',
        oldSnapshotTime,
      )
      let done = false
      while (!done) {
        done = await ctx.runMutation(internal.states.cleanupBatch, {
          snapshotTime: oldSnapshotTime,
        })
      }
      console.log('[states refresh] cleanup complete')
    } else {
      console.log('[states refresh] no previous snapshot to clean up')
    }
  },
})

/**
 * Fetches route details for one aircraft from OpenSky and enriches
 * departure/arrival ICAO codes with airport rows from our airports table.
 * This action does not persist anything to Convex tables.
 */
export const fetchFlightDetailFromOpenSky = action({
  args: { icao24: v.string() },
  handler: async (ctx, args): Promise<OpenSkyRouteDetail | null> => {
    const icao24 = args.icao24.trim().toLowerCase()
    if (!icao24) return null

    const nowSec = Math.floor(Date.now() / 1000)
    const beginSec = nowSec - 1 * 24 * 60 * 60
    const flights = await fetchFlightsAircraft(icao24, beginSec, nowSec)
    if (flights.length === 0) return null

    const sorted = [...flights].sort((a, b) => b.lastSeen - a.lastSeen)
    const best =
      sorted.find((f) => f.estDepartureAirport || f.estArrivalAirport) ??
      sorted[0]

    const estDepartureAirport = best.estDepartureAirport?.toUpperCase() ?? null
    const estArrivalAirport = best.estArrivalAirport?.toUpperCase() ?? null

    const departureAirport = estDepartureAirport
      ? await ctx.runQuery(api.airports.getByCode, {
          code: estDepartureAirport,
        })
      : null
    const arrivalAirport = estArrivalAirport
      ? await ctx.runQuery(api.airports.getByCode, { code: estArrivalAirport })
      : null

    // log warning if table does not contain an existing airport
    if (!!estDepartureAirport && !departureAirport) {
      console.warn(
        `[fetchFlightDetailFromOpenSky] airport not found for departure: ${icao24}: ${estDepartureAirport}`,
      )
    }

    if (!!estArrivalAirport && !arrivalAirport) {
      console.warn(
        `[fetchFlightDetailFromOpenSky] airport not found for arrival: ${icao24}: ${estArrivalAirport}`,
      )
    }

    return {
      icao24,
      firstSeen: best.firstSeen,
      lastSeen: best.lastSeen,
      estDepartureAirport,
      estArrivalAirport,
      departureAirport: departureAirport
        ? {
            ident: departureAirport.ident,
            name: departureAirport.name,
            iata_code: departureAirport.iata_code,
            municipality: departureAirport.municipality,
            iso_country: departureAirport.iso_country,
            latitude_deg: departureAirport.latitude_deg,
            longitude_deg: departureAirport.longitude_deg,
          }
        : null,
      arrivalAirport: arrivalAirport
        ? {
            ident: arrivalAirport.ident,
            name: arrivalAirport.name,
            iata_code: arrivalAirport.iata_code,
            municipality: arrivalAirport.municipality,
            iso_country: arrivalAirport.iso_country,
            latitude_deg: arrivalAirport.latitude_deg,
            longitude_deg: arrivalAirport.longitude_deg,
          }
        : null,
    }
  },
})

// ─── Internal mutations ───────────────────────────────────────────────────────

/** Inserts a batch of states with the given snapshotTime. */
export const insertBatch = internalMutation({
  args: {
    states: v.array(v.object(stateDataFields)),
    snapshotTime: v.number(),
  },
  handler: async (ctx, { states, snapshotTime }) => {
    for (const state of states) {
      await ctx.db.insert('states', { snapshotTime, ...state })
    }
  },
})

/**
 * Promotes a new snapshotTime as the active one.
 * Returns the previous activeSnapshotTime (or null on first run).
 */
export const activateSnapshot = internalMutation({
  args: { snapshotTime: v.number() },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, { snapshotTime }) => {
    const meta = await ctx.db.query('stateMeta').first()
    const prevTime = meta?.activeSnapshotTime ?? null
    if (meta) {
      await ctx.db.patch(meta._id, { activeSnapshotTime: snapshotTime })
    } else {
      await ctx.db.insert('stateMeta', { activeSnapshotTime: snapshotTime })
    }
    return prevTime
  },
})

/**
 * Deletes up to BATCH_SIZE states belonging to the given snapshotTime.
 * Returns true when all rows for that snapshot have been deleted.
 */
export const cleanupBatch = internalMutation({
  args: { snapshotTime: v.number() },
  returns: v.boolean(),
  handler: async (ctx, { snapshotTime }) => {
    const docs = await ctx.db
      .query('states')
      .withIndex('by_snapshotTime', (q) => q.eq('snapshotTime', snapshotTime))
      .take(BATCH_SIZE)
    await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)))
    return docs.length < BATCH_SIZE
  },
})
