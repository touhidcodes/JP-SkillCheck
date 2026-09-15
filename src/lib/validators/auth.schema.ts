import { z } from 'zod';

export const USER_ROLES = ['manager', 'mentor'] as const;

export const LoginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(USER_ROLES, {
    message: 'Please select your role',
  }),
});

export type LoginInput = z.infer<typeof LoginSchema>;