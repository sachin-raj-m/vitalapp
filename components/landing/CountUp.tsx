"use client";

import React, { useEffect, useRef } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

/**
 * Counts from 0 to `value` the first time it scrolls into view. Screen readers
 * get the final number straight away; reduced-motion users see it without the count.
 */
export function CountUp({ value, className, duration = 1.6 }: { value: number; className?: string; duration?: number }) {
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
    const reduce = useReducedMotion();

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (reduce) {
            el.textContent = fmt(value);
            return;
        }
        if (!inView) return;
        // The real number is rendered up front; only restart from 0 when we actually animate.
        el.textContent = fmt(0);
        const controls = animate(0, value, {
            duration,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: v => { el.textContent = fmt(v); },
        });
        return () => controls.stop();
    }, [inView, reduce, value, duration]);

    return (
        <span className={className}>
            <span ref={ref} aria-hidden className="lining-nums tabular-nums">{fmt(value)}</span>
            <span className="sr-only">{fmt(value)}</span>
        </span>
    );
}
