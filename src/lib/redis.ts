import { createClient, type RedisClientType } from 'redis'

let client: RedisClientType | null = null
let connectPromise: Promise<RedisClientType> | null = null

/**
 * Get a Redis client instance. Uses REDIS_URL from env.
 * Returns null if REDIS_URL is not set. Connects lazily on first use.
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL
  if (!url) return null

  if (client?.isOpen) return client

  if (connectPromise) return connectPromise

  connectPromise = (async () => {
    const c = createClient({ url })
    c.on('error', (err) => console.error('[Redis]', err))
    await c.connect()
    client = c
    return c
  })()

  try {
    return await connectPromise
  } catch (err) {
    connectPromise = null
    console.error('[Redis] Failed to connect:', err)
    return null
  }
}

/**
 * Execute a Redis operation. Returns null if Redis is unavailable.
 */
export async function withRedis<T>(
  fn: (client: RedisClientType) => Promise<T>,
): Promise<T | null> {
  const c = await getRedisClient()
  if (!c) return null
  try {
    return await fn(c)
  } catch (err) {
    console.error('[Redis] Operation failed:', err)
    return null
  }
}
