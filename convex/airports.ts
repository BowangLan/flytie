/** Convex queries for airport data (OurAirports). */

import { query } from './_generated/server'
import { v } from 'convex/values'

/** Get a single airport by document ID. */
export const get = query({
  args: { id: v.id('airports') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

/** Get all airports. Use sparingly — table has 80k+ rows. */
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('airports').collect()
  },
})

/** Get airport by ICAO/ident code (e.g. "KJFK", "EGLL").
 *  Matches ident or icao_code field. */
export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const code = args.code.trim().toUpperCase()
    if (!code) return null
    const byIdent = await ctx.db
      .query('airports')
      .withIndex('by_ident', (q) => q.eq('ident', code))
      .first()
    if (byIdent) return byIdent
    const byIcao = await ctx.db
      .query('airports')
      .withIndex('by_icao_code', (q) => q.eq('icao_code', code))
      .first()
    return byIcao
  },
})
