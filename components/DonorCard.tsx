"use client";

import React, { forwardRef } from 'react';
import type { Achievement } from '@/lib/stats';
import { formatBloodGroup } from '@/lib/blood-compatibility';
import { cn } from '@/lib/cn';

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

/**
 * The shareable donor card. Kept free of motion/transforms so html2canvas
 * can capture it cleanly for "Save image".
 */
const DonorCard = forwardRef<HTMLDivElement, DonorCardProps>(
    ({ user, className, totalDonations = 0, donorNumber, badges = [] }, ref) => {
        const id = donorNumber ? `№ ${String(donorNumber).padStart(4, '0')}` : user?.id?.slice(0, 8).toUpperCase() || '—';

        return (
            <div
                ref={ref}
                className={cn('relative w-full max-w-sm overflow-hidden rounded-xl bg-gray-950 p-6 text-gray-50 sm:p-7', className)}
            >
                <div className="flex items-start justify-between">
                    <span className="font-serif text-2xl leading-none tracking-tight">vital</span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-500">{id}</span>
                </div>

                <div className="mt-10 flex items-end justify-between gap-4">
                    <div className="font-serif text-[6.5rem] leading-[0.8] tracking-tight text-red-400">
                        {formatBloodGroup(user?.blood_group) || '?'}
                    </div>
                    <div className="pb-1 text-right">
                        <div className="font-serif text-5xl leading-none">{totalDonations}</div>
                        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500">
                            {totalDonations === 1 ? 'Donation' : 'Donations'}
                        </div>
                    </div>
                </div>

                {badges.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-1.5">
                        {badges.map(badge => (
                            <span
                                key={badge.id}
                                title={badge.motto}
                                className="rounded-full border border-gray-800 px-2.5 py-1 text-[11px] text-gray-300"
                            >
                                {badge.name}
                            </span>
                        ))}
                    </div>
                )}

                <div className="mt-8 flex items-end justify-between gap-4 border-t border-gray-800 pt-4">
                    <div className="min-w-0">
                        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500">Donor</div>
                        <div className="mt-1 truncate text-lg font-medium tracking-tight">{user?.full_name || 'Unknown'}</div>
                    </div>
                    <div className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500">Voluntary</div>
                </div>
            </div>
        );
    }
);

DonorCard.displayName = 'DonorCard';

export default DonorCard;
