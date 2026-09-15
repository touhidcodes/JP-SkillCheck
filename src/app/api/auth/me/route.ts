import { NextResponse } from 'next/server';
import { getUserFromHeaders } from '@/lib/auth/helpers';

export async function GET(request: Request) {
  const user = getUserFromHeaders(request.headers);

  if (!user) {
    return NextResponse.json(
      { message: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({ user });
}