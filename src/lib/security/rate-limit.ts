import { rateLimit } from './rate-limiter';

export interface CheckRateLimitOptions {
  max: number;
  windowMs: number;
}

/**
 * Returns true when the request is rate-limited.
 */
export async function checkRateLimit(
  key: string,
  options: CheckRateLimitOptions
): Promise<boolean> {
  const result = rateLimit(key, options.max, Math.ceil(options.windowMs / 1000));
  return !result.allowed;
}
