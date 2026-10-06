"use client";

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import { isAppRoute, isHybridRoute, isStandaloneRoute } from '@/lib/routes';

const linkClass = 'text-sm text-gray-600 transition-colors hover:text-gray-900';

export const Footer: React.FC = () => {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (isStandaloneRoute(pathname) || isAppRoute(pathname)) return null;
  if (isHybridRoute(pathname) && user && !loading) return null;


  return (
    <footer className="mt-auto border-t border-gray-200 pb-24 md:pb-0">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-gray-500">
              A free, non-commercial blood donor network. Nobody pays, nobody gets paid.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-16 gap-y-3 sm:grid-cols-3">
            <Link href="/requests" className={linkClass}>Open requests</Link>
            <Link href="/requests/new" className={linkClass}>Request blood</Link>
            <Link href="/register" className={linkClass}>Become a donor</Link>
            <Link href="/how-it-works" className={linkClass}>How it works</Link>
            <Link href="/changelog" className={linkClass}>Changelog</Link>
            <a href="mailto:sachin@vitalapp.in" className={linkClass}>Contact</a>
          </div>
        </div>

        <div className="mt-12 flex flex-col justify-between gap-3 border-t border-gray-200 pt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-gray-400 sm:flex-row sm:items-center">
          <span suppressHydrationWarning>© {new Date().getFullYear()} Vital · Voluntary · Non-remunerated</span>
          <nav className="flex gap-5" aria-label="Legal">
            <Link href="/privacy" className="hover:text-gray-900">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-900">Terms</Link>
            <Link href="/safety-guidelines" className="hover:text-gray-900">Safety</Link>
          </nav>
        </div>
      </div>

    </footer>
  );
};
