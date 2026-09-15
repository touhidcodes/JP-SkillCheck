/**
 * WHY this file exists:
 * Provides a process-level in-memory cache for analytics computations.
 * On Vercel's free tier (serverless), a warm Lambda instance persists the
 * cache across requests within a short window. This eliminates the need to
 * re-read 4 sheets and recompute all analytics on every page load.
 *
 * Key design: This is a best-effort optimization, NOT a reliable cache.
 * Cold starts lose all cached state. For reliable caching, use Upstash Redis
 * (paid tier). This file makes the best of free-tier constraints.
 *
 * The 5-minute TTL means: after the first analytics page load, the next
 * 299 requests (in a warm instance) are served from cache without any Sheets API
 * calls. For a dashboard with 5 charts, this reduces API calls from 5 to 1.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number; // Unix ms
}

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getAnalyticsCache<T>(key: string): { data: T; fromCache: boolean } | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return { data: entry.data, fromCache: true };
}

export function setAnalyticsCache<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateAnalyticsCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  const keys = Array.from(store.keys());
  for (const key of keys) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function analyticsCacheStats(): { size: number; keys: string[] } {
  return { size: store.size, keys: Array.from(store.keys()) };
}

export function buildAnalyticsCacheKey(parts: string[]): string {
  return ['analytics', ...parts].join(':');
}