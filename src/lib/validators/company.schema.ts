/**
 * Company Validators
 * Shared between client and server for type safety
 */

import { z } from 'zod';

export const JOB_FOCUS_OPTIONS = ['remote', 'onsite', 'hybrid'] as const;
export type JobFocus = (typeof JOB_FOCUS_OPTIONS)[number];

export const EXPERIENCE_LEVELS = ['fresher', 'experienced'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const COMPANY_STATUSES = ['active', 'closed', 'paused'] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const CreateCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  industry: z.string().max(100).optional(),
  headquarters: z.string().max(100).optional(),
  remote_policy: z.enum(JOB_FOCUS_OPTIONS).optional(),
  hiring_fresher: z.boolean().optional().default(true),
  hired_count: z.coerce.number().int().min(0).default(0),
  notes: z.string().max(2000).optional().default(''),
});

export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;

export const UpdateCompanySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  website: z.string().url().optional().or(z.literal('')),
  industry: z.string().max(100).optional(),
  headquarters: z.string().max(100).optional(),
  remote_policy: z.enum(JOB_FOCUS_OPTIONS).optional(),
  status: z.enum(COMPANY_STATUSES).optional(),
  hiring_fresher: z.boolean().optional(),
  hired_count: z.coerce.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
});

export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>;

export const CompanyQuerySchema = z.object({
  status: z.enum(COMPANY_STATUSES).optional(),
  remote_policy: z.enum(JOB_FOCUS_OPTIONS).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CompanyQueryInput = z.infer<typeof CompanyQuerySchema>;