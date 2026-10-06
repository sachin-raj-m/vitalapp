/** Canonical public origin. Set NEXT_PUBLIC_SITE_URL per environment. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://vitalapp.in').replace(/\/$/, '');

/** Escapes text for interpolation into HTML (emails). */
export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Accepts only same-site relative paths like "/requests/new" (blocks //evil.com and URLs). */
export function safeInternalPath(path: string | null | undefined, fallback = '/dashboard'): string {
    if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return fallback;
    return path;
}
