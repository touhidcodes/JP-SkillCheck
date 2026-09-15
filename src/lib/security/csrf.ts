/**
 * CSRF Protection — Double Submit Cookie Pattern
 *
 * WHY DOUBLE SUBMIT COOKIE vs SYNCHRONIZER TOKEN:
 * ===============================================
 * Synchronizer Token pattern requires server-side session storage (Redis, DB)
 * to store the CSRF token per-user. In Next.js App Router's stateless architecture:
 * - We don't want to add a session store dependency
 * - Serverless functions can't share in-memory session state
 * - Each request might hit a different cold-start instance
 *
 * Double Submit Cookie works without server-side sessions:
 * 1. Server sets a CSRF cookie (non-httpOnly so JS can read it)
 * 2. Client reads cookie value and sends as X-CSRF-Token header on mutating requests
 * 3. Server compares cookie value vs header value — if mismatch, reject with 403
 *
 * ATTACKER CANNOT STEAL THE COOKIE:
 * - CSRF cookie should have sameSite=lax (not httpOnly — must be readable by JS)
 * - But httponly cookies can't be read by JS, so we need a separate non-httponly cookie
 * - Attacker on evil.com cannot read the CSRF cookie due to browser's Same-Origin Policy
 *   (only the origin that set the cookie can read it)
 *
 * PROTECTED ENDPOINTS:
 * - All POST, PATCH, DELETE requests to /api/* routes
 * - Excluded: /api/cron/* (uses CRON_SECRET), /api/discord/events (uses WEBHOOK_SECRET)
 *
 * FLOW:
 * 1. On login success: generateCsrfToken() creates token + sets cookie
 * 2. Client reads document.cookie, extracts csrf_token, sends as X-CSRF-Token header
 * 3. Server validates: cookie value === header value → allow, else → 403 + audit log
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_HEADER_NAME_ALT = "x-xsrf-token";

export interface CsrfTokenResult {
  token: string;
  cookieValue: string;
}

export function generateCsrfToken(): CsrfTokenResult {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    cookieValue: `${CSRF_COOKIE_NAME}=${token}; SameSite=Lax; Path=/; Max-Age=604800`,
  };
}

export function setCsrfCookie(response: NextResponse): CsrfTokenResult {
  const result = generateCsrfToken();
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: result.token,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days (matches auth token)
  });
  return result;
}

export function validateCsrfToken(request: NextRequest): boolean {
  const excludePaths = ["/api/cron/"];
  const pathname = request.nextUrl.pathname;

  if (excludePaths.some((path) => pathname.startsWith(path))) {
    return true;
  }

  const method = request.method;
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    return true;
  }

  const cookieValue = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerValue =
    request.headers.get(CSRF_HEADER_NAME) ||
    request.headers.get(CSRF_HEADER_NAME_ALT);

  if (!cookieValue || !headerValue) {
    console.warn(
      `[CSRF Debug] Missing token. Cookie present: ${!!cookieValue}, Header present: ${!!headerValue}. Cookie value: ${cookieValue}, Header value: ${headerValue}`,
    );
    return false;
  }

  if (cookieValue !== headerValue) {
    console.warn(
      `[CSRF Debug] Mismatch. Cookie: ${cookieValue}, Header: ${headerValue}`,
    );
    return false;
  }

  return true;
}

export interface CsrfValidationResult {
  valid: boolean;
  error?: string;
  status?: number;
}

export function validateCsrfRequest(
  request: NextRequest,
): CsrfValidationResult {
  if (validateCsrfToken(request)) {
    return { valid: true };
  }

  return {
    valid: false,
    error:
      "CSRF validation failed. Ensure X-CSRF-Token header matches csrf_token cookie.",
    status: 403,
  };
}

export function withCsrfProtection(
  handler: (request: NextRequest) => Promise<NextResponse>,
) {
  return async function csrfProtectedHandler(
    request: NextRequest,
  ): Promise<NextResponse> {
    const validation = validateCsrfRequest(request);

    if (!validation.valid) {
      console.warn(
        "[CSRF] Blocked request from",
        request.headers.get("x-forwarded-for") || "unknown IP",
      );

      return NextResponse.json(
        { message: validation.error || "Forbidden", code: "CSRF_FAILURE" },
        { status: 403 },
      );
    }

    return handler(request);
  };
}

export function csrfErrorResponse(message?: string): NextResponse {
  return NextResponse.json(
    {
      message: message || "CSRF validation failed",
      code: "CSRF_FAILURE",
    },
    { status: 403 },
  );
}

export function getCsrfTokenFromCookie(request: NextRequest): string | null {
  return request.cookies.get(CSRF_COOKIE_NAME)?.value || null;
}

export function getCsrfTokenFromHeader(request: NextRequest): string | null {
  return (
    request.headers.get(CSRF_HEADER_NAME) ||
    request.headers.get(CSRF_HEADER_NAME_ALT) ||
    null
  );
}
