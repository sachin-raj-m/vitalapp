"use client";

import React, { useEffect, useRef, useState } from 'react';
import type { BloodGroup } from '@/types';
import {
    BLOOD_GROUPS,
    formatBloodGroup,
    getCompatibleDonors,
    getCompatibleRecipients,
} from '@/lib/blood-compatibility';
import { cn } from '@/lib/cn';

function describe(group: BloodGroup) {
    const giveTo = getCompatibleRecipients(group);
    const takeFrom = getCompatibleDonors(group);
    const g = formatBloodGroup(group);

    if (giveTo.length === BLOOD_GROUPS.length) return `${g} can give to every group. It's the one hospitals reach for first.`;
    if (takeFrom.length === BLOOD_GROUPS.length) return `${g} can only give to ${g}, but can receive from all eight.`;
    if (giveTo.length === 1) return `${g} can only give to ${g}, so every ${g} donor counts.`;
    return `${g} can give to ${giveTo.length} of 8 groups, and receive from ${takeFrom.length}.`;
}

export function BloodTypeExplorer() {
    const [selected, setSelected] = useState<BloodGroup>('O-');
    const [touched, setTouched] = useState(false);

    // Slowly cycle through the groups until someone interacts.
    useEffect(() => {
        if (touched) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const id = window.setInterval(() => {
            setSelected(prev => BLOOD_GROUPS[(BLOOD_GROUPS.indexOf(prev) + 1) % BLOOD_GROUPS.length]);
        }, 2200);
        return () => window.clearInterval(id);
    }, [touched]);

    const recipients = getCompatibleRecipients(selected);
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);

    // Radio-group keyboard pattern: one Tab stop, arrows move (4 columns).
    const onKeyDown = (e: React.KeyboardEvent, index: number) => {
        const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4 }[e.key];
        if (delta === undefined) return;
        e.preventDefault();
        const next = (index + delta + BLOOD_GROUPS.length) % BLOOD_GROUPS.length;
        setTouched(true);
        setSelected(BLOOD_GROUPS[next]);
        buttons.current[next]?.focus();
    };

    return (
        <div>
            <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-gray-800 bg-gray-800" role="radiogroup" aria-label="Blood group">
                {BLOOD_GROUPS.map((group, index) => {
                    const isSelected = group === selected;
                    const canReceive = !isSelected && recipients.includes(group);
                    return (
                        <button
                            key={group}
                            ref={el => { buttons.current[index] = el; }}
                            role="radio"
                            aria-checked={isSelected}
                            aria-label={formatBloodGroup(group)}
                            tabIndex={isSelected ? 0 : -1}
                            onKeyDown={e => onKeyDown(e, index)}
                            onClick={() => { setTouched(true); setSelected(group); }}
                            className={cn(
                                'group relative flex aspect-[4/3] flex-col justify-between p-3 text-left transition-colors duration-300 sm:aspect-[5/4] sm:p-4',
                                isSelected && 'bg-red-600',
                                canReceive && 'bg-gray-900',
                                !isSelected && !canReceive && 'bg-gray-950',
                            )}
                        >
                            <span
                                className={cn(
                                    'font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-300',
                                    isSelected ? 'text-red-100' : canReceive ? 'text-red-400' : 'text-gray-700',
                                )}
                            >
                                {isSelected ? 'You' : canReceive ? 'Receives' : '—'}
                            </span>
                            <span
                                className={cn(
                                    'font-serif text-4xl leading-none tracking-tight transition-colors duration-300 sm:text-6xl',
                                    isSelected ? 'text-white' : canReceive ? 'text-gray-50' : 'text-gray-700 group-hover:text-gray-500',
                                )}
                            >
                                {formatBloodGroup(group)}
                            </span>
                        </button>
                    );
                })}
            </div>

            <p className="mt-6 min-h-[3.5rem] max-w-xl text-lg leading-snug text-gray-300 sm:text-xl" aria-live={touched ? 'polite' : 'off'}>
                {describe(selected)}
            </p>
        </div>
    );
}
