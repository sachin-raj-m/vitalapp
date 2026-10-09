"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { PLATFORM_DISCLAIMER, PRIVACY_VERSION, consentStamp, hasRecordedConsent } from '@/lib/legal';

// Pages where the prompt would get in the way: sign-in/registration (which ask
// for consent themselves) and the legal pages the prompt links to.
const HIDDEN_ON = ['/login', '/register', '/forgot-password', '/reset-password', '/complete-registration', '/auth', '/privacy', '/terms', '/safety-guidelines'];
const DISMISS_KEY = 'consentPromptDismissed';

/**
 * Asks signed-in people who have no consent on record (accounts from before
 * consent was stored), or who agreed to an older Privacy notice, to agree to the
 * current one. Until they do, the database won't let them post a request.
 * "Not now" hides it for the rest of the browser session.
 */
export function ConsentPrompt() {
    const { user } = useAuth();
    const pathname = usePathname() || '/';
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);
    const [dismissed, setDismissed] = useState(() => {
        try { return typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
    });

    const needsConsent = !!user?.id && !(hasRecordedConsent(user) && user.consent_version === PRIVACY_VERSION);
    // Only once registration is finished; complete-registration records consent itself.
    const registered = !!user?.blood_group || !!user?.is_donor;
    const hiddenHere = HIDDEN_ON.some(p => pathname === p || pathname.startsWith(`${p}/`));
    if (!needsConsent || !registered || hiddenHere || done || dismissed) return null;

    const isUpdate = !!user?.consent_version && user.consent_version !== PRIVACY_VERSION;

    const agree = async () => {
        setSaving(true);
        const { error } = await supabase.from('profiles').update(consentStamp()).eq('id', user!.id);
        setSaving(false);
        if (error) {
            toast.error('Could not save that. Please try again.');
            return;
        }
        setDone(true);
        toast.success('Thanks. Your agreement is saved.');
    };

    const notNow = () => {
        try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage blocked */ }
        setDismissed(true);
    };

    return (
        <Modal isOpen onClose={notNow} title={isUpdate ? 'Our Privacy notice has changed' : 'Please confirm our Terms and Privacy notice'}>
            <div className="space-y-4 text-[15px] leading-relaxed text-gray-700">
                <p>
                    {isUpdate
                        ? 'We updated how Vital describes what it collects and who can see it. Please read it and confirm you agree.'
                        : 'You joined Vital before we started keeping a record of agreement. Please read the Terms and Privacy notice and confirm you agree.'}
                </p>
                <p>
                    Read the <Link href="/terms" target="_blank" className="underline underline-offset-4">Terms</Link> and the{' '}
                    <Link href="/privacy" target="_blank" className="underline underline-offset-4">Privacy notice</Link>{' '}
                    (both open in a new tab). You need to agree before you can post a blood request.
                </p>
                <p className="text-[13px] text-gray-500">{PLATFORM_DISCLAIMER}</p>
                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="secondary" onClick={notNow}>Not now</Button>
                    <Button type="button" variant="primary" onClick={agree} isLoading={saving}>I agree</Button>
                </div>
            </div>
        </Modal>
    );
}
