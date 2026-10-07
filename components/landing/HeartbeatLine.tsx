import React from 'react';
import { cn } from '@/lib/cn';

/**
 * A single ECG beat drawn under the hero's red word. It draws itself once,
 * then a small pulse keeps travelling along it. Both are plain CSS, so the
 * global reduced-motion rule settles them immediately.
 */
export function HeartbeatLine({ className }: { className?: string }) {
    const d = 'M0 15 H92 L100 15 L106 4 L114 24 L121 9 L126 15 H220';
    return (
        <svg viewBox="0 0 220 28" preserveAspectRatio="none" fill="none" aria-hidden className={cn('overflow-visible', className)}>
            <path
                d={d}
                pathLength={1}
                strokeDasharray="1"
                className="animate-draw stroke-red-300"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
            />
            <path
                d={d}
                pathLength={1}
                strokeDasharray="0.15 1.15"
                className="animate-trace stroke-red-600 motion-reduce:hidden"
                style={{ strokeDashoffset: 0.15 }}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}
