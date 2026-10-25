import React from 'react';
import { cn } from '@/lib/cn';

/**
 * Product Hunt's "Featured" badge for Vital. The image is Product Hunt's own
 * SVG (it updates itself), served from api.producthunt.com, which the CSP's
 * img-src allows (next.config.mjs).
 */
export function ProductHuntBadge({ className }: { className?: string }) {
    return (
        <a
            href="https://www.producthunt.com/products/vital-3?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-vital-5"
            target="_blank"
            rel="noopener noreferrer"
            className={cn('inline-block', className)}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                alt="Vital - Blood, when it’s needed | Product Hunt"
                width={250}
                height={54}
                loading="lazy"
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1292382&theme=light&t=1792942091888"
            />
        </a>
    );
}
