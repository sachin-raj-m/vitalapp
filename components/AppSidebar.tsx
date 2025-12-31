"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    HeartHandshake,
    List,
    MapPin,
    User,
    LogOut,
    Menu,
    X,
    HeartPulse,
    Shield,
    Award
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/Button';

export function AppSidebar() {
    const pathname = usePathname();
    const { user, signOut } = useAuth();
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    // Close mobile menu on path change
    useEffect(() => {
        setIsMobileOpen(false);
    }, [pathname]);

    const navItems = [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/requests', label: 'All Requests', icon: HeartHandshake },
        { href: '/requests/my-requests', label: 'My Requests', icon: List },
        { href: '/donations', label: 'Donations', icon: HeartPulse },
        { href: '/nearby-donors', label: 'Find Donors', icon: MapPin },
        { href: '/achievements', label: 'Achievements', icon: Award },
        { href: '/profile', label: 'Profile', icon: User },
    ];

    if (user?.role === 'admin') {
        navItems.push({ href: '/admin', label: 'Admin Console', icon: Shield });
    }

    const isActive = (path: string) => pathname === path;

    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-white border-r border-gray-200 shadow-sm">
            <Link href="/" className="p-6 flex items-center gap-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="bg-red-50 p-2 rounded-lg">
                    <HeartPulse className="h-6 w-6 text-red-600" />
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-red-900">
                    VitalApp
                </span>
            </Link>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">
                    Menu
                </div>
                {navItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive(item.href)
                            ? 'bg-red-50 text-red-700 font-medium shadow-sm'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}>
                            <item.icon size={20} className={isActive(item.href) ? 'text-red-600' : 'text-gray-400 group-hover:text-gray-600'} />
                            <span>{item.label}</span>
                            {isActive(item.href) && (
                                <motion.div
                                    layoutId="active-pill"
                                    className="ml-auto w-1.5 h-1.5 rounded-full bg-red-600"
                                />
                            )}
                        </div>
                    </Link>
                ))}
            </nav>

            <div className="p-4 border-t border-gray-100">
                <div className="flex items-center gap-3 px-3 py-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold shrink-0">
                        {user?.full_name?.[0] || 'U'}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
                        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => signOut()}
                >
                    <LogOut size={18} className="mr-2" />
                    Sign Out
                </Button>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="hidden md:block w-64 fixed inset-y-0 left-0 z-30">
                <SidebarContent />
            </div>

            <div className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
                <Link href="/dashboard" className="flex items-center gap-2">
                    <div className="bg-red-50 p-1.5 rounded-lg">
                        <HeartPulse className="h-5 w-5 text-red-600" />
                    </div>
                    <span className="font-bold text-lg text-gray-900">VitalApp</span>
                </Link>
                <button
                    onClick={() => setIsMobileOpen(true)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <Menu size={24} />
                </button>
            </div>

            {/* Mobile Overlay & Sidebar */}
            <AnimatePresence>
                {isMobileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileOpen(false)}
                            className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                            className="md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl"
                        >
                            <div className="h-full relative">
                                <button
                                    onClick={() => setIsMobileOpen(false)}
                                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    <X size={20} />
                                </button>
                                <SidebarContent />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
