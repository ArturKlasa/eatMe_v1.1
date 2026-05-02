import { describe, it, expect } from 'vitest';
import { sanitizeRedirect } from '@/lib/auth/redirect';

describe('sanitizeRedirect', () => {
  it('returns the default fallback for null/empty/undefined', () => {
    expect(sanitizeRedirect(null)).toBe('/restaurants');
    expect(sanitizeRedirect(undefined)).toBe('/restaurants');
    expect(sanitizeRedirect('')).toBe('/restaurants');
  });

  it('accepts same-origin absolute paths', () => {
    expect(sanitizeRedirect('/restaurants')).toBe('/restaurants');
    expect(sanitizeRedirect('/menu-scan/abc-123')).toBe('/menu-scan/abc-123');
    expect(sanitizeRedirect('/imports?tab=places')).toBe('/imports?tab=places');
  });

  it('rejects absolute URLs and falls back', () => {
    expect(sanitizeRedirect('https://evil.com/restaurants')).toBe('/restaurants');
    expect(sanitizeRedirect('http://evil.com')).toBe('/restaurants');
  });

  it('rejects protocol-relative URLs (//evil.com)', () => {
    expect(sanitizeRedirect('//evil.com/x')).toBe('/restaurants');
  });

  it('rejects relative paths without a leading slash', () => {
    expect(sanitizeRedirect('restaurants')).toBe('/restaurants');
    expect(sanitizeRedirect('javascript:alert(1)')).toBe('/restaurants');
  });

  it('honours a caller-supplied fallback', () => {
    expect(sanitizeRedirect(null, '/audit')).toBe('/audit');
    expect(sanitizeRedirect('https://evil.com', '/audit')).toBe('/audit');
  });
});
