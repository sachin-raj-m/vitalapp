"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { supabase } from '@/lib/supabase';
import { Lock, Check, Loader2 } from 'lucide-react';

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

        if (passwordForm.newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
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
        <Card>
            <CardHeader>
                <h2 className="text-xl font-semibold flex items-center">
                    <Lock className="h-5 w-5 mr-2 text-primary-600" />
                    Security Settings
                </h2>
            </CardHeader>
            <CardBody>
                <div className="space-y-6">
                    {/* Identity Badges */}
                    <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
                        <span>Linked Accounts:</span>
                        {hasGoogle && (
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">Google</span>
                        )}
                        {hasPassword && (
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">Email/Password</span>
                        )}
                    </div>

                    <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {hasPassword ? 'Change Password' : 'Set Account Password'}
                        </h3>
                        {hasGoogle && !hasPassword && (
                            <p className="text-sm text-gray-600 mb-4">
                                You are currently logged in via Google. Set a password to enable logging in with your email address as well.
                            </p>
                        )}

                        {message && (
                            <Alert variant={message.type === 'success' ? 'success' : 'error'} className="mb-4">
                                {message.text}
                            </Alert>
                        )}

                        <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-md">
                            <Input
                                type="password"
                                label="New Password"
                                placeholder="Min. 6 characters"
                                value={passwordForm.newPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                required
                            />
                            <Input
                                type="password"
                                label="Confirm Password"
                                placeholder="Re-enter password"
                                value={passwordForm.confirmPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                required
                            />
                            <Button type="submit" disabled={isUpdating}>
                                {isUpdating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4 mr-2" />
                                        {hasPassword ? 'Update Password' : 'Set Password'}
                                    </>
                                )}
                            </Button>
                        </form>
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}
