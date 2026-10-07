"use client";

import { authedFetch } from '@/lib/api';
import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchUserStats, calculateEligibility, type UserStats } from '@/lib/stats';
import { Copy, Download, ExternalLink, Pencil, Send } from 'lucide-react';
import { format } from 'date-fns';
import { donorProfilePath } from '@/lib/donor-slug';
import { buildDonorShareMessage, whatsappShareUrl } from '@/lib/share';
import { formatBloodGroup } from '@/lib/blood-compatibility';
import { Skeleton } from '@/components/ui/Skeleton';
import html2canvas from 'html2canvas';
import { motion } from 'framer-motion';

import { PushNotificationManager } from '@/components/PushNotificationManager';
import DonorCard from '@/components/DonorCard';
import { toast } from 'sonner';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

export default function ProfilePage() {
    const router = useRouter();
    const { user, signOut, session, updateProfile } = useAuth();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    const publicPath = user ? donorProfilePath(user) : '';
    // Read on the client after mount so server and client render the same markup.
    const [host, setHost] = useState('');
    useEffect(() => setHost(window.location.host), []);

    const handleLinkShare = () => {
        if (!user?.id) return;
        // Link the public card only when it is visible; otherwise share an invite.
        const text = buildDonorShareMessage({
            origin: window.location.origin,
            path: donorProfilePath(user),
            isPublic: !!user.is_public_profile,
            bloodGroup: user.blood_group,
        });
        window.open(whatsappShareUrl(text), '_blank', 'noopener,noreferrer');
    };

    const togglePublicProfile = async (newValue: boolean) => {
        try {
            await updateProfile({ is_public_profile: newValue });
        } catch (err) {
            console.error('Failed to toggle visibility', err);
            toast.error('Failed to update visibility settings');
        }
    };

    const handleDeleteAccount = async () => {
        try {
            const res = await authedFetch('/api/auth/delete', { method: 'POST' });
            if (!res.ok) throw new Error('Deletion failed');
            await signOut();
            router.push('/login');
            toast.success('Account deleted successfully');
        } catch (e) {
            toast.error('Failed to delete account. Please try again.');
            setShowDeleteModal(false);
        }
    };

    const handleDownload = async () => {
        if (!cardRef.current) return;

        // Save original styles
        const originalStyle = cardRef.current.style.cssText;
        const originalClass = cardRef.current.className;

        try {
            // Apply capture-friendly styles to prevent overflow/clipping
            // We force a specific width and remove transforms/margins during capture
            cardRef.current.style.transform = 'none';
            cardRef.current.style.margin = '0';
            cardRef.current.style.boxShadow = 'none'; // Shadow sometimes clips

            // Create a temporary container for clean capture
            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.top = '-9999px';
            container.style.left = '-9999px';
            container.style.width = '420px'; // Slightly larger to fit card comfortably
            container.style.padding = '20px'; // Padding to capture shadow if needed (though we disabled it)
            container.style.background = '#ffffff'; // White background for clean alpha
            document.body.appendChild(container);

            // Clone the card into the container
            const clone = cardRef.current.cloneNode(true) as HTMLElement;
            clone.style.transform = 'none';
            clone.style.width = '100%';
            clone.style.maxWidth = 'none';
            container.appendChild(clone);

            const canvas = await html2canvas(clone, {
                backgroundColor: null,
                scale: 3, // High resolution
                logging: false,
                useCORS: true,
                allowTaint: true
            } as any);

            // Cleanup
            document.body.removeChild(container);

            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `Vital_Donor_Card_${user?.full_name || 'Member'}.png`;
            link.click();
        } catch (err) {
            console.error('Download failed:', err);
            toast.error('Could not generate image. Please try again.');
        } finally {
            // Restore styles (though we mostly used a clone, it's good practice)
            cardRef.current.style.cssText = originalStyle;
            cardRef.current.className = originalClass;
        }
    };

    useEffect(() => {
        if (user) {
            loadStats();
        }
    }, [user]);

    const loadStats = async () => {
        try {
            if (!user) return;

            const stats = await fetchUserStats(user.id);
            setStats(stats);
        } catch (err: any) {
            console.error('Error loading stats');
            setError('Failed to load statistics');
        } finally {
            setIsLoading(false);
        }
    };



    const handleSignOut = async () => {
        try {
            await signOut();
            router.push('/login');
        } catch (err) {
            console.error('Error signing out');
        }
    };

    const copyPublicLink = async () => {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}${publicPath}`);
            toast.success('Link copied');
        } catch {
            toast.error('Couldn’t copy the link');
        }
    };

    // Eligibility Logic using shared utility
    const eligibility = calculateEligibility(stats?.last_donation_date || null);

    const unlocked = stats?.achievements?.filter(a => a.unlocked) ?? [];
    const row = (label: string, value: React.ReactNode) => (
        <div className="grid grid-cols-3 gap-4 py-3.5">
            <dt className="text-sm text-gray-500">{label}</dt>
            <dd className="col-span-2 truncate text-gray-900">{value || <span className="text-gray-500">Not set</span>}</dd>
        </div>
    );

    return (
        <div className="space-y-12">
            {error && <Alert variant="error">{error}</Alert>}

            <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                <div>
                    <h1 className="display text-4xl sm:text-[2.75rem]">{user?.full_name || 'Your profile'}</h1>
                    <p className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                        <span className={`h-2 w-2 rounded-full ${eligibility.isEligible ? 'bg-success-500' : 'bg-warning-500'}`} />
                        {eligibility.isEligible
                            ? 'Ready to donate'
                            : `Recovering · eligible again on ${format(eligibility.nextEligibleDate, 'd MMM yyyy')}`}
                    </p>
                </div>
                <Link
                    href="/profile/edit"
                    className="inline-flex h-9 items-center gap-1.5 self-start rounded-md border border-gray-300 bg-white px-3.5 text-sm font-medium text-gray-900 hover:border-gray-400 sm:self-auto"
                >
                    <Pencil className="h-3.5 w-3.5" /> Edit profile
                </Link>
            </header>

            <section className="grid gap-10 lg:grid-cols-[minmax(0,28rem)_1fr] lg:gap-14">
                <div>
                    <div className="flex justify-center rounded-2xl border border-gray-200 bg-gray-100 px-5 py-8 sm:px-8 sm:py-10">
                        {isLoading ? (
                            <Skeleton className="h-[22rem] w-full max-w-sm rounded-3xl" />
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, rotateY: 90 }}
                                animate={{ opacity: 1, rotateY: 0 }}
                                transition={{ delay: 0.2, type: 'spring' }}
                                className="flex w-full justify-center [perspective:1000px]"
                            >
                                <DonorCard
                                    ref={cardRef}
                                    user={user}
                                    showAchievements={unlocked.length > 0}
                                    achievementCount={unlocked.length}
                                    totalDonations={stats?.total_donations || 0}
                                    donorNumber={user?.donor_number}
                                />
                            </motion.div>
                        )}
                    </div>
                    {user?.is_donor && (
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                            <Button size="sm" variant="secondary" onClick={handleDownload} leftIcon={<Download className="h-3.5 w-3.5" />}>
                                Save image
                            </Button>
                            <Button size="sm" variant="secondary" onClick={handleLinkShare} leftIcon={<Send className="h-3.5 w-3.5" />}>
                                WhatsApp
                            </Button>
                        </div>
                    )}
                </div>

                <div className="space-y-10">
                    <div>
                        <h2 className="text-lg font-medium tracking-tight text-gray-900">Details</h2>
                        <dl className="mt-3 divide-y divide-gray-200 border-y border-gray-200">
                            {row('Blood group', formatBloodGroup(user?.blood_group))}
                            {row('Email', user?.email)}
                            {row('Phone', user?.phone)}
                            {row('City', [user?.city, user?.present_zip].filter(Boolean).join(' · '))}
                            {row('Donations', isLoading ? '…' : `${stats?.total_donations ?? 0} verified · ${stats?.total_requests ?? 0} requests posted`)}
                        </dl>
                    </div>

                    <div>
                        <div className="flex items-start justify-between gap-6">
                            <div>
                                <h2 className="text-lg font-medium tracking-tight text-gray-900">Public donor card</h2>
                                <p className="mt-1 max-w-md text-sm leading-relaxed text-gray-600">
                                    When on, anyone with your link can see your card: first name, blood group and donation count. Never your contact details.
                                </p>
                            </div>
                            <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                                <input
                                    type="checkbox"
                                    checked={user?.is_public_profile || false}
                                    onChange={(e) => togglePublicProfile(e.target.checked)}
                                    className="peer sr-only"
                                    aria-label="Make donor card public"
                                />
                                <span className="h-6 w-11 rounded-full bg-gray-300 transition-colors after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:bg-gray-900 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-red-600 peer-focus-visible:ring-offset-2" />
                            </label>
                        </div>
                        {user?.is_public_profile && (
                            <div className="mt-4 flex items-center gap-2">
                                <code className="min-w-0 flex-1 truncate rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-[13px] text-gray-700">
                                    {host}{publicPath}
                                </code>
                                <Button size="sm" variant="secondary" onClick={copyPublicLink} aria-label="Copy link"><Copy className="h-3.5 w-3.5" /></Button>
                                <a href={publicPath} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-md border border-gray-300 bg-white px-3 text-gray-700 hover:border-gray-400" aria-label="Open public card">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            </div>
                        )}
                    </div>

                    <div className="flex items-start justify-between gap-6 border-t border-gray-200 pt-8">
                        <div>
                            <h2 className="text-lg font-medium tracking-tight text-gray-900">Alerts on this device</h2>
                            <p className="mt-1 max-w-md text-sm leading-relaxed text-gray-600">
                                Get a push notification when someone in your city needs a blood group you can give to.
                            </p>
                        </div>
                        <div className="shrink-0 pt-1"><PushNotificationManager /></div>
                    </div>
                </div>
            </section>

            <section className="flex flex-col gap-4 border-t border-gray-200 pt-8 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="font-medium text-gray-900">Delete account</h2>
                    <p className="mt-1 text-sm text-gray-500">Removes your profile, requests and donation history for good.</p>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={handleSignOut}>Sign out</Button>
                    <Button size="sm" variant="secondary" className="text-red-700" onClick={() => setShowDeleteModal(true)}>
                        Delete account
                    </Button>
                </div>
            </section>

            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteAccount}
                title="Delete your account?"
                description="This permanently deletes your account and everything in it. It can’t be undone."
                confirmText="Delete my account"
                variant="danger"
            />
        </div>
    );
}
