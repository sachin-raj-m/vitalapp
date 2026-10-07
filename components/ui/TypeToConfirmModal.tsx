"use client";

import React, { useEffect, useId, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface TypeToConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Runs the destructive action. Throw (or reject) to keep the dialog open and show the message. */
    onConfirm: () => Promise<void>;
    title: string;
    /** Lead sentence explaining the consequence. */
    description: React.ReactNode;
    /** Exactly what will be removed, listed for the user. */
    items?: string[];
    /** The word the user must type, case-sensitive. */
    confirmWord?: string;
    confirmText?: string;
    loadingText?: string;
}

/**
 * Confirmation for irreversible actions: the destructive button stays disabled
 * until the user types `confirmWord` exactly. Errors from `onConfirm` are shown
 * inline and the dialog stays open; it can't be dismissed mid-request.
 */
export const TypeToConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    items,
    confirmWord = 'DELETE',
    confirmText = 'Delete permanently',
    loadingText = 'Deleting…',
}: TypeToConfirmModalProps) => {
    const inputId = useId();
    const hintId = useId();
    const errorId = useId();
    const [value, setValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Start clean every time the dialog opens.
    useEffect(() => {
        if (isOpen) {
            setValue('');
            setError('');
            setIsLoading(false);
        }
    }, [isOpen]);

    const matches = value === confirmWord;

    const close = () => {
        if (!isLoading) onClose();
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!matches || isLoading) return;
        setError('');
        setIsLoading(true);
        try {
            await onConfirm();
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={close} title={title}>
            <form onSubmit={submit} noValidate>
                <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5 text-red-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                    <div className="space-y-2 leading-relaxed">
                        <p>{description}</p>
                        {items && items.length > 0 && (
                            <ul className="list-disc space-y-0.5 pl-5 text-red-800">
                                {items.map(item => <li key={item}>{item}</li>)}
                            </ul>
                        )}
                        <p className="font-medium">This cannot be undone.</p>
                    </div>
                </div>

                <label htmlFor={inputId} className="mt-5 block text-sm font-medium text-gray-900">
                    Type <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[13px] text-gray-900">{confirmWord}</span> to confirm
                </label>
                <input
                    id={inputId}
                    type="text"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    disabled={isLoading}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-describedby={error ? `${hintId} ${errorId}` : hintId}
                    aria-invalid={!!error || undefined}
                    className="mt-2 block h-10 w-full rounded-md border border-gray-300 bg-white px-3 font-mono text-sm text-gray-900 outline-none transition-colors focus:border-gray-900 focus:ring-2 focus:ring-red-600/20 disabled:bg-gray-50"
                />
                <p id={hintId} className="mt-1.5 text-xs text-gray-500">Case-sensitive.</p>

                {error && (
                    <p id={errorId} role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                        {error}
                    </p>
                )}

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="secondary" onClick={close} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="error" disabled={!matches} isLoading={isLoading}>
                        {isLoading ? loadingText : confirmText}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
