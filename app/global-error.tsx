"use client";

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// Last-resort error screen (replaces the root layout), reported to GlitchTip.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => { Sentry.captureException(error); }, [error]);
    return (
        <html lang="en">
            <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fafaf9', color: '#111827' }}>
                <main style={{ maxWidth: 480, margin: '0 auto', padding: '96px 20px' }}>
                    <h1 style={{ fontSize: 32, margin: 0 }}>Something went wrong</h1>
                    <p style={{ marginTop: 16, lineHeight: 1.6, color: '#4b5563' }}>
                        Sorry about that. We’ve been notified. Please try again; if it keeps happening, reload the page.
                    </p>
                    <button onClick={reset} style={{ marginTop: 24, height: 44, padding: '0 20px', borderRadius: 6, border: 0, background: '#111827', color: '#fff', fontSize: 14, cursor: 'pointer' }}>
                        Try again
                    </button>
                </main>
            </body>
        </html>
    );
}
