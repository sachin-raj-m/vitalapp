"use client";

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface DonorReadinessModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const READY = [
    ['Sleep', 'At least 5 hours the night before.'],
    ['Eat', 'A light meal. Don’t go on an empty stomach.'],
    ['Drink', 'About 500 ml of water before you donate.'],
    ['Carry ID', 'A government photo ID. The blood bank will ask.'],
];

export function DonorReadinessModal({ isOpen, onClose }: DonorReadinessModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Thank you">
            <h3 className="display text-3xl leading-tight">You just said yes to a stranger.</h3>
            <p className="mt-3 leading-relaxed text-gray-600">A few things so it goes smoothly at the hospital:</p>

            <dl className="mt-5 divide-y divide-gray-200 border-y border-gray-200">
                {READY.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-3 gap-4 py-3">
                        <dt className="font-medium text-gray-900">{k}</dt>
                        <dd className="col-span-2 text-gray-600">{v}</dd>
                    </div>
                ))}
            </dl>

            <p className="mt-5 border-l-2 border-red-600 pl-3 text-[13px] leading-relaxed text-gray-700">
                Donation is strictly voluntary. If anyone asks you for money, or offers to pay you, decline and report it.
            </p>

            <Button variant="ink" size="lg" className="mt-6 w-full" onClick={onClose}>
                Show my PIN
            </Button>
        </Modal>
    );
}
