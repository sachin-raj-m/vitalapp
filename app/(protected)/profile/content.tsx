"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchUserStats, calculateEligibility, type UserStats } from '@/lib/stats';
import { Loader2, User, MapPin, Phone, Mail, Droplet, Award, Calendar, Settings, LogOut, Edit2, Check, X, Shield, Heart, Bell, Share, Download, ChevronDown, Star, Trophy, Globe, Copy, ExternalLink, Link as LinkIcon, Eye, EyeOff } from 'lucide-react';
import html2canvas from 'html2canvas';

import { PushNotificationManager } from '@/components/PushNotificationManager';
import { SecuritySettings } from './SecuritySettings';
import type { BloodGroup } from '@/types';
import { motion } from 'framer-motion';
import DonorCard from '@/components/DonorCard';
import { toast } from 'sonner';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

export default function ProfilePage() {
    const router = useRouter();
    const { user, signOut, session, updateProfile } = useAuth();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    const handleLinkShare = () => {
        if (!user?.id) return;
        const cleanName = (user?.full_name || 'User').replace(/[^a-zA-Z0-9]/g, '');
        const uniqueId = user?.donor_number || user?.id;
        const vanitySlug = `${cleanName}@${uniqueId}`;
        const url = `${window.location.origin}/donor/${vanitySlug}`;
        const text = `I'm a proud blood donor on Vital! Check out my official donor card here: ${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const togglePublicProfile = async (newValue: boolean) => {
        try {
            await updateProfile({ is_public_profile: newValue });
            // Optimistic update if needed, but AuthContext should handle it
        } catch (err) {
            console.error('Failed to toggle visibility', err);
            toast.error('Failed to update visibility settings');
        }
    };

    const handleDeleteAccount = async () => {
        try {
            const res = await fetch('/api/auth/delete', { method: 'POST' });
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

    // Eligibility Logic using shared utility
    const eligibility = calculateEligibility(stats?.last_donation_date || null);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-red-500" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-8">
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
                                    Edit Profile
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
                                achievementCount={stats?.achievements?.filter(a => a.unlocked).length || 0}
                                totalDonations={stats?.total_donations || 0}
                                donorNumber={user?.donor_number}
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

                <Link href="/donations" className="block">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all group cursor-pointer">
                        <div className="flex justify-between items-start mb-4">
                            <div className="bg-red-50 text-red-600 p-3 rounded-xl group-hover:scale-110 transition-transform">
                                <Heart className="w-6 h-6 fill-current" />
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-slate-900 mb-1">{stats?.total_donations || 0}</div>
                        <div className="text-sm font-medium text-slate-500">Lives Impacted (Appx)</div>
                    </div>
                </Link>

                <Link href="/requests/my-requests" className="block">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all group cursor-pointer">
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
                </Link>
            </div>

            {/* --- BADGES & ACHIEVEMENTS --- */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-500" />
                        Your Legacy
                    </h3>
                    {stats?.total_points !== undefined && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-100 rounded-full">
                            <Trophy className="w-4 h-4 text-amber-600" />
                            <span className="font-bold text-amber-900 text-sm">{stats.total_points} pts</span>
                        </div>
                    )}
                </div>

                {
                    stats?.achievements && stats.achievements.some(a => a.unlocked) ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {stats.achievements.filter(a => a.unlocked).map((achievement, index) => {
                                const getIcon = () => {
                                    switch (achievement.icon) {
                                        case 'droplet': return <Droplet className="text-amber-600 w-7 h-7" />;
                                        case 'shield': return <Shield className="text-amber-600 w-7 h-7" />;
                                        case 'star': return <Star className="text-amber-600 w-7 h-7" />;
                                        case 'trophy': return <Trophy className="text-amber-600 w-7 h-7" />;
                                        case 'heart': return <Heart className="text-red-500 w-7 h-7" />;
                                        default: return <Award className="text-amber-600 w-7 h-7" />;
                                    }
                                };

                                return (
                                    <Link href="/achievements" key={achievement.id}>
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.1 * index }}
                                            className="relative group p-6 rounded-2xl border border-slate-200 bg-white hover:border-amber-300 hover:shadow-lg transition-all text-center flex flex-col items-center justify-center gap-3 cursor-pointer h-full"
                                            title={achievement.motto}
                                        >
                                            <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                                                {getIcon()}
                                            </div>
                                            <div className="space-y-1">
                                                <div className="font-bold text-slate-900 group-hover:text-amber-700 transition-colors text-sm">{achievement.name}</div>
                                                <div className="text-xs text-slate-400 font-medium">{achievement.points} pts</div>
                                            </div>
                                        </motion.div>
                                    </Link>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-500 flex flex-col items-center gap-2">
                            <Droplet className="w-8 h-8 text-slate-300 mb-2" />
                            <p className="font-medium text-slate-900">Start Your Legacy</p>
                            <p className="text-sm">Complete your first donation to earn the "First Drop" badge and 50 points!</p>
                        </div>
                    )
                }
            </div>

            {/* --- SETTINGS & CONTENT --- */}

            {/* Public Identity Section - Prominent & Accessible */}
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-20 -mt-20 pointer-events-none opacity-50"></div>

                <div className="relative z-10">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-indigo-50 rounded-lg">
                                    <Globe className="w-6 h-6 text-indigo-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">Public Profile</h3>
                            </div>
                            <p className="text-slate-600 max-w-xl">
                                Your public profile is your digital identity. Share it with partners like MuLearn or on social media to verify your donor status.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className={`text-sm font-bold ${user?.is_public_profile ? 'text-green-600' : 'text-slate-400'}`}>
                                {user?.is_public_profile ? 'Visible to Everyone' : 'Private'}
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={user?.is_public_profile || false}
                                    onChange={(e) => togglePublicProfile(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-14 h-8 bg-slate-200 peer-focus:outline-none ring-4 ring-transparent peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                    </div>

                    {user?.is_public_profile ? (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="bg-slate-50 rounded-xl p-4 md:p-5 border border-slate-200 flex flex-col md:flex-row items-center gap-4">
                                <div className="flex-1 w-full min-w-0">
                                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                        <LinkIcon className="w-3 h-3" />
                                        Your Public Link
                                    </div>
                                    <div className="font-mono text-sm md:text-base text-slate-700 truncate select-all bg-white px-3 py-2 rounded-lg border border-slate-200">
                                        {(() => {
                                            const cleanName = (user?.full_name || 'User').replace(/[^a-zA-Z0-9]/g, '');
                                            const uniqueId = user?.donor_number || user?.id;
                                            const vanitySlug = `${cleanName}@${uniqueId}`;
                                            return typeof window !== 'undefined' ? `${window.location.origin}/donor/${vanitySlug}` : `/donor/${vanitySlug}`;
                                        })()}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            const cleanName = (user?.full_name || 'User').replace(/[^a-zA-Z0-9]/g, '');
                                            const uniqueId = user?.donor_number || user?.id;
                                            const vanitySlug = `${cleanName}@${uniqueId}`;
                                            navigator.clipboard.writeText(`${window.location.origin}/donor/${vanitySlug}`);
                                            toast.success('Link copied to clipboard!');
                                        }}
                                        className="flex-1 md:flex-none h-10 md:h-11"
                                    >
                                        <Copy className="w-4 h-4 mr-2" />
                                        Copy
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            const cleanName = (user?.full_name || 'User').replace(/[^a-zA-Z0-9]/g, '');
                                            const uniqueId = user?.donor_number || user?.id;
                                            const vanitySlug = `${cleanName}@${uniqueId}`;
                                            window.open(`/donor/${vanitySlug}`, '_blank');
                                        }}
                                        className="flex-1 md:flex-none h-10 md:h-11 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200"
                                    >
                                        <ExternalLink className="w-4 h-4 mr-2" />
                                        Preview
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex items-start gap-3">
                            <div className="p-1.5 bg-amber-100 rounded-full mt-0.5">
                                <EyeOff className="w-4 h-4 text-amber-600" />
                            </div>
                            <div>
                                <h4 className="font-bold text-amber-900 text-sm">Profile is Private</h4>
                                <p className="text-amber-700 text-sm mt-0.5">Your donor card is not visible to others. Enable public access to share your verified status.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>


            {/* --- COMPONENT SECTIONS --- */}
            {/* --- PREFERENCES & INFO GRID --- */}
            <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                {/* Left Column: Preferences */}
                <div className="space-y-4">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-900">Preferences</h3>
                        <p className="text-slate-500 text-sm">Customize your notification experience.</p>
                    </div>
                    <Card className="hover:shadow-md transition-shadow h-full">
                        <CardBody className="p-0 h-full">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 gap-4 h-full">
                                <div className="flex items-start sm:items-center space-x-4">
                                    <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                                        <Bell className="h-6 w-6 text-indigo-600" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-900">Push Notifications</div>
                                        <div className="text-sm text-slate-500">Receive alerts when blood is needed nearby</div>
                                    </div>
                                </div>
                                <div className="self-end sm:self-auto">
                                    <PushNotificationManager />
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </div>

                {/* Right Column: Contact Info */}
                <div className="space-y-4">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-900">My Info</h3>
                        <p className="text-slate-500 text-sm">Your private contact details.</p>
                    </div>
                    <Card className="divide-y divide-slate-100 h-full">
                        <div className="p-6 flex justify-between items-center hover:bg-slate-50 transition-colors">
                            <span className="text-slate-500 text-sm flex items-center gap-2 shrink-0">
                                <Mail className="w-4 h-4" /> Email
                            </span>
                            <span className="font-medium text-slate-900 text-right truncate ml-4">{user?.email}</span>
                        </div>
                        <div className="p-6 flex justify-between items-center hover:bg-slate-50 transition-colors">
                            <span className="text-slate-500 text-sm flex items-center gap-2 shrink-0">
                                <Phone className="w-4 h-4" /> Phone
                            </span>
                            <span className="font-medium text-slate-900 text-right truncate ml-4">{user?.phone || '--'}</span>
                        </div>
                        <div className="p-6 flex justify-between items-center hover:bg-slate-50 transition-colors">
                            <span className="text-slate-500 text-sm flex items-center gap-2 shrink-0">
                                <MapPin className="w-4 h-4" /> ZIP Code
                            </span>
                            <span className="font-medium text-slate-900 text-right truncate ml-4 max-w-[200px]">{user?.present_zip || '--'}</span>
                        </div>
                    </Card>
                </div>
            </div>


            {/* --- DELETE ACCOUNT MODAL --- */}
            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteAccount}
                title="Delete Account"
                description="Are you absolutely sure? This action cannot be undone and will permanently delete your account and all data."
                confirmText="Yes, Delete My Account"
                cancelText="Cancel"
                variant="danger"
            />

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
                                onClick={() => setShowDeleteModal(true)}
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
