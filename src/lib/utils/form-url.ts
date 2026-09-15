/**
 * Generates absolute URLs for the public student attendance form.
 * Works in both server and client environments.
 *
 * @param formId - The unique ID of the attendance form.
 * @param request - Optional Request object to dynamically determine the origin.
 * @returns The absolute public URL for the attendance form.
 */
export function buildPublicFormUrl(formId: string, request?: Request): string {
  let base = process.env.NEXT_PUBLIC_APP_URL;

  if (!base && request) {
    try {
      base = new URL(request.url).origin;
    } catch {
      // Fallback if URL is invalid
    }
  }

  if (!base && typeof window !== 'undefined') {
    base = window.location.origin;
  }

  if (!base) {
    base = 'http://localhost:3000';
  }

  return `${base}/attend/${formId}`;
}
