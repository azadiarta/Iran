/**
 * Auth utility functions — all browser-safe (no Next.js server imports).
 */

/**
 * Returns the locale prefix for redirect URLs based on localStorage.
 * Falls back to '/en' in SSR context.
 */
export function getLocalePrefix(): string {
  if (typeof window === 'undefined') return '/en';
  const lang = localStorage.getItem('lang') || 'en';
  return `/${lang}`;
}

/**
 * Decodes the payload of a JWT without signature verification.
 * Safe for browser use only — do NOT trust the result for server-side auth.
 */
export function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    // Convert base64url → base64, then decode
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Returns true if the JWT is expired (or un-parseable).
 * Adds a 10-second clock-skew buffer.
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  // Subtract 10 s buffer to avoid edge-case races
  return payload.exp * 1000 < Date.now() + 10_000;
}
