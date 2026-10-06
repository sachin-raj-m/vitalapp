"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { supabase } from '@/lib/supabase';

export function SecuritySettings() {
    const [loading, setLoading] = useState(true);
    const [identities, setIdentities] = useState<any[]>([]);
    const [passwordForm, setPasswordForm] = useState({
        newPassword: '',
        confirmPassword: ''
    });
    const [isUpdating, setIsUpdating] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const fetchUserIdentities = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.identities) {
                setIdentities(user.identities);
            }
            setLoading(false);
        };
        fetchUserIdentities();
    }, []);

    const hasPassword = identities.some(id => id.provider === 'email');
    const hasGoogle = identities.some(id => id.provider === 'google');

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

            // Refresh identities to reflect new email provider if it was missing
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.identities) setIdentities(user.identities);

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
            <p className="text-sm text-gray-600">
                Signed in with{' '}
                <span className="text-gray-900">
                    {[hasGoogle && 'Google', hasPassword && 'email and password'].filter(Boolean).join(' and ') || 'email'}
                </span>
                .
            </p>
            {hasGoogle && !hasPassword && (
                <p className="text-sm text-gray-600">Set a password if you’d also like to sign in with your email address.</p>
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
                    {hasPassword ? 'Update password' : 'Set password'}
                </Button>
            </form>
        </div>
    );
}
