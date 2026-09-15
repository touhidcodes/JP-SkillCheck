export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 100;
let cleanupCounter = 0;

function lazyCleanup(): void {
  cleanupCounter++;
  if (cleanupCounter < CLEANUP_INTERVAL) return;
  cleanupCounter = 0;

  const now = Date.now();
  const keysToDelete: string[] = [];
  store.forEach((entry, key) => {
    if (entry.resetAt < now) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach((key) => store.delete(key));
}

export function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): RateLimitResult {
  lazyCleanup();

  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt,
    };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count += 1;
  store.set(key, entry);

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

export function getRateLimitKey(
  type: 'ip' | 'user',
  identifier: string,
  profile: string
): string {
  return `${profile}:${type}:${identifier}`;
}

export const RATE_LIMIT_PROFILES = {
  login:             { maxRequests: 5,   windowSeconds: 900  },
  api_public:        { maxRequests: 30,  windowSeconds: 60   },
  api_authenticated: { maxRequests: 120, windowSeconds: 60   },
  report_download:   { maxRequests: 5,   windowSeconds: 3600 },
} as const;

export type RateLimitProfile = keyof typeof RATE_LIMIT_PROFILES;
