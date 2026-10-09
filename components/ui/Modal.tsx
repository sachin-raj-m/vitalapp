"use client";

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    // Keep the latest onClose without re-running the effect on every render.
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
    // Portal target only exists in the browser; render nothing until mounted.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // Focus management: move focus in, trap Tab inside, Escape closes, and
    // return focus to whatever opened the dialog. Also locks page scroll.
    useEffect(() => {
        if (!isOpen || !mounted) return;
        const opener = document.activeElement as HTMLElement | null;
        const panel = panelRef.current;
        const focusables = () =>
            Array.from(panel?.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            ) ?? []).filter(el => el.offsetParent !== null);

        // Prefer the first form field; fall back to the first control (close button).
        const first = panel?.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), select, textarea') ?? focusables()[0];
        first?.focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCloseRef.current();
                return;
            }
            if (e.key !== 'Tab') return;
            const items = focusables();
            if (!items.length) return;
            const [head, tail] = [items[0], items[items.length - 1]];
            if (e.shiftKey && document.activeElement === head) {
                e.preventDefault();
                tail.focus();
            } else if (!e.shiftKey && document.activeElement === tail) {
                e.preventDefault();
                head.focus();
            }
        };

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKey);
            opener?.focus?.();
        };
    }, [isOpen, mounted]);

    if (!isOpen || !mounted) return null;

    // Portalled to <body> so no ancestor transform, filter or overflow can
    // clip the overlay or turn `position: fixed` into position-relative-to-ancestor.
    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
            <div className="absolute inset-0 bg-gray-950/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-xl border border-gray-200 bg-white animate-fade-up sm:max-w-lg sm:rounded-xl"
            >
                <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4 sm:px-6">
                    <h2 id={titleId} className="text-[15px] font-semibold tracking-[-0.01em] text-gray-900">
                        {title}
                    </h2>
                    <button
                        type="button"
                        className="-mr-1.5 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="px-5 py-5 text-sm text-gray-700 sm:px-6">{children}</div>
            </div>
        </div>,
        document.body,
    );
};
