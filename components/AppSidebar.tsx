"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
    LayoutGrid,
    Inbox,
    FileText,
    HeartPulse,
    MapPin,
    User,
    LogOut,
    Menu,
    X,
    Shield,
    Award,
    Plus,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Logo } from './Logo';
import { cn } from '@/lib/cn';

const NAV = [
    { href: '/dashboard', label: 'Overview', icon: LayoutGrid },
    { href: '/requests', label: 'Open requests', icon: Inbox },
    { href: '/requests/my-requests', label: 'My requests', icon: FileText },
    { href: '/donations', label: 'My donations', icon: HeartPulse },
    { href: '/nearby-donors', label: 'Donors near you', icon: MapPin },
    { href: '/milestones', label: 'Milestones', icon: Award },
    { href: '/profile', label: 'Profile', icon: User },
];

export function AppSidebar() {
    const pathname = usePathname();
    const { user, signOut } = useAuth();
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    useEffect(() => setIsMobileOpen(false), [pathname]);

    useEffect(() => {
        if (!isMobileOpen) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsMobileOpen(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isMobileOpen]);

    const navItems = user?.role === 'admin'
        ? [...NAV, { href: '/admin', label: 'Admin', icon: Shield }]
        : NAV;

    const isActive = (path: string) => pathname === path;

    const sidebarContent = (
        <div className="flex h-full flex-col bg-white">
            <div className="flex h-16 items-center px-6">
                <Link href="/" aria-label="Vital home" className="group -mb-1">
                    <Logo />
                </Link>
            </div>

            <div className="px-4 pb-2 pt-2">
                <Link
                    href="/requests/new"
                    className="press flex h-10 items-center justify-center gap-1.5 rounded-md bg-red-600 text-sm font-semibold text-white shadow-sm shadow-red-600/25 hover:bg-red-700"
                >
                    <Plus className="h-4 w-4" /> Request blood
                </Link>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="App">
                <ul className="space-y-0.5">
                    {navItems.map(({ href, label, icon: Icon }) => {
                        const active = isActive(href);
                        return (
                            <li key={href}>
                                <Link
                                    href={href}
                                    aria-current={active ? 'page' : undefined}
                                    className={cn(
                                        'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                        active
                                            ? 'bg-red-50 text-red-700 before:absolute before:inset-y-2 before:-left-3 before:w-[3px] before:rounded-r-full before:bg-red-600'
                                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                                    )}
                                >
                                    <Icon className={cn('h-4 w-4', active ? 'text-red-600' : 'text-gray-400')} strokeWidth={active ? 2 : 1.75} />
                                    {label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="border-t border-gray-200 p-3">
                <div className="flex items-center gap-3 px-2 py-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-semibold text-white">
                        {user?.blood_group || user?.full_name?.[0] || '·'}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{user?.full_name}</p>
                        <p className="truncate text-xs text-gray-500">{user?.email}</p>
                    </div>
                    <button
                        onClick={() => signOut()}
                        className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-700"
                        aria-label="Sign out"
                        title="Sign out"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-gray-200 md:block">
                {sidebarContent}
            </aside>

            <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white/90 px-4 backdrop-blur-md md:hidden">
                <Link href="/dashboard" aria-label="Vital dashboard" className="group -mb-1">
                    <Logo className="text-[22px]" />
                </Link>
                <button
                    onClick={() => setIsMobileOpen(true)}
                    className="-mr-2 rounded-md p-2 text-gray-700"
                    aria-label="Open menu"
                    aria-expanded={isMobileOpen}
                    aria-controls="app-drawer"
                >
                    <Menu className="h-5 w-5" />
                </button>
            </header>

            <AnimatePresence>
                {isMobileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileOpen(false)}
                            className="fixed inset-0 z-40 bg-gray-950/40 md:hidden"
                        />
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                            className="fixed inset-y-0 left-0 z-50 w-72 border-r border-gray-200 md:hidden"
                            id="app-drawer"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Menu"
                        >
                            <button
                                autoFocus
                                onClick={() => setIsMobileOpen(false)}
                                className="absolute right-3 top-4 z-10 rounded-md p-1.5 text-gray-500 hover:text-gray-900"
                                aria-label="Close menu"
                            >
                                <X className="h-5 w-5" />
                            </button>
                            {sidebarContent}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
