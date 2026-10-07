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

    if (giveTo.length === BLOOD_GROUPS.length) return `${g} red cells can be given to patients of every blood group.`;
    if (takeFrom.length === BLOOD_GROUPS.length) return `${g} donors can give only to ${g} patients, and can receive blood from all eight groups.`;
    if (giveTo.length === 1) return `${g} donors can give only to ${g} patients.`;
    return `${g} donors can give to ${giveTo.length} of the 8 groups, and can receive from ${takeFrom.length}.`;
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
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2" role="radiogroup" aria-label="Blood group">
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
                                'group relative flex aspect-[4/3] flex-col justify-between rounded-lg p-3 text-left transition-[background-color,transform,box-shadow] duration-300 active:scale-[0.97] sm:aspect-[5/4] sm:p-4',
                                isSelected && 'z-10 scale-[1.03] bg-red-600 shadow-lg shadow-red-600/40',
                                canReceive && 'bg-white',
                                !isSelected && !canReceive && 'bg-gray-800 hover:bg-gray-700',
                            )}
                        >
                            <span
                                className={cn(
                                    'text-[11px] font-semibold uppercase tracking-[0.06em] leading-none transition-colors duration-300 sm:text-xs',
                                    isSelected ? 'text-white' : canReceive ? 'text-red-700' : 'text-transparent',
                                )}
                            >
                                {isSelected ? 'Donor' : canReceive ? 'Receives' : '\u00a0'}
                            </span>
                            <span
                                className={cn(
                                    'font-serif text-4xl font-semibold leading-none transition-colors duration-300 sm:text-6xl',
                                    isSelected ? 'text-white' : canReceive ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-200',
                                )}
                            >
                                {formatBloodGroup(group)}
                            </span>
                        </button>
                    );
                })}
            </div>

            <p className="mt-6 min-h-[3.5rem] max-w-xl leading-relaxed text-gray-300 sm:text-lg" aria-live={touched ? 'polite' : 'off'}>
                {describe(selected)}
            </p>
        </div>
    );
}
