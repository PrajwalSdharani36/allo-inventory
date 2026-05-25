import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Distributed lock using SET NX PX (atomic, no race conditions).
 * Returns true if lock acquired, false if already held.
 */
export async function acquireLock(
  key: string,
  ttlMs: number = 5000
): Promise<boolean> {
  const result = await redis.set(`lock:${key}`, "1", {
    nx: true,
    px: ttlMs,
  });
  return result === "OK";
}

export async function releaseLock(key: string): Promise<void> {
  await redis.del(`lock:${key}`);
}
