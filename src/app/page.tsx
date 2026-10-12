import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAccessToken } from '@/lib/auth/jwt';

export default async function RootIndexPage() {
  const token = cookies().get('access_token')?.value;

  if (!token) {
    redirect('/login');
  }

  try {
    const payload = await verifyAccessToken(token);
    
    if (payload.role === 'mentor' || payload.role === 'manager') {
      redirect('/mentor');
    } else {
      redirect('/interview/batch_01_frontend');
    }
  } catch {
    redirect('/login');
  }
}

