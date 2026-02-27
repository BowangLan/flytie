/** Shared types and Convex validators for OpenSky flight data.
 *  Imported by both convex/ functions and src/ components.
 */

import { v } from 'convex/values'

// ─── Enums ────────────────────────────────────────────────────────────────────

/** Source that produced the position. Stored as a plain number in Convex. */
export const PositionSource = {
  ADSB: 0,
  ASTERIX: 1,
  MLAT: 2,
  FLARM: 3,
} as const

export type PositionSource = (typeof PositionSource)[keyof typeof PositionSource]

// ─── Domain type ──────────────────────────────────────────────────────────────

/**
 * A single aircraft state vector with named, typed fields.
 * Only aircraft with a known position are represented (lon/lat are defined).
 * Optional fields use `undefined` to align with Convex's `v.optional` semantics.
 */
export interface State {
  /** ICAO 24-bit transponder address (hex string). */
  icao24: string
  /** 8-character callsign, trimmed. */
  callsign?: string
  /** Country name derived from ICAO address. */
  originCountry: string
  /** Unix timestamp of the last position update. */
  timePosition?: number
  /** Unix timestamp of the most recent message from this transponder. */
  lastContact: number
  /** WGS-84 longitude in decimal degrees (−180 … 180). */
  longitude: number
  /** WGS-84 latitude in decimal degrees (−90 … 90). */
  latitude: number
  /** Barometric altitude in meters. */
  baroAltitude?: number
  /** True when a surface position report is active. */
  onGround: boolean
  /** Ground speed in m/s. */
  velocity?: number
  /** Track angle in degrees clockwise from north (0–360). */
  trueTrack?: number
  /** Vertical rate in m/s (positive = climbing). */
  verticalRate?: number
  /** Geometric (GNSS) altitude in meters. */
  geoAltitude?: number
  /** Mode S transponder squawk code. */
  squawk?: string
  /** Special Purpose Indicator flag. */
  spi: boolean
  /** Source of the position data (PositionSource value). */
  positionSource: number
  /** ICAO aircraft category code (0 = unknown). May be absent in some API responses. */
  category?: number

  // ─── Departure / arrival (from OpenSky /flights/all, merged by icao24) ────────

  /** ICAO code of the estimated departure airport. */
  estDepartureAirport?: string
  /** ICAO code of the estimated arrival airport. */
  estArrivalAirport?: string
  /** Estimated time of departure (Unix seconds). */
  firstSeen?: number
  /** Estimated time of arrival (Unix seconds). */
  lastSeen?: number
}

// ─── Convex validator ─────────────────────────────────────────────────────────

/**
 * Convex PropertyValidators matching the State interface.
 * Used in both the schema table definition and internal mutation args.
 */
export const stateDataFields = {
  icao24: v.string(),
  callsign: v.optional(v.string()),
  originCountry: v.string(),
  timePosition: v.optional(v.number()),
  lastContact: v.number(),
  longitude: v.number(),
  latitude: v.number(),
  baroAltitude: v.optional(v.number()),
  onGround: v.boolean(),
  velocity: v.optional(v.number()),
  trueTrack: v.optional(v.number()),
  verticalRate: v.optional(v.number()),
  geoAltitude: v.optional(v.number()),
  squawk: v.optional(v.string()),
  spi: v.boolean(),
  positionSource: v.number(),
  category: v.optional(v.number()),

  // ─── Departure / arrival (from OpenSky /flights/all, merged by icao24) ────────
  estDepartureAirport: v.optional(v.string()),
  estArrivalAirport: v.optional(v.string()),
  firstSeen: v.optional(v.number()),
  lastSeen: v.optional(v.number()),
}
