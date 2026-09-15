/**
 * Warning Validators
 * Shared between client and server for type safety
 */

import { z } from 'zod';

export const WARNING_SEVERITIES = ['yellow', 'orange', 'red'] as const;
export type WarningSeverity = (typeof WARNING_SEVERITIES)[number];

export const WARNING_STATUSES = ['open', 'escalated', 'resolved'] as const;
export type WarningStatus = (typeof WARNING_STATUSES)[number];

export const CreateWarningSchema = z.object({
  student_id: z.string().min(1, 'Student ID is required').max(100),
  student_name: z.string().min(1, 'Student name is required').max(200),
  mentor_email: z.string().email('Invalid mentor email'),
  severity: z.enum(WARNING_SEVERITIES, {
    message: 'Severity must be yellow, orange, or red',
  }),
  reason: z.string().min(1, 'Reason is required').max(1000, 'Reason must be under 1000 characters'),
  evidence_notes: z.string().max(5000).optional().default(''),
});

export type CreateWarningInput = z.infer<typeof CreateWarningSchema>;

export const ResolveWarningSchema = z.object({
  resolution_notes: z.string().min(1, 'Resolution notes are required').max(2000, 'Resolution notes must be under 2000 characters'),
});

export type ResolveWarningInput = z.infer<typeof ResolveWarningSchema>;

export const EscalateWarningSchema = z.object({
  escalation_reason: z.string().min(1).max(500).optional(),
});

export type EscalateWarningInput = z.infer<typeof EscalateWarningSchema>;

export const WarningQuerySchema = z.object({
  studentId: z.string().optional(),
  mentorEmail: z.string().email().optional(),
  status: z.enum(WARNING_STATUSES).optional(),
  severity: z.enum(WARNING_SEVERITIES).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type WarningQueryInput = z.infer<typeof WarningQuerySchema>;