import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { stateDataFields } from './statesTypes'

export default defineSchema({
  // ADSB Exchange traces
  traces: defineTable({
    icao: v.string(),
    r: v.optional(v.string()),
    t: v.optional(v.string()),
    desc: v.optional(v.string()),
    trace: v.array(v.array(v.number())),
  }).index('by_icao', ['icao']),

  // Deprecated (kind of?)
  // Reason: aerodatabox API's flight detail endpoint already contains the essential airport data
  /** Airports from OurAirports open data (ident = ICAO code for lookup). */
  airports: defineTable({
    id: v.number(),
    ident: v.string(),
    type: v.string(),
    name: v.string(),
    latitude_deg: v.optional(v.number()),
    longitude_deg: v.optional(v.number()),
    elevation_ft: v.optional(v.number()),
    continent: v.optional(v.string()),
    iso_country: v.optional(v.string()),
    iso_region: v.optional(v.string()),
    municipality: v.optional(v.string()),
    scheduled_service: v.optional(v.string()),
    icao_code: v.optional(v.string()),
    iata_code: v.optional(v.string()),
    gps_code: v.optional(v.string()),
    local_code: v.optional(v.string()),
    home_link: v.optional(v.string()),
    wikipedia_link: v.optional(v.string()),
    keywords: v.optional(v.string()),
  })
    .index('by_ident', ['ident'])
    .index('by_icao_code', ['icao_code']),


  // Deprecated
  // Used for storing /states/all from OpenSky
  /** One row per aircraft in the active (or pending) snapshot. */
  states: defineTable({
    /** Unix ms timestamp identifying which fetch batch this row belongs to. */
    snapshotTime: v.number(),
    ...stateDataFields,
  }).index('by_snapshotTime', ['snapshotTime']),


  // Deprecated
  // OpenSky /states/all snapshot metadata
  /** Singleton — tracks which snapshotTime is currently active (fully inserted). */
  stateMeta: defineTable({
    activeSnapshotTime: v.number(),
  }),
})
