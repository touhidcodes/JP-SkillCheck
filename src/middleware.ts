import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isApiAuthRoute = pathname.startsWith('/api/auth');
  const isStaticAsset = pathname.startsWith('/_next') || pathname.startsWith('/assets') || pathname === '/favicon.ico';
  const isPublicInterviewApi = pathname.startsWith('/api/interview');

  // Allow static assets and auth API calls directly
  if (isStaticAsset || isApiAuthRoute || isPublicInterviewApi) {
    return NextResponse.next();
  }

  // If user visits root '/', redirect to '/login'
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Allow auth pages (/login, /register)
  if (isAuthPage) {
    return NextResponse.next();
  }

  // For protected routes like /mentor/* or /interview/*
  // Allow request to proceed (client-side / page-level auth handles role checks)
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/).*)',
  ],
};

