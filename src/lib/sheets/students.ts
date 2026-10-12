import { readSheet, appendRow } from './client';
import { ensureAllVideoInterviewSheets } from './initialize';

const SHEET_NAME = 'students';

export interface WhitelistedStudent {
  id?: string;
  batch: string;
  email: string;
  status?: string;
  addedAt?: string;
}

export async function saveStudentToGoogleSheets(student: WhitelistedStudent): Promise<string> {
  const id = student.id || `std_${Date.now()}`;
  try {
    await ensureAllVideoInterviewSheets();
    await appendRow(SHEET_NAME, [
      id,
      student.batch,
      student.email,
      student.status || 'whitelisted',
      new Date().toISOString(),
    ]);
  } catch (err) {
    console.warn("Google Sheets append student skipped or dev fallback:", err);
  }
  return id;
}

export async function getWhitelistedStudentsFromSheets(batch?: string): Promise<WhitelistedStudent[]> {
  try {
    await ensureAllVideoInterviewSheets();
    const rows = await readSheet(SHEET_NAME);
    const students = rows.map((row) => ({
      id: row[0],
      batch: row[1],
      email: row[2],
      status: row[3] || 'whitelisted',
      addedAt: row[4],
    }));

    if (batch) {
      return students.filter((s) => s.batch === batch);
    }
    return students;
  } catch {
    return [];
  }
}
