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
    ['Carry ID', 'A government photo ID. Blood banks usually ask for it.'],
];

export function DonorReadinessModal({ isOpen, onClose }: DonorReadinessModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Thank you for offering to donate">
            <p className="leading-relaxed text-gray-600">If you decide to go ahead, here is some general preparation. It is not medical advice, and the hospital or blood bank decides whether you can donate.</p>

            <dl className="mt-5 divide-y divide-gray-200 border-y border-gray-200">
                {READY.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-3 gap-4 py-3">
                        <dt className="font-medium text-gray-900">{k}</dt>
                        <dd className="col-span-2 text-gray-600">{v}</dd>
                    </div>
                ))}
            </dl>

            <p className="mt-5 rounded-md bg-gray-100 px-3 py-2.5 text-sm leading-relaxed text-gray-700">
                Donation is voluntary, and Vital is not involved in any payment. Any arrangement is between you and the
                requester, at your own discretion. You can decline at any time.
            </p>

            <Button variant="ink" size="lg" className="mt-6 w-full" onClick={onClose}>
                Show my PIN
            </Button>
        </Modal>
    );
}
