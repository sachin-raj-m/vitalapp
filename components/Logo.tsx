import React from 'react';
import { cn } from '@/lib/cn';

/** The Vital wordmark: serif "vital" with a single red drop as the dot of the i. */
export function Logo({ className }: { className?: string }) {
    return (
        <span className={cn('inline-flex font-serif text-[26px] leading-none tracking-tight text-gray-900', className)}>
            <span aria-hidden className="inline-flex items-baseline">
                v
                <span className="relative inline-block">
                    ı
                    <svg
                        viewBox="0 0 10 14"
                        className="absolute left-1/2 top-[-0.02em] h-[0.32em] w-[0.24em] -translate-x-1/2 text-red-600"
                    >
                        <path d="M5 0C5 0 0 6.2 0 9a5 5 0 0 0 10 0C10 6.2 5 0 5 0Z" fill="currentColor" />
                    </svg>
                </span>
                tal
            </span>
            <span className="sr-only">Vital</span>
        </span>
    );
}
