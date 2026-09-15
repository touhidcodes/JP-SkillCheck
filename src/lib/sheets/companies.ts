/**
 * WHY this file exists:
 * Companies are the third major entity in the system (after students and mentors).
 * Currently, company names are free-text strings in progress_logs, which causes:
 * 1. "Google LLC", "Google", "Alphabet/Google" counted as 3 different companies
 * 2. No company-level analytics (hires per company, offer acceptance rate, etc.)
 * 3. No way to track relationship status, contact info, or hiring volume
 *
 * By treating companies as a first-class entity:
 * 1. Company names are normalized — progress logs reference company IDs, not names
 * 2. Company pipeline analytics: students applied → interviewed → offered → hired
 * 3. Company relationship management: contact info, hiring status, notes
 * 4. Salary analytics by company (linked via offer_details)
 *
 * This sheet is the canonical list of companies. progress_logs.company_name
 * should be migrated to reference companies.canonical_name once this sheet exists.
 */

import { readSheet, appendRow, updateRow, findRowIndex, deleteRow } from './client';

export interface Company {
  id: string;
  canonical_name: string;
  industry: string; // tech | finance | healthcare | ecommerce | other
  size_range: string; // startup | mid | enterprise | unknown
  location: string;
  contact_name: string;
  contact_email: string;
  hiring_status: 'active' | 'paused' | 'closed' | 'prospect';
  notes: string;
  added_at: string; // ISO8601
  added_by: string; // email
}

// Sheet columns: id | canonical_name | industry | size_range | location | contact_name | contact_email | hiring_status | notes | added_at | added_by


function rowToCompany(row: string[]): Company {
  return {
    id: row[0] || '',
    canonical_name: row[1] || '',
    industry: row[2] || 'other',
    size_range: row[3] || 'unknown',
    location: row[4] || '',
    contact_name: row[5] || '',
    contact_email: row[6] || '',
    hiring_status: (row[7] || 'prospect') as Company['hiring_status'],
    notes: row[8] || '',
    added_at: row[9] || '',
    added_by: row[10] || '',
  };
}

function companyToRow(c: Company): string[] {
  return [
    c.id, c.canonical_name, c.industry, c.size_range, c.location,
    c.contact_name, c.contact_email, c.hiring_status, c.notes,
    c.added_at, c.added_by,
  ];
}

export async function getAllCompanies(): Promise<Company[]> {
  const rows = await readSheet('companies');
  return rows.map(rowToCompany).filter(c => c.id);
}

export async function getCompanyById(id: string): Promise<Company | null> {
  const all = await getAllCompanies();
  return all.find(c => c.id === id) ?? null;
}

export async function getCompanyByName(canonicalName: string): Promise<Company | null> {
  const all = await getAllCompanies();
  return all.find(c => c.canonical_name.toLowerCase() === canonicalName.toLowerCase()) ?? null;
}

export async function createCompany(
  data: Omit<Company, 'id' | 'added_at'>
): Promise<Company> {
  const company: Company = {
    ...data,
    id: crypto.randomUUID(),
    added_at: new Date().toISOString(),
  };
  await appendRow('companies', companyToRow(company));
  return company;
}

export async function updateCompany(
  id: string,
  data: Partial<Company>
): Promise<Company | null> {
  const rowIndex = await findRowIndex('companies', 0, id);
  if (rowIndex === -1) return null;

  const existing = await getCompanyById(id);
  if (!existing) return null;

  const updated: Company = { ...existing, ...data };
  await updateRow('companies', rowIndex, companyToRow(updated));
  return updated;
}

export async function deleteCompany(id: string): Promise<boolean> {
  const rowIndex = await findRowIndex('companies', 0, id);
  if (rowIndex === -1) return false;
  await deleteRow('companies', rowIndex);
  return true;
}

export async function getActiveCompanies(): Promise<Company[]> {
  const all = await getAllCompanies();
  return all.filter(c => c.hiring_status === 'active');
}

export async function getCompaniesByIndustry(industry: string): Promise<Company[]> {
  const all = await getAllCompanies();
  return all.filter(c => c.industry === industry);
}

export async function getOrCreateCompany(
  canonicalName: string,
  addedBy: string
): Promise<Company> {
  const existing = await getCompanyByName(canonicalName);
  if (existing) return existing;

  return createCompany({
    canonical_name: canonicalName,
    industry: 'other',
    size_range: 'unknown',
    location: '',
    contact_name: '',
    contact_email: '',
    hiring_status: 'prospect',
    notes: '',
    added_by: addedBy,
  });
}