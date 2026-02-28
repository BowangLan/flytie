/** OpenSky Network API fetch helpers.
 *  All fetch calls to OpenSky (auth, states, flights, tracks) live here.
 */

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
export async function fetchOpenSky<T>(
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

// ─── Types ────────────────────────────────────────────────────────────────────

/** Raw flight object from OpenSky /flights/all. */
export interface OpenSkyFlight {
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

/** Raw track response from OpenSky /tracks/all. */
export type OpenSkyTrack = {
  icao24: string
  startTime: number
  endTime: number
  calllsign: string | null
  path: Array<
    [
      number,
      number | null,
      number | null,
      number | null,
      number | null,
      boolean,
    ]
  >
}

/** Raw state vector tuple from OpenSky states/all. */
export type RawStateVector = [
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

/** Response shape from OpenSky /states/all. */
export interface OpenSkyResponse {
  time: number
  states: RawStateVector[] | null
}

// ─── API wrappers ──────────────────────────────────────────────────────────────

/** Fetches flights for a time interval [begin, end]. Max 2 hours per OpenSky API. Returns [] on 404. */
export async function fetchFlightsAll(
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
export async function fetchFlightsAircraft(
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

/** Fetches track for one aircraft. time=0 for live track; otherwise Unix time within flight. Returns null on 404. */
export async function fetchTrack(
  icao24: string,
  time: number = 0,
): Promise<OpenSkyTrack | null> {
  const token = await getOpenSkyToken()
  const url =
    `${OPENSKY_API_BASE}/tracks/all` +
    `?icao24=${encodeURIComponent(icao24)}&time=${time}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return null
  if (!res.ok)
    throw new Error(
      `OpenSky tracks/all API error: ${res.status}: ${await res.text()}`,
    )
  return (await res.json()) as OpenSkyTrack
}
