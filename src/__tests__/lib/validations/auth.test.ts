import { describe, it, expect } from 'vitest';
import { LoginSchema } from '@/lib/validators/auth.schema';

describe('LoginSchema Validator', () => {
  const validManager = {
    email: 'manager@dashboard.com',
    password: 'securePassword123',
    role: 'manager' as const,
  };

  const validMentor = {
    email: 'mentor@dashboard.com',
    password: 'anotherSecurePassword',
    role: 'mentor' as const,
  };

  it('accepts valid manager credentials', () => {
    const result = LoginSchema.safeParse(validManager);
    expect(result.success).toBe(true);
  });

  it('accepts valid mentor credentials', () => {
    const result = LoginSchema.safeParse(validMentor);
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email format and returns descriptive error', () => {
    const invalidPayload = {
      ...validMentor,
      email: 'not-an-email',
    };
    const result = LoginSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorMsg = result.error.flatten().fieldErrors.email?.[0];
      expect(errorMsg).toBe('Please enter a valid email address');
    }
  });

  it('rejects a password shorter than 8 characters and returns descriptive error', () => {
    const invalidPayload = {
      ...validMentor,
      password: 'short',
    };
    const result = LoginSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorMsg = result.error.flatten().fieldErrors.password?.[0];
      expect(errorMsg).toBe('Password must be at least 8 characters');
    }
  });

  it('rejects an invalid role and returns descriptive error', () => {
    const invalidPayload = {
      ...validMentor,
      role: 'admin' as any,
    };
    const result = LoginSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorMsg = result.error.flatten().fieldErrors.role?.[0];
      expect(errorMsg).toBe('Please select your role');
    }
  });
});
