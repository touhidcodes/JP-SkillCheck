import { readSheet } from './client';
import type { User } from '@/types';


const USERS_CACHE: { data: (User & { password_hash: string })[]; timestamp: number } = {
  data: [],
  timestamp: 0,
};
const CACHE_TTL_MS = 5 * 60 * 1000;

function rowToUser(row: string[]): User & { password_hash: string } {
  return {
    id: row[0] || '',
    name: row[1] || '',
    email: row[2] || '',
    role: (row[3] as User['role']) || 'mentor',
    active: row[4] === 'true',
    password_hash: row[5] || '',
  };
}

async function fetchUsers(): Promise<(User & { password_hash: string })[]> {
  const rows = await readSheet('users');
  return rows.map(rowToUser);
}

export async function getUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  const now = Date.now();
  if (USERS_CACHE.data.length === 0 || now - USERS_CACHE.timestamp > CACHE_TTL_MS) {
    USERS_CACHE.data = await fetchUsers();
    USERS_CACHE.timestamp = now;
  }
  return USERS_CACHE.data.find(u => u.email === email) || null;
}

export async function getAllUsers(): Promise<User[]> {
  const now = Date.now();
  if (USERS_CACHE.data.length === 0 || now - USERS_CACHE.timestamp > CACHE_TTL_MS) {
    USERS_CACHE.data = await fetchUsers();
    USERS_CACHE.timestamp = now;
  }
  return USERS_CACHE.data.map(user => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...publicUser } = user;
    return publicUser;
  });
}

export function invalidateUsersCache(): void {
  USERS_CACHE.data = [];
  USERS_CACHE.timestamp = 0;
}