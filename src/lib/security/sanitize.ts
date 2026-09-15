const HTML_DANGEROUS_PATTERNS = /[<>"'&]/g;
const HTML_REPLACEMENT_MAP: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '&': '&amp;',
};

const SHEETS_FORMULA_PATTERN = /^[=+\-@]/;

export function sanitizeForHtml(input: string): string {
  if (!input) return '';
  return input
    .replace(HTML_DANGEROUS_PATTERNS, (char) => HTML_REPLACEMENT_MAP[char] || char)
    .trim();
}

export function sanitizeForEmail(input: string): string {
  if (!input) return '';
  return input
    .replace(/[\r\n]/g, ' ')
    .replace(/[<>"']/g, '')
    .trim();
}

export function sanitizeForFilename(input: string): string {
  if (!input) return '';
  return input
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 255);
}

export function sanitizeForSheet(input: string): string {
  if (!input) return '';
  const cleaned = input
    .replace(/\t/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 10000);
  if (SHEETS_FORMULA_PATTERN.test(cleaned)) {
    return `'${cleaned}`;
  }
  return cleaned;
}

export function sanitizeUrl(input: string): string {
  if (!input) return '';
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return '';
    }
    return url.toString();
  } catch {
    return '';
  }
}
