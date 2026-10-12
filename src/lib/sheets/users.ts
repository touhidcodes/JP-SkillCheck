import { readSheet, appendRow } from './client';
import { ensureAllVideoInterviewSheets } from './initialize';
import type { User } from '@/types';

const SHEET_NAME = 'users';

export async function saveUserToGoogleSheets(user: { id?: string; name: string; email: string; role?: string }): Promise<string> {
  const id = user.id || `usr_${Date.now()}`;
  try {
    await ensureAllVideoInterviewSheets();
    await appendRow(SHEET_NAME, [
      id,
      user.name,
      user.email,
      user.role || 'mentor',
      'true',
      new Date().toISOString(),
    ]);
  } catch (err) {
    console.warn("Google Sheets append user skipped or dev fallback:", err);
  }
  return id;
}

function rowToUser(row: string[]): User {
  return {
    id: row[0] || '',
    name: row[1] || '',
    email: row[2] || '',
    role: (row[3] as User['role']) || 'mentor',
    active: row[4] !== 'false',
  };
}

export async function getAllUsers(): Promise<User[]> {
  try {
    await ensureAllVideoInterviewSheets();
    const rows = await readSheet(SHEET_NAME);
    return rows.map(rowToUser);
  } catch {
    return [];
  }
}