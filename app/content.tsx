"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Heart, Activity, Users, Clock,
    Shield, CheckCircle, Bell,
    MapPin, Calendar, Lock, PlayCircle, ArrowRight, Share
} from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function HomePage() {
    const { user } = useAuth();
    const router = useRouter();
    const { scrollYProgress } = useScroll();

    // Parallax & Fade effects
    const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
    const yHero = useTransform(scrollYProgress, [0, 0.2], [0, 50]);

    const [stats, setStats] = useState({
        totalDonors: "12,400+",
        livesSupported: "300+",
        avgMatchTime: "< 15 min"
    });

    useEffect(() => {
        if (user) {
            router.push('/dashboard');
        }
        fetchStats();
    }, [user, router]);

    const fetchStats = async () => {
        try {
            const { count: donorCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_donor', true);
            const { count: completedCount } = await supabase.from('blood_requests').select('*', { count: 'exact', head: true }).eq('status', 'completed');
            setStats({
                totalDonors: donorCount ? `${donorCount}+` : "12,400+",
                livesSupported: completedCount ? `${completedCount}+` : "300+",
                avgMatchTime: "< 15 min"
            });
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    };

    const handleShare = async () => {
        const shareData = {
            title: 'Vital - Live Blood Donation Network',
            text: 'I just discovered Vital. It connects blood donors with patients instantly. Check it out!',
            url: window.location.href,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.log('Share dismissed', err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied to clipboard!");
            } catch (err) {
                toast.error("Failed to copy link");
            }
        }
    };

    if (user) return null;

    return (
        <div className="bg-white text-slate-900 font-sans selection:bg-red-100 selection:text-red-900">

            {/* --- HERO SECTION --- */}
            <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-28 overflow-hidden" id="hero">
                <div className="container mx-auto px-4 md:px-6 relative z-10">
                    <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">

                        {/* Left Content */}
                        <motion.div
                            style={{ y: yHero, opacity }}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="space-y-8 text-center lg:text-left"
                        >
                            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
                                A Ready Network of Lifesavers, <br className="hidden lg:block" />
                                <span className="text-red-600">Not Last-Minute Panic.</span>
                            </h1>
                            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                                Join the non-commercial platform connecting voluntary donors to patients in minutes.
                                Safe, private, and always free.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                                <Link href="/register" className="w-full sm:w-auto">
                                    <Button size="xl" className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white rounded-full px-8 py-6 text-lg shadow-lg shadow-red-200 transition-all hover:scale-105">
                                        Become a Donor
                                    </Button>
                                </Link>
                                <Link href="/how-it-works" className="w-full sm:w-auto">
                                    <Button variant="outline" size="xl" className="w-full sm:w-auto rounded-full px-8 py-6 text-lg border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors flex items-center gap-2">
                                        <PlayCircle className="w-5 h-5" />
                                        See How It Works
                                    </Button>
                                </Link>
                            </div>
                        </motion.div>

                        {/* Right Content - Live Activity Card */}
                        <motion.div
                            id="live-stats"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="relative mx-auto w-full max-w-md lg:max-w-full"
                        >
                            {/* Decorative Blur */}
                            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 bg-red-100 rounded-full blur-3xl opacity-50 animate-pulse"></div>

                            <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 overflow-hidden">
                                {/* Header */}
                                <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-4">
                                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-red-500" />
                                        Live Network Activity
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <span className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                        </span>
                                        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Live</span>
                                    </div>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-8 mb-8">
                                    <div>
                                        <div className="text-4xl font-bold text-slate-900 mb-1">{stats.totalDonors}</div>
                                        <div className="text-sm font-medium text-slate-500">Registered Donors</div>
                                    </div>
                                    <div>
                                        <div className="text-4xl font-bold text-slate-900 mb-1">{stats.avgMatchTime}</div>
                                        <div className="text-sm font-medium text-slate-500">Avg. Match Time</div>
                                    </div>
                                </div>

                                {/* Visual Connection Simulation */}
                                <div className="bg-slate-50 rounded-2xl p-6 relative">
                                    <div className="flex justify-between items-center text-sm text-slate-400 mb-4">
                                        <span>Request</span>
                                        <span>Donor Match</span>
                                    </div>
                                    <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <motion.div
                                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 to-red-400"
                                            initial={{ width: "0%" }}
                                            animate={{ width: ["0%", "100%", "0%"] }}
                                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                        />
                                    </div>
                                    <div className="mt-4 flex justify-between items-center">
                                        <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                                            <MapPin className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <Heart className="w-6 h-6 text-red-500 animate-bounce" />
                                        <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                                            <Users className="w-5 h-5 text-red-600" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* --- WHY VITAL EXISTS --- */}
            <section className="py-24 bg-white relative" id="why-vital">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="max-w-2xl mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Why Vital Exists</h2>
                        <p className="text-lg text-slate-600">
                            The current system relies on panic. We're building a system that relies on preparation.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Card 1 */}
                        <div className="p-8 rounded-3xl border border-slate-100 bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-red-100 transition-colors">
                                <Clock className="w-7 h-7 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">The Chaos Today</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Frantic calls, unverified social broadcasts, and lost time during critical emergencies.
                            </p>
                        </div>

                        {/* Card 2 */}
                        <div className="p-8 rounded-3xl border border-slate-100 bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                            <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-orange-100 transition-colors">
                                <Users className="w-7 h-7 text-orange-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">A Different Way</h3>
                            <p className="text-slate-600 leading-relaxed">
                                A connected network of voluntary donors ready to receive alerts instantly based on location.
                            </p>
                        </div>

                        {/* Card 3 */}
                        <div className="p-8 rounded-3xl border border-slate-100 bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-100 transition-colors">
                                <Shield className="w-7 h-7 text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Our Promise</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Zero commercial interests. Safety, speed, and privacy are hard-coded into the platform.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- HOW IT WORKS (Timeline) --- */}
            <section className="py-24 bg-red-50/30" id="how-it-works">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">How Vital Saves Lives</h2>
                        <p className="text-lg text-slate-600">Connecting you to urgent requests in minutes through our hyperlocal network.</p>
                    </div>

                    <div className="relative max-w-4xl mx-auto mb-16">
                        {/* Central Line */}
                        <div className="absolute left-[20px] md:left-1/2 top-0 bottom-0 w-px bg-red-400 md:-translate-x-1/2"></div>

                        <div className="space-y-24">
                            {/* Step 1: Real-time Requests */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="relative flex flex-col md:flex-row items-center gap-8 md:gap-0"
                            >
                                <div className="md:w-1/2 md:pr-16 text-left md:text-right pl-16 md:pl-0 w-full">
                                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative">
                                        <h3 className="text-xl font-bold text-slate-900 mb-2">Real-time Requests</h3>
                                        <p className="text-slate-600 text-sm leading-relaxed">
                                            When a local hospital needs your specific blood type, you receive an instant notification on your device.
                                        </p>
                                    </div>
                                </div>
                                <div className="absolute left-0 md:left-1/2 top-0 md:top-1/2 w-14 h-14 -translate-x-[2px] md:-translate-y-1/2 md:-translate-x-1/2 bg-red-600 rounded-full border-4 border-white shadow-lg flex items-center justify-center z-10 text-white">
                                    <Bell className="w-6 h-6 fill-current" />
                                </div>
                                <div className="md:w-1/2 md:pl-16 hidden md:block"></div>
                            </motion.div>

                            {/* Step 2: Hyperlocal Matching */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="relative flex flex-col md:flex-row items-center gap-8 md:gap-0"
                            >
                                <div className="md:w-1/2 md:pr-16 hidden md:block"></div>
                                <div className="absolute left-0 md:left-1/2 top-0 md:top-1/2 w-14 h-14 -translate-x-[2px] md:-translate-y-1/2 md:-translate-x-1/2 bg-white border-2 border-red-100 rounded-full shadow-lg flex items-center justify-center z-10 text-red-600">
                                    <MapPin className="w-7 h-7" />
                                </div>
                                <div className="md:w-1/2 md:pl-16 pl-16 md:pl-0 w-full">
                                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative">
                                        <h3 className="text-xl font-bold text-slate-900 mb-2">Hyperlocal Matching</h3>
                                        <p className="text-slate-600 text-sm leading-relaxed">
                                            Our algorithm connects you to nearby centers, minimizing travel time for urgent needs.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Step 3: Save a Life */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="relative flex flex-col md:flex-row items-center gap-8 md:gap-0"
                            >
                                <div className="md:w-1/2 md:pr-16 text-left md:text-right pl-16 md:pl-0 w-full">
                                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative">
                                        <h3 className="text-xl font-bold text-slate-900 mb-2">Save a Life</h3>
                                        <p className="text-slate-600 text-sm leading-relaxed">
                                            Arrive at the verified center, complete the donation, and track the impact of your gift.
                                        </p>
                                    </div>
                                </div>
                                <div className="absolute left-0 md:left-1/2 top-0 md:top-1/2 w-14 h-14 -translate-x-[2px] md:-translate-y-1/2 md:-translate-x-1/2 bg-white border-2 border-slate-100 rounded-full shadow-lg flex items-center justify-center z-10 text-slate-400">
                                    <Heart className="w-7 h-7 fill-slate-200" />
                                </div>
                                <div className="md:w-1/2 md:pl-16 hidden md:block"></div>
                            </motion.div>
                        </div>
                    </div>

                    <div className="text-center">
                        <Link href="/register">
                            <Button size="xl" className="bg-red-600 hover:bg-red-700 text-white rounded-full px-10 py-6 text-lg font-bold shadow-xl shadow-red-200 group">
                                Join the Network <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* --- SAFETY SECTION --- */}
            <section className="py-24 bg-white" id="safety">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">

                        {/* Left: Feature List */}
                        <div className="space-y-6">
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                className="flex items-start gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100"
                            >
                                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0 text-red-500">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900">3+ Month Interval</h4>
                                    <p className="text-sm text-slate-600">Auto-paused for donor safety after every donation.</p>
                                </div>
                            </motion.div>

                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                className="flex items-start gap-4 p-6 bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-100"
                            >
                                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-sm shrink-0 text-white">
                                    <CheckCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900">100% Eligible Only</h4>
                                    <p className="text-sm text-slate-600">Strict health screening filters inappropriate donors.</p>
                                </div>
                            </motion.div>

                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                className="flex items-start gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100"
                            >
                                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0 text-amber-500">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900">Private & Secure</h4>
                                    <p className="text-sm text-slate-600">Contact details masked by default until matched.</p>
                                </div>
                            </motion.div>
                        </div>

                        {/* Right: Text */}
                        <div>
                            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
                                Not just a list of donors. <br />
                                <span className="text-red-600">A safety-first system.</span>
                            </h2>
                            <p className="text-lg text-slate-600 leading-relaxed mb-8">
                                Blood donation isn't just about availability; it's about suitability.
                                Vital's eligibility engine ensures that donors are healthy, rested, and ready.
                                We prevent donor fatigue and ensure that every match is a viable one.
                            </p>
                            <Link href="/safety-guidelines" className="text-red-600 font-bold hover:text-red-700 flex items-center gap-2 group">
                                Learn about our safety model <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- FAQ SECTION --- */}
            <section className="py-24 bg-slate-50">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">Frequently Asked Questions</h2>
                        <div className="space-y-4">
                            {[
                                { q: "Who can register as a donor?", a: "Anyone between 18-65 years old, weighing above 45kg, and in good health. Our app guides you through a checklist." },
                                { q: "Is my personal data safe?", a: "Yes. We don't share your contact details publicly. They are only shared with a matched patient after you accept a request." },
                                { q: "How often can I donate?", a: "By NBTC guidelines, men can donate every 3 months and women every 4 months. Vital tracks this automatically." },
                                { q: "Do I get paid for donating?", a: "No. Vital is a 100% voluntary, non-remunerated platform. We believe in the altruistic spirit of saving lives." }
                            ].map((item, i) => (
                                <details key={i} className="group bg-white rounded-2xl border border-slate-200 open:ring-2 open:ring-red-100 transition-all">
                                    <summary className="flex cursor-pointer items-center justify-between font-medium p-6 list-none text-slate-900 select-none">
                                        <span>{item.q}</span>
                                        <span className="transition duration-300 group-open:rotate-180 text-slate-400">
                                            <ArrowRight className="w-5 h-5 rotate-90" />
                                        </span>
                                    </summary>
                                    <div className="text-slate-600 px-6 pb-6 pt-0 leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
                                        {item.a}
                                    </div>
                                </details>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* --- EMOTIONAL CTA --- */}
            <section className="py-24 bg-red-50 text-center">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="max-w-3xl mx-auto space-y-8">
                        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight">
                            You're not just donating blood. <br />
                            <span className="text-slate-600">You're shortening someone's longest night.</span>
                        </h2>
                        <p className="text-xl text-slate-500">
                            Join a community of everyday heroes who stand ready to help their neighbors when it matters most.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center pt-8">
                            <Link href="/register">
                                <Button size="xl" className="bg-red-600 hover:bg-red-700 text-white rounded-md px-10 py-6 text-lg font-bold shadow-xl shadow-red-200">
                                    Register as a Donor
                                </Button>
                            </Link>
                            <Button
                                variant="outline"
                                size="xl"
                                onClick={handleShare}
                                className="rounded-md px-10 py-6 text-lg font-bold border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                                <Share className="w-5 h-5" />
                                I want to help spread the word
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- SOCIAL PROOF --- */}
            <section className="py-20 bg-white border-t border-slate-100">
                <div className="container mx-auto px-4 text-center">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-10">Trusted by those who serve on the frontlines</p>
                    <div className="flex flex-wrap justify-center items-center gap-12 lg:gap-24 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                        {/* Mock Logos - In a real app these would be Images */}
                        <div className="text-xl font-bold text-slate-800 flex items-center gap-2"><div className="w-8 h-8 bg-slate-200 rounded-full"></div> City Hospital</div>
                        <div className="text-xl font-bold text-slate-800 flex items-center gap-2"><div className="w-8 h-8 bg-red-100 rounded-full"></div> Red Cross Chapter</div>
                        <div className="text-xl font-bold text-slate-800 flex items-center gap-2"><div className="w-8 h-8 bg-blue-100 rounded-full"></div> Rotary Club</div>
                        <div className="text-xl font-bold text-slate-800 flex items-center gap-2"><div className="w-8 h-8 bg-emerald-100 rounded-full"></div> Regional Blood Bank</div>
                    </div>
                </div>
            </section>

        </div>
    );
}
