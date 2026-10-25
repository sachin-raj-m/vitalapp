"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { supabase } from '@/lib/supabase';
import { consentStamp } from '@/lib/legal';
import { formatWaNumber, waNumber } from '@/lib/phone';
import { PHONE_SIGNIN, WHATSAPP_VERIFY_NUMBER } from '@/lib/features';
import { otpError } from '@/lib/auth-errors';
import { TurnstileField, type TurnstileHandle } from '@/components/TurnstileField';
import { CODE_LENGTH, CodeInput } from '@/components/auth/CodeInput';

const RESEND_SECONDS = 60;
const linkClass = 'text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900';

export type OtpProblem = ReturnType<typeof otpError>;

/**
 * Asks Supabase for a phone code for `wa` ("919876543210"). Vital has no SMS:
 * the Send SMS hook keeps the code until the person sends LOGIN to Vital on
 * WhatsApp, and the bot replies with it (lib/phone-login.ts). `create`: a new
 * number gets an account, with the consent on it. Returns the problem, or null
 * once a code is waiting.
 */
export async function sendWhatsAppCode(wa: string, create: boolean, captchaToken?: string): Promise<OtpProblem | null> {
    const { error } = await supabase.auth.signInWithOtp({
        phone: `+${wa}`,
        options: {
            captchaToken,
            shouldCreateUser: create,
            channel: 'sms',
            // Checked by the Before User Created hook and copied onto the profile.
            ...(create ? { data: consentStamp() } : {}),
        },
    });
    return error ? otpError(error.message) : null;
}

/**
 * Once a code is waiting for `sentTo`: open WhatsApp and send LOGIN, then
 * enter the code the bot replies with (checked as soon as the sixth digit is
 * in). `onResend` asks for a new one; the caller knows whether it may create.
 */
