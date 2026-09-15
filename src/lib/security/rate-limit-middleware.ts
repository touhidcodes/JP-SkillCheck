/**
 * Rate Limit Middleware Helper
 *
 * Applies rate limiting to API routes with automatic key resolution.
 * Works with both authenticated (user ID) and unauthenticated (IP) requests.
 */

import { NextResponse } from 'next/server';
import {
  rateLimit,
  getRateLimitKey,
  RATE_LIMIT_PROFILES,
} from './rate-limiter';

function getClientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return headers.get('x-real-ip') || '127.0.0.1';
}

export async function rateLimitLogin(
  request: Request
): Promise<{ allowed: true; remaining: number; resetAt: number } | { allowed: false; response: NextResponse }> {
  const profileConfig = RATE_LIMIT_PROFILES.login;

  const ip = getClientIp(request);
  const key = getRateLimitKey('ip', ip, 'login');
  const result = rateLimit(key, profileConfig.maxRequests, profileConfig.windowSeconds);

  if (!result.allowed) {
    const response = NextResponse.json(
      {
        message: 'Too many requests',
        retryAfter: result.retryAfter,
        resetAt: result.resetAt,
      },
      { status: 429 }
    );
    response.headers.set('Retry-After', String(result.retryAfter || 0));
    response.headers.set('X-RateLimit-Remaining', '0');
    response.headers.set('X-RateLimit-Reset', String(result.resetAt));
    return { allowed: false, response };
  }

  return { allowed: true, remaining: result.remaining, resetAt: result.resetAt };
}

export async function rateLimitApiPublic(
  request: Request
): Promise<{ allowed: true; remaining: number; resetAt: number } | { allowed: false; response: NextResponse }> {
  const profileConfig = RATE_LIMIT_PROFILES.api_public;

  const ip = getClientIp(request);
  const key = getRateLimitKey('ip', ip, 'api_public');
  const result = rateLimit(key, profileConfig.maxRequests, profileConfig.windowSeconds);

  if (!result.allowed) {
    const response = NextResponse.json(
      { message: 'Too many requests', retryAfter: result.retryAfter, resetAt: result.resetAt },
      { status: 429 }
    );
    response.headers.set('Retry-After', String(result.retryAfter || 0));
    response.headers.set('X-RateLimit-Remaining', '0');
    response.headers.set('X-RateLimit-Reset', String(result.resetAt));
    return { allowed: false, response };
  }

  return { allowed: true, remaining: result.remaining, resetAt: result.resetAt };
}

export async function rateLimitApiAuth(
  request: Request,
  userId: string
): Promise<{ allowed: true; remaining: number; resetAt: number } | { allowed: false; response: NextResponse }> {
  const profileConfig = RATE_LIMIT_PROFILES.api_authenticated;

  const key = getRateLimitKey('user', userId, 'api_authenticated');
  const result = rateLimit(key, profileConfig.maxRequests, profileConfig.windowSeconds);

  if (!result.allowed) {
    const response = NextResponse.json(
      { message: 'Too many requests', retryAfter: result.retryAfter, resetAt: result.resetAt },
      { status: 429 }
    );
    response.headers.set('Retry-After', String(result.retryAfter || 0));
    response.headers.set('X-RateLimit-Remaining', '0');
    response.headers.set('X-RateLimit-Reset', String(result.resetAt));
    return { allowed: false, response };
  }

  return { allowed: true, remaining: result.remaining, resetAt: result.resetAt };
}

export async function rateLimitReportDownload(
  request: Request,
  userId: string
): Promise<{ allowed: true; remaining: number; resetAt: number } | { allowed: false; response: NextResponse }> {
  const profileConfig = RATE_LIMIT_PROFILES.report_download;

  const key = getRateLimitKey('user', userId, 'report_download');
  const result = rateLimit(key, profileConfig.maxRequests, profileConfig.windowSeconds);

  if (!result.allowed) {
    const response = NextResponse.json(
      { message: 'Too many requests', retryAfter: result.retryAfter, resetAt: result.resetAt },
      { status: 429 }
    );
    response.headers.set('Retry-After', String(result.retryAfter || 0));
    response.headers.set('X-RateLimit-Remaining', '0');
    response.headers.set('X-RateLimit-Reset', String(result.resetAt));
    return { allowed: false, response };
  }

  return { allowed: true, remaining: result.remaining, resetAt: result.resetAt };
}