/** OpenSky Network REST API — /states/all
 *  Docs: https://openskynetwork.github.io/opensky-api/rest.html
 *
 *  Data fetching now runs as a Convex action (convex/flights.ts).
 *  This file re-exports the shared types for use in React components.
 */

export type { State as Flight } from '../../../convex/statesTypes'
export { PositionSource } from '../../../convex/statesTypes'
