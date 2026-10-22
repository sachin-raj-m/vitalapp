"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { supabase } from '@/lib/supabase';
import { PHONE_SIGNIN } from '@/lib/features';
import { formatWaNumber } from '@/lib/phone';
import type { User } from '@supabase/supabase-js';

/**
 * Settings → Password: which ways the account can sign in, and a password
 * form for accounts that have an email (Google-only and email-code accounts
 * can set one here; updateUser({ password }) works whether or not one exists).
 * Accounts made with "Continue with WhatsApp" have no email, so they are asked
 * to add one first (onAddEmail); a password needs an email to sign in with.
 */
export function SecuritySettings({ email, onAddEmail }: { email?: string; onAddEmail?: () => void }) {
    const [loading, setLoading] = useState(true);
    const [authUser, setAuthUser] = useState<User | null>(null);
    const identities = authUser?.identities ?? [];
    const [passwordForm, setPasswordForm] = useState({
        newPassword: '',
        confirmPassword: ''
    });
    const [isUpdating, setIsUpdating] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Fetched again when the email changes (e.g. just added in Settings).
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setAuthUser(user);
            setLoading(false);
        };
        fetchUser();
    }, [email]);

    const hasEmail = !!(authUser?.email || email);
    // Supabase can't tell us whether a password is set: an 'email' identity
    // also exists for accounts made with an emailed code.
    const hasPassword = hasEmail && identities.some(id => id.provider === 'email');
    const hasGoogle = identities.some(id => id.provider === 'google');
    // The sign-in phone (set by phone sign-in, or by verifying the number on WhatsApp).
    const signInPhone = authUser?.phone && authUser.phone_confirmed_at ? authUser.phone : '';
    const hasWhatsApp = PHONE_SIGNIN && (!!signInPhone || identities.some(id => id.provider === 'phone'));
    const methods = [
        hasPassword && { name: 'Email + password', detail: authUser?.email || email },
        hasGoogle && { name: 'Google', detail: identities.find(id => id.provider === 'google')?.identity_data?.email as string | undefined },
        hasWhatsApp && { name: 'WhatsApp', detail: signInPhone ? formatWaNumber(signInPhone) : undefined },
    ].filter(Boolean) as { name: string; detail?: string }[];

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (passwordForm.newPassword.length < 8) {
            setMessage({ type: 'error', text: 'Use at least 8 characters.' });
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match' });
            return;
        }

        setIsUpdating(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: passwordForm.newPassword
            });

            if (error) throw error;

            setMessage({ type: 'success', text: 'Password updated successfully' });
            setPasswordForm({ newPassword: '', confirmPassword: '' });

            // Refresh the sign-in methods (an email identity may be new).
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setAuthUser(user);

        } catch (err: any) {
            console.error('Error updating password', err);
            setMessage({ type: 'error', text: err.message || 'Failed to update password' });
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) return null;

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-[13px] font-medium text-gray-800">Ways you can sign in</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                    {methods.map(m => (
                        <li key={m.name} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                            <span className="block text-gray-900">{m.name}</span>
                            {m.detail && <span className="block break-all text-xs text-gray-500">{m.detail}</span>}
                        </li>
                    ))}
                    {!methods.length && <li className="text-sm text-gray-600">{hasEmail ? 'Email' : 'Mobile number'}</li>}
                </ul>
            </div>

            {!hasEmail ? (
                <p className="text-sm text-gray-600">
                    To also sign in with an email and password, add an email first.{' '}
                    {onAddEmail && (
                        <button type="button" onClick={onAddEmail} className="text-gray-900 underline underline-offset-4">Add an email (optional)</button>
                    )}
                </p>
            ) : (<>
            {!hasPassword ? (
                <p className="text-sm text-gray-600">Set a password if you’d also like to sign in with your email address.</p>
            ) : (
                <p className="text-sm text-gray-600">Forgotten it, or never set one (for example if you signed up with a code)? Enter a new one here.</p>
            )}

            {message && (
                <Alert variant={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>
            )}

            <form onSubmit={handlePasswordUpdate} className="max-w-md space-y-4">
                <Input
                    type="password"
                    label={hasPassword ? 'New password' : 'Password'}
                    placeholder="At least 8 characters"
                    minLength={8}
                    autoComplete="new-password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    required
                />
                <Input
                    type="password"
                    label="Confirm password"
                    autoComplete="new-password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    required
                />
                <Button type="submit" variant="secondary" isLoading={isUpdating}>
                    {hasPassword ? 'Save password' : 'Set password'}
                </Button>
            </form>
            </>)}
        </div>
    );
}
