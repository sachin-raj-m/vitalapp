import React from 'react';
import { cn } from '@/lib/cn';

/**
 * The Vital wordmark: "vital" in Cormorant Garamond semibold with a single red
 * drop standing in for the dot of the i. The drop is positioned in em units
 * against Cormorant's metrics (x-height 0.386em, i-dot top ~0.61em) so it
 * scales with any font-size passed via className. Inside a `group` link the
 * drop gives a small heartbeat on hover.
 */
export function Logo({ className }: { className?: string }) {
    return (
        <span className={cn('inline-flex font-serif text-[28px] font-semibold leading-none tracking-[-0.01em] text-gray-900', className)}>
            <span aria-hidden className="inline-flex items-baseline">
                v
                <span className="relative inline-block">
                    ı
                    <svg
                        viewBox="0 0 10 14"
                        className="absolute left-[calc(50%-0.09em)] top-[0.13em] h-[0.25em] w-[0.18em] origin-bottom text-red-600 group-hover:animate-heartbeat"
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