export function WhatsAppCodeStep({
    sentTo,
    onSignedIn,
    onResend,
    onBack,
    backLabel = 'Use a different number',
    onUseEmail,
}: {
    sentTo: string;
    onSignedIn: (user: User) => void | Promise<void>;
    onResend: (captchaToken?: string) => Promise<OtpProblem | null>;
    onBack: () => void;
    backLabel?: string;
    /** Shown as "Use email instead" once a new code could be asked for. */
    onUseEmail?: () => void;
}) {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [cooldown, setCooldown] = useState(RESEND_SECONDS);
    const [sends, setSends] = useState(1);
    const captcha = useRef<TurnstileHandle>(null);
    const codeId = `wa-code-${React.useId().replace(/:/g, '')}`;

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    // Back from WhatsApp with the code: put the cursor in the code box.
    useEffect(() => {
        const onReturn = () => {
            if (document.visibilityState === 'visible') document.getElementById(codeId)?.focus({ preventScroll: true });
        };
        document.addEventListener('visibilitychange', onReturn);
        return () => document.removeEventListener('visibilitychange', onReturn);
    }, [codeId]);

    // Runs as soon as the sixth digit is in, or from the button.
    const verify = async (token = code) => {
        if (busy || token.length < CODE_LENGTH) return;
        setError('');
        setBusy(true);
        const { data, error: verifyErr } = await supabase.auth.verifyOtp({ phone: `+${sentTo}`, token, type: 'sms' });
        if (verifyErr || !data.user) {
            setBusy(false);
            setError('That code is incorrect or has expired. Check it, or ask for a new one.');
            return;
        }
        await onSignedIn(data.user);
        setBusy(false);
    };

    const resend = async () => {
        setError('');
        setBusy(true);
        const problem = await onResend(await captcha.current?.getToken());
        captcha.current?.reset(); // tokens work once
        setBusy(false);
        if (problem) {
            if (problem.kind === 'wait') setCooldown(problem.waitSeconds ?? RESEND_SECONDS);
            setError(problem.text);
            return;
        }
        setSends(n => n + 1);
        setCode('');
        setCooldown(RESEND_SECONDS);
    };

    const loginLink = `https://wa.me/${WHATSAPP_VERIFY_NUMBER}?text=${encodeURIComponent('LOGIN')}`;

    return (
        <div className="space-y-4">
            {error && <Alert variant="error">{error}</Alert>}
            <ol className="space-y-3 text-sm leading-relaxed text-gray-700">
                <li>
                    <span className="font-medium text-gray-900">1. Get your code on WhatsApp.</span>{' '}
                    From {formatWaNumber(sentTo)}, send <span className="font-mono text-gray-900">LOGIN</span> to Vital. We reply with a 6-digit code.
                </li>
            </ol>
            <a
                href={loginLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
            >
                <MessageCircle className="h-4 w-4" aria-hidden /> Open WhatsApp and send LOGIN
            </a>
            <p className="text-[13px] leading-relaxed text-gray-500">
                If you’ve messaged Vital in the last day, the code may already be in that chat.
                On a computer? Send LOGIN to +{WHATSAPP_VERIFY_NUMBER} from WhatsApp on your phone.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="space-y-3" noValidate>
                {/* Not focused on its own: on a phone that would open the keyboard over the WhatsApp button. */}
                <CodeInput id={codeId} label="2. Enter the code" value={code} onChange={setCode} onComplete={verify} autoFocus={false} />
                <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={busy} disabled={code.length < CODE_LENGTH}>
                    Continue
                </Button>
            </form>

            <TurnstileField ref={captcha} />
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <button type="button" onClick={onBack} className="text-gray-600 underline underline-offset-4 hover:text-gray-900">
                    {backLabel}
                </button>
                <button
                    type="button"
                    onClick={resend}
                    disabled={cooldown > 0 || busy}
                    className="text-gray-900 underline underline-offset-4 disabled:cursor-not-allowed disabled:text-gray-500 disabled:no-underline"
                >
                    {cooldown > 0 ? `New code in ${cooldown}s` : 'Get a new code'}
                </button>
            </div>
            {onUseEmail && (sends > 1 || cooldown === 0) && (
                <p className="text-[13px] text-gray-500">
                    No reply on WhatsApp?{' '}
                    <button type="button" onClick={onUseEmail} className={linkClass}>Use email instead</button>.
                </p>
            )}
        </div>
    );
}

/** Consent for a number that isn't on Vital yet, when the page hasn't asked for it itself. */
export function NewNumberConsent({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm text-gray-700">This number isn’t on Vital yet. We’ll create an account for it.</p>
            <label className="mt-2 flex cursor-pointer items-start gap-3">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 rounded-[4px] border-gray-400 accent-gray-900"
                />
                <span className="text-sm leading-relaxed text-gray-600">
                    I agree to the <Link href="/terms" target="_blank" className={linkClass}>Terms</Link> and have read the{' '}
                    <Link href="/privacy" target="_blank" className={linkClass}>Privacy notice</Link>.
                </span>
            </label>
        </div>
    );
}

/**
 * "Continue with WhatsApp": sign in, or create an account, with just a mobile
 * number (sendWhatsAppCode). Renders nothing unless PHONE_SIGNIN. Join, Login
 * and the sign-in dialog use ContinueSignIn (one field for an email or a
 * mobile number); this phone-only form is for QuickVerify.
 *
 * New numbers need consent: either the page already has a ticked consent box
 * (`consented`), or this asks for it when the number turns out to be new.
 */
export function WhatsAppSignIn({
    onSignedIn,
    consented,
    allowCreate = true,
    initialPhone = '',
    submitLabel = 'Continue with WhatsApp',
    onUseEmail,
}: {
    onSignedIn: (user: User) => void | Promise<void>;
    /** The page's own consent box is ticked. Undefined: this asks when needed. */
    consented?: boolean;
    /** False: only existing accounts can sign in. */
    allowCreate?: boolean;
    initialPhone?: string;
    submitLabel?: string;
    /** Shown as "Use email instead" once a code is out. */
    onUseEmail?: () => void;
}) {
    const [phone, setPhone] = useState(initialPhone);
    const [sentTo, setSentTo] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [askConsent, setAskConsent] = useState(false);
    const [ownConsent, setOwnConsent] = useState(false);
    const captcha = useRef<TurnstileHandle>(null);

    if (!PHONE_SIGNIN) return null;

    const wa = waNumber(phone);
    const agreed = consented ?? ownConsent;

    const send = async (create: boolean): Promise<void> => {
        setError('');
        if (!wa) {
            setError('Enter a 10-digit Indian mobile number.');
            return;
        }
        if (create && !agreed) {
            setAskConsent(true);
            setError('Tick the box to agree to the Terms and Privacy notice, then continue.');
            return;
        }
        setBusy(true);
        const problem = await sendWhatsAppCode(wa, create, await captcha.current?.getToken());
        captcha.current?.reset(); // tokens work once
        setBusy(false);
        if (problem) {
            if (problem.kind === 'no_account' && allowCreate) {
                // A new number: ask for consent (if the page hasn't), then create.
                if (agreed) return send(true);
                setAskConsent(true);
                setError('');
                return;
            }
            setError(problem.kind === 'no_account' ? 'There’s no Vital account with this number yet.' : problem.text);
            return;
        }
        setSentTo(wa);
    };

    if (sentTo) {
        return (
            <WhatsAppCodeStep
                key={sentTo}
                sentTo={sentTo}
                onSignedIn={onSignedIn}
                onResend={(token) => sendWhatsAppCode(sentTo, allowCreate && agreed, token)}
                onBack={() => { setSentTo(null); setError(''); }}
                onUseEmail={onUseEmail}
            />
        );
    }

    return (
        <form onSubmit={(e) => { e.preventDefault(); send(allowCreate && (consented === true || (askConsent && agreed))); }} className="space-y-4" noValidate>
            {error && <Alert variant="error">{error}</Alert>}
            <Input
                label="Mobile number (on WhatsApp)"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setAskConsent(false); }}
                helperText="Indian numbers only. We never share it in WhatsApp."
            />
            {askConsent && consented === undefined && <NewNumberConsent checked={ownConsent} onChange={setOwnConsent} />}
            <TurnstileField ref={captcha} />
            <Button
                type="submit"
                variant="secondary"
                size="lg"
                className="w-full"
                isLoading={busy}
                disabled={askConsent && !agreed}
                leftIcon={<MessageCircle className="h-4 w-4" aria-hidden />}
            >
                {askConsent ? 'Create account and continue' : submitLabel}
            </Button>
        </form>
    );
}
