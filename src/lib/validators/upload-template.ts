/**
 * Student upload template validation.
 *
 * Shared between:
 *   - GET /api/students/template  (serves the template file)
 *   - POST /api/students/bulk     (validates uploaded files against the template)
 *
 * Keeping this in lib/ avoids exporting non-handler symbols from a Next.js
 * route file, which causes type errors in the generated .next/types directory.
 */

export const TEMPLATE_COLUMNS = [
  'name',
  'batch',
  'mentor_email',
  'job_focus',
  'experience',
  'student_email',
] as const;

export type TemplateColumn = (typeof TEMPLATE_COLUMNS)[number];

export const REQUIRED_COLUMNS: TemplateColumn[] = ['name', 'batch', 'mentor_email'];
export const OPTIONAL_COLUMNS: TemplateColumn[] = ['job_focus', 'experience', 'student_email'];

export function validateTemplateHeaders(headers: string[]): {
  valid: boolean;
  missing: string[];
  message?: string;
} {
  const normalised = headers.map(h => h.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter(col => !normalised.includes(col));

  if (missing.length > 0) {
    return {
      valid: false,
      missing,
      message:
        `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. ` +
        `Download the template from /api/students/template to get the correct format.`,
    };
  }

  return { valid: true, missing: [] };
}
