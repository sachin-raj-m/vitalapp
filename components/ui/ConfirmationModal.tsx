import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'primary';
    isLoading?: boolean;
}

export const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'primary',
    isLoading = false,
}: ConfirmationModalProps) => (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
        <p className="leading-relaxed text-gray-600">{description}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                {cancelText}
            </Button>
            <Button variant={variant === 'danger' ? 'primary' : 'ink'} onClick={onConfirm} isLoading={isLoading}>
                {confirmText}
            </Button>
        </div>
    </Modal>
);
