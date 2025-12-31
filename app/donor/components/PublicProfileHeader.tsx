"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { HeartPulse, LayoutDashboard, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';

export default function PublicProfileHeader() {
    const { user, loading } = useAuth();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Prevent hydration mismatch by showing a neutral state or placeholder until mounted
    // OR just default to "Become a Donor" and flip if user exists.
    // For smoother UX, we can show a spinner or just waiting.

    // However, "Become a Donor" is the safe default.

    return (
        <header className="relative z-20 w-full flex items-center justify-between px-4 md:px-8 py-4">
            <Link href="/" className="flex items-center gap-2 group hover:opacity-80 transition-opacity">
                <HeartPulse className="h-6 w-6 text-red-600" />
                <span className="text-lg font-bold text-slate-900 tracking-tight">Vital</span>
            </Link>

            <div className="flex items-center gap-3">
                {mounted && !loading && user ? (
                    <Link href="/dashboard">
                        <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-5 h-9 font-medium shadow-sm text-sm transition-transform hover:scale-105 flex items-center gap-2">
                            <LayoutDashboard className="w-4 h-4" />
                            Dashboard
                        </Button>
                    </Link>
                ) : (
                    <Link href="/register">
                        <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-5 h-9 font-medium shadow-sm text-sm transition-transform hover:scale-105 flex items-center gap-2">
                            <UserPlus className="w-4 h-4" />
                            Become a Donor
                        </Button>
                    </Link>
                )}
            </div>
        </header>
    );
}
