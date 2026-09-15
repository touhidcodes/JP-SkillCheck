/**
 * Attendance Form Validation Schemas
 *
 * Shared validation schemas for attendance form creation and student submission.
 * Used by both client-side forms and server-side API routes.
 */

import { z } from "zod";
import { addDays, parseISO, startOfDay } from "date-fns";

export const CreateFormSchema = z.object({
  session_id: z.string().min(1, "Session ID is required"),
  session_label: z.string().min(1, "Session name is required").max(100),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .refine((val) => {
      const d = startOfDay(parseISO(val));
      const yesterday = startOfDay(addDays(new Date(), -1));
      return d >= yesterday;
    }, "Cannot create a form for a date more than 1 day in the past"),
  mode: z.enum(["session", "daily"]),
  period: z.enum(["full_day", "morning", "afternoon"]),
  topic_tags: z.string().max(300).optional().default(""),
  duration_minutes: z.number().int().min(0).max(1440).optional().default(0),
  expiry_minutes: z.number().int().min(15).max(480).default(120),
});

export type CreateFormInput = z.infer<typeof CreateFormSchema>;

export const StudentSubmitSchema = z.object({
  full_name: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name is too long")
    .transform((v) => v.trim()),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address")
    .max(200, "Email is too long"),
});

export type StudentSubmitInput = z.infer<typeof StudentSubmitSchema>;

export const PatchFormSchema = z.object({
  is_active: z.boolean().optional(),
  expiry_minutes: z.number().int().min(15).max(480).optional(),
});

export type PatchFormInput = z.infer<typeof PatchFormSchema>;
