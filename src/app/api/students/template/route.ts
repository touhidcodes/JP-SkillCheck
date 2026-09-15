/**
 * GET /api/students/template
 *
 * Returns a downloadable .xlsx template that mentors and managers must use
 * when bulk-uploading students via POST /api/students/bulk.
 *
 * Sheet 1 — "Students Template": header row + two example rows.
 * Sheet 2 — "Instructions": column descriptions, allowed values, and rules.
 *
 * Auth: mentor or manager.
 */

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requireRole } from '@/lib/auth/helpers';
import type { ApiError } from '@/lib/auth/helpers';
import { TEMPLATE_COLUMNS } from '@/lib/validators/upload-template';

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e;
}

export async function GET(request: Request) {
  try {
    requireRole(request.headers, ['manager', 'mentor']);

    const workbook = XLSX.utils.book_new();

    // ── Sheet 1: Template ──────────────────────────────────────────────────
    const templateData: string[][] = [
      [...TEMPLATE_COLUMNS],
      // Row 1: All fields populated (realistic full entry)
      ['Fatima Al-Rashid',  'Cohort Q3-2025', 'sarah.chen@placement.io', 'hybrid',  'fresher',     'fatima.alrashid@gmail.com'],
      // Row 2: Only required fields (minimal valid entry)
      ['Omar Patel',        'Cohort Q3-2025', 'sarah.chen@placement.io', '',        '',            ''],
    ];

    const templateSheet = XLSX.utils.aoa_to_sheet(templateData);
    templateSheet['!cols'] = [
      { wch: 25 }, // name
      { wch: 15 }, // batch
      { wch: 30 }, // mentor_email
      { wch: 12 }, // job_focus
      { wch: 14 }, // experience
      { wch: 30 }, // student_email
    ];
    XLSX.utils.book_append_sheet(workbook, templateSheet, 'Students Template');

    // ── Sheet 2: Instructions ──────────────────────────────────────────────
    const instructionsData: string[][] = [
      ['Placement Dashboard — Student Upload Template'],
      [''],
      ['REQUIRED COLUMNS (must be present and filled for every row)'],
      ['Column',        'Description',                                      'Example'],
      ['name',          'Full name of the student',                         'Jane Smith'],
      ['batch',         'Cohort or batch identifier',                       'Batch 2025'],
      ['mentor_email',  'Email address of the assigned mentor',             'mentor@example.com'],
      [''],
      ['OPTIONAL COLUMNS (can be left blank)'],
      ['Column',        'Description',                                      'Allowed Values'],
      ['job_focus',     'Preferred work arrangement',                       'remote | onsite | hybrid'],
      ['experience',    'Student experience level',                         'fresher | experienced'],
      ['student_email', 'Student personal email for absence notifications', 'jane@gmail.com'],
      [''],
      ['RULES'],
      ['1. Do not rename or remove the header row.'],
      ['2. Do not add extra columns — they will be ignored.'],
      ['3. Maximum 200 rows per upload.'],
      ['4. Supported file formats: .xlsx, .xls, .csv'],
      ['5. Mentors can only upload students assigned to their own email.'],
    ];

    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
    instructionsSheet['!cols'] = [{ wch: 20 }, { wch: 50 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

    // ── Respond ────────────────────────────────────────────────────────────
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="students-upload-template.xlsx"',
        'Cache-Control':       'public, max-age=86400',
      },
    });
  } catch (e) {
    const status  = isApiError(e) ? e.status  : 500;
    const message = isApiError(e) ? e.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
