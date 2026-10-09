import type { ErrorEvent, EventHint } from '@sentry/nextjs';

/**
 * Error reporting to GlitchTip (MIT, open source; Sentry-compatible) through
 * the Sentry SDK (MIT). Off unless NEXT_PUBLIC_SENTRY_DSN is set. Browser
 * reports go through our own /api/monitoring route (see there), so no third
 * party is contacted from the browser and the CSP stays 'self'.
 *
 * Privacy: no IPs, cookies or request bodies (sendDefaultPii: false), no
 * session replay, and the scrubbing below runs on every event.
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || '';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g;

/** Removes things that identify people or unlock pages: contact-link tokens, codes, emails, phone numbers. */
export function scrubText(value: string): string {
    return value
        .replace(/\/c\/[A-Za-z0-9_-]{20,}/g, '/c/[token]')
        .replace(/([?&](?:code|token|access_token|refresh_token|ref)=)[^&#\s]*/gi, '$1[filtered]')
        .replace(/#.*access_token=.*/g, '#[filtered]')
        .replace(EMAIL_RE, '[email]')
        .replace(PHONE_RE, '[phone]');
}

export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
    void _hint;
    if (event.request) {
        if (event.request.url) event.request.url = scrubText(event.request.url);
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.query_string;
        if (event.request.headers) {
            for (const h of Object.keys(event.request.headers)) {
                if (/cookie|authorization|x-forwarded-for|x-real-ip/i.test(h)) delete event.request.headers[h];
            }
        }
    }
    delete event.user;
    if (event.message) event.message = scrubText(event.message);
    for (const ex of event.exception?.values ?? []) {
        if (ex.value) ex.value = scrubText(ex.value);
    }
    for (const b of event.breadcrumbs ?? []) {
        if (b.message) b.message = scrubText(b.message);
        if (b.data?.url && typeof b.data.url === 'string') b.data.url = scrubText(b.data.url);
    }
    return event;
}

export const sentryOptions = {
    dsn: SENTRY_DSN,
    enabled: !!SENTRY_DSN,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
};
