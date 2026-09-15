import jwt from 'jsonwebtoken';
import type { JWTPayload } from '@/types';

function getAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be set and at least 32 characters');
  }
  return secret;
}

function getRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be set and at least 32 characters');
  }
  return secret;
}

export function signAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, getAccessSecret(), { expiresIn: '1h', algorithm: 'HS256' });
}

export function signRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, getRefreshSecret(), { expiresIn: '7d', algorithm: 'HS256' });
}

async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME !== 'edge') {
    try {
      return jwt.verify(token, secret, { algorithms: ['HS256'] }) as JWTPayload;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Invalid token');
    }
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  const decodeB64Json = (str: string): Record<string, unknown> => {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  };

  const payload = decodeB64Json(payloadB64);
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && (payload.exp as number) < now) {
    throw new Error('Token expired');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signature = Uint8Array.from(
    Buffer.from(signatureB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  );

  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    data
  );

  if (!isValid) throw new Error('Invalid signature');

  return payload as unknown as JWTPayload;
}

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  return verifyJWT(token, getAccessSecret());
}

export async function verifyRefreshToken(token: string): Promise<JWTPayload> {
  return verifyJWT(token, getRefreshSecret());
}
