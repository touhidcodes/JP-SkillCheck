import { createHmac, timingSafeEqual } from 'crypto';

export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function hashSecret(secret: string): string {
  return createHmac('sha256', secret).update('salt').digest('hex');
}
