"use client";

import React, { useState } from 'react';
import { Share2, Copy, Check, Facebook, Twitter, Smartphone } from 'lucide-react';
import { Button } from './ui/Button';


// Actually, better to stick to a simple button that triggers the native sheet or a toast
// Let's keep it simple: One button "Share".
// If Mobile -> Native Sheet
// If Desktop -> Copy Link + Toast

interface ShareButtonProps {
    title: string;
    text: string;
    url?: string; // Optional, defaults to window.location.href or app home
}

export const ShareButton: React.FC<ShareButtonProps> = ({ title, text, url }) => {
    const [copied, setCopied] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleShare = async () => {
        setIsLoading(true);
        const shareUrl = url || window.location.href;
        const shareData = {
            title,
            text,
            url: shareUrl
        };

        try {
            if (typeof navigator !== 'undefined' && navigator.share) {
                // Mobile / Supported Browsers
                await navigator.share(shareData);
            } else {
                // Desktop / Fallback
                await navigator.clipboard.writeText(`${title}\n${text}\n${shareUrl}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (error) {
            console.error('Error sharing:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className={`text-gray-500 hover:text-primary-600 transition-colors ${copied ? 'text-success-600' : ''}`}
            title="Share this request"
        >
            {copied ? (
                <>
                    <Check className="h-4 w-4 mr-1" />
                    <span className="text-xs">Copied</span>
                </>
            ) : (
                <>
                    <Share2 className="h-4 w-4 mr-1" />
                    <span className="text-xs">Share</span>
                </>
            )}
        </Button>
    );
};
