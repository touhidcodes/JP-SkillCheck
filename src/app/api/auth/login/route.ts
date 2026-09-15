import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { LoginSchema } from '@/lib/validators/auth.schema';
import { getUserByEmail } from '@/lib/sheets/users';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { setCsrfCookie } from '@/lib/security/csrf';
import { rateLimitLogin } from '@/lib/security/rate-limit-middleware';
import { logUserLogin } from '@/lib/security/audit-logger';
import type { JWTPayload } from '@/types';

export async function POST(request: Request) {
  const rateLimitResult = await rateLimitLogin(request);
  if (!rateLimitResult.allowed) {
    return rateLimitResult.response;
  }

  try {
    const body = await request.json();
    const result = LoginSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password, role } = result.data;
    const user = await getUserByEmail(email);

    if (!user || !user.active) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Role must match what's stored — prevents cross-role login confusion
    if (user.role !== role) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const payload: JWTPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
    });

    setCsrfCookie(response);

    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60,
    });

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 60 * 60 * 24 * 7,
    });

    await logUserLogin(
      { id: user.id, email: user.email, role: user.role },
      request
    );

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}