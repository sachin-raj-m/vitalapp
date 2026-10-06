"use client";

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';

export default function PublicProfileHeader() {
    const { user, loading } = useAuth();

    return (
        <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
            <Link href="/" aria-label="Vital home" className="-mb-1">
                <Logo />
            </Link>
            {!loading && user ? (
                <Link href="/dashboard" className="text-sm text-gray-700 hover:text-gray-900">
                    Your dashboard
                </Link>
            ) : (
                <Link href="/login" className="text-sm text-gray-700 hover:text-gray-900">
                    Sign in
                </Link>
            )}
        </header>
    );
}
