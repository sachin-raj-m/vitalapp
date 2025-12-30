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
}

const DonorCard = forwardRef<HTMLDivElement, DonorCardProps>(({ user, className = "", showAchievements = false, achievementCount = 0 }, ref) => {
    return (
        <div
            ref={ref}
            className={`relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col justify-between p-6 ${className}`}
        >
            {/* Card Header */}
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                        <Droplet className="w-5 h-5 text-red-600 fill-current" />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Vital Member</div>
                        <div className="text-slate-900 font-bold text-sm">Official Donor Card</div>
                    </div>
                </div>
                {showAchievements && achievementCount > 2 && <Award className="w-6 h-6 text-amber-500" />}
            </div>

            {/* Card Body */}
            <div className="text-center py-6">
                <div className="text-5xl font-black text-slate-900 tracking-tighter">
                    {user?.blood_group || "??"}
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1">BLOOD GROUP</div>
            </div>

            {/* Card Footer */}
            <div className="flex justify-between items-end border-t border-slate-100 pt-4">
                <div>
                    <div className="text-[10px] text-slate-400 uppercase mb-0.5">Holder Name</div>
                    <div className="text-slate-900 font-bold text-sm uppercase truncate max-w-[150px]">
                        {user?.full_name || "Unknown"}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase mb-0.5">Donor ID</div>
                    <div className="font-mono text-slate-600 text-xs bg-slate-100 px-2 py-1 rounded">
                        {user?.id?.slice(0, 8).toUpperCase() || "--------"}
                    </div>
                </div>
            </div>
        </div>
    );
});

DonorCard.displayName = "DonorCard";

export default DonorCard;
