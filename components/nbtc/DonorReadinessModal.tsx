"use client";

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CheckCircle, Moon, Coffee, Droplet, UserCheck, ShieldAlert } from 'lucide-react';

interface DonorReadinessModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function DonorReadinessModal({ isOpen, onClose }: DonorReadinessModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="You Are Awesome!">
            <div className="space-y-6">
                <div className="text-center">
                    <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="h-10 w-10 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Thank you for stepping up!</h3>
                    <p className="text-gray-500 mt-2">
                        Before you go to the hospital, please ensure you are 100% ready.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-indigo-50 p-4 rounded-xl text-center">
                        <Moon className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-indigo-900">5+ Hours Sleep</p>
                        <p className="text-xs text-indigo-700">Feel rested?</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-xl text-center">
                        <Coffee className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-orange-900">Light Meal</p>
                        <p className="text-xs text-orange-700">Don't go empty stomach.</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl text-center">
                        <Droplet className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-blue-900">Hydrate</p>
                        <p className="text-xs text-blue-700">Drink 500ml water.</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-xl text-center">
                        <UserCheck className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-emerald-900">ID Proof</p>
                        <p className="text-xs text-emerald-700">Carry Govt ID.</p>
                    </div>
                </div>

                <div className="bg-red-50 p-4 rounded-lg flex gap-3 text-red-800 text-sm">
                    <ShieldAlert className="h-5 w-5 shrink-0" />
                    <div>
                        <strong>Strictly Voluntary:</strong> If anyone asks you for money or offers to pay you, please decline and report it.
                    </div>
                </div>

                <Button className="w-full bg-primary-600 hover:bg-primary-700" onClick={onClose}>
                    I'm Ready. View PIN.
                </Button>
            </div>
        </Modal>
    );
}
