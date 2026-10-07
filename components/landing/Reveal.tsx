"use client";

import React, { useEffect, useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';

/**
 * Fades and lifts its children in once, when they scroll into view.
 * The server-rendered HTML is fully visible; the hidden starting state only
 * applies after hydration, so content never depends on JavaScript to appear.
 * `reducedMotion="user"` drops the movement (keeping only the fade) for people
 * who ask their system for less motion.
 */
export function Reveal({
    children,
    className,
    delay = 0,
    as = 'div',
}: {
    children: React.ReactNode;
    className?: string;
    delay?: number;
    as?: 'div' | 'li';
}) {
    const [hydrated, setHydrated] = useState(false);
    useEffect(() => setHydrated(true), []);

    if (!hydrated) {
        const Tag = as;
        return <Tag className={className}>{children}</Tag>;
    }

    const MotionTag = as === 'li' ? motion.li : motion.div;
    return (
        <MotionConfig reducedMotion="user">
            <MotionTag
                className={className}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '0px 0px -12% 0px' }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }}
            >
                {children}
            </MotionTag>
        </MotionConfig>
    );
}
