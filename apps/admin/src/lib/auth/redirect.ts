const DEFAULT_REDIRECT = '/restaurants';

// Only same-origin path redirects survive. We reject anything that could escape
// the admin app (absolute URLs, protocol-relative `//evil.com`, missing leading
// `/`) so a crafted ?redirect= can't turn the signin page into a phishing
// relay.
export function sanitizeRedirect(
  value: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT
): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;
  return value;
}
