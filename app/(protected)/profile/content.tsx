"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Loader2, User, MapPin, Phone, Mail, Droplet, Award, Calendar, Settings, LogOut, Edit2, Check, X, Shield, Heart, Bell, Share, Download, ChevronDown } from 'lucide-react';
import html2canvas from 'html2canvas';

import { PushNotificationManager } from '@/components/PushNotificationManager';
import { SecuritySettings } from './SecuritySettings';
import type { BloodGroup } from '@/types';
import { motion } from 'framer-motion';
import DonorCard from '@/components/DonorCard';

interface Stats {
    total_donations: number;
    total_requests: number;
    last_donation_date: string | null;
    achievements: string[];
}

export default function ProfilePage() {
    const router = useRouter();
    const { user, signOut, session, updateProfile } = useAuth();
    const [stats, setStats] = useState<Stats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isShareOpen, setIsShareOpen] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    const handleLinkShare = () => {
        if (!user?.id) return;
        // @ts-ignore - user type might need update
        const shareId = user.donor_number || user.id;
        const url = `${window.location.origin}/donor/${shareId}`;
        const text = `I'm a proud blood donor on Vital! Check out my official donor card here: ${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleDownload = async () => {
        if (!cardRef.current) return;
        try {
            const canvas = await html2canvas(cardRef.current, {
                // @ts-ignore - html2canvas types might be missing backgroundColor
                backgroundColor: null,
                scale: 3,
                useCORS: true
            });

            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `Vital_Donor_Card_${user?.full_name || 'Member'}.png`;
            link.click();
        } catch (err) {
            console.error('Download failed:', err);
            alert('Could not generate image. Please try again.');
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

            const { data: donations, error: donationsError } = await supabase
                .from('donations')
                .select('created_at', { count: 'exact' })
                .eq('donor_id', user.id);

            if (donationsError) throw donationsError;

            const { data: requests, error: requestsError } = await supabase
                .from('blood_requests')
                .select('created_at', { count: 'exact' })
                .eq('user_id', user.id);

            if (requestsError) throw requestsError;

            const lastDonation = donations?.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

            const achievements = [];
            if (donations?.length >= 1) achievements.push('First Time Donor');
            if (donations?.length >= 5) achievements.push('Regular Donor');
            if (donations?.length >= 10) achievements.push('Super Donor');
            if (requests?.length >= 1) achievements.push('Life Saver');

            setStats({
                total_donations: donations?.length || 0,
                total_requests: requests?.length || 0,
                last_donation_date: lastDonation?.created_at || null,
                achievements
            });
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

    // Eligibility Logic
    const getEligibilityStatus = (lastDate: string | null) => {
        if (!lastDate) return { isEligible: true, daysRemaining: 0, distinctText: "You are eligible to donate today!" };

        const last = new Date(lastDate);
        const nextDate = new Date(last);
        nextDate.setDate(last.getDate() + 90); // Approx 3 months

        const today = new Date();
        const diffTime = nextDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
            return { isEligible: true, daysRemaining: 0, distinctText: "You represent a ready hope for someone in need." };
        } else {
            return { isEligible: false, daysRemaining: diffDays, distinctText: `Next eligibility in ${diffDays} days.` };
        }
    };

    const eligibility = getEligibilityStatus(stats?.last_donation_date || null);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-red-500" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12">
            {error && (
                <Alert variant="error" className="mb-4">
                    {error}
                </Alert>
            )}

            {/* --- HERO SECTION: MESH GRADIENT & DIGITAL CARD --- */}
            <div className="relative rounded-3xl overflow-hidden bg-white shadow-2xl">
                {/* Aurora Mesh Background */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700"></div>
                </div>

                {/* Glassmorphism Content */}
                <div className="relative z-10 p-8 md:p-12">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-12">

                        {/* LEFT: Welcome & Eligibility */}
                        <div className="text-center lg:text-left space-y-6 flex-1">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-2"
                            >
                                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-sm font-medium shadow-sm">
                                    <span className="relative flex h-2 w-2 mr-2">
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${eligibility.isEligible ? 'bg-green-400' : 'bg-orange-400'} opacity-75`}></span>
                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${eligibility.isEligible ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                                    </span>
                                    {eligibility.isEligible ? 'Ready to Donate' : 'Recovering'}
                                </div>
                                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                                    Hello, {user?.full_name?.split(' ')[0] || 'Hero'}.
                                </h1>
                                <p className="text-lg text-white/90 max-w-lg leading-relaxed">
                                    {eligibility.distinctText}
                                    {!eligibility.isEligible && " Thank you for your recent gift of life."}
                                </p>
                            </motion.div>

                            <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                                <Button
                                    onClick={() => router.push('/profile/edit')}
                                    className="bg-white/10 hover:bg-white/25 text-white border border-white/40 backdrop-blur-md"
                                >
                                    <Settings className="w-4 h-4 mr-2" />
                                    Settings
                                </Button>
                                {user?.is_donor && (
                                    <div className="relative inline-block text-left">
                                        <div className="inline-flex rounded-lg shadow-sm isolate">
                                            <button
                                                onClick={handleLinkShare}
                                                className="relative inline-flex items-center gap-x-2 rounded-l-lg bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 border border-slate-200 transition-colors"
                                            >
                                                <Share className="h-4 w-4 text-green-600" />
                                                Share Link
                                            </button>
                                            <button
                                                onClick={() => setIsShareOpen(!isShareOpen)}
                                                className="relative -ml-px inline-flex items-center rounded-r-lg bg-white px-2 py-2 text-slate-500 hover:bg-slate-50 border border-slate-200 transition-colors"
                                            >
                                                <ChevronDown className="h-4 w-4" />
                                            </button>
                                        </div>

                                        {isShareOpen && (
                                            <div className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-xl bg-white shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                <div className="py-1">
                                                    <button
                                                        onClick={() => {
                                                            handleDownload();
                                                            setIsShareOpen(false);
                                                        }}
                                                        className="flex w-full items-center px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors gap-3"
                                                    >
                                                        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                                                            <Download className="h-4 w-4 text-red-600" />
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="font-semibold">Save Image</div>
                                                            <div className="text-xs text-slate-500">Download card as PNG</div>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleLinkShare();
                                                            setIsShareOpen(false);
                                                        }}
                                                        className="flex w-full items-center px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors gap-3 md:hidden"
                                                    >
                                                        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                                                            <Share className="h-4 w-4 text-green-600" />
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="font-semibold">WhatsApp</div>
                                                            <div className="text-xs text-slate-500">Share public link</div>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: Digital Donor Card */}
                        {/* RIGHT: Digital Donor Card */}
                        {/* RIGHT: Digital Donor Card */}
                        <motion.div
                            initial={{ opacity: 0, rotateY: 90 }}
                            animate={{ opacity: 1, rotateY: 0 }}
                            transition={{ delay: 0.2, type: "spring" }}
                            className="perspective-1000 group cursor-pointer"
                        >
                            <DonorCard
                                ref={cardRef}
                                user={user}
                                showAchievements={true}
                                achievementCount={stats?.achievements?.length || 0}
                                totalDonations={stats?.total_donations || 0}
                            />
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* --- STATS & ELIGIBILITY GRID --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Visual Eligibility Ring */}
                <div className="col-span-1 md:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-6 relative overflow-hidden group hover:border-red-100 transition-colors">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 pointer-events-none"></div>

                    <div className="relative w-24 h-24 flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                            <circle
                                cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent"
                                strokeDasharray={251.2}
                                strokeDashoffset={eligibility.isEligible ? 0 : (251.2 * (eligibility.daysRemaining / 90))}
                                className={`transition-all duration-1000 ${eligibility.isEligible ? 'text-green-500' : 'text-amber-500'}`}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-slate-800">
                            {eligibility.isEligible ? <Check className="w-8 h-8 text-green-500" /> : <span>{eligibility.daysRemaining}d</span>}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1">Donation Status</h3>
                        <p className="text-slate-600 text-sm leading-relaxed">
                            {eligibility.isEligible
                                ? "You're fully recharged! Your help is needed nearby."
                                : `Recovering well. You'll be ready to save lives again on ${new Date(Date.now() + eligibility.daysRemaining * 86400000).toLocaleDateString()}.`
                            }
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl group-hover:scale-110 transition-transform">
                            <Heart className="w-6 h-6 fill-current" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 mb-1">{stats?.total_donations || 0}</div>
                    <div className="text-sm font-medium text-slate-500">Lives Impacted (Appx)</div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-blue-50 text-blue-600 p-3 rounded-xl group-hover:scale-110 transition-transform">
                            <Calendar className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 mb-1">
                        {stats?.total_requests || 0}
                    </div>
                    <div className="text-sm font-medium text-slate-500">Requests Posted</div>
                </div>
            </div>

            {/* --- BADGES & ACHIEVEMENTS --- */}
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    Your Hall of Fame
                </h3>
                {
                    stats?.achievements && stats.achievements.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {stats.achievements.map((achievement, index) => {
                                // Assign icons based on achievement name (simple heuristic)
                                const isDonor = achievement.includes('Donor');
                                const isLife = achievement.includes('Life');

                                return (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.1 * index }}
                                        className="relative group p-6 rounded-2xl border border-slate-200 bg-white hover:border-amber-300 hover:shadow-lg transition-all text-center flex flex-col items-center justify-center gap-3"
                                    >
                                        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                                            {isDonor ? <Droplet className="text-amber-600 w-7 h-7" /> :
                                                isLife ? <Heart className="text-red-500 w-7 h-7" /> :
                                                    <Award className="text-amber-600 w-7 h-7" />}
                                        </div>
                                        <span className="font-bold text-slate-900 group-hover:text-amber-700 transition-colors">{achievement}</span>
                                    </motion.div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-500">
                            <p>No badges yet. Complete your first donation to earn the "First Blood" badge!</p>
                        </div>
                    )
                }
            </div >

            {/* --- SETTINGS & CONTENT --- */}


            {/* --- COMPONENT SECTIONS --- */}
            <div className="grid md:grid-cols-2 gap-8">
                <div>
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-900">Account Security</h3>
                        <p className="text-slate-500 text-sm">Manage how you access your account.</p>
                    </div>
                    <SecuritySettings />
                </div>

                <div>
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-900">Preferences</h3>
                        <p className="text-slate-500 text-sm">Customize your notification experience.</p>
                    </div>
                    <Card className="hover:shadow-md transition-shadow">
                        <CardBody className="p-0">
                            <div className="flex items-center justify-between p-6">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
                                        <Bell className="h-6 w-6 text-indigo-600" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-900">Push Notifications</div>
                                        <div className="text-sm text-slate-500">Receive alerts when blood is needed nearby</div>
                                    </div>
                                </div>
                                <PushNotificationManager />
                            </div>
                        </CardBody>
                    </Card>

                    {/* Contact Info (Compact) */}
                    <div className="mt-8">
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-slate-900">My Info</h3>
                        </div>
                        <Card className="divide-y divide-slate-100">
                            <div className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                <span className="text-slate-500 text-sm">Email</span>
                                <span className="font-medium text-slate-900">{user?.email}</span>
                            </div>
                            <div className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                <span className="text-slate-500 text-sm">Phone</span>
                                <span className="font-medium text-slate-900">{user?.phone || '--'}</span>
                            </div>
                            <div className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                <span className="text-slate-500 text-sm">Location</span>
                                <span className="font-medium text-slate-900 truncate max-w-[200px]">{user?.present_zip || '--'}</span>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            {/* --- DANGER ZONE & SIGN OUT --- */}
            <div className="pt-8 border-t border-slate-200 mt-12 space-y-8">



                <div className="rounded-xl border border-red-200 bg-red-50 p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                            <Shield className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="space-y-3 flex-1">
                            <div>
                                <h4 className="text-base font-bold text-red-900">Danger Zone</h4>
                                <p className="text-sm text-red-700 mt-1 leading-relaxed">
                                    Permanently delete your account and all data. This action cannot be undone.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                className="bg-red-600 text-white hover:bg-red-700 shadow-sm border border-red-600"
                                onClick={async () => {
                                    if (confirm('CRITICAL WARNING: You are about to permanently delete your account.\n\nType "DELETE" to confirm.')) {
                                        if (confirm('Are you absolutely sure? There is no going back.')) {
                                            try {
                                                const res = await fetch('/api/auth/delete', { method: 'POST' });
                                                if (!res.ok) throw new Error('Deletion failed');
                                                await signOut();
                                                router.push('/login');
                                            } catch (e) {
                                                alert('Failed to delete account. Please try again.');
                                            }
                                        }
                                    }
                                }}
                            >
                                Delete My Account
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
