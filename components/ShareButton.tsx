"use client";

import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';

interface ShareButtonProps {
    title: string;
    text: string;
    /** Path on this site to share, e.g. /requests/123. Defaults to the current page. */
    path?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({ title, text, path }) => {
    const [copied, setCopied] = useState(false);

    const handleShare = async () => {
        const url = path ? `${window.location.origin}${path}` : window.location.href;

        try {
            if (navigator.share) {
                // WhatsApp renders *text* as bold.
                await navigator.share({ title, text: `*${title}*\n${text}\n\nCan you help? Tap to respond:`, url });
            } else {
                await navigator.clipboard.writeText(`${title}\n${text}\n${url}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch {
            // Share sheet dismissed.
        }
    };

    return (
        <button
            type="button"
            onClick={handleShare}
            className="-ml-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-gray-500 transition-colors hover:text-gray-900"
        >
            {copied ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Share2 className="h-3.5 w-3.5" />}
            {copied ? 'Link copied' : 'Share'}
        </button>
    );
};
