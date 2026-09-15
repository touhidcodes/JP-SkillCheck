/**
 * WHY this file exists:
 * Company entity is a relatively rare write operation compared to reads.
 * PUT is for replacing (rarely used), PATCH for updating, DELETE for removing.
 * This route handles individual company records.
 */

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { getCompanyById, updateCompany, deleteCompany } from '@/lib/sheets/companies';
import { z } from 'zod';

const UpdateCompanySchema = z.object({
  canonical_name: z.string().min(1).optional(),
  industry: z.enum(['tech', 'finance', 'healthcare', 'ecommerce', 'other']).optional(),
  size_range: z.enum(['startup', 'mid', 'enterprise', 'unknown']).optional(),
  location: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  hiring_status: z.enum(['active', 'paused', 'closed', 'prospect']).optional(),
  notes: z.string().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireRole(request.headers, ['manager', 'mentor']);
    const { id } = await params;
    const company = await getCompanyById(id);
    if (!company) return NextResponse.json({ message: 'Company not found' }, { status: 404 });
    return NextResponse.json({ data: company });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireRole(request.headers, ['manager']);
    const { id } = await params;
    const body = await request.json();
    const result = UpdateCompanySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updated = await updateCompany(id, result.data);
    if (!updated) return NextResponse.json({ message: 'Company not found' }, { status: 404 });
    return NextResponse.json({ data: updated });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireRole(request.headers, ['manager']);
    const { id } = await params;
    const deleted = await deleteCompany(id);
    if (!deleted) return NextResponse.json({ message: 'Company not found' }, { status: 404 });
    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}