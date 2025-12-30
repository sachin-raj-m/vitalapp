"use client";

import React, { forwardRef, useState } from 'react';
import { Droplet, Award, Heart, RotateCw, Calendar, Check, Info } from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';

interface DonorCardProps {
    user: {
        full_name: string | null;
        blood_group?: string | null;
        id: string;
        donor_number?: number;
    } | null;
    className?: string;
    showAchievements?: boolean;
    achievementCount?: number;
    totalDonations?: number;
    donorNumber?: number | null;
}

const DonorCard = forwardRef<HTMLDivElement, DonorCardProps>(({ user, className = "", showAchievements = false, achievementCount = 0, totalDonations = 0, donorNumber }, ref) => {
    const [isFlipped, setIsFlipped] = useState(false);

    // Calculate next steps (Mock data logic for now, should ideally come from props)
    const shareUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/donor/${donorNumber || user?.id}`
        : '';

    return (
        <div className={`relative perspective-1000 w-full max-w-sm min-h-[280px] ${className}`} ref={ref}>
            <motion.div
                className="absolute inset-0 preserve-3d"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                style={{ transformStyle: 'preserve-3d' }}
            >
                {/* --- FRONT SIDE --- */}
                <div
                    className="absolute inset-0 backface-hidden bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-xl overflow-hidden flex flex-col justify-between p-6 border border-slate-100"
                    style={{ backfaceVisibility: 'hidden' }}
                >
                    {/* Background Pattern */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-red-50 rounded-full -ml-8 -mb-8 opacity-50 pointer-events-none"></div>

                    {/* Card Header */}
                    <div className="relative flex justify-between items-start mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-200">
                                <Droplet className="w-5 h-5 fill-current" />
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Vital Member</div>
                                <div className="text-slate-900 font-extrabold text-sm tracking-tight">Official Donor Card</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {showAchievements && achievementCount > 0 && (
                                <Link href="/achievements" className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-full border border-amber-100 hover:bg-amber-100 transition-colors cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                    <Award className="w-4 h-4 text-amber-500" />
                                    <span className="text-xs font-bold text-amber-700">{achievementCount}</span>
                                </Link>
                            )}
                            <button
                                onClick={() => setIsFlipped(true)}
                                className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                            >
                                <RotateCw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Card Body: Blood Group & Stats */}
                    <div className="relative flex items-center justify-between py-2 mb-6">
                        <div className="text-center">
                            <div className="text-5xl font-black text-slate-900 tracking-tighter leading-none">
                                {user?.blood_group || "??"}
                            </div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase mt-2 tracking-wider">Blood Group</div>
                        </div>
                        <div className="h-12 w-px bg-slate-200 mx-4"></div>
                        <div className="text-center flex-1">
                            <div className="text-3xl font-black text-slate-900 tracking-tighter leading-none">
                                {totalDonations}
                            </div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase mt-2 tracking-wider">Total Donations</div>
                        </div>
                    </div>

                    {/* Card Footer */}
                    <div className="relative pt-4 border-t border-slate-100 mt-auto">
                        <div className="flex justify-between items-end">
                            <div>
                                <div className="text-[10px] text-slate-400 uppercase mb-1 font-semibold">Holder Name</div>
                                <div className="text-slate-900 font-bold text-sm uppercase truncate max-w-[160px]">
                                    {user?.full_name || "Unknown"}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-slate-400 uppercase mb-1 font-semibold">Donor ID</div>
                                <div className="font-mono text-slate-600 text-xs bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                    {donorNumber ? `#${donorNumber}` : (user?.id?.slice(0, 8).toUpperCase() || "--------")}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- BACK SIDE --- */}
                <div
                    className="absolute inset-0 backface-hidden bg-slate-900 text-white rounded-2xl shadow-xl overflow-hidden flex flex-col p-6"
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center">
                                {shareUrl && (
                                    <QRCodeSVG
                                        value={shareUrl}
                                        size={32}
                                        level="L"
                                        fgColor="#1e293b"
                                    />
                                )}
                            </div>
                            <div>
                                <div className="text-xs text-slate-400 font-semibold">Scan to verify</div>
                                <div className="text-white font-bold text-sm">Vital Profile</div>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsFlipped(false)}
                            className="p-1.5 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
                        >
                            <RotateCw className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-4 flex-1">
                        {/* Next Eligibility */}
                        <div className="bg-white/5 rounded-xl p-3 border border-white/10 flex items-center gap-3">
                            <div className="p-2 bg-green-500/20 rounded-lg text-green-400">
                                <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Next Eligibility</div>
                                <div className="text-sm font-medium text-white">Available Today</div>
                            </div>
                        </div>

                        {/* Compatibility Helper */}
                        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                            <div className="flex items-center gap-2 mb-2">
                                <Info className="w-3 h-3 text-blue-400" />
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Can donate to</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {/* Simplified compatibility logic based on blood group - placeholder for now */}
                                <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono border border-white/10">{user?.blood_group || 'ALL'}</span>
                                <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono border border-white/10">AB+</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto text-center border-t border-white/10 pt-3">
                        <div className="text-[10px] text-slate-500">
                            Emergency? Show this card to responders.
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
});

DonorCard.displayName = "DonorCard";

export default DonorCard;
