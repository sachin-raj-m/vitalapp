"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

const DISMISS_KEY = 'vital:profile-nudge-dismissed';

/**
 * Registration only asks for the minimum; this gently offers the optional
 * details (last donation, gender, date of birth, availability) to donors who
 * haven't added any. Dismissing hides it for this browser session.
 */
export function ProfileNudge({ className = '' }: { className?: string }) {
    const { user } = useAuth();
    const [dismissed, setDismissed] = useState(() => {
        try { return typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
    });

    if (!user?.is_donor || dismissed || user.dob || user.gender || user.availability?.length) return null;

    const dismiss = () => {
        setDismissed(true);
        try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage unavailable */ }
    };

    return (
        <section aria-labelledby="profile-nudge-title" className={`flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center ${className}`}>
            <div className="flex-1">
                <h2 id="profile-nudge-title" className="font-medium text-gray-900">Add a few optional details</h2>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">
                    Your last donation date, when you’re usually free and a few basics help us alert you only when you can donate.
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
                <Link href="/complete-registration?step=more" className="inline-flex h-9 items-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-900 hover:border-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2">
                    Add details
                </Link>
                <button type="button" onClick={dismiss} className="text-sm text-gray-700 underline underline-offset-4 hover:text-gray-900">
                    Not now
                </button>
            </div>
        </section>
    );
}
