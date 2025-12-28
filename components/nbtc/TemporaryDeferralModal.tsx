"use client";

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Check, X, AlertTriangle } from 'lucide-react';

interface TemporaryDeferralModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export function TemporaryDeferralModal({ isOpen, onClose, onConfirm }: TemporaryDeferralModalProps) {
    const [checklist, setChecklist] = useState({
        health: false,
        antibiotics: false,
        procedures: false,
        alcohol: false,
        infection: false,
    });

    const allChecked = Object.values(checklist).every(val => val === true);

    const handleCheck = (key: keyof typeof checklist) => {
        setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Donation Safety Check">
            <div className="space-y-6">
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-800">
                        To ensure the safety of the patient, please confirm you meet these temporary health criteria today.
                    </p>
                </div>

                <div className="space-y-3">
                    <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                            type="checkbox"
                            checked={checklist.health}
                            onChange={() => handleCheck('health')}
                            className="mt-1 w-5 h-5 text-green-600 rounded focus:ring-green-500"
                        />
                        <div className="text-sm">
                            <strong>I am feeling well today.</strong>
                            <p className="text-gray-500 text-xs">No cold, flu, sore throat, or fever.</p>
                        </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                            type="checkbox"
                            checked={checklist.antibiotics}
                            onChange={() => handleCheck('antibiotics')}
                            className="mt-1 w-5 h-5 text-green-600 rounded focus:ring-green-500"
                        />
                        <div className="text-sm">
                            <strong>No antibiotics in the last 14 days.</strong>
                            <p className="text-gray-500 text-xs">Wait 14 days after your last dose.</p>
                        </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                            type="checkbox"
                            checked={checklist.procedures}
                            onChange={() => handleCheck('procedures')}
                            className="mt-1 w-5 h-5 text-green-600 rounded focus:ring-green-500"
                        />
                        <div className="text-sm">
                            <strong>No tattoo, piercing, or surgery in the last 12 months.</strong>
                        </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                            type="checkbox"
                            checked={checklist.alcohol}
                            onChange={() => handleCheck('alcohol')}
                            className="mt-1 w-5 h-5 text-green-600 rounded focus:ring-green-500"
                        />
                        <div className="text-sm">
                            <strong>No alcohol in the last 24 hours.</strong>
                        </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                            type="checkbox"
                            checked={checklist.infection}
                            onChange={() => handleCheck('infection')}
                            className="mt-1 w-5 h-5 text-green-600 rounded focus:ring-green-500"
                        />
                        <div className="text-sm">
                            <strong>No recent infections.</strong>
                            <p className="text-gray-500 text-xs">Malaria (3mo), Dengue (6mo), Typhoid (12mo).</p>
                        </div>
                    </label>
                </div>

                <div className="flex gap-3 pt-4">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                    </Button>
                    <Button
                        disabled={!allChecked}
                        className={`flex-1 ${allChecked ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300'}`}
                        onClick={onConfirm}
                    >
                        <Check className="w-4 h-4 mr-2" />
                        I Confirm
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
