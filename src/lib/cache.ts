import { withRedis } from './redis'

const DEFAULT_TTL_SECONDS = 86400 // 24 hours

/**
 * Get a value from cache or compute and store it.
 * Returns the fetcher result; cache is best-effort (no-op if Redis unavailable).
 */
export async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<T> {
  const cached = await withRedis(async (client) => {
    const raw = await client.get(key)
    if (!raw) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  })

  if (cached != null) return cached

  const value = await fetcher()

  await withRedis(async (client) => {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds })
  })

  return value
}
