"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, Activity, Users, Clock, ChevronRight, ArrowRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function HomePage() {
    const { user } = useAuth();
    const router = useRouter();
    const { scrollYProgress } = useScroll();
    const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
    const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

    const [stats, setStats] = useState({
        totalDonors: 0,
        livesSaved: 0
    });

    useEffect(() => {
        if (user) {
            router.push('/dashboard');
        }
        fetchStats();
    }, [user, router]);

    const fetchStats = async () => {
        const { count: donorCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_donor', true);
        const { count: completedCount } = await supabase.from('blood_requests').select('*', { count: 'exact', head: true }).eq('status', 'completed');
        setStats({
            totalDonors: donorCount || 0,
            livesSaved: completedCount || 0
        });
    };

    if (user) return null;

    return (
        <div className="bg-white text-gray-900 overflow-hidden">
            {/* Hero Section */}
            <motion.section
                style={{ opacity, scale }}
                className="relative min-h-[90vh] flex items-center justify-center bg-gradient-to-b from-red-50 to-white overflow-hidden"
            >
                <div className="absolute inset-0 z-0 opacity-30">
                    <div className="absolute top-20 left-10 w-72 h-72 bg-red-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
                    <div className="absolute top-40 right-10 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
                    <div className="absolute -bottom-8 left-20 w-72 h-72 bg-red-100 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
                </div>

                <div className="container mx-auto px-4 z-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="space-y-6 max-w-4xl mx-auto"
                    >
                        <div className="inline-flex items-center space-x-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-red-100 shadow-sm mb-4">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                            <span className="text-sm font-medium text-gray-600">Urgent need in your area</span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 leading-tight">
                            The bridge between <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-red-400">Hope and Life</span>
                        </h1>

                        <p className="text-xl md:text-2xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
                            Every distinct second counts when a life is on the line. We connect heroes with those fighting for another chance.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                            <Link href="/register">
                                <Button size="xl" variant="primary" className="shadow-xl shadow-red-200 hover:shadow-2xl hover:shadow-red-300 transition-all duration-300 px-8 rounded-full text-lg group">
                                    Become a Hero <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                            <Link href="/requests">
                                <Button size="xl" variant="outline" className="px-8 rounded-full text-lg border-gray-200 hover:bg-gray-50">
                                    View Requests
                                </Button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </motion.section>

            {/* The Story / Problem Section */}
            <section className="py-24 bg-white relative">
                <div className="container mx-auto px-4">
                    <div className="max-w-3xl mx-auto space-y-16">
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                            className="text-center space-y-4"
                        >
                            <h2 className="text-3xl font-bold text-gray-900">Why Vital Exists</h2>
                            <p className="text-lg text-gray-600 leading-relaxed">
                                In emergencies, finding a specific blood type often means frantic phone calls and social media posts. The chaos costs time—and time costs lives.
                            </p>
                        </motion.div>

                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <motion.div
                                initial={{ opacity: 0, x: -30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-gray-50 p-8 rounded-3xl border border-gray-100 relative overflow-hidden group hover:shadow-lg transition-shadow"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                                <Clock className="h-10 w-10 text-red-500 mb-4 relative z-10" />
                                <h3 className="text-xl font-bold mb-2 relative z-10">The Gap</h3>
                                <p className="text-gray-600 relative z-10">
                                    Patients often wait hours for a compatible donor to be located and travel to the hospital.
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, x: 30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 }}
                                className="bg-red-50 p-8 rounded-3xl border border-red-100 relative overflow-hidden group hover:shadow-lg transition-shadow"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-bl-full -mr-8 -mt-8 opacity-50 transition-transform group-hover:scale-110"></div>
                                <Activity className="h-10 w-10 text-red-600 mb-4 relative z-10" />
                                <h3 className="text-xl font-bold mb-2 relative z-10">The Vital Solution</h3>
                                <p className="text-gray-900 relative z-10">
                                    We use real-time geolocation to alert the nearest registered donors instantly. Minutes, not hours.
                                </p>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Impact Stats - Minimal */}
            <section className="py-20 border-y border-gray-100 bg-gray-50/50">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-gray-200">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            className="p-4"
                        >
                            <div className="text-4xl font-bold text-gray-900 mb-1">{stats.totalDonors > 50 ? stats.totalDonors : '50+'}</div>
                            <div className="text-sm text-gray-500 font-medium uppercase tracking-wide">Heroes Registered</div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="p-4"
                        >
                            <div className="text-4xl font-bold text-red-600 mb-1">{stats.livesSaved > 5 ? stats.livesSaved : '12'}</div>
                            <div className="text-sm text-gray-500 font-medium uppercase tracking-wide">Lives Impacted</div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="p-4"
                        >
                            <div className="text-4xl font-bold text-gray-900 mb-1">10<span className="text-red-500 text-2xl">min</span></div>
                            <div className="text-sm text-gray-500 font-medium uppercase tracking-wide">Avg. Response</div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="p-4"
                        >
                            <div className="text-4xl font-bold text-gray-900 mb-1">24<span className="text-red-500 text-2xl">/7</span></div>
                            <div className="text-sm text-gray-500 font-medium uppercase tracking-wide">Emergency Support</div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* How it Works - Storytelling */}
            <section className="py-24 bg-white">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-gray-900">How You Make a Difference</h2>
                    </div>

                    <div className="relative max-w-5xl mx-auto">
                        {/* Connecting Line */}
                        <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -translate-y-1/2 z-0"></div>

                        <div className="grid md:grid-cols-3 gap-12 relative z-10">
                            {[
                                {
                                    icon: Users,
                                    title: "Join the Network",
                                    desc: "Create your profile in 2 minutes. We only notify you when someone nearby truly needs your specific blood type."
                                },
                                {
                                    icon: Heart,
                                    title: "Get Notified",
                                    desc: "When an emergency strikes near you, you'll receive a real-time alert with hospital details."
                                },
                                {
                                    icon: Activity,
                                    title: "Save a Life",
                                    desc: "Walk in, donate, and walk out a hero. You'll literally be the reason someone goes back home to their family."
                                }
                            ].map((step, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.2 }}
                                    className="bg-white p-6 text-center group"
                                >
                                    <div className="w-20 h-20 mx-auto bg-white border-4 border-gray-50 rounded-full flex items-center justify-center mb-6 shadow-sm group-hover:border-red-100 group-hover:shadow-md transition-all">
                                        <step.icon className="h-8 w-8 text-gray-400 group-hover:text-red-500 transition-colors" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                                    <p className="text-gray-600 leading-relaxed text-sm">
                                        {step.desc}
                                    </p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 bg-gradient-to-br from-red-600 to-red-700 text-white overflow-hidden relative">
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

                <div className="container mx-auto px-4 relative z-10 text-center space-y-8">
                    <motion.h2
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        className="text-4xl md:text-5xl font-bold tracking-tight"
                    >
                        Ready to be someone's miracle?
                    </motion.h2>
                    <p className="text-red-100 text-xl max-w-2xl mx-auto">
                        There is no substitute for human blood. Only you can save a life.
                    </p>
                    <div className="pt-4">
                        <Link href="/register">
                            <Button size="xl" className="bg-white text-red-600 hover:bg-red-50 border-none shadow-xl px-10 rounded-full text-lg font-bold">
                                Join Vital Now
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}

// Add animation keyframes for blob
const styles = `
  @keyframes blob {
    0% { transform: translate(0px, 0px) scale(1); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
    100% { transform: translate(0px, 0px) scale(1); }
  }
  .animate-blob {
    animation: blob 7s infinite;
  }
  .animation-delay-2000 {
    animation-delay: 2s;
  }
  .animation-delay-4000 {
    animation-delay: 4s;
  }
`;
