import React, { forwardRef } from 'react';
import { Droplet, Award, Heart } from 'lucide-react';

interface DonorCardProps {
    user: {
        full_name: string | null;
        blood_group?: string | null;
        id: string;
    } | null;
    className?: string;
    showAchievements?: boolean;
    achievementCount?: number;
    totalDonations?: number;
}

const DonorCard = forwardRef<HTMLDivElement, DonorCardProps>(({ user, className = "", showAchievements = false, achievementCount = 0, totalDonations = 0 }, ref) => {
    return (
        <div
            ref={ref}
            className={`relative w-full max-w-sm bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-xl overflow-hidden flex flex-col justify-between p-6 border border-slate-100 ${className}`}
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
                {showAchievements && achievementCount > 0 && (
                    <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                        <Award className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-amber-700">{achievementCount} Badges</span>
                    </div>
                )}
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
                            {user?.id?.slice(0, 8).toUpperCase() || "--------"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

DonorCard.displayName = "DonorCard";

export default DonorCard;
