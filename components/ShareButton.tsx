"use client";

import React, { useEffect, useState } from 'react';
import { Share2, Check, Link2, Download, MessageCircle } from 'lucide-react';
import { buildRequestShare, whatsappShareUrl, type ShareableRequest } from '@/lib/share';
import { SITE_URL } from '@/lib/site';
import { cn } from '@/lib/cn';

type Payload = { title: string; text: string; message: string; url: string };

function payloadFor(props: ShareButtonProps): Payload {
    const origin = window.location.origin;
    if (props.request) return buildRequestShare(props.request, origin);

    // Legacy props: title + text + path.
    const url = props.path ? `${origin}${props.path}` : window.location.href;
    const title = props.title ?? document.title;
    const text = props.text ? `*${title}*\n${props.text}` : `*${title}*`;
    return { title, text, message: `${text}\n\n${url}`, url };
}

async function copyText(value: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Opens the native share sheet with the message (the URL is passed separately, as share
 * targets append it themselves). Falls back to copying the full message with the URL once.
 * Returns 'copied' when it fell back to the clipboard.
 */
async function shareOrCopy(p: Payload): Promise<'shared' | 'copied' | 'failed'> {
    if (typeof navigator.share === 'function') {
        try {
            await navigator.share({ title: p.title, text: p.text, url: p.url });
            return 'shared';
        } catch (err) {
            // The person closed the share sheet: do nothing.
            if (err instanceof DOMException && err.name === 'AbortError') return 'failed';
        }
    }
    return (await copyText(p.message)) ? 'copied' : 'failed';
}

interface ShareButtonProps {
    /** Preferred: the request to share. Builds the full message (group, urgency, units, place, date, compatible donors). */
    request?: ShareableRequest;
    /** Legacy: headline. */
    title?: string;
    /** Legacy: body text. */
    text?: string;
    /** Legacy: path on this site, e.g. /requests/123. Defaults to the current page. */
    path?: string;
    className?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = (props) => {
    const [copied, setCopied] = useState(false);

    const handleShare = async () => {
        if ((await shareOrCopy(payloadFor(props))) === 'copied') {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <button
            type="button"
            onClick={handleShare}
            className={cn('-ml-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-gray-500 transition-colors hover:text-gray-900', props.className)}
        >
            {copied ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Share2 className="h-3.5 w-3.5" />}
            {copied ? 'Message copied' : 'Share'}
        </button>
    );
};

const actionClass =
    'inline-flex h-10 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-900 transition-colors hover:border-gray-400';

/** Full share row for a request page: native share, copy link, WhatsApp and poster download. */
export const RequestShareActions: React.FC<{ request: ShareableRequest; posterFileName?: string }> = ({ request, posterFileName }) => {
    // Start from the canonical URL so server and client markup match, then use this origin.
    const [origin, setOrigin] = useState(SITE_URL);
    const [canNativeShare, setCanNativeShare] = useState(false);
    const [state, setState] = useState<'idle' | 'link' | 'message'>('idle');

    useEffect(() => {
        setOrigin(window.location.origin);
        setCanNativeShare(typeof navigator.share === 'function');
    }, []);

    const share = buildRequestShare(request, origin);

    const flash = (s: 'link' | 'message') => {
        setState(s);
        setTimeout(() => setState('idle'), 2000);
    };

    const handleNative = async () => {
        if ((await shareOrCopy(share)) === 'copied') flash('message');
    };

    const handleCopyLink = async () => {
        if (await copyText(share.url)) flash('link');
    };

    return (
        <div className="flex flex-wrap gap-2">
            <a
                href={whatsappShareUrl(share.message)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1F8F4E] px-4 text-sm font-medium text-white transition-colors hover:bg-[#187A42]"
            >
                <MessageCircle className="h-4 w-4" /> Share on WhatsApp
            </a>
            <button type="button" onClick={handleNative} className={actionClass}>
                {state === 'message' ? <Check className="h-4 w-4 text-success-600" /> : <Share2 className="h-4 w-4" />}
                {state === 'message' ? 'Message copied' : canNativeShare ? 'Share' : 'Copy message'}
            </button>
            <button type="button" onClick={handleCopyLink} className={actionClass}>
                {state === 'link' ? <Check className="h-4 w-4 text-success-600" /> : <Link2 className="h-4 w-4" />}
                {state === 'link' ? 'Link copied' : 'Copy link'}
            </button>
            <a href={`/requests/${request.id}/poster?download=1`} download={posterFileName ?? 'vital-blood-request.png'} className={actionClass}>
                <Download className="h-4 w-4" /> Download poster
            </a>
        </div>
    );
};
