import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { stateDataFields } from './statesTypes'

export default defineSchema({
  products: defineTable({
    title: v.string(),
    imageId: v.string(),
    price: v.number(),
  }),
  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }),

  /** One row per aircraft in the active (or pending) snapshot. */
  states: defineTable({
    /** Unix ms timestamp identifying which fetch batch this row belongs to. */
    snapshotTime: v.number(),
    ...stateDataFields,
  }).index('by_snapshotTime', ['snapshotTime']),

  icao24States: defineTable({
    icao24: v.string(),
    estDepartureAirport: v.optional(v.string()),
    estArrivalAirport: v.optional(v.string()),
    lastSeen: v.number(),
  }).index('by_icao24', ['icao24']),

  /** Singleton — tracks which snapshotTime is currently active (fully inserted). */
  stateMeta: defineTable({
    activeSnapshotTime: v.number(),
  }),

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
  }).index('by_ident', ['ident']).index('by_icao_code', ['icao_code']),
})
