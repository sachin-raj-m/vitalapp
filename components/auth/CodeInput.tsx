"use client";

import React from 'react';
import { Input } from '@/components/ui/Input';

/** Every sign-in and confirmation code Vital asks for has this many digits. */
export const CODE_LENGTH = 6;

/**
 * The box for a 6-digit code from an email or WhatsApp. Focused when it
 * appears, keeps digits only (so a pasted "123 456" or "Code: 123456" works),
 * offers the phone's one-time-code autofill, and calls onComplete as soon as
 * the sixth digit is in, so nobody has to find the button.
 */
export function CodeInput({
    value,
    onChange,
    onComplete,
    label = 'Code',
    helperText,
    disabled,
    autoFocus = true,
    id,
}: {
    value: string;
    onChange: (code: string) => void;
    /** Called once when the code becomes complete (typed, pasted or autofilled). */
    onComplete?: (code: string) => void;
    label?: string;
    helperText?: string;
    disabled?: boolean;
    autoFocus?: boolean;
    id?: string;
}) {
    const update = (raw: string) => {
        const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
        onChange(digits);
        if (digits.length === CODE_LENGTH && value.length !== CODE_LENGTH) onComplete?.(digits);
    };

    return (
        <Input
            id={id}
            label={label}
            inputMode="numeric"
            autoComplete="one-time-code"
            // Filled from an SMS or a password manager on most phones.
            pattern="[0-9]*"
            maxLength={CODE_LENGTH + 8 /* room for spaces in a pasted code */}
            autoFocus={autoFocus}
            disabled={disabled}
            value={value}
            onChange={(e) => update(e.target.value)}
            onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                if (!text) return;
                e.preventDefault();
                update(text);
            }}
            className="font-mono text-lg tracking-[0.3em]"
            helperText={helperText}
        />
    );
}
