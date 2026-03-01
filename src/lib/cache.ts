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

/**
 * Get multiple values from cache or compute and store them.
 * Uses MGET for a single Redis round-trip. Cache is best-effort.
 */
export async function getOrSetMany<T>(
  entries: Array<{ key: string; fetcher: () => Promise<T> }>,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<T[]> {
  if (entries.length === 0) return []

  const keys = entries.map((e) => e.key)
  const rawValues = await withRedis(async (client) => {
    return client.mGet(keys)
  })

  const results: (T | null)[] = new Array(entries.length)
  const misses: Array<{ index: number; fetcher: () => Promise<T> }> = []

  for (let i = 0; i < entries.length; i++) {
    const raw = rawValues?.[i]
    if (raw != null) {
      try {
        results[i] = JSON.parse(raw) as T
      } catch {
        misses.push({ index: i, fetcher: entries[i].fetcher })
      }
    } else {
      misses.push({ index: i, fetcher: entries[i].fetcher })
    }
  }

  if (misses.length === 0) return results as T[]

  const fetched = await Promise.all(misses.map((m) => m.fetcher()))
  for (let j = 0; j < misses.length; j++) {
    results[misses[j].index] = fetched[j]
  }

  await withRedis(async (client) => {
    const pipeline = client.multi()
    for (let j = 0; j < misses.length; j++) {
      const idx = misses[j].index
      pipeline.set(keys[idx], JSON.stringify(fetched[j]), { EX: ttlSeconds })
    }
    await pipeline.exec()
  })

  return results as T[]
}
