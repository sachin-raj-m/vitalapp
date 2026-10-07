"use client";

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

interface TemporaryDeferralModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const CHECKS = [
    { key: 'health', title: 'I am feeling well today', detail: 'No cold, flu, sore throat or fever.' },
    { key: 'antibiotics', title: 'No antibiotics in the last 14 days', detail: 'Counted from your last dose.' },
    { key: 'procedures', title: 'No tattoo, piercing or surgery in the last 12 months' },
    { key: 'alcohol', title: 'No alcohol in the last 24 hours' },
    { key: 'infection', title: 'No recent infection', detail: 'Malaria in 3 months, dengue in 6, typhoid in 12.' },
] as const;

type CheckKey = typeof CHECKS[number]['key'];

export function TemporaryDeferralModal({ isOpen, onClose, onConfirm }: TemporaryDeferralModalProps) {
    const [checked, setChecked] = useState<Set<CheckKey>>(new Set());

    // Every offer starts with a fresh checklist.
    useEffect(() => {
        if (isOpen) setChecked(new Set());
    }, [isOpen]);

    const toggle = (key: CheckKey) =>
        setChecked(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });

    const allChecked = checked.size === CHECKS.length;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Your self-check">
            <p className="leading-relaxed text-gray-600">
                Tick each item only if it is true for you today. This is your own declaration and Vital does not check it.
                The hospital or blood bank makes its own checks and decides whether you can donate. If any item is not
                true for you, please don’t offer on this request.
            </p>

            <ul className="mt-5 divide-y divide-gray-200 border-y border-gray-200">
                {CHECKS.map(item => {
                    const on = checked.has(item.key);
                    return (
                        <li key={item.key}>
                            <label className="flex cursor-pointer items-start gap-3 py-3.5">
                                <input type="checkbox" checked={on} onChange={() => toggle(item.key)} className="peer sr-only" />
                                <span
                                    aria-hidden
                                    className={cn(
                                        'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-red-600 peer-focus-visible:ring-offset-2',
                                        on ? 'border-gray-900 bg-gray-900' : 'border-gray-300 bg-white',
                                    )}
                                >
                                    {on && (
                                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-white"><path d="M2.5 6.5l2.2 2L9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    )}
                                </span>
                                <span>
                                    <span className="block text-gray-900">{item.title}</span>
                                    {'detail' in item && <span className="mt-0.5 block text-[13px] text-gray-500">{item.detail}</span>}
                                </span>
                            </label>
                        </li>
                    );
                })}
            </ul>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm tabular-nums text-gray-500">{checked.size} of {CHECKS.length} confirmed</span>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button variant="ink" disabled={!allChecked} onClick={onConfirm}>Continue</Button>
                </div>
            </div>
        </Modal>
    );
}
