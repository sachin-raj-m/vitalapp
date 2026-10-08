"use client";

import React, { forwardRef } from 'react';
import { Droplet, Award, Shield, Star, Trophy, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Achievement } from '@/lib/stats';

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
    badges?: Achievement[];
}

const getBadgeIcon = (iconName: string) => {
    switch (iconName) {
        case 'droplet': return <Droplet className="w-4 h-4" />;
        case 'shield': return <Shield className="w-4 h-4" />;
        case 'star': return <Star className="w-4 h-4" />;
        case 'trophy': return <Trophy className="w-4 h-4" />;
        case 'heart': return <Heart className="w-4 h-4" />;
        default: return <Award className="w-4 h-4" />;
    }
};

const getBadgeColor = (iconName: string) => {
    switch (iconName) {
        case 'droplet': return 'text-[#ef4444] bg-[#fef2f2] ring-[#fee2e2]';
        case 'shield': return 'text-amber-700 bg-amber-50 ring-amber-100';
        case 'star': return 'text-[#94a3b8] bg-[#f8fafc] ring-[#e2e8f0]';
        case 'trophy': return 'text-yellow-500 bg-yellow-50 ring-yellow-100';
        case 'heart': return 'text-rose-500 bg-rose-50 ring-rose-100';
        default: return 'text-blue-500 bg-blue-50 ring-blue-100';
    }
};

const DonorCard = forwardRef<HTMLDivElement, DonorCardProps>(({ user, className = "", showAchievements = false, achievementCount = 0, totalDonations = 0, donorNumber, badges = [] }, ref) => {
    return (
        <motion.div
            ref={ref}
            className={`relative w-full max-w-sm font-sans bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col gap-5 p-6 border border-[#f1f5f9] ${className}`}
            whileHover={{ scale: 1.02, boxShadow: "0 30px 60px -12px rgba(220, 38, 38, 0.2)" }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#fef2f2] rounded-full -mr-20 -mt-20 opacity-60 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-50 rounded-full -ml-16 -mb-16 opacity-60 pointer-events-none"></div>

            {/* Card Header */}
            <div className="relative flex justify-between items-center z-10 w-full mb-2">
                <div className="flex items-center gap-3">
                    <motion.div
                        className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ef4444] to-[#dc2626] flex items-center justify-center text-white shadow-lg shadow-[#fecaca] border-2 border-white ring-2 ring-[#fef2f2]"
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.8 }}
                    >
                        <Droplet className="w-6 h-6 fill-current" />
                    </motion.div>
                    <div>
                        <div className="text-[10px] text-[#64748b] uppercase tracking-[0.2em] font-bold mb-0.5">Vital Member</div>
                        <p className="text-[#0f172a] font-black text-base tracking-tight leading-none">Official Donor Card</p>
                    </div>
                </div>
                {/* Achievement Badge Counter (simplified) */}
                {badges.length > 0 && (
                    <div className="flex items-center gap-1.5 bg-amber-50 pl-2 pr-3 py-1 rounded-full border border-amber-100">
                        <Award className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-amber-700">{badges.length}</span>
                    </div>
                )}
            </div>

            {/* Card Body: Blood Group & Stats */}
            <div className="relative flex justify-between items-start z-10 w-full px-2">
                {/* Column 1: Blood Group */}
                <div className="flex-1 flex flex-col items-center">
                    <div className="h-16 flex items-center justify-center">
                        <motion.div
                            className="text-6xl font-black text-[#0f172a] tracking-tighter leading-none"
                            whileHover={{ scale: 1.1, color: "#dc2626" }}
                        >
                            {user?.blood_group || "??"}
                        </motion.div>
                    </div>
                    <div className="text-[9px] text-[#64748b] font-bold uppercase mt-2 tracking-[0.2em] text-center w-full">Blood Group</div>
                </div>

                {/* Divider */}
                <div className="h-12 w-px bg-[#e2e8f0]/80 mt-2 self-start mx-4"></div>

                {/* Column 2: Total Donations */}
                <div className="flex-1 flex flex-col items-center">
                    <div className="h-16 flex items-center justify-center">
                        <motion.div
                            className="text-5xl font-black text-[#0f172a] tracking-tighter leading-none"
                            whileHover={{ scale: 1.1, color: "#dc2626" }}
                        >
                            {totalDonations}
                        </motion.div>
                    </div>
                    <div className="text-[9px] text-[#64748b] font-bold uppercase mt-2 tracking-[0.2em] text-center w-full">Total Donations</div>
                </div>
            </div>

            {/* Badges Section (Detailed List) */}
            {badges.length > 0 && (
                <div className="relative z-10 w-full mt-2 mb-1 bg-[#f8fafc]/80 rounded-2xl p-4 border border-[#f1f5f9]">
                    <div className="flex items-center gap-2 mb-3">
                        <Award className="w-4 h-4 text-[#94a3b8]" />
                        <div className="text-[10px] text-[#64748b] uppercase font-bold tracking-wider">Achievements</div>
                    </div>
                    <div className="flex flex-col gap-3">
                        {badges.map((badge) => (
                            <div key={badge.id} className="flex items-start gap-3 group">
                                <div className={`p-2 rounded-full ring-1 shrink-0 ${getBadgeColor(badge.icon)} group-hover:scale-110 transition-transform`}>
                                    {getBadgeIcon(badge.icon)}
                                </div>
                                <div className="flex flex-col pt-0.5">
                                    <span className="text-xs font-bold text-[#1e293b] leading-none mb-1 group-hover:text-[#dc2626] transition-colors">{badge.name}</span>
                                    <span className="text-[10px] text-[#64748b] leading-tight">{badge.motto}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Card Footer */}
            <div className="relative border-t border-[#f1f5f9]/80 pt-4 mt-1 z-10 w-full flex justify-between items-end">
                <div className="flex flex-col items-start gap-1">
                    <div className="text-[9px] text-[#64748b] uppercase font-bold tracking-wider">Holder Name</div>
                    <div className="text-[#0f172a] font-black text-lg uppercase truncate max-w-[180px] tracking-tight">
                        {user?.full_name || "Unknown"}
                    </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                    <div className="text-[9px] text-[#64748b] uppercase font-bold tracking-wider">Donor ID</div>
                    <div className="font-mono text-[#475569] text-xs bg-[#f8fafc] px-2 py-1 rounded border border-[#e2e8f0] font-semibold">
                        {donorNumber ? `#${donorNumber}` : (user?.id?.slice(0, 8).toUpperCase() || "--------")}
                    </div>
                </div>
            </div>
        </motion.div>
    );
});

DonorCard.displayName = "DonorCard";

export default DonorCard;
