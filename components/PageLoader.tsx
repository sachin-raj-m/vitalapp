import React from 'react';
import { Logo } from './Logo';

/** Full-page wait state used by the auth and route guards. */
export function PageLoader({ label = 'One moment…' }: { label?: string }) {
    return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5" role="status" aria-live="polite">
            <Logo className="animate-pulse text-4xl" />
            <p className="text-sm text-gray-500">{label}</p>
        </div>
    );
}
