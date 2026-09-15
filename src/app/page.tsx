import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAccessToken } from '@/lib/auth/jwt';

/**
 * Root index page that performs server-side role-based routing.
 * Ensures that users hitting the bare domain are instantly routed
 * to their appropriate dashboard without client-side flashing.
 */
export default async function RootIndexPage() {
  const token = cookies().get('access_token')?.value;

  if (!token) {
    redirect('/login');
  }

  try {
    const payload = await verifyAccessToken(token);
    
    if (payload.role === 'manager') {
      redirect('/manager');
    } else if (payload.role === 'mentor') {
      redirect('/mentor');
    } else {
      redirect('/login');
    }
  } catch {
    // If token is invalid or expired, redirect to login
    redirect('/login');
  }
}
