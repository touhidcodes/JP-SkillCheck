import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPublicFormUrl } from '@/lib/utils/form-url';

describe('buildPublicFormUrl', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    // Ensure window is undefined by default in test env
    if ('window' in globalThis) {
      delete (globalThis as { window?: unknown }).window;
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalWindow) {
      globalThis.window = originalWindow;
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  });

  it('uses NEXT_PUBLIC_APP_URL when defined', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://custom-domain.com');
    const url = buildPublicFormUrl('form-123');
    expect(url).toBe('https://custom-domain.com/attend/form-123');
  });

  it('uses request.url origin when request is provided and NEXT_PUBLIC_APP_URL is not set', () => {
    const mockRequest = new Request('https://req-domain.com/some/path?query=1');
    const url = buildPublicFormUrl('form-123', mockRequest);
    expect(url).toBe('https://req-domain.com/attend/form-123');
  });

  it('uses window.location.origin when NEXT_PUBLIC_APP_URL is not set, no request is provided, and window is defined', () => {
    globalThis.window = {
      location: {
        origin: 'https://window-domain.com',
      },
    } as unknown as Window & typeof globalThis;

    const url = buildPublicFormUrl('form-123');
    expect(url).toBe('https://window-domain.com/attend/form-123');
  });

  it('falls back to http://localhost:3000 when environment variable, request, and window are all missing', () => {
    const url = buildPublicFormUrl('form-123');
    expect(url).toBe('http://localhost:3000/attend/form-123');
  });

  it('falls back gracefully when request.url is relative/invalid', () => {
    const mockRequest = { url: '/api/attend' } as unknown as Request;
    const url = buildPublicFormUrl('form-123', mockRequest);
    expect(url).toBe('http://localhost:3000/attend/form-123');
  });
});
