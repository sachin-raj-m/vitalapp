import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { Mail, Phone, X } from 'lucide-react';
import { WHATSAPP_LIVE, WHATSAPP_VERIFY_NUMBER } from '@/lib/features';
import { waNumber } from '@/lib/phone';
import { contactVerification } from '@/lib/verification';
import { ConfirmEmailCode } from '@/components/auth/ConfirmEmailCode';
import { WhatsAppVerify } from '@/components/WhatsAppVerify';

/**
 * "Pending verification": what's missing (email, mobile number) and how to fix
 * it, right here. The phone is optional and only asked for when there's a way
 * to verify it (lib/features.ts).
 */
export const VerificationBanner = () => {
    const { session, user, refreshProfile } = useAuth();
    const [isVisible, setIsVisible] = useState(true);
    const [emailOpen, setEmailOpen] = useState(false);
    const [done, setDone] = useState('');

    if (!session?.user || !isVisible) return null;

    const status = contactVerification(user, session.user.email_confirmed_at);
    const canVerifyPhone = WHATSAPP_VERIFY_NUMBER || WHATSAPP_LIVE;
    const phoneReachable = !!waNumber(user?.phone);
    // Ask about the phone only once the profile is loaded and there's a way to verify it.
    const askPhone = !!user && !status.phone && (status.phoneMissing || (canVerifyPhone && phoneReachable));
    const askEmail = !status.email;

    if (!askEmail && !askPhone) {
        return done ? (
            <div className="rounded-md border-l-2 border-success-500 bg-success-50 px-4 py-3 text-sm text-success-800">{done}</div>
        ) : null;
    }

    const missing = [askEmail && 'confirm your email', askPhone && (status.phoneMissing ? 'add your mobile number' : 'verify your mobile number')].filter(Boolean).join(' and ');

    return (
        <div className="space-y-3 rounded-md border-l-2 border-warning-500 bg-warning-50 px-4 py-3 text-sm">
            <div className="flex items-start gap-3">
                <div className="flex-1 text-warning-800">
                    <p><span className="font-medium">Your account is pending verification.</span> Please {missing}.</p>
                    {askPhone && status.phoneMissing && user?.phone_released_at && (
                        <p className="mt-1 text-[13px]">Another Vital account verified the number you had, so it was removed from yours.</p>
                    )}
                    {done && <p className="mt-1 text-[13px] text-success-700">{done}</p>}
                </div>
                <button onClick={() => setIsVisible(false)} className="rounded p-1 text-warning-600 hover:text-warning-800" aria-label="Dismiss">
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex flex-wrap items-start gap-2">
                {askEmail && !emailOpen && (
                    <Button size="sm" variant="secondary" onClick={() => setEmailOpen(true)} leftIcon={<Mail className="h-3.5 w-3.5" />}>
                        Confirm email
                    </Button>
                )}
                {askPhone && status.phoneMissing && (
                    <Link href="/profile/edit#phone" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-900 hover:border-gray-900">
                        <Phone className="h-3.5 w-3.5" /> Add mobile number
                    </Link>
                )}
                {askPhone && !status.phoneMissing && WHATSAPP_VERIFY_NUMBER && (
                    <WhatsAppVerify size="sm" onVerified={async () => { await refreshProfile(); setDone('Your number is verified.'); }} />
                )}
                {askPhone && !status.phoneMissing && !WHATSAPP_VERIFY_NUMBER && (
                    <Link href="/profile/edit#phone" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-900 hover:border-gray-900">
                        <Phone className="h-3.5 w-3.5" /> Confirm on WhatsApp
                    </Link>
                )}
            </div>

            {askEmail && emailOpen && session.user.email && (
                <div className="max-w-md rounded-md border border-gray-200 bg-white p-4">
                    <ConfirmEmailCode
                        email={session.user.email}
                        sentOnMount={false}
                        backLabel="Close"
                        onBack={() => setEmailOpen(false)}
                        onVerified={async () => {
                            await supabase.auth.refreshSession();
                            await refreshProfile();
                            setEmailOpen(false);
                            setDone('Your email is confirmed.');
                        }}
                    />
                </div>
            )}
        </div>
    );
};
