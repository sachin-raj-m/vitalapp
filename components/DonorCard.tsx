"use client";

import React, { forwardRef } from 'react';
import { Droplet, Award } from 'lucide-react';
import Link from 'next/link';
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
    return (
        <motion.div
            ref={ref}
            className={`relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col gap-6 p-8 border border-slate-100 ${className}`}
            whileHover={{ scale: 1.02, boxShadow: "0 30px 60px -12px rgba(220, 38, 38, 0.2)" }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-red-50 to-orange-50 rounded-full -mr-20 -mt-20 opacity-60 pointer-events-none blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-red-50 to-pink-50 rounded-full -ml-16 -mb-16 opacity-60 pointer-events-none blur-xl"></div>

            {/* Card Header */}
            <div className="relative flex justify-between items-center z-10 w-full">
                <div className="flex items-center gap-4">
                    <motion.div
                        className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-red-200 border-2 border-white ring-2 ring-red-50"
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.8 }}
                    >
                        <Droplet className="w-7 h-7 fill-current" />
                    </motion.div>
                    <div>
                        <div className="text-[11px] text-slate-500 uppercase tracking-[0.2em] font-bold mb-1">Vital Member</div>
                        <h3 className="text-slate-900 font-black text-lg tracking-tight leading-none">Official Donor Card</h3>
                    </div>
                </div>
                {showAchievements && achievementCount > 0 && (
                    <Link href="/achievements" className="flex items-center gap-2 bg-amber-50 pl-2 pr-3 py-1.5 rounded-full border border-amber-100 hover:bg-amber-100 transition-colors cursor-pointer group shadow-sm">
                        <Award className="w-5 h-5 text-amber-500" />
                        <span className="text-sm font-bold text-amber-700 group-hover:text-amber-800">{achievementCount}</span>
                    </Link>
                )}
            </div>

            {/* Card Body: Blood Group & Stats */}
            <div className="relative flex justify-between items-start z-10 w-full px-2">
                {/* Column 1: Blood Group */}
                <div className="flex-1 flex flex-col items-center">
                    <div className="h-20 flex items-center justify-center">
                        <motion.div
                            className="text-7xl font-black text-slate-900 tracking-tighter leading-none"
                            whileHover={{ scale: 1.1, color: "#dc2626" }}
                            transition={{ type: "spring", stiffness: 400 }}
                        >
                            {user?.blood_group || "??"}
                        </motion.div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase mt-4 tracking-[0.2em] text-center w-full">Blood Group</div>
                </div>

                {/* Divider - Vertically aligned with content */}
                <div className="h-16 w-px bg-slate-200/80 mt-2 self-start"></div>

                {/* Column 2: Total Donations */}
                <div className="flex-1 flex flex-col items-center">
                    <div className="h-20 flex items-center justify-center">
                        <motion.div
                            className="text-6xl font-black text-slate-900 tracking-tighter leading-none"
                            whileHover={{ scale: 1.1, color: "#dc2626" }}
                            transition={{ type: "spring", stiffness: 400 }}
                        >
                            {totalDonations}
                        </motion.div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase mt-4 tracking-[0.2em] text-center w-full">Total Donations</div>
                </div>
            </div>

            {/* Card Footer */}
            <div className="relative border-t border-slate-100/80 pt-6 mt-2 z-10 w-full">
                <div className="flex justify-between items-end w-full">
                    <div className="flex-1 pr-4">
                        <div className="text-[10px] text-slate-400 uppercase mb-2 font-bold tracking-wider">Holder Name</div>
                        <div className="text-slate-900 font-black text-xl uppercase truncate w-full tracking-tight leading-snug">
                            {user?.full_name || "Unknown"}
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="text-[10px] text-slate-400 uppercase mb-2 font-bold tracking-wider">Donor ID</div>
                        <div className="font-mono text-slate-600 text-sm bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-semibold shadow-sm">
                            {donorNumber ? `#${donorNumber}` : (user?.id?.slice(0, 8).toUpperCase() || "--------")}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
});

DonorCard.displayName = "DonorCard";

export default DonorCard;
