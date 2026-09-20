import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authEnabled = process.env.NEXT_PUBLIC_ADMIN_AUTH_ENABLED !== 'false';

  const isAuthRoute = pathname === '/login';
  const isApiAuthRoute = pathname === '/api/auth/login' || pathname === '/api/auth/logout' || pathname === '/api/auth/refresh';
  const isCronRoute = pathname.startsWith('/api/cron/');
  const isApiRoute = pathname.startsWith('/api/');

  // Development preview: show the manager UI without weakening API protection.
  if (!authEnabled && !isApiRoute) {
    if (pathname === '/login' || pathname === '/') {
      return NextResponse.redirect(new URL('/manager', request.url));
    }
    return NextResponse.next();
  }

  // Public student attendance form pages — no auth required
  const isPublicAttendRoute = pathname.startsWith('/attend/');
  const isPublicInterviewRoute = pathname.startsWith('/interview');
  // Public student submission API — no auth required
  const isPublicAttendApi = pathname.startsWith('/api/attend/');
  const isPublicInterviewApi = pathname.startsWith('/api/interview/');

  if (!isApiRoute) {
    if (isAuthRoute || isPublicAttendRoute || isPublicInterviewRoute) {
      return NextResponse.next();
    }
  } else {
    if (isApiAuthRoute || isCronRoute || isPublicAttendApi || isPublicInterviewApi) {
      return NextResponse.next();
    }
  }

  const token = request.cookies.get('access_token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    if (isApiRoute) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const payload = await verifyAccessToken(token);
    
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.id);
    requestHeaders.set('x-user-email', payload.email);
    requestHeaders.set('x-user-role', payload.role);
    requestHeaders.set('x-user-name', payload.name);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch {
    if (isApiRoute) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!api/auth/login|api/auth/logout|api/auth/refresh|cron|_next/static|_next/image|favicon.ico|assets/).*)',
  ],
};
