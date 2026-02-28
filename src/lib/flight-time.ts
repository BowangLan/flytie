/**
 * Utilities for parsing and displaying flight times.
 * Prefers local time for display (from API response).
 */

/** Time strings from AeroDataBox: "2026-02-28 06:10+01:00" (local) or "2026-02-28 05:10Z" (utc) */
export type FlightTimeString = string

/** Parse UTC string to Date, or null */
export function parseUtc(s: string | null | undefined): Date | null {
  if (!s?.trim()) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/** Parse local ISO string (e.g. "2026-02-28 06:10+01:00") to Date, or null */
export function parseLocal(s: string | null | undefined): Date | null {
  if (!s?.trim()) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Extract HH:MM from time string (local or UTC).
 * Handles "YYYY-MM-DD HH:MM" and ISO formats.
 */
export function extractTime(s: string | null | undefined): string {
  if (!s?.trim()) return '--:--'
  const m = s.match(/(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : '--:--'
}

/**
 * Format time for display. Prefers local time when available.
 * @param local - Local time string from API (e.g. "2026-02-28 06:10+01:00")
 * @param utc - UTC fallback (e.g. "2026-02-28 05:10Z")
 */
export function formatTimeForDisplay(
  local: string | null | undefined,
  utc?: string | null | undefined,
): string {
  return extractTime(local ?? utc ?? null)
}

/**
 * Compute delay in minutes: positive = delayed, negative = early.
 * Compares revisedTime.utc vs scheduledTime.utc.
 */
export function computeDelayMinutes(
  scheduledUtc: string | null | undefined,
  revisedUtc: string | null | undefined,
): number | null {
  if (!scheduledUtc?.trim() || !revisedUtc?.trim()) return null
  const s = parseUtc(scheduledUtc)
  const r = parseUtc(revisedUtc)
  if (!s || !r) return null
  return Math.round((r.getTime() - s.getTime()) / 60_000)
}

/** Format delay for display: "+15m", "-5m", or null if no delay */
export function formatDelay(minutes: number | null): string | null {
  if (minutes == null || minutes === 0) return null
  const sign = minutes > 0 ? '+' : ''
  return `${sign}${minutes}m`
}
