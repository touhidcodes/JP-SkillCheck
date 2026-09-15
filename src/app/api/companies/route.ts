/**
 * WHY this file exists:
 * REST API for company entity management (CRUD).
 */

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import {
  getAllCompanies, createCompany, getActiveCompanies, getCompaniesByIndustry
} from '@/lib/sheets/companies';
import { z } from 'zod';

const CompanySchema = z.object({
  canonical_name: z.string().min(1, 'Company name is required'),
  industry: z.enum(['tech', 'finance', 'healthcare', 'ecommerce', 'other']).default('other'),
  size_range: z.enum(['startup', 'mid', 'enterprise', 'unknown']).default('unknown'),
  location: z.string().optional().default(''),
  contact_name: z.string().optional().default(''),
  contact_email: z.string().email().optional().or(z.literal('')).default(''),
  hiring_status: z.enum(['active', 'paused', 'closed', 'prospect']).default('prospect'),
  notes: z.string().optional().default(''),
});

export async function GET(request: Request) {
  try {
    requireRole(request.headers, ['manager', 'mentor']);
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const industry = searchParams.get('industry');

    let companies;
    if (status === 'active') {
      companies = await getActiveCompanies();
    } else if (industry) {
      companies = await getCompaniesByIndustry(industry);
    } else {
      companies = await getAllCompanies();
    }

    return NextResponse.json({ data: companies, total: companies.length });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = requireRole(request.headers, ['manager']);

    const body = await request.json();
    const result = CompanySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const company = await createCompany({
      ...result.data,
      added_by: user.email,
    });

    return NextResponse.json({ data: company }, { status: 201 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}