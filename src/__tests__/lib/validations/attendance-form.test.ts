import { describe, it, expect } from 'vitest';
import { StudentSubmitSchema, CreateFormSchema } from '@/lib/validations/attendance-form';

describe('StudentSubmitSchema', () => {
  it('rejects empty full_name', () => {
    expect(StudentSubmitSchema.safeParse({ full_name: '', email: 'a@b.com' }).success).toBe(false);
  });
  it('rejects invalid email', () => {
    expect(StudentSubmitSchema.safeParse({ full_name: 'Jane', email: 'notanemail' }).success).toBe(false);
  });
  it('lowercases and trims email', () => {
    const r = StudentSubmitSchema.safeParse({ full_name: 'Jane', email: '  JANE@EXAMPLE.COM  ' });
    expect(r.success && r.data.email).toBe('jane@example.com');
  });
  it('trims full_name whitespace', () => {
    const r = StudentSubmitSchema.safeParse({ full_name: '  Jane Doe  ', email: 'j@x.com' });
    expect(r.success && r.data.full_name).toBe('Jane Doe');
  });
  it('rejects full_name longer than 100 chars', () => {
    expect(StudentSubmitSchema.safeParse({ full_name: 'A'.repeat(101), email: 'a@b.com' }).success).toBe(false);
  });
});

describe('CreateFormSchema', () => {
  const base = {
    session_id: 'abc-123',
    session_label: 'Morning Session',
    date: new Date().toISOString().slice(0, 10),
    mode: 'session' as const,
    period: 'full_day' as const,
  };
  it('accepts valid input', () => {
    expect(CreateFormSchema.safeParse(base).success).toBe(true);
  });
  it('rejects expiry_minutes below 15', () => {
    expect(CreateFormSchema.safeParse({ ...base, expiry_minutes: 10 }).success).toBe(false);
  });
  it('rejects expiry_minutes above 480', () => {
    expect(CreateFormSchema.safeParse({ ...base, expiry_minutes: 500 }).success).toBe(false);
  });
  it('rejects date more than 1 day in the past', () => {
    expect(CreateFormSchema.safeParse({ ...base, date: '2020-01-01' }).success).toBe(false);
  });
});
